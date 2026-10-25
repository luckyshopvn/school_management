import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, currentTenant, type FieldError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import type { NotificationRecipient } from '../common/notification-queue.js';
import type { RequestBody } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phần dùng chung của tuyển dụng (P18; YCTD-87): phạm vi đơn vị theo quyền P18 (bỏ vai trò phụ huynh), đọc dữ liệu vào,
// giới hạn số yêu cầu theo địa chỉ mạng cho các điểm cuối công khai không cần tài khoản
export const LONG_TEXT = 5000;
export const SHORT_TEXT = 200;
export const PHONE_PATTERN = /^0\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class RecruitmentAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  // Hợp phạm vi của nhiều quyền
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
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  async requireScope(currentUser: CurrentUser, permissions: string[], message: string) {
    const scope = await this.scope(currentUser, permissions);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
    return scope;
  }
}

// Giới hạn số yêu cầu mỗi cửa sổ thời gian theo khóa (địa chỉ mạng và nhóm điểm cuối), giữ trong bộ nhớ của máy chủ
@Injectable()
export class PublicRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  check(rawKey: string, limit: number, windowMilliseconds: number, now: number): void {
    // Mỗi trường một bộ đếm riêng (DT-SaaS phần S1b)
    const key = `${currentTenant()?.code ?? ''}:${rawKey}`;
    if (this.windows.size > 10_000) {
      for (const [entry, window] of this.windows) {
        if (now - window.start >= windowMilliseconds) {
          this.windows.delete(entry);
        }
      }
    }
    const window = this.windows.get(key);
    if (!window || now - window.start >= windowMilliseconds) {
      this.windows.set(key, { start: now, count: 1 });
      return;
    }
    window.count += 1;
    if (window.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.start + windowMilliseconds - now) / 1000));
      throw new ApplicationError(
        'ERR_RATE_LIMIT',
        `Bạn thao tác quá nhiều lần, vui lòng thử lại sau ${retryAfterSeconds} giây`,
        [],
        retryAfterSeconds,
      );
    }
  }
}

export function readString(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { required: boolean; max?: number },
): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (options.required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return null;
  }
  const max = options.max ?? SHORT_TEXT;
  if (value.trim().length > max) {
    errors.push({ field, message: `Tối đa ${max} ký tự` });
    return null;
  }
  return value.trim();
}

export function readDateValue(body: RequestBody, field: string, errors: FieldError[], required: boolean) {
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

export function readPhone(body: RequestBody, errors: FieldError[]): string {
  const phone = readString(body, 'phone', errors, { required: true, max: 20 });
  if (phone !== null && !PHONE_PATTERN.test(phone)) {
    errors.push({ field: 'phone', message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' });
  }
  return phone ?? '';
}

export function readEmail(body: RequestBody, errors: FieldError[]): string | null {
  const email = readString(body, 'email', errors, { required: false, max: 200 });
  if (email !== null && !EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', message: 'Thư điện tử không hợp lệ' });
  }
  return email;
}

export function readGender(body: RequestBody, errors: FieldError[]): 'male' | 'female' | null {
  const value = body?.gender;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value !== 'male' && value !== 'female') {
    errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
    return null;
  }
  return value;
}

// Người nhận thông báo theo vai trò: nhân sự (VT-06) của đơn vị và của Trường chính
export async function hrRecipients(
  executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  orgUnitId: string,
): Promise<NotificationRecipient[]> {
  const root = await executor
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirst();
  return [
    { roleCode: 'VT-06', orgUnitId, channel: 'in_app' },
    ...(root && root.id !== orgUnitId ? [{ roleCode: 'VT-06', orgUnitId: root.id, channel: 'in_app' as const }] : []),
  ];
}
