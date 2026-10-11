import { Injectable } from '@nestjs/common';
import type { PaymentType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import { PaymentReversalsService } from './payment-reversals.service.js';
import { unallocatedReceipts } from './receivables.js';

// Phiếu chi: lập nháp kèm chứng từ, trình duyệt, Ban Giám hiệu duyệt theo hạn mức thì phát hành và trừ nguồn chi
// (P06-04; QT-05 bước 1 đến 6; BR-24, BR-28, BR-29, BR-30, BR-34, BR-77; Q-112; YCTD-55)
const PRINCIPAL_ROLE = 'VT-02';
const CASHIER_ROLE = 'VT-16';
const PAYMENT_SEQUENCE = 'payment';
const VIEW_PERMISSIONS = ['P06.view', PERMISSION_CODES.paymentManage, PERMISSION_CODES.paymentApprove];

export interface PaymentInput {
  paymentType: PaymentType;
  childId: string | null;
  payeeName: string;
  amount: number;
  content: string;
  accountId: string;
  categoryId: string;
  fileIds: string[];
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly settings: SettingsService,
    private readonly reversals: PaymentReversalsService,
    private readonly clock: Clock,
  ) {}

  async create(
    currentUser: CurrentUser,
    input: PaymentInput & { orgUnitId: string; requestKey: string },
    origin: ChangeOrigin,
    // Phiếu chi lương lập từ bảng lương hoặc bảng quyết toán đã duyệt (YCTD-61)
    link: { payrollId?: string; settlementId?: string } = {},
  ) {
    const { database } = await this.currentSchoolYear.require();
    const repeated = await database
      .selectFrom('payments')
      .select('id')
      .where('request_key', '=', input.requestKey)
      .executeTakeFirst();
    if (repeated) {
      return this.read(currentUser, repeated.id);
    }
    await this.assertScope(currentUser, PERMISSION_CODES.paymentManage, input.orgUnitId);
    await this.validate(database, currentUser, input.orgUnitId, input);
    try {
      const paymentId = await database.transaction().execute(async (transaction) => {
        const payment = await transaction
          .insertInto('payments')
          .values({
            org_unit_id: input.orgUnitId,
            payment_type: input.paymentType,
            child_id: input.childId,
            payee_name: input.payeeName,
            amount: input.amount,
            content: input.content,
            account_id: input.accountId,
            category_id: input.categoryId,
            request_key: input.requestKey,
            created_by: origin.actorUserId,
            payroll_id: link.payrollId ?? null,
            settlement_id: link.settlementId ?? null,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.replaceAttachments(transaction, payment.id, input.fileIds);
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.orgUnitId,
          entityName: 'payments',
          entityId: payment.id,
          action: 'create',
          before: null,
          after: { ...input, status: 'draft' },
        });
        return payment.id;
      });
      return this.read(currentUser, paymentId);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        const existing = await database
          .selectFrom('payments')
          .select('id')
          .where('request_key', '=', input.requestKey)
          .executeTakeFirst();
        if (existing) {
          return this.read(currentUser, existing.id);
        }
      }
      throw error;
    }
  }

  // Chỉ sửa được phiếu nháp, kể cả phiếu bị từ chối trả về
  async update(currentUser: CurrentUser, paymentId: string, input: PaymentInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.load(database, paymentId);
    await this.assertScope(currentUser, PERMISSION_CODES.paymentManage, existing.org_unit_id);
    if (existing.status !== 'draft') {
      throw ruleViolationError('BR-29', 'Chỉ sửa được phiếu chi nháp');
    }
    await this.validate(database, currentUser, existing.org_unit_id, input);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payments')
        .set({
          payment_type: input.paymentType,
          child_id: input.childId,
          payee_name: input.payeeName,
          amount: input.amount,
          content: input.content,
          account_id: input.accountId,
          category_id: input.categoryId,
          updated_at: this.clock.now(),
        })
        .where('id', '=', paymentId)
        .execute();
      await this.replaceAttachments(transaction, paymentId, input.fileIds);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'payments',
        entityId: paymentId,
        action: 'update',
        before: existing,
        after: input,
      });
    });
    return this.read(currentUser, paymentId);
  }

  // Xóa được phiếu nháp; phiếu đã phát hành phải lập phiếu đảo (BR-29, AC-113)
  async remove(currentUser: CurrentUser, paymentId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.load(database, paymentId);
    await this.assertScope(currentUser, PERMISSION_CODES.paymentManage, existing.org_unit_id);
    if (existing.status !== 'draft') {
      throw ruleViolationError(
        'BR-29',
        'Không xóa được phiếu chi đã trình duyệt hoặc đã phát hành, lập phiếu đảo để điều chỉnh',
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('payments').where('id', '=', paymentId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'payments',
        entityId: paymentId,
        action: 'delete',
        before: existing,
        after: null,
      });
    });
  }

  // Trình duyệt: phải có chứng từ; hoàn tiền thôi học hoặc chưa đặt hạn mức thì Hiệu trưởng duyệt (BR-24, Q-112)
  async submit(currentUser: CurrentUser, paymentId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const payment = await this.load(database, paymentId);
    await this.assertScope(currentUser, PERMISSION_CODES.paymentManage, payment.org_unit_id);
    if (payment.status !== 'draft') {
      throw ruleViolationError('BR-77', 'Phiếu chi này đã được trình duyệt');
    }
    const attachments = await database
      .selectFrom('payment_attachments')
      .select('file_id')
      .where('payment_id', '=', paymentId)
      .execute();
    if (attachments.length === 0) {
      throw ruleViolationError('BR-28', 'Vui lòng đính kèm chứng từ trước khi trình duyệt');
    }
    const amount = Number(payment.amount);
    if (payment.payment_type === 'refund') {
      await this.assertRefundWithinCredit(database, payment.child_id ?? '', amount);
    }
    const requiresPrincipal =
      payment.payment_type === 'refund' || (await this.requiresPrincipal(database, payment.org_unit_id, amount));
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payments')
        .set({
          status: 'pending',
          requires_principal: requiresPrincipal,
          submitted_at: this.clock.now(),
          reject_reason: null,
        })
        .where('id', '=', paymentId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: payment.org_unit_id,
        entityName: 'payments',
        entityId: paymentId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'pending', requires_principal: requiresPrincipal },
      });
      await queueNotification(transaction, {
        orgUnitId: payment.org_unit_id,
        templateCode: 'payment_pending',
        title: 'Có phiếu chi cần phê duyệt',
        body: `${payment.payee_name}: ${amount} đồng. ${payment.content}`,
        targetType: 'payments',
        targetId: paymentId,
        recipients: await this.approverRecipients(transaction, payment.org_unit_id, requiresPrincipal),
      });
    });
    return this.read(currentUser, paymentId);
  }

  async decide(
    currentUser: CurrentUser,
    paymentId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const payment = await this.load(database, paymentId);
    await this.assertScope(currentUser, PERMISSION_CODES.paymentApprove, payment.org_unit_id);
    if (payment.status !== 'pending') {
      throw ruleViolationError(
        'BR-77',
        payment.approved_by ? 'Phiếu chi đã được phê duyệt bởi người khác' : 'Phiếu chi này không chờ duyệt',
        payment.approved_by ? [{ field: 'approved_by', message: payment.approved_by }] : [],
      );
    }
    if (payment.requires_principal && !this.isPrincipal(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        payment.payment_type === 'refund'
          ? 'Phiếu chi hoàn tiền do Hiệu trưởng duyệt'
          : 'Phiếu chi từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức, cần Hiệu trưởng duyệt',
      );
    }
    if (payment.created_by === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người lập phiếu chi');
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('payments')
        .set(
          decision.approve
            ? { status: 'issued', approved_by: origin.actorUserId, approved_at: this.clock.now() }
            : { status: 'draft', reject_reason: decision.reason },
        )
        .where('id', '=', paymentId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-77', 'Phiếu chi đã được người khác xử lý');
      }
      if (!decision.approve) {
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: payment.org_unit_id,
          entityName: 'payments',
          entityId: paymentId,
          action: 'update',
          before: { status: 'pending' },
          after: { status: 'draft', amount: Number(payment.amount), reason: decision.reason },
        });
        await queueNotification(transaction, {
          orgUnitId: payment.org_unit_id,
          templateCode: 'payment_rejected',
          title: 'Phiếu chi bị từ chối',
          body: `Phiếu chi cho ${payment.payee_name} bị từ chối. Lý do: ${decision.reason ?? ''}`,
          targetType: 'payments',
          targetId: paymentId,
          recipients: [{ userId: payment.created_by, channel: 'in_app' }],
        });
        return;
      }
      await this.issue(transaction, payment, origin);
    });
    return this.read(currentUser, paymentId);
  }

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; status: string | null; from: string | null; to: string | null },
  ) {
    const units = await this.staffUnits(currentUser);
    if (!units.wholeSchool && units.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu chi');
    }
    if (filter.orgUnitId && !units.wholeSchool && !units.orgUnitIds.includes(filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.paymentQuery(database);
    if (filter.orgUnitId) {
      query = query.where('payments.org_unit_id', '=', filter.orgUnitId);
    } else if (!units.wholeSchool) {
      query = query.where('payments.org_unit_id', 'in', units.orgUnitIds);
    }
    if (filter.status) {
      query = query.where('payments.status', '=', filter.status as 'draft');
    }
    if (filter.from) {
      query = query.where('payments.payment_date', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('payments.payment_date', '<=', filter.to);
    }
    const rows = await query.orderBy('payments.created_at', 'desc').execute();
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  // Phiếu chi chờ duyệt trong phạm vi người duyệt; Phó Hiệu trưởng chỉ thấy phiếu dưới hạn mức
  async pending(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.paymentApprove);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt phiếu chi');
    }
    if (orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.paymentQuery(database).where('payments.status', '=', 'pending');
    const units = orgUnitId ? [orgUnitId] : scope.wholeSchool ? null : scope.orgUnitIds;
    if (units) {
      query = query.where('payments.org_unit_id', 'in', units);
    }
    if (!this.isPrincipal(currentUser)) {
      query = query.where('payments.requires_principal', '=', false);
    }
    return (await query.orderBy('payments.submitted_at').execute()).map((row) => ({
      ...row,
      amount: Number(row.amount),
    }));
  }

  async read(currentUser: CurrentUser, paymentId: string) {
    const { database } = await this.currentSchoolYear.require();
    const payment = await this.paymentQuery(database).where('payments.id', '=', paymentId).executeTakeFirst();
    if (!payment) {
      throw notFoundError('Không tìm thấy phiếu chi', 'payment');
    }
    const units = await this.staffUnits(currentUser);
    if (!units.wholeSchool && !units.orgUnitIds.includes(payment.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu chi này');
    }
    const attachments = await database
      .selectFrom('payment_attachments')
      .innerJoin('files', 'files.id', 'payment_attachments.file_id')
      .select(['files.id', 'files.file_name', 'files.content_type', 'files.size_bytes'])
      .where('payment_attachments.payment_id', '=', paymentId)
      .execute();
    return {
      ...payment,
      amount: Number(payment.amount),
      attachments,
      reversals: await this.reversals.ofPayment(database, paymentId),
    };
  }

  // Phát hành khi duyệt: kiểm tra số dư nguồn chi, cấp số phiếu, trừ số dư, ghi giao dịch; hoàn tiền thì trừ số dư có
  private async issue(
    transaction: Transaction<SchoolYearDatabase>,
    payment: Awaited<ReturnType<PaymentsService['load']>>,
    origin: ChangeOrigin,
  ): Promise<void> {
    const amount = Number(payment.amount);
    const account = await transaction
      .selectFrom('cash_accounts')
      .select(['id', 'account_type', 'current_balance', 'status'])
      .where('id', '=', payment.account_id)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (account.status !== 'active') {
      throw validationError([{ field: 'account_id', message: 'Nguồn chi không tồn tại hoặc đã ngừng sử dụng' }]);
    }
    const balanceBefore = Number(account.current_balance);
    const balanceAfter = balanceBefore - amount;
    if (
      balanceAfter < 0 &&
      (account.account_type === 'cash' || (await this.blocksBankOverdraft(payment.org_unit_id)))
    ) {
      throw ruleViolationError('BR-34', 'Số dư nguồn chi không đủ');
    }
    if (payment.payment_type === 'refund') {
      await this.takeRefundFromCredit(transaction, payment.id, payment.child_id ?? '', amount);
    }
    const code = await nextDocumentCode(transaction, PAYMENT_SEQUENCE, 'PC');
    const today = VIETNAM_DATE.format(this.clock.now());
    await transaction.updateTable('payments').set({ code, payment_date: today }).where('id', '=', payment.id).execute();
    await transaction
      .updateTable('cash_accounts')
      .set({ current_balance: balanceAfter, updated_at: this.clock.now() })
      .where('id', '=', account.id)
      .execute();
    await transaction
      .insertInto('account_transactions')
      .values({
        account_id: account.id,
        transaction_date: today,
        transaction_type: 'payment',
        amount: -amount,
        balance_after: balanceAfter,
        reference_type: 'payments',
        reference_id: payment.id,
        description: `${code} chi cho ${payment.payee_name}`,
      })
      .execute();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: payment.org_unit_id,
      entityName: 'payments',
      entityId: payment.id,
      action: 'update',
      before: { status: 'pending', account_balance: balanceBefore },
      after: { status: 'issued', code, amount, approved_by: origin.actorUserId, account_balance: balanceAfter },
    });
    await queueNotification(transaction, {
      orgUnitId: payment.org_unit_id,
      templateCode: 'payment_issued',
      title: 'Phiếu chi đã được phê duyệt và phát hành',
      body: `${code} chi cho ${payment.payee_name}: ${amount} đồng`,
      targetType: 'payments',
      targetId: payment.id,
      recipients: [
        { userId: payment.created_by, channel: 'in_app' },
        { roleCode: 'VT-05', orgUnitId: payment.org_unit_id, channel: 'in_app' },
      ],
    });
  }

  // Số hoàn không vượt số dư có của trẻ, không tính phiếu thu đang chờ duyệt đảo (YCTD-55)
  private async refundableSources(
    executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
    childId: string,
  ) {
    const pendingReversal = new Set(
      (
        await executor
          .selectFrom('receipts')
          .select('id')
          .where('child_id', '=', childId)
          .where('status', '=', 'pending_reversal')
          .execute()
      ).map((row) => row.id),
    );
    return (await unallocatedReceipts(executor, [childId])).filter((source) => !pendingReversal.has(source.id));
  }

  private async assertRefundWithinCredit(database: Kysely<SchoolYearDatabase>, childId: string, amount: number) {
    const credit = (await this.refundableSources(database, childId)).reduce((sum, source) => sum + source.remaining, 0);
    if (amount > credit) {
      throw ruleViolationError('BR-24', `Số hoàn vượt số dư có của trẻ (${credit} đồng)`);
    }
  }

  private async takeRefundFromCredit(
    transaction: Transaction<SchoolYearDatabase>,
    paymentId: string,
    childId: string,
    amount: number,
  ): Promise<void> {
    await transaction.selectFrom('receipts').select('id').where('child_id', '=', childId).forUpdate().execute();
    const sources = await this.refundableSources(transaction, childId);
    const credit = sources.reduce((sum, source) => sum + source.remaining, 0);
    if (amount > credit) {
      throw ruleViolationError('BR-24', `Số hoàn vượt số dư có của trẻ (${credit} đồng)`);
    }
    let left = amount;
    const rows: Array<{ payment_id: string; receipt_id: string; amount: number }> = [];
    for (const source of sources) {
      const used = Math.min(left, source.remaining);
      if (used > 0) {
        rows.push({ payment_id: paymentId, receipt_id: source.id, amount: used });
        left -= used;
      }
    }
    await transaction.insertInto('payment_refund_sources').values(rows).execute();
  }

  private async validate(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    orgUnitId: string,
    input: PaymentInput,
  ): Promise<void> {
    const account = await database
      .selectFrom('cash_accounts')
      .select(['org_unit_id', 'account_type', 'status'])
      .where('id', '=', input.accountId)
      .executeTakeFirst();
    if (!account || account.status !== 'active' || account.org_unit_id !== orgUnitId) {
      throw validationError([{ field: 'account_id', message: 'Nguồn chi không tồn tại hoặc đã ngừng sử dụng' }]);
    }
    if (this.isCashierOnly(currentUser) && account.account_type !== 'cash') {
      throw new ApplicationError('ERR_FORBIDDEN', 'Thủ quỹ chỉ lập phiếu chi tiền mặt từ quỹ');
    }
    const category = await database
      .selectFrom('cashflow_categories')
      .select(['flow_type', 'status'])
      .where('id', '=', input.categoryId)
      .executeTakeFirst();
    if (!category || category.status !== 'active' || category.flow_type !== 'expense') {
      throw validationError([{ field: 'category_id', message: 'Khoản mục phải là khoản mục chi đang dùng' }]);
    }
    if (input.paymentType === 'refund') {
      const child = await database
        .selectFrom('children')
        .select('org_unit_id')
        .where('id', '=', input.childId ?? '')
        .executeTakeFirst();
      if (!child || child.org_unit_id !== orgUnitId) {
        throw validationError([{ field: 'child_id', message: 'Phiếu chi hoàn tiền phải chọn trẻ của đơn vị' }]);
      }
    }
    if (input.fileIds.length > 0) {
      const files = await database
        .selectFrom('files')
        .select(['id', 'purpose', 'org_unit_id'])
        .where('id', 'in', input.fileIds)
        .execute();
      if (
        files.length !== new Set(input.fileIds).size ||
        files.some((file) => file.purpose !== 'payment_voucher' || file.org_unit_id !== orgUnitId)
      ) {
        throw validationError([{ field: 'file_ids', message: 'Chứng từ không hợp lệ' }]);
      }
    }
  }

  private async replaceAttachments(transaction: Transaction<SchoolYearDatabase>, paymentId: string, fileIds: string[]) {
    await transaction.deleteFrom('payment_attachments').where('payment_id', '=', paymentId).execute();
    const unique = [...new Set(fileIds)];
    if (unique.length > 0) {
      await transaction
        .insertInto('payment_attachments')
        .values(unique.map((fileId) => ({ payment_id: paymentId, file_id: fileId })))
        .execute();
    }
  }

  private paymentQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('payments')
      .innerJoin('cash_accounts', 'cash_accounts.id', 'payments.account_id')
      .innerJoin('cashflow_categories', 'cashflow_categories.id', 'payments.category_id')
      .leftJoin('children', 'children.id', 'payments.child_id')
      .select([
        'payments.id',
        'payments.code',
        'payments.org_unit_id',
        'payments.payment_type',
        'payments.child_id',
        'children.full_name as child_name',
        'payments.payee_name',
        'payments.amount',
        'payments.content',
        'payments.account_id',
        'cash_accounts.name as account_name',
        'payments.category_id',
        'cashflow_categories.name as category_name',
        'payments.payment_date',
        'payments.status',
        'payments.requires_principal',
        'payments.created_by',
        'payments.created_at',
        'payments.submitted_at',
        'payments.approved_by',
        'payments.approved_at',
        'payments.reject_reason',
      ]);
  }

  private async load(database: Kysely<SchoolYearDatabase>, paymentId: string) {
    const payment = await database
      .selectFrom('payments')
      .select([
        'id',
        'org_unit_id',
        'payment_type',
        'child_id',
        'payee_name',
        'amount',
        'content',
        'account_id',
        'category_id',
        'status',
        'requires_principal',
        'created_by',
        'approved_by',
      ])
      .where('id', '=', paymentId)
      .executeTakeFirst();
    if (!payment) {
      throw notFoundError('Không tìm thấy phiếu chi', 'payment');
    }
    return payment;
  }

  private async assertScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<void> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền với phiếu chi của đơn vị này', [
        { field: 'org_unit_id', message: permission },
      ]);
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

  // Ngân hàng không đủ số dư thì chặn theo cấu hình đơn vị, mặc định chặn; quỹ tiền mặt luôn chặn (BR-34, YCTD-55)
  private async blocksBankOverdraft(orgUnitId: string): Promise<boolean> {
    const setting = (await this.settings.effective(orgUnitId)).find((item) => item.key === 'bank_balance_check');
    return setting?.value !== false;
  }

  private async requiresPrincipal(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    amount: number,
  ): Promise<boolean> {
    const threshold = await database
      .selectFrom('approval_thresholds')
      .select('threshold_amount')
      .where('org_unit_id', '=', orgUnitId)
      .where('document_type', '=', 'payment')
      .where('status', '=', 'active')
      .executeTakeFirst();
    return !threshold || amount >= Number(threshold.threshold_amount);
  }

  private isPrincipal(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some(
      (assignment) =>
        assignment.role_code === PRINCIPAL_ROLE && assignment.permissions.includes(PERMISSION_CODES.paymentApprove),
    );
  }

  private isCashierOnly(currentUser: CurrentUser): boolean {
    const granting = currentUser.description.assignments.filter((assignment) =>
      assignment.permissions.includes(PERMISSION_CODES.paymentManage),
    );
    return granting.length > 0 && granting.every((assignment) => assignment.role_code === CASHIER_ROLE);
  }

  private async approverRecipients(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    requiresPrincipal: boolean,
  ): Promise<NotificationRecipient[]> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return [
      ...(requiresPrincipal ? [] : [{ roleCode: 'VT-15', orgUnitId, channel: 'in_app' as const }]),
      ...(root ? [{ roleCode: PRINCIPAL_ROLE, orgUnitId: root.id, channel: 'in_app' as const }] : []),
    ];
  }
}
