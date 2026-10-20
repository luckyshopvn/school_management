import { Controller, Get, Injectable, Query, Req, Res } from '@nestjs/common';
import type { IncomingAssignmentStatus, SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import {
  INCOMING_DOCUMENT_STATUS_LABELS,
  PERMISSION_CODES,
  DIRECTIVE_ASSIGNMENT_STATUS_LABELS,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid } from '../common/request-fields.js';
import { readTableFileFormat, type TableFileFormat } from '../exports/table-file.js';
import {
  buildFacilitiesWorkbook,
  fileStamp,
  sendWorkbook,
  type WorkbookSheet,
} from '../facilities/facilities-workbook.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { inScope } from '../work/work-access.js';

// Báo cáo của phân hệ Quản lý văn bản và điều hành theo VNPT iOffice (DT-18 phần 18c, YCTD-141; quyết định của Eric ngày
// 2026-10-19), lọc theo đơn vị và khoảng ngày, xuất Excel, PDF:
// - Báo cáo thực hiện và đánh giá thực hiện văn bản đến: mỗi người xử lý chính một dòng, tính theo ngày đến của văn bản:
//   tổng số, đã xử lý đúng hạn, quá hạn, đang xử lý trong hạn, quá hạn, tỷ lệ đúng hạn;
// - Báo cáo tổng hợp, thống kê theo đơn vị độc lập: văn bản đến xử lý chính, công việc được giao (theo ngày bắt đầu), lịch
//   công tác đã công bố của từng đơn vị;
// - Thống kê số liệu trong đơn vị: văn bản đến theo hình thức, độ khẩn, lĩnh vực, trạng thái; công việc theo trạng thái.
// Người xử lý thuộc đơn vị theo hồ sơ nhân sự ở năm học đang dùng. Quản lý đơn vị chỉ xem đơn vị được gán. Chi tiết do Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-141
const REPORT = PERMISSION_CODES.documentReportView;
const MAXIMUM_RANGE_DAYS = 400;
// Dòng xử lý chính không còn hiệu lực: trả lại, bị lấy lại, từ chối
const INACTIVE: IncomingAssignmentStatus[] = ['returned', 'revoked', 'refused'];
const FINISHED: IncomingAssignmentStatus[] = ['done', 'forwarded', 'closed'];

export interface ReportFilter {
  from: string;
  to: string;
  orgUnitId: string | null;
}

export interface ProcessingRow {
  org_unit_name: string;
  handler_name: string;
  total: number;
  done_on_time: number;
  done_late: number;
  open_on_time: number;
  open_late: number;
  on_time_rate: number;
}

const percent = (part: number, total: number) => (total ? Math.round((part * 1000) / total) / 10 : 0);

// Xếp một dòng xử lý chính vào bốn nhóm theo hạn (hạn của dòng, đã gia hạn thì hạn mới, không có thì hạn của văn bản)
export function classifyProcessing(
  row: { status: IncomingAssignmentStatus; deadline: string | null; finished_on: string | null },
  today: string,
): 'done_on_time' | 'done_late' | 'open_on_time' | 'open_late' {
  if (FINISHED.includes(row.status)) {
    return !row.deadline || (row.finished_on !== null && row.finished_on <= row.deadline)
      ? 'done_on_time'
      : 'done_late';
  }
  return !row.deadline || row.deadline >= today ? 'open_on_time' : 'open_late';
}

@Injectable()
export class DocumentReportsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Đơn vị trong phạm vi báo cáo của người xem, kèm người dùng của từng đơn vị theo hồ sơ nhân sự
  private async units(currentUser: CurrentUser, filter: ReportFilter) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolveStaff(currentUser, REPORT);
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    let units = (database as Kysely<SchoolYearDatabase>)
      .selectFrom('org_units')
      .select(['id', 'code', 'name'])
      .where('status', '=', 'active');
    if (filter.orgUnitId) {
      units = units.where('id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      units = units.where(
        'id',
        'in',
        scope.orgUnitIds.length ? scope.orgUnitIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }
    const unitRows = await units.orderBy('code').execute();
    const staff = unitRows.length
      ? await (database as Kysely<SchoolYearDatabase>)
          .selectFrom('staff')
          .select(['id', 'user_id', 'org_unit_id', 'full_name'])
          .where(
            'org_unit_id',
            'in',
            unitRows.map((unit) => unit.id),
          )
          .execute()
      : [];
    const unitOfUser = new Map<string, string>();
    for (const person of staff) {
      if (person.user_id && !unitOfUser.has(person.user_id)) {
        unitOfUser.set(person.user_id, person.org_unit_id);
      }
    }
    return {
      database: database as Kysely<SchoolYearDatabase>,
      units: unitRows,
      unitOfUser,
      staff,
      wholeSchool: scope.wholeSchool,
    };
  }

  // Dòng xử lý chính còn hiệu lực của văn bản đến có ngày đến trong khoảng
  private async mainAssignments(filter: ReportFilter) {
    const rows = await this.system
      .selectFrom('incoming_document_assignments')
      .innerJoin('incoming_documents', 'incoming_documents.id', 'incoming_document_assignments.document_id')
      .select([
        'incoming_document_assignments.user_id',
        'incoming_document_assignments.user_name',
        'incoming_document_assignments.status',
        'incoming_document_assignments.deadline',
        'incoming_document_assignments.extension_status',
        'incoming_document_assignments.extension_until',
        'incoming_document_assignments.finished_at',
        'incoming_documents.deadline as document_deadline',
        'incoming_documents.id as document_id',
      ])
      .where('incoming_document_assignments.role', '=', 'main')
      .where('incoming_document_assignments.status', 'not in', INACTIVE)
      .where('incoming_documents.arrival_date', '>=', filter.from)
      .where('incoming_documents.arrival_date', '<=', filter.to)
      .execute();
    return rows.map((row) => ({
      ...row,
      deadline:
        row.extension_status === 'approved' && row.extension_until
          ? row.extension_until
          : (row.deadline ?? row.document_deadline),
      finished_on: row.finished_at ? VIETNAM_DATE.format(row.finished_at) : null,
    }));
  }

  async processing(currentUser: CurrentUser, filter: ReportFilter) {
    const { units, unitOfUser } = await this.units(currentUser, filter);
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    const today = this.today();
    const byHandler = new Map<string, ProcessingRow>();
    for (const row of await this.mainAssignments(filter)) {
      const unitId = unitOfUser.get(row.user_id);
      if (!unitId) {
        continue;
      }
      const item = byHandler.get(row.user_id) ?? {
        org_unit_name: unitNames.get(unitId) ?? '',
        handler_name: row.user_name,
        total: 0,
        done_on_time: 0,
        done_late: 0,
        open_on_time: 0,
        open_late: 0,
        on_time_rate: 0,
      };
      item.total += 1;
      item[classifyProcessing(row, today)] += 1;
      byHandler.set(row.user_id, item);
    }
    const rows = [...byHandler.values()]
      .map((row) => ({ ...row, on_time_rate: percent(row.done_on_time, row.total) }))
      .sort(
        (left, right) =>
          left.org_unit_name.localeCompare(right.org_unit_name, 'vi') ||
          left.handler_name.localeCompare(right.handler_name, 'vi'),
      );
    const sum = (key: 'total' | 'done_on_time' | 'done_late' | 'open_on_time' | 'open_late') =>
      rows.reduce((total, row) => total + row[key], 0);
    const totals = {
      total: sum('total'),
      done_on_time: sum('done_on_time'),
      done_late: sum('done_late'),
      open_on_time: sum('open_on_time'),
      open_late: sum('open_late'),
    };
    return { rows, totals: { ...totals, on_time_rate: percent(totals.done_on_time, totals.total) } };
  }

  async summary(currentUser: CurrentUser, filter: ReportFilter) {
    const { database, units, unitOfUser } = await this.units(currentUser, filter);
    const today = this.today();
    const rows = new Map(
      units.map((unit) => [
        unit.id,
        {
          org_unit_name: unit.name,
          incoming_total: 0,
          incoming_done: 0,
          incoming_late: 0,
          task_total: 0,
          task_done_on_time: 0,
          task_done_late: 0,
          task_open: 0,
          task_overdue: 0,
          schedule_count: 0,
        },
      ]),
    );
    for (const row of await this.mainAssignments(filter)) {
      const item = rows.get(unitOfUser.get(row.user_id) ?? '');
      if (!item) continue;
      item.incoming_total += 1;
      const group = classifyProcessing(row, today);
      if (group === 'done_on_time' || group === 'done_late') item.incoming_done += 1;
      if (group === 'done_late' || group === 'open_late') item.incoming_late += 1;
    }
    const unitIds = units.map((unit) => unit.id);
    const assignments = unitIds.length
      ? await database
          .selectFrom('task_assignments')
          .innerJoin('tasks', 'tasks.id', 'task_assignments.task_id')
          .select([
            'task_assignments.org_unit_id',
            'task_assignments.status',
            'task_assignments.due_date',
            'task_assignments.completed_at',
          ])
          .where('task_assignments.org_unit_id', 'in', unitIds)
          .where('task_assignments.role', '!=', 'follow')
          .where('task_assignments.status', '!=', 'cancelled')
          .where('tasks.status', '!=', 'cancelled')
          .where('task_assignments.start_date', '>=', filter.from)
          .where('task_assignments.start_date', '<=', filter.to)
          .execute()
      : [];
    for (const assignment of assignments) {
      const item = rows.get(assignment.org_unit_id);
      if (!item) continue;
      item.task_total += 1;
      if (assignment.status === 'done') {
        const completedOn = assignment.completed_at ? VIETNAM_DATE.format(assignment.completed_at) : today;
        if (completedOn <= assignment.due_date) item.task_done_on_time += 1;
        else item.task_done_late += 1;
      } else {
        item.task_open += 1;
        if (assignment.status !== 'pending_approval' && assignment.due_date < today) item.task_overdue += 1;
      }
    }
    const entries = unitIds.length
      ? await this.system
          .selectFrom('unit_schedule_entries')
          .select(['org_unit_id', (expression) => expression.fn.countAll<string>().as('count')])
          .where('status', '=', 'published')
          .where('org_unit_id', 'in', unitIds)
          .where('entry_date', '>=', filter.from)
          .where('entry_date', '<=', filter.to)
          .groupBy('org_unit_id')
          .execute()
      : [];
    for (const entry of entries) {
      const item = rows.get(entry.org_unit_id ?? '');
      if (item) item.schedule_count = Number(entry.count);
    }
    return { rows: [...rows.values()] };
  }

  async statistics(currentUser: CurrentUser, filter: ReportFilter) {
    const { database, units } = await this.units(currentUser, filter);
    const documents = await this.system
      .selectFrom('incoming_documents')
      .leftJoin('document_catalog_items as form', 'form.id', 'incoming_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'incoming_documents.urgency_id')
      .leftJoin('document_catalog_items as field', 'field.id', 'incoming_documents.field_id')
      .select([
        'incoming_documents.status',
        'form.name as form_name',
        'urgency.name as urgency_name',
        'field.name as field_name',
      ])
      .where('incoming_documents.arrival_date', '>=', filter.from)
      .where('incoming_documents.arrival_date', '<=', filter.to)
      .execute();
    const count = (values: Array<string | null>) => {
      const map = new Map<string, number>();
      for (const value of values) {
        const key = value ?? 'Chưa phân loại';
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return [...map]
        .map(([label, value]) => ({ label, count: value }))
        .sort((left, right) => right.count - left.count);
    };
    const unitIds = units.map((unit) => unit.id);
    const tasks = unitIds.length
      ? await database
          .selectFrom('task_assignments')
          .select('status')
          .where('org_unit_id', 'in', unitIds)
          .where('start_date', '>=', filter.from)
          .where('start_date', '<=', filter.to)
          .execute()
      : [];
    return {
      sections: [
        {
          title: 'Văn bản đến theo hình thức',
          rows: count(documents.map((row) => row.form_name)),
        },
        { title: 'Văn bản đến theo độ khẩn', rows: count(documents.map((row) => row.urgency_name)) },
        { title: 'Văn bản đến theo lĩnh vực', rows: count(documents.map((row) => row.field_name)) },
        {
          title: 'Văn bản đến theo trạng thái',
          rows: count(documents.map((row) => INCOMING_DOCUMENT_STATUS_LABELS[row.status])),
        },
        {
          title: 'Phân công công việc theo trạng thái',
          rows: count(tasks.map((row) => DIRECTIVE_ASSIGNMENT_STATUS_LABELS[row.status])),
        },
      ],
      total_documents: documents.length,
      total_assignments: tasks.length,
    };
  }

  async export(
    currentUser: CurrentUser,
    kind: 'incoming' | 'summary' | 'statistics',
    filter: ReportFilter,
    format: TableFileFormat,
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const heading = [`Từ ngày ${formatDate(filter.from)} đến ngày ${formatDate(filter.to)}`];
    let sheets: WorkbookSheet[];
    let title: string;
    if (kind === 'incoming') {
      const report = await this.processing(currentUser, filter);
      title = 'BÁO CÁO THỰC HIỆN VÀ ĐÁNH GIÁ XỬ LÝ VĂN BẢN ĐẾN';
      sheets = [
        {
          title: 'Thực hiện văn bản đến',
          heading: [title, ...heading],
          columns: [
            { key: 'org_unit_name', label: 'Đơn vị', width: 24 },
            { key: 'handler_name', label: 'Người xử lý chính', width: 24 },
            { key: 'total', label: 'Tổng số', width: 10 },
            { key: 'done_on_time', label: 'Đã xử lý đúng hạn', width: 12 },
            { key: 'done_late', label: 'Đã xử lý quá hạn', width: 12 },
            { key: 'open_on_time', label: 'Đang xử lý trong hạn', width: 12 },
            { key: 'open_late', label: 'Đang xử lý quá hạn', width: 12 },
            { key: 'on_time_rate', label: 'Tỷ lệ đúng hạn (%)', width: 12 },
          ],
          rows: [...report.rows, { org_unit_name: 'Tổng cộng', handler_name: '', ...report.totals }],
        },
      ];
    } else if (kind === 'summary') {
      const report = await this.summary(currentUser, filter);
      title = 'BÁO CÁO TỔNG HỢP THEO ĐƠN VỊ';
      sheets = [
        {
          title: 'Tổng hợp',
          heading: [title, ...heading],
          columns: [
            { key: 'org_unit_name', label: 'Đơn vị', width: 26 },
            { key: 'incoming_total', label: 'Văn bản đến xử lý chính', width: 12 },
            { key: 'incoming_done', label: 'Đã xử lý', width: 10 },
            { key: 'incoming_late', label: 'Quá hạn', width: 10 },
            { key: 'task_total', label: 'Công việc được giao', width: 12 },
            { key: 'task_done_on_time', label: 'Hoàn thành đúng hạn', width: 12 },
            { key: 'task_done_late', label: 'Hoàn thành quá hạn', width: 12 },
            { key: 'task_open', label: 'Đang thực hiện', width: 12 },
            { key: 'task_overdue', label: 'Quá hạn chưa xong', width: 12 },
            { key: 'schedule_count', label: 'Lịch công tác đã công bố', width: 12 },
          ],
          rows: report.rows,
        },
      ];
    } else {
      const report = await this.statistics(currentUser, filter);
      title = 'THỐNG KÊ SỐ LIỆU TRONG ĐƠN VỊ';
      sheets = report.sections.map((section, index) => ({
        title: `Bảng ${index + 1}`,
        heading: [title, section.title, ...heading],
        columns: [
          { key: 'label', label: 'Nội dung', width: 40 },
          { key: 'count', label: 'Số lượng', width: 12 },
        ],
        rows: section.rows,
      }));
    }
    const now = this.clock.now();
    return buildFacilitiesWorkbook({
      database: database as Kysely<SchoolYearDatabase>,
      currentUser,
      reportCode: `document_report_${kind}`,
      fileName: `bao-cao-${kind}-${filter.from}-${filter.to}-${fileStamp(now)}`,
      filters: filter as unknown as Record<string, unknown>,
      orgUnitIds: filter.orgUnitId ? [filter.orgUnitId] : [],
      sheets,
      ipAddress,
      createdAt: now,
      format,
    });
  }
}

function formatDate(date: string): string {
  return date.split('-').reverse().join('/');
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readReportFilter(query: Record<string, string | undefined>): ReportFilter {
  const errors: FieldError[] = [];
  const read = (field: 'from' | 'to') => {
    const value = query[field];
    if (!value || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
      errors.push({ field, message: 'Bắt buộc nhập ngày dạng YYYY-MM-DD' });
      return '';
    }
    return value;
  };
  const from = read('from');
  const to = read('to');
  if (from && to) {
    if (to < from) {
      errors.push({ field: 'to', message: 'Đến ngày không trước từ ngày' });
    } else if (Date.parse(to) - Date.parse(from) > MAXIMUM_RANGE_DAYS * 86_400_000) {
      errors.push({ field: 'to', message: `Khoảng ngày tối đa ${MAXIMUM_RANGE_DAYS} ngày` });
    }
  }
  const orgUnitId = query.org_unit_id || null;
  if (orgUnitId && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { from, to, orgUnitId };
}

const KINDS = ['incoming', 'summary', 'statistics'] as const;

@Controller()
export class DocumentReportsController {
  constructor(private readonly reports: DocumentReportsService) {}

  @Get('document-reports/incoming')
  @RequirePermission(REPORT)
  processing(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.processing(currentUser, readReportFilter(query));
  }

  @Get('document-reports/summary')
  @RequirePermission(REPORT)
  summary(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.summary(currentUser, readReportFilter(query));
  }

  @Get('document-reports/statistics')
  @RequirePermission(REPORT)
  statistics(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.statistics(currentUser, readReportFilter(query));
  }

  @Get('document-reports/export')
  @RequirePermission(REPORT)
  async export(
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const kind = query.kind as (typeof KINDS)[number];
    const format = readTableFileFormat(query.format ?? 'xlsx');
    if (!KINDS.includes(kind) || !format) {
      throw validationError([
        { field: KINDS.includes(kind) ? 'format' : 'kind', message: 'Loại báo cáo hoặc định dạng không hợp lệ' },
      ]);
    }
    sendWorkbook(
      response,
      await this.reports.export(currentUser, kind, readReportFilter(query), format, request.ip ?? null),
    );
  }
}
