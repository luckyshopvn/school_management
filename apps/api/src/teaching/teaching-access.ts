import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import { CurrentUser, type OrganizationScope } from '../authentication/current-user.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

const TEACHER_ROLES = ['VT-07', 'VT-08'];
const PARENT_ROLE = 'VT-14';
export const LEADER_ROLE = 'VT-17';
export const MANAGER_ROLE = 'VT-03';

export interface TeachingClass {
  id: string;
  org_unit_id: string;
  name: string;
}

// Phân quyền phân hệ giảng dạy (P03; BR-01; YCTD-80): vai trò văn phòng thao tác theo phạm vi đơn vị của quyền; giáo viên
// chỉ thao tác trên lớp đang được phân công; tổ trưởng chuyên môn duyệt trước, quản lý đơn vị duyệt sau theo đơn vị được
// gán; dữ liệu của Trường chính (lĩnh vực, nhóm, chủ đề, bài học chia sẻ) dùng chung cho mọi đơn vị
@Injectable()
export class TeachingAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  async findClass(database: Kysely<SchoolYearDatabase>, classId: string): Promise<TeachingClass> {
    const found = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!found) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return found;
  }

  async rootUnitId(database: Kysely<SchoolYearDatabase>): Promise<string | null> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return root?.id ?? null;
  }

  // Phạm vi của một quyền chỉ tính các vai trò được nêu
  async scopeOfRoles(currentUser: CurrentUser, roles: string[], permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(
      this.withRoles(currentUser, (role) => roles.includes(role)),
      permission,
    );
  }

  // Phạm vi của quyền theo vai trò văn phòng (không tính giáo viên và phụ huynh)
  async officeScope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(
      this.withRoles(currentUser, (role) => !TEACHER_ROLES.includes(role) && role !== PARENT_ROLE),
      permission,
    );
  }

  // Phạm vi xem dữ liệu giảng dạy theo mọi vai trò nhân sự ở đơn vị (không tính phụ huynh)
  async staffViewScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    const staff = this.withRoles(currentUser, (role) => role !== PARENT_ROLE);
    if (staff.description.assignments.length === 0) {
      return { wholeSchool: false, orgUnitIds: [] };
    }
    return this.organizationScopes.resolveAnyRole(staff);
  }

  // Đơn vị nhìn thấy kèm Trường chính (dữ liệu dùng chung); null là toàn trường
  async visibleUnitIds(database: Kysely<SchoolYearDatabase>, scope: OrganizationScope): Promise<string[] | null> {
    if (scope.wholeSchool) {
      return null;
    }
    const root = await this.rootUnitId(database);
    return [...scope.orgUnitIds, ...(root ? [root] : [])];
  }

  isTeacher(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some((assignment) => TEACHER_ROLES.includes(assignment.role_code));
  }

  hasOfficeRole(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some(
      (assignment) => !TEACHER_ROLES.includes(assignment.role_code) && assignment.role_code !== PARENT_ROLE,
    );
  }

  async assignmentOf(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    classId: string,
    homeroomOnly = false,
  ): Promise<boolean> {
    let query = database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active');
    if (homeroomOnly) {
      query = query.where('assignment_role', '=', 'homeroom');
    }
    return (await query.executeTakeFirst()) !== undefined;
  }

  inScope(scope: OrganizationScope, orgUnitId: string): boolean {
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  // Ghi dữ liệu của lớp: vai trò văn phòng có quyền ở đơn vị của lớp, hoặc giáo viên có quyền và được phân công lớp
  async assertCanManageClass(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classId: string,
    permission: string,
    options: { homeroomOnly?: boolean } = {},
  ): Promise<TeachingClass> {
    const found = await this.findClass(database, classId);
    if (this.inScope(await this.officeScope(currentUser, permission), found.org_unit_id)) {
      return found;
    }
    if (
      currentUser.hasPermission(permission) &&
      this.isTeacher(currentUser) &&
      (await this.assignmentOf(database, currentUser, classId, options.homeroomOnly))
    ) {
      return found;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thao tác trên lớp này');
  }

  // Xem dữ liệu giảng dạy của lớp: nhân sự văn phòng hoặc tổ trưởng ở đơn vị của lớp, giáo viên được phân công lớp
  async canViewClass(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, found: TeachingClass) {
    if (this.hasOfficeRole(currentUser)) {
      const office = this.withRoles(currentUser, (role) => !TEACHER_ROLES.includes(role) && role !== PARENT_ROLE);
      const scope = await this.organizationScopes.resolveAnyRole(office);
      if (this.inScope(scope, found.org_unit_id)) {
        return true;
      }
    }
    return this.isTeacher(currentUser) && this.assignmentOf(database, currentUser, found.id);
  }

  // Phụ huynh có con đang học lớp
  async isGuardianInClass(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, classId: string) {
    if (!currentUser.description.assignments.some((assignment) => assignment.role_code === PARENT_ROLE)) {
      return false;
    }
    const row = await database
      .selectFrom('class_enrollments')
      .innerJoin('child_guardians', 'child_guardians.child_id', 'class_enrollments.child_id')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('class_enrollments.id')
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    return row !== undefined;
  }

  // Tài khoản phụ huynh của các trẻ đang học lớp, nhận thông báo công bố
  async guardianUserIdsOfClass(database: Kysely<SchoolYearDatabase>, classId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('child_guardians', 'child_guardians.child_id', 'class_enrollments.child_id')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.user_id')
      .distinct()
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('guardians.user_id', 'is not', null)
      .execute();
    return rows.map((row) => row.user_id).filter((id): id is string => id !== null);
  }

  private withRoles(currentUser: CurrentUser, keep: (role: string) => boolean): CurrentUser {
    return new CurrentUser({
      ...currentUser.description,
      assignments: currentUser.description.assignments.filter((assignment) => keep(assignment.role_code)),
    });
  }
}
