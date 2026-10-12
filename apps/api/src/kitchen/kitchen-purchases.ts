import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import { settlePurchaseOrderPayable } from '../finance/payables.js';
import type { MarketPurchaseStatus, SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { KitchenAccess } from './kitchen-access.js';
import { check, queryUuid, readDate, readMoney, readQuantity, readText } from './kitchen-fields.js';
import { KitchenMealsService } from './kitchen-meals.js';

// Phiếu đi chợ (P12-09; BR-60, BR-63, BR-28; QT-05; YCTD-76). Bếp lập phiếu theo nhà cung cấp, mỗi dòng ghi kèm định
// lượng của ngày (số cần theo thực đơn đã công bố và số suất) để thấy chênh lệch giữa định lượng và thực mua (BR-60).
// Xác nhận nhập thì tồn nguyên liệu tăng và phiếu chuyển sang chờ thanh toán: đó là đề nghị thanh toán gửi kế toán; kế
// toán lập phiếu chi theo QT-05 (BR-28), không lập phiếu chi tự động, rồi gắn phiếu chi đã phát hành vào phiếu đi chợ
const STATUSES: MarketPurchaseStatus[] = ['draft', 'received', 'cancelled'];
const MAXIMUM_LINES = 100;

interface LineInput {
  ingredient_id: string;
  quantity: number;
  unit_price: number;
}

@Injectable()
export class KitchenPurchasesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly meals: KitchenMealsService,
  ) {}

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string; status: MarketPurchaseStatus | null; awaitingPayment: boolean },
  ) {
    const { database } = await this.currentSchoolYear.require();
    // Kế toán lập phiếu chi cũng xem được để thanh toán đề nghị
    if (!(await this.access.can(currentUser, PERMISSION_CODES.paymentManage, filter.orgUnitId))) {
      await this.access.assertRead(currentUser, filter.orgUnitId);
    }
    const rows = await database
      .selectFrom('market_purchases')
      .innerJoin('food_suppliers', 'food_suppliers.id', 'market_purchases.supplier_id')
      .leftJoin('payments', 'payments.id', 'market_purchases.payment_id')
      .select([
        'market_purchases.id',
        'market_purchases.code',
        'market_purchases.org_unit_id',
        'market_purchases.purchase_date',
        'market_purchases.supplier_id',
        'food_suppliers.name as supplier_name',
        'market_purchases.total_amount',
        'market_purchases.status',
        'market_purchases.payment_status',
        'market_purchases.payment_id',
        'payments.code as payment_code',
        'market_purchases.received_at',
        'market_purchases.note',
      ])
      .where('market_purchases.org_unit_id', '=', filter.orgUnitId)
      .$if(filter.status !== null, (query) => query.where('market_purchases.status', '=', filter.status ?? 'draft'))
      .$if(filter.awaitingPayment, (query) => query.where('market_purchases.payment_status', '=', 'awaiting_payment'))
      .orderBy('market_purchases.purchase_date', 'desc')
      .orderBy('market_purchases.code', 'desc')
      .execute();
    return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
  }

  async create(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      purchase_date: string;
      supplier_id: string;
      note: string | null;
      items: LineInput[];
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, input.org_unit_id);
    const supplier = await database
      .selectFrom('food_suppliers')
      .select(['id', 'org_unit_id', 'status'])
      .where('id', '=', input.supplier_id)
      .executeTakeFirst();
    if (!supplier || supplier.org_unit_id !== input.org_unit_id || supplier.status !== 'active') {
      throw validationError([{ field: 'supplier_id', message: 'Nhà cung cấp phải thuộc đơn vị và đang dùng' }]);
    }
    const ids = [...new Set(input.items.map((item) => item.ingredient_id))];
    const ingredients = await database
      .selectFrom('ingredients')
      .select('id')
      .where('id', 'in', ids)
      .where('org_unit_id', '=', input.org_unit_id)
      .where('status', '=', 'active')
      .execute();
    if (ingredients.length !== ids.length) {
      throw validationError([{ field: 'items', message: 'Nguyên liệu phải thuộc đơn vị và đang dùng' }]);
    }
    // Định lượng của ngày đi chợ theo thực đơn đã công bố và số suất hiện có (BR-60)
    const planned = new Map(
      (await this.meals.dailyNorms(database, input.org_unit_id, input.purchase_date)).ingredients.map((row) => [
        row.ingredient_id,
        row.required_quantity,
      ]),
    );
    const lines = input.items.map((item) => ({
      ...item,
      planned_quantity: planned.get(item.ingredient_id) ?? null,
      amount: Math.round(item.quantity * item.unit_price),
    }));
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const created = await database.transaction().execute(async (transaction) => {
      const purchase = await transaction
        .insertInto('market_purchases')
        .values({
          code: await nextDocumentCode(transaction, 'market_purchase', 'PDC'),
          org_unit_id: input.org_unit_id,
          purchase_date: input.purchase_date,
          supplier_id: input.supplier_id,
          total_amount: total,
          note: input.note,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('market_purchase_items')
        .values(lines.map((line) => ({ ...line, purchase_id: purchase.id })))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'market_purchases',
        entityId: purchase.id,
        action: 'create',
        before: null,
        after: { ...purchase, items: lines },
      });
      return purchase;
    });
    return this.detailOf(database, created.id);
  }

  async detail(currentUser: CurrentUser, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const purchase = await this.find(database, id);
    if (!(await this.access.can(currentUser, PERMISSION_CODES.paymentManage, purchase.org_unit_id))) {
      await this.access.assertRead(currentUser, purchase.org_unit_id);
    }
    return this.detailOf(database, id);
  }

  // CT-119: xác nhận nhập thì tồn nguyên liệu tăng và có đề nghị thanh toán (phiếu chờ thanh toán, kế toán được báo)
  async receive(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const purchase = await this.find(database, id);
    await this.access.assertManage(currentUser, purchase.org_unit_id);
    if (purchase.status !== 'draft') {
      throw ruleViolationError('P12-09', 'Chỉ xác nhận nhập được phiếu nháp');
    }
    await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('market_purchases')
        .set({
          status: 'received',
          payment_status: 'awaiting_payment',
          received_by: origin.actorUserId,
          received_at: new Date(),
        })
        .where('id', '=', id)
        .where('status', '=', 'draft')
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('P12-09', 'Phiếu đã được xử lý');
      }
      const items = await transaction
        .selectFrom('market_purchase_items')
        .select(['ingredient_id', 'quantity'])
        .where('purchase_id', '=', id)
        .execute();
      for (const item of items) {
        await transaction
          .updateTable('ingredients')
          .set({ current_stock: sql`current_stock + ${item.quantity}`, updated_at: new Date() })
          .where('id', '=', item.ingredient_id)
          .execute();
      }
      await queueNotification(transaction, {
        orgUnitId: purchase.org_unit_id,
        templateCode: 'market_purchase_payment_request',
        title: 'Đề nghị thanh toán phiếu đi chợ',
        body: `Phiếu đi chợ ${purchase.code} ngày ${purchase.purchase_date} chờ thanh toán ${Number(purchase.total_amount).toLocaleString('vi-VN')} đồng`,
        targetType: 'market_purchases',
        targetId: id,
        recipients: [{ roleCode: 'VT-04', orgUnitId: purchase.org_unit_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: purchase.org_unit_id,
        entityName: 'market_purchases',
        entityId: id,
        action: 'update',
        before: { status: 'draft', payment_status: null },
        after: { status: 'received', payment_status: 'awaiting_payment', stock_in: items },
      });
    });
    return this.detailOf(database, id);
  }

  async cancel(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const purchase = await this.find(database, id);
    await this.access.assertManage(currentUser, purchase.org_unit_id);
    if (purchase.status !== 'draft') {
      throw ruleViolationError('P12-09', 'Chỉ hủy được phiếu nháp; phiếu đã nhập không hủy');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.updateTable('market_purchases').set({ status: 'cancelled' }).where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: purchase.org_unit_id,
        entityName: 'market_purchases',
        entityId: id,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'cancelled' },
      });
    });
    return this.detailOf(database, id);
  }

  // Kế toán gắn phiếu chi đã phát hành (lập theo QT-05) để đóng đề nghị thanh toán; số tiền phải bằng tổng phiếu đi chợ
  async linkPayment(currentUser: CurrentUser, id: string, paymentId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const purchase = await this.find(database, id);
    await this.access.assert(
      currentUser,
      PERMISSION_CODES.paymentManage,
      purchase.org_unit_id,
      'Bạn không có quyền lập phiếu chi của đơn vị này',
    );
    if (purchase.payment_status !== 'awaiting_payment') {
      throw ruleViolationError('BR-28', 'Phiếu đi chợ không ở trạng thái chờ thanh toán');
    }
    const payment = await database
      .selectFrom('payments')
      .select(['id', 'code', 'amount', 'status'])
      .where('id', '=', paymentId)
      .executeTakeFirst();
    if (!payment) {
      throw notFoundError('Không tìm thấy phiếu chi', 'payment');
    }
    if (payment.status !== 'issued') {
      throw ruleViolationError('BR-28', 'Phiếu chi phải đã phát hành');
    }
    if (Number(payment.amount) !== Number(purchase.total_amount)) {
      throw ruleViolationError('BR-28', 'Số tiền phiếu chi phải bằng tổng phiếu đi chợ');
    }
    const used = await database
      .selectFrom('market_purchases')
      .select('id')
      .where('payment_id', '=', paymentId)
      .executeTakeFirst();
    if (used) {
      throw ruleViolationError('BR-28', 'Phiếu chi đã gắn với phiếu đi chợ khác');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('market_purchases')
        .set({
          payment_status: 'paid',
          payment_id: paymentId,
          paid_linked_by: origin.actorUserId,
          paid_linked_at: new Date(),
        })
        .where('id', '=', id)
        .execute();
      // Công nợ phải trả của phiếu đi chợ (P06-07, YCTD-82) cũng thành đã trả
      await settlePurchaseOrderPayable(transaction, id, paymentId, new Date(), 'market_purchase');
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: purchase.org_unit_id,
        entityName: 'market_purchases',
        entityId: id,
        action: 'update',
        before: { payment_status: 'awaiting_payment' },
        after: { payment_status: 'paid', payment_id: paymentId, payment_code: payment.code },
      });
    });
    return this.detailOf(database, id);
  }

  private async find(database: Kysely<SchoolYearDatabase>, id: string) {
    const purchase = await database.selectFrom('market_purchases').selectAll().where('id', '=', id).executeTakeFirst();
    if (!purchase) {
      throw notFoundError('Không tìm thấy phiếu đi chợ', 'market_purchase');
    }
    return purchase;
  }

  private async detailOf(database: Kysely<SchoolYearDatabase>, id: string) {
    const purchase = await database
      .selectFrom('market_purchases')
      .innerJoin('food_suppliers', 'food_suppliers.id', 'market_purchases.supplier_id')
      .leftJoin('payments', 'payments.id', 'market_purchases.payment_id')
      .selectAll('market_purchases')
      .select(['food_suppliers.name as supplier_name', 'payments.code as payment_code'])
      .where('market_purchases.id', '=', id)
      .executeTakeFirstOrThrow();
    const items = await database
      .selectFrom('market_purchase_items')
      .innerJoin('ingredients', 'ingredients.id', 'market_purchase_items.ingredient_id')
      .select([
        'market_purchase_items.id',
        'market_purchase_items.ingredient_id',
        'ingredients.name as ingredient_name',
        'ingredients.unit',
        'ingredients.current_stock',
        'market_purchase_items.quantity',
        'market_purchase_items.planned_quantity',
        'market_purchase_items.unit_price',
        'market_purchase_items.amount',
      ])
      .where('market_purchase_items.purchase_id', '=', id)
      .orderBy('ingredients.name')
      .execute();
    return {
      ...purchase,
      total_amount: Number(purchase.total_amount),
      items: items.map((item) => {
        const quantity = Number(item.quantity);
        const planned = item.planned_quantity === null ? null : Number(item.planned_quantity);
        return {
          ...item,
          quantity,
          planned_quantity: planned,
          // Chênh lệch giữa thực mua và định lượng của ngày (BR-60)
          difference: planned === null ? null : Math.round((quantity - planned) * 1000) / 1000,
          current_stock: Number(item.current_stock),
          unit_price: Number(item.unit_price),
          amount: Number(item.amount),
        };
      }),
    };
  }
}

function readLines(body: RequestBody, errors: FieldError[]): LineInput[] {
  const value = body?.items;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAXIMUM_LINES) {
    errors.push({ field: 'items', message: `Phiếu có từ 1 đến ${MAXIMUM_LINES} dòng nguyên liệu` });
    return [];
  }
  const lines: LineInput[] = [];
  value.forEach((item: RequestBody, index) => {
    const ingredientId = readRequiredUuid(item, 'ingredient_id', errors, `Dòng ${index + 1}: chọn nguyên liệu`);
    const quantity = readQuantity(item?.quantity, `items.${index}.quantity`, errors);
    const unitPrice = readMoney(item?.unit_price, `items.${index}.unit_price`, errors);
    if (ingredientId && quantity !== null && unitPrice !== null) {
      lines.push({ ingredient_id: ingredientId, quantity, unit_price: unitPrice });
    }
  });
  if (new Set(lines.map((line) => line.ingredient_id)).size !== lines.length) {
    errors.push({ field: 'items', message: 'Mỗi nguyên liệu chỉ một dòng' });
  }
  return lines;
}

@Controller()
export class KitchenPurchasesController {
  constructor(private readonly purchases: KitchenPurchasesService) {}

  @Get('market-purchases')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const status = query.status as MarketPurchaseStatus | undefined;
    if (status !== undefined && !STATUSES.includes(status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là draft, received hoặc cancelled' }]);
    }
    return this.purchases.list(currentUser, {
      orgUnitId: queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      status: status ?? null,
      awaitingPayment: query.payment_status === 'awaiting_payment',
    });
  }

  @Post('market-purchases')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      purchase_date: readDate(body, 'purchase_date', errors, true) ?? '',
      supplier_id: readRequiredUuid(body, 'supplier_id', errors, 'Bắt buộc chọn nhà cung cấp'),
      note: readText(body, 'note', errors),
      items: readLines(body, errors),
    };
    check(errors);
    return this.purchases.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('market-purchases/:id')
  detail(
    @Param('id', uuidParameter('Mã phiếu đi chợ không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchases.detail(currentUser, id);
  }

  @Post('market-purchases/:id/receive')
  @HttpCode(200)
  receive(
    @Param('id', uuidParameter('Mã phiếu đi chợ không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchases.receive(currentUser, id, originOf(request, currentUser));
  }

  @Post('market-purchases/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter('Mã phiếu đi chợ không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.purchases.cancel(currentUser, id, originOf(request, currentUser));
  }

  @Post('market-purchases/:id/link-payment')
  @HttpCode(200)
  linkPayment(
    @Param('id', uuidParameter('Mã phiếu đi chợ không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const paymentId = readRequiredUuid(body, 'payment_id', errors, 'Bắt buộc chọn phiếu chi');
    check(errors);
    return this.purchases.linkPayment(currentUser, id, paymentId, originOf(request, currentUser));
  }
}
