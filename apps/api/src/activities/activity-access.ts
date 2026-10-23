import { Injectable } from '@nestjs/common';
import type { ContentScopeType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { levelOf, type SchoolLevelCode } from '@school-management/shared';
import { sql, type ExpressionBuilder, type Kysely, type Transaction } from 'kysely';
import { CurrentUser, type OrganizationScope } from '../authentication/current-user.js';
import type { RequestBody } from '../common/request-fields.js';
import { isUuid } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phân quyền dữ liệu hoạt động và truyền thông (P14, BR-64, BR-69, BR-72; YCTD-78): giáo viên theo lớp được phân công;
// vai trò văn phòng theo quyền P14 trong phạm vi đơn vị; phụ huynh chỉ thấy nội dung đã công bố trong phạm vi của con
const TEACHER_ROLES = ['VT-07', 'VT-08'];
const PARENT_ROLE = 'VT-14';
export const NO_ID = '00000000-0000-0000-0000-000000000000';
export const MAXIMUM_TITLE = 200;
export const MAXIMUM_CONTENT = 5000;

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Trẻ của phụ huynh đang học kèm lớp hiện tại, dùng xác định phạm vi công bố
export interface GuardianChild {
  child_id: string;
  full_name: string;
  org_unit_id: string;
  class_id: string | null;
  grade_level: string | null;
  school_level: string | null;
}

// Tập đơn vị, lớp, trẻ mà một người được xem nội dung đã công bố (BR-69)
export interface AudienceScope {
  wholeSchool: boolean;
  unitIds: string[];
  classIds: string[];
  childIds: string[];
  // Cấp các con đang học (DT-19 phần 19e), lọc tin tức theo cấp nhận; không có (nhân sự) là không lọc theo cấp
  levels?: SchoolLevelCode[] | null;
}

@Injectable()
export class ActivityAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  // Phạm vi của vai trò văn phòng theo một quyền, bỏ giáo viên và phụ huynh
  async officeScope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(this.officeUser(currentUser), permission);
  }

  // Phạm vi theo quyền gồm cả giáo viên được gán ở đơn vị (thư viện, ngoại khóa), bỏ phụ huynh
  async staffScope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(currentUser, permission);
  }

  async canOffice(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    return covers(await this.officeScope(currentUser, permission), orgUnitId);
  }

  async canStaff(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    return covers(await this.staffScope(currentUser, permission), orgUnitId);
  }

  async assertStaff(currentUser: CurrentUser, permission: string, orgUnitId: string, message: string): Promise<void> {
    if (!(await this.canStaff(currentUser, permission, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  isTeacher(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some((assignment) => TEACHER_ROLES.includes(assignment.role_code));
  }

  isParent(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some((assignment) => assignment.role_code === PARENT_ROLE);
  }

  // Lớp giáo viên đang được phân công (chủ nhiệm hoặc bộ môn)
  async teacherClassIds(database: Executor, currentUser: CurrentUser, homeroomOnly = false): Promise<string[]> {
    if (!this.isTeacher(currentUser)) {
      return [];
    }
    let query = database
      .selectFrom('class_staff_assignments')
      .select('class_id')
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active');
    if (homeroomOnly) {
      query = query.where('assignment_role', '=', 'homeroom');
    }
    return [...new Set((await query.execute()).map((row) => row.class_id))];
  }

  async guardianChildren(database: Executor, currentUser: CurrentUser): Promise<GuardianChild[]> {
    if (!this.isParent(currentUser)) {
      return [];
    }
    return database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('children', 'children.id', 'child_guardians.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'children.org_unit_id',
        'class_enrollments.class_id',
        'classes.grade_level',
        'classes.school_level',
      ])
      .where('guardians.user_id', '=', currentUser.id)
      .where('children.status', '=', 'active')
      .execute();
  }

  // Người xem nội dung đã công bố: phụ huynh theo con; nhân sự theo đơn vị được gán và lớp được phân công
  async audience(database: Executor, currentUser: CurrentUser): Promise<AudienceScope> {
    const children = await this.guardianChildren(database, currentUser);
    const staff = new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter((assignment) => assignment.role_code !== PARENT_ROLE),
    });
    const staffUnits =
      staff.description.assignments.length > 0
        ? await this.organizationScopes.resolveAnyRole(staff)
        : { wholeSchool: false, orgUnitIds: [] };
    const teacherClasses = await this.teacherClassIds(database, currentUser);
    return {
      wholeSchool: staffUnits.wholeSchool,
      unitIds: [...new Set([...staffUnits.orgUnitIds, ...children.map((child) => child.org_unit_id)])],
      classIds: [
        ...new Set([
          ...teacherClasses,
          ...children.map((child) => child.class_id).filter((id): id is string => id !== null),
        ]),
      ],
      childIds: children.map((child) => child.child_id),
      // Người chỉ là phụ huynh xem tin theo cấp con học; người có vai trò nhân sự xem mọi cấp như cũ
      levels:
        staff.description.assignments.length > 0
          ? null
          : [...new Set(children.map((child) => levelOf(child.school_level)))],
    };
  }

  private officeUser(currentUser: CurrentUser): CurrentUser {
    return new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter(
        (assignment) => !TEACHER_ROLES.includes(assignment.role_code) && assignment.role_code !== PARENT_ROLE,
      ),
    });
  }
}

export function covers(scope: OrganizationScope, orgUnitId: string): boolean {
  return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
}

export function unitIdsOrNone(scope: OrganizationScope): string[] {
  return scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [NO_ID];
}

// Điều kiện xem nội dung đã công bố theo phạm vi (BR-69); bảng có cột scope_type, scope_id, org_unit_id
export function audienceCondition(audience: AudienceScope) {
  return <Table extends 'news' | 'library_items' | 'coloring_pages'>(
    expression: ExpressionBuilder<SchoolYearDatabase, Table>,
  ) => {
    const reference = expression as unknown as ExpressionBuilder<SchoolYearDatabase, 'news'>;
    const none = (ids: string[]) => (ids.length > 0 ? ids : [NO_ID]);
    return reference.or([
      reference('scope_type', '=', 'school'),
      ...(audience.wholeSchool ? [reference('scope_type', '=', 'unit')] : []),
      reference.and([reference('scope_type', '=', 'unit'), reference('scope_id', 'in', none(audience.unitIds))]),
      reference.and([reference('scope_type', '=', 'class'), reference('scope_id', 'in', none(audience.classIds))]),
      reference.and([reference('scope_type', '=', 'child'), reference('scope_id', 'in', none(audience.childIds))]),
    ]) as never;
  };
}

// Điều kiện xem tin tức theo cấp nhận (DT-19 phần 19e): tin không ghi cấp là của mọi cấp; tin có cấp chỉ hiện với phụ huynh có
// con học ở một trong các cấp đó. Nhân sự (levels không có) không lọc theo cấp
export function newsLevelCondition(levels: readonly SchoolLevelCode[] | null | undefined) {
  return (expression: ExpressionBuilder<SchoolYearDatabase, 'news'>) =>
    levels
      ? expression.or([
          sql<boolean>`cardinality(news.audience_levels) = 0`,
          sql<boolean>`news.audience_levels && ${[...levels]}::text[]`,
        ])
      : expression.lit(true);
}

// Kiểm tra một bản ghi đã công bố có thuộc phạm vi xem của người dùng
export function inAudience(audience: AudienceScope, scopeType: ContentScopeType, scopeId: string | null): boolean {
  switch (scopeType) {
    case 'school':
      return true;
    case 'unit':
      return audience.wholeSchool || audience.unitIds.includes(scopeId ?? '');
    case 'class':
      return audience.classIds.includes(scopeId ?? '');
    case 'child':
      return audience.childIds.includes(scopeId ?? '');
  }
}

// Đọc chữ bắt buộc hoặc tùy chọn có giới hạn độ dài
export function readText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { required?: boolean; maximum?: number } = {},
): string | null | undefined {
  const value = body?.[field];
  const maximum = options.maximum ?? MAXIMUM_TITLE;
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (options.required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return value === undefined ? undefined : null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return undefined;
  }
  if (value.trim().length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return undefined;
  }
  return value.trim();
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return undefined;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

// Phạm vi công bố: school không kèm mã; unit, class, child kèm mã đơn vị, lớp hoặc trẻ (BR-69)
export function readScope(
  body: RequestBody,
  errors: FieldError[],
  required: boolean,
): { scope_type: ContentScopeType; scope_id: string | null } | undefined {
  const scopeType = body?.scope_type;
  if (scopeType === undefined) {
    if (required) {
      errors.push({ field: 'scope_type', message: 'Bắt buộc chọn phạm vi công bố' });
    }
    return undefined;
  }
  if (scopeType !== 'school' && scopeType !== 'unit' && scopeType !== 'class' && scopeType !== 'child') {
    errors.push({ field: 'scope_type', message: 'Phạm vi là school, unit, class hoặc child' });
    return undefined;
  }
  if (scopeType === 'school') {
    return { scope_type: 'school', scope_id: null };
  }
  const scopeId = body?.scope_id;
  if (!isUuid(scopeId)) {
    errors.push({ field: 'scope_id', message: 'Bắt buộc chọn đơn vị, lớp hoặc trẻ của phạm vi' });
    return undefined;
  }
  return { scope_type: scopeType, scope_id: scopeId };
}

export function check(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readReason(body: RequestBody, field = 'reason'): string {
  const errors: FieldError[] = [];
  const reason = readText(body, field, errors, { required: true, maximum: 1000 });
  check(errors);
  return reason ?? '';
}
