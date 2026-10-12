import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { HealthAccess, type HealthChild } from '../health/health-access.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';

// Phân quyền dặn thuốc (BR-49, BR-53, BR-86; YCTD-75): y tế nhận thuốc và ghi liều trong phạm vi đơn vị được gán (gán ở
// Trường chính là toàn trường); giáo viên chủ nhiệm của lớp hiện tại của trẻ chỉ được khi đơn vị của trẻ bật cấu hình
// "không có nhân viên y tế"; xem yêu cầu theo quyền xem sức khỏe của trẻ (BR-53)
const OFFICE_VIEW_ROLES = ['VT-02', 'VT-15', 'VT-03', 'VT-09'];

export interface MedicationScope {
  wholeSchool: boolean;
  orgUnitIds: string[];
  homeroomClassIds: string[];
  guardianChildIds: string[];
}

@Injectable()
export class MedicationAccess {
  constructor(
    private readonly health: HealthAccess,
    private readonly organizationScopes: OrganizationScopes,
    private readonly settings: SettingsService,
  ) {}

  findChild(database: Kysely<SchoolYearDatabase>, childId: string): Promise<HealthChild> {
    return this.health.findChild(database, childId);
  }

  // BR-86: cấu hình theo đơn vị, kế thừa từ Trường chính; chưa đặt là tắt
  async noMedicalStaff(orgUnitId: string): Promise<boolean> {
    const setting = (await this.settings.effective(orgUnitId)).find((item) => item.key === 'no_medical_staff');
    return setting?.value === true;
  }

  async canAdminister(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    child: { org_unit_id: string; class_id: string | null },
  ): Promise<boolean> {
    if (await this.health.canWriteUnit(currentUser, PERMISSION_CODES.medicationAdminister, child.org_unit_id)) {
      return true;
    }
    return (
      currentUser.hasPermission(PERMISSION_CODES.medicationAdminister) &&
      (await this.health.isHomeroom(database, currentUser, child.class_id)) &&
      (await this.noMedicalStaff(child.org_unit_id))
    );
  }

  async assertCanAdminister(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string) {
    const child = await this.health.findChild(database, childId);
    if (!(await this.canAdminister(currentUser, database, child))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Bạn không được nhận thuốc hoặc ghi liều cho trẻ này; giáo viên chủ nhiệm chỉ làm khi đơn vị không có nhân viên y tế',
      );
    }
    return child;
  }

  assertCanRead(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string) {
    return this.health.assertCanRead(currentUser, database, childId);
  }

  // Phạm vi danh sách yêu cầu: vai trò văn phòng theo đơn vị, giáo viên chủ nhiệm theo lớp, phụ huynh theo con
  async listScope(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>): Promise<MedicationScope> {
    const office = await this.health.officeUnitScope(currentUser, PERMISSION_CODES.medicationAdminister);
    const units = new Set(office.orgUnitIds);
    let wholeSchool = office.wholeSchool;
    const viewAssignments = currentUser.description.assignments.filter((assignment) =>
      OFFICE_VIEW_ROLES.includes(assignment.role_code),
    );
    if (viewAssignments.length > 0) {
      const root = await database
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      for (const assignment of viewAssignments) {
        if (assignment.org_unit_id === null || assignment.org_unit_id === root?.id) {
          wholeSchool = true;
        } else {
          units.add(assignment.org_unit_id);
        }
      }
    }
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('class_id')
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('child_guardians.child_id')
      .where('guardians.user_id', '=', currentUser.id)
      .execute();
    return {
      wholeSchool,
      orgUnitIds: [...units],
      homeroomClassIds: homeroom.map((row) => row.class_id),
      guardianChildIds: guardian.map((row) => row.child_id),
    };
  }

  // Phạm vi quản lý thuốc theo một hay nhiều quyền của vai trò văn phòng (bỏ phụ huynh)
  async staffScope(currentUser: CurrentUser, permissions: string[]) {
    const units = new Set<string>();
    for (const permission of permissions) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return { wholeSchool: true, orgUnitIds: [] as string[] };
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    return { wholeSchool: false, orgUnitIds: [...units] };
  }

  async assertStaffScope(currentUser: CurrentUser, permissions: string[], orgUnitId: string, message: string) {
    const scope = await this.staffScope(currentUser, permissions);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', message, [{ field: 'org_unit_id', message: permissions.join(', ') }]);
    }
  }
}
