import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import { CurrentUser, type OrganizationScope } from '../authentication/current-user.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { isGuardianOf } from '../finance/receivables.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phân quyền dùng chung của phân hệ tương tác và đồ bị mất (P15, P02-11; BR-72; YCTD-79): quản lý đơn vị theo quyền và
// phạm vi đơn vị (không tính vai trò giáo viên, phụ huynh); giáo viên theo lớp được phân công; phụ huynh theo con mình
const TEACHER_ROLES = ['VT-07', 'VT-08'];
const PARENT_ROLE = 'VT-14';

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface InteractionChild {
  id: string;
  org_unit_id: string;
  full_name: string;
  class_id: string | null;
  class_name: string | null;
}

@Injectable()
export class InteractionAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  async findChild(database: Executor, childId: string): Promise<InteractionChild> {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'class_enrollments.class_id',
        'classes.name as class_name',
      ])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy hồ sơ trẻ', 'child');
    }
    return child;
  }

  isGuardianOf(database: Executor, childId: string, userId: string) {
    return isGuardianOf(database, childId, userId);
  }

  isParent(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some((assignment) => assignment.role_code === PARENT_ROLE);
  }

  // Phạm vi đơn vị của vai trò quản lý theo một quyền, bỏ vai trò giáo viên và phụ huynh
  managerScope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(this.managerUser(currentUser), permission);
  }

  async canManageUnit(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.managerScope(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  // Lớp giáo viên đang được phân công (chủ nhiệm hoặc bộ môn), chỉ khi có quyền của chức năng
  async teacherClassIds(database: Executor, currentUser: CurrentUser, permission: string): Promise<string[]> {
    const hasTeacherPermission = currentUser.description.assignments.some(
      (assignment) => TEACHER_ROLES.includes(assignment.role_code) && assignment.permissions.includes(permission),
    );
    if (!hasTeacherPermission) {
      return [];
    }
    return (
      await database
        .selectFrom('class_staff_assignments')
        .select('class_id')
        .where('staff_user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .execute()
    ).map((row) => row.class_id);
  }

  async homeroomUserIds(database: Executor, classId: string | null): Promise<string[]> {
    if (!classId) {
      return [];
    }
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select('staff_user_id')
      .where('class_id', '=', classId)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    return [...new Set(rows.map((row) => row.staff_user_id))];
  }

  // Phạm vi đơn vị theo mọi vai trò nhân sự (không tính phụ huynh); không là nhân sự thì null
  async staffScope(currentUser: CurrentUser): Promise<OrganizationScope | null> {
    const staff = new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter((assignment) => assignment.role_code !== PARENT_ROLE),
    });
    if (staff.description.assignments.length === 0) {
      return null;
    }
    return this.organizationScopes.resolveAnyRole(staff);
  }

  // Nhân sự (không tính phụ huynh) có vai trò ở đơn vị hoặc ở Trường chính
  async isStaffOfUnit(currentUser: CurrentUser, orgUnitId: string): Promise<boolean> {
    const scope = await this.staffScope(currentUser);
    return scope !== null && (scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId));
  }

  private managerUser(currentUser: CurrentUser): CurrentUser {
    return new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter(
        (assignment) => !TEACHER_ROLES.includes(assignment.role_code) && assignment.role_code !== PARENT_ROLE,
      ),
    });
  }
}

// Đọc chữ bắt buộc hoặc tùy chọn có giới hạn độ dài; trống trả null
export function readLimitedText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { required?: boolean; maximum: number },
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
  if (value.trim().length > options.maximum) {
    errors.push({ field, message: `Tối đa ${options.maximum} ký tự` });
    return null;
  }
  return value.trim();
}

export function readChoice<Value extends string>(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  choices: readonly Value[],
  fallback?: Value,
): Value {
  const value = body?.[field];
  if ((value === undefined || value === null || value === '') && fallback !== undefined) {
    return fallback;
  }
  if (typeof value !== 'string' || !choices.includes(value as Value)) {
    errors.push({ field, message: `Giá trị là ${choices.join(', ')}` });
    return choices[0] as Value;
  }
  return value as Value;
}
