import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { StockCountStatus } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { conflictOnDuplicate, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import {
  check,
  InventoryAccess,
  nextStockCode,
  optionalEnumQuery,
  optionalUuidQuery,
  readDate,
  readEnum,
  readLines,
  readMoney,
  readQuantity,
  readText,
  recordStockMovement,
  roundQuantity,
} from './inventory-common.js';

// Mặt hàng trong kho, nhập xuất tồn, tồn kho ban đầu, kiểm kê (P13-08, P13-09, P13-10; BR-62; LP-12; YCTD-77). Tồn tính
// từ phiếu nhập, phiếu xuất, tồn ban đầu và điều chỉnh kiểm kê; xuất vượt tồn luôn bị từ chối. Tồn ban đầu chỉ nhập cho
// mặt hàng chưa có giao dịch nào và khóa ngay khi ghi. Kiểm kê có chênh lệch lập biên bản chờ kế toán trưởng duyệt; duyệt
// thì ghi phiếu điều chỉnh theo chênh lệch, từ chối thì tồn giữ nguyên
const STOCK_VIEW = [
  PERMISSION_CODES.assetManage,
  PERMISSION_CODES.purchaseOrderManage,
  PERMISSION_CODES.stocktakeApprove,
];
const COUNT_VIEW = [PERMISSION_CODES.assetManage, PERMISSION_CODES.stocktakeApprove];
const COUNT_STATUSES: StockCountStatus[] = ['matched', 'pending', 'approved', 'rejected'];

interface StockLine {
  stock_item_id: string;
  quantity: number;
  unit_price: number | null;
}

const numeric = (value: string | number | null) => (value === null ? null : Number(value));

@Injectable()
export class StockService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // ---------- Mặt hàng ----------

  async listItems(currentUser: CurrentUser, filter: { orgUnitId: string | null; belowMinimum: boolean }) {
    const scope = await this.access.requireScope(currentUser, STOCK_VIEW, 'Bạn không có quyền xem kho');
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('stock_items').selectAll().orderBy('code');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    const items = (await query.execute()).map(formatItem);
    return filter.belowMinimum ? items.filter((item) => item.below_minimum) : items;
  }

  async saveItem(
    currentUser: CurrentUser,
    itemId: string | null,
    input: {
      org_unit_id: string;
      code: string;
      name: string;
      unit: string;
      min_qty: number;
      status: 'active' | 'inactive' | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = itemId
      ? await database.selectFrom('stock_items').selectAll().where('id', '=', itemId).executeTakeFirst()
      : undefined;
    if (itemId && !existing) {
      throw notFoundError('Không tìm thấy mặt hàng', 'stock_item');
    }
    const orgUnitId = existing?.org_unit_id ?? input.org_unit_id;
    await this.assertManage(currentUser, orgUnitId);
    return database.transaction().execute(async (transaction) => {
      const saved = await conflictOnDuplicate(
        existing
          ? transaction
              .updateTable('stock_items')
              .set({
                name: input.name,
                unit: input.unit,
                min_qty: input.min_qty,
                status: input.status ?? existing.status,
                updated_at: this.clock.now(),
              })
              .where('id', '=', existing.id)
              .returningAll()
              .executeTakeFirstOrThrow()
          : transaction
              .insertInto('stock_items')
              .values({
                org_unit_id: orgUnitId,
                code: input.code,
                name: input.name,
                unit: input.unit,
                min_qty: input.min_qty,
                created_by: origin.actorUserId,
              })
              .returningAll()
              .executeTakeFirstOrThrow(),
        'Đơn vị đã có mặt hàng cùng mã',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'stock_items',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: saved,
      });
      return formatItem(saved);
    });
  }

  // ---------- Nhập xuất (P13-08) ----------

  async listTransactions(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; stockItemId: string | null; from: string | null; to: string | null },
  ) {
    const scope = await this.access.requireScope(currentUser, STOCK_VIEW, 'Bạn không có quyền xem kho');
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('stock_transactions')
      .innerJoin('stock_items', 'stock_items.id', 'stock_transactions.stock_item_id')
      .selectAll('stock_transactions')
      .select([
        'stock_items.code as item_code',
        'stock_items.name as item_name',
        'stock_items.unit',
        'stock_items.org_unit_id',
      ])
      .orderBy('stock_transactions.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('stock_items.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('stock_items.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.stockItemId) {
      query = query.where('stock_transactions.stock_item_id', '=', filter.stockItemId);
    }
    if (filter.from) {
      query = query.where('stock_transactions.transaction_date', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('stock_transactions.transaction_date', '<=', filter.to);
    }
    return (await query.execute()).map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      balance_after: Number(row.balance_after),
      unit_price: numeric(row.unit_price),
    }));
  }

  // Một phiếu nhập hoặc xuất có nhiều dòng cùng mã phiếu; một dòng xuất vượt tồn thì cả phiếu bị từ chối (BR-62)
  async recordTransaction(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      transaction_type: 'receipt' | 'issue';
      transaction_date: string;
      note: string | null;
      lines: StockLine[];
    },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser, input.org_unit_id);
    this.assertNotFuture(input.transaction_date, 'transaction_date');
    const { database } = await this.currentSchoolYear.require();
    await this.assertItemsOfUnit(
      input.org_unit_id,
      input.lines.map((line) => line.stock_item_id),
    );
    return database.transaction().execute(async (transaction) => {
      const code = await nextStockCode(transaction, input.transaction_type);
      const rows = [];
      for (const line of input.lines) {
        rows.push(
          await recordStockMovement(transaction, {
            stockItemId: line.stock_item_id,
            type: input.transaction_type,
            quantity: input.transaction_type === 'issue' ? -line.quantity : line.quantity,
            unitPrice: line.unit_price,
            transactionDate: input.transaction_date,
            referenceType: null,
            referenceId: null,
            note: input.note,
            actorUserId: origin.actorUserId,
            code,
          }),
        );
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'stock_transactions',
        entityId: rows[0]?.id ?? '',
        action: 'create',
        before: null,
        after: { code, transaction_type: input.transaction_type, lines: input.lines },
      });
      return {
        code,
        lines: rows.map((row) => ({
          ...row,
          quantity: Number(row.quantity),
          balance_after: Number(row.balance_after),
        })),
      };
    });
  }

  // ---------- Tồn kho ban đầu (P13-10) ----------

  async recordOpening(
    currentUser: CurrentUser,
    input: { org_unit_id: string; balance_date: string; lines: StockLine[] },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser, input.org_unit_id);
    this.assertNotFuture(input.balance_date, 'balance_date');
    const itemIds = input.lines.map((line) => line.stock_item_id);
    if (new Set(itemIds).size !== itemIds.length) {
      throw validationError([{ field: 'lines', message: 'Mỗi mặt hàng chỉ nhập một dòng tồn ban đầu' }]);
    }
    await this.assertItemsOfUnit(input.org_unit_id, itemIds);
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      // Khóa các mặt hàng trước khi kiểm tra để hai lần nhập đồng thời không cùng qua
      await transaction.selectFrom('stock_items').select('id').where('id', 'in', itemIds).forUpdate().execute();
      const used = await transaction
        .selectFrom('stock_transactions')
        .innerJoin('stock_items', 'stock_items.id', 'stock_transactions.stock_item_id')
        .select(['stock_items.code', 'stock_items.name'])
        .where('stock_transactions.stock_item_id', 'in', itemIds)
        .groupBy(['stock_items.code', 'stock_items.name'])
        .execute();
      if (used.length > 0) {
        throw ruleViolationError(
          'BR-62',
          `Mặt hàng đã có giao dịch kho, không nhập tồn ban đầu được: ${used.map((row) => `${row.code} ${row.name}`).join(', ')}`,
          used.map((row) => ({ field: 'stock_item_id', message: row.code })),
        );
      }
      const code = await nextStockCode(transaction, 'opening');
      const rows = [];
      for (const line of input.lines) {
        rows.push(
          await recordStockMovement(transaction, {
            stockItemId: line.stock_item_id,
            type: 'opening',
            quantity: line.quantity,
            unitPrice: line.unit_price,
            transactionDate: input.balance_date,
            referenceType: null,
            referenceId: null,
            note: 'Tồn kho ban đầu',
            actorUserId: origin.actorUserId,
            code,
          }),
        );
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'stock_transactions',
        entityId: rows[0]?.id ?? '',
        action: 'create',
        before: null,
        after: { code, transaction_type: 'opening', lines: input.lines },
      });
      return {
        code,
        lines: rows.map((row) => ({
          ...row,
          quantity: Number(row.quantity),
          balance_after: Number(row.balance_after),
        })),
      };
    });
  }

  // ---------- Kiểm kê (P13-09) ----------

  async listCounts(currentUser: CurrentUser, filter: { orgUnitId: string | null; status: StockCountStatus | null }) {
    const scope = await this.access.requireScope(currentUser, COUNT_VIEW, 'Bạn không có quyền xem kiểm kê');
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('stock_counts').selectAll().orderBy('created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    return query.execute();
  }

  async readCount(currentUser: CurrentUser, countId: string) {
    const { database } = await this.currentSchoolYear.require();
    const count = await database.selectFrom('stock_counts').selectAll().where('id', '=', countId).executeTakeFirst();
    if (!count) {
      throw notFoundError('Không tìm thấy kỳ kiểm kê', 'stock_count');
    }
    await this.access.assertUnit(currentUser, COUNT_VIEW, count.org_unit_id, 'Bạn không có quyền xem kiểm kê này');
    const lines = await database
      .selectFrom('stock_count_lines')
      .innerJoin('stock_items', 'stock_items.id', 'stock_count_lines.stock_item_id')
      .selectAll('stock_count_lines')
      .select(['stock_items.code as item_code', 'stock_items.name as item_name', 'stock_items.unit'])
      .where('count_id', '=', countId)
      .orderBy('stock_items.code')
      .execute();
    return {
      ...count,
      lines: lines.map((line) => ({
        ...line,
        system_qty: Number(line.system_qty),
        actual_qty: Number(line.actual_qty),
        difference: Number(line.difference),
      })),
    };
  }

  // Biên bản kiểm kê: số hệ thống lấy theo tồn lúc lập; không chênh lệch thì khớp ngay, có chênh lệch thì chờ duyệt (LP-12)
  async createCount(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      count_date: string;
      note: string | null;
      lines: Array<{ stock_item_id: string; actual_qty: number; note: string | null }>;
    },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser, input.org_unit_id);
    this.assertNotFuture(input.count_date, 'count_date');
    const itemIds = input.lines.map((line) => line.stock_item_id);
    if (new Set(itemIds).size !== itemIds.length) {
      throw validationError([{ field: 'lines', message: 'Mỗi mặt hàng chỉ kiểm một dòng' }]);
    }
    await this.assertItemsOfUnit(input.org_unit_id, itemIds);
    const { database } = await this.currentSchoolYear.require();
    const created = await database.transaction().execute(async (transaction) => {
      const items = await transaction
        .selectFrom('stock_items')
        .select(['id', 'current_qty'])
        .where('id', 'in', itemIds)
        .forUpdate()
        .execute();
      const systemQuantity = new Map(items.map((item) => [item.id, Number(item.current_qty)]));
      const lines = input.lines.map((line) => {
        const system = systemQuantity.get(line.stock_item_id) ?? 0;
        return { ...line, system_qty: system, difference: roundQuantity(line.actual_qty - system) };
      });
      const hasDifference = lines.some((line) => line.difference !== 0);
      const count = await transaction
        .insertInto('stock_counts')
        .values({
          code: await nextDocumentCode(transaction, 'stock_count', 'KKK'),
          org_unit_id: input.org_unit_id,
          count_date: input.count_date,
          status: hasDifference ? 'pending' : 'matched',
          note: input.note,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('stock_count_lines')
        .values(
          lines.map((line) => ({
            count_id: count.id,
            stock_item_id: line.stock_item_id,
            system_qty: line.system_qty,
            actual_qty: line.actual_qty,
            difference: line.difference,
            note: line.note,
          })),
        )
        .execute();
      if (hasDifference) {
        await queueNotification(transaction, {
          orgUnitId: input.org_unit_id,
          templateCode: 'stock_count_pending',
          title: 'Biên bản kiểm kê có chênh lệch cần duyệt',
          body: `${count.code}: ${lines.filter((line) => line.difference !== 0).length} mặt hàng chênh lệch`,
          targetType: 'stock_counts',
          targetId: count.id,
          recipients: [{ roleCode: 'VT-05', orgUnitId: input.org_unit_id, channel: 'in_app' }],
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'stock_counts',
        entityId: count.id,
        action: 'create',
        before: null,
        after: { ...count, lines },
      });
      return count;
    });
    return this.readCount(currentUser, created.id);
  }

  async decideCount(
    currentUser: CurrentUser,
    countId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const count = await database.selectFrom('stock_counts').selectAll().where('id', '=', countId).executeTakeFirst();
    if (!count) {
      throw notFoundError('Không tìm thấy kỳ kiểm kê', 'stock_count');
    }
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.stocktakeApprove],
      count.org_unit_id,
      'Bạn không có quyền duyệt kiểm kê của đơn vị này',
    );
    if (count.created_by === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người lập biên bản kiểm kê');
    }
    if (count.status !== 'pending') {
      throw ruleViolationError('BR-62', 'Biên bản kiểm kê này không chờ duyệt');
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('stock_counts')
        .set({
          status: decision.approve ? 'approved' : 'rejected',
          decided_by: origin.actorUserId,
          decided_at: this.clock.now(),
          reject_reason: decision.approve ? null : decision.reason,
        })
        .where('id', '=', countId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-62', 'Biên bản kiểm kê đã được người khác xử lý');
      }
      if (decision.approve) {
        const lines = await transaction
          .selectFrom('stock_count_lines')
          .select(['stock_item_id', 'difference'])
          .where('count_id', '=', countId)
          .where('difference', '<>', '0')
          .execute();
        const code = await nextStockCode(transaction, 'count_adjustment');
        for (const line of lines) {
          await recordStockMovement(transaction, {
            stockItemId: line.stock_item_id,
            type: 'count_adjustment',
            quantity: Number(line.difference),
            unitPrice: null,
            transactionDate: this.today(),
            referenceType: 'stock_counts',
            referenceId: countId,
            note: `Điều chỉnh theo biên bản ${count.code}`,
            actorUserId: origin.actorUserId,
            code,
          });
        }
      }
      await queueNotification(transaction, {
        orgUnitId: count.org_unit_id,
        templateCode: decision.approve ? 'stock_count_approved' : 'stock_count_rejected',
        title: decision.approve ? 'Biên bản kiểm kê đã được duyệt' : 'Biên bản kiểm kê bị từ chối',
        body: `${count.code}${decision.reason ? `. Lý do: ${decision.reason}` : ''}`,
        targetType: 'stock_counts',
        targetId: countId,
        recipients: [{ userId: count.created_by, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: count.org_unit_id,
        entityName: 'stock_counts',
        entityId: countId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: decision.approve ? 'approved' : 'rejected', reason: decision.reason },
      });
    });
    return this.readCount(currentUser, countId);
  }

  // ---------- Dùng chung ----------

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.assetManage],
      orgUnitId,
      'Bạn không có quyền quản lý kho của đơn vị này',
    );
  }

  private assertNotFuture(date: string, field: string) {
    if (date > this.today()) {
      throw validationError([{ field, message: 'Ngày không sau hôm nay' }]);
    }
  }

  private async assertItemsOfUnit(orgUnitId: string, itemIds: string[]) {
    const { database } = await this.currentSchoolYear.require();
    const found = await database
      .selectFrom('stock_items')
      .select(['id', 'status'])
      .where('id', 'in', itemIds)
      .where('org_unit_id', '=', orgUnitId)
      .execute();
    const active = new Set(found.filter((item) => item.status === 'active').map((item) => item.id));
    const missing = itemIds.filter((id) => !active.has(id));
    if (missing.length > 0) {
      throw validationError(
        missing.map((id) => ({
          field: 'stock_item_id',
          message: `Mặt hàng ${id} không thuộc đơn vị hoặc đã ngừng dùng`,
        })),
      );
    }
  }
}

function formatItem<T extends { current_qty: string; min_qty: string }>(item: T) {
  const current = Number(item.current_qty);
  const minimum = Number(item.min_qty);
  return { ...item, current_qty: current, min_qty: minimum, below_minimum: current < minimum };
}

function readStockLines(body: RequestBody, errors: FieldError[], priceRequired: boolean): StockLine[] {
  return readLines(body, 'lines', errors).map((line, index) => {
    const lineErrors: FieldError[] = [];
    const parsed = {
      stock_item_id: readRequiredUuid(line, 'stock_item_id', lineErrors, 'Bắt buộc chọn mặt hàng'),
      quantity: readQuantity(line, 'quantity', lineErrors),
      unit_price: readMoney(line, 'unit_price', lineErrors, priceRequired),
    };
    errors.push(...lineErrors.map((error) => ({ ...error, field: `lines[${index}].${error.field}` })));
    return parsed;
  });
}

@Controller()
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('stock-items')
  listItems(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.stock.listItems(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      belowMinimum: query.below_minimum === 'true',
    });
  }

  @Post('stock-items')
  @HttpCode(201)
  createItem(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: readText(body, 'code', errors, true) ?? '',
      name: readText(body, 'name', errors, true) ?? '',
      unit: readText(body, 'unit', errors, true) ?? '',
      min_qty: readQuantity(body, 'min_qty', errors, { allowZero: true, required: false }),
      status: null,
    };
    check(errors);
    return this.stock.saveItem(currentUser, null, input, originOf(request, currentUser));
  }

  @Put('stock-items/:id')
  updateItem(
    @Param('id', uuidParameter('Mã mặt hàng không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
    }
    const input = {
      org_unit_id: '',
      code: '',
      name: readText(body, 'name', errors, true) ?? '',
      unit: readText(body, 'unit', errors, true) ?? '',
      min_qty: readQuantity(body, 'min_qty', errors, { allowZero: true, required: false }),
      status: (status as 'active' | 'inactive' | undefined) ?? null,
    };
    check(errors);
    return this.stock.saveItem(currentUser, itemId, input, originOf(request, currentUser));
  }

  @Get('stock-transactions')
  listTransactions(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const from = readDate(query, 'from', errors, false);
    const to = readDate(query, 'to', errors, false);
    check(errors);
    return this.stock.listTransactions(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      stockItemId: optionalUuidQuery(query.stock_item_id, 'stock_item_id'),
      from,
      to,
    });
  }

  @Post('stock-transactions')
  @HttpCode(201)
  recordTransaction(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const type = readEnum(body, 'transaction_type', ['receipt', 'issue'] as const, errors);
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      transaction_type: type,
      transaction_date: readDate(body, 'transaction_date', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
      lines: readStockLines(body, errors, false),
    };
    check(errors);
    return this.stock.recordTransaction(currentUser, input, originOf(request, currentUser));
  }

  @Post('stock-opening-balances')
  @HttpCode(201)
  recordOpening(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      balance_date: readDate(body, 'balance_date', errors, true) ?? '',
      lines: readStockLines(body, errors, true),
    };
    check(errors);
    return this.stock.recordOpening(currentUser, input, originOf(request, currentUser));
  }

  @Get('stock-counts')
  listCounts(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.stock.listCounts(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      status: optionalEnumQuery(query.status, 'status', COUNT_STATUSES),
    });
  }

  @Get('stock-counts/:id')
  readCount(
    @Param('id', uuidParameter('Mã kiểm kê không hợp lệ')) countId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stock.readCount(currentUser, countId);
  }

  @Post('stock-counts')
  @HttpCode(201)
  createCount(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const lines = readLines(body, 'lines', errors).map((line, index) => {
      const lineErrors: FieldError[] = [];
      const parsed = {
        stock_item_id: readRequiredUuid(line, 'stock_item_id', lineErrors, 'Bắt buộc chọn mặt hàng'),
        actual_qty: readQuantity(line, 'actual_qty', lineErrors, { allowZero: true }),
        note: readText(line, 'note', lineErrors, false),
      };
      errors.push(...lineErrors.map((error) => ({ ...error, field: `lines[${index}].${error.field}` })));
      return parsed;
    });
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      count_date: readDate(body, 'count_date', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
      lines,
    };
    check(errors);
    return this.stock.createCount(currentUser, input, originOf(request, currentUser));
  }

  @Post('stock-counts/:id/approve')
  @HttpCode(200)
  approveCount(
    @Param('id', uuidParameter('Mã kiểm kê không hợp lệ')) countId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stock.decideCount(
      currentUser,
      countId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('stock-counts/:id/reject')
  @HttpCode(200)
  rejectCount(
    @Param('id', uuidParameter('Mã kiểm kê không hợp lệ')) countId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, true);
    check(errors);
    return this.stock.decideCount(currentUser, countId, { approve: false, reason }, originOf(request, currentUser));
  }
}
