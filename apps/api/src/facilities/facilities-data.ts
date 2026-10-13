import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import type { CalcAsset, CalcClass, CalcHolding, CalcItem } from './equipment-report-calc.js';
import { ageGroupOfMonths } from './facility-rules.js';

// Đọc dữ liệu dùng chung cho thiết bị dạy học, cơ sở vật chất và báo cáo EMIS (YCTD-102)
@Injectable()
export class FacilitiesData {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
  ) {}

  async database(): Promise<Kysely<SchoolYearDatabase>> {
    return (await this.currentSchoolYear.require()).database;
  }

  // Đơn vị trong phạm vi của một hoặc nhiều quyền (bỏ vai trò phụ huynh); chọn một đơn vị thì chỉ đơn vị đó
  async units(currentUser: CurrentUser, permissions: string[], orgUnitId: string | null): Promise<string[]> {
    const database = await this.database();
    const units = new Set<string>();
    let wholeSchool = false;
    for (const permission of permissions) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      wholeSchool ||= scope.wholeSchool;
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    let ids = wholeSchool
      ? (await database.selectFrom('org_units').select('id').execute()).map((row) => row.id)
      : [...units];
    if (ids.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem số liệu này');
    }
    if (orgUnitId) {
      if (!ids.includes(orgUnitId)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
      }
      ids = [orgUnitId];
    }
    return ids;
  }

  // Toàn trường theo quyền: báo cáo EMIS và hồ sơ trường lập cho cả trường
  async assertWholeSchool(currentUser: CurrentUser, permissions: string[], message: string): Promise<void> {
    for (const permission of permissions) {
      if ((await this.organizationScopes.resolveStaff(currentUser, permission)).wholeSchool) {
        return;
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', message);
  }

  async root(database: Kysely<SchoolYearDatabase>) {
    const root = await database
      .selectFrom('org_units')
      .select(['id', 'code', 'name', 'address', 'phone'])
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!root) {
      throw validationError([{ field: 'org_unit_id', message: 'Chưa có Trường chính trong cây đơn vị' }]);
    }
    return root;
  }

  // Lớp đang hoạt động kèm nhóm tuổi suy từ khối và sĩ số hiện tại (học sinh đang học)
  async classes(database: Kysely<SchoolYearDatabase>, orgUnitIds: string[]): Promise<CalcClass[]> {
    if (orgUnitIds.length === 0) {
      return [];
    }
    const [classes, gradeLevels, counts] = await Promise.all([
      database
        .selectFrom('classes')
        .select(['id', 'name', 'org_unit_id', 'grade_level'])
        .where('status', '=', 'active')
        .where('org_unit_id', 'in', orgUnitIds)
        .orderBy('name')
        .execute(),
      database.selectFrom('grade_levels').select(['code', 'age_from_months', 'age_to_months']).execute(),
      database
        .selectFrom('class_enrollments')
        .innerJoin('children', 'children.id', 'class_enrollments.child_id')
        .select(['class_enrollments.class_id', sql<string>`count(*)`.as('count')])
        .where('class_enrollments.is_current', '=', true)
        .where('children.status', '=', 'active')
        .groupBy('class_enrollments.class_id')
        .execute(),
    ]);
    const grades = new Map(gradeLevels.map((row) => [row.code, row]));
    const countByClass = new Map(counts.map((row) => [row.class_id, Number(row.count)]));
    return classes.map((row) => {
      const grade = grades.get(row.grade_level);
      return {
        id: row.id,
        name: row.name,
        org_unit_id: row.org_unit_id,
        age_group: grade ? ageGroupOfMonths(grade.age_from_months, grade.age_to_months) : null,
        child_count: countByClass.get(row.id) ?? 0,
      };
    });
  }

  async items(database: Kysely<SchoolYearDatabase>): Promise<CalcItem[]> {
    const rows = await database
      .selectFrom('equipment_items')
      .select([
        'id',
        'code',
        'name',
        'unit',
        'equipment_group',
        'development_area',
        'age_group',
        'quantity',
        'norm_basis',
        'is_minimum',
        'order_no',
      ])
      .where('status', '=', 'active')
      .execute();
    return rows.map((row) => ({ ...row, quantity: Number(row.quantity) }));
  }

  async holdings(database: Kysely<SchoolYearDatabase>, orgUnitIds: string[]): Promise<CalcHolding[]> {
    if (orgUnitIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('equipment_holdings')
      .select(['equipment_item_id', 'org_unit_id', 'class_id', 'quantity', 'next_year_need'])
      .where('org_unit_id', 'in', orgUnitIds)
      .execute();
    return rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      next_year_need: row.next_year_need === null ? null : Number(row.next_year_need),
    }));
  }

  // Tài sản gắn thiết bị còn dùng được; tài sản cấp phát cho lớp tính vào lớp đó
  async assets(database: Kysely<SchoolYearDatabase>, orgUnitIds: string[]): Promise<CalcAsset[]> {
    if (orgUnitIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('assets')
      .select(['equipment_item_id', 'org_unit_id', 'location_type', 'location_id'])
      .where('equipment_item_id', 'is not', null)
      .where('status', 'in', ['in_stock', 'assigned', 'on_loan'])
      .where('org_unit_id', 'in', orgUnitIds)
      .execute();
    return rows.map((row) => ({
      equipment_item_id: row.equipment_item_id ?? '',
      org_unit_id: row.org_unit_id,
      class_id: row.location_type === 'class' ? row.location_id : null,
    }));
  }
}
