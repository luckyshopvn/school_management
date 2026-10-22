import { Injectable } from '@nestjs/common';
import type { OrgUnitStatus, OrgUnitType } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { SCHOOL_LEVEL_CODES, type SchoolLevelCode } from '@school-management/shared';
import { STRUCTURE_RULE_CODE } from '../catalogs/school-level-fields.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildStudentWorkbook, fileStamp } from '../children/student-workbook.js';
import {
  matchesOrgUnitExport,
  ORG_UNIT_EXPORT_COLUMNS,
  ORG_UNIT_EXPORT_SCREENS,
  type OrgUnitExportFilter,
} from './org-unit-export.js';

// Cây đơn vị hai cấp: Trường chính; Phân hiệu, Điểm trường trực thuộc (BR-01, QĐ-23)
export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  unit_type: OrgUnitType;
  parent_id: string | null;
  address: string | null;
  phone: string | null;
  manager_user_id: string | null;
  status: OrgUnitStatus;
  // Khoảng cách đến cơ sở chính (km), diện tích (m²) của phân hiệu, điểm trường (mục 1.2, 1.3 của Sở, YCTD-111)
  distance_km: number | null;
  area_m2: number | null;
}

// Cấp học của đơn vị (DT-19 phần 19b, YCTD-152)
export interface OrgUnitLevels {
  org_unit_id: string;
  school_levels: SchoolLevelCode[];
}

export interface OrgUnitTree extends OrgUnit {
  children: OrgUnit[];
}

export interface OrgUnitInput {
  code: string;
  name: string;
  unit_type: OrgUnitType;
  parent_id: string | null;
  address: string | null;
  phone: string | null;
  manager_user_id: string | null;
  distance_km: number | null;
  area_m2: number | null;
}

export type OrgUnitChanges = Partial<Omit<OrgUnitInput, 'unit_type'>> & {
  unit_type?: OrgUnitType;
  status?: OrgUnitStatus;
};

const COLUMNS = [
  'id',
  'code',
  'name',
  'unit_type',
  'parent_id',
  'address',
  'phone',
  'manager_user_id',
  'status',
  'distance_km',
  'area_m2',
] as const;

// Cột numeric đọc ra chuỗi để không mất chính xác; trả số cho giao diện
function present(
  row: Omit<OrgUnit, 'distance_km' | 'area_m2'> & { distance_km: string | null; area_m2: string | null },
): OrgUnit {
  return {
    ...row,
    distance_km: row.distance_km === null ? null : Number(row.distance_km),
    area_m2: row.area_m2 === null ? null : Number(row.area_m2),
  };
}

// Trường chính là cơ sở chính nên không có khoảng cách đến cơ sở chính (YCTD-111)
function assertDistance(unitType: OrgUnitType, distanceKm: number | null | undefined): void {
  if (unitType === 'truong_chinh' && distanceKm !== undefined && distanceKm !== null) {
    throw ruleViolationError('YCTD-111', 'Trường chính là cơ sở chính, không nhập khoảng cách đến cơ sở chính', [
      { field: 'distance_km', message: 'Chỉ nhập cho phân hiệu, điểm trường' },
    ]);
  }
}

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy đơn vị', [{ field: 'entity', message: 'org_unit' }]);
}

@Injectable()
export class OrgUnitsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(filter: { unitType?: OrgUnitType; status?: OrgUnitStatus }): Promise<OrgUnit[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('org_units').select(COLUMNS);
    if (filter.unitType) {
      query = query.where('unit_type', '=', filter.unitType);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    return (await query.orderBy('parent_id', 'desc').orderBy('code').execute()).map(present);
  }

  // Xuất Excel danh sách phân hiệu hoặc điểm trường (DT-16 phần 16b); ghi nhật ký xuất trước khi trả tệp (BR-74)
  async exportList(currentUser: CurrentUser, filter: OrgUnitExportFilter, columns: string[], ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const rows = (await this.list({ unitType: filter.unitType })).filter((unit) => matchesOrgUnitExport(unit, filter));
    const selected = columns.flatMap((id) => ORG_UNIT_EXPORT_COLUMNS.filter((column) => column.id === id));
    const screen = ORG_UNIT_EXPORT_SCREENS[filter.unitType];
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: screen.reportCode,
      title: screen.title,
      fileName: `${screen.file}-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: rows.map((row) => row.id),
      columns: selected.map((column) => ({ key: column.id, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(selected.map((column) => [column.id, column.value(row)]))),
      ipAddress,
      createdAt,
      containsPersonalData: false,
    });
  }

  async tree(): Promise<OrgUnitTree | null> {
    const units = await this.list({});
    const root = units.find((unit) => unit.unit_type === 'truong_chinh');
    if (!root) {
      return null;
    }
    return { ...root, children: units.filter((unit) => unit.parent_id === root.id) };
  }

  async create(input: OrgUnitInput, origin: ChangeOrigin): Promise<OrgUnit> {
    const { database } = await this.currentSchoolYear.require();
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();

    if (input.unit_type === 'truong_chinh') {
      if (root) {
        throw ruleViolationError('BR-01', 'Trường đã có Trường chính; cây đơn vị chỉ có một Trường chính');
      }
      if (input.parent_id) {
        throw ruleViolationError('BR-01', 'Trường chính không có đơn vị cha');
      }
    } else {
      if (!root) {
        throw ruleViolationError('BR-01', 'Hãy tạo Trường chính trước khi tạo Phân hiệu hoặc Điểm trường');
      }
      if (input.parent_id && input.parent_id !== root.id) {
        throw ruleViolationError(
          'BR-01',
          'Phân hiệu và Điểm trường chỉ trực thuộc Trường chính; cây đơn vị chỉ có hai cấp',
        );
      }
    }
    assertDistance(input.unit_type, input.distance_km);
    await this.assertCodeAvailable(input.code, null);

    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('org_units')
        .values({
          ...input,
          parent_id: input.unit_type === 'truong_chinh' ? null : (root?.id ?? null),
          created_by: origin.actorUserId,
        })
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      // Đơn vị mới có các cấp của Trường chính (trường chưa có Trường chính thì Mầm non); sửa ở cấp học của đơn vị (YCTD-152)
      const rootLevels = root
        ? (
            await transaction
              .selectFrom('org_unit_levels')
              .select('school_level')
              .where('org_unit_id', '=', root.id)
              .execute()
          ).map((row) => row.school_level)
        : [];
      for (const level of rootLevels.length > 0 ? rootLevels : (['MN'] as SchoolLevelCode[])) {
        await transaction
          .insertInto('org_unit_levels')
          .values({ org_unit_id: created.id, school_level: level, created_by: origin.actorUserId })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: created.id,
        entityName: 'org_units',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return present(created);
    });
  }

  async update(orgUnitId: string, changes: OrgUnitChanges, origin: ChangeOrigin): Promise<OrgUnit> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('org_units')
      .select(COLUMNS)
      .where('id', '=', orgUnitId)
      .executeTakeFirst();
    if (!existing) {
      throw notFound();
    }

    if (changes.unit_type !== undefined && changes.unit_type !== existing.unit_type) {
      if (existing.unit_type === 'truong_chinh' || changes.unit_type === 'truong_chinh') {
        throw ruleViolationError('BR-01', 'Không đổi được loại giữa Trường chính và đơn vị cấp 2');
      }
    }
    if (changes.parent_id !== undefined && changes.parent_id !== existing.parent_id) {
      throw ruleViolationError('BR-01', 'Cây đơn vị chỉ có hai cấp; không đổi được đơn vị cha');
    }
    assertDistance(changes.unit_type ?? existing.unit_type, changes.distance_km);
    if (changes.code !== undefined && changes.code !== existing.code) {
      await this.assertCodeAvailable(changes.code, orgUnitId);
    }
    if (changes.status === 'inactive' && existing.status === 'active') {
      if (existing.unit_type === 'truong_chinh') {
        throw ruleViolationError('BR-01', 'Không ngừng sử dụng được Trường chính');
      }
      const activeChildren = await database
        .selectFrom('org_units')
        .select('code')
        .where('parent_id', '=', orgUnitId)
        .where('status', '=', 'active')
        .execute();
      if (activeChildren.length > 0) {
        throw ruleViolationError(
          'BR-01',
          'Hãy ngừng sử dụng các đơn vị con trước',
          activeChildren.map((child) => ({ field: 'children', message: child.code })),
        );
      }
    }

    const editable = {
      code: changes.code,
      name: changes.name,
      unit_type: changes.unit_type,
      address: changes.address,
      phone: changes.phone,
      manager_user_id: changes.manager_user_id,
      status: changes.status,
      distance_km: changes.distance_km,
      area_m2: changes.area_m2,
    };
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('org_units')
        .set({ ...editable, updated_at: this.clock.now() })
        .where('id', '=', orgUnitId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'org_units',
        entityId: orgUnitId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return present(updated);
    });
  }

  async listLevels(): Promise<OrgUnitLevels[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const rows = await current.database.selectFrom('org_unit_levels').select(['org_unit_id', 'school_level']).execute();
    const byUnit = new Map<string, SchoolLevelCode[]>();
    for (const row of rows) {
      byUnit.set(row.org_unit_id, [...(byUnit.get(row.org_unit_id) ?? []), row.school_level]);
    }
    return [...byUnit].map(([orgUnitId, levels]) => ({
      org_unit_id: orgUnitId,
      school_levels: SCHOOL_LEVEL_CODES.filter((level) => levels.includes(level)),
    }));
  }

  // Đặt các cấp của đơn vị: ít nhất một cấp; không bỏ được cấp đơn vị đang có lớp chưa đóng của cấp đó (YCTD-152)
  async setLevels(orgUnitId: string, levels: SchoolLevelCode[], origin: ChangeOrigin): Promise<OrgUnitLevels> {
    const { database } = await this.currentSchoolYear.require();
    const unit = await database.selectFrom('org_units').select('id').where('id', '=', orgUnitId).executeTakeFirst();
    if (!unit) {
      throw notFound();
    }
    const before = (
      await database.selectFrom('org_unit_levels').select('school_level').where('org_unit_id', '=', orgUnitId).execute()
    ).map((row) => row.school_level);
    const removed = before.filter((level) => !levels.includes(level));
    if (removed.length > 0) {
      const inUse = await database
        .selectFrom('classes')
        .select('school_level')
        .where('org_unit_id', '=', orgUnitId)
        .where('status', '=', 'active')
        .where('school_level', 'in', removed)
        .executeTakeFirst();
      if (inUse) {
        throw ruleViolationError(STRUCTURE_RULE_CODE, `Đơn vị còn lớp cấp ${inUse.school_level}; giải thể lớp trước khi bỏ cấp`, [
          { field: 'school_levels', message: 'Cấp đang có lớp' },
        ]);
      }
    }
    const ordered = SCHOOL_LEVEL_CODES.filter((level) => levels.includes(level));
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('org_unit_levels').where('org_unit_id', '=', orgUnitId).execute();
      for (const level of ordered) {
        await transaction
          .insertInto('org_unit_levels')
          .values({ org_unit_id: orgUnitId, school_level: level, created_by: origin.actorUserId })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'org_unit_levels',
        entityId: orgUnitId,
        action: 'update',
        before: { school_levels: before },
        after: { school_levels: ordered },
      });
    });
    return { org_unit_id: orgUnitId, school_levels: ordered };
  }

  private async assertCodeAvailable(code: string, exceptId: string | null): Promise<void> {
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('org_units').select('id').where('code', '=', code);
    if (exceptId) {
      query = query.where('id', '!=', exceptId);
    }
    const duplicate = await query.executeTakeFirst();
    if (duplicate) {
      throw new ApplicationError('ERR_CONFLICT', 'Mã đơn vị đã tồn tại', [{ field: 'code', message: duplicate.id }]);
    }
  }
}
