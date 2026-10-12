import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { MedicinePurchaseRequestStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredInteger,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { readHealthDate } from '../health/health-fields.js';
import { MedicationAccess } from './medication-access.js';
import { MEDICINE_VIEW_PERMISSIONS } from './medicine-catalog.js';

// Đề nghị mua thuốc, phiếu mua thuốc và thuốc đã mua, phiếu cấp thuốc (P10-05, P10-09; BR-28, BR-63; YCTD-75).
// Đề nghị duyệt theo hạn mức loại purchase_request của đơn vị: dưới hạn mức Phó Hiệu trưởng hoặc Hiệu trưởng duyệt, từ hạn
// mức trở lên hoặc đơn vị chưa đặt hạn mức thì chỉ Hiệu trưởng; người duyệt không là người lập. Phiếu mua thuốc lập từ đề
// nghị đã duyệt, ghi thuốc đã mua thì số lượng trong danh mục tăng ngay; thanh toán bằng phiếu chi (P06-04) theo mã phiếu
// mua. Phiếu cấp thuốc trừ tồn, không cho cấp quá tồn
const PRINCIPAL_ROLE = 'VT-02';
const PURCHASE_ORDER_SEQUENCE = 'medicine_purchase_order';
const PURCHASE_ORDER_PREFIX = 'MT';
const ISSUE_SEQUENCE = 'medicine_issue';
const ISSUE_PREFIX = 'CTH';
const MAXIMUM_QUANTITY = 1_000_000;
const MAXIMUM_PRICE = 1_000_000_000;
const STATUSES: MedicinePurchaseRequestStatus[] = ['pending', 'approved', 'rejected', 'ordered'];

interface OrderItemInput {
  medicine_id: string;
  quantity: number;
  unit_price: number;
}

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

@Injectable()
export class MedicinePurchasesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: MedicationAccess,
    private readonly clock: Clock,
  ) {}

  async createRequest(
    currentUser: CurrentUser,
    input: { medicine_id: string; quantity: number; estimated_unit_price: number; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const medicine = await this.loadMedicine(database, input.medicine_id);
    await this.assertManage(currentUser, medicine.org_unit_id);
    const estimatedAmount = roundMoney(input.quantity * input.estimated_unit_price);
    const requiresPrincipal = await this.requiresPrincipal(database, medicine.org_unit_id, estimatedAmount);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('medicine_purchase_requests')
        .values({
          ...input,
          org_unit_id: medicine.org_unit_id,
          estimated_amount: estimatedAmount,
          requires_principal: requiresPrincipal,
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: medicine.org_unit_id,
        templateCode: 'medicine_purchase_requested',
        title: 'Đề nghị mua thuốc chờ duyệt',
        body: `Đề nghị mua ${input.quantity} ${medicine.unit} ${medicine.name}, dự kiến ${estimatedAmount} đồng`,
        targetType: 'medicine_purchase_requests',
        targetId: created.id,
        recipients: await this.approverRecipients(transaction, medicine.org_unit_id, requiresPrincipal),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: medicine.org_unit_id,
        entityName: 'medicine_purchase_requests',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async listRequests(
    currentUser: CurrentUser,
    filter: { status: MedicinePurchaseRequestStatus | null; orgUnitId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.staffScope(currentUser, MEDICINE_VIEW_PERMISSIONS);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('medicine_purchase_requests')
      .innerJoin('medicines', 'medicines.id', 'medicine_purchase_requests.medicine_id')
      .select([
        'medicine_purchase_requests.id',
        'medicine_purchase_requests.org_unit_id',
        'medicine_purchase_requests.medicine_id',
        'medicines.name as medicine_name',
        'medicines.unit',
        'medicine_purchase_requests.quantity',
        'medicine_purchase_requests.estimated_unit_price',
        'medicine_purchase_requests.estimated_amount',
        'medicine_purchase_requests.reason',
        'medicine_purchase_requests.status',
        'medicine_purchase_requests.requires_principal',
        'medicine_purchase_requests.created_by',
        'medicine_purchase_requests.created_at',
        'medicine_purchase_requests.approved_by',
        'medicine_purchase_requests.approved_at',
        'medicine_purchase_requests.reject_reason',
      ])
      .orderBy('medicine_purchase_requests.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('medicine_purchase_requests.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('medicine_purchase_requests.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('medicine_purchase_requests.status', '=', filter.status);
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      ...row,
      estimated_unit_price: Number(row.estimated_unit_price),
      estimated_amount: Number(row.estimated_amount),
    }));
  }

  // BR-63: duyệt hoặc từ chối theo hạn mức của đơn vị, như phiếu chi
  async decide(
    currentUser: CurrentUser,
    requestId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await database
      .selectFrom('medicine_purchase_requests')
      .selectAll()
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị mua thuốc', 'medicine_purchase_request');
    }
    await this.access.assertStaffScope(
      currentUser,
      [PERMISSION_CODES.medicinePurchaseApprove],
      request.org_unit_id,
      'Bạn không có quyền duyệt đề nghị mua thuốc của đơn vị này',
    );
    if (request.status !== 'pending') {
      throw ruleViolationError('BR-63', 'Đề nghị mua thuốc này không chờ duyệt');
    }
    if (request.requires_principal && !this.isPrincipal(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Đề nghị từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức đề nghị mua hàng, cần Hiệu trưởng duyệt',
      );
    }
    if (request.created_by === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người lập đề nghị');
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('medicine_purchase_requests')
        .set(
          decision.approve
            ? { status: 'approved', approved_by: currentUser.id, approved_at: this.clock.now() }
            : { status: 'rejected', reject_reason: decision.reason },
        )
        .where('id', '=', requestId)
        .where('status', '=', 'pending')
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-63', 'Đề nghị mua thuốc đã được người khác xử lý');
      }
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: decision.approve ? 'medicine_purchase_approved' : 'medicine_purchase_rejected',
        title: decision.approve ? 'Đề nghị mua thuốc đã duyệt' : 'Đề nghị mua thuốc bị từ chối',
        body: decision.approve
          ? 'Đề nghị mua thuốc đã được duyệt, có thể lập phiếu mua thuốc'
          : `Đề nghị mua thuốc bị từ chối. Lý do: ${decision.reason ?? ''}`,
        targetType: 'medicine_purchase_requests',
        targetId: requestId,
        recipients: [{ userId: request.created_by, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'medicine_purchase_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: updated.status, reason: decision.reason },
      });
      return { ...updated, estimated_amount: Number(updated.estimated_amount) };
    });
  }

  // P10-09: lập phiếu mua thuốc từ đề nghị đã duyệt; thuốc đã mua tăng số lượng trong danh mục thuốc
  async createOrder(
    currentUser: CurrentUser,
    input: {
      request_id: string;
      pharmacy_id: string;
      order_date: string | undefined;
      note: string | null;
      items: OrderItemInput[];
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await database
      .selectFrom('medicine_purchase_requests')
      .select(['id', 'org_unit_id', 'status'])
      .where('id', '=', input.request_id)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị mua thuốc', 'medicine_purchase_request');
    }
    await this.assertManage(currentUser, request.org_unit_id);
    if (request.status !== 'approved') {
      throw ruleViolationError(
        'BR-63',
        request.status === 'ordered'
          ? 'Đề nghị này đã lập phiếu mua thuốc'
          : 'Đề nghị mua thuốc phải được duyệt trước khi lập phiếu mua',
      );
    }
    const pharmacy = await database
      .selectFrom('pharmacies')
      .select(['org_unit_id', 'status'])
      .where('id', '=', input.pharmacy_id)
      .executeTakeFirst();
    if (!pharmacy || pharmacy.org_unit_id !== request.org_unit_id || pharmacy.status !== 'active') {
      throw validationError([{ field: 'pharmacy_id', message: 'Nhà thuốc không thuộc đơn vị hoặc đã ngừng' }]);
    }
    const medicines = await database
      .selectFrom('medicines')
      .select(['id', 'org_unit_id'])
      .where(
        'id',
        'in',
        input.items.map((item) => item.medicine_id),
      )
      .execute();
    if (
      !input.items.every((item) =>
        medicines.some((medicine) => medicine.id === item.medicine_id && medicine.org_unit_id === request.org_unit_id),
      )
    ) {
      throw validationError([{ field: 'items', message: 'Thuốc phải thuộc danh mục của đơn vị của đề nghị' }]);
    }
    const orderDate = input.order_date ?? VIETNAM_DATE.format(this.clock.now());
    if (orderDate > VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'order_date', message: 'Ngày mua không sau hôm nay' }]);
    }
    const lines = input.items.map((item) => ({ ...item, amount: roundMoney(item.quantity * item.unit_price) }));
    const total = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
    return database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('medicine_purchase_requests')
        .set({ status: 'ordered' })
        .where('id', '=', request.id)
        .where('status', '=', 'approved')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-63', 'Đề nghị này đã lập phiếu mua thuốc');
      }
      const order = await transaction
        .insertInto('medicine_purchase_orders')
        .values({
          code: await nextDocumentCode(transaction, PURCHASE_ORDER_SEQUENCE, PURCHASE_ORDER_PREFIX),
          org_unit_id: request.org_unit_id,
          request_id: request.id,
          pharmacy_id: input.pharmacy_id,
          order_date: orderDate,
          total_amount: total,
          note: input.note,
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const items = await transaction
        .insertInto('medicine_purchase_order_items')
        .values(lines.map((line) => ({ ...line, order_id: order.id, received_qty: line.quantity })))
        .returningAll()
        .execute();
      for (const line of lines) {
        await transaction
          .updateTable('medicines')
          .set((expression) => ({
            stock_qty: expression('stock_qty', '+', line.quantity),
            updated_at: this.clock.now(),
          }))
          .where('id', '=', line.medicine_id)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'medicine_purchase_orders',
        entityId: order.id,
        action: 'create',
        before: null,
        after: { ...order, items },
      });
      return {
        ...order,
        total_amount: Number(order.total_amount),
        items: items.map((item) => ({ ...item, unit_price: Number(item.unit_price), amount: Number(item.amount) })),
      };
    });
  }

  async listOrders(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.staffScope(currentUser, MEDICINE_VIEW_PERMISSIONS);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('medicine_purchase_orders')
      .innerJoin('pharmacies', 'pharmacies.id', 'medicine_purchase_orders.pharmacy_id')
      .select([
        'medicine_purchase_orders.id',
        'medicine_purchase_orders.code',
        'medicine_purchase_orders.org_unit_id',
        'medicine_purchase_orders.request_id',
        'medicine_purchase_orders.pharmacy_id',
        'pharmacies.name as pharmacy_name',
        'medicine_purchase_orders.order_date',
        'medicine_purchase_orders.total_amount',
        'medicine_purchase_orders.status',
        'medicine_purchase_orders.note',
        'medicine_purchase_orders.created_at',
      ])
      .orderBy('medicine_purchase_orders.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('medicine_purchase_orders.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (orgUnitId) {
      query = query.where('medicine_purchase_orders.org_unit_id', '=', orgUnitId);
    }
    const orders = await query.execute();
    const items =
      orders.length === 0
        ? []
        : await database
            .selectFrom('medicine_purchase_order_items')
            .innerJoin('medicines', 'medicines.id', 'medicine_purchase_order_items.medicine_id')
            .select([
              'medicine_purchase_order_items.id',
              'medicine_purchase_order_items.order_id',
              'medicine_purchase_order_items.medicine_id',
              'medicines.name as medicine_name',
              'medicines.unit',
              'medicine_purchase_order_items.quantity',
              'medicine_purchase_order_items.unit_price',
              'medicine_purchase_order_items.amount',
              'medicine_purchase_order_items.received_qty',
            ])
            .where(
              'medicine_purchase_order_items.order_id',
              'in',
              orders.map((order) => order.id),
            )
            .execute();
    return orders.map((order) => ({
      ...order,
      total_amount: Number(order.total_amount),
      items: items
        .filter((item) => item.order_id === order.id)
        .map((item) => ({ ...item, unit_price: Number(item.unit_price), amount: Number(item.amount) })),
    }));
  }

  // P10-05 cấp thuốc: trừ tồn trong danh mục, không cho cấp quá tồn
  async issue(
    currentUser: CurrentUser,
    input: { medicine_id: string; quantity: number; recipient: string; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const medicine = await this.loadMedicine(database, input.medicine_id);
    await this.assertManage(currentUser, medicine.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('medicines')
        .set((expression) => ({
          stock_qty: expression('stock_qty', '-', input.quantity),
          updated_at: this.clock.now(),
        }))
        .where('id', '=', medicine.id)
        .where('stock_qty', '>=', input.quantity)
        .returning('stock_qty')
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('P10-05', `Không đủ thuốc để cấp, còn ${medicine.stock_qty} ${medicine.unit}`);
      }
      const created = await transaction
        .insertInto('medicine_issues')
        .values({
          ...input,
          code: await nextDocumentCode(transaction, ISSUE_SEQUENCE, ISSUE_PREFIX),
          org_unit_id: medicine.org_unit_id,
          issued_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: medicine.org_unit_id,
        entityName: 'medicine_issues',
        entityId: created.id,
        action: 'create',
        before: { stock_qty: medicine.stock_qty },
        after: { ...created, stock_qty: updated.stock_qty },
      });
      return { ...created, stock_qty: updated.stock_qty };
    });
  }

  async listIssues(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.staffScope(currentUser, MEDICINE_VIEW_PERMISSIONS);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('medicine_issues')
      .innerJoin('medicines', 'medicines.id', 'medicine_issues.medicine_id')
      .select([
        'medicine_issues.id',
        'medicine_issues.code',
        'medicine_issues.org_unit_id',
        'medicine_issues.medicine_id',
        'medicines.name as medicine_name',
        'medicines.unit',
        'medicine_issues.quantity',
        'medicine_issues.recipient',
        'medicine_issues.reason',
        'medicine_issues.issued_at',
      ])
      .orderBy('medicine_issues.issued_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('medicine_issues.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (orgUnitId) {
      query = query.where('medicine_issues.org_unit_id', '=', orgUnitId);
    }
    return query.execute();
  }

  private async loadMedicine(database: Kysely<SchoolYearDatabase>, medicineId: string) {
    const medicine = await database
      .selectFrom('medicines')
      .select(['id', 'org_unit_id', 'name', 'unit', 'stock_qty', 'status'])
      .where('id', '=', medicineId)
      .executeTakeFirst();
    if (!medicine) {
      throw notFoundError('Không tìm thấy thuốc', 'medicine');
    }
    return medicine;
  }

  private assertManage(currentUser: CurrentUser, orgUnitId: string) {
    return this.access.assertStaffScope(
      currentUser,
      [PERMISSION_CODES.medicineManage],
      orgUnitId,
      'Bạn không có quyền quản lý thuốc của đơn vị này',
    );
  }

  private async requiresPrincipal(database: Kysely<SchoolYearDatabase>, orgUnitId: string, amount: number) {
    const threshold = await database
      .selectFrom('approval_thresholds')
      .select('threshold_amount')
      .where('org_unit_id', '=', orgUnitId)
      .where('document_type', '=', 'purchase_request')
      .where('status', '=', 'active')
      .executeTakeFirst();
    return !threshold || amount >= Number(threshold.threshold_amount);
  }

  private isPrincipal(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some(
      (assignment) =>
        assignment.role_code === PRINCIPAL_ROLE &&
        assignment.permissions.includes(PERMISSION_CODES.medicinePurchaseApprove),
    );
  }

  private async approverRecipients(
    transaction: Transaction<SchoolYearDatabase>,
    orgUnitId: string,
    requiresPrincipal: boolean,
  ): Promise<NotificationRecipient[]> {
    const root = await transaction
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

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readMoney(body: RequestBody, field: string, errors: FieldError[]): number {
  const value = body?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAXIMUM_PRICE) {
    errors.push({ field, message: `Số tiền từ 0 đến ${MAXIMUM_PRICE}` });
    return 0;
  }
  return value;
}

function readItems(body: RequestBody, errors: FieldError[]): OrderItemInput[] {
  const value = body?.items;
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ field: 'items', message: 'Bắt buộc nhập ít nhất một thuốc đã mua' });
    return [];
  }
  const items = value.map((item: unknown, index) => {
    const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const itemErrors: FieldError[] = [];
    const parsed = {
      medicine_id: readRequiredUuid(row, 'medicine_id', itemErrors, 'Bắt buộc chọn thuốc'),
      quantity: readRequiredInteger(row, 'quantity', itemErrors, { min: 1, max: MAXIMUM_QUANTITY }),
      unit_price: readMoney(row, 'unit_price', itemErrors),
    };
    errors.push(...itemErrors.map((error) => ({ ...error, field: `items[${index}].${error.field}` })));
    return parsed;
  });
  if (new Set(items.map((item) => item.medicine_id)).size !== items.length) {
    errors.push({ field: 'items', message: 'Mỗi thuốc chỉ một dòng' });
  }
  return items;
}

function readFilterUnit(query: Record<string, string | undefined>): string | null {
  if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
    throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
  }
  return query.org_unit_id ?? null;
}

@Controller()
export class MedicinePurchasesController {
  constructor(private readonly purchases: MedicinePurchasesService) {}

  @Post('medicine-purchase-requests')
  @HttpCode(201)
  createRequest(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      medicine_id: readRequiredUuid(body, 'medicine_id', errors, 'Bắt buộc chọn thuốc'),
      quantity: readRequiredInteger(body, 'quantity', errors, { min: 1, max: MAXIMUM_QUANTITY }),
      estimated_unit_price: readMoney(body, 'estimated_unit_price', errors),
      reason: readRequiredText(body, 'reason', errors),
    };
    check(errors);
    return this.purchases.createRequest(currentUser, input, originOf(request, currentUser));
  }

  @Get('medicine-purchase-requests')
  listRequests(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const status = query.status as MedicinePurchaseRequestStatus | undefined;
    if (status !== undefined && !STATUSES.includes(status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là pending, approved, rejected hoặc ordered' }]);
    }
    return this.purchases.listRequests(currentUser, { status: status ?? null, orgUnitId: readFilterUnit(query) });
  }

  @Post('medicine-purchase-requests/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchases.decide(
      currentUser,
      requestId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('medicine-purchase-requests/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    check(errors);
    return this.purchases.decide(currentUser, requestId, { approve: false, reason }, originOf(request, currentUser));
  }

  @Post('medicine-purchase-orders')
  @HttpCode(201)
  createOrder(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      request_id: readRequiredUuid(body, 'request_id', errors, 'Bắt buộc chọn đề nghị mua thuốc đã duyệt'),
      pharmacy_id: readRequiredUuid(body, 'pharmacy_id', errors, 'Bắt buộc chọn nhà thuốc'),
      order_date: readHealthDate(body, 'order_date', errors, false),
      note: readOptionalText(body, 'note', errors) ?? null,
      items: readItems(body, errors),
    };
    check(errors);
    return this.purchases.createOrder(currentUser, input, originOf(request, currentUser));
  }

  @Get('medicine-purchase-orders')
  listOrders(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.purchases.listOrders(currentUser, readFilterUnit(query));
  }

  @Post('medicine-issues')
  @HttpCode(201)
  issue(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      medicine_id: readRequiredUuid(body, 'medicine_id', errors, 'Bắt buộc chọn thuốc'),
      quantity: readRequiredInteger(body, 'quantity', errors, { min: 1, max: MAXIMUM_QUANTITY }),
      recipient: readRequiredText(body, 'recipient', errors),
      reason: readRequiredText(body, 'reason', errors),
    };
    check(errors);
    return this.purchases.issue(currentUser, input, originOf(request, currentUser));
  }

  @Get('medicine-issues')
  listIssues(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.purchases.listIssues(currentUser, readFilterUnit(query));
  }
}
