import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Clock, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Request, Response } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { LedgerReportsService } from '../ledger/ledger-reports.js';
import { ConsolidatedReportService } from './consolidated-report.js';
import type { ReportColumn, ReportRow } from './operations-report.js';
import {
  check,
  dateRange,
  flowType,
  minimumOverdueDays,
  month,
  optionalUuid,
  uuidList,
  type QueryValues,
} from './report-filters.js';
import { ReportsService } from './reports.service.js';

// Xuất dữ liệu (P17-12; BR-74; YCTD-83): người có quyền xuất dữ liệu xuất các báo cáo mình được xem ra tệp Excel. Mỗi lần
// xuất kiểm tra cả quyền xuất lẫn quyền xem của báo cáo trong phạm vi đơn vị, ghi một dòng nhật ký xuất (người xuất, báo
// cáo, bộ lọc, đơn vị, số dòng, có dữ liệu cá nhân hay không) rồi mới trả tệp. Tệp không lưu lại trên hệ thống
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORTED_DAY = sql<string>`(export_logs.exported_at at time zone 'Asia/Ho_Chi_Minh')::date`;

interface SheetDefinition {
  key: string;
  title: string;
  columns: ReportColumn[];
}

interface ExportDefinition {
  title: string;
  viewPermission: string;
  // Có tên trẻ, phụ huynh, người nộp tiền hoặc nhân sự trong tệp (BR-74)
  personal: boolean;
  sheets: SheetDefinition[];
  parse(query: QueryValues, errors: FieldError[]): Record<string, unknown> & { orgUnitId?: string | null };
}

const CLASS_TUITION_COLUMNS: ReportColumn[] = [
  { key: 'class_name', label: 'Lớp' },
  { key: 'grade_level', label: 'Khối' },
  { key: 'invoice_count', label: 'Số hóa đơn' },
  { key: 'total_amount', label: 'Phải thu' },
  { key: 'discount_amount', label: 'Giảm trừ' },
  { key: 'adjustment_amount', label: 'Điều chỉnh' },
  { key: 'payable_amount', label: 'Còn phải thu' },
  { key: 'paid_amount', label: 'Đã thu' },
  { key: 'outstanding_amount', label: 'Còn nợ' },
];

export const CONSOLIDATED_COLUMNS: ReportColumn[] = [
  { key: 'org_unit_code', label: 'Mã đơn vị' },
  { key: 'org_unit_name', label: 'Đơn vị' },
  { key: 'children_count', label: 'Số trẻ' },
  { key: 'classes_count', label: 'Số lớp' },
  { key: 'staff_count', label: 'Số nhân sự' },
  { key: 'attendance_rate_percent', label: 'Tỷ lệ đi học (%)' },
  { key: 'tuition_payable_amount', label: 'Học phí phải thu' },
  { key: 'tuition_paid_amount', label: 'Học phí đã thu' },
  { key: 'tuition_outstanding_amount', label: 'Học phí còn nợ' },
  { key: 'tuition_collection_percent', label: 'Tỷ lệ thu (%)' },
  { key: 'debt_outstanding_amount', label: 'Công nợ' },
  { key: 'debt_overdue_amount', label: 'Nợ quá hạn' },
  { key: 'income_amount', label: 'Tổng thu' },
  { key: 'expense_amount', label: 'Tổng chi' },
  { key: 'difference_amount', label: 'Chênh lệch' },
];

export const EXPORT_DEFINITIONS: Record<string, ExportDefinition> = {
  tuition: {
    title: 'Báo cáo học phí',
    viewPermission: PERMISSION_CODES.tuitionReport,
    personal: false,
    sheets: [{ key: 'classes', title: 'Theo lớp', columns: CLASS_TUITION_COLUMNS }],
    parse: (query, errors) => ({
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      month: month(query, errors),
      gradeLevel: query.grade_level?.trim() || null,
    }),
  },
  debts: {
    title: 'Báo cáo công nợ',
    viewPermission: PERMISSION_CODES.debtReport,
    personal: true,
    sheets: [
      {
        key: 'classes',
        title: 'Theo lớp',
        columns: [
          { key: 'class_name', label: 'Lớp' },
          { key: 'child_count', label: 'Số trẻ' },
          { key: 'outstanding_amount', label: 'Còn nợ' },
          { key: 'overdue_amount', label: 'Quá hạn' },
          { key: 'credit_amount', label: 'Số dư có' },
        ],
      },
      {
        key: 'children',
        title: 'Theo trẻ',
        columns: [
          { key: 'full_name', label: 'Trẻ' },
          { key: 'class_name', label: 'Lớp' },
          { key: 'outstanding_amount', label: 'Còn nợ' },
          { key: 'overdue_amount', label: 'Quá hạn' },
          { key: 'overdue_days', label: 'Số ngày quá hạn' },
          { key: 'credit_amount', label: 'Số dư có' },
        ],
      },
    ],
    parse: (query, errors) => ({
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      minimumOverdueDays: minimumOverdueDays(query, errors),
    }),
  },
  'cash-flow': {
    title: 'Báo cáo thu chi',
    viewPermission: PERMISSION_CODES.cashFlowReport,
    personal: true,
    sheets: [
      {
        key: 'groups',
        title: 'Theo nhóm',
        columns: [
          { key: 'flow_type', label: 'Loại' },
          { key: 'group_name', label: 'Nhóm' },
          { key: 'count', label: 'Số chứng từ' },
          { key: 'amount', label: 'Số tiền' },
        ],
      },
      {
        key: 'periods',
        title: 'Theo tháng',
        columns: [
          { key: 'period', label: 'Tháng' },
          { key: 'income_amount', label: 'Thu' },
          { key: 'expense_amount', label: 'Chi' },
        ],
      },
      {
        key: 'categories',
        title: 'Theo khoản mục',
        columns: [
          { key: 'flow_type', label: 'Loại' },
          { key: 'category_name', label: 'Khoản mục' },
          { key: 'count', label: 'Số chứng từ' },
          { key: 'amount', label: 'Số tiền' },
        ],
      },
      {
        key: 'documents',
        title: 'Chứng từ',
        columns: [
          { key: 'document_date', label: 'Ngày' },
          { key: 'code', label: 'Số' },
          { key: 'flow_type', label: 'Loại' },
          { key: 'category_name', label: 'Khoản mục' },
          { key: 'party', label: 'Người nộp hoặc nhận' },
          { key: 'amount', label: 'Số tiền' },
        ],
      },
    ],
    parse: (query, errors) => ({
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      ...dateRange(query, errors),
      flowType: flowType(query, errors),
      createdBy: optionalUuid(query, 'created_by', errors),
    }),
  },
  attendance: {
    title: 'Báo cáo điểm danh',
    viewPermission: PERMISSION_CODES.attendanceReport,
    personal: true,
    sheets: [
      {
        key: 'classes',
        title: 'Tỷ lệ đi học theo lớp',
        columns: [
          { key: 'class_name', label: 'Lớp' },
          { key: 'present', label: 'Lượt đi học' },
          { key: 'absent_notified', label: 'Vắng có báo' },
          { key: 'absent_unnotified', label: 'Vắng không báo' },
          { key: 'rate_percent', label: 'Tỷ lệ đi học (%)' },
        ],
      },
      {
        key: 'absences',
        title: 'Trẻ vắng',
        columns: [
          { key: 'attendance_date', label: 'Ngày' },
          { key: 'class_name', label: 'Lớp' },
          { key: 'full_name', label: 'Trẻ' },
          { key: 'status', label: 'Trạng thái' },
          { key: 'note', label: 'Ghi chú' },
        ],
      },
    ],
    parse: (query, errors) => ({
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      classId: optionalUuid(query, 'class_id', errors),
      ...dateRange(query, errors),
    }),
  },
  'staff-attendance': {
    title: 'Báo cáo chấm công',
    viewPermission: PERMISSION_CODES.staffAttendanceReport,
    personal: true,
    sheets: [
      {
        key: 'staff',
        title: 'Theo nhân sự',
        columns: [
          { key: 'code', label: 'Mã nhân sự' },
          { key: 'full_name', label: 'Nhân sự' },
          { key: 'department_name', label: 'Phòng ban' },
          { key: 'present_days', label: 'Ngày đi làm' },
          { key: 'leave_days', label: 'Nghỉ theo đơn' },
          { key: 'absent_days', label: 'Vắng' },
          { key: 'late_count', label: 'Lần đi muộn' },
          { key: 'early_leave_count', label: 'Lần về sớm' },
          { key: 'overtime_minutes', label: 'Phút làm thêm' },
        ],
      },
    ],
    parse: (query, errors) => ({
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      month: month(query, errors),
      departmentId: optionalUuid(query, 'department_id', errors),
    }),
  },
  'saturday-classes': {
    title: 'Báo cáo học thứ 7',
    viewPermission: PERMISSION_CODES.saturdayReport,
    personal: false,
    sheets: [
      {
        key: 'days',
        title: 'Các ngày học bù',
        columns: [
          { key: 'date', label: 'Ngày' },
          { key: 'note', label: 'Ghi chú' },
          { key: 'present_count', label: 'Số trẻ đi học' },
          { key: 'absent_count', label: 'Số trẻ vắng' },
        ],
      },
    ],
    parse: (query, errors) => ({
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      classId: optionalUuid(query, 'class_id', errors),
      ...dateRange(query, errors),
    }),
  },
  // Sổ kế toán kép (G3-06, YCTD-88)
  'ledger-journal': {
    title: 'Sổ nhật ký chung',
    viewPermission: PERMISSION_CODES.ledgerView,
    personal: true,
    sheets: [
      {
        key: 'lines',
        title: 'Nhật ký chung',
        columns: [
          { key: 'entry_date', label: 'Ngày' },
          { key: 'code', label: 'Số bút toán' },
          { key: 'org_unit_name', label: 'Đơn vị' },
          { key: 'description', label: 'Diễn giải' },
          { key: 'source_code', label: 'Chứng từ' },
          { key: 'account_code', label: 'Tài khoản' },
          { key: 'account_name', label: 'Tên tài khoản' },
          { key: 'debit', label: 'Nợ' },
          { key: 'credit', label: 'Có' },
        ],
      },
    ],
    parse: (query, errors) => ({ orgUnitId: optionalUuid(query, 'org_unit_id', errors), ...dateRange(query, errors) }),
  },
  'ledger-trial-balance': {
    title: 'Bảng cân đối số phát sinh',
    viewPermission: PERMISSION_CODES.ledgerView,
    personal: false,
    sheets: [
      {
        key: 'accounts',
        title: 'Cân đối số phát sinh',
        columns: [
          { key: 'account_code', label: 'Tài khoản' },
          { key: 'account_name', label: 'Tên tài khoản' },
          { key: 'opening_debit', label: 'Đầu kỳ Nợ' },
          { key: 'opening_credit', label: 'Đầu kỳ Có' },
          { key: 'period_debit', label: 'Phát sinh Nợ' },
          { key: 'period_credit', label: 'Phát sinh Có' },
          { key: 'closing_debit', label: 'Cuối kỳ Nợ' },
          { key: 'closing_credit', label: 'Cuối kỳ Có' },
        ],
      },
    ],
    parse: (query, errors) => ({ orgUnitId: optionalUuid(query, 'org_unit_id', errors), ...dateRange(query, errors) }),
  },
  'ledger-general-ledger': {
    title: 'Sổ cái',
    viewPermission: PERMISSION_CODES.ledgerView,
    personal: true,
    sheets: [
      {
        key: 'lines',
        title: 'Sổ cái',
        columns: [
          { key: 'entry_date', label: 'Ngày' },
          { key: 'code', label: 'Số bút toán' },
          { key: 'description', label: 'Diễn giải' },
          { key: 'source_code', label: 'Chứng từ' },
          { key: 'account_code', label: 'Tài khoản' },
          { key: 'counterpart_accounts', label: 'Tài khoản đối ứng' },
          { key: 'debit', label: 'Nợ' },
          { key: 'credit', label: 'Có' },
          { key: 'balance_debit', label: 'Số dư Nợ' },
          { key: 'balance_credit', label: 'Số dư Có' },
        ],
      },
    ],
    parse: (query, errors) => {
      const accountId = optionalUuid(query, 'account_id', errors);
      if (!accountId) {
        errors.push({ field: 'account_id', message: 'Bắt buộc chọn tài khoản' });
      }
      return { orgUnitId: optionalUuid(query, 'org_unit_id', errors), accountId, ...dateRange(query, errors) };
    },
  },
  consolidated: {
    title: 'Báo cáo hợp nhất nhiều đơn vị',
    viewPermission: PERMISSION_CODES.consolidatedReport,
    personal: false,
    sheets: [{ key: 'units', title: 'Theo đơn vị', columns: CONSOLIDATED_COLUMNS }],
    parse: (query, errors) => ({ month: month(query, errors), orgUnitIds: uuidList(query, 'org_unit_ids', errors) }),
  },
};

const VALUE_LABELS: Record<string, string> = {
  income: 'Thu',
  expense: 'Chi',
  absent_notified: 'Vắng có báo',
  absent_unnotified: 'Vắng không báo',
};

// Thân yêu cầu xuất là bộ lọc của báo cáo, cùng tên trường với chuỗi truy vấn khi xem báo cáo
function toQuery(body: unknown): QueryValues {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]),
  );
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    private readonly consolidated: ConsolidatedReportService,
    private readonly ledger: LedgerReportsService,
    private readonly clock: Clock,
  ) {}

  async export(currentUser: CurrentUser, code: string, body: unknown, ipAddress: string | null) {
    const definition = EXPORT_DEFINITIONS[code];
    if (!definition) {
      throw notFoundError('Không có báo cáo này để xuất', 'report');
    }
    const errors: FieldError[] = [];
    const query = toQuery(body);
    const filter = definition.parse(query, errors);
    check(errors);
    // Kiểm tra quyền xem báo cáo trong phạm vi trước khi đọc số liệu (BR-74); giáo viên không xuất theo lớp được phân công
    const scope = await this.reports.unitScope(
      currentUser,
      definition.viewPermission,
      (filter.orgUnitId as string | null | undefined) ?? null,
      false,
    );
    const data = await this.run(currentUser, code, filter);
    const exportedAt = this.clock.now();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management';
    workbook.created = exportedAt;
    const info = workbook.addWorksheet('Thông tin');
    info.addRow(['Báo cáo', definition.title]);
    info.addRow(['Người xuất', currentUser.description.full_name]);
    info.addRow(['Thời điểm xuất', exportedAt.toISOString()]);
    for (const [key, value] of Object.entries(query)) {
      info.addRow([`Bộ lọc ${key}`, value]);
    }
    if (definition.personal) {
      info.addRow([
        'Lưu ý',
        'Tệp có dữ liệu cá nhân, chỉ dùng cho công việc được giao, không chia sẻ ra ngoài (BR-74)',
      ]);
    }
    const totals = data.totals;
    if (totals && typeof totals === 'object') {
      for (const [key, value] of Object.entries(totals as Record<string, unknown>)) {
        info.addRow([`Tổng ${key}`, typeof value === 'number' ? value : String(value ?? '')]);
      }
    }
    info.getColumn(1).width = 32;
    info.getColumn(2).width = 60;
    let rowCount = 0;
    for (const sheet of definition.sheets) {
      const rows = (data[sheet.key] as ReportRow[] | undefined) ?? [];
      rowCount += rows.length;
      const worksheet = workbook.addWorksheet(sheet.title);
      worksheet.addRow(sheet.columns.map((column) => column.label));
      worksheet.getRow(1).font = { bold: true };
      for (const row of rows) {
        worksheet.addRow(
          sheet.columns.map((column) => {
            const value = row[column.key];
            return typeof value === 'string' && VALUE_LABELS[value] ? VALUE_LABELS[value] : (value ?? '');
          }),
        );
      }
      if (code === 'consolidated' && totals && typeof totals === 'object') {
        const total = worksheet.addRow(
          sheet.columns.map((column, index) =>
            index === 1 ? 'Tổng các đơn vị' : ((totals as ReportRow)[column.key] ?? ''),
          ),
        );
        total.font = { bold: true };
      }
      worksheet.columns.forEach((column) => {
        column.width = 20;
      });
    }
    const stamp = exportedAt.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const fileName = `bao-cao-${code}-${stamp}.xlsx`;
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const orgUnitIds =
      code === 'consolidated'
        ? ((data.units as ReportRow[]).map((row) => row.org_unit_id) as string[])
        : scope.orgUnitIds;
    const { database } = await this.currentSchoolYear.require();
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: code,
        filters_data: JSON.stringify(query),
        org_unit_ids: orgUnitIds,
        row_count: rowCount,
        contains_personal_data: definition.personal,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id };
  }

  private async run(currentUser: CurrentUser, code: string, filter: Record<string, unknown>) {
    const value = filter as never;
    switch (code) {
      case 'tuition':
        return (await this.reports.tuition(currentUser, value)) as Record<string, unknown>;
      case 'debts':
        return (await this.reports.debtsReport(currentUser, value)) as Record<string, unknown>;
      case 'cash-flow':
        return (await this.reports.cashFlow(currentUser, value)) as Record<string, unknown>;
      case 'attendance':
        return (await this.reports.attendanceReport(currentUser, value)) as Record<string, unknown>;
      case 'staff-attendance':
        return (await this.reports.staffAttendanceReport(currentUser, value)) as Record<string, unknown>;
      case 'saturday-classes':
        return (await this.reports.saturdayReport(currentUser, value)) as Record<string, unknown>;
      case 'ledger-journal':
        return (await this.ledger.journal(currentUser, value)) as unknown as Record<string, unknown>;
      case 'ledger-trial-balance':
        return (await this.ledger.trialBalance(currentUser, value)) as unknown as Record<string, unknown>;
      case 'ledger-general-ledger':
        return (await this.ledger.generalLedger(currentUser, value)) as unknown as Record<string, unknown>;
      default:
        return (await this.consolidated.report(currentUser, value)) as unknown as Record<string, unknown>;
    }
  }

  // Nhật ký xuất: người có phạm vi toàn trường theo quyền xuất xem mọi lần xuất, người khác chỉ xem lần xuất của mình
  async logs(currentUser: CurrentUser, filter: { from: string; to: string }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.dataExport, null, false);
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    let query = database
      .selectFrom('export_logs')
      .select([
        'id',
        'user_id',
        'actor_name',
        'report_code',
        'filters_data',
        'org_unit_ids',
        'row_count',
        'contains_personal_data',
        'file_name',
        'exported_at',
      ])
      .where(EXPORTED_DAY, '>=', filter.from)
      .where(EXPORTED_DAY, '<=', filter.to)
      .orderBy('exported_at', 'desc')
      .limit(500);
    if (!root || !scope.orgUnitIds.includes(root.id)) {
      query = query.where('user_id', '=', currentUser.id);
    }
    return query.execute();
  }
}

@Controller('reports')
export class ReportExportController {
  constructor(private readonly exports: ReportExportService) {}

  @Get('export-logs')
  @RequirePermission(PERMISSION_CODES.dataExport)
  logs(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = dateRange(query, errors);
    check(errors);
    return this.exports.logs(currentUser, filter);
  }

  @Post(':code/export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async export(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const result = await this.exports.export(currentUser, code, body, request.ip ?? null);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    response.setHeader('x-export-log-id', result.logId);
    response.setHeader('cache-control', 'no-store');
    response.send(result.buffer);
  }
}
