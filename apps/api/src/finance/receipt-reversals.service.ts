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
import { guardianUserIds } from './receivables.js';

// Phiếu đảo phiếu thu: kế toán, kế toán trưởng lập kèm lý do; Ban Giám hiệu duyệt theo hạn mức `receipt_reversal`;
// phiếu gốc, công nợ và quỹ chỉ thay đổi khi đã duyệt (P06-03; QT-04 mục 7; BR-29, BR-34, BR-77; AC-34, AC-212; YCTD-54)
const PRINCIPAL_ROLE = 'VT-02';
const REVERSAL_SEQUENCE = 'receipt_reversal';

@Injectable()
export class ReceiptReversalsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async create(currentUser: CurrentUser, receiptId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const receipt = await this.loadReceipt(database, receiptId);
    await this.assertScope(currentUser, PERMISSION_CODES.receiptReversalCreate, receipt.org_unit_id);
    if (receipt.status !== 'issued') {
      throw ruleViolationError('BR-29', 'Phiếu thu này đang chờ duyệt đảo hoặc đã đảo');
    }
    const refunded = await database
      .selectFrom('payment_refund_sources')
      .innerJoin('payments', 'payments.id', 'payment_refund_sources.payment_id')
      .select('payments.id')
      .where('payment_refund_sources.receipt_id', '=', receiptId)
      .where('payments.status', 'in', ['pending', 'issued', 'pending_reversal'])
      .executeTakeFirst();
    if (refunded) {
      throw ruleViolationError('BR-29', 'Tiền của phiếu thu này đã dùng cho phiếu chi hoàn tiền, không đảo được');
    }
    const amount = Number(receipt.amount);
    const requiresPrincipal = await this.requiresPrincipal(database, receipt.org_unit_id, amount);
    const reversalId = await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('receipts')
        .set({ status: 'pending_reversal' })
        .where('id', '=', receiptId)
        .where('status', '=', 'issued')
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-29', 'Phiếu thu này đang chờ duyệt đảo hoặc đã đảo');
      }
      const code = await nextDocumentCode(transaction, REVERSAL_SEQUENCE, 'DPT');
      const reversal = await transaction
        .insertInto('receipt_reversals')
        .values({
          code,
          receipt_id: receiptId,
          org_unit_id: receipt.org_unit_id,
          child_id: receipt.child_id,
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
        orgUnitId: receipt.org_unit_id,
        entityName: 'receipt_reversals',
        entityId: reversal.id,
        action: 'create',
        before: { receipt_status: 'issued' },
        after: { code, receipt_code: receipt.code, amount, reason, requires_principal: requiresPrincipal },
      });
      await queueNotification(transaction, {
        orgUnitId: receipt.org_unit_id,
        templateCode: 'receipt_reversal_pending',
        title: 'Có phiếu đảo phiếu thu cần duyệt',
        body: `${code} đảo ${receipt.code} của ${receipt.child_name}: ${amount} đồng. Lý do: ${reason}`,
        targetType: 'receipt_reversals',
        targetId: reversal.id,
        recipients: await this.approverRecipients(transaction, receipt.org_unit_id, requiresPrincipal),
      });
      return reversal.id;
    });
    return this.read(database, reversalId);
  }

  async decide(
    currentUser: CurrentUser,
    receiptId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const receipt = await this.loadReceipt(database, receiptId);
    await this.assertScope(currentUser, PERMISSION_CODES.receiptReversalApprove, receipt.org_unit_id);
    const reversal = await database
      .selectFrom('receipt_reversals')
      .select(['id', 'code', 'requires_principal', 'reason', 'created_by'])
      .where('receipt_id', '=', receiptId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (!reversal) {
      throw ruleViolationError('BR-77', 'Phiếu thu này không có phiếu đảo chờ duyệt');
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
    const amount = Number(receipt.amount);
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('receipt_reversals')
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
        await transaction.updateTable('receipts').set({ status: 'issued' }).where('id', '=', receiptId).execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: receipt.org_unit_id,
          entityName: 'receipt_reversals',
          entityId: reversal.id,
          action: 'update',
          before: { status: 'pending', receipt_status: 'pending_reversal' },
          after: { status: 'rejected', receipt_status: 'issued', reason: decision.reason },
        });
        await queueNotification(transaction, {
          orgUnitId: receipt.org_unit_id,
          templateCode: 'receipt_reversal_rejected',
          title: 'Phiếu đảo phiếu thu bị từ chối',
          body: `${reversal.code} đảo ${receipt.code} bị từ chối. Lý do: ${decision.reason ?? ''}`,
          targetType: 'receipt_reversals',
          targetId: reversal.id,
          recipients: [{ userId: reversal.created_by, channel: 'in_app' }],
        });
        return;
      }
      // Trừ tiền khỏi tài khoản nhận; quỹ tiền mặt không đủ thì chặn, phiếu đảo vẫn chờ duyệt (BR-34)
      const account = await transaction
        .selectFrom('cash_accounts')
        .select(['id', 'account_type', 'current_balance'])
        .where('id', '=', receipt.account_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const balanceBefore = Number(account.current_balance);
      const balanceAfter = balanceBefore - amount;
      if (account.account_type === 'cash' && balanceAfter < 0) {
        throw ruleViolationError('BR-34', 'Số dư quỹ không đủ để đảo phiếu thu');
      }
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
          transaction_type: 'receipt_reversal',
          amount: -amount,
          balance_after: balanceAfter,
          reference_type: 'receipt_reversals',
          reference_id: reversal.id,
          description: `${reversal.code} đảo ${receipt.code}`,
        })
        .execute();
      // Phân bổ của phiếu gốc giữ lại để tra cứu nhưng không còn tính vào số đã thu vì phiếu đã đảo
      await transaction.updateTable('receipts').set({ status: 'reversed' }).where('id', '=', receiptId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: receipt.org_unit_id,
        entityName: 'receipt_reversals',
        entityId: reversal.id,
        action: 'update',
        before: { status: 'pending', receipt_status: 'pending_reversal', account_balance: balanceBefore },
        after: { status: 'approved', receipt_status: 'reversed', account_balance: balanceAfter },
      });
      await queueNotification(transaction, {
        orgUnitId: receipt.org_unit_id,
        templateCode: 'receipt_reversed',
        title: 'Phiếu thu đã được đảo',
        body: `${receipt.code} của ${receipt.child_name} đã được đảo. Lý do: ${reversal.reason}`,
        targetType: 'receipts',
        targetId: receiptId,
        recipients: [
          ...(await guardianUserIds(transaction, receipt.child_id)).map((userId) => ({
            userId,
            channel: 'in_app' as const,
          })),
          { roleCode: 'VT-05', orgUnitId: receipt.org_unit_id, channel: 'in_app' as const },
        ],
      });
    });
    return this.read(database, reversal.id);
  }

  // Phiếu đảo chờ duyệt trong phạm vi người duyệt; Phó Hiệu trưởng chỉ thấy phiếu dưới hạn mức
  async pending(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.receiptReversalApprove);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt phiếu đảo phiếu thu');
    }
    if (orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.reversalQuery(database).where('receipt_reversals.status', '=', 'pending');
    const units = orgUnitId ? [orgUnitId] : scope.wholeSchool ? null : scope.orgUnitIds;
    if (units) {
      query = query.where('receipt_reversals.org_unit_id', 'in', units);
    }
    if (!this.isPrincipal(currentUser)) {
      query = query.where('receipt_reversals.requires_principal', '=', false);
    }
    return (await query.orderBy('receipt_reversals.created_at').execute()).map((row) => ({
      ...row,
      amount: Number(row.amount),
    }));
  }

  // Phiếu đảo của một phiếu thu, dùng cho chi tiết phiếu thu (AC-34)
  async ofReceipt(database: Kysely<SchoolYearDatabase>, receiptId: string) {
    return (
      await this.reversalQuery(database)
        .where('receipt_reversals.receipt_id', '=', receiptId)
        .orderBy('receipt_reversals.created_at')
        .execute()
    ).map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  private async read(database: Kysely<SchoolYearDatabase>, reversalId: string) {
    const row = await this.reversalQuery(database)
      .where('receipt_reversals.id', '=', reversalId)
      .executeTakeFirstOrThrow();
    return { ...row, amount: Number(row.amount) };
  }

  private reversalQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('receipt_reversals')
      .innerJoin('receipts', 'receipts.id', 'receipt_reversals.receipt_id')
      .innerJoin('children', 'children.id', 'receipt_reversals.child_id')
      .select([
        'receipt_reversals.id',
        'receipt_reversals.code',
        'receipt_reversals.receipt_id',
        'receipts.code as receipt_code',
        'receipts.status as receipt_status',
        'receipt_reversals.org_unit_id',
        'children.full_name as child_name',
        'receipt_reversals.amount',
        'receipt_reversals.reason',
        'receipt_reversals.status',
        'receipt_reversals.requires_principal',
        'receipt_reversals.created_by',
        'receipt_reversals.created_at',
        'receipt_reversals.decided_by',
        'receipt_reversals.decided_at',
        'receipt_reversals.reject_reason',
      ]);
  }

  private async loadReceipt(database: Kysely<SchoolYearDatabase>, receiptId: string) {
    const receipt = await database
      .selectFrom('receipts')
      .innerJoin('children', 'children.id', 'receipts.child_id')
      .select([
        'receipts.id',
        'receipts.code',
        'receipts.org_unit_id',
        'receipts.child_id',
        'receipts.amount',
        'receipts.account_id',
        'receipts.status',
        'children.full_name as child_name',
      ])
      .where('receipts.id', '=', receiptId)
      .executeTakeFirst();
    if (!receipt) {
      throw notFoundError('Không tìm thấy phiếu thu', 'receipt');
    }
    return receipt;
  }

  private async assertScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<void> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền với phiếu thu của đơn vị này', [
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
      .where('document_type', '=', 'receipt_reversal')
      .where('status', '=', 'active')
      .executeTakeFirst();
    return !threshold || amount >= Number(threshold.threshold_amount);
  }

  private isPrincipal(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some(
      (assignment) =>
        assignment.role_code === PRINCIPAL_ROLE &&
        assignment.permissions.includes(PERMISSION_CODES.receiptReversalApprove),
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
