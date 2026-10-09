import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

const NO_UNIT = '00000000-0000-0000-0000-000000000000';

// Kiểm tra phạm vi đơn vị cho danh mục thuộc một đơn vị: phòng ban, chức danh, phòng học (BR-01, QĐ-23)
@Injectable()
export class CatalogAccess {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
  ) {}

  // Ai có vai trò ở đơn vị đều xem được danh mục của đơn vị đó
  async readableDatabase(currentUser: CurrentUser, orgUnitId: string): Promise<Kysely<SchoolYearDatabase> | null> {
    await this.organizationScopes.assertCanAccessAnyRole(currentUser, orgUnitId);
    const current = await this.currentSchoolYear.find();
    return current?.database ?? null;
  }

  // Ghi cần quyền trong phạm vi đơn vị, đơn vị phải còn hoạt động và năm học đang mở
  async writableDatabase(
    currentUser: CurrentUser,
    permissionCode: string,
    orgUnitId: string,
  ): Promise<Kysely<SchoolYearDatabase>> {
    await this.organizationScopes.assertCanAccess(currentUser, permissionCode, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const unit = await database.selectFrom('org_units').select('status').where('id', '=', orgUnitId).executeTakeFirst();
    if (!unit) {
      throw notFoundError('Không tìm thấy đơn vị', 'org_unit');
    }
    if (unit.status !== 'active') {
      throw ruleViolationError('BR-75', 'Đơn vị đã ngừng sử dụng');
    }
    return database;
  }

  async scopeIncludes(currentUser: CurrentUser, permissionCode: string, orgUnitId: string): Promise<void> {
    await this.organizationScopes.assertCanAccess(currentUser, permissionCode, orgUnitId);
  }

  async currentDatabase(): Promise<Kysely<SchoolYearDatabase> | null> {
    const current = await this.currentSchoolYear.find();
    return current?.database ?? null;
  }

  async scope(currentUser: CurrentUser, permissionCode: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolve(currentUser, permissionCode);
  }

  unitFilter(scope: OrganizationScope): string[] | null {
    if (scope.wholeSchool) {
      return null;
    }
    return scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [NO_UNIT];
  }
}
