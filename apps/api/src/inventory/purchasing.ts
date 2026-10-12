import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { PurchaseRequestStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import {
  check,
  InventoryAccess,
  nextStockCode,
  optionalEnumQuery,
  optionalUuidQuery,
  readDate,
  readLines,
  readMoney,
  readQuantity,
  readText,
  recordStockMovement,
} from './inventory-common.js';

// Đề nghị mua hàng và phiếu mua hàng (P13-05, P13-06; BR-28, BR-63; QT-05; YCTD-77). Mọi nhân sự lập đề nghị; đề nghị
// trình duyệt ngay theo hạn mức loại chứng từ purchase_request của đơn vị: dưới hạn mức thì Phó Hiệu trưởng của đơn vị
// hoặc Hiệu trưởng duyệt, từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức thì chỉ Hiệu trưởng; người lập không tự duyệt.
// Phiếu mua hàng chỉ lập từ đề nghị đã duyệt; nhận hàng thì tăng tồn kho; phiếu mua hàng là công nợ phải trả, chờ thanh
// toán đến khi kế toán gắn phiếu chi đã phát hành theo QT-05 (hệ thống không tự tạo phiếu chi, BR-28)
const PRINCIPAL_ROLE = 'VT-02';
const ORDER_VIEW = [PERMISSION_CODES.purchaseOrderManage, PERMISSION_CODES.paymentManage];
const REQUEST_STATUSES: PurchaseRequestStatus[] = ['pending', 'approved', 'rejected', 'ordered'];
const REQUEST_VIEWS = ['mine', 'pending', 'approved', 'all'] as const;
type RequestView = (typeof REQUEST_VIEWS)[number];

interface RequestItemInput {
  item_name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  note: string | null;
}

interface OrderItemInput {
  item_name: string;
  stock_item_id: string | null;
  quantity: number;
  unit_price: number;
}

const money = (value: string | number) => Number(value);

@Injectable()
export class PurchasingService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // ---------- Đề nghị mua hàng (P13-05) ----------

  async createRequest(
    currentUser: CurrentUser,
    input: { org_unit_id: string | null; needed_by: string; reason: string; items: RequestItemInput[] },
    origin: ChangeOrigin,
  ) {
    const scope = await this.access.requireScope(
      currentUser,
      [PERMISSION_CODES.purchaseRequestCreate],
      'Bạn không có quyền lập đề nghị mua hàng',
    );
    let orgUnitId = input.org_unit_id;
    if (!orgUnitId) {
      if (scope.wholeSchool || scope.orgUnitIds.length !== 1) {
        throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị đề nghị' }]);
      }
      orgUnitId = scope.orgUnitIds[0] ?? '';
    } else if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không lập được đề nghị mua hàng cho đơn vị này');
    }
    if (input.needed_by < this.today()) {
      throw validationError([{ field: 'needed_by', message: 'Thời hạn cần không trước hôm nay' }]);
    }
    const total = Math.round(input.items.reduce((sum, item) => sum + item.quantity * item.estimated_price, 0));
    const { database } = await this.currentSchoolYear.require();
    const unit = await database.selectFrom('org_units').select('id').where('id', '=', orgUnitId).executeTakeFirst();
    if (!unit) {
      throw validationError([{ field: 'org_unit_id', message: 'Không tìm thấy đơn vị' }]);
    }
    const requiresPrincipal = await this.requiresPrincipal(database, orgUnitId, total);
    const created = await database.transaction().execute(async (transaction) => {
      const request = await transaction
        .insertInto('purchase_requests')
        .values({
          code: await nextDocumentCode(transaction, 'purchase_request', 'DNMH'),
          org_unit_id: orgUnitId,
          requester_id: currentUser.id,
          requester_name: origin.actorName,
          needed_by: input.needed_by,
          reason: input.reason,
          total_amount: total,
          requires_principal: requiresPrincipal,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('purchase_request_items')
        .values(input.items.map((item) => ({ ...item, request_id: request.id })))
        .execute();
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: 'purchase_request_pending',
        title: 'Có đề nghị mua hàng cần phê duyệt',
        body: `${request.code} của ${origin.actorName}: ${total} đồng. ${input.reason}`,
        targetType: 'purchase_requests',
        targetId: request.id,
        recipients: await this.approverRecipients(transaction, orgUnitId, requiresPrincipal),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'purchase_requests',
        entityId: request.id,
        action: 'create',
        before: null,
        after: { ...request, items: input.items },
      });
      return request;
    });
    return this.readRequest(currentUser, created.id);
  }

  async listRequests(
    currentUser: CurrentUser,
    filter: { view: RequestView; status: PurchaseRequestStatus | null; orgUnitId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('purchase_requests').selectAll().orderBy('created_at', 'desc');
    if (filter.view === 'mine') {
      query = query.where('requester_id', '=', currentUser.id);
    } else {
      const permissions =
        filter.view === 'pending'
          ? [PERMISSION_CODES.purchaseRequestApprove]
          : filter.view === 'approved'
            ? [PERMISSION_CODES.purchaseOrderManage]
            : [PERMISSION_CODES.purchaseRequestApprove, PERMISSION_CODES.purchaseOrderManage];
      const scope = await this.access.requireScope(
        currentUser,
        permissions,
        'Bạn không có quyền xem đề nghị mua hàng này',
      );
      if (!scope.wholeSchool) {
        query = query.where('org_unit_id', 'in', scope.orgUnitIds);
      }
      if (filter.view === 'pending') {
        // Người duyệt thấy đề nghị chờ duyệt của người khác; Phó Hiệu trưởng chỉ thấy đề nghị dưới hạn mức
        query = query.where('status', '=', 'pending').where('requester_id', '<>', currentUser.id);
        if (!this.isPrincipal(currentUser)) {
          query = query.where('requires_principal', '=', false);
        }
      } else if (filter.view === 'approved') {
        query = query.where('status', '=', 'approved');
      }
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    return (await query.execute()).map((row) => ({ ...row, total_amount: money(row.total_amount) }));
  }

  async readRequest(currentUser: CurrentUser, requestId: string) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.loadRequest(database, requestId);
    if (
      request.requester_id !== currentUser.id &&
      !(await this.access.canAccess(
        currentUser,
        [PERMISSION_CODES.purchaseRequestApprove, ...ORDER_VIEW],
        request.org_unit_id,
      ))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem đề nghị mua hàng này');
    }
    const items = await database
      .selectFrom('purchase_request_items')
      .selectAll()
      .where('request_id', '=', requestId)
      .orderBy('item_name')
      .execute();
    return {
      ...request,
      total_amount: money(request.total_amount),
      items: items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        estimated_price: money(item.estimated_price),
      })),
    };
  }

  async decideRequest(
    currentUser: CurrentUser,
    requestId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.loadRequest(database, requestId);
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.purchaseRequestApprove],
      request.org_unit_id,
      'Bạn không có quyền duyệt đề nghị mua hàng của đơn vị này',
    );
    if (request.status !== 'pending') {
      throw ruleViolationError('BR-63', 'Đề nghị mua hàng này không chờ duyệt');
    }
    if (request.requires_principal && !this.isPrincipal(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Đề nghị từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức, cần Hiệu trưởng duyệt',
      );
    }
    if (request.requester_id === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người lập đề nghị');
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('purchase_requests')
        .set({
          status: decision.approve ? 'approved' : 'rejected',
          approved_by: origin.actorUserId,
          approved_at: this.clock.now(),
          reject_reason: decision.approve ? null : decision.reason,
        })
        .where('id', '=', requestId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-63', 'Đề nghị mua hàng đã được người khác xử lý');
      }
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: decision.approve ? 'purchase_request_approved' : 'purchase_request_rejected',
        title: decision.approve ? 'Đề nghị mua hàng đã được duyệt' : 'Đề nghị mua hàng bị từ chối',
        body: `${request.code}${decision.reason ? `. Lý do: ${decision.reason}` : ''}`,
        targetType: 'purchase_requests',
        targetId: requestId,
        recipients: [
          { userId: request.requester_id, channel: 'in_app' },
          ...(decision.approve
            ? [{ roleCode: 'VT-11', orgUnitId: request.org_unit_id, channel: 'in_app' as const }]
            : []),
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'purchase_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: {
          status: decision.approve ? 'approved' : 'rejected',
          total_amount: money(request.total_amount),
          reason: decision.reason,
        },
      });
    });
    return this.readRequest(currentUser, requestId);
  }

  // ---------- Phiếu mua hàng (P13-06) ----------

  async createOrder(
    currentUser: CurrentUser,
    input: {
      request_id: string;
      supplier_id: string;
      order_date: string;
      note: string | null;
      items: OrderItemInput[];
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.loadRequest(database, input.request_id);
    await this.assertOrderManage(currentUser, request.org_unit_id);
    if (request.status !== 'approved') {
      throw ruleViolationError(
        'BR-63',
        request.status === 'ordered'
          ? 'Đề nghị này đã được lập phiếu mua hàng'
          : 'Chỉ lập phiếu mua hàng từ đề nghị đã được duyệt',
      );
    }
    if (input.order_date > this.today()) {
      throw validationError([{ field: 'order_date', message: 'Ngày mua không sau hôm nay' }]);
    }
    const supplier = await database
      .selectFrom('suppliers')
      .select(['id', 'status'])
      .where('id', '=', input.supplier_id)
      .where('org_unit_id', '=', request.org_unit_id)
      .executeTakeFirst();
    if (!supplier || supplier.status !== 'active') {
      throw validationError([{ field: 'supplier_id', message: 'Nhà cung cấp không thuộc đơn vị hoặc đã ngừng dùng' }]);
    }
    const stockItemIds = input.items.map((item) => item.stock_item_id).filter((id): id is string => id !== null);
    if (stockItemIds.length > 0) {
      const found = await database
        .selectFrom('stock_items')
        .select('id')
        .where('id', 'in', stockItemIds)
        .where('org_unit_id', '=', request.org_unit_id)
        .where('status', '=', 'active')
        .execute();
      if (found.length !== new Set(stockItemIds).size) {
        throw validationError([{ field: 'items', message: 'Mặt hàng kho không thuộc đơn vị hoặc đã ngừng dùng' }]);
      }
    }
    const items = input.items.map((item) => ({ ...item, amount: Math.round(item.quantity * item.unit_price) }));
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const created = await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('purchase_requests')
        .set({ status: 'ordered' })
        .where('id', '=', request.id)
        .where('status', '=', 'approved')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-63', 'Đề nghị này đã được lập phiếu mua hàng');
      }
      const order = await conflictOnDuplicate(
        transaction
          .insertInto('purchase_orders')
          .values({
            code: await nextDocumentCode(transaction, 'purchase_order', 'PMH'),
            org_unit_id: request.org_unit_id,
            request_id: request.id,
            supplier_id: input.supplier_id,
            order_date: input.order_date,
            total_amount: total,
            note: input.note,
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Đề nghị này đã được lập phiếu mua hàng',
        'request_id',
      );
      await transaction
        .insertInto('purchase_order_items')
        .values(items.map((item) => ({ ...item, order_id: order.id })))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'purchase_orders',
        entityId: order.id,
        action: 'create',
        before: null,
        after: { ...order, items },
      });
      return order;
    });
    return this.readOrder(currentUser, created.id);
  }

  async listOrders(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      status: 'ordered' | 'received' | null;
      paymentStatus: 'awaiting_payment' | 'paid' | null;
    },
  ) {
    const scope = await this.access.requireScope(currentUser, ORDER_VIEW, 'Bạn không có quyền xem phiếu mua hàng');
    const { database } = await this.currentSchoolYear.require();
    let query = this.orderQuery(database).orderBy('purchase_orders.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('purchase_orders.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('purchase_orders.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('purchase_orders.status', '=', filter.status);
    }
    if (filter.paymentStatus) {
      query = query.where('purchase_orders.payment_status', '=', filter.paymentStatus);
    }
    return (await query.execute()).map((row) => ({ ...row, total_amount: money(row.total_amount) }));
  }

  async readOrder(currentUser: CurrentUser, orderId: string) {
    const { database } = await this.currentSchoolYear.require();
    const order = await this.orderQuery(database).where('purchase_orders.id', '=', orderId).executeTakeFirst();
    if (!order) {
      throw notFoundError('Không tìm thấy phiếu mua hàng', 'purchase_order');
    }
    await this.access.assertUnit(currentUser, ORDER_VIEW, order.org_unit_id, 'Bạn không được xem phiếu mua hàng này');
    const items = await database
      .selectFrom('purchase_order_items')
      .leftJoin('stock_items', 'stock_items.id', 'purchase_order_items.stock_item_id')
      .selectAll('purchase_order_items')
      .select(['stock_items.code as stock_item_code', 'stock_items.unit as stock_unit'])
      .where('order_id', '=', orderId)
      .orderBy('purchase_order_items.item_name')
      .execute();
    return {
      ...order,
      total_amount: money(order.total_amount),
      items: items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: money(item.unit_price),
        amount: money(item.amount),
        received_qty: Number(item.received_qty),
      })),
    };
  }

  // Nhận đủ hàng một lần: mặt hàng có gắn mã kho thì ghi phiếu nhập kho theo đơn giá mua
  async receiveOrder(currentUser: CurrentUser, orderId: string, receivedDate: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const order = await database.selectFrom('purchase_orders').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order) {
      throw notFoundError('Không tìm thấy phiếu mua hàng', 'purchase_order');
    }
    await this.assertOrderManage(currentUser, order.org_unit_id);
    if (order.status !== 'ordered') {
      throw ruleViolationError('BR-62', 'Phiếu mua hàng này đã nhận hàng');
    }
    if (receivedDate < order.order_date || receivedDate > this.today()) {
      throw validationError([{ field: 'received_date', message: 'Ngày nhận từ ngày mua đến hôm nay' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('purchase_orders')
        .set({ status: 'received', received_by: origin.actorUserId, received_at: this.clock.now() })
        .where('id', '=', orderId)
        .where('status', '=', 'ordered')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-62', 'Phiếu mua hàng này đã nhận hàng');
      }
      const items = await transaction
        .selectFrom('purchase_order_items')
        .selectAll()
        .where('order_id', '=', orderId)
        .execute();
      const stocked = items.filter((item) => item.stock_item_id !== null);
      const code = stocked.length > 0 ? await nextStockCode(transaction, 'receipt') : null;
      for (const item of items) {
        if (item.stock_item_id && code) {
          await recordStockMovement(transaction, {
            stockItemId: item.stock_item_id,
            type: 'receipt',
            quantity: Number(item.quantity),
            unitPrice: money(item.unit_price),
            transactionDate: receivedDate,
            referenceType: 'purchase_orders',
            referenceId: orderId,
            note: `Nhận hàng theo phiếu mua ${order.code}`,
            actorUserId: origin.actorUserId,
            code,
          });
        }
        await transaction
          .updateTable('purchase_order_items')
          .set({ received_qty: item.quantity })
          .where('id', '=', item.id)
          .execute();
      }
      await queueNotification(transaction, {
        orgUnitId: order.org_unit_id,
        templateCode: 'purchase_order_received',
        title: 'Phiếu mua hàng đã nhận hàng, chờ thanh toán',
        body: `${order.code}: ${money(order.total_amount)} đồng`,
        targetType: 'purchase_orders',
        targetId: orderId,
        recipients: [{ roleCode: 'VT-04', orgUnitId: order.org_unit_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: order.org_unit_id,
        entityName: 'purchase_orders',
        entityId: orderId,
        action: 'update',
        before: { status: 'ordered' },
        after: { status: 'received', stock_receipt_code: code },
      });
    });
    return this.readOrder(currentUser, orderId);
  }

  // Kế toán lập phiếu chi theo QT-05 rồi gắn vào phiếu mua hàng; phiếu chi phải đã phát hành, cùng đơn vị, đúng số tiền
  async linkPayment(currentUser: CurrentUser, orderId: string, paymentId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const order = await database.selectFrom('purchase_orders').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order) {
      throw notFoundError('Không tìm thấy phiếu mua hàng', 'purchase_order');
    }
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.paymentManage],
      order.org_unit_id,
      'Bạn không có quyền ghi thanh toán phiếu mua hàng của đơn vị này',
    );
    if (order.payment_status === 'paid') {
      throw ruleViolationError('BR-28', 'Phiếu mua hàng đã được thanh toán');
    }
    const payment = await database
      .selectFrom('payments')
      .select(['id', 'code', 'org_unit_id', 'status', 'amount'])
      .where('id', '=', paymentId)
      .executeTakeFirst();
    if (!payment) {
      throw notFoundError('Không tìm thấy phiếu chi', 'payment');
    }
    if (payment.org_unit_id !== order.org_unit_id || payment.status !== 'issued') {
      throw ruleViolationError('BR-28', 'Phiếu chi phải đã phát hành và cùng đơn vị với phiếu mua hàng');
    }
    if (money(payment.amount) !== money(order.total_amount)) {
      throw ruleViolationError('BR-28', 'Số tiền phiếu chi khác giá trị phiếu mua hàng', [
        { field: 'payment_id', message: `Phiếu mua hàng ${money(order.total_amount)} đồng` },
      ]);
    }
    await database.transaction().execute(async (transaction) => {
      await conflictOnDuplicate(
        transaction
          .updateTable('purchase_orders')
          .set({ payment_status: 'paid', payment_id: paymentId })
          .where('id', '=', orderId)
          .execute(),
        'Phiếu chi này đã gắn với phiếu mua hàng khác',
        'payment_id',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: order.org_unit_id,
        entityName: 'purchase_orders',
        entityId: orderId,
        action: 'update',
        before: { payment_status: 'awaiting_payment' },
        after: { payment_status: 'paid', payment_id: paymentId, payment_code: payment.code },
      });
    });
    return this.readOrder(currentUser, orderId);
  }

  // ---------- Dùng chung ----------

  private orderQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('purchase_orders')
      .innerJoin('suppliers', 'suppliers.id', 'purchase_orders.supplier_id')
      .innerJoin('purchase_requests', 'purchase_requests.id', 'purchase_orders.request_id')
      .leftJoin('payments', 'payments.id', 'purchase_orders.payment_id')
      .selectAll('purchase_orders')
      .select([
        'suppliers.name as supplier_name',
        'purchase_requests.code as request_code',
        'payments.code as payment_code',
      ]);
  }

  private async assertOrderManage(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.purchaseOrderManage],
      orgUnitId,
      'Bạn không có quyền lập phiếu mua hàng của đơn vị này',
    );
  }

  private async loadRequest(database: Kysely<SchoolYearDatabase>, requestId: string) {
    const request = await database
      .selectFrom('purchase_requests')
      .selectAll()
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị mua hàng', 'purchase_request');
    }
    return request;
  }

  // BR-63: hạn mức đề nghị mua hàng của đơn vị; chưa đặt hạn mức thì cần Hiệu trưởng
  private async requiresPrincipal(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    amount: number,
  ): Promise<boolean> {
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
        assignment.permissions.includes(PERMISSION_CODES.purchaseRequestApprove),
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

function readRequestItems(body: RequestBody, errors: FieldError[]): RequestItemInput[] {
  return readLines(body, 'items', errors).map((line, index) => {
    const lineErrors: FieldError[] = [];
    const item = {
      item_name: readText(line, 'item_name', lineErrors, true) ?? '',
      quantity: readQuantity(line, 'quantity', lineErrors),
      unit: readText(line, 'unit', lineErrors, true) ?? '',
      estimated_price: readMoney(line, 'estimated_price', lineErrors) ?? 0,
      note: readText(line, 'note', lineErrors, false),
    };
    if (item.estimated_price === 0 && lineErrors.length === 0) {
      lineErrors.push({ field: 'estimated_price', message: 'Đơn giá dự kiến lớn hơn 0' });
    }
    errors.push(...lineErrors.map((error) => ({ ...error, field: `items[${index}].${error.field}` })));
    return item;
  });
}

function readOrderItems(body: RequestBody, errors: FieldError[]): OrderItemInput[] {
  return readLines(body, 'items', errors).map((line, index) => {
    const lineErrors: FieldError[] = [];
    const item = {
      item_name: readText(line, 'item_name', lineErrors, true) ?? '',
      stock_item_id: readOptionalUuid(line, 'stock_item_id', lineErrors) ?? null,
      quantity: readQuantity(line, 'quantity', lineErrors),
      unit_price: readMoney(line, 'unit_price', lineErrors) ?? 0,
    };
    errors.push(...lineErrors.map((error) => ({ ...error, field: `items[${index}].${error.field}` })));
    return item;
  });
}

@Controller()
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Post('purchase-requests')
  @HttpCode(201)
  createRequest(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readOptionalUuid(body, 'org_unit_id', errors) ?? null,
      needed_by: readDate(body, 'needed_by', errors, true) ?? '',
      reason: readText(body, 'reason', errors, true) ?? '',
      items: readRequestItems(body, errors),
    };
    check(errors);
    return this.purchasing.createRequest(currentUser, input, originOf(request, currentUser));
  }

  @Get('purchase-requests')
  listRequests(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.purchasing.listRequests(currentUser, {
      view: optionalEnumQuery(query.view, 'view', REQUEST_VIEWS) ?? 'mine',
      status: optionalEnumQuery(query.status, 'status', REQUEST_STATUSES),
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
    });
  }

  @Get('purchase-requests/:id')
  readRequest(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchasing.readRequest(currentUser, requestId);
  }

  @Post('purchase-requests/:id/approve')
  @HttpCode(200)
  approveRequest(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchasing.decideRequest(
      currentUser,
      requestId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('purchase-requests/:id/reject')
  @HttpCode(200)
  rejectRequest(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, true);
    check(errors);
    return this.purchasing.decideRequest(
      currentUser,
      requestId,
      { approve: false, reason },
      originOf(request, currentUser),
    );
  }

  @Post('purchase-orders')
  @HttpCode(201)
  createOrder(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      request_id: readRequiredUuid(body, 'request_id', errors, 'Bắt buộc chọn đề nghị mua hàng đã duyệt'),
      supplier_id: readRequiredUuid(body, 'supplier_id', errors, 'Bắt buộc chọn nhà cung cấp'),
      order_date: readDate(body, 'order_date', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
      items: readOrderItems(body, errors),
    };
    check(errors);
    return this.purchasing.createOrder(currentUser, input, originOf(request, currentUser));
  }

  @Get('purchase-orders')
  listOrders(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.purchasing.listOrders(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      status: optionalEnumQuery(query.status, 'status', ['ordered', 'received'] as const),
      paymentStatus: optionalEnumQuery(query.payment_status, 'payment_status', ['awaiting_payment', 'paid'] as const),
    });
  }

  @Get('purchase-orders/:id')
  readOrder(
    @Param('id', uuidParameter('Mã phiếu mua hàng không hợp lệ')) orderId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchasing.readOrder(currentUser, orderId);
  }

  @Post('purchase-orders/:id/receive')
  @HttpCode(200)
  receiveOrder(
    @Param('id', uuidParameter('Mã phiếu mua hàng không hợp lệ')) orderId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const receivedDate = readDate(body, 'received_date', errors, true) ?? '';
    check(errors);
    return this.purchasing.receiveOrder(currentUser, orderId, receivedDate, originOf(request, currentUser));
  }

  @Post('purchase-orders/:id/payment')
  @HttpCode(200)
  linkPayment(
    @Param('id', uuidParameter('Mã phiếu mua hàng không hợp lệ')) orderId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const paymentId = readRequiredUuid(body, 'payment_id', errors, 'Bắt buộc chọn phiếu chi đã phát hành');
    check(errors);
    return this.purchasing.linkPayment(currentUser, orderId, paymentId, originOf(request, currentUser));
  }
}
