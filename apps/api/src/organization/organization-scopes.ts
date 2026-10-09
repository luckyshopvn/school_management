import { Injectable } from '@nestjs/common';
import { ApplicationError } from '@school-management/server';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';

// Lớp 2 của phân quyền (BM-10): gán ở Trường chính là toàn trường, gán ở đơn vị cấp 2 chỉ có đơn vị đó (BR-01, QĐ-23)
@Injectable()
export class OrganizationScopes {
  constructor(private readonly currentSchoolYear: CurrentSchoolYearResolver) {}

  async resolve(currentUser: CurrentUser, permissionCode: string): Promise<OrganizationScope> {
    const assigned = currentUser.organizationScope(permissionCode);
    if (assigned.wholeSchool || assigned.orgUnitIds.length === 0) {
      return assigned;
    }
    const current = await this.currentSchoolYear.find();
    const root = current
      ? await current.database
          .selectFrom('org_units')
          .select('id')
          .where('unit_type', '=', 'truong_chinh')
          .executeTakeFirst()
      : undefined;
    if (root && assigned.orgUnitIds.includes(root.id)) {
      return { wholeSchool: true, orgUnitIds: [] };
    }
    return assigned;
  }

  // Dùng trước khi đọc hoặc ghi bản ghi của một đơn vị cụ thể
  async assertCanAccess(currentUser: CurrentUser, permissionCode: string, orgUnitId: string): Promise<void> {
    const scope = await this.resolve(currentUser, permissionCode);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn', [
        { field: 'org_unit_id', message: permissionCode },
      ]);
    }
  }
}
