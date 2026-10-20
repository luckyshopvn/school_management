import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { KpiCatalogStatus, KpiSchoolLevel } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { KPI_SCHOOL_LEVELS, type KpiRuleConfig } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { conflictOnDuplicate, isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildTableFile } from '../exports/table-file.js';
import { fileStamp } from '../facilities/facilities-workbook.js';
import {
  buildErrorWorkbook,
  buildTemplate,
  MAXIMUM_IMPORT_BYTES,
  readSheet,
  type ImportColumn,
  type RowError,
} from '../imports/excel.js';
import { readWorkText } from '../work/work-access.js';
import { check, inScope, KPI_PERMISSIONS, kpiRule, KpiSupport, type Executor } from './kpi-support.js';

// Danh mục công việc chuẩn (DT-18 phần 18d, YCTD-139): danh mục chung của trường (người cấu hình lập) và danh mục của từng
// đơn vị (người quản lý đơn vị lập); mỗi dòng theo bộ quy tắc, trục, loại công việc, hệ số độ khó; chỉ báo theo vị trí việc
// làm và cấp học của bộ quy tắc 2. Cán bộ đề xuất thêm việc vào danh mục của đơn vị, người quản lý duyệt hoặc không duyệt.
// Nhập từ Excel kiểm tra cả tệp trước khi ghi; nội dung mật chỉ ghi mã công việc hoặc số văn bản
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const LEVELS = KPI_SCHOOL_LEVELS.map((level) => level.value);
const READ_PERMISSIONS = [
  KPI_PERMISSIONS.participate,
  KPI_PERMISSIONS.manage,
  KPI_PERMISSIONS.advise,
  KPI_PERMISSIONS.configure,
];

const COLUMNS: ImportColumn[] = [
  {
    key: 'code',
    header: 'Mã công việc',
    note: 'Bắt buộc, chữ không dấu, số, dấu chấm, gạch ngang; không trùng trong danh mục',
  },
  { key: 'name', header: 'Tên công việc', note: 'Bắt buộc; việc mật chỉ ghi mã công việc hoặc số văn bản' },
  { key: 'output_result', header: 'Kết quả đầu ra', note: 'Báo cáo, kế hoạch, công văn...' },
  { key: 'axis', header: 'Trục', note: 'Mã trục của bộ quy tắc, xem trang Danh mục' },
  { key: 'task_type', header: 'Loại công việc', note: 'Mã loại công việc, bỏ trống là loại đầu tiên' },
  { key: 'difficulty', header: 'Hệ số độ khó', note: 'Mã hệ số độ khó, bỏ trống là mức đầu tiên' },
  { key: 'expected_evidence', header: 'Minh chứng dự kiến', note: '' },
  { key: 'deadline_hint', header: 'Thời hạn hoàn thành', note: 'Ghi chữ, ví dụ "Trong quý", "Hằng tháng"' },
  { key: 'school_level', header: 'Cấp học', note: 'MN, TH, THCS, THPT; bỏ trống là mọi cấp' },
  { key: 'job_position', header: 'Vị trí việc làm', note: 'Mã vị trí của bộ quy tắc, bỏ trống là mọi vị trí' },
  { key: 'is_required', header: 'Bắt buộc đăng ký', note: 'Ghi "x" hoặc "*" nếu bắt buộc' },
  { key: 'is_confidential', header: 'Mật', note: 'Ghi "x" nếu nội dung mật' },
];

export interface CatalogInput {
  orgUnitId: string | null;
  ruleSetId: string | null;
  code: string;
  name: string;
  outputResult: string | null;
  axisCode: string;
  taskType: string | null;
  difficultyCode: string | null;
  expectedEvidence: string | null;
  deadlineHint: string | null;
  schoolLevel: KpiSchoolLevel | null;
  jobPosition: string | null;
  isRequired: boolean;
  isConfidential: boolean;
}

export interface CatalogFilter {
  orgUnitId: string | null;
  common: boolean;
  ruleSetId: string | null;
  status: KpiCatalogStatus | null;
  schoolLevel: KpiSchoolLevel | null;
  jobPosition: string | null;
  keyword: string | null;
}

@Injectable()
export class KpiCatalogService {
  constructor(private readonly support: KpiSupport) {}

  // Người cấu hình xem mọi danh mục; người quản lý xem danh mục chung và của đơn vị trong phạm vi; cán bộ xem danh mục chung
  // và của đơn vị mình
  private async readableUnits(
    database: Executor,
    currentUser: CurrentUser,
  ): Promise<{ all: boolean; units: string[] }> {
    if (currentUser.hasPermission(KPI_PERMISSIONS.configure) || currentUser.hasPermission(KPI_PERMISSIONS.advise)) {
      const scope = await this.support.scope(
        currentUser,
        currentUser.hasPermission(KPI_PERMISSIONS.configure) ? KPI_PERMISSIONS.configure : KPI_PERMISSIONS.advise,
      );
      if (scope.wholeSchool) {
        return { all: true, units: [] };
      }
    }
    const managed = currentUser.hasPermission(KPI_PERMISSIONS.manage)
      ? await this.support.scope(currentUser, KPI_PERMISSIONS.manage)
      : { wholeSchool: false, orgUnitIds: [] };
    if (managed.wholeSchool) {
      return { all: true, units: [] };
    }
    const own = await this.support.findOwnStaff(database, currentUser);
    return { all: false, units: [...new Set([...managed.orgUnitIds, ...(own ? [own.org_unit_id] : [])])] };
  }

  async list(currentUser: CurrentUser, filter: CatalogFilter) {
    const database = await this.support.database();
    const readable = await this.readableUnits(database, currentUser);
    if (filter.orgUnitId && !readable.all && !readable.units.includes(filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    let query = database
      .selectFrom('kpi_catalog_items')
      .leftJoin('org_units', 'org_units.id', 'kpi_catalog_items.org_unit_id')
      .leftJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_catalog_items.rule_set_id')
      .selectAll('kpi_catalog_items')
      .select(['org_units.name as org_unit_name', 'kpi_rule_sets.name as rule_set_name'])
      .orderBy('kpi_catalog_items.code');
    if (filter.common) {
      query = query.where('kpi_catalog_items.org_unit_id', 'is', null);
    } else if (filter.orgUnitId) {
      query = query.where('kpi_catalog_items.org_unit_id', '=', filter.orgUnitId);
    } else if (!readable.all) {
      query = query.where((eb) =>
        eb.or([
          eb('kpi_catalog_items.org_unit_id', 'is', null),
          ...(readable.units.length ? [eb('kpi_catalog_items.org_unit_id', 'in', readable.units)] : []),
        ]),
      );
    }
    if (filter.ruleSetId) {
      query = query.where((eb) =>
        eb.or([
          eb('kpi_catalog_items.rule_set_id', '=', filter.ruleSetId),
          eb('kpi_catalog_items.rule_set_id', 'is', null),
        ]),
      );
    }
    if (filter.status) {
      query = query.where('kpi_catalog_items.status', '=', filter.status);
    }
    if (filter.schoolLevel) {
      query = query.where((eb) =>
        eb.or([
          eb('kpi_catalog_items.school_level', '=', filter.schoolLevel),
          eb('kpi_catalog_items.school_level', 'is', null),
        ]),
      );
    }
    if (filter.jobPosition) {
      query = query.where((eb) =>
        eb.or([
          eb('kpi_catalog_items.job_position', '=', filter.jobPosition),
          eb('kpi_catalog_items.job_position', 'is', null),
        ]),
      );
    }
    if (filter.keyword) {
      const pattern = `%${filter.keyword}%`;
      query = query.where((eb) =>
        eb.or([eb('kpi_catalog_items.name', 'ilike', pattern), eb('kpi_catalog_items.code', 'ilike', pattern)]),
      );
    }
    return query.limit(5000).execute();
  }

  // Số chỉ báo đã nhập theo cấp học so với số mong đợi của bộ quy tắc (bộ quy tắc 2: MN 48, TH 65, THCS 66, THPT 66)
  async indicatorProgress() {
    const database = await this.support.database();
    const sets = await database
      .selectFrom('kpi_rule_sets')
      .innerJoin('kpi_rule_set_versions', 'kpi_rule_set_versions.rule_set_id', 'kpi_rule_sets.id')
      .select(['kpi_rule_sets.id', 'kpi_rule_sets.name', 'kpi_rule_set_versions.id as version_id'])
      .where('kpi_rule_set_versions.status', '=', 'published')
      .orderBy('kpi_rule_set_versions.version_no', 'desc')
      .execute();
    const counts = await database
      .selectFrom('kpi_catalog_items')
      .select(['rule_set_id', 'school_level', (eb) => eb.fn.countAll<string>().as('total')])
      .where('status', '=', 'active')
      .groupBy(['rule_set_id', 'school_level'])
      .execute();
    const seen = new Set<string>();
    const result = [];
    for (const set of sets) {
      if (seen.has(set.id)) {
        continue;
      }
      seen.add(set.id);
      const config = await this.support.config(database, set.version_id);
      for (const [level, target] of Object.entries(config.indicator_targets ?? {})) {
        const entered = counts
          .filter((row) => row.rule_set_id === set.id && row.school_level === level)
          .reduce((sum, row) => sum + Number(row.total), 0);
        result.push({ rule_set_id: set.id, rule_set_name: set.name, school_level: level, target, entered });
      }
    }
    return result;
  }

  // Danh mục chung do người cấu hình sửa; danh mục đơn vị do người quản lý đơn vị (hoặc người cấu hình) sửa
  private async assertEditor(currentUser: CurrentUser, orgUnitId: string | null): Promise<void> {
    if (orgUnitId === null) {
      if (!(await this.support.scope(currentUser, KPI_PERMISSIONS.configure)).wholeSchool) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người cấu hình toàn trường sửa danh mục chung');
      }
      return;
    }
    const [configure, manage] = await Promise.all([
      this.support.scope(currentUser, KPI_PERMISSIONS.configure),
      this.support.scope(currentUser, KPI_PERMISSIONS.manage),
    ]);
    if (!inScope(configure, orgUnitId) && !inScope(manage, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền sửa danh mục của đơn vị này');
    }
  }

  private async ruleConfig(database: Executor, ruleSetId: string | null): Promise<KpiRuleConfig> {
    let query = database
      .selectFrom('kpi_rule_set_versions')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_rule_set_versions.rule_set_id')
      .select('kpi_rule_set_versions.id')
      .where('kpi_rule_set_versions.status', '=', 'published')
      .orderBy('kpi_rule_set_versions.version_no', 'desc');
    query = ruleSetId
      ? query.where('kpi_rule_sets.id', '=', ruleSetId)
      : query.orderBy('kpi_rule_sets.is_default', 'desc');
    const version = await query.executeTakeFirst();
    if (!version) {
      throw validationError([{ field: 'rule_set_id', message: 'Bộ quy tắc chưa có phiên bản đã ban hành' }]);
    }
    return this.support.config(database, version.id);
  }

  // Kiểm tra mã trục, loại công việc, hệ số độ khó, vị trí theo cấu hình; trả giá trị đã điền mặc định
  private resolveCodes(config: KpiRuleConfig, input: CatalogInput, errors: FieldError[]) {
    if (!config.axes.some((axis) => axis.code === input.axisCode)) {
      errors.push({ field: 'axis_code', message: 'Trục không có trong bộ quy tắc' });
    }
    const taskType = input.taskType ?? config.task_types[0]?.code ?? '';
    if (!config.task_types.some((item) => item.code === taskType)) {
      errors.push({ field: 'task_type', message: 'Loại công việc không có trong bộ quy tắc' });
    }
    const difficulty = input.difficultyCode ?? config.difficulty_levels[0]?.code ?? '';
    if (!config.difficulty_levels.some((item) => item.code === difficulty)) {
      errors.push({ field: 'difficulty_code', message: 'Hệ số độ khó không có trong bộ quy tắc' });
    }
    if (input.jobPosition && !config.job_positions.some((item) => item.code === input.jobPosition)) {
      errors.push({ field: 'job_position', message: 'Vị trí việc làm không có trong bộ quy tắc' });
    }
    return { taskType, difficulty };
  }

  async create(currentUser: CurrentUser, input: CatalogInput, origin: ChangeOrigin) {
    await this.assertEditor(currentUser, input.orgUnitId);
    const database = await this.support.database();
    const config = await this.ruleConfig(database, input.ruleSetId);
    const errors: FieldError[] = [];
    const codes = this.resolveCodes(config, input, errors);
    check(errors);
    return this.insert(database, input, codes, 'active', origin);
  }

  // Cán bộ đề xuất thêm việc vào danh mục của đơn vị mình; người quản lý đơn vị duyệt
  async propose(currentUser: CurrentUser, input: CatalogInput, origin: ChangeOrigin) {
    const database = await this.support.database();
    const own = await this.support.ownStaff(database, currentUser);
    const config = await this.ruleConfig(database, input.ruleSetId);
    const errors: FieldError[] = [];
    const codes = this.resolveCodes(config, input, errors);
    check(errors);
    return this.insert(database, { ...input, orgUnitId: own.org_unit_id }, codes, 'proposed', origin);
  }

  private async insert(
    database: Executor,
    input: CatalogInput,
    codes: { taskType: string; difficulty: string },
    status: KpiCatalogStatus,
    origin: ChangeOrigin,
  ) {
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('kpi_catalog_items')
          .values({
            org_unit_id: input.orgUnitId,
            rule_set_id: input.ruleSetId,
            code: input.code,
            name: input.name,
            output_result: input.outputResult,
            axis_code: input.axisCode,
            task_type: codes.taskType,
            difficulty_code: codes.difficulty,
            expected_evidence: input.expectedEvidence,
            deadline_hint: input.deadlineHint,
            school_level: input.schoolLevel,
            job_position: input.jobPosition,
            is_required: input.isRequired,
            is_confidential: input.isConfidential,
            status,
            ...(status === 'proposed' ? { proposed_by: origin.actorUserId, proposed_by_name: origin.actorName } : {}),
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.orgUnitId,
          entityName: 'kpi_catalog_items',
          entityId: row.id,
          action: 'create',
          before: null,
          after: row,
        });
        return row;
      }),
      'Mã công việc đã có trong danh mục',
      'code',
    );
  }

  private async find(database: Executor, itemId: string) {
    const item = await database.selectFrom('kpi_catalog_items').selectAll().where('id', '=', itemId).executeTakeFirst();
    if (!item) {
      throw notFoundError('Không tìm thấy công việc trong danh mục', 'kpi_catalog_item');
    }
    return item;
  }

  async update(
    currentUser: CurrentUser,
    itemId: string,
    input: Partial<CatalogInput> & { status?: KpiCatalogStatus },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const before = await this.find(database, itemId);
    await this.assertEditor(currentUser, before.org_unit_id);
    if (input.status && !['active', 'inactive'].includes(input.status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là active hoặc inactive' }]);
    }
    if (before.status === 'proposed' || before.status === 'rejected') {
      throw kpiRule('Đề xuất chưa duyệt thì duyệt hoặc không duyệt trước');
    }
    const merged: CatalogInput = {
      orgUnitId: before.org_unit_id,
      ruleSetId: input.ruleSetId !== undefined ? input.ruleSetId : before.rule_set_id,
      code: before.code,
      name: input.name ?? before.name,
      outputResult: input.outputResult !== undefined ? input.outputResult : before.output_result,
      axisCode: input.axisCode ?? before.axis_code,
      taskType: input.taskType ?? before.task_type,
      difficultyCode: input.difficultyCode ?? before.difficulty_code,
      expectedEvidence: input.expectedEvidence !== undefined ? input.expectedEvidence : before.expected_evidence,
      deadlineHint: input.deadlineHint !== undefined ? input.deadlineHint : before.deadline_hint,
      schoolLevel: input.schoolLevel !== undefined ? input.schoolLevel : before.school_level,
      jobPosition: input.jobPosition !== undefined ? input.jobPosition : before.job_position,
      isRequired: input.isRequired ?? before.is_required,
      isConfidential: input.isConfidential ?? before.is_confidential,
    };
    const config = await this.ruleConfig(database, merged.ruleSetId);
    const errors: FieldError[] = [];
    const codes = this.resolveCodes(config, merged, errors);
    check(errors);
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('kpi_catalog_items')
        .set({
          rule_set_id: merged.ruleSetId,
          name: merged.name,
          output_result: merged.outputResult,
          axis_code: merged.axisCode,
          task_type: codes.taskType,
          difficulty_code: codes.difficulty,
          expected_evidence: merged.expectedEvidence,
          deadline_hint: merged.deadlineHint,
          school_level: merged.schoolLevel,
          job_position: merged.jobPosition,
          is_required: merged.isRequired,
          is_confidential: merged.isConfidential,
          ...(input.status ? { status: input.status } : {}),
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', itemId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'kpi_catalog_items',
        entityId: itemId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  async decide(currentUser: CurrentUser, itemId: string, approve: boolean, note: string | null, origin: ChangeOrigin) {
    const database = await this.support.database();
    const before = await this.find(database, itemId);
    if (before.status !== 'proposed') {
      throw kpiRule('Chỉ duyệt được đề xuất đang chờ');
    }
    await this.assertEditor(currentUser, before.org_unit_id);
    if (!approve && !note) {
      throw validationError([{ field: 'note', message: 'Bắt buộc ghi lý do không duyệt' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('kpi_catalog_items')
        .set({
          status: approve ? 'active' : 'rejected',
          decided_by: origin.actorUserId,
          decided_by_name: origin.actorName,
          decided_at: this.support.clock.now(),
          decision_note: note,
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', itemId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'kpi_catalog_items',
        entityId: itemId,
        action: 'update',
        before: { status: before.status },
        after: { status: after.status, decision_note: note },
      });
      if (before.proposed_by) {
        const proposer = await transaction
          .selectFrom('staff')
          .select('id')
          .where('user_id', '=', before.proposed_by)
          .executeTakeFirst();
        await this.support.notifyStaff(transaction, proposer?.id ?? null, {
          title: approve ? 'Đề xuất danh mục được duyệt' : 'Đề xuất danh mục không được duyệt',
          body: `${before.code} — ${before.name}${note ? `: ${note}` : ''}`,
          targetId: itemId,
          orgUnitId: before.org_unit_id,
        });
      }
      return after;
    });
  }

  async template(ruleSetId: string | null): Promise<Buffer> {
    const database = await this.support.database();
    const config = await this.ruleConfig(database, ruleSetId);
    return buildTemplate('Danh mục công việc', COLUMNS, {
      catalogs: [
        {
          key: 'axis',
          title: 'Trục',
          column: 'Trục',
          items: config.axes.map((axis) => ({ code: axis.code, name: axis.name })),
        },
        {
          key: 'task_type',
          title: 'Loại công việc',
          column: 'Loại công việc',
          items: config.task_types.map((item) => ({
            code: item.code,
            name: item.name,
            note: `Điểm chuẩn ${item.standard_score}`,
          })),
        },
        {
          key: 'difficulty',
          title: 'Hệ số độ khó',
          column: 'Hệ số độ khó',
          items: config.difficulty_levels.map((item) => ({
            code: item.code,
            name: item.label,
            note: `${item.weight}`,
          })),
        },
        {
          key: 'job_position',
          title: 'Vị trí việc làm',
          column: 'Vị trí việc làm',
          items: config.job_positions.map((item) => ({
            code: item.code,
            name: item.label,
            note: item.levels.join(', '),
          })),
        },
      ],
    });
  }

  // Nhập từ Excel vào danh mục chung hoặc danh mục của đơn vị; có lỗi thì không ghi dòng nào
  async import(
    currentUser: CurrentUser,
    target: { orgUnitId: string | null; ruleSetId: string | null },
    body: Buffer,
    origin: ChangeOrigin,
    errorFile: boolean,
  ): Promise<{ created: number; errors: RowError[] } | { errorWorkbook: Buffer }> {
    await this.assertEditor(currentUser, target.orgUnitId);
    const database = await this.support.database();
    const config = await this.ruleConfig(database, target.ruleSetId);
    const sheet = await readSheet(body, COLUMNS);
    const existing = new Set(
      (
        await database
          .selectFrom('kpi_catalog_items')
          .select('code')
          .where((eb) => (target.orgUnitId ? eb('org_unit_id', '=', target.orgUnitId) : eb('org_unit_id', 'is', null)))
          .where('status', '!=', 'rejected')
          .execute()
      ).map((row) => row.code.toUpperCase()),
    );
    const errors: RowError[] = [];
    const inputs: Array<{ input: CatalogInput; codes: { taskType: string; difficulty: string } }> = [];
    const seen = new Set<string>();
    const header = (key: string) => COLUMNS.find((column) => column.key === key)?.header ?? key;
    const flag = (text: string) => ['x', '*', 'có', 'co', '1'].includes(text.trim().toLowerCase());
    for (const row of sheet) {
      const text = (key: string) => (row.values[key] ?? '').trim();
      const fail = (key: string, message: string) => errors.push({ row: row.row, column: header(key), message });
      const code = text('code').toUpperCase();
      if (!/^[A-Z0-9._-]{1,30}$/.test(code)) {
        fail('code', 'Bắt buộc, tối đa 30 ký tự chữ không dấu, số, dấu chấm, gạch ngang');
      } else if (existing.has(code) || seen.has(code)) {
        fail('code', 'Mã công việc bị trùng');
      }
      seen.add(code);
      const name = text('name');
      if (!name || name.length > 1000) {
        fail('name', 'Bắt buộc, tối đa 1000 ký tự');
      }
      const level = text('school_level').toUpperCase() as KpiSchoolLevel;
      if (level && !LEVELS.includes(level)) {
        fail('school_level', 'Cấp học là MN, TH, THCS hoặc THPT');
      }
      const input: CatalogInput = {
        orgUnitId: target.orgUnitId,
        ruleSetId: target.ruleSetId,
        code,
        name,
        outputResult: text('output_result').slice(0, 500) || null,
        axisCode: text('axis'),
        taskType: text('task_type') || null,
        difficultyCode: text('difficulty') || null,
        expectedEvidence: text('expected_evidence').slice(0, 500) || null,
        deadlineHint: text('deadline_hint').slice(0, 200) || null,
        schoolLevel: level || null,
        jobPosition: text('job_position') || null,
        isRequired: flag(text('is_required')),
        isConfidential: flag(text('is_confidential')),
      };
      const fieldErrors: FieldError[] = [];
      const codes = this.resolveCodes(config, input, fieldErrors);
      const fieldColumn: Record<string, string> = {
        axis_code: 'axis',
        task_type: 'task_type',
        difficulty_code: 'difficulty',
        job_position: 'job_position',
      };
      for (const error of fieldErrors) {
        fail(fieldColumn[error.field] ?? error.field, error.message);
      }
      inputs.push({ input, codes });
    }
    if (errors.length > 0) {
      if (errorFile) {
        return { errorWorkbook: buildErrorWorkbook(body, errors, 1) };
      }
      return { created: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      for (const { input, codes } of inputs) {
        await transaction
          .insertInto('kpi_catalog_items')
          .values({
            org_unit_id: input.orgUnitId,
            rule_set_id: input.ruleSetId,
            code: input.code,
            name: input.name,
            output_result: input.outputResult,
            axis_code: input.axisCode,
            task_type: codes.taskType,
            difficulty_code: codes.difficulty,
            expected_evidence: input.expectedEvidence,
            deadline_hint: input.deadlineHint,
            school_level: input.schoolLevel,
            job_position: input.jobPosition,
            is_required: input.isRequired,
            is_confidential: input.isConfidential,
            created_by: origin.actorUserId,
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: target.orgUnitId,
        entityName: 'kpi_catalog_items',
        entityId: target.orgUnitId ?? target.ruleSetId ?? origin.actorUserId,
        action: 'create',
        before: null,
        after: { imported: inputs.length },
      });
    });
    return { created: inputs.length, errors: [] };
  }

  async export(currentUser: CurrentUser, filter: CatalogFilter) {
    const rows = await this.list(currentUser, filter);
    const now = this.support.clock.now();
    const buffer = await buildTableFile(
      'xlsx',
      [
        {
          title: 'Danh mục công việc',
          numbered: true,
          columns: [
            { key: 'code', label: 'Mã công việc', width: 14 },
            { key: 'name', label: 'Tên công việc', width: 60 },
            { key: 'output_result', label: 'Kết quả đầu ra', width: 30 },
            { key: 'axis_code', label: 'Trục', width: 10 },
            { key: 'task_type', label: 'Loại công việc', width: 14 },
            { key: 'difficulty_code', label: 'Hệ số độ khó', width: 12 },
            { key: 'school_level', label: 'Cấp học', width: 10 },
            { key: 'job_position', label: 'Vị trí việc làm', width: 16 },
            { key: 'org_unit_name', label: 'Đơn vị', width: 24 },
            { key: 'status', label: 'Trạng thái', width: 12 },
          ],
          rows: rows.map((row) => ({
            ...row,
            name: row.is_confidential ? `(Mật) ${row.name}` : row.name,
            org_unit_name: row.org_unit_name ?? 'Danh mục chung',
          })),
        },
      ],
      now,
    );
    return { buffer, fileName: `danh-muc-cong-viec-${fileStamp(now)}.xlsx` };
  }
}

function readCatalogInput(body: RequestBody, errors: FieldError[], creating: boolean): Partial<CatalogInput> {
  const value: Partial<CatalogInput> = {};
  if (creating) {
    const orgUnitId = body?.org_unit_id ?? null;
    if (orgUnitId !== null && !isUuid(orgUnitId)) {
      errors.push({ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' });
    }
    value.orgUnitId = orgUnitId as string | null;
    const code = (readWorkText(body, 'code', errors, { required: true, maximum: 30 }) ?? '').toUpperCase();
    if (code && !/^[A-Z0-9._-]+$/.test(code)) {
      errors.push({ field: 'code', message: 'Mã chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang' });
    }
    value.code = code;
  }
  if (creating || body?.rule_set_id !== undefined) {
    const ruleSetId = body?.rule_set_id ?? null;
    if (ruleSetId !== null && !isUuid(ruleSetId)) {
      errors.push({ field: 'rule_set_id', message: 'Mã bộ quy tắc không hợp lệ' });
    }
    value.ruleSetId = ruleSetId as string | null;
  }
  if (creating || body?.name !== undefined) {
    value.name = readWorkText(body, 'name', errors, { required: true, maximum: 1000 }) ?? '';
  }
  if (creating || body?.axis_code !== undefined) {
    value.axisCode = readWorkText(body, 'axis_code', errors, { required: true, maximum: 30 }) ?? '';
  }
  for (const [field, key, maximum] of [
    ['output_result', 'outputResult', 500],
    ['expected_evidence', 'expectedEvidence', 500],
    ['deadline_hint', 'deadlineHint', 200],
    ['task_type', 'taskType', 30],
    ['difficulty_code', 'difficultyCode', 30],
    ['job_position', 'jobPosition', 50],
  ] as const) {
    if (creating || body?.[field] !== undefined) {
      (value as Record<string, unknown>)[key] = readWorkText(body, field, errors, { maximum });
    }
  }
  if (creating || body?.school_level !== undefined) {
    const level = (body?.school_level ?? null) as KpiSchoolLevel | null;
    if (level !== null && !LEVELS.includes(level)) {
      errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    }
    value.schoolLevel = level;
  }
  if (creating || body?.is_required !== undefined) {
    value.isRequired = body?.is_required === true;
  }
  if (creating || body?.is_confidential !== undefined) {
    value.isConfidential = body?.is_confidential === true;
  }
  return value;
}

function readFilter(query: Record<string, string | undefined>): CatalogFilter {
  const errors: FieldError[] = [];
  for (const field of ['org_unit_id', 'rule_set_id']) {
    if (query[field] !== undefined && !isUuid(query[field])) {
      errors.push({ field, message: 'Mã không hợp lệ' });
    }
  }
  const status = query.status as KpiCatalogStatus | undefined;
  if (status !== undefined && !['active', 'inactive', 'proposed', 'rejected'].includes(status)) {
    errors.push({ field: 'status', message: 'Trạng thái là active, inactive, proposed hoặc rejected' });
  }
  const level = query.school_level as KpiSchoolLevel | undefined;
  if (level !== undefined && !LEVELS.includes(level)) {
    errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
  }
  check(errors);
  return {
    orgUnitId: query.org_unit_id ?? null,
    common: query.common === 'true',
    ruleSetId: query.rule_set_id ?? null,
    status: status ?? null,
    schoolLevel: level ?? null,
    jobPosition: query.job_position?.trim() || null,
    keyword: query.q?.trim() || null,
  };
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Controller('kpi/catalog')
export class KpiCatalogController {
  constructor(private readonly catalog: KpiCatalogService) {}

  @Get()
  @RequirePermission(...READ_PERMISSIONS)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalog.list(currentUser, readFilter(query));
  }

  @Get('indicator-progress')
  @RequirePermission(...READ_PERMISSIONS)
  indicatorProgress() {
    return this.catalog.indicatorProgress();
  }

  @Get('export')
  @RequirePermission(...READ_PERMISSIONS)
  async export(
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.catalog.export(currentUser, readFilter(query));
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }

  @Get('template')
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  async template(@Query('rule_set_id') ruleSetId: string | undefined, @Res() response: Response) {
    if (ruleSetId !== undefined && !isUuid(ruleSetId)) {
      throw validationError([{ field: 'rule_set_id', message: 'Mã không hợp lệ' }]);
    }
    const body = await this.catalog.template(ruleSetId ?? null);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', 'attachment; filename="mau-danh-muc-cong-viec.xlsx"');
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Post('import')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  async import(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Query('error_file') errorFile: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = body?.org_unit_id ? body.org_unit_id : null;
    const ruleSetId = body?.rule_set_id ? body.rule_set_id : null;
    if (orgUnitId !== null && !isUuid(orgUnitId)) {
      errors.push({ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' });
    }
    if (ruleSetId !== null && !isUuid(ruleSetId)) {
      errors.push({ field: 'rule_set_id', message: 'Mã bộ quy tắc không hợp lệ' });
    }
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn tệp Excel' });
    }
    check(errors);
    const result = await this.catalog.import(
      currentUser,
      { orgUnitId: orgUnitId as string | null, ruleSetId: ruleSetId as string | null },
      file!.buffer,
      originOf(request, currentUser),
      errorFile === 'true',
    );
    if ('errorWorkbook' in result) {
      response.setHeader('content-type', XLSX_TYPE);
      response.setHeader('content-disposition', 'attachment; filename="danh-sach-loi-danh-muc.xlsx"');
      response.setHeader('cache-control', 'no-store');
      response.send(result.errorWorkbook);
      return;
    }
    response.json(result);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readCatalogInput(body, errors, true) as CatalogInput;
    check(errors);
    return this.catalog.create(currentUser, input, originOf(request, currentUser));
  }

  @Post('proposals')
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.participate)
  propose(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readCatalogInput({ ...body, org_unit_id: null }, errors, true) as CatalogInput;
    check(errors);
    return this.catalog.propose(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  update(
    @Param('id', uuidParameter('Mã công việc không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readCatalogInput(body, errors, false);
    const status = body?.status as KpiCatalogStatus | undefined;
    check(errors);
    return this.catalog.update(currentUser, itemId, { ...input, status }, originOf(request, currentUser));
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  decide(
    @Param('id', uuidParameter('Mã công việc không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (typeof body?.approve !== 'boolean') {
      errors.push({ field: 'approve', message: 'Chọn duyệt hoặc không duyệt' });
    }
    const note = readWorkText(body, 'note', errors, { maximum: 500 });
    check(errors);
    return this.catalog.decide(currentUser, itemId, body!.approve as boolean, note, originOf(request, currentUser));
  }
}
