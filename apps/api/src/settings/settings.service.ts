import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { findDefinition, SETTING_DEFINITIONS, validateSettingValue } from './setting-definitions.js';

// Cấu hình theo đơn vị: giá trị của đơn vị, nếu trống lấy của Trường chính, nếu trống lấy mặc định (P01-08, YCTD-40)
export type SettingSource = 'unit' | 'truong_chinh' | 'default' | 'missing';

export interface EffectiveSetting {
  key: string;
  label: string;
  value_type: string;
  value: unknown;
  source: SettingSource;
  unit_value: unknown;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // Ai có vai trò trong phạm vi đơn vị đều xem được cấu hình (CTC-P01-045)
  async read(currentUser: CurrentUser, orgUnitId: string): Promise<EffectiveSetting[]> {
    await this.organizationScopes.assertCanAccessAnyRole(currentUser, orgUnitId);
    return this.effective(orgUnitId);
  }

  async effective(orgUnitId: string): Promise<EffectiveSetting[]> {
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select(['id', 'parent_id'])
      .where('id', '=', orgUnitId)
      .executeTakeFirst();
    if (!unit) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy đơn vị', [{ field: 'entity', message: 'org_unit' }]);
    }
    const unitIds = unit.parent_id ? [unit.id, unit.parent_id] : [unit.id];
    const rows = await database
      .selectFrom('settings')
      .select(['org_unit_id', 'key', 'value'])
      .where('org_unit_id', 'in', unitIds)
      .execute();
    const valueOf = (ownerId: string, key: string) =>
      rows.find((row) => row.org_unit_id === ownerId && row.key === key);

    return SETTING_DEFINITIONS.map((definition) => {
      const own = valueOf(unit.id, definition.key);
      const inherited = unit.parent_id ? valueOf(unit.parent_id, definition.key) : undefined;
      let source: SettingSource = 'missing';
      let value: unknown = null;
      if (own) {
        source = 'unit';
        value = own.value;
      } else if (inherited) {
        source = 'truong_chinh';
        value = inherited.value;
      } else if (definition.defaultValue !== null) {
        source = 'default';
        value = definition.defaultValue;
      }
      return {
        key: definition.key,
        label: definition.label,
        value_type: definition.valueType,
        value,
        source,
        unit_value: own?.value ?? null,
      };
    });
  }

  // Ghi đè giá trị của đơn vị; giá trị null xóa giá trị riêng để kế thừa lại (PQ-15)
  async update(
    currentUser: CurrentUser,
    orgUnitId: string,
    values: Record<string, unknown>,
    origin: ChangeOrigin,
  ): Promise<EffectiveSetting[]> {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.settingManage, orgUnitId);
    const errors: FieldError[] = [];
    for (const [key, value] of Object.entries(values)) {
      const definition = findDefinition(key);
      if (!definition) {
        errors.push({ field: `values.${key}`, message: 'Không có mục cấu hình này' });
        continue;
      }
      const problem = value === null ? null : validateSettingValue(definition, value);
      if (problem) {
        errors.push({ field: `values.${key}`, message: problem });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }

    const before = await this.effective(orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const [key, value] of Object.entries(values)) {
        const definition = findDefinition(key);
        if (!definition) {
          continue;
        }
        if (value === null) {
          await transaction
            .deleteFrom('settings')
            .where('org_unit_id', '=', orgUnitId)
            .where('key', '=', key)
            .execute();
        } else {
          await transaction
            .insertInto('settings')
            .values({
              org_unit_id: orgUnitId,
              key,
              value: JSON.stringify(value),
              value_type: definition.valueType,
              updated_by: origin.actorUserId,
            })
            .onConflict((conflict) =>
              conflict
                .columns(['org_unit_id', 'key'])
                .doUpdateSet({ value: JSON.stringify(value), updated_at: now, updated_by: origin.actorUserId }),
            )
            .execute();
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'settings',
        entityId: orgUnitId,
        action: 'update',
        before: Object.fromEntries(
          Object.keys(values).map((key) => [key, before.find((item) => item.key === key)?.unit_value ?? null]),
        ),
        after: values,
      });
    });
    return this.effective(orgUnitId);
  }
}
