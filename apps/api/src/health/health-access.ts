import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { notFoundError } from '../common/request-fields.js';
import { isGuardianOf } from '../finance/receivables.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

const TEACHER_ROLES = ['VT-07', 'VT-08'];
// Vai trò văn phòng được xem sức khỏe của trẻ trong phạm vi đơn vị (BR-53)
const HEALTH_OFFICE_ROLES = ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-09'];

export interface HealthChild {
  id: string;
  org_unit_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  class_id: string | null;
}

// Phân quyền dữ liệu sức khỏe (BR-53, YCTD-74): xem theo phạm vi xem trẻ và nhóm vai trò được xem sức khỏe; ghi theo quyền
// của phân hệ P10 trong phạm vi đơn vị của trẻ, riêng giáo viên chỉ ghi cho trẻ của lớp mình chủ nhiệm
@Injectable()
export class HealthAccess {
  constructor(
    private readonly childScope: ChildScope,
    private readonly organizationScopes: OrganizationScopes,
  ) {}

  async findChild(database: Kysely<SchoolYearDatabase>, childId: string): Promise<HealthChild> {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'class_enrollments.class_id',
      ])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy hồ sơ trẻ', 'child');
    }
    return child;
  }

  async assertCanRead(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string) {
    if (!this.childScope.canSeeHealth(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem dữ liệu sức khỏe của trẻ');
    }
    await this.childScope.assertCanRead(currentUser, database, childId);
    const child = await this.findChild(database, childId);
    // Giáo viên bộ môn không xem sức khỏe; giáo viên chủ nhiệm chỉ xem trẻ của lớp mình (BR-53)
    if (
      !(await this.officeCanAccess(currentUser, child.org_unit_id)) &&
      !(await isGuardianOf(database, childId, currentUser.id)) &&
      !(await this.isHomeroom(database, currentUser, child.class_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem dữ liệu sức khỏe của trẻ');
    }
    return child;
  }

  async assertCanWrite(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    childId: string,
    permission: string,
  ): Promise<HealthChild> {
    const child = await this.findChild(database, childId);
    if (await this.canWriteUnit(currentUser, permission, child.org_unit_id)) {
      return child;
    }
    if (currentUser.hasPermission(permission) && (await this.isHomeroom(database, currentUser, child.class_id))) {
      return child;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền ghi dữ liệu sức khỏe của trẻ này');
  }

  // Quyền của vai trò văn phòng (không tính giáo viên, phụ huynh) trong phạm vi đơn vị
  async canWriteUnit(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const office = this.officeUser(currentUser);
    const scope = await this.organizationScopes.resolveStaff(office, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  async officeUnitScope(currentUser: CurrentUser, permission: string) {
    return this.organizationScopes.resolveStaff(this.officeUser(currentUser), permission);
  }

  async isHomeroom(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, classId: string | null) {
    if (!classId) {
      return false;
    }
    const assignment = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    return assignment !== undefined;
  }

  async officeCanAccess(currentUser: CurrentUser, orgUnitId: string): Promise<boolean> {
    const office = new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter((assignment) =>
        HEALTH_OFFICE_ROLES.includes(assignment.role_code),
      ),
    });
    if (office.description.assignments.length === 0) {
      return false;
    }
    const scope = await this.organizationScopes.resolveAnyRole(office);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private officeUser(currentUser: CurrentUser): CurrentUser {
    return new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter(
        (assignment) => !TEACHER_ROLES.includes(assignment.role_code) && assignment.role_code !== 'VT-14',
      ),
    });
  }
}

// Số tháng tuổi tại một ngày, dùng so với tiêu chuẩn sức khỏe theo tháng tuổi (P10-11)
export function ageInMonths(dob: string, onDate: string): number {
  const [birthYear = 0, birthMonth = 0, birthDay = 0] = dob.split('-').map(Number);
  const [year = 0, month = 0, day = 0] = onDate.split('-').map(Number);
  return (year - birthYear) * 12 + (month - birthMonth) - (day < birthDay ? 1 : 0);
}
