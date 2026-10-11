import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, StockTransactionType } from '@school-management/database';
import { ApplicationError, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import type { Transaction } from 'kysely';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phần dùng chung của kho, tài sản và mua hàng (P13; BR-61, BR-62, BR-63; YCTD-77): phạm vi đơn vị theo quyền, đọc dữ liệu
// vào, ghi một giao dịch kho có khóa dòng mặt hàng để tồn không âm khi hai yêu cầu đồng thời
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAXIMUM_TEXT = 1000;
export const MAXIMUM_LINES = 100;

@Injectable()
export class InventoryAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  // Hợp phạm vi của nhiều quyền, bỏ vai trò phụ huynh
  async scope(currentUser: CurrentUser, permissions: string[]): Promise<OrganizationScope> {
    const units = new Set<string>();
    for (const permission of permissions) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return { wholeSchool: true, orgUnitIds: [] };
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    return { wholeSchool: false, orgUnitIds: [...units] };
  }

  async canAccess(currentUser: CurrentUser, permissions: string[], orgUnitId: string): Promise<boolean> {
    const scope = await this.scope(currentUser, permissions);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  async assertUnit(currentUser: CurrentUser, permissions: string[], orgUnitId: string, message: string) {
    if (!(await this.canAccess(currentUser, permissions, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', message, [{ field: 'org_unit_id', message: permissions.join(', ') }]);
    }
  }

  // Phạm vi để lọc danh sách; không có đơn vị nào thì từ chối
  async requireScope(currentUser: CurrentUser, permissions: string[], message: string) {
    const scope = await this.scope(currentUser, permissions);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
    return scope;
  }
}

export function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readEnum<T extends string>(
  body: RequestBody,
  field: string,
  values: readonly T[],
  errors: FieldError[],
): T {
  const value = body?.[field] as T;
  if (!values.includes(value)) {
    errors.push({ field, message: `Giá trị là ${values.join(', ')}` });
  }
  return value;
}

export function optionalUuidQuery(value: string | undefined, field: string): string | null {
  if (value !== undefined && value !== '' && !isUuid(value)) {
    throw validationError([{ field, message: 'Mã không hợp lệ' }]);
  }
  return value || null;
}

export function optionalEnumQuery<T extends string>(
  value: string | undefined,
  field: string,
  values: readonly T[],
): T | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!values.includes(value as T)) {
    throw validationError([{ field, message: `Giá trị là ${values.join(', ')}` }]);
  }
  return value as T;
}

export function readText(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return null;
  }
  if (value.trim().length > MAXIMUM_TEXT) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    return null;
  }
  return value.trim();
}

export function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

// Số lượng lớn hơn 0 (hoặc từ 0 khi cho phép), tối đa hai chữ số thập phân
export function readQuantity(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { allowZero?: boolean; required?: boolean } = {},
): number {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (options.required !== false) {
      errors.push({ field, message: 'Bắt buộc nhập số lượng' });
    }
    return 0;
  }
  const number = typeof value === 'number' ? value : Number(value);
  const valid =
    Number.isFinite(number) &&
    (options.allowZero ? number >= 0 : number > 0) &&
    number < 1_000_000_000 &&
    Math.abs(Math.round(number * 100) - number * 100) < 1e-6;
  if (!valid) {
    errors.push({
      field,
      message: options.allowZero
        ? 'Số không âm, tối đa hai chữ số thập phân'
        : 'Số lớn hơn 0, tối đa hai chữ số thập phân',
    });
    return 0;
  }
  return number;
}

// Tiền là số nguyên đồng không âm
export function readMoney(body: RequestBody, field: string, errors: FieldError[], required = true): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập số tiền' });
    }
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000_000_000) {
    errors.push({ field, message: 'Số nguyên đồng không âm' });
    return null;
  }
  return value;
}

export function readLines(body: RequestBody, field: string, errors: FieldError[]): RequestBody[] {
  const value = body?.[field];
  if (!Array.isArray(value) || value.length === 0 || value.length > MAXIMUM_LINES) {
    errors.push({ field, message: `Cần từ 1 đến ${MAXIMUM_LINES} dòng` });
    return [];
  }
  return value.map((line) => (typeof line === 'object' && line !== null ? (line as Record<string, unknown>) : {}));
}

// Cộng trừ số lượng theo phần trăm đơn vị để tránh sai số dấu phẩy động
export const roundQuantity = (value: number) => Math.round(value * 100) / 100;

const SEQUENCES: Record<StockTransactionType, { type: string; prefix: string }> = {
  opening: { type: 'stock_opening', prefix: 'TDK' },
  receipt: { type: 'stock_receipt', prefix: 'PNK' },
  issue: { type: 'stock_issue', prefix: 'PXK' },
  count_adjustment: { type: 'stock_adjustment', prefix: 'DCK' },
  carry_over: { type: 'stock_carry_over', prefix: 'CTK' },
};

export interface StockMovement {
  stockItemId: string;
  type: StockTransactionType;
  // Có dấu: nhập dương, xuất âm
  quantity: number;
  unitPrice: number | null;
  transactionDate: string;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  actorUserId: string;
  // Dùng chung một mã phiếu cho nhiều dòng của cùng phiếu
  code?: string;
}

export async function nextStockCode(transaction: Transaction<SchoolYearDatabase>, type: StockTransactionType) {
  const sequence = SEQUENCES[type];
  return nextDocumentCode(transaction, sequence.type, sequence.prefix);
}

// BR-62: tồn tính từ phiếu nhập, xuất, kiểm kê; xuất quá tồn bị từ chối
export async function recordStockMovement(transaction: Transaction<SchoolYearDatabase>, movement: StockMovement) {
  const item = await transaction
    .selectFrom('stock_items')
    .select(['id', 'name', 'unit', 'current_qty', 'status'])
    .where('id', '=', movement.stockItemId)
    .forUpdate()
    .executeTakeFirst();
  if (!item) {
    throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy mặt hàng', [
      { field: 'stock_item_id', message: movement.stockItemId },
    ]);
  }
  const current = Number(item.current_qty);
  const balance = roundQuantity(current + movement.quantity);
  if (balance < 0) {
    throw ruleViolationError(
      'BR-62',
      `Xuất vượt tồn: ${item.name} còn ${current} ${item.unit}, không xuất được ${-movement.quantity} ${item.unit}`,
      [{ field: 'quantity', message: `Tồn hiện tại ${current}` }],
    );
  }
  const code = movement.code ?? (await nextStockCode(transaction, movement.type));
  await transaction
    .updateTable('stock_items')
    .set({ current_qty: balance, updated_at: new Date() })
    .where('id', '=', item.id)
    .execute();
  return transaction
    .insertInto('stock_transactions')
    .values({
      code,
      stock_item_id: item.id,
      transaction_type: movement.type,
      quantity: movement.quantity,
      unit_price: movement.unitPrice,
      balance_after: balance,
      reference_type: movement.referenceType,
      reference_id: movement.referenceId,
      transaction_date: movement.transactionDate,
      note: movement.note,
      created_by: movement.actorUserId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
