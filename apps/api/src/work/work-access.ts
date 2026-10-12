import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, WorkPeriodType } from '@school-management/database';
import { ApplicationError, type FieldError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import { CurrentUser, type OrganizationScope } from '../authentication/current-user.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phân quyền phân hệ công việc, kế hoạch, đánh giá (P09; BR-01, BR-46; YCTD-81). Người giao việc, lập kế hoạch, đánh
// giá thao tác trong phạm vi đơn vị được gán theo quyền; Ban Giám hiệu (VT-02, VT-15) chỉ xem trong phạm vi đơn vị được
// gán (VT-02 toàn trường). Việc cá nhân và phiếu đánh giá của mình chỉ chính nhân sự đó xem
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const WORK_VIEW_ROLES = ['VT-02', 'VT-15'];
export const PERIOD_TYPES: WorkPeriodType[] = ['month', 'term', 'year'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAXIMUM_WORK_TEXT = 2000;

export interface StaffOfUnit {
  id: string;
  org_unit_id: string;
  full_name: string;
  status: 'active' | 'terminated';
  user_id: string | null;
}

@Injectable()
export class WorkAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  // Hồ sơ nhân sự gắn với tài khoản đang đăng nhập; việc cá nhân và phiếu đánh giá đều gắn với hồ sơ này
  async ownStaff(database: Executor, currentUser: CurrentUser): Promise<StaffOfUnit> {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id'])
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  async findOwnStaff(database: Executor, currentUser: CurrentUser): Promise<StaffOfUnit | undefined> {
    return database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id'])
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
  }

  async staff(database: Executor, staffId: string): Promise<StaffOfUnit> {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  scope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(currentUser, permission);
  }

  async canManage(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.scope(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  async assertManage(currentUser: CurrentUser, permission: string, orgUnitId: string, message: string) {
    if (!(await this.canManage(currentUser, permission, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  // Phạm vi xem của Ban Giám hiệu theo đơn vị được gán
  async viewerScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    const viewer = new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter((assignment) =>
        WORK_VIEW_ROLES.includes(assignment.role_code),
      ),
    });
    if (viewer.description.assignments.length === 0) {
      return { wholeSchool: false, orgUnitIds: [] };
    }
    return this.organizationScopes.resolveAnyRole(viewer);
  }

  // Gộp phạm vi theo quyền quản lý và phạm vi xem của Ban Giám hiệu
  async readScope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    const [managed, viewed] = await Promise.all([this.scope(currentUser, permission), this.viewerScope(currentUser)]);
    if (managed.wholeSchool || viewed.wholeSchool) {
      return { wholeSchool: true, orgUnitIds: [] };
    }
    return { wholeSchool: false, orgUnitIds: [...new Set([...managed.orgUnitIds, ...viewed.orgUnitIds])] };
  }
}

export function inScope(scope: OrganizationScope, orgUnitId: string): boolean {
  return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
}

export function hasAnyScope(scope: OrganizationScope): boolean {
  return scope.wholeSchool || scope.orgUnitIds.length > 0;
}

// Đọc ngày dạng YYYY-MM-DD; trống trả null
export function readWorkDate(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
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

// Đọc chữ có giới hạn độ dài; trống trả null
export function readWorkText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { required?: boolean; maximum?: number } = {},
): string | null {
  const maximum = options.maximum ?? MAXIMUM_WORK_TEXT;
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
  if (value.trim().length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return null;
  }
  return value.trim();
}

// Kỳ theo loại: tháng YYYY-MM, học kỳ HK1, HK2, HE (hè) kèm năm học YYYY-YYYY, năm học YYYY-YYYY
const PERIOD_PATTERNS: Record<WorkPeriodType, RegExp> = {
  month: /^\d{4}-(0[1-9]|1[0-2])$/,
  term: /^(HK1|HK2|HE) \d{4}-\d{4}$/,
  year: /^\d{4}-\d{4}$/,
};

export function readPeriod(body: RequestBody, errors: FieldError[]): { type: WorkPeriodType; value: string } {
  const type = body?.period_type as WorkPeriodType;
  const value = typeof body?.period_value === 'string' ? body.period_value.trim() : '';
  if (!PERIOD_TYPES.includes(type)) {
    errors.push({ field: 'period_type', message: 'Loại kỳ là month, term hoặc year' });
    return { type: 'month', value };
  }
  if (!PERIOD_PATTERNS[type].test(value)) {
    errors.push({
      field: 'period_value',
      message:
        type === 'month'
          ? 'Kỳ tháng dạng YYYY-MM'
          : type === 'term'
            ? 'Kỳ học kỳ dạng HK1 2026-2027, HK2 2026-2027 hoặc HE 2026-2027'
            : 'Kỳ năm học dạng 2026-2027',
    });
  }
  return { type, value };
}
