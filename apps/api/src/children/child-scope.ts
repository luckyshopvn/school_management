import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import type { ExpressionBuilder, Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';

// Lớp 3 của phân quyền với trẻ (BR-72, YCTD-45): vai trò văn phòng xem trẻ trong đơn vị; giáo viên xem trẻ trong lớp
// được phân công; phụ huynh xem con mình; tổ trưởng chuyên môn và bảo vệ chưa xem được cho tới khi có tính năng tương ứng
const UNIT_VIEW_ROLES = ['VT-02', 'VT-15', 'VT-03', 'VT-12', 'VT-04', 'VT-05', 'VT-06', 'VT-09', 'VT-10', 'VT-11'];
const TEACHER_ROLES = ['VT-07', 'VT-08'];
const PARENT_ROLE = 'VT-14';
// Dữ liệu sức khỏe chỉ cho giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và phụ huynh (BR-53)
const HEALTH_VIEW_ROLES = ['VT-07', 'VT-09', 'VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-14'];
// Vai trò văn phòng xem sức khỏe của trẻ trong đơn vị; giáo viên chủ nhiệm xem trẻ lớp mình, phụ huynh xem con mình (BR-53)
const HEALTH_OFFICE_ROLES = ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-09'];
const HOMEROOM_ROLE = 'VT-07';
const NO_ID = '00000000-0000-0000-0000-000000000000';

export interface ChildReadScope {
  wholeSchool: boolean;
  unitIds: string[];
  classIds: string[];
  guardianUserId: string | null;
}

@Injectable()
export class ChildScope {
  async resolve(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>): Promise<ChildReadScope> {
    const assignments = currentUser.description.assignments;
    const { wholeSchool, unitIds } = await this.unitScope(currentUser, database, UNIT_VIEW_ROLES);
    let classIds: string[] = [];
    if (assignments.some((assignment) => TEACHER_ROLES.includes(assignment.role_code))) {
      classIds = (
        await database
          .selectFrom('class_staff_assignments')
          .select('class_id')
          .where('staff_user_id', '=', currentUser.id)
          .where('status', '=', 'active')
          .execute()
      ).map((row) => row.class_id);
    }
    const guardianUserId = assignments.some((assignment) => assignment.role_code === PARENT_ROLE)
      ? currentUser.id
      : null;
    return { wholeSchool, unitIds, classIds, guardianUserId };
  }

  // Phạm vi xem sức khỏe, dân tộc, diện chính sách, khuyết tật (BR-53, BR-107), nằm trong phạm vi xem trẻ: vai trò văn phòng
  // được xem sức khỏe trong đơn vị của vai trò, giáo viên chủ nhiệm với lớp đang chủ nhiệm, phụ huynh với con mình
  async resolveHealth(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>): Promise<ChildReadScope> {
    const assignments = currentUser.description.assignments;
    const { wholeSchool, unitIds } = await this.unitScope(currentUser, database, HEALTH_OFFICE_ROLES);
    let classIds: string[] = [];
    if (assignments.some((assignment) => assignment.role_code === HOMEROOM_ROLE)) {
      classIds = (
        await database
          .selectFrom('class_staff_assignments')
          .select('class_id')
          .where('staff_user_id', '=', currentUser.id)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .execute()
      ).map((row) => row.class_id);
    }
    const guardianUserId = assignments.some((assignment) => assignment.role_code === PARENT_ROLE)
      ? currentUser.id
      : null;
    return { wholeSchool, unitIds, classIds, guardianUserId };
  }

  // Trẻ trong danh sách mà người dùng được xem sức khỏe
  async healthVisibleIds(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    childIds: string[],
  ): Promise<Set<string>> {
    if (childIds.length === 0 || !this.canSeeHealth(currentUser)) {
      return new Set();
    }
    const scope = await this.resolveHealth(currentUser, database);
    const rows = await database
      .selectFrom('children')
      .select('id')
      .where('id', 'in', childIds)
      .where(this.filter(scope))
      .execute();
    return new Set(rows.map((row) => row.id));
  }

  async canSeeHealthOf(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string) {
    return (await this.healthVisibleIds(currentUser, database, [childId])).has(childId);
  }

  private async unitScope(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, roles: string[]) {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    const unitAssignments = currentUser.description.assignments.filter((assignment) =>
      roles.includes(assignment.role_code),
    );
    const wholeSchool = unitAssignments.some(
      (assignment) => assignment.org_unit_id === null || assignment.org_unit_id === root?.id,
    );
    const unitIds = [
      ...new Set(unitAssignments.map((assignment) => assignment.org_unit_id).filter((id): id is string => id !== null)),
    ];
    return { wholeSchool, unitIds };
  }

  // Điều kiện phạm vi đặt ở tầng truy vấn (BM-11). Hồ sơ đã xóa (DT-16 phần 16g) không thuộc phạm vi của ai
  filter(scope: ChildReadScope) {
    return (expression: ExpressionBuilder<SchoolYearDatabase, 'children'>) => {
      const notDeleted = expression('children.deleted_at', 'is', null);
      if (scope.wholeSchool) {
        return notDeleted;
      }
      const conditions = [expression('children.org_unit_id', 'in', scope.unitIds.length ? scope.unitIds : [NO_ID])];
      if (scope.classIds.length > 0) {
        conditions.push(
          expression(
            'children.id',
            'in',
            expression
              .selectFrom('class_enrollments')
              .select('class_enrollments.child_id')
              .where('class_enrollments.is_current', '=', true)
              .where('class_enrollments.class_id', 'in', scope.classIds),
          ),
        );
      }
      if (scope.guardianUserId) {
        conditions.push(
          expression(
            'children.id',
            'in',
            expression
              .selectFrom('child_guardians')
              .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
              .select('child_guardians.child_id')
              .where('guardians.user_id', '=', scope.guardianUserId),
          ),
        );
      }
      return expression.and([notDeleted, expression.or(conditions)]);
    };
  }

  async assertCanRead(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string): Promise<void> {
    const scope = await this.resolve(currentUser, database);
    const visible = await database
      .selectFrom('children')
      .select('id')
      .where('id', '=', childId)
      .where(this.filter(scope))
      .executeTakeFirst();
    if (!visible) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Hồ sơ trẻ nằm ngoài phạm vi của bạn');
    }
  }

  // Có vai trò được xem sức khỏe của ít nhất một trẻ; dữ liệu của từng trẻ xét theo resolveHealth
  canSeeHealth(currentUser: CurrentUser): boolean {
    return currentUser.description.assignments.some((assignment) => HEALTH_VIEW_ROLES.includes(assignment.role_code));
  }
}
