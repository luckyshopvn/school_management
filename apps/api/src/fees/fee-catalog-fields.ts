import { ApplicationError, type FieldError } from '@school-management/server';
import type { CurrentUser } from '../authentication/current-user.js';
import type { RequestBody } from '../common/request-fields.js';

// Trường dùng chung của danh mục học phí và tài chính (YCTD-49)
const PARENT_ROLE = 'VT-14';
export const MAXIMUM_AMOUNT = 1_000_000_000_000;

// Danh mục nội bộ chỉ nhân sự xem; tài khoản chỉ có vai trò phụ huynh bị từ chối
export function assertStaff(currentUser: CurrentUser): void {
  const assignments = currentUser.description.assignments;
  if (assignments.length === 0 || assignments.every((assignment) => assignment.role_code === PARENT_ROLE)) {
    throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ nhân sự nhà trường xem được danh mục này');
  }
}

// Số tiền theo đồng, số nguyên không âm
export function readAmount(value: unknown, field: string, errors: FieldError[], minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > MAXIMUM_AMOUNT) {
    errors.push({ field, message: `Số tiền là số nguyên đồng từ ${minimum}` });
    return 0;
  }
  return value;
}

export function readEnum<Value extends string>(
  body: RequestBody,
  field: string,
  allowed: readonly Value[],
  errors: FieldError[],
  required: boolean,
): Value | undefined {
  const value = body?.[field];
  if (value === undefined && !required) {
    return undefined;
  }
  if (!allowed.includes(value as Value)) {
    errors.push({ field, message: `Giá trị là một trong: ${allowed.join(', ')}` });
    return undefined;
  }
  return value as Value;
}

export function readBoolean(body: RequestBody, field: string, errors: FieldError[]): boolean | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Giá trị là true hoặc false' });
    return undefined;
  }
  return value;
}
