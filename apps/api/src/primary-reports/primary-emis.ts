import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { JobScheduler } from '../common/job-scheduler.js';
import { isMultiTenantMode } from '@school-management/server';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  evaluateFormula,
  expandSectionColumns,
  OWNERSHIP_GROUP_LABELS,
  parseFormula,
  parseRowSum,
  PERMISSION_CODES,
  sectionColumns,
  type FormulaFacts,
  type OwnershipGroup,
  type ReportColumnKey,
  type ReportSection,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, originOf } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { Databases } from '../common/databases.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { UpperLevelForms, UpperLevelSubmissions } from '../submissions/upper-level-submissions.js';
import { loadSecondaryFacts } from '../secondary-reports/secondary-facts.js';
import { loadPrimaryFacts } from './primary-facts.js';
import { loadTt25Facts } from './tt25-facts.js';

// EMIS Tiểu học (DT-20 phần 20f, YCTD-165): biểu là khung cấu hình được ở cơ sở dữ liệu hệ thống (`report_forms`,
// `report_form_rows`). Dòng công thức tính tại lúc xem từ số liệu của năm học đang mở (toàn trường, lớp, học sinh Tiểu học);
// dòng nhập tay lưu ở `emis_report_values` của năm học (mã biểu, thẻ `main`, mã dòng) như biểu Mầm non. Xuất Excel, PDF theo
// bố cục TT, Chỉ tiêu, Mã số, Đơn vị, các cột; gửi lên cấp trên, đánh dấu đã gửi, mở khoá dùng luồng có sẵn của 16a (biểu đã
// gửi thì khoá ô nhập tay). Sửa khung (dòng, công thức) cần `P17.report-form.manage`; công thức kiểm cú pháp khi lưu. Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11. THCS, THPT (DT-21 phần 21g, YCTD-175) dùng cùng khung: biểu ghi cấp, dòng
// công thức tính từ số liệu của cấp đó với bộ điều kiện của cấp; cổng gọi `/primary-reports/emis` (Tiểu học) hoặc
// `/secondary-reports/emis` (THCS, THPT), mỗi đường chỉ thấy, mở được biểu của cấp mình
export const PRIMARY_REPORT_RULE_CODE = 'YCTD-165';
const PRIMARY_LEVELS = ['TH'];
const SECONDARY_LEVELS = ['THCS', 'THPT'];

// Cấp của biểu theo đường gọi
function levelsOf(request: Request): string[] {
  return /\/secondary-reports\//.test(request.originalUrl ?? request.url ?? '') ? SECONDARY_LEVELS : PRIMARY_LEVELS;
}
const PERMISSION = 'P17.report.emis';
const TAB = 'main';

interface FormRow {
  id: string;
  order_no: number;
  code: string;
  label: string;
  unit: string | null;
  kind: 'heading' | 'formula' | 'manual';
  formula: string | null;
  section: string;
}

// Biểu cũ chỉ có một phần `main` dùng bộ cột của biểu, không lặp theo loại hình
function sectionsOf(form: { columns: unknown; sections: unknown }): ReportSection[] {
  if (Array.isArray(form.sections) && form.sections.length > 0) {
    return form.sections as ReportSection[];
  }
  return [{ code: TAB, name: '', columns: form.columns as ReportSection['columns'], ownership_groups: false }];
}

@Injectable()
export class PrimaryEmisService implements OnModuleInit {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly submissions: UpperLevelSubmissions,
    private readonly forms: UpperLevelForms,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  // Biểu trong danh mục đăng ký vào luồng gửi lên cấp trên lúc khởi động (biểu thêm sau cần khởi động lại máy chủ)
  async onModuleInit(): Promise<void> {
    // Nhiều trường (DT-SaaS phần S1b): biểu nằm ở cơ sở dữ liệu của từng trường, đăng ký theo từng trường qua bộ lập lịch (việc khởi động
    // của tiến trình); danh mục biểu của các trường cùng một mã nên đăng ký lại bản sau đè bản trước
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: 'emis-forms',
        intervalSeconds: 3600,
        perProcess: true,
        run: () => this.registerForms(),
      });
      return;
    }
    await this.registerForms();
  }

  async registerForms(): Promise<void> {
    const rows = await this.databases.system.selectFrom('report_forms').select(['code', 'name']).execute();
    for (const form of rows) {
      this.forms.register({
        code: form.code,
        name: form.name,
        permission: PERMISSION,
        unlockPermission: PERMISSION_CODES.schoolProfileManage,
        completeness: async (currentUser) => (await this.view(currentUser, form.code)).completeness,
        snapshot: async (currentUser, ipAddress) => {
          const view = await this.view(currentUser, form.code);
          return { file: await this.export(currentUser, form.code, 'xlsx', ipAddress), data: view };
        },
      });
    }
  }

  // Biểu khung cũ đã thay bằng biểu Thông tư 25/2024 (`archived`) chỉ hiện khi xin cả biểu ẩn
  async list(levels: string[] = PRIMARY_LEVELS, includeArchived = false) {
    return this.databases.system
      .selectFrom('report_forms')
      .select([
        'id',
        'code',
        'name',
        'school_level',
        'period',
        'note',
        'source',
        'form_number',
        'archived',
        'updated_at',
        'updated_by_name',
      ])
      .where('school_level', 'in', levels as Array<'TH'>)
      .$if(!includeArchived, (query) => query.where('archived', '=', false))
      .orderBy('source', 'desc')
      .orderBy('school_level')
      .orderBy('period', 'desc')
      .execute();
  }

  private async form(code: string, levels?: string[]) {
    const form = await this.databases.system
      .selectFrom('report_forms')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirst();
    if (!form || (levels && !levels.includes(form.school_level))) {
      throw notFoundError('Không có biểu báo cáo này', 'report_form');
    }
    const rows = (await this.databases.system
      .selectFrom('report_form_rows')
      .select(['id', 'order_no', 'code', 'label', 'unit', 'kind', 'formula', 'section'])
      .where('form_id', '=', form.id)
      .orderBy('order_no')
      .execute()) as FormRow[];
    return { form, rows };
  }

  // Số liệu nền theo cấp của biểu; biểu Thông tư 25/2024 thêm trường, điểm trường, đội ngũ, phòng học tập, học sinh rời trường
  private async facts(
    form: { school_level: string; source: string },
    current: {
      academicYearId: string;
      database: Awaited<ReturnType<CurrentSchoolYearResolver['require']>>['database'];
    },
  ): Promise<FormulaFacts & { ownership: OwnershipGroup | null }> {
    const level = form.school_level;
    const base =
      level === 'THCS' || level === 'THPT'
        ? await loadSecondaryFacts(current.database, level, null)
        : await loadPrimaryFacts(current.database, null);
    if (form.source !== 'tt25') {
      return { ...base, ownership: null };
    }
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select(['start_date', 'end_date'])
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    const text = (value: unknown) =>
      value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);
    const yearStart = text(year.start_date);
    const previous = await this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select('academic_year_databases.database_name')
      .where('academic_years.start_date', '<', year.start_date)
      .orderBy('academic_years.start_date', 'desc')
      .executeTakeFirst();
    return loadTt25Facts(
      {
        database: current.database,
        previous: previous ? this.databases.schoolYear<SchoolYearDatabase>(previous.database_name) : null,
        level: level as 'TH',
        enabledLevels: await this.schoolLevels.enabled(),
        startYear: Number(yearStart.slice(0, 4)),
        yearStart,
        yearEnd: text(year.end_date),
      },
      base as Parameters<typeof loadTt25Facts>[1],
    );
  }

  // Biểu đã tính: dòng công thức tính từ số liệu, dòng nhập tay lấy số đã lưu (theo phần), dòng cộng (`rows:`) cộng các dòng
  // khác của phần sau cùng; dòng công thức sai cú pháp ghi lỗi ở cảnh báo. Biểu nhiều phần trả bộ cột trường thấy theo loại hình
  async view(currentUser: CurrentUser, code: string, levels?: string[]) {
    const { form, rows } = await this.form(code, levels);
    const current = await this.currentSchoolYear.require();
    const level = form.school_level;
    const facts = await this.facts(form, current);
    const ownership = facts.ownership;
    const sections = sectionsOf(form);
    const columnsOf = new Map(sections.map((section) => [section.code, section.columns.map((column) => column.key)]));
    const saved = await current.database
      .selectFrom('emis_report_values')
      .select(['tab_key', 'row_code', 'values', 'updated_by_name', 'updated_at'])
      .where('form_code', '=', code)
      .execute();
    const warnings: string[] = [];
    const values = rows.map((row) => {
      const keys = columnsOf.get(row.section) ?? [];
      if (row.kind === 'heading') {
        return { ...row, values: {} as Record<string, number | null> };
      }
      if (row.kind === 'manual') {
        const stored = saved.find((item) => item.tab_key === row.section && item.row_code === row.code);
        return { ...row, values: (stored?.values ?? {}) as Record<string, number | null> };
      }
      if (parseRowSum(row.formula)) {
        return { ...row, values: {} as Record<string, number | null> };
      }
      try {
        const parsed = parseFormula(row.formula ?? '', level);
        return {
          ...row,
          values: Object.fromEntries(keys.map((key) => [key, evaluateFormula(parsed, key as ReportColumnKey, facts)])),
        };
      } catch (error) {
        warnings.push(`Dòng ${row.code}: ${(error as Error).message}`);
        return { ...row, values: {} as Record<string, number | null> };
      }
    });
    // Dòng cộng có thể gồm dòng cộng khác (155 = 156 + 158 + 164, 158 = 159 + ... + 163): tính đệ quy, dòng đang tính dở
    // (vòng lặp) bỏ qua và ghi cảnh báo
    const done = new Set<string>();
    const pending = new Set<string>();
    const sum = (row: (typeof values)[number]) => {
      const parts = parseRowSum(row.formula);
      if (!parts || done.has(row.code)) {
        return;
      }
      pending.add(row.code);
      const sources = values.filter((item) => item.section === row.section && parts.includes(item.code));
      if (sources.length !== parts.length) {
        warnings.push(`Dòng ${row.code}: cộng dòng không có trong phần`);
      }
      for (const source of sources) {
        if (pending.has(source.code)) {
          warnings.push(`Dòng ${row.code}: cộng vòng tròn qua dòng ${source.code}`);
        } else {
          sum(source);
        }
      }
      row.values = Object.fromEntries(
        (columnsOf.get(row.section) ?? []).map((key) => {
          const cells = sources.map((item) => item.values[key]);
          return [
            key,
            cells.every((cell) => cell === null || cell === undefined)
              ? null
              : cells.reduce<number>((total, cell) => total + (cell ?? 0), 0),
          ];
        }),
      );
      pending.delete(row.code);
      done.add(row.code);
    };
    values.forEach(sum);
    const manualRows = rows.filter((row) => row.kind === 'manual');
    const status = await this.submissions.statusOf(code);
    return {
      code: form.code,
      name: form.name,
      school_level: form.school_level,
      period: form.period,
      note: form.note,
      source: form.source,
      form_number: form.form_number,
      ownership,
      ownership_label: ownership ? OWNERSHIP_GROUP_LABELS[ownership] : null,
      columns: form.columns as unknown as Array<{ key: ReportColumnKey; label: string }>,
      sections: sections.map((section) => ({
        ...section,
        columns: ownership && section.ownership_groups ? sectionColumns(section, ownership) : section.columns,
      })),
      rows: values,
      warnings,
      locked: this.submissions.isLocked(status),
      status,
      can_edit_values: currentUser.hasPermission(PERMISSION),
      can_edit_form: form.source === 'custom' && currentUser.hasPermission(PERMISSION_CODES.reportFormManage),
      completeness: [
        {
          label: 'Đã nhập các dòng nhập tay',
          done: manualRows.every((row) =>
            saved.some((item) => item.tab_key === row.section && item.row_code === row.code),
          ),
        },
        { label: 'Công thức hợp lệ', done: warnings.length === 0 },
      ],
    };
  }

  // Lưu số của các dòng nhập tay; biểu đã gửi (khoá) thì phải mở khoá trước
  async saveValues(
    currentUser: CurrentUser,
    code: string,
    rows: Array<{ code: string; values: Record<string, number | null> }>,
    ip: string | null,
    levels?: string[],
  ) {
    const { form, rows: definitions } = await this.form(code, levels);
    if (this.submissions.isLocked(await this.submissions.statusOf(code))) {
      throw ruleViolationError(PRIMARY_REPORT_RULE_CODE, 'Biểu đã gửi lên cấp trên; mở khoá trước khi sửa');
    }
    const sections = sectionsOf(form);
    const errors: FieldError[] = [];
    rows.forEach((row, index) => {
      const definition = definitions.find((item) => item.code === row.code);
      if (!definition || definition.kind !== 'manual') {
        errors.push({ field: `rows[${index}].code`, message: 'Chỉ nhập tay ở dòng nhập tay của biểu' });
      }
      const section = sections.find((item) => item.code === (definition?.section ?? TAB));
      const columns = (section?.columns ?? []).map((column) => column.key as string);
      for (const [key, value] of Object.entries(row.values)) {
        if (!columns.includes(key)) {
          errors.push({ field: `rows[${index}].values.${key}`, message: 'Cột không có ở biểu' });
        }
        if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value < 0)) {
          errors.push({ field: `rows[${index}].values.${key}`, message: 'Số là số nguyên không âm' });
        }
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const { database } = await this.currentSchoolYear.require();
    await database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        const values = {
          values: JSON.stringify(row.values),
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        };
        await transaction
          .insertInto('emis_report_values')
          .values({
            ...values,
            form_code: code,
            tab_key: definitions.find((item) => item.code === row.code)?.section ?? TAB,
            row_code: row.code,
          })
          .onConflict((conflict) => conflict.columns(['form_code', 'tab_key', 'row_code']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin: { actorUserId: currentUser.id, actorName: currentUser.description.full_name, ipAddress: ip },
        orgUnitId: null,
        entityName: 'emis_report_values',
        entityId: form.id,
        action: 'update',
        before: null,
        after: { form_code: code, rows },
      });
    });
    return this.view(currentUser, code, levels);
  }

  // Thay cả bộ dòng của khung biểu (sửa cho khớp Sở sau khảo sát); công thức phải đúng cú pháp, mã dòng không trùng
  async saveRows(
    currentUser: CurrentUser,
    code: string,
    rows: Array<{
      code: string;
      label: string;
      unit: string | null;
      kind: 'heading' | 'formula' | 'manual';
      formula: string | null;
    }>,
    ip: string | null,
    levels?: string[],
  ) {
    const { form, rows: before } = await this.form(code, levels);
    if (form.source !== 'custom') {
      throw ruleViolationError(
        PRIMARY_REPORT_RULE_CODE,
        'Biểu theo mẫu pháp định, không sửa dòng, mã số; chỉ nhập số ở dòng nhập tay',
      );
    }
    const errors: FieldError[] = [];
    const codes = new Set<string>();
    rows.forEach((row, index) => {
      if (!row.code || row.code.length > 20 || codes.has(row.code)) {
        errors.push({ field: `rows[${index}].code`, message: 'Mã dòng bắt buộc, tối đa 20 ký tự, không trùng' });
      }
      codes.add(row.code);
      if (!row.label || row.label.length > 300) {
        errors.push({ field: `rows[${index}].label`, message: 'Tên chỉ tiêu bắt buộc, tối đa 300 ký tự' });
      }
      if (!['heading', 'formula', 'manual'].includes(row.kind)) {
        errors.push({ field: `rows[${index}].kind`, message: 'Loại là heading, formula hoặc manual' });
      }
      if (row.kind === 'formula') {
        try {
          parseFormula(row.formula ?? '', form.school_level);
        } catch (error) {
          errors.push({ field: `rows[${index}].formula`, message: (error as Error).message });
        }
      }
    });
    if (rows.length === 0) {
      errors.push({ field: 'rows', message: 'Biểu cần ít nhất một dòng' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.databases.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('report_form_rows').where('form_id', '=', form.id).execute();
      await transaction
        .insertInto('report_form_rows')
        .values(
          rows.map((row, index) => ({
            form_id: form.id,
            order_no: index + 1,
            code: row.code,
            label: row.label,
            unit: row.unit,
            kind: row.kind,
            formula: row.kind === 'formula' ? row.formula : null,
          })),
        )
        .execute();
      await transaction
        .updateTable('report_forms')
        .set({ updated_by_name: currentUser.description.full_name, updated_at: this.clock.now() })
        .where('id', '=', form.id)
        .execute();
    });
    const { database } = await this.currentSchoolYear.require();
    await writeAuditLog(database, {
      origin: { actorUserId: currentUser.id, actorName: currentUser.description.full_name, ipAddress: ip },
      orgUnitId: null,
      entityName: 'report_form_rows',
      entityId: form.id,
      action: 'update',
      before,
      after: rows,
    });
    return this.view(currentUser, code, levels);
  }

  // Biểu cũ: một trang. Biểu nhiều phần: mỗi phần một trang; phần có nhóm loại hình xuất đủ ba nhóm cột như mẫu, nhóm Tổng
  // số và nhóm của trường cùng số, nhóm kia để trống
  async export(currentUser: CurrentUser, code: string, format: 'xlsx' | 'pdf', ip: string | null, levels?: string[]) {
    const view = await this.view(currentUser, code, levels);
    const { form } = await this.form(code, levels);
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    const multiple = Array.isArray(form.sections) && form.sections.length > 0;
    const sheets = sectionsOf(form).map((section) => {
      const expanded = expandSectionColumns(section);
      const keyOf = (group: string | null, key: string) => (group ? `${group}:${key}` : key);
      let order = 0;
      return {
        title: (multiple ? section.name : view.name).slice(0, 31),
        heading: [multiple ? `${view.name}: ${section.name}` : view.name, view.note ?? ''],
        columns: [
          { key: 'order', label: 'TT', width: 6 },
          { key: 'label', label: 'Chỉ tiêu', width: 48 },
          { key: 'unit', label: 'Đơn vị tính', width: 10 },
          { key: 'code', label: 'Mã số', width: 8 },
          ...expanded.map(({ group, column }) => ({
            key: keyOf(group, column.key),
            label: group ? `${OWNERSHIP_GROUP_LABELS[group]}: ${column.label}` : column.label,
            width: 12,
          })),
        ],
        rows: view.rows
          .filter((row) => row.section === section.code)
          .map((row) => ({
            order: row.kind === 'heading' ? '' : String((order += 1)),
            label: row.label,
            unit: row.unit ?? '',
            code: /^Td+$/.test(row.code) ? '' : row.code,
            ...Object.fromEntries(
              expanded.map(({ group, column }) => [
                keyOf(group, column.key),
                group === null || group === 'total' || group === view.ownership ? (row.values[column.key] ?? '') : '',
              ]),
            ),
          })),
      };
    });
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: code,
      fileName: `${code}-${fileStamp(now)}`,
      filters: { form_code: code },
      orgUnitIds: [],
      sheets,
      ipAddress: ip,
      createdAt: now,
      format,
    });
  }
}

@Controller(['primary-reports/emis', 'secondary-reports/emis'])
export class PrimaryEmisController {
  constructor(private readonly emis: PrimaryEmisService) {}

  @Get()
  @RequirePermission(PERMISSION)
  list(@Req() request: Request, @Query('archived') archived: string | undefined) {
    return this.emis.list(levelsOf(request), archived === 'true');
  }

  @Get(':code')
  @RequirePermission(PERMISSION)
  view(@Param('code') code: string, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emis.view(currentUser, code, levelsOf(request));
  }

  @Put(':code/values')
  @RequirePermission(PERMISSION)
  saveValues(
    @Param('code') code: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!Array.isArray(body?.rows)) {
      throw validationError([{ field: 'rows', message: 'Cần danh sách dòng nhập tay' }]);
    }
    const rows = (body.rows as unknown[]).map((value) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
      const values = typeof item.values === 'object' && item.values !== null ? item.values : {};
      return { code: String(item.code ?? ''), values: values as Record<string, number | null> };
    });
    return this.emis.saveValues(currentUser, code, rows, originOf(request, currentUser).ipAddress, levelsOf(request));
  }

  @Put(':code/rows')
  @RequirePermission(PERMISSION_CODES.reportFormManage)
  saveRows(
    @Param('code') code: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!Array.isArray(body?.rows) || body.rows.length > 500) {
      throw validationError([{ field: 'rows', message: 'Cần danh sách tối đa 500 dòng' }]);
    }
    const rows = (body.rows as unknown[]).map((value) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
      const text = (key: string) => (typeof item[key] === 'string' ? (item[key] as string).trim() : '');
      return {
        code: text('code'),
        label: text('label'),
        unit: text('unit') || null,
        kind: text('kind') as 'heading' | 'formula' | 'manual',
        formula: text('formula') || null,
      };
    });
    return this.emis.saveRows(currentUser, code, rows, originOf(request, currentUser).ipAddress, levelsOf(request));
  }

  @Get(':code/export')
  @RequirePermission(PERMISSION)
  async export(
    @Param('code') code: string,
    @Query('format') formatValue: string | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const format = readTableFileFormat(formatValue);
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    if (!currentUser.hasPermission(PERMISSION)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xuất được biểu EMIS');
    }
    sendWorkbook(response, await this.emis.export(currentUser, code, format, request.ip ?? null, levelsOf(request)));
  }
}
