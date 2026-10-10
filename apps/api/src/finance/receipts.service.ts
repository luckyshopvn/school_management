import { Injectable } from '@nestjs/common';
import type { ReceiptMethod, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { invoiceAmounts } from '../fees/invoice-amounts.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { ReceiptReversalsService } from './receipt-reversals.service.js';
import { guardianUserIds, isGuardianOf, unallocatedReceipts } from './receivables.js';

// Phiếu thu, phân bổ vào hóa đơn, phân bổ số dư có của trẻ (P06-01, P06-02; QT-04 bước 2 đến 7;
// BR-28, BR-30, BR-31, BR-34, BR-35; Q-47, Q-152; YCTD-53). Phiếu thu phát hành ngay khi lập, không có bản nháp
const CASHIER_ROLE = 'VT-16';
const RECEIPT_SEQUENCE = 'receipt';
const VIEW_PERMISSIONS = ['P06.view', PERMISSION_CODES.receiptManage];

export interface AllocationInput {
  invoiceId: string;
  amount: number;
}

export interface ReceiptInput {
  requestKey: string;
  childId: string;
  payerName: string;
  amount: number;
  method: ReceiptMethod;
  accountId: string;
  categoryId: string;
  receiptDate: string;
  content: string | null;
  allocations: AllocationInput[];
}

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly reversals: ReceiptReversalsService,
    private readonly clock: Clock,
  ) {}

  async create(currentUser: CurrentUser, input: ReceiptInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    // Gửi lại cùng mã yêu cầu thì trả phiếu đã lập (QT-04 E5)
    const repeated = await this.findByRequestKey(database, input.requestKey);
    if (repeated) {
      return this.read(currentUser, repeated);
    }
    const child = await this.loadChild(database, input.childId);
    await this.assertCanCollect(currentUser, child.org_unit_id);
    const cashierOnly = this.isCashierOnly(currentUser);
    if (cashierOnly && input.method !== 'cash') {
      throw new ApplicationError('ERR_FORBIDDEN', 'Thủ quỹ chỉ lập phiếu thu tiền mặt (Q-152)');
    }
    if (input.receiptDate > this.today()) {
      throw validationError([{ field: 'receipt_date', message: 'Ngày thu không được sau ngày hiện tại' }]);
    }
    const account = await database
      .selectFrom('cash_accounts')
      .select(['id', 'org_unit_id', 'account_type', 'status', 'name'])
      .where('id', '=', input.accountId)
      .executeTakeFirst();
    if (!account || account.status !== 'active' || account.org_unit_id !== child.org_unit_id) {
      throw validationError([
        { field: 'account_id', message: 'Tài khoản nhận phải là quỹ hoặc tài khoản đang dùng của đơn vị của trẻ' },
      ]);
    }
    if (
      (input.method === 'cash' && account.account_type !== 'cash') ||
      (input.method === 'transfer' && account.account_type !== 'bank')
    ) {
      throw validationError([
        {
          field: 'account_id',
          message:
            input.method === 'cash'
              ? 'Thu tiền mặt thì tài khoản nhận là quỹ tiền mặt'
              : 'Thu chuyển khoản thì tài khoản nhận là tài khoản ngân hàng',
        },
      ]);
    }
    const category = await database
      .selectFrom('cashflow_categories')
      .select(['id', 'flow_type', 'status'])
      .where('id', '=', input.categoryId)
      .executeTakeFirst();
    if (!category || category.status !== 'active' || category.flow_type !== 'income') {
      throw validationError([{ field: 'category_id', message: 'Khoản mục phải là khoản mục thu đang dùng' }]);
    }
    try {
      const receiptId = await database.transaction().execute(async (transaction) => {
        const settled = await this.checkAllocations(transaction, child.id, input.allocations, input.amount, 'receipt');
        const code = await this.nextCode(transaction);
        const receipt = await transaction
          .insertInto('receipts')
          .values({
            code,
            org_unit_id: child.org_unit_id,
            child_id: child.id,
            payer_name: input.payerName,
            amount: input.amount,
            method: input.method,
            account_id: account.id,
            category_id: category.id,
            receipt_date: input.receiptDate,
            content: input.content,
            request_key: input.requestKey,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (input.allocations.length > 0) {
          await transaction
            .insertInto('receipt_allocations')
            .values(
              input.allocations.map((allocation) => ({
                receipt_id: receipt.id,
                invoice_id: allocation.invoiceId,
                amount: allocation.amount,
                created_by: origin.actorUserId,
              })),
            )
            .execute();
        }
        const balanceAfter = await this.recordAccountTransaction(transaction, {
          accountId: account.id,
          date: input.receiptDate,
          amount: input.amount,
          receiptId: receipt.id,
          description: `${code} thu của ${child.full_name}`,
        });
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'receipts',
          entityId: receipt.id,
          action: 'create',
          before: null,
          after: {
            code,
            child_id: child.id,
            payer_name: input.payerName,
            amount: input.amount,
            method: input.method,
            account: account.name,
            account_balance_after: balanceAfter,
            receipt_date: input.receiptDate,
            allocations: input.allocations,
          },
        });
        const credit = input.amount - input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
        await queueNotification(transaction, {
          orgUnitId: child.org_unit_id,
          templateCode: 'receipt_issued',
          title: 'Nhà trường đã nhận tiền',
          body: `${code}: đã nhận ${input.amount} đồng cho ${child.full_name}${
            credit > 0 ? `, ${credit} đồng ghi thành số dư có cho kỳ sau` : ''
          }`,
          targetType: 'receipts',
          targetId: receipt.id,
          recipients: (await guardianUserIds(transaction, child.id)).flatMap((userId) => [
            { userId, channel: 'in_app' as const },
            { userId, channel: 'sms' as const },
          ]),
        });
        await this.notifySettled(transaction, child, settled);
        return receipt.id;
      });
      return this.read(currentUser, receiptId);
    } catch (error) {
      // Hai yêu cầu cùng mã gửi đồng thời: yêu cầu sau trả phiếu của yêu cầu trước
      if ((error as { code?: string }).code === '23505') {
        const existing = await this.findByRequestKey(database, input.requestKey);
        if (existing) {
          return this.read(currentUser, existing);
        }
      }
      throw error;
    }
  }

  // Dùng số dư có của trẻ để thanh toán hóa đơn kỳ sau; tiền lấy từ phiếu thu cũ nhất trước (GD-27, P06-02)
  async allocateCredit(
    currentUser: CurrentUser,
    childId: string,
    allocations: AllocationInput[],
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.loadChild(database, childId);
    await this.assertCanCollect(currentUser, child.org_unit_id);
    if (allocations.length === 0) {
      throw validationError([{ field: 'allocations', message: 'Chọn ít nhất một hóa đơn' }]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.selectFrom('receipts').select('id').where('child_id', '=', childId).forUpdate().execute();
      const pendingReversal = new Set(
        (
          await transaction
            .selectFrom('receipts')
            .select('id')
            .where('child_id', '=', childId)
            .where('status', '=', 'pending_reversal')
            .execute()
        ).map((row) => row.id),
      );
      // Phiếu đang chờ duyệt đảo không dùng làm nguồn số dư có
      const sources = (await unallocatedReceipts(transaction, [childId])).filter(
        (source) => !pendingReversal.has(source.id),
      );
      const credit = sources.reduce((sum, source) => sum + source.remaining, 0);
      const settled = await this.checkAllocations(transaction, childId, allocations, credit, 'credit');
      const rows: Array<{ receipt_id: string; invoice_id: string; amount: number; created_by: string }> = [];
      for (const allocation of allocations) {
        let left = allocation.amount;
        for (const source of sources) {
          const used = Math.min(left, source.remaining);
          if (used > 0) {
            rows.push({
              receipt_id: source.id,
              invoice_id: allocation.invoiceId,
              amount: used,
              created_by: origin.actorUserId,
            });
            source.remaining -= used;
            left -= used;
          }
        }
      }
      await transaction.insertInto('receipt_allocations').values(rows).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'receipt_allocations',
        entityId: childId,
        action: 'create',
        before: { credit },
        after: {
          credit: credit - allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
          allocations: rows.map((row) => ({
            receipt_id: row.receipt_id,
            invoice_id: row.invoice_id,
            amount: row.amount,
          })),
        },
      });
      await this.notifySettled(transaction, child, settled);
    });
    return { child_id: childId, allocated: allocations.reduce((sum, allocation) => sum + allocation.amount, 0) };
  }

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; from: string | null; to: string | null; childId: string | null },
  ) {
    const units = await this.staffUnits(currentUser);
    if (!units.wholeSchool && units.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu thu');
    }
    if (filter.orgUnitId && !units.wholeSchool && !units.orgUnitIds.includes(filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.receiptQuery(database);
    if (filter.orgUnitId) {
      query = query.where('receipts.org_unit_id', '=', filter.orgUnitId);
    } else if (!units.wholeSchool) {
      query = query.where('receipts.org_unit_id', 'in', units.orgUnitIds);
    }
    if (filter.from) {
      query = query.where('receipts.receipt_date', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('receipts.receipt_date', '<=', filter.to);
    }
    if (filter.childId) {
      query = query.where('receipts.child_id', '=', filter.childId);
    }
    return this.withAllocated(
      database,
      await query.orderBy('receipts.receipt_date', 'desc').orderBy('receipts.code', 'desc').execute(),
    );
  }

  // Lịch sử phiếu thu của một trẻ cho nhân sự trong phạm vi hoặc phụ huynh của trẻ (AC-106)
  async ofChild(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.loadChild(database, childId);
    await this.assertCanViewChild(database, currentUser, child);
    return this.withAllocated(
      database,
      await this.receiptQuery(database)
        .where('receipts.child_id', '=', childId)
        .orderBy('receipts.receipt_date', 'desc')
        .orderBy('receipts.code', 'desc')
        .execute(),
    );
  }

  async read(currentUser: CurrentUser, receiptId: string) {
    const { database } = await this.currentSchoolYear.require();
    const receipt = await this.receiptQuery(database).where('receipts.id', '=', receiptId).executeTakeFirst();
    if (!receipt) {
      throw notFoundError('Không tìm thấy phiếu thu', 'receipt');
    }
    await this.assertCanViewChild(database, currentUser, {
      id: receipt.child_id,
      org_unit_id: receipt.org_unit_id,
    });
    const allocations = await database
      .selectFrom('receipt_allocations')
      .innerJoin('invoices', 'invoices.id', 'receipt_allocations.invoice_id')
      .select([
        'receipt_allocations.id',
        'receipt_allocations.invoice_id',
        'invoices.code as invoice_code',
        'invoices.period_year',
        'invoices.period_month',
        'receipt_allocations.amount',
        'receipt_allocations.created_at',
      ])
      .where('receipt_allocations.receipt_id', '=', receiptId)
      .orderBy('receipt_allocations.created_at')
      .execute();
    const allocated = allocations.reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      ...receipt,
      amount: Number(receipt.amount),
      allocated_amount: allocated,
      allocations: allocations.map((row) => ({ ...row, amount: Number(row.amount) })),
      reversals: await this.reversals.ofReceipt(database, receiptId),
    };
  }

  // Hóa đơn phải đã phát hành, của đúng trẻ, chưa thu đủ; số phân bổ bằng đúng số còn phải nộp (BR-31, Q-47)
  // và tổng không vượt số tiền có thể dùng. Khóa hóa đơn để hai phiếu đồng thời không thu trùng một hóa đơn
  private async checkAllocations(
    transaction: Transaction<SchoolYearDatabase>,
    childId: string,
    allocations: AllocationInput[],
    available: number,
    source: 'receipt' | 'credit',
  ): Promise<Array<{ id: string; code: string | null; period_year: number; period_month: number }>> {
    if (allocations.length === 0) {
      return [];
    }
    const ids = allocations.map((allocation) => allocation.invoiceId);
    if (new Set(ids).size !== ids.length) {
      throw validationError([{ field: 'allocations', message: 'Mỗi hóa đơn chỉ chọn một lần' }]);
    }
    const invoices = await transaction
      .selectFrom('invoices')
      .select(['id', 'code', 'child_id', 'status', 'total_amount', 'period_year', 'period_month'])
      .where('id', 'in', ids)
      .forUpdate()
      .execute();
    if (invoices.length !== ids.length) {
      throw notFoundError('Không tìm thấy hóa đơn được chọn', 'invoice');
    }
    if (invoices.some((invoice) => invoice.child_id !== childId)) {
      throw ruleViolationError('BR-31', 'Một phiếu thu chỉ thanh toán hóa đơn của một trẻ');
    }
    const draft = invoices.find((invoice) => invoice.status !== 'issued');
    if (draft) {
      throw ruleViolationError('BR-31', 'Chỉ thu cho hóa đơn đã phát hành');
    }
    const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (total > available) {
      throw ruleViolationError(
        'BR-31',
        source === 'receipt'
          ? 'Tổng phân bổ vượt số tiền đã thu, điều chỉnh lại'
          : 'Tổng phân bổ vượt số dư có của trẻ, điều chỉnh lại',
      );
    }
    const amounts = await invoiceAmounts(transaction, invoices);
    for (const invoice of invoices) {
      const outstanding = amounts.get(invoice.id)?.outstanding_amount ?? 0;
      const requested = allocations.find((allocation) => allocation.invoiceId === invoice.id)?.amount ?? 0;
      if (outstanding <= 0) {
        throw ruleViolationError('BR-31', `Hóa đơn ${invoice.code ?? ''} đã thu đủ`);
      }
      if (requested !== outstanding) {
        throw ruleViolationError(
          'BR-31',
          'Không nhận thanh toán một phần; số phân bổ phải bằng số còn phải nộp của hóa đơn',
          [{ field: 'allocations', message: `${invoice.code ?? ''} còn phải nộp ${outstanding}` }],
        );
      }
    }
    return invoices;
  }

  // Ghi giao dịch vào quỹ hoặc tài khoản ngân hàng và cập nhật số dư; khóa dòng tài khoản để số dư tuần tự (BR-34)
  private async recordAccountTransaction(
    transaction: Transaction<SchoolYearDatabase>,
    entry: { accountId: string; date: string; amount: number; receiptId: string; description: string },
  ): Promise<number> {
    const account = await transaction
      .selectFrom('cash_accounts')
      .select('current_balance')
      .where('id', '=', entry.accountId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const balanceAfter = Number(account.current_balance) + entry.amount;
    await transaction
      .updateTable('cash_accounts')
      .set({ current_balance: balanceAfter, updated_at: this.clock.now() })
      .where('id', '=', entry.accountId)
      .execute();
    await transaction
      .insertInto('account_transactions')
      .values({
        account_id: entry.accountId,
        transaction_date: entry.date,
        transaction_type: 'receipt',
        amount: entry.amount,
        balance_after: balanceAfter,
        reference_type: 'receipts',
        reference_id: entry.receiptId,
        description: entry.description,
      })
      .execute();
    return balanceAfter;
  }

  // Hóa đơn vừa thu đủ thì báo kế toán và quản lý đơn vị (QT-04 mục 9)
  private async notifySettled(
    transaction: Transaction<SchoolYearDatabase>,
    child: { id: string; org_unit_id: string; full_name: string },
    invoices: Array<{ id: string; code: string | null; period_year: number; period_month: number }>,
  ): Promise<void> {
    for (const invoice of invoices) {
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'invoice_settled',
        title: 'Trẻ đã tất toán công nợ của kỳ',
        body: `${child.full_name} đã nộp đủ hóa đơn ${invoice.code ?? ''} kỳ ${invoice.period_month}/${invoice.period_year}`,
        targetType: 'invoices',
        targetId: invoice.id,
        recipients: ['VT-04', 'VT-03'].map((roleCode) => ({
          roleCode,
          orgUnitId: child.org_unit_id,
          channel: 'in_app' as const,
        })),
      });
    }
  }

  private receiptQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('receipts')
      .innerJoin('children', 'children.id', 'receipts.child_id')
      .innerJoin('cash_accounts', 'cash_accounts.id', 'receipts.account_id')
      .innerJoin('cashflow_categories', 'cashflow_categories.id', 'receipts.category_id')
      .select([
        'receipts.id',
        'receipts.code',
        'receipts.org_unit_id',
        'receipts.child_id',
        'children.full_name as child_name',
        'receipts.payer_name',
        'receipts.amount',
        'receipts.method',
        'receipts.account_id',
        'cash_accounts.name as account_name',
        'receipts.category_id',
        'cashflow_categories.name as category_name',
        'receipts.receipt_date',
        'receipts.content',
        'receipts.status',
        'receipts.created_by',
        'receipts.created_at',
      ]);
  }

  private async withAllocated<Row extends { id: string; amount: string }>(
    database: Kysely<SchoolYearDatabase>,
    rows: Row[],
  ) {
    const ids = rows.map((row) => row.id);
    const allocations = ids.length
      ? await database
          .selectFrom('receipt_allocations')
          .select(['receipt_id', 'amount'])
          .where('receipt_id', 'in', ids)
          .execute()
      : [];
    return rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      allocated_amount: allocations
        .filter((allocation) => allocation.receipt_id === row.id)
        .reduce((sum, allocation) => sum + Number(allocation.amount), 0),
    }));
  }

  private async findByRequestKey(database: Kysely<SchoolYearDatabase>, requestKey: string): Promise<string | null> {
    const row = await database
      .selectFrom('receipts')
      .select('id')
      .where('request_key', '=', requestKey)
      .executeTakeFirst();
    return row?.id ?? null;
  }

  private async loadChild(database: Kysely<SchoolYearDatabase>, childId: string) {
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'full_name'])
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    return child;
  }

  private async assertCanCollect(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.receiptManage);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thu tiền cho trẻ của đơn vị này');
    }
  }

  // Nhân sự có quyền xem phiếu thu hoặc công nợ trong phạm vi, hoặc phụ huynh của trẻ (AC-106)
  private async assertCanViewChild(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    child: { id: string; org_unit_id: string },
  ): Promise<void> {
    for (const permission of [...VIEW_PERMISSIONS, PERMISSION_CODES.debtView]) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool || scope.orgUnitIds.includes(child.org_unit_id)) {
        return;
      }
    }
    if (!(await isGuardianOf(database, child.id, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu thu của trẻ này');
    }
  }

  private async staffUnits(currentUser: CurrentUser): Promise<{ wholeSchool: boolean; orgUnitIds: string[] }> {
    const units = new Set<string>();
    for (const permission of VIEW_PERMISSIONS) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return { wholeSchool: true, orgUnitIds: [] };
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    return { wholeSchool: false, orgUnitIds: [...units] };
  }

  // Người chỉ có quyền lập phiếu thu qua vai trò thủ quỹ bị giới hạn ở tiền mặt (Q-152)
  private isCashierOnly(currentUser: CurrentUser): boolean {
    const collecting = currentUser.description.assignments.filter((assignment) =>
      assignment.permissions.includes(PERMISSION_CODES.receiptManage),
    );
    return collecting.length > 0 && collecting.every((assignment) => assignment.role_code === CASHIER_ROLE);
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private nextCode(transaction: Transaction<SchoolYearDatabase>): Promise<string> {
    return nextDocumentCode(transaction, RECEIPT_SEQUENCE, 'PT');
  }
}
