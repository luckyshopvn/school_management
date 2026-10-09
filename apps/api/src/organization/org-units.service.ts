import { Injectable } from '@nestjs/common';
import type { OrgUnitStatus, OrgUnitType } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { writeAuditLog } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';

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
}

export type OrgUnitChanges = Partial<Omit<OrgUnitInput, 'unit_type'>> & {
  unit_type?: OrgUnitType;
  status?: OrgUnitStatus;
};

export interface ChangeOrigin {
  actorUserId: string;
  ipAddress: string | null;
}

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
] as const;

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
    return query.orderBy('parent_id', 'desc').orderBy('code').execute();
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
      await writeAuditLog(transaction, {
        actorUserId: origin.actorUserId,
        orgUnitId: created.id,
        entityName: 'org_units',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
        ipAddress: origin.ipAddress,
      });
      return created;
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
    };
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('org_units')
        .set({ ...editable, updated_at: this.clock.now() })
        .where('id', '=', orgUnitId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        actorUserId: origin.actorUserId,
        orgUnitId,
        entityName: 'org_units',
        entityId: orgUnitId,
        action: 'update',
        before: existing,
        after: updated,
        ipAddress: origin.ipAddress,
      });
      return updated;
    });
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
