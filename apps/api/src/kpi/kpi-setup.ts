import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { KpiPeriodType, KpiSchoolLevel, KpiSubjectGroup } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { KPI_SCHOOL_LEVELS, type KpiRuleConfig } from '@school-management/shared';
import type { Request } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { conflictOnDuplicate, isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readWorkDate, readWorkText } from '../work/work-access.js';
import { validateRuleConfig } from './kpi-engine.js';
import { check, inScope, KPI_PERMISSIONS, kpiRule, KpiSupport, type Executor } from './kpi-support.js';

// Thiết lập của phân hệ KPI (DT-18 phần 18d, YCTD-139): bộ quy tắc chấm có phiên bản (bản nháp sửa được, ban hành rồi thì
// không sửa, muốn đổi thì lập phiên bản mới), đối tượng đánh giá (bộ quy tắc, nhóm lãnh đạo hoặc cán bộ, cấp học, vị trí
// việc làm, người đứng đầu, cấp trên trực tiếp), kỳ đánh giá và lịch kỳ, phiên bản quy tắc áp cho từng bộ trong kỳ
const PERIOD_TYPES: KpiPeriodType[] = ['month', 'quarter', 'term', 'year', 'custom'];
const SUBJECT_GROUPS: KpiSubjectGroup[] = ['leader', 'staff'];
const LEVELS = KPI_SCHOOL_LEVELS.map((level) => level.value);
const ANY_KPI = [
  KPI_PERMISSIONS.participate,
  KPI_PERMISSIONS.manage,
  KPI_PERMISSIONS.advise,
  KPI_PERMISSIONS.vote,
  KPI_PERMISSIONS.configure,
];
const PHASES = [
  'register_from',
  'register_to',
  'self_from',
  'self_to',
  'review_from',
  'review_to',
  'advisory_from',
  'advisory_to',
] as const;

export interface PeriodInput {
  code: string;
  name: string;
  periodType: KpiPeriodType;
  startDate: string;
  endDate: string;
  phases: Partial<Record<(typeof PHASES)[number], string | null>>;
}

export interface ProfileInput {
  ruleSetId: string;
  subjectGroup: KpiSubjectGroup;
  schoolLevel: KpiSchoolLevel | null;
  jobPosition: string | null;
  isHead: boolean;
  superiorStaffId: string | null;
  excluded: boolean;
}

@Injectable()
export class KpiSetupService {
  constructor(private readonly support: KpiSupport) {}

  // Bộ quy tắc và các phiên bản; người tham gia đọc để biết thang mức, người cấu hình sửa
  async ruleSets() {
    const database = await this.support.database();
    const sets = await database.selectFrom('kpi_rule_sets').selectAll().orderBy('code').execute();
    const versions = await database
      .selectFrom('kpi_rule_set_versions')
      .select(['id', 'rule_set_id', 'version_no', 'status', 'note', 'published_at', 'published_by_name', 'created_at'])
      .orderBy('version_no', 'desc')
      .execute();
    return sets.map((set) => ({ ...set, versions: versions.filter((version) => version.rule_set_id === set.id) }));
  }

  async version(versionId: string) {
    const database = await this.support.database();
    const version = await database
      .selectFrom('kpi_rule_set_versions')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_rule_set_versions.rule_set_id')
      .selectAll('kpi_rule_set_versions')
      .select(['kpi_rule_sets.code as rule_set_code', 'kpi_rule_sets.name as rule_set_name'])
      .where('kpi_rule_set_versions.id', '=', versionId)
      .executeTakeFirst();
    if (!version) {
      throw notFoundError('Không tìm thấy phiên bản bộ quy tắc', 'kpi_rule_set_version');
    }
    return version;
  }

  async createRuleSet(
    input: { code: string; name: string; description: string | null; copyFromVersionId: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const source = input.copyFromVersionId
      ? await this.support.config(database, input.copyFromVersionId)
      : await this.defaultConfig(database);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const set = await transaction
          .insertInto('kpi_rule_sets')
          .values({ code: input.code, name: input.name, description: input.description, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('kpi_rule_set_versions')
          .values({
            rule_set_id: set.id,
            version_no: 1,
            config: JSON.stringify(source),
            note: 'Bản nháp đầu tiên',
            created_by: origin.actorUserId,
          })
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'kpi_rule_sets',
          entityId: set.id,
          action: 'create',
          before: null,
          after: set,
        });
        return set;
      }),
      'Mã bộ quy tắc đã có',
      'code',
    );
  }

  async updateRuleSet(
    ruleSetId: string,
    patch: { name?: string; description?: string | null; status?: 'active' | 'inactive'; isDefault?: boolean },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const before = await database.selectFrom('kpi_rule_sets').selectAll().where('id', '=', ruleSetId).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy bộ quy tắc', 'kpi_rule_set');
    }
    return database.transaction().execute(async (transaction) => {
      if (patch.isDefault) {
        await transaction.updateTable('kpi_rule_sets').set({ is_default: false }).execute();
      }
      const after = await transaction
        .updateTable('kpi_rule_sets')
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.isDefault !== undefined ? { is_default: patch.isDefault } : {}),
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', ruleSetId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_rule_sets',
        entityId: ruleSetId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  // Phiên bản mới là bản nháp chép từ phiên bản mới nhất (hoặc phiên bản chọn); mỗi bộ chỉ có một bản nháp
  async createVersion(ruleSetId: string, input: { copyFromVersionId: string | null; note: string | null }, origin: ChangeOrigin) {
    const database = await this.support.database();
    const versions = await database
      .selectFrom('kpi_rule_set_versions')
      .select(['id', 'version_no', 'status'])
      .where('rule_set_id', '=', ruleSetId)
      .orderBy('version_no', 'desc')
      .execute();
    if (versions.length === 0) {
      throw notFoundError('Không tìm thấy bộ quy tắc', 'kpi_rule_set');
    }
    if (versions.some((version) => version.status === 'draft')) {
      throw kpiRule('Bộ quy tắc đang có bản nháp; sửa hoặc ban hành bản nháp đó trước');
    }
    const sourceId = input.copyFromVersionId ?? versions[0]!.id;
    const config = await this.support.config(database, sourceId);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('kpi_rule_set_versions')
        .values({
          rule_set_id: ruleSetId,
          version_no: versions[0]!.version_no + 1,
          config: JSON.stringify(config),
          note: input.note,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'version_no', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_rule_set_versions',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { rule_set_id: ruleSetId, version_no: created.version_no, copied_from: sourceId },
      });
      return created;
    });
  }

  async updateVersion(versionId: string, patch: { config?: KpiRuleConfig; note?: string | null }, origin: ChangeOrigin) {
    const database = await this.support.database();
    const before = await this.version(versionId);
    if (before.status !== 'draft') {
      throw kpiRule('Phiên bản đã ban hành không sửa được; hãy lập phiên bản mới');
    }
    if (patch.config) {
      const errors = validateRuleConfig(patch.config).map((error) => ({ ...error, field: `config.${error.field}` }));
      if (errors.length > 0) {
        throw validationError(errors);
      }
    }
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('kpi_rule_set_versions')
        .set({
          ...(patch.config ? { config: JSON.stringify(patch.config) } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', versionId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_rule_set_versions',
        entityId: versionId,
        action: 'update',
        before: { config: before.config, note: before.note },
        after: { config: after.config, note: after.note },
      });
      return after;
    });
  }

  async publishVersion(versionId: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const version = await this.version(versionId);
    if (version.status !== 'draft') {
      throw kpiRule('Phiên bản đã ban hành');
    }
    const errors = validateRuleConfig(version.config);
    if (errors.length > 0) {
      throw validationError(errors.map((error) => ({ ...error, field: `config.${error.field}` })));
    }
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('kpi_rule_set_versions')
        .set({
          status: 'published',
          published_at: this.support.clock.now(),
          published_by: origin.actorUserId,
          published_by_name: origin.actorName,
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', versionId)
        .returning(['id', 'version_no', 'status', 'published_at'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_rule_set_versions',
        entityId: versionId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'published' },
      });
      return after;
    });
  }

  async deleteVersion(versionId: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const version = await this.version(versionId);
    if (version.status !== 'draft') {
      throw kpiRule('Chỉ xóa được bản nháp');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('kpi_rule_set_versions').where('id', '=', versionId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_rule_set_versions',
        entityId: versionId,
        action: 'delete',
        before: { rule_set_id: version.rule_set_id, version_no: version.version_no },
        after: null,
      });
    });
  }

  // Nhân sự đang làm việc trong phạm vi kèm hồ sơ đối tượng đánh giá
  async profiles(currentUser: CurrentUser, filter: { orgUnitId: string | null; keyword: string | null }) {
    const scope = await this.support.scope(currentUser, KPI_PERMISSIONS.configure);
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const database = await this.support.database();
    let query = database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .leftJoin('kpi_profiles', 'kpi_profiles.staff_id', 'staff.id')
      .leftJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_profiles.rule_set_id')
      .leftJoin('staff as superior', 'superior.id', 'kpi_profiles.superior_staff_id')
      .select([
        'staff.id as staff_id',
        'staff.code as staff_code',
        'staff.full_name',
        'staff.org_unit_id',
        'org_units.name as org_unit_name',
        'job_titles.name as job_title_name',
        'kpi_profiles.id as profile_id',
        'kpi_profiles.rule_set_id',
        'kpi_rule_sets.name as rule_set_name',
        'kpi_profiles.subject_group',
        'kpi_profiles.school_level',
        'kpi_profiles.job_position',
        'kpi_profiles.is_head',
        'kpi_profiles.excluded',
        'kpi_profiles.superior_staff_id',
        'superior.full_name as superior_name',
      ])
      .where('staff.status', '=', 'active')
      .orderBy('org_units.name')
      .orderBy('staff.full_name');
    if (filter.orgUnitId) {
      query = query.where('staff.org_unit_id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      if (scope.orgUnitIds.length === 0) {
        return [];
      }
      query = query.where('staff.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.keyword) {
      const pattern = `%${filter.keyword}%`;
      query = query.where((eb) => eb.or([eb('staff.full_name', 'ilike', pattern), eb('staff.code', 'ilike', pattern)]));
    }
    return query.execute();
  }

  async saveProfiles(currentUser: CurrentUser, staffIds: string[], input: ProfileInput, origin: ChangeOrigin) {
    const database = await this.support.database();
    const scope = await this.support.scope(currentUser, KPI_PERMISSIONS.configure);
    const ruleSet = await database
      .selectFrom('kpi_rule_sets')
      .select(['id', 'status'])
      .where('id', '=', input.ruleSetId)
      .executeTakeFirst();
    if (!ruleSet || ruleSet.status !== 'active') {
      throw validationError([{ field: 'rule_set_id', message: 'Chọn bộ quy tắc đang dùng' }]);
    }
    if (input.superiorStaffId && staffIds.includes(input.superiorStaffId)) {
      throw validationError([{ field: 'superior_staff_id', message: 'Cấp trên trực tiếp phải là người khác' }]);
    }
    const staffRows = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id'])
      .where('id', 'in', staffIds)
      .execute();
    if (staffRows.length !== staffIds.length) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    if (staffRows.some((row) => !inScope(scope, row.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Có nhân sự nằm ngoài phạm vi của bạn');
    }
    const values = {
      rule_set_id: input.ruleSetId,
      subject_group: input.subjectGroup,
      school_level: input.schoolLevel,
      job_position: input.jobPosition,
      is_head: input.isHead,
      superior_staff_id: input.superiorStaffId,
      excluded: input.excluded,
      updated_at: this.support.clock.now(),
    };
    await database.transaction().execute(async (transaction) => {
      for (const row of staffRows) {
        await transaction
          .insertInto('kpi_profiles')
          .values({ staff_id: row.id, ...values, created_by: origin.actorUserId })
          .onConflict((conflict) => conflict.column('staff_id').doUpdateSet(values))
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'kpi_profiles',
          entityId: row.id,
          action: 'update',
          before: null,
          after: values,
        });
      }
    });
    return { saved: staffRows.length };
  }

  async periods() {
    const database = await this.support.database();
    const periods = await database.selectFrom('kpi_periods').selectAll().orderBy('start_date', 'desc').execute();
    const versions = await database
      .selectFrom('kpi_period_rule_versions')
      .innerJoin('kpi_rule_set_versions', 'kpi_rule_set_versions.id', 'kpi_period_rule_versions.rule_set_version_id')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_period_rule_versions.rule_set_id')
      .select([
        'kpi_period_rule_versions.period_id',
        'kpi_period_rule_versions.rule_set_id',
        'kpi_period_rule_versions.rule_set_version_id',
        'kpi_rule_sets.name as rule_set_name',
        'kpi_rule_set_versions.version_no',
      ])
      .execute();
    return periods.map((period) => ({
      ...period,
      rule_versions: versions.filter((version) => version.period_id === period.id),
    }));
  }

  // Kỳ mới áp phiên bản đã ban hành mới nhất của mỗi bộ quy tắc đang dùng
  async createPeriod(input: PeriodInput, origin: ChangeOrigin) {
    const database = await this.support.database();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const period = await transaction
          .insertInto('kpi_periods')
          .values({
            code: input.code,
            name: input.name,
            period_type: input.periodType,
            start_date: input.startDate,
            end_date: input.endDate,
            ...input.phases,
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        const latest = await transaction
          .selectFrom('kpi_rule_set_versions')
          .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_rule_set_versions.rule_set_id')
          .select(['kpi_rule_set_versions.rule_set_id', sql<string>`(array_agg(kpi_rule_set_versions.id order by version_no desc))[1]`.as('version_id')])
          .where('kpi_rule_set_versions.status', '=', 'published')
          .where('kpi_rule_sets.status', '=', 'active')
          .groupBy('kpi_rule_set_versions.rule_set_id')
          .execute();
        if (latest.length > 0) {
          await transaction
            .insertInto('kpi_period_rule_versions')
            .values(
              latest.map((row) => ({
                period_id: period.id,
                rule_set_id: row.rule_set_id,
                rule_set_version_id: row.version_id,
              })),
            )
            .execute();
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'kpi_periods',
          entityId: period.id,
          action: 'create',
          before: null,
          after: period,
        });
        return period;
      }),
      'Mã kỳ đã có',
      'code',
    );
  }

  async updatePeriod(periodId: string, input: Partial<PeriodInput>, origin: ChangeOrigin) {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    this.support.assertOpen(period);
    const before = await database.selectFrom('kpi_periods').selectAll().where('id', '=', periodId).executeTakeFirstOrThrow();
    const startDate = input.startDate ?? before.start_date;
    const endDate = input.endDate ?? before.end_date;
    if (startDate > endDate) {
      throw validationError([{ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('kpi_periods')
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.periodType !== undefined ? { period_type: input.periodType } : {}),
          start_date: startDate,
          end_date: endDate,
          ...(input.phases ?? {}),
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', periodId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_periods',
        entityId: periodId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  // Đổi phiên bản quy tắc của một bộ trong kỳ đang mở; phiếu chưa nộp chuyển sang phiên bản mới, phiếu đã nộp giữ phiên bản
  // cũ cho đến khi bị trả lại
  async setPeriodVersion(periodId: string, ruleSetId: string, versionId: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    this.support.assertOpen(period);
    const version = await this.version(versionId);
    if (version.rule_set_id !== ruleSetId || version.status !== 'published') {
      throw validationError([{ field: 'rule_set_version_id', message: 'Chọn phiên bản đã ban hành của bộ quy tắc' }]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('kpi_period_rule_versions')
        .values({ period_id: periodId, rule_set_id: ruleSetId, rule_set_version_id: versionId })
        .onConflict((conflict) => conflict.columns(['period_id', 'rule_set_id']).doUpdateSet({ rule_set_version_id: versionId }))
        .execute();
      const drafts = await transaction
        .selectFrom('kpi_evaluations')
        .innerJoin('kpi_rule_set_versions', 'kpi_rule_set_versions.id', 'kpi_evaluations.rule_set_version_id')
        .select(['kpi_evaluations.id', 'kpi_evaluations.staff_id'])
        .where('kpi_evaluations.period_id', '=', periodId)
        .where('kpi_rule_set_versions.rule_set_id', '=', ruleSetId)
        .where('kpi_evaluations.status', 'in', ['draft', 'returned'])
        .execute();
      for (const draft of drafts) {
        await transaction.deleteFrom('kpi_evaluations').where('id', '=', draft.id).execute();
        await this.support.ensureEvaluation(transaction, periodId, draft.staff_id);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_period_rule_versions',
        entityId: periodId,
        action: 'update',
        before: null,
        after: { rule_set_id: ruleSetId, rule_set_version_id: versionId, reset_drafts: drafts.length },
      });
    });
    return this.periods();
  }

  private async defaultConfig(database: Executor): Promise<KpiRuleConfig> {
    const version = await database
      .selectFrom('kpi_rule_set_versions')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_rule_set_versions.rule_set_id')
      .select('kpi_rule_set_versions.id')
      .where('kpi_rule_set_versions.status', '=', 'published')
      .orderBy('kpi_rule_sets.is_default', 'desc')
      .orderBy('kpi_rule_set_versions.version_no', 'desc')
      .executeTakeFirst();
    if (!version) {
      throw kpiRule('Chưa có phiên bản quy tắc đã ban hành để chép');
    }
    return this.support.config(database, version.id);
  }
}

function readCode(body: RequestBody, errors: FieldError[]): string {
  const code = readWorkText(body, 'code', errors, { required: true, maximum: 30 }) ?? '';
  if (code && !/^[A-Za-z0-9._-]+$/.test(code)) {
    errors.push({ field: 'code', message: 'Mã chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang' });
  }
  return code.toUpperCase();
}

function readPeriodInput(body: RequestBody, errors: FieldError[], required: boolean): Partial<PeriodInput> {
  const has = (field: string) => required || body?.[field] !== undefined;
  const periodType = body?.period_type as KpiPeriodType;
  if (has('period_type') && !PERIOD_TYPES.includes(periodType)) {
    errors.push({ field: 'period_type', message: 'Loại kỳ là month, quarter, term, year hoặc custom' });
  }
  const phases: PeriodInput['phases'] = {};
  for (const field of PHASES) {
    if (body?.[field] !== undefined) {
      phases[field] = readWorkDate(body, field, errors);
    }
  }
  for (const [from, to] of [
    ['register_from', 'register_to'],
    ['self_from', 'self_to'],
    ['review_from', 'review_to'],
    ['advisory_from', 'advisory_to'],
  ] as const) {
    if (phases[from] && phases[to] && phases[from]! > phases[to]!) {
      errors.push({ field: to, message: 'Ngày kết thúc không trước ngày bắt đầu' });
    }
  }
  const startDate = has('start_date') ? readWorkDate(body, 'start_date', errors, true) : undefined;
  const endDate = has('end_date') ? readWorkDate(body, 'end_date', errors, true) : undefined;
  if (startDate && endDate && startDate > endDate) {
    errors.push({ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' });
  }
  return {
    ...(required ? { code: readCode(body, errors) } : {}),
    ...(has('name') ? { name: readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? '' } : {}),
    ...(has('period_type') ? { periodType } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    phases,
  };
}

function readProfile(body: RequestBody, errors: FieldError[]): ProfileInput {
  const subjectGroup = (body?.subject_group ?? 'staff') as KpiSubjectGroup;
  if (!SUBJECT_GROUPS.includes(subjectGroup)) {
    errors.push({ field: 'subject_group', message: 'Nhóm đối tượng là leader hoặc staff' });
  }
  const schoolLevel = (body?.school_level ?? null) as KpiSchoolLevel | null;
  if (schoolLevel !== null && !LEVELS.includes(schoolLevel)) {
    errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
  }
  if (!isUuid(body?.rule_set_id)) {
    errors.push({ field: 'rule_set_id', message: 'Chọn bộ quy tắc' });
  }
  const superior = body?.superior_staff_id ?? null;
  if (superior !== null && !isUuid(superior)) {
    errors.push({ field: 'superior_staff_id', message: 'Mã cấp trên không hợp lệ' });
  }
  return {
    ruleSetId: (body?.rule_set_id as string) ?? '',
    subjectGroup,
    schoolLevel,
    jobPosition: readWorkText(body, 'job_position', errors, { maximum: 50 }),
    isHead: body?.is_head === true,
    superiorStaffId: superior as string | null,
    excluded: body?.excluded === true,
  };
}

@Controller('kpi')
export class KpiSetupController {
  constructor(private readonly setup: KpiSetupService) {}

  @Get('rule-sets')
  @RequirePermission(...ANY_KPI)
  ruleSets() {
    return this.setup.ruleSets();
  }

  @Get('rule-versions/:id')
  @RequirePermission(...ANY_KPI)
  version(@Param('id', uuidParameter('Mã phiên bản không hợp lệ')) versionId: string) {
    return this.setup.version(versionId);
  }

  @Post('rule-sets')
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.configure)
  createRuleSet(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const copyFrom = body?.copy_from_version_id ?? null;
    if (copyFrom !== null && !isUuid(copyFrom)) {
      errors.push({ field: 'copy_from_version_id', message: 'Mã phiên bản không hợp lệ' });
    }
    const input = {
      code: readCode(body, errors),
      name: readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      description: readWorkText(body, 'description', errors, { maximum: 1000 }),
      copyFromVersionId: copyFrom as string | null,
    };
    check(errors);
    return this.setup.createRuleSet(input, originOf(request, currentUser));
  }

  @Patch('rule-sets/:id')
  @RequirePermission(KPI_PERMISSIONS.configure)
  updateRuleSet(
    @Param('id', uuidParameter('Mã bộ quy tắc không hợp lệ')) ruleSetId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const status = body?.status as 'active' | 'inactive' | undefined;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
    }
    const patch = {
      name:
        body?.name === undefined ? undefined : (readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? ''),
      description: body?.description === undefined ? undefined : readWorkText(body, 'description', errors, { maximum: 1000 }),
      status,
      isDefault: body?.is_default === undefined ? undefined : body.is_default === true,
    };
    check(errors);
    return this.setup.updateRuleSet(ruleSetId, patch, originOf(request, currentUser));
  }

  @Post('rule-sets/:id/versions')
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.configure)
  createVersion(
    @Param('id', uuidParameter('Mã bộ quy tắc không hợp lệ')) ruleSetId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const copyFrom = body?.copy_from_version_id ?? null;
    if (copyFrom !== null && !isUuid(copyFrom)) {
      errors.push({ field: 'copy_from_version_id', message: 'Mã phiên bản không hợp lệ' });
    }
    const note = readWorkText(body, 'note', errors, { maximum: 1000 });
    check(errors);
    return this.setup.createVersion(
      ruleSetId,
      { copyFromVersionId: copyFrom as string | null, note },
      originOf(request, currentUser),
    );
  }

  @Patch('rule-versions/:id')
  @RequirePermission(KPI_PERMISSIONS.configure)
  updateVersion(
    @Param('id', uuidParameter('Mã phiên bản không hợp lệ')) versionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.config !== undefined && (typeof body.config !== 'object' || body.config === null)) {
      errors.push({ field: 'config', message: 'Cấu hình là đối tượng JSON' });
    }
    const note = body?.note === undefined ? undefined : readWorkText(body, 'note', errors, { maximum: 1000 });
    check(errors);
    return this.setup.updateVersion(
      versionId,
      { config: body?.config as KpiRuleConfig | undefined, note },
      originOf(request, currentUser),
    );
  }

  @Post('rule-versions/:id/publish')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.configure)
  publishVersion(
    @Param('id', uuidParameter('Mã phiên bản không hợp lệ')) versionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.setup.publishVersion(versionId, originOf(request, currentUser));
  }

  @Delete('rule-versions/:id')
  @HttpCode(204)
  @RequirePermission(KPI_PERMISSIONS.configure)
  async deleteVersion(
    @Param('id', uuidParameter('Mã phiên bản không hợp lệ')) versionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.setup.deleteVersion(versionId, originOf(request, currentUser));
  }

  @Get('profiles')
  @RequirePermission(KPI_PERMISSIONS.configure)
  profiles(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.setup.profiles(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      keyword: query.q?.trim() || null,
    });
  }

  // Ghi hồ sơ đối tượng cho một hoặc nhiều nhân sự cùng lúc
  @Put('profiles')
  @RequirePermission(KPI_PERMISSIONS.configure)
  saveProfiles(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = body?.staff_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || ids.some((id) => !isUuid(id))) {
      errors.push({ field: 'staff_ids', message: 'Chọn từ 1 đến 500 nhân sự' });
    }
    const input = readProfile(body, errors);
    check(errors);
    return this.setup.saveProfiles(currentUser, [...new Set(ids as string[])], input, originOf(request, currentUser));
  }

  @Get('periods')
  @RequirePermission(...ANY_KPI)
  periods() {
    return this.setup.periods();
  }

  @Post('periods')
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.configure)
  createPeriod(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readPeriodInput(body, errors, true);
    check(errors);
    return this.setup.createPeriod(input as PeriodInput, originOf(request, currentUser));
  }

  @Patch('periods/:id')
  @RequirePermission(KPI_PERMISSIONS.configure)
  updatePeriod(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readPeriodInput(body, errors, false);
    check(errors);
    return this.setup.updatePeriod(periodId, input, originOf(request, currentUser));
  }

  @Put('periods/:id/rule-versions')
  @RequirePermission(KPI_PERMISSIONS.configure)
  setPeriodVersion(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['rule_set_id', 'rule_set_version_id']) {
      if (!isUuid(body?.[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    check(errors);
    return this.setup.setPeriodVersion(
      periodId,
      body!.rule_set_id as string,
      body!.rule_set_version_id as string,
      originOf(request, currentUser),
    );
  }
}
