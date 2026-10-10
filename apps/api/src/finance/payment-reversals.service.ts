import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phiếu đảo phiếu chi: kế toán, kế toán trưởng lập kèm lý do; Ban Giám hiệu duyệt theo hạn mức `payment_reversal`;
// phiếu gốc và số dư nguồn chi chỉ thay đổi khi đã duyệt; đảo phiếu hoàn tiền thì trả lại số dư có của trẻ
// (P06-04; QT-05 bước 8, E11; BR-29, BR-77; AC-214; YCTD-24, YCTD-56)
const PRINCIPAL_ROLE = 'VT-02';
const REVERSAL_SEQUENCE = 'payment_reversal';

@Injectable()
export class PaymentReversalsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async create(currentUser: CurrentUser, paymentId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const payment = await this.loadPayment(database, paymentId);
    await this.assertScope(currentUser, PERMISSION_CODES.paymentReversalCreate, payment.org_unit_id);
    if (payment.status !== 'issued') {
      throw ruleViolationError('BR-29', 'Chỉ đảo được phiếu chi đã phát hành và chưa có phiếu đảo');
    }
    const amount = Number(payment.amount);
    const requiresPrincipal = await this.requiresPrincipal(database, payment.org_unit_id, amount);
    const reversalId = await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('payments')
        .set({ status: 'pending_reversal' })
        .where('id', '=', paymentId)
        .where('status', '=', 'issued')
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-29', 'Chỉ đảo được phiếu chi đã phát hành và chưa có phiếu đảo');
      }
      const code = await nextDocumentCode(transaction, REVERSAL_SEQUENCE, 'DPC');
      const reversal = await transaction
        .insertInto('payment_reversals')
        .values({
          code,
          payment_id: paymentId,
          org_unit_id: payment.org_unit_id,
          amount,
          reason,
          status: 'pending',
          requires_principal: requiresPrincipal,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: payment.org_unit_id,
        entityName: 'payment_reversals',
        entityId: reversal.id,
        action: 'create',
        before: { payment_status: 'issued' },
        after: { code, payment_code: payment.code, amount, reason, requires_principal: requiresPrincipal },
      });
      await queueNotification(transaction, {
        orgUnitId: payment.org_unit_id,
        templateCode: 'payment_reversal_pending',
        title: 'Có phiếu đảo phiếu chi cần duyệt',
        body: `${code} đảo ${payment.code ?? ''} chi cho ${payment.payee_name}: ${amount} đồng. Lý do: ${reason}`,
        targetType: 'payment_reversals',
        targetId: reversal.id,
        recipients: await this.approverRecipients(transaction, payment.org_unit_id, requiresPrincipal),
      });
      return reversal.id;
    });
    return this.read(database, reversalId);
  }

  async decide(
    currentUser: CurrentUser,
    paymentId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const payment = await this.loadPayment(database, paymentId);
    await this.assertScope(currentUser, PERMISSION_CODES.paymentApprove, payment.org_unit_id);
    const reversal = await database
      .selectFrom('payment_reversals')
      .select(['id', 'code', 'requires_principal', 'reason', 'created_by'])
      .where('payment_id', '=', paymentId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (!reversal) {
      throw ruleViolationError('BR-77', 'Phiếu chi này không có phiếu đảo chờ duyệt');
    }
    if (reversal.requires_principal && !this.isPrincipal(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Phiếu đảo từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức, cần Hiệu trưởng duyệt',
      );
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    const amount = Number(payment.amount);
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('payment_reversals')
        .set({
          status: decision.approve ? 'approved' : 'rejected',
          decided_by: origin.actorUserId,
          decided_at: this.clock.now(),
          reject_reason: decision.approve ? null : decision.reason,
        })
        .where('id', '=', reversal.id)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-77', 'Phiếu đảo này đã được xử lý');
      }
      if (!decision.approve) {
        await transaction.updateTable('payments').set({ status: 'issued' }).where('id', '=', paymentId).execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: payment.org_unit_id,
          entityName: 'payment_reversals',
          entityId: reversal.id,
          action: 'update',
          before: { status: 'pending', payment_status: 'pending_reversal' },
          after: { status: 'rejected', payment_status: 'issued', reason: decision.reason },
        });
        await queueNotification(transaction, {
          orgUnitId: payment.org_unit_id,
          templateCode: 'payment_reversal_rejected',
          title: 'Phiếu đảo phiếu chi bị từ chối',
          body: `${reversal.code} đảo ${payment.code ?? ''} bị từ chối. Lý do: ${decision.reason ?? ''}`,
          targetType: 'payment_reversals',
          targetId: reversal.id,
          recipients: [{ userId: reversal.created_by, channel: 'in_app' }],
        });
        return;
      }
      // Hoàn lại tiền vào nguồn chi; phiếu hoàn tiền đã đảo thì nguồn hoàn không còn trừ vào số dư có của trẻ
      const account = await transaction
        .selectFrom('cash_accounts')
        .select(['id', 'current_balance'])
        .where('id', '=', payment.account_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const balanceBefore = Number(account.current_balance);
      const balanceAfter = balanceBefore + amount;
      await transaction
        .updateTable('cash_accounts')
        .set({ current_balance: balanceAfter, updated_at: this.clock.now() })
        .where('id', '=', account.id)
        .execute();
      await transaction
        .insertInto('account_transactions')
        .values({
          account_id: account.id,
          transaction_date: VIETNAM_DATE.format(this.clock.now()),
          transaction_type: 'payment_reversal',
          amount,
          balance_after: balanceAfter,
          reference_type: 'payment_reversals',
          reference_id: reversal.id,
          description: `${reversal.code} đảo ${payment.code ?? ''}`,
        })
        .execute();
      await transaction.updateTable('payments').set({ status: 'reversed' }).where('id', '=', paymentId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: payment.org_unit_id,
        entityName: 'payment_reversals',
        entityId: reversal.id,
        action: 'update',
        before: { status: 'pending', payment_status: 'pending_reversal', account_balance: balanceBefore },
        after: { status: 'approved', payment_status: 'reversed', account_balance: balanceAfter },
      });
      await queueNotification(transaction, {
        orgUnitId: payment.org_unit_id,
        templateCode: 'payment_reversed',
        title: 'Phiếu chi đã được đảo',
        body: `${payment.code ?? ''} chi cho ${payment.payee_name} đã được đảo. Lý do: ${reversal.reason}`,
        targetType: 'payments',
        targetId: paymentId,
        recipients: [
          { userId: reversal.created_by, channel: 'in_app' },
          { roleCode: 'VT-05', orgUnitId: payment.org_unit_id, channel: 'in_app' },
        ],
      });
    });
    return this.read(database, reversal.id);
  }

  // Phiếu đảo chờ duyệt trong phạm vi người duyệt; Phó Hiệu trưởng chỉ thấy phiếu dưới hạn mức
  async pending(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.paymentApprove);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt phiếu đảo phiếu chi');
    }
    if (orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.reversalQuery(database).where('payment_reversals.status', '=', 'pending');
    const units = orgUnitId ? [orgUnitId] : scope.wholeSchool ? null : scope.orgUnitIds;
    if (units) {
      query = query.where('payment_reversals.org_unit_id', 'in', units);
    }
    if (!this.isPrincipal(currentUser)) {
      query = query.where('payment_reversals.requires_principal', '=', false);
    }
    return (await query.orderBy('payment_reversals.created_at').execute()).map((row) => ({
      ...row,
      amount: Number(row.amount),
    }));
  }

  async ofPayment(database: Kysely<SchoolYearDatabase>, paymentId: string) {
    return (
      await this.reversalQuery(database)
        .where('payment_reversals.payment_id', '=', paymentId)
        .orderBy('payment_reversals.created_at')
        .execute()
    ).map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  private async read(database: Kysely<SchoolYearDatabase>, reversalId: string) {
    const row = await this.reversalQuery(database)
      .where('payment_reversals.id', '=', reversalId)
      .executeTakeFirstOrThrow();
    return { ...row, amount: Number(row.amount) };
  }

  private reversalQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('payment_reversals')
      .innerJoin('payments', 'payments.id', 'payment_reversals.payment_id')
      .select([
        'payment_reversals.id',
        'payment_reversals.code',
        'payment_reversals.payment_id',
        'payments.code as payment_code',
        'payments.status as payment_status',
        'payments.payee_name',
        'payment_reversals.org_unit_id',
        'payment_reversals.amount',
        'payment_reversals.reason',
        'payment_reversals.status',
        'payment_reversals.requires_principal',
        'payment_reversals.created_by',
        'payment_reversals.created_at',
        'payment_reversals.decided_by',
        'payment_reversals.decided_at',
        'payment_reversals.reject_reason',
      ]);
  }

  private async loadPayment(database: Kysely<SchoolYearDatabase>, paymentId: string) {
    const payment = await database
      .selectFrom('payments')
      .select(['id', 'code', 'org_unit_id', 'amount', 'account_id', 'status', 'payee_name'])
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

  // Dưới hạn mức đang hiệu lực của đơn vị thì Phó Hiệu trưởng duyệt; từ hạn mức trở lên hoặc chưa đặt thì Hiệu trưởng
  private async requiresPrincipal(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    amount: number,
  ): Promise<boolean> {
    const threshold = await database
      .selectFrom('approval_thresholds')
      .select('threshold_amount')
      .where('org_unit_id', '=', orgUnitId)
      .where('document_type', '=', 'payment_reversal')
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
