import { Body, Controller, Get, Injectable, OnModuleInit, Param, Put, Query, Req, Res } from '@nestjs/common';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { evaluateFormula, parseFormula, PERMISSION_CODES, type ReportColumnKey } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, originOf } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { UpperLevelForms, UpperLevelSubmissions } from '../submissions/upper-level-submissions.js';
import { loadPrimaryFacts } from './primary-facts.js';

// EMIS Tiểu học (DT-20 phần 20f, YCTD-165): biểu là khung cấu hình được ở cơ sở dữ liệu hệ thống (`report_forms`,
// `report_form_rows`). Dòng công thức tính tại lúc xem từ số liệu của năm học đang mở (toàn trường, lớp, học sinh Tiểu học);
// dòng nhập tay lưu ở `emis_report_values` của năm học (mã biểu, thẻ `main`, mã dòng) như biểu Mầm non. Xuất Excel, PDF theo
// bố cục TT, Chỉ tiêu, Mã số, Đơn vị, các cột; gửi lên cấp trên, đánh dấu đã gửi, mở khoá dùng luồng có sẵn của 16a (biểu đã
// gửi thì khoá ô nhập tay). Sửa khung (dòng, công thức) cần `P17.report-form.manage`; công thức kiểm cú pháp khi lưu. Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const PRIMARY_REPORT_RULE_CODE = 'YCTD-165';
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
}

@Injectable()
export class PrimaryEmisService implements OnModuleInit {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly submissions: UpperLevelSubmissions,
    private readonly forms: UpperLevelForms,
    private readonly clock: Clock,
  ) {}

  // Biểu trong danh mục đăng ký vào luồng gửi lên cấp trên lúc khởi động (biểu thêm sau cần khởi động lại máy chủ)
  async onModuleInit(): Promise<void> {
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

  async list() {
    return this.databases.system
      .selectFrom('report_forms')
      .select(['id', 'code', 'name', 'school_level', 'period', 'note', 'updated_at', 'updated_by_name'])
      .orderBy('school_level')
      .orderBy('period', 'desc')
      .execute();
  }

  private async form(code: string) {
    const form = await this.databases.system
      .selectFrom('report_forms')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirst();
    if (!form) {
      throw notFoundError('Không có biểu báo cáo này', 'report_form');
    }
    const rows = (await this.databases.system
      .selectFrom('report_form_rows')
      .select(['id', 'order_no', 'code', 'label', 'unit', 'kind', 'formula'])
      .where('form_id', '=', form.id)
      .orderBy('order_no')
      .execute()) as FormRow[];
    return { form, rows };
  }

  // Biểu đã tính: dòng công thức tính từ số liệu, dòng nhập tay lấy số đã lưu; dòng công thức sai cú pháp ghi lỗi ở cảnh báo
  async view(currentUser: CurrentUser, code: string) {
    const { form, rows } = await this.form(code);
    const { database } = await this.currentSchoolYear.require();
    const facts = await loadPrimaryFacts(database, null);
    const saved = await database
      .selectFrom('emis_report_values')
      .select(['row_code', 'values', 'updated_by_name', 'updated_at'])
      .where('form_code', '=', code)
      .where('tab_key', '=', TAB)
      .execute();
    const columns = form.columns as unknown as Array<{ key: ReportColumnKey; label: string }>;
    const warnings: string[] = [];
    const values = rows.map((row) => {
      if (row.kind === 'heading') {
        return { ...row, values: {} as Record<string, number | null> };
      }
      if (row.kind === 'manual') {
        const stored = saved.find((item) => item.row_code === row.code);
        return { ...row, values: (stored?.values ?? {}) as Record<string, number | null> };
      }
      try {
        const parsed = parseFormula(row.formula ?? '');
        return {
          ...row,
          values: Object.fromEntries(columns.map((column) => [column.key, evaluateFormula(parsed, column.key, facts)])),
        };
      } catch (error) {
        warnings.push(`Dòng ${row.code}: ${(error as Error).message}`);
        return { ...row, values: {} as Record<string, number | null> };
      }
    });
    const manualRows = rows.filter((row) => row.kind === 'manual');
    const status = await this.submissions.statusOf(code);
    return {
      code: form.code,
      name: form.name,
      period: form.period,
      note: form.note,
      columns,
      rows: values,
      warnings,
      locked: this.submissions.isLocked(status),
      status,
      can_edit_values: currentUser.hasPermission(PERMISSION),
      can_edit_form: currentUser.hasPermission(PERMISSION_CODES.reportFormManage),
      completeness: [
        {
          label: 'Đã nhập các dòng nhập tay',
          done: manualRows.every((row) => saved.some((item) => item.row_code === row.code)),
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
  ) {
    const { form, rows: definitions } = await this.form(code);
    if (this.submissions.isLocked(await this.submissions.statusOf(code))) {
      throw ruleViolationError(PRIMARY_REPORT_RULE_CODE, 'Biểu đã gửi lên cấp trên; mở khoá trước khi sửa');
    }
    const columns = (form.columns as unknown as Array<{ key: string }>).map((column) => column.key);
    const errors: FieldError[] = [];
    rows.forEach((row, index) => {
      const definition = definitions.find((item) => item.code === row.code);
      if (!definition || definition.kind !== 'manual') {
        errors.push({ field: `rows[${index}].code`, message: 'Chỉ nhập tay ở dòng nhập tay của biểu' });
      }
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
          .values({ ...values, form_code: code, tab_key: TAB, row_code: row.code })
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
    return this.view(currentUser, code);
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
  ) {
    const { form, rows: before } = await this.form(code);
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
          parseFormula(row.formula ?? '');
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
    return this.view(currentUser, code);
  }

  async export(currentUser: CurrentUser, code: string, format: 'xlsx' | 'pdf', ip: string | null) {
    const view = await this.view(currentUser, code);
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    let order = 0;
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: code,
      fileName: `${code}-${fileStamp(now)}`,
      filters: { form_code: code },
      orgUnitIds: [],
      sheets: [
        {
          title: view.name.slice(0, 31),
          heading: [view.name, view.note ?? ''],
          columns: [
            { key: 'order', label: 'TT', width: 6 },
            { key: 'label', label: 'Chỉ tiêu', width: 40 },
            { key: 'code', label: 'Mã số', width: 8 },
            { key: 'unit', label: 'Đơn vị', width: 10 },
            ...view.columns.map((column) => ({ key: column.key, label: column.label, width: 12 })),
          ],
          rows: view.rows.map((row) => ({
            order: row.kind === 'heading' ? '' : String((order += 1)),
            label: row.label,
            code: row.code,
            unit: row.unit ?? '',
            ...row.values,
          })),
        },
      ],
      ipAddress: ip,
      createdAt: now,
      format,
    });
  }
}

@Controller('primary-reports/emis')
export class PrimaryEmisController {
  constructor(private readonly emis: PrimaryEmisService) {}

  @Get()
  @RequirePermission(PERMISSION)
  list() {
    return this.emis.list();
  }

  @Get(':code')
  @RequirePermission(PERMISSION)
  view(@Param('code') code: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emis.view(currentUser, code);
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
    return this.emis.saveValues(currentUser, code, rows, originOf(request, currentUser).ipAddress);
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
    return this.emis.saveRows(currentUser, code, rows, originOf(request, currentUser).ipAddress);
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
    sendWorkbook(response, await this.emis.export(currentUser, code, format, request.ip ?? null));
  }
}
