import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { PayableSourceType, PayableStatus, SchoolYearDatabase } from '@school-management/database';
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
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  isUuid,
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
  optionalEnumQuery,
  optionalUuidQuery,
  readDate,
  readEnum,
  readMoney,
  readText,
} from '../inventory/inventory-common.js';
import { assertDateOpen } from './fiscal-period-lock.js';

// Công nợ phải trả nhà cung cấp (P06-07; BR-28, BR-36; YCTD-82). Ghi nhận từ phiếu mua hàng đang chờ thanh toán của kho
// (P13-07), phiếu mua thuốc (P10-09) hoặc lập tay theo chứng từ của nhà cung cấp; theo dõi hạn thanh toán, quá hạn, tổng
// còn phải trả theo nhà cung cấp. Trả bằng phiếu chi đã phát hành cùng đơn vị, đúng số tiền (lập phiếu chi theo QT-05);
// phiếu mua hàng gắn phiếu chi thì công nợ của phiếu đó cũng thành đã trả và ngược lại. Phiếu đi chợ của bếp (P12)
// nối vào khi phần bếp có bảng phiếu đi chợ (ghi trong YCTD-82)
const VIEW_PERMISSIONS = [PERMISSION_CODES.payableManage, 'P06.view'];
const SOURCE_TYPES: readonly PayableSourceType[] = [
  'manual',
  'purchase_order',
  'medicine_purchase_order',
  'market_purchase',
];
const STATUSES: readonly PayableStatus[] = ['open', 'paid', 'cancelled'];
const SEQUENCE = 'payable';
const RULE = 'P06-07';

interface PayableInput {
  sourceType: PayableSourceType;
  sourceId: string | null;
  orgUnitId: string | null;
  supplierId: string | null;
  payeeName: string | null;
  documentRef: string | null;
  description: string | null;
  amount: number | null;
  documentDate: string | null;
  dueDate: string;
}

@Injectable()
export class PayablesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.payableManage],
      orgUnitId,
      'Bạn không có quyền ghi công nợ phải trả của đơn vị này',
    );
  }

  async list(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      status: PayableStatus | null;
      supplierId: string | null;
      overdueOnly: boolean;
    },
  ) {
    const scope = await this.access.requireScope(
      currentUser,
      VIEW_PERMISSIONS,
      'Bạn không có quyền xem công nợ phải trả',
    );
    const { database } = await this.currentSchoolYear.require();
    let query = this.query(database).orderBy('payables.due_date').orderBy('payables.code');
    if (!scope.wholeSchool) {
      query = query.where('payables.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('payables.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('payables.status', '=', filter.status);
    }
    if (filter.supplierId) {
      query = query.where('payables.supplier_id', '=', filter.supplierId);
    }
    const today = this.today();
    const rows = (await query.execute())
      .map((row) => this.toView(row, today))
      .filter((row) => !filter.overdueOnly || row.overdue_days > 0);
    const open = rows.filter((row) => row.status === 'open');
    const byPayee = new Map<
      string,
      { payee_name: string; open_amount: number; overdue_amount: number; count: number }
    >();
    for (const row of open) {
      const key = row.supplier_id ?? `name:${row.payee_name}`;
      const entry = byPayee.get(key) ?? { payee_name: row.payee_name, open_amount: 0, overdue_amount: 0, count: 0 };
      entry.open_amount += row.amount;
      entry.overdue_amount += row.overdue_days > 0 ? row.amount : 0;
      entry.count += 1;
      byPayee.set(key, entry);
    }
    return {
      rows,
      payees: [...byPayee.values()].sort((left, right) => right.open_amount - left.open_amount),
      totals: {
        open_amount: open.reduce((sum, row) => sum + row.amount, 0),
        overdue_amount: open.filter((row) => row.overdue_days > 0).reduce((sum, row) => sum + row.amount, 0),
        paid_amount: rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0),
      },
    };
  }

  // Chứng từ mua chưa ghi công nợ phải trả: phiếu mua hàng chờ thanh toán, phiếu mua thuốc; kèm nhà cung cấp đang dùng
  async sources(currentUser: CurrentUser, orgUnitId: string) {
    await this.assertManage(currentUser, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const purchaseOrders = await database
      .selectFrom('purchase_orders')
      .innerJoin('suppliers', 'suppliers.id', 'purchase_orders.supplier_id')
      .leftJoin('payables', (join) =>
        join.onRef('payables.source_id', '=', 'purchase_orders.id').on('payables.source_type', '=', 'purchase_order'),
      )
      .select([
        'purchase_orders.id',
        'purchase_orders.code',
        'purchase_orders.order_date',
        'purchase_orders.total_amount',
        'purchase_orders.status',
        'suppliers.id as supplier_id',
        'suppliers.name as supplier_name',
      ])
      .where('purchase_orders.org_unit_id', '=', orgUnitId)
      .where('purchase_orders.payment_status', '=', 'awaiting_payment')
      .where('payables.id', 'is', null)
      .orderBy('purchase_orders.order_date')
      .execute();
    const medicineOrders = await database
      .selectFrom('medicine_purchase_orders')
      .innerJoin('pharmacies', 'pharmacies.id', 'medicine_purchase_orders.pharmacy_id')
      .leftJoin('payables', (join) =>
        join
          .onRef('payables.source_id', '=', 'medicine_purchase_orders.id')
          .on('payables.source_type', '=', 'medicine_purchase_order'),
      )
      .select([
        'medicine_purchase_orders.id',
        'medicine_purchase_orders.code',
        'medicine_purchase_orders.order_date',
        'medicine_purchase_orders.total_amount',
        'pharmacies.name as pharmacy_name',
      ])
      .where('medicine_purchase_orders.org_unit_id', '=', orgUnitId)
      .where('payables.id', 'is', null)
      .orderBy('medicine_purchase_orders.order_date')
      .execute();
    // Phiếu đi chợ của bếp đã nhận hàng, chờ thanh toán (YCTD-76)
    const marketPurchases = await database
      .selectFrom('market_purchases')
      .innerJoin('food_suppliers', 'food_suppliers.id', 'market_purchases.supplier_id')
      .leftJoin('payables', (join) =>
        join.onRef('payables.source_id', '=', 'market_purchases.id').on('payables.source_type', '=', 'market_purchase'),
      )
      .select([
        'market_purchases.id',
        'market_purchases.code',
        'market_purchases.purchase_date',
        'market_purchases.total_amount',
        'food_suppliers.name as supplier_name',
      ])
      .where('market_purchases.org_unit_id', '=', orgUnitId)
      .where('market_purchases.status', '=', 'received')
      .where('market_purchases.payment_status', '=', 'awaiting_payment')
      .where('payables.id', 'is', null)
      .orderBy('market_purchases.purchase_date')
      .execute();
    const suppliers = await database
      .selectFrom('suppliers')
      .select(['id', 'name', 'payment_terms'])
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'active')
      .orderBy('name')
      .execute();
    return {
      purchase_orders: purchaseOrders.map((row) => ({ ...row, total_amount: Number(row.total_amount) })),
      medicine_orders: medicineOrders.map((row) => ({ ...row, total_amount: Math.round(Number(row.total_amount)) })),
      market_purchases: marketPurchases.map((row) => ({ ...row, total_amount: Number(row.total_amount) })),
      suppliers,
    };
  }

  async create(currentUser: CurrentUser, input: PayableInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const values = await this.resolveSource(database, input);
    await this.assertManage(currentUser, values.org_unit_id);
    if (values.document_date > this.today()) {
      throw validationError([{ field: 'document_date', message: 'Ngày chứng từ không sau hôm nay' }]);
    }
    if (input.dueDate < values.document_date) {
      throw validationError([{ field: 'due_date', message: 'Hạn thanh toán không trước ngày chứng từ' }]);
    }
    await assertDateOpen(database, values.org_unit_id, values.document_date, 'ghi công nợ phải trả');
    try {
      const id = await database.transaction().execute(async (transaction) => {
        const code = await nextDocumentCode(transaction, SEQUENCE, 'CNP');
        const created = await transaction
          .insertInto('payables')
          .values({ ...values, code, due_date: input.dueDate, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: values.org_unit_id,
          entityName: 'payables',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created.id;
      });
      return this.read(database, id);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Chứng từ này đã ghi công nợ phải trả', [
          { field: 'source_id', message: 'Đã ghi' },
        ]);
      }
      throw error;
    }
  }

  // Lấy nhà cung cấp, số tiền, ngày chứng từ từ phiếu nguồn; lập tay thì dùng dữ liệu nhập
  private async resolveSource(database: Kysely<SchoolYearDatabase>, input: PayableInput) {
    if (input.sourceType === 'purchase_order') {
      const order = await database
        .selectFrom('purchase_orders')
        .innerJoin('suppliers', 'suppliers.id', 'purchase_orders.supplier_id')
        .select([
          'purchase_orders.org_unit_id',
          'purchase_orders.code',
          'purchase_orders.order_date',
          'purchase_orders.total_amount',
          'purchase_orders.payment_status',
          'suppliers.id as supplier_id',
          'suppliers.name as supplier_name',
        ])
        .where('purchase_orders.id', '=', input.sourceId ?? '')
        .executeTakeFirst();
      if (!order) {
        throw notFoundError('Không tìm thấy phiếu mua hàng', 'purchase_order');
      }
      if (order.payment_status === 'paid') {
        throw ruleViolationError(RULE, 'Phiếu mua hàng đã được thanh toán, không ghi công nợ phải trả');
      }
      return {
        org_unit_id: order.org_unit_id,
        supplier_id: order.supplier_id,
        payee_name: order.supplier_name,
        source_type: input.sourceType,
        source_id: input.sourceId,
        document_ref: order.code,
        description: input.description ?? `Phiếu mua hàng ${order.code}`,
        amount: Number(order.total_amount),
        document_date: order.order_date,
      };
    }
    if (input.sourceType === 'medicine_purchase_order') {
      const order = await database
        .selectFrom('medicine_purchase_orders')
        .innerJoin('pharmacies', 'pharmacies.id', 'medicine_purchase_orders.pharmacy_id')
        .select([
          'medicine_purchase_orders.org_unit_id',
          'medicine_purchase_orders.code',
          'medicine_purchase_orders.order_date',
          'medicine_purchase_orders.total_amount',
          'pharmacies.name as pharmacy_name',
        ])
        .where('medicine_purchase_orders.id', '=', input.sourceId ?? '')
        .executeTakeFirst();
      if (!order) {
        throw notFoundError('Không tìm thấy phiếu mua thuốc', 'medicine_purchase_order');
      }
      return {
        org_unit_id: order.org_unit_id,
        supplier_id: null,
        payee_name: order.pharmacy_name,
        source_type: input.sourceType,
        source_id: input.sourceId,
        document_ref: order.code,
        description: input.description ?? `Phiếu mua thuốc ${order.code}`,
        // Phiếu mua thuốc lưu tiền có phần lẻ; công nợ làm tròn đến đồng
        amount: Math.round(Number(order.total_amount)),
        document_date: order.order_date,
      };
    }
    if (input.sourceType === 'market_purchase') {
      const purchase = await database
        .selectFrom('market_purchases')
        .innerJoin('food_suppliers', 'food_suppliers.id', 'market_purchases.supplier_id')
        .select([
          'market_purchases.org_unit_id',
          'market_purchases.code',
          'market_purchases.purchase_date',
          'market_purchases.total_amount',
          'market_purchases.status',
          'market_purchases.payment_status',
          'food_suppliers.name as supplier_name',
        ])
        .where('market_purchases.id', '=', input.sourceId ?? '')
        .executeTakeFirst();
      if (!purchase) {
        throw notFoundError('Không tìm thấy phiếu đi chợ', 'market_purchase');
      }
      if (purchase.status !== 'received' || purchase.payment_status !== 'awaiting_payment') {
        throw ruleViolationError(RULE, 'Chỉ ghi công nợ phải trả cho phiếu đi chợ đã nhận hàng và đang chờ thanh toán');
      }
      return {
        org_unit_id: purchase.org_unit_id,
        supplier_id: null,
        payee_name: purchase.supplier_name,
        source_type: input.sourceType,
        source_id: input.sourceId,
        document_ref: purchase.code,
        description: input.description ?? `Phiếu đi chợ ${purchase.code}`,
        amount: Number(purchase.total_amount),
        document_date: purchase.purchase_date,
      };
    }
    const orgUnitId = input.orgUnitId ?? '';
    let payeeName = input.payeeName;
    if (input.supplierId) {
      const supplier = await database
        .selectFrom('suppliers')
        .select(['id', 'name', 'org_unit_id', 'status'])
        .where('id', '=', input.supplierId)
        .executeTakeFirst();
      if (!supplier || supplier.org_unit_id !== orgUnitId || supplier.status !== 'active') {
        throw validationError([{ field: 'supplier_id', message: 'Nhà cung cấp phải đang dùng và cùng đơn vị' }]);
      }
      payeeName = supplier.name;
    }
    return {
      org_unit_id: orgUnitId,
      supplier_id: input.supplierId,
      payee_name: payeeName ?? '',
      source_type: input.sourceType,
      source_id: null,
      document_ref: input.documentRef,
      description: input.description ?? '',
      amount: input.amount ?? 0,
      document_date: input.documentDate ?? '',
    };
  }

  // Ghi đã trả bằng phiếu chi đã phát hành cùng đơn vị và đúng số tiền; phiếu chi chỉ dùng cho một công nợ
  async pay(currentUser: CurrentUser, payableId: string, paymentId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const payable = await this.load(database, payableId);
    await this.assertManage(currentUser, payable.org_unit_id);
    if (payable.status !== 'open') {
      throw ruleViolationError(RULE, 'Công nợ này đã trả hoặc đã hủy');
    }
    const payment = await database
      .selectFrom('payments')
      .select(['id', 'code', 'org_unit_id', 'status', 'amount'])
      .where('id', '=', paymentId)
      .executeTakeFirst();
    if (!payment) {
      throw notFoundError('Không tìm thấy phiếu chi', 'payment');
    }
    if (payment.org_unit_id !== payable.org_unit_id || payment.status !== 'issued') {
      throw ruleViolationError('BR-28', 'Phiếu chi phải đã phát hành và cùng đơn vị với công nợ');
    }
    if (Number(payment.amount) !== Number(payable.amount)) {
      throw ruleViolationError('BR-28', 'Số tiền phiếu chi khác số tiền công nợ', [
        { field: 'payment_id', message: `Công nợ ${Number(payable.amount)} đồng` },
      ]);
    }
    const otherPurchase = await database
      .selectFrom('market_purchases')
      .select('id')
      .where('payment_id', '=', paymentId)
      .executeTakeFirst();
    if (otherPurchase && !(payable.source_type === 'market_purchase' && otherPurchase.id === payable.source_id)) {
      throw new ApplicationError('ERR_CONFLICT', 'Phiếu chi này đã gắn với phiếu đi chợ khác', [
        { field: 'payment_id', message: 'Đã dùng' },
      ]);
    }
    const otherOrder = await database
      .selectFrom('purchase_orders')
      .select('id')
      .where('payment_id', '=', paymentId)
      .executeTakeFirst();
    if (otherOrder && !(payable.source_type === 'purchase_order' && otherOrder.id === payable.source_id)) {
      throw new ApplicationError('ERR_CONFLICT', 'Phiếu chi này đã gắn với phiếu mua hàng khác', [
        { field: 'payment_id', message: 'Đã dùng' },
      ]);
    }
    try {
      await database.transaction().execute(async (transaction) => {
        await this.markPaid(transaction, payable.id, paymentId);
        if (payable.source_type === 'purchase_order' && payable.source_id) {
          const order = await transaction
            .updateTable('purchase_orders')
            .set({ payment_status: 'paid', payment_id: paymentId })
            .where('id', '=', payable.source_id)
            .where('payment_status', '=', 'awaiting_payment')
            .returning('id')
            .executeTakeFirst();
          if (order) {
            await writeAuditLog(transaction, {
              origin,
              orgUnitId: payable.org_unit_id,
              entityName: 'purchase_orders',
              entityId: payable.source_id,
              action: 'update',
              before: { payment_status: 'awaiting_payment' },
              after: { payment_status: 'paid', payment_id: paymentId, payment_code: payment.code },
            });
          }
        }
        // Phiếu đi chợ của bếp cũng thành đã thanh toán (YCTD-76)
        if (payable.source_type === 'market_purchase' && payable.source_id) {
          const purchase = await transaction
            .updateTable('market_purchases')
            .set({
              payment_status: 'paid',
              payment_id: paymentId,
              paid_linked_by: origin.actorUserId,
              paid_linked_at: new Date(),
            })
            .where('id', '=', payable.source_id)
            .where('payment_status', '=', 'awaiting_payment')
            .returning('id')
            .executeTakeFirst();
          if (purchase) {
            await writeAuditLog(transaction, {
              origin,
              orgUnitId: payable.org_unit_id,
              entityName: 'market_purchases',
              entityId: payable.source_id,
              action: 'update',
              before: { payment_status: 'awaiting_payment' },
              after: { payment_status: 'paid', payment_id: paymentId, payment_code: payment.code },
            });
          }
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: payable.org_unit_id,
          entityName: 'payables',
          entityId: payable.id,
          action: 'update',
          before: { status: 'open' },
          after: { status: 'paid', payment_id: paymentId, payment_code: payment.code },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Phiếu chi này đã dùng để trả công nợ khác', [
          { field: 'payment_id', message: 'Đã dùng' },
        ]);
      }
      throw error;
    }
    return this.read(database, payable.id);
  }

  async cancel(currentUser: CurrentUser, payableId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const payable = await this.load(database, payableId);
    await this.assertManage(currentUser, payable.org_unit_id);
    if (payable.status !== 'open') {
      throw ruleViolationError(RULE, 'Chỉ hủy công nợ chưa trả');
    }
    await assertDateOpen(database, payable.org_unit_id, payable.document_date, 'hủy công nợ phải trả');
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payables')
        .set({ status: 'cancelled', cancel_reason: reason })
        .where('id', '=', payableId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: payable.org_unit_id,
        entityName: 'payables',
        entityId: payableId,
        action: 'update',
        before: { status: 'open' },
        after: { status: 'cancelled', cancel_reason: reason },
      });
    });
    return this.read(database, payableId);
  }

  private async markPaid(transaction: Transaction<SchoolYearDatabase>, payableId: string, paymentId: string) {
    const updated = await transaction
      .updateTable('payables')
      .set({ status: 'paid', payment_id: paymentId, paid_at: this.clock.now() })
      .where('id', '=', payableId)
      .where('status', '=', 'open')
      .returning('id')
      .executeTakeFirst();
    if (!updated) {
      throw ruleViolationError(RULE, 'Công nợ này đã trả hoặc đã hủy');
    }
  }

  private async load(database: Kysely<SchoolYearDatabase>, payableId: string) {
    const payable = await database.selectFrom('payables').selectAll().where('id', '=', payableId).executeTakeFirst();
    if (!payable) {
      throw notFoundError('Không tìm thấy công nợ phải trả', 'payable');
    }
    return payable;
  }

  private query(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('payables')
      .leftJoin('payments', 'payments.id', 'payables.payment_id')
      .selectAll('payables')
      .select(['payments.code as payment_code', 'payments.payment_date']);
  }

  private toView<Row extends { amount: string; status: PayableStatus; due_date: string }>(row: Row, today: string) {
    const overdue =
      row.status === 'open' && row.due_date < today
        ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${row.due_date}T00:00:00Z`)) / 86_400_000)
        : 0;
    return { ...row, amount: Number(row.amount), overdue_days: overdue };
  }

  private async read(database: Kysely<SchoolYearDatabase>, payableId: string) {
    return this.toView(
      await this.query(database).where('payables.id', '=', payableId).executeTakeFirstOrThrow(),
      this.today(),
    );
  }
}

// Phiếu mua hàng được gắn phiếu chi ở kho (P13-07) thì công nợ phải trả của phiếu đó cũng thành đã trả
export async function settlePurchaseOrderPayable(
  transaction: Transaction<SchoolYearDatabase>,
  orderId: string,
  paymentId: string,
  paidAt: Date,
  sourceType: PayableSourceType = 'purchase_order',
): Promise<void> {
  await transaction
    .updateTable('payables')
    .set({ status: 'paid', payment_id: paymentId, paid_at: paidAt })
    .where('source_type', '=', sourceType)
    .where('source_id', '=', orderId)
    .where('status', '=', 'open')
    .execute();
}

@Controller('payables')
export class PayablesController {
  constructor(private readonly service: PayablesService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.list(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      status: optionalEnumQuery(query.status, 'status', STATUSES),
      supplierId: optionalUuidQuery(query.supplier_id, 'supplier_id'),
      overdueOnly: query.overdue_only === 'true',
    });
  }

  @Get('sources')
  sources(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.service.sources(currentUser, orgUnitId);
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const sourceType = body?.source_type === undefined ? 'manual' : readEnum(body, 'source_type', SOURCE_TYPES, errors);
    const manual = sourceType === 'manual';
    const input: PayableInput = {
      sourceType,
      sourceId: manual ? null : readRequiredUuid(body, 'source_id', errors, 'Bắt buộc chọn chứng từ mua'),
      orgUnitId: manual ? readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị') : null,
      supplierId: manual ? (readOptionalUuid(body, 'supplier_id', errors) ?? null) : null,
      payeeName: manual ? readText(body, 'payee_name', errors, false) : null,
      documentRef: manual ? readText(body, 'document_ref', errors, false) : null,
      description: readText(body, 'description', errors, manual),
      amount: manual ? readMoney(body, 'amount', errors) : null,
      documentDate: manual ? readDate(body, 'document_date', errors, true) : null,
      dueDate: readDate(body, 'due_date', errors, true) ?? '',
    };
    if (manual && !input.supplierId && !input.payeeName) {
      errors.push({ field: 'payee_name', message: 'Chọn nhà cung cấp hoặc nhập tên người nhận tiền' });
    }
    if (manual && input.amount === 0) {
      errors.push({ field: 'amount', message: 'Số tiền lớn hơn 0' });
    }
    check(errors);
    return this.service.create(currentUser, input, originOf(request, currentUser));
  }

  @Post(':id/pay')
  @HttpCode(200)
  pay(
    @Param('id', uuidParameter('Mã công nợ không hợp lệ')) payableId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const paymentId = readRequiredUuid(body, 'payment_id', errors, 'Bắt buộc chọn phiếu chi đã phát hành');
    check(errors);
    return this.service.pay(currentUser, payableId, paymentId, originOf(request, currentUser));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter('Mã công nợ không hợp lệ')) payableId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, true) ?? '';
    check(errors);
    return this.service.cancel(currentUser, payableId, reason, originOf(request, currentUser));
  }
}
