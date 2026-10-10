import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { OnlineMatchStatus, SchoolYearDatabase } from '@school-management/database';
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
import { PaymentGateway } from './payment-gateway.js';
import { ReceiptsService } from './receipts.service.js';
import { isGuardianOf } from './receivables.js';

// Thanh toán trực tuyến bằng mã QR: mỗi lần thanh toán một tài khoản ảo và mã QR dùng một lần do nhà cung cấp cấp,
// tiền về tài khoản duy nhất của trường; giao dịch tiền vào khớp thì tự lập phiếu thu, không khớp thì chờ kế toán
// (P06-11; QT-04 bước 11, E10, E11; BR-28, BR-31; BM-62; YCTD-57)
export const ONLINE_PAYMENT_ORIGIN: ChangeOrigin = {
  actorUserId: '00000000-0000-4000-8000-000000000057',
  actorName: 'Thanh toán trực tuyến',
  ipAddress: null,
};
const VIEW_PERMISSIONS = ['P06.view', PERMISSION_CODES.receiptManage];

export interface IncomingTransfer {
  providerTransactionRef: string;
  virtualAccountNumber: string | null;
  amount: number;
  transferContent: string;
  receivedAt: Date;
}

// Nội dung chuyển khoản là mã hóa đơn bỏ dấu gạch; đối chiếu bỏ khoảng trắng, dấu gạch và không phân biệt hoa thường
export function transferContentOf(invoiceCode: string): string {
  return invoiceCode.replaceAll('-', '').toUpperCase();
}

function invoiceCodeIn(content: string): string | null {
  const match = /HD-?\s*(\d{6})/i.exec(content.replaceAll(' ', ''));
  return match ? `HD-${match[1]}` : null;
}

@Injectable()
export class OnlinePaymentsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly receipts: ReceiptsService,
    private readonly gateway: PaymentGateway,
    private readonly clock: Clock,
  ) {}

  get provider(): string {
    return this.gateway.provider;
  }

  async settings(currentUser: CurrentUser) {
    await this.assertViewer(currentUser, null);
    const { database } = await this.currentSchoolYear.require();
    return (await this.schoolAccount(database)) ?? null;
  }

  // Tài khoản ngân hàng của Trường chính nhận thanh toán trực tuyến kèm khoản mục thu của phiếu thu tự lập
  async configure(currentUser: CurrentUser, input: { accountId: string; categoryId: string }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const account = await database
      .selectFrom('cash_accounts')
      .innerJoin('org_units', 'org_units.id', 'cash_accounts.org_unit_id')
      .select(['cash_accounts.id', 'cash_accounts.org_unit_id', 'cash_accounts.account_type', 'cash_accounts.status'])
      .select('org_units.unit_type')
      .where('cash_accounts.id', '=', input.accountId)
      .executeTakeFirst();
    if (!account) {
      throw notFoundError('Không tìm thấy tài khoản', 'cash_account');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.cashAccountManage, account.org_unit_id);
    if (account.account_type !== 'bank' || account.status !== 'active' || account.unit_type !== 'truong_chinh') {
      throw validationError([{ field: 'account_id', message: 'Chọn tài khoản ngân hàng đang dùng của Trường chính' }]);
    }
    const category = await database
      .selectFrom('cashflow_categories')
      .select(['flow_type', 'status'])
      .where('id', '=', input.categoryId)
      .executeTakeFirst();
    if (!category || category.status !== 'active' || category.flow_type !== 'income') {
      throw validationError([{ field: 'category_id', message: 'Khoản mục phải là khoản mục thu đang dùng' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const before = await this.schoolAccount(transaction);
      await transaction
        .updateTable('cash_accounts')
        .set({ receives_online_payments: false, online_payment_category_id: null })
        .where('receives_online_payments', '=', true)
        .execute();
      await transaction
        .updateTable('cash_accounts')
        .set({ receives_online_payments: true, online_payment_category_id: input.categoryId })
        .where('id', '=', input.accountId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: account.org_unit_id,
        entityName: 'cash_accounts',
        entityId: input.accountId,
        action: 'update',
        before: before ? { account_id: before.id, category_id: before.online_payment_category_id } : null,
        after: { account_id: input.accountId, category_id: input.categoryId, receives_online_payments: true },
      });
    });
    return this.schoolAccount(database);
  }

  // Mã QR cho số còn phải nộp của hóa đơn; số tiền đổi thì hủy mã cũ và xin mã mới (CTC-P06-056, CTC-P06-064)
  async paymentQr(currentUser: CurrentUser, invoiceId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const invoice = await database
      .selectFrom('invoices')
      .innerJoin('children', 'children.id', 'invoices.child_id')
      .select([
        'invoices.id',
        'invoices.code',
        'invoices.child_id',
        'invoices.org_unit_id',
        'invoices.status',
        'invoices.total_amount',
        'children.full_name as child_name',
      ])
      .where('invoices.id', '=', invoiceId)
      .executeTakeFirst();
    if (!invoice) {
      throw notFoundError('Không tìm thấy hóa đơn', 'invoice');
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.receiptManage);
    const isStaff = scope.wholeSchool || scope.orgUnitIds.includes(invoice.org_unit_id);
    if (!isStaff && !(await isGuardianOf(database, invoice.child_id, currentUser.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thanh toán hóa đơn này');
    }
    if (invoice.status !== 'issued' || !invoice.code) {
      throw ruleViolationError('P06-11', 'Chỉ thanh toán được hóa đơn đã phát hành');
    }
    const outstanding = (await invoiceAmounts(database, [invoice])).get(invoice.id)?.outstanding_amount ?? 0;
    if (outstanding <= 0) {
      throw ruleViolationError('BR-31', 'Hóa đơn đã thu đủ');
    }
    const account = await this.schoolAccount(database);
    if (!account) {
      throw ruleViolationError('P06-11', 'Nhà trường chưa cấu hình tài khoản nhận thanh toán trực tuyến');
    }
    const active = await database
      .selectFrom('payment_requests')
      .selectAll()
      .where('invoice_id', '=', invoiceId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    const stillValid =
      active &&
      Number(active.amount) === outstanding &&
      (!active.expires_at || active.expires_at.getTime() > this.clock.now().getTime());
    const request = stillValid
      ? active
      : await this.createRequest(database, invoice, outstanding, account.account_number ?? '', active?.id, origin);
    return {
      invoice_id: invoice.id,
      invoice_code: invoice.code,
      amount: Number(request.amount),
      transfer_content: request.transfer_content,
      virtual_account_number: request.virtual_account_number,
      qr_content: request.qr_content,
      bank_name: account.bank_name,
      account_name: account.name,
      expires_at: request.expires_at,
    };
  }

  // Nhận một giao dịch tiền vào đã xác thực; gửi lại cùng mã giao dịch thì trả giao dịch đã ghi (AC-186 đến AC-188)
  async receive(incoming: IncomingTransfer) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findTransaction(database, incoming.providerTransactionRef);
    if (existing) {
      return existing;
    }
    try {
      const transactionId = await database.transaction().execute((transaction) => this.match(transaction, incoming));
      return this.readTransaction(database, transactionId);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        const repeated = await this.findTransaction(database, incoming.providerTransactionRef);
        if (repeated) {
          return repeated;
        }
      }
      throw error;
    }
  }

  async list(currentUser: CurrentUser, filter: { pendingOnly: boolean }) {
    const units = await this.assertViewer(currentUser, null);
    const { database } = await this.currentSchoolYear.require();
    let query = this.transactionQuery(database);
    if (!units.wholeSchool) {
      // Giao dịch chưa xác định được trẻ thì kế toán mọi đơn vị đều thấy để xử lý
      query = query.where((expression) =>
        expression.or([
          expression('online_payment_transactions.org_unit_id', 'is', null),
          expression(
            'online_payment_transactions.org_unit_id',
            'in',
            units.orgUnitIds.length ? units.orgUnitIds : ['00000000-0000-0000-0000-000000000000'],
          ),
        ]),
      );
    }
    if (filter.pendingOnly) {
      query = query
        .where('online_payment_transactions.match_status', '!=', 'matched')
        .where('online_payment_transactions.handled_at', 'is', null);
    }
    return (await query.orderBy('online_payment_transactions.received_at', 'desc').execute()).map((row) => ({
      ...row,
      amount: Number(row.amount),
    }));
  }

  // Kế toán ghi đã xử lý giao dịch không khớp kèm nội dung, có thể gắn phiếu thu đã lập tay (CTC-P06-062)
  async resolve(
    currentUser: CurrentUser,
    transactionId: string,
    input: { note: string; receiptId: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('online_payment_transactions')
      .select(['id', 'org_unit_id', 'match_status', 'handled_at'])
      .where('id', '=', transactionId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy giao dịch', 'online_payment_transaction');
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.receiptManage);
    const allowed =
      scope.wholeSchool || (row.org_unit_id ? scope.orgUnitIds.includes(row.org_unit_id) : scope.orgUnitIds.length > 0);
    if (!allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xử lý giao dịch này');
    }
    if (row.match_status === 'matched' || row.handled_at) {
      throw ruleViolationError('P06-11', 'Giao dịch này đã được xử lý');
    }
    if (input.receiptId) {
      const receipt = await database
        .selectFrom('receipts')
        .select('id')
        .where('id', '=', input.receiptId)
        .executeTakeFirst();
      if (!receipt) {
        throw validationError([{ field: 'receipt_id', message: 'Không tìm thấy phiếu thu' }]);
      }
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('online_payment_transactions')
        .set({
          resolution_note: input.note,
          receipt_id: input.receiptId,
          handled_by: origin.actorUserId,
          handled_at: this.clock.now(),
        })
        .where('id', '=', transactionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'online_payment_transactions',
        entityId: transactionId,
        action: 'update',
        before: { handled_at: null },
        after: { note: input.note, receipt_id: input.receiptId },
      });
    });
    return this.readTransaction(database, transactionId);
  }

  private async match(transaction: Transaction<SchoolYearDatabase>, incoming: IncomingTransfer): Promise<string> {
    const request = incoming.virtualAccountNumber
      ? await transaction
          .selectFrom('payment_requests')
          .select(['id', 'invoice_id', 'child_id', 'status'])
          .where('virtual_account_number', '=', incoming.virtualAccountNumber)
          .orderBy('created_at', 'desc')
          .executeTakeFirst()
      : undefined;
    // Nội dung có mã hóa đơn thì theo mã đó; không có thì theo hóa đơn của tài khoản ảo (Q nội dung trước, số tiền sau)
    const code = invoiceCodeIn(incoming.transferContent);
    let invoice = code
      ? await transaction
          .selectFrom('invoices')
          .select(['id', 'code', 'child_id', 'org_unit_id', 'status', 'total_amount'])
          .where('code', '=', code)
          .where('status', '=', 'issued')
          .executeTakeFirst()
      : undefined;
    if (invoice && request && invoice.child_id !== request.child_id) {
      invoice = undefined;
    }
    if (!invoice && !code && request) {
      invoice = await transaction
        .selectFrom('invoices')
        .select(['id', 'code', 'child_id', 'org_unit_id', 'status', 'total_amount'])
        .where('id', '=', request.invoice_id)
        .executeTakeFirst();
      // Số tiền không khớp hóa đơn của tài khoản ảo nhưng khớp đúng một hóa đơn còn nợ khác của trẻ
      if (invoice && (await this.outstanding(transaction, invoice)) !== incoming.amount) {
        const candidates = await transaction
          .selectFrom('invoices')
          .select(['id', 'code', 'child_id', 'org_unit_id', 'status', 'total_amount'])
          .where('child_id', '=', request.child_id)
          .where('status', '=', 'issued')
          .execute();
        const amounts = await invoiceAmounts(transaction, candidates);
        const exact = candidates.filter((row) => amounts.get(row.id)?.outstanding_amount === incoming.amount);
        if (exact.length === 1) {
          invoice = exact[0];
        }
      }
    }
    let status: OnlineMatchStatus = 'unknown_invoice';
    let outstanding = 0;
    if (invoice) {
      await transaction.selectFrom('invoices').select('id').where('id', '=', invoice.id).forUpdate().execute();
      outstanding = await this.outstanding(transaction, invoice);
      status = outstanding <= 0 ? 'already_paid' : outstanding !== incoming.amount ? 'wrong_amount' : 'matched';
    }
    const account = status === 'matched' ? await this.schoolAccount(transaction) : undefined;
    if (status === 'matched' && (!account || !account.online_payment_category_id)) {
      status = 'unknown_invoice';
    }
    let receiptId: string | null = null;
    if (status === 'matched' && invoice && account?.online_payment_category_id) {
      const child = await transaction
        .selectFrom('children')
        .select(['id', 'org_unit_id', 'full_name'])
        .where('id', '=', invoice.child_id)
        .executeTakeFirstOrThrow();
      receiptId = await this.receipts.issueInTransaction(
        transaction,
        child,
        account,
        account.online_payment_category_id,
        {
          requestKey: randomUUID(),
          childId: child.id,
          payerName: 'Chuyển khoản trực tuyến',
          amount: incoming.amount,
          method: 'transfer',
          accountId: account.id,
          categoryId: account.online_payment_category_id,
          receiptDate: VIETNAM_DATE.format(incoming.receivedAt),
          content: `Thanh toán trực tuyến, giao dịch ${incoming.providerTransactionRef}`,
          allocations: [{ invoiceId: invoice.id, amount: incoming.amount }],
        },
        ONLINE_PAYMENT_ORIGIN,
      );
      await transaction
        .updateTable('payment_requests')
        .set({ status: 'paid', closed_at: this.clock.now() })
        .where('invoice_id', '=', invoice.id)
        .where('status', '=', 'active')
        .execute();
    }
    const childId = invoice?.child_id ?? request?.child_id ?? null;
    const orgUnitId =
      invoice?.org_unit_id ??
      (childId
        ? ((await transaction.selectFrom('children').select('org_unit_id').where('id', '=', childId).executeTakeFirst())
            ?.org_unit_id ?? null)
        : null);
    const created = await transaction
      .insertInto('online_payment_transactions')
      .values({
        provider: this.gateway.provider,
        provider_transaction_ref: incoming.providerTransactionRef,
        virtual_account_number: incoming.virtualAccountNumber,
        amount: incoming.amount,
        transfer_content: incoming.transferContent,
        received_at: incoming.receivedAt,
        match_status: status,
        payment_request_id: request?.id ?? null,
        invoice_id: invoice?.id ?? null,
        child_id: childId,
        org_unit_id: orgUnitId,
        receipt_id: receiptId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAuditLog(transaction, {
      origin: ONLINE_PAYMENT_ORIGIN,
      orgUnitId,
      entityName: 'online_payment_transactions',
      entityId: created.id,
      action: 'create',
      before: null,
      after: {
        provider_transaction_ref: incoming.providerTransactionRef,
        amount: incoming.amount,
        match_status: status,
        invoice_code: invoice?.code ?? null,
        outstanding,
        receipt_id: receiptId,
      },
    });
    if (status !== 'matched') {
      const root = await transaction
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      const target = orgUnitId ?? root?.id;
      if (target) {
        await queueNotification(transaction, {
          orgUnitId: target,
          templateCode: 'online_payment_unmatched',
          title: 'Có giao dịch chuyển khoản cần kế toán xử lý',
          body: `${incoming.amount} đồng, nội dung: ${incoming.transferContent}`,
          targetType: 'online_payment_transactions',
          targetId: created.id,
          recipients: [{ roleCode: 'VT-04', orgUnitId: target, channel: 'in_app' }],
        });
      }
    }
    return created.id;
  }

  private async createRequest(
    database: Kysely<SchoolYearDatabase>,
    invoice: { id: string; code: string | null; child_id: string; org_unit_id: string; child_name: string },
    amount: number,
    receivingAccountNumber: string,
    replacedId: string | undefined,
    origin: ChangeOrigin,
  ) {
    const transferContent = transferContentOf(invoice.code ?? '');
    const created = await this.gateway.createPaymentRequest({
      invoiceCode: invoice.code ?? '',
      transferContent,
      amount,
      childName: invoice.child_name,
      receivingAccountNumber,
    });
    return database.transaction().execute(async (transaction) => {
      if (replacedId) {
        await transaction
          .updateTable('payment_requests')
          .set({ status: 'cancelled', closed_at: this.clock.now() })
          .where('id', '=', replacedId)
          .where('status', '=', 'active')
          .execute();
      }
      const request = await transaction
        .insertInto('payment_requests')
        .values({
          invoice_id: invoice.id,
          child_id: invoice.child_id,
          org_unit_id: invoice.org_unit_id,
          amount,
          transfer_content: transferContent,
          provider: created.provider,
          provider_reference: created.providerReference,
          virtual_account_number: created.virtualAccountNumber,
          qr_content: created.qrContent,
          expires_at: created.expiresAt,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: invoice.org_unit_id,
        entityName: 'payment_requests',
        entityId: request.id,
        action: 'create',
        before: replacedId ? { replaced_id: replacedId } : null,
        after: { invoice_code: invoice.code, amount, virtual_account_number: created.virtualAccountNumber },
      });
      return request;
    });
  }

  private async outstanding(
    executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
    invoice: { id: string; total_amount: string },
  ): Promise<number> {
    return (await invoiceAmounts(executor, [invoice])).get(invoice.id)?.outstanding_amount ?? 0;
  }

  private schoolAccount(executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>) {
    return executor
      .selectFrom('cash_accounts')
      .select(['id', 'name', 'bank_name', 'account_number', 'online_payment_category_id', 'org_unit_id'])
      .where('receives_online_payments', '=', true)
      .where('status', '=', 'active')
      .executeTakeFirst();
  }

  private transactionQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('online_payment_transactions')
      .leftJoin('invoices', 'invoices.id', 'online_payment_transactions.invoice_id')
      .leftJoin('children', 'children.id', 'online_payment_transactions.child_id')
      .leftJoin('receipts', 'receipts.id', 'online_payment_transactions.receipt_id')
      .select([
        'online_payment_transactions.id',
        'online_payment_transactions.provider_transaction_ref',
        'online_payment_transactions.virtual_account_number',
        'online_payment_transactions.amount',
        'online_payment_transactions.transfer_content',
        'online_payment_transactions.received_at',
        'online_payment_transactions.match_status',
        'online_payment_transactions.invoice_id',
        'invoices.code as invoice_code',
        'online_payment_transactions.child_id',
        'children.full_name as child_name',
        'online_payment_transactions.org_unit_id',
        'online_payment_transactions.receipt_id',
        'receipts.code as receipt_code',
        'online_payment_transactions.resolution_note',
        'online_payment_transactions.handled_by',
        'online_payment_transactions.handled_at',
      ]);
  }

  private async findTransaction(database: Kysely<SchoolYearDatabase>, providerTransactionRef: string) {
    const row = await this.transactionQuery(database)
      .where('online_payment_transactions.provider_transaction_ref', '=', providerTransactionRef)
      .executeTakeFirst();
    return row ? { ...row, amount: Number(row.amount) } : undefined;
  }

  private async readTransaction(database: Kysely<SchoolYearDatabase>, transactionId: string) {
    const row = await this.transactionQuery(database)
      .where('online_payment_transactions.id', '=', transactionId)
      .executeTakeFirstOrThrow();
    return { ...row, amount: Number(row.amount) };
  }

  private async assertViewer(
    currentUser: CurrentUser,
    orgUnitId: string | null,
  ): Promise<{ wholeSchool: boolean; orgUnitIds: string[] }> {
    const units = new Set<string>();
    for (const permission of VIEW_PERMISSIONS) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return { wholeSchool: true, orgUnitIds: [] };
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    if (units.size === 0 || (orgUnitId && !units.has(orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem giao dịch chuyển khoản');
    }
    return { wholeSchool: false, orgUnitIds: [...units] };
  }
}
