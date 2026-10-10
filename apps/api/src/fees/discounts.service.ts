import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { discountApplied, discountBase, invoiceAmounts } from './invoice-amounts.js';

// Miễn giảm và phiếu điều chỉnh hóa đơn, Ban Giám hiệu duyệt theo hạn mức của đơn vị
// (P05-07, P05-08; QT-03 bước 7, 8; BR-20, BR-21, BR-22, BR-25, BR-77; Q-112, Q-134; YCTD-52)
const PRINCIPAL_ROLE = 'VT-02';
const ADJUSTMENT_SEQUENCE = 'invoice_adjustment';

type DocumentKind = 'tuition_discount' | 'invoice_adjustment';

@Injectable()
export class DiscountsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // Lập miễn giảm trên hóa đơn nháp hoặc đã phát hành; không sửa dòng khoản phải thu (BR-25)
  async createDiscount(
    currentUser: CurrentUser,
    invoiceId: string,
    input: { discountTypeId: string; basis: string },
    origin: ChangeOrigin,
    copiedFromId: string | null = null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const invoice = await this.loadInvoice(database, invoiceId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.discountManage, invoice.org_unit_id);
    const type = await database
      .selectFrom('discount_types')
      .select(['id', 'name', 'calculation_method', 'value', 'applies_to', 'status'])
      .where('id', '=', input.discountTypeId)
      .executeTakeFirst();
    if (!type || type.status !== 'active') {
      throw validationError([
        { field: 'discount_type_id', message: 'Loại miễn giảm không có trong danh mục đang dùng' },
      ]);
    }
    const items = await database
      .selectFrom('invoice_items')
      .select(['item_type', 'service_id', 'amount'])
      .where('invoice_id', '=', invoiceId)
      .execute();
    const base = discountBase(items, type.applies_to);
    if (base === 0) {
      throw ruleViolationError('BR-21', 'Hóa đơn không có khoản nào thuộc phạm vi áp dụng của loại miễn giảm');
    }
    const applied = discountApplied(type.calculation_method, Number(type.value), base);
    if (applied > base) {
      throw ruleViolationError('BR-22', 'Miễn giảm vượt số tiền của các khoản được áp dụng, cần điều chỉnh');
    }
    const existing = await database
      .selectFrom('discounts')
      .select('applied_amount')
      .where('invoice_id', '=', invoiceId)
      .where('status', 'in', ['pending', 'approved'])
      .execute();
    const used = existing.reduce((sum, row) => sum + Number(row.applied_amount), 0);
    if (used + applied > Number(invoice.total_amount)) {
      throw ruleViolationError('BR-22', 'Tổng miễn giảm vượt tổng khoản phải thu của trẻ trong kỳ, cần điều chỉnh');
    }
    const requiresPrincipal = await this.requiresPrincipal(database, invoice.org_unit_id, 'tuition_discount', applied);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('discounts')
        .values({
          invoice_id: invoiceId,
          child_id: invoice.child_id,
          org_unit_id: invoice.org_unit_id,
          discount_type_id: type.id,
          basis: input.basis,
          calculation_method: type.calculation_method,
          rate_value: type.value,
          base_amount: base,
          applied_amount: applied,
          status: 'pending',
          requires_principal: requiresPrincipal,
          copied_from_id: copiedFromId,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: invoice.org_unit_id,
        entityName: 'discounts',
        entityId: row.id,
        action: 'create',
        before: null,
        after: {
          invoice_id: invoiceId,
          discount_type: type.name,
          basis: input.basis,
          base,
          applied,
          requiresPrincipal,
        },
      });
      await queueNotification(transaction, {
        orgUnitId: invoice.org_unit_id,
        templateCode: 'discount_pending',
        title: 'Có miễn giảm chờ duyệt',
        body: `${type.name} cho ${invoice.child_name}: ${applied} đồng`,
        targetType: 'discounts',
        targetId: row.id,
        recipients: await this.approverRecipients(transaction, invoice.org_unit_id, requiresPrincipal),
      });
      return row;
    });
    return this.readDiscount(database, created.id);
  }

  // Chép miễn giảm đã duyệt của hóa đơn chính kỳ trước sang hóa đơn này để lập nhanh; bản chép vẫn chờ duyệt
  async copyPrevious(currentUser: CurrentUser, invoiceId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const invoice = await this.loadInvoice(database, invoiceId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.discountManage, invoice.org_unit_id);
    const previous =
      invoice.period_month === 1
        ? { year: invoice.period_year - 1, month: 12 }
        : { year: invoice.period_year, month: invoice.period_month - 1 };
    const sources = await database
      .selectFrom('discounts')
      .innerJoin('invoices', 'invoices.id', 'discounts.invoice_id')
      .innerJoin('discount_types', 'discount_types.id', 'discounts.discount_type_id')
      .select(['discounts.id', 'discounts.discount_type_id', 'discounts.basis'])
      .where('discounts.child_id', '=', invoice.child_id)
      .where('discounts.status', '=', 'approved')
      .where('invoices.period_year', '=', previous.year)
      .where('invoices.period_month', '=', previous.month)
      .where('invoices.invoice_kind', '=', 'main')
      .where('discount_types.status', '=', 'active')
      .execute();
    const already = new Set(
      (
        await database
          .selectFrom('discounts')
          .select('discount_type_id')
          .where('invoice_id', '=', invoiceId)
          .where('status', 'in', ['pending', 'approved'])
          .execute()
      ).map((row) => row.discount_type_id),
    );
    const copied = [];
    for (const source of sources.filter((row) => !already.has(row.discount_type_id))) {
      copied.push(
        await this.createDiscount(
          currentUser,
          invoiceId,
          { discountTypeId: source.discount_type_id, basis: source.basis },
          origin,
          source.id,
        ),
      );
    }
    return copied;
  }

  async decideDiscount(
    currentUser: CurrentUser,
    discountId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const discount = await database
      .selectFrom('discounts')
      .select(['id', 'org_unit_id', 'status', 'requires_principal', 'applied_amount', 'invoice_id'])
      .where('id', '=', discountId)
      .executeTakeFirst();
    if (!discount) {
      throw notFoundError('Không tìm thấy miễn giảm', 'discount');
    }
    await this.assertCanDecide(currentUser, discount, decision);
    if (decision.approve) {
      const invoice = await this.loadInvoice(database, discount.invoice_id);
      const approved = await database
        .selectFrom('discounts')
        .select('applied_amount')
        .where('invoice_id', '=', discount.invoice_id)
        .where('status', '=', 'approved')
        .execute();
      const total =
        approved.reduce((sum, row) => sum + Number(row.applied_amount), 0) + Number(discount.applied_amount);
      if (total > Number(invoice.total_amount)) {
        throw ruleViolationError('BR-22', 'Tổng miễn giảm vượt tổng khoản phải thu của trẻ trong kỳ, cần điều chỉnh');
      }
    }
    await this.decide(database, 'discounts', discount, decision, origin);
    return this.readDiscount(database, discountId);
  }

  // Phiếu điều chỉnh liên kết hóa đơn gốc đã phát hành, hóa đơn gốc giữ nguyên (BR-25, AC-25)
  async createAdjustment(
    currentUser: CurrentUser,
    input: { invoiceId: string; amount: number; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const invoice = await this.loadInvoice(database, input.invoiceId);
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.invoiceAdjustmentCreate,
      invoice.org_unit_id,
    );
    if (invoice.status !== 'issued') {
      throw ruleViolationError(
        'BR-25',
        'Chỉ lập phiếu điều chỉnh cho hóa đơn đã phát hành; hóa đơn nháp sửa bằng chạy lại tính',
      );
    }
    const amounts = (await invoiceAmounts(database, [invoice])).get(invoice.id);
    if ((amounts?.payable_amount ?? 0) + input.amount < 0) {
      throw ruleViolationError('BR-22', 'Điều chỉnh giảm vượt số phải nộp của hóa đơn');
    }
    const requiresPrincipal = await this.requiresPrincipal(
      database,
      invoice.org_unit_id,
      'invoice_adjustment',
      Math.abs(input.amount),
    );
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('invoice_adjustments')
        .values({
          code: await this.nextAdjustmentCode(transaction),
          invoice_id: invoice.id,
          child_id: invoice.child_id,
          org_unit_id: invoice.org_unit_id,
          reason: input.reason,
          amount: input.amount,
          status: 'pending',
          requires_principal: requiresPrincipal,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'code'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: invoice.org_unit_id,
        entityName: 'invoice_adjustments',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { code: row.code, invoice_id: invoice.id, amount: input.amount, reason: input.reason },
      });
      await queueNotification(transaction, {
        orgUnitId: invoice.org_unit_id,
        templateCode: 'invoice_adjustment_pending',
        title: 'Có phiếu điều chỉnh hóa đơn chờ duyệt',
        body: `${row.code} điều chỉnh hóa đơn ${invoice.code ?? ''} của ${invoice.child_name}: ${input.amount} đồng`,
        targetType: 'invoice_adjustments',
        targetId: row.id,
        recipients: await this.approverRecipients(transaction, invoice.org_unit_id, requiresPrincipal),
      });
      return row;
    });
    return this.readAdjustment(database, created.id);
  }

  async decideAdjustment(
    currentUser: CurrentUser,
    adjustmentId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const adjustment = await database
      .selectFrom('invoice_adjustments')
      .select(['id', 'org_unit_id', 'status', 'requires_principal', 'amount', 'invoice_id'])
      .where('id', '=', adjustmentId)
      .executeTakeFirst();
    if (!adjustment) {
      throw notFoundError('Không tìm thấy phiếu điều chỉnh', 'invoice_adjustment');
    }
    await this.assertCanDecide(currentUser, adjustment, decision);
    if (decision.approve) {
      const invoice = await this.loadInvoice(database, adjustment.invoice_id);
      const amounts = (await invoiceAmounts(database, [invoice])).get(invoice.id);
      if ((amounts?.payable_amount ?? 0) + Number(adjustment.amount) < 0) {
        throw ruleViolationError('BR-22', 'Điều chỉnh giảm vượt số phải nộp của hóa đơn');
      }
    }
    await this.decide(database, 'invoice_adjustments', adjustment, decision, origin);
    return this.readAdjustment(database, adjustmentId);
  }

  // Miễn giảm và phiếu điều chỉnh chờ duyệt trong phạm vi người duyệt; Phó Hiệu trưởng chỉ thấy khoản dưới hạn mức
  async pending(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.feeDocumentApprove);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt miễn giảm và phiếu điều chỉnh');
    }
    if (orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const units = orgUnitId ? [orgUnitId] : scope.wholeSchool ? null : scope.orgUnitIds;
    const isPrincipal = this.isPrincipal(currentUser);
    let discounts = database
      .selectFrom('discounts')
      .innerJoin('children', 'children.id', 'discounts.child_id')
      .innerJoin('discount_types', 'discount_types.id', 'discounts.discount_type_id')
      .innerJoin('invoices', 'invoices.id', 'discounts.invoice_id')
      .select([
        'discounts.id',
        'discounts.invoice_id',
        'children.full_name as child_name',
        'discount_types.name as discount_type_name',
        'discounts.basis',
        'discounts.applied_amount',
        'discounts.requires_principal',
        'invoices.period_year',
        'invoices.period_month',
        'discounts.created_at',
      ])
      .where('discounts.status', '=', 'pending');
    let adjustments = database
      .selectFrom('invoice_adjustments')
      .innerJoin('children', 'children.id', 'invoice_adjustments.child_id')
      .innerJoin('invoices', 'invoices.id', 'invoice_adjustments.invoice_id')
      .select([
        'invoice_adjustments.id',
        'invoice_adjustments.code',
        'invoice_adjustments.invoice_id',
        'invoices.code as invoice_code',
        'children.full_name as child_name',
        'invoice_adjustments.reason',
        'invoice_adjustments.amount',
        'invoice_adjustments.requires_principal',
        'invoice_adjustments.created_at',
      ])
      .where('invoice_adjustments.status', '=', 'pending');
    if (units) {
      discounts = discounts.where('discounts.org_unit_id', 'in', units);
      adjustments = adjustments.where('invoice_adjustments.org_unit_id', 'in', units);
    }
    if (!isPrincipal) {
      discounts = discounts.where('discounts.requires_principal', '=', false);
      adjustments = adjustments.where('invoice_adjustments.requires_principal', '=', false);
    }
    return {
      discounts: (await discounts.orderBy('discounts.created_at').execute()).map((row) => ({
        ...row,
        applied_amount: Number(row.applied_amount),
      })),
      adjustments: (await adjustments.orderBy('invoice_adjustments.created_at').execute()).map((row) => ({
        ...row,
        amount: Number(row.amount),
      })),
    };
  }

  // Miễn giảm và phiếu điều chỉnh của một hóa đơn, dùng cho chi tiết hóa đơn
  async ofInvoice(database: Kysely<SchoolYearDatabase>, invoiceId: string) {
    const discounts = await database
      .selectFrom('discounts')
      .innerJoin('discount_types', 'discount_types.id', 'discounts.discount_type_id')
      .select([
        'discounts.id',
        'discount_types.name as discount_type_name',
        'discounts.basis',
        'discounts.calculation_method',
        'discounts.rate_value',
        'discounts.base_amount',
        'discounts.applied_amount',
        'discounts.status',
        'discounts.requires_principal',
        'discounts.decided_by',
        'discounts.decided_at',
        'discounts.reject_reason',
      ])
      .where('discounts.invoice_id', '=', invoiceId)
      .orderBy('discounts.created_at')
      .execute();
    const adjustments = await database
      .selectFrom('invoice_adjustments')
      .select([
        'id',
        'code',
        'reason',
        'amount',
        'status',
        'requires_principal',
        'decided_by',
        'decided_at',
        'reject_reason',
      ])
      .where('invoice_id', '=', invoiceId)
      .orderBy('created_at')
      .execute();
    return {
      discounts: discounts.map((row) => ({
        ...row,
        rate_value: Number(row.rate_value),
        base_amount: Number(row.base_amount),
        applied_amount: Number(row.applied_amount),
      })),
      adjustments: adjustments.map((row) => ({ ...row, amount: Number(row.amount) })),
    };
  }

  private async readDiscount(database: Kysely<SchoolYearDatabase>, discountId: string) {
    const row = await database
      .selectFrom('discounts')
      .selectAll()
      .where('id', '=', discountId)
      .executeTakeFirstOrThrow();
    return {
      ...row,
      rate_value: Number(row.rate_value),
      base_amount: Number(row.base_amount),
      applied_amount: Number(row.applied_amount),
    };
  }

  private async readAdjustment(database: Kysely<SchoolYearDatabase>, adjustmentId: string) {
    const row = await database
      .selectFrom('invoice_adjustments')
      .selectAll()
      .where('id', '=', adjustmentId)
      .executeTakeFirstOrThrow();
    return { ...row, amount: Number(row.amount) };
  }

  private async loadInvoice(database: Kysely<SchoolYearDatabase>, invoiceId: string) {
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
        'invoices.period_year',
        'invoices.period_month',
        'children.full_name as child_name',
      ])
      .where('invoices.id', '=', invoiceId)
      .executeTakeFirst();
    if (!invoice) {
      throw notFoundError('Không tìm thấy hóa đơn', 'invoice');
    }
    return invoice;
  }

  // Dưới hạn mức đang hiệu lực của đơn vị thì Phó Hiệu trưởng duyệt; từ hạn mức trở lên hoặc chưa đặt thì Hiệu trưởng
  private async requiresPrincipal(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    kind: DocumentKind,
    amount: number,
  ): Promise<boolean> {
    const threshold = await database
      .selectFrom('approval_thresholds')
      .select('threshold_amount')
      .where('org_unit_id', '=', orgUnitId)
      .where('document_type', '=', kind)
      .where('status', '=', 'active')
      .executeTakeFirst();
    return !threshold || amount >= Number(threshold.threshold_amount);
  }

  private isPrincipal(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some(
      (assignment) =>
        assignment.role_code === PRINCIPAL_ROLE && assignment.permissions.includes(PERMISSION_CODES.feeDocumentApprove),
    );
  }

  private async assertCanDecide(
    currentUser: CurrentUser,
    document: { org_unit_id: string; status: string; requires_principal: boolean },
    decision: { approve: boolean; reason: string | null },
  ): Promise<void> {
    await this.organizationScopes.assertCanAccess(
      currentUser,
      PERMISSION_CODES.feeDocumentApprove,
      document.org_unit_id,
    );
    if (document.requires_principal && !this.isPrincipal(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Khoản này từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức, cần Hiệu trưởng duyệt',
      );
    }
    if (document.status !== 'pending') {
      throw ruleViolationError('BR-77', 'Chứng từ này không chờ duyệt');
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
  }

  private async decide(
    database: Kysely<SchoolYearDatabase>,
    table: 'discounts' | 'invoice_adjustments',
    document: { id: string; org_unit_id: string },
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ): Promise<void> {
    const status = decision.approve ? ('approved' as const) : ('rejected' as const);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable(table)
        .set({
          status,
          decided_by: origin.actorUserId,
          decided_at: this.clock.now(),
          reject_reason: decision.approve ? null : decision.reason,
        })
        .where('id', '=', document.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: document.org_unit_id,
        entityName: table,
        entityId: document.id,
        action: 'update',
        before: { status: 'pending' },
        after: { status, reason: decision.reason },
      });
    });
  }

  private async nextAdjustmentCode(transaction: Transaction<SchoolYearDatabase>): Promise<string> {
    const row = await transaction
      .insertInto('document_sequences')
      .values({ document_type: ADJUSTMENT_SEQUENCE, last_value: 1 })
      .onConflict((conflict) =>
        conflict.column('document_type').doUpdateSet((expression) => ({
          last_value: expression('document_sequences.last_value', '+', 1),
        })),
      )
      .returning('last_value')
      .executeTakeFirstOrThrow();
    return `DC-${String(row.last_value).padStart(6, '0')}`;
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
