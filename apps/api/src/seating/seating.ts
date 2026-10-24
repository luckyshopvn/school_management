import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  arrangeSeats,
  PERMISSION_CODES,
  rotateSeats,
  seatCapacity,
  seatingIssues,
  type SeatAssignment,
  type SeatingLayout,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readOptionalUuid,
  readRequiredInteger,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { TimetablesService } from '../timetables/timetables.js';

// Sơ đồ chỗ ngồi theo lớp (DT-21 phần 21d, YCTD-171). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mỗi lớp THCS,
// THPT có các bản sơ đồ theo ngày áp dụng (bản mới nhất có ngày áp dụng không sau ngày xem là bản đang dùng); trường muốn
// xếp riêng theo môn thì lập bản có môn, tiết của môn đó dùng bản của môn, môn khác dùng bản của lớp. Giáo viên chủ nhiệm
// xếp lớp mình, người có quyền P02.seating.manage xếp mọi lớp; người xem được sổ đầu bài của lớp xem được sơ đồ. Bản mới lập
// bằng tay (kéo thả ở cổng quản trị), xếp theo danh sách tên, hoặc xoay vòng từ bản cũ theo dãy hay theo bàn. In ra PDF
export const SEATING_RULE_CODE = 'YCTD-171';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SECONDARY_LEVELS = ['THCS', 'THPT'];
const CHART_COLUMNS = [
  'id',
  'class_id',
  'subject_id',
  'effective_from',
  'desk_columns',
  'desk_rows',
  'seats_per_desk',
  'note',
  'updated_by_name',
  'updated_at',
] as const;

async function chartAssignments(database: Executor, chartId: string) {
  return database
    .selectFrom('seating_assignments')
    .innerJoin('children', 'children.id', 'seating_assignments.child_id')
    .select([
      'seating_assignments.child_id',
      'children.full_name',
      'seating_assignments.column_no',
      'seating_assignments.row_no',
      'seating_assignments.seat_no',
    ])
    .where('seating_assignments.chart_id', '=', chartId)
    .orderBy('seating_assignments.row_no')
    .orderBy('seating_assignments.column_no')
    .orderBy('seating_assignments.seat_no')
    .execute();
}

// Sơ đồ đang áp dụng cho một tiết: bản của môn nếu có, không thì bản của lớp; trống là lớp chưa có sơ đồ
export async function effectiveSeating(database: Executor, classId: string, subjectId: string | null, date: string) {
  const candidates = await database
    .selectFrom('seating_charts')
    .select(CHART_COLUMNS)
    .where('class_id', '=', classId)
    .where('effective_from', '<=', date)
    .orderBy('effective_from', 'desc')
    .execute();
  const chart =
    (subjectId ? candidates.find((item) => item.subject_id === subjectId) : undefined) ??
    candidates.find((item) => item.subject_id === null);
  return chart ? { ...chart, assignments: await chartAssignments(database, chart.id) } : null;
}

export interface SeatingInput extends SeatingLayout {
  class_id: string;
  subject_id: string | null;
  effective_from: string;
  note: string | null;
  // Cách lập: tự xếp từng chỗ, xếp theo danh sách tên, hoặc xoay vòng từ một bản cũ
  mode: 'manual' | 'by_name' | 'rotate';
  assignments: SeatAssignment[];
  from_chart_id: string | null;
  rotate: 'columns' | 'rows';
}

export function parseSeatingInput(body: RequestBody, updating = false): SeatingInput {
  const errors: FieldError[] = [];
  if (!updating && !isUuid(body?.class_id)) {
    errors.push({ field: 'class_id', message: 'Bắt buộc chọn lớp' });
  }
  const subjectId = readOptionalUuid(body, 'subject_id', errors) ?? null;
  const effective = body?.effective_from;
  if (typeof effective !== 'string' || !DATE_PATTERN.test(effective) || Number.isNaN(Date.parse(effective))) {
    errors.push({ field: 'effective_from', message: 'Ngày áp dụng dạng YYYY-MM-DD' });
  }
  const columns = readRequiredInteger(body, 'desk_columns', errors, { min: 1, max: 8 });
  const rows = readRequiredInteger(body, 'desk_rows', errors, { min: 1, max: 15 });
  const seats = readRequiredInteger(body, 'seats_per_desk', errors, { min: 1, max: 4 });
  const note = readOptionalText(body, 'note', errors) ?? null;
  if (note && note.length > 500) {
    errors.push({ field: 'note', message: 'Tối đa 500 ký tự' });
  }
  const mode = (body?.mode ?? 'manual') as SeatingInput['mode'];
  if (!['manual', 'by_name', 'rotate'].includes(mode) || (updating && mode !== 'manual')) {
    errors.push({ field: 'mode', message: 'Cách lập là manual, by_name hoặc rotate (sửa bản chỉ manual)' });
  }
  const fromChart = readOptionalUuid(body, 'from_chart_id', errors) ?? null;
  if (mode === 'rotate' && !fromChart) {
    errors.push({ field: 'from_chart_id', message: 'Chọn bản sơ đồ để xoay vòng' });
  }
  const rotate = (body?.rotate ?? 'columns') as SeatingInput['rotate'];
  if (rotate !== 'columns' && rotate !== 'rows') {
    errors.push({ field: 'rotate', message: 'Xoay theo dãy (columns) hoặc theo bàn (rows)' });
  }
  const raw = body?.assignments ?? [];
  if (!Array.isArray(raw)) {
    errors.push({ field: 'assignments', message: 'Danh sách chỗ ngồi không hợp lệ' });
  }
  const assignments = (Array.isArray(raw) ? raw : []).map((value, index) => {
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    if (!isUuid(item.child_id)) {
      errors.push({ field: `assignments[${index}].child_id`, message: 'Học sinh không hợp lệ' });
    }
    for (const field of ['column_no', 'row_no', 'seat_no']) {
      if (typeof item[field] !== 'number' || !Number.isInteger(item[field])) {
        errors.push({ field: `assignments[${index}].${field}`, message: 'Vị trí là số nguyên' });
      }
    }
    return {
      child_id: item.child_id as string,
      column_no: item.column_no as number,
      row_no: item.row_no as number,
      seat_no: item.seat_no as number,
    };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  const layout = { desk_columns: columns, desk_rows: rows, seats_per_desk: seats };
  const issues = mode === 'manual' ? seatingIssues(assignments, layout) : [];
  if (issues.length > 0) {
    throw validationError(issues.map((message) => ({ field: 'assignments', message })));
  }
  return {
    ...layout,
    class_id: body?.class_id as string,
    subject_id: subjectId,
    effective_from: effective as string,
    note,
    mode,
    assignments,
    from_chart_id: fromChart,
    rotate,
  };
}

@Injectable()
export class SeatingService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
    private readonly clock: Clock,
  ) {}

  private async findClass(database: Executor, classId: string) {
    const row = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'school_level', 'max_size'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    if (!SECONDARY_LEVELS.includes(row.school_level)) {
      throw ruleViolationError(SEATING_RULE_CODE, 'Sơ đồ chỗ ngồi dùng cho lớp THCS, THPT');
    }
    return row;
  }

  private async isAssigned(database: Executor, currentUser: CurrentUser, classId: string, homeroomOnly: boolean) {
    const row = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .$if(homeroomOnly, (query) => query.where('assignment_role', '=', 'homeroom'))
      .executeTakeFirst();
    return Boolean(row);
  }

  private async assertCanView(database: Executor, currentUser: CurrentUser, classId: string) {
    if (
      this.timetables.isStaffViewer(currentUser) ||
      currentUser.hasPermission(PERMISSION_CODES.seatingManage) ||
      (await this.isAssigned(database, currentUser, classId, false))
    ) {
      return;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được sơ đồ chỗ ngồi của lớp này');
  }

  private async canManage(database: Executor, currentUser: CurrentUser, classId: string) {
    return (
      currentUser.hasPermission(PERMISSION_CODES.seatingManage) ||
      (await this.isAssigned(database, currentUser, classId, true))
    );
  }

  private async assertCanManage(database: Executor, currentUser: CurrentUser, classId: string) {
    if (!(await this.canManage(database, currentUser, classId))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên chủ nhiệm hoặc người có quyền xếp sơ đồ chỗ ngồi sửa được',
      );
    }
  }

  // Học sinh đang học, xếp theo tên tiếng Việt (không theo bảng đối chiếu của cơ sở dữ liệu để mọi máy cùng thứ tự)
  private async students(database: Executor, classId: string) {
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .execute();
    return rows.sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi'));
  }

  private async findChart(database: Executor, chartId: string) {
    const chart = await database
      .selectFrom('seating_charts')
      .select(CHART_COLUMNS)
      .where('id', '=', chartId)
      .executeTakeFirst();
    if (!chart) {
      throw notFoundError('Không tìm thấy sơ đồ chỗ ngồi', 'seating_chart');
    }
    return chart;
  }

  // Các bản sơ đồ của lớp kèm học sinh của lớp; bản đang áp dụng hôm nay đánh dấu
  async list(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertCanView(database, currentUser, classId);
    const charts = await database
      .selectFrom('seating_charts')
      .leftJoin('subjects', 'subjects.id', 'seating_charts.subject_id')
      .select([...CHART_COLUMNS.map((column) => `seating_charts.${column}` as const), 'subjects.name as subject_name'])
      .where('seating_charts.class_id', '=', classId)
      .orderBy('seating_charts.effective_from', 'desc')
      .execute();
    const current = await effectiveSeating(database, classId, null, date);
    return {
      class: classRow,
      can_manage: await this.canManage(database, currentUser, classId),
      current_chart_id: current?.id ?? null,
      charts,
      students: await this.students(database, classId),
    };
  }

  async detail(currentUser: CurrentUser, chartId: string) {
    const { database } = await this.currentSchoolYear.require();
    const chart = await this.findChart(database, chartId);
    await this.assertCanView(database, currentUser, chart.class_id);
    return { ...chart, assignments: await chartAssignments(database, chartId) };
  }

  // Chỗ ngồi của bản theo cách lập; học sinh phải đang học ở lớp, sơ đồ đủ chỗ
  private async resolveAssignments(database: Executor, input: SeatingInput): Promise<SeatAssignment[]> {
    const students = await this.students(database, input.class_id);
    const layout: SeatingLayout = input;
    if (input.mode === 'by_name') {
      if (students.length > seatCapacity(layout)) {
        throw ruleViolationError(
          SEATING_RULE_CODE,
          `Sơ đồ có ${seatCapacity(layout)} chỗ, lớp có ${students.length} học sinh`,
        );
      }
      return arrangeSeats(
        students.map((student) => student.id),
        layout,
      );
    }
    let assignments = input.assignments;
    if (input.mode === 'rotate') {
      const source = await this.findChart(database, input.from_chart_id as string);
      if (source.class_id !== input.class_id) {
        throw ruleViolationError(SEATING_RULE_CODE, 'Bản xoay vòng phải là sơ đồ của cùng lớp');
      }
      if (
        source.desk_columns !== layout.desk_columns ||
        source.desk_rows !== layout.desk_rows ||
        source.seats_per_desk !== layout.seats_per_desk
      ) {
        throw ruleViolationError(SEATING_RULE_CODE, 'Xoay vòng giữ nguyên số dãy, số bàn, số chỗ của bản cũ');
      }
      assignments = rotateSeats(await chartAssignments(database, source.id), source, input.rotate).map(
        ({ child_id, column_no, row_no, seat_no }) => ({ child_id, column_no, row_no, seat_no }),
      );
    }
    const enrolled = new Set(students.map((student) => student.id));
    if (assignments.some((assignment) => !enrolled.has(assignment.child_id))) {
      throw validationError([{ field: 'assignments', message: 'Có học sinh không thuộc lớp' }]);
    }
    return assignments;
  }

  async create(currentUser: CurrentUser, input: SeatingInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, input.class_id);
    await this.assertCanManage(database, currentUser, input.class_id);
    const assignments = await this.resolveAssignments(database, input);
    const clash = await database
      .selectFrom('seating_charts')
      .select('id')
      .where('class_id', '=', input.class_id)
      .where('effective_from', '=', input.effective_from)
      .where((expression) =>
        input.subject_id ? expression('subject_id', '=', input.subject_id) : expression('subject_id', 'is', null),
      )
      .executeTakeFirst();
    if (clash) {
      throw ruleViolationError(SEATING_RULE_CODE, 'Lớp đã có sơ đồ áp dụng từ ngày này, sửa bản đó thay vì lập mới');
    }
    return database.transaction().execute(async (transaction) => {
      const chart = await transaction
        .insertInto('seating_charts')
        .values({
          class_id: input.class_id,
          subject_id: input.subject_id,
          effective_from: input.effective_from,
          desk_columns: input.desk_columns,
          desk_rows: input.desk_rows,
          seats_per_desk: input.seats_per_desk,
          note: input.note,
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
        })
        .returning(CHART_COLUMNS)
        .executeTakeFirstOrThrow();
      if (assignments.length > 0) {
        await transaction
          .insertInto('seating_assignments')
          .values(assignments.map((assignment) => ({ ...assignment, chart_id: chart.id })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'seating_charts',
        entityId: chart.id,
        action: 'create',
        before: null,
        after: { ...chart, mode: input.mode, assignments },
      });
      return { ...chart, assignments: await chartAssignments(transaction, chart.id) };
    });
  }

  async update(currentUser: CurrentUser, chartId: string, input: SeatingInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const chart = await this.findChart(database, chartId);
    const classRow = await this.findClass(database, chart.class_id);
    await this.assertCanManage(database, currentUser, chart.class_id);
    const assignments = await this.resolveAssignments(database, { ...input, class_id: chart.class_id });
    const before = { ...chart, assignments: await chartAssignments(database, chartId) };
    return database.transaction().execute(async (transaction) => {
      const saved = await transaction
        .updateTable('seating_charts')
        .set({
          effective_from: input.effective_from,
          desk_columns: input.desk_columns,
          desk_rows: input.desk_rows,
          seats_per_desk: input.seats_per_desk,
          note: input.note,
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', chartId)
        .returning(CHART_COLUMNS)
        .executeTakeFirstOrThrow();
      await transaction.deleteFrom('seating_assignments').where('chart_id', '=', chartId).execute();
      if (assignments.length > 0) {
        await transaction
          .insertInto('seating_assignments')
          .values(assignments.map((assignment) => ({ ...assignment, chart_id: chartId })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'seating_charts',
        entityId: chartId,
        action: 'update',
        before,
        after: { ...saved, assignments },
      });
      return { ...saved, assignments: await chartAssignments(transaction, chartId) };
    });
  }

  async remove(currentUser: CurrentUser, chartId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const chart = await this.findChart(database, chartId);
    const classRow = await this.findClass(database, chart.class_id);
    await this.assertCanManage(database, currentUser, chart.class_id);
    const before = { ...chart, assignments: await chartAssignments(database, chartId) };
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('seating_charts').where('id', '=', chartId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'seating_charts',
        entityId: chartId,
        action: 'delete',
        before,
        after: null,
      });
    });
    return { id: chartId };
  }

  // In sơ đồ: mỗi bàn một dòng (bàn đầu ở trên, gần bàn giáo viên), mỗi dãy một cột, tên học sinh theo chỗ trong bàn
  async export(currentUser: CurrentUser, chartId: string, format: 'xlsx' | 'pdf', ip: string | null) {
    const chart = await this.detail(currentUser, chartId);
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, chart.class_id);
    const now = this.clock.now();
    const columns = Array.from({ length: chart.desk_columns }, (_value, index) => ({
      key: `c${index + 1}`,
      label: `Dãy ${index + 1}`,
      width: 28,
    }));
    const rows = Array.from({ length: chart.desk_rows }, (_value, rowIndex) => {
      const row: Record<string, unknown> = { desk: `Bàn ${rowIndex + 1}` };
      for (let column = 1; column <= chart.desk_columns; column += 1) {
        row[`c${column}`] = chart.assignments
          .filter((item) => item.row_no === rowIndex + 1 && item.column_no === column)
          .sort((left, right) => left.seat_no - right.seat_no)
          .map((item) => item.full_name)
          .join(', ');
      }
      return row;
    });
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'seating-chart',
      fileName: `so-do-cho-ngoi-${chart.effective_from}-${fileStamp(now)}`,
      filters: { chart_id: chartId },
      orgUnitIds: [classRow.org_unit_id],
      sheets: [
        {
          title: 'Sơ đồ chỗ ngồi',
          heading: [
            `Sơ đồ chỗ ngồi ${classRow.name}, áp dụng từ ${chart.effective_from.split('-').reverse().join('/')}`,
            'Bàn giáo viên ở phía trên; bàn 1 là bàn đầu',
          ],
          columns: [{ key: 'desk', label: 'Bàn', width: 10 }, ...columns],
          rows,
        },
      ],
      ipAddress: ip,
      createdAt: now,
      format,
    });
  }
}

const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

@Controller('seating-charts')
export class SeatingController {
  constructor(private readonly seating: SeatingService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.class_id)) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp' }]);
    }
    const date = query.date && DATE_PATTERN.test(query.date) ? query.date : todayInVietnam();
    return this.seating.list(currentUser, query.class_id, date);
  }

  @Get(':id')
  detail(
    @Param('id', uuidParameter('Mã sơ đồ không hợp lệ')) chartId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.seating.detail(currentUser, chartId);
  }

  @Get(':id/export')
  async export(
    @Param('id', uuidParameter('Mã sơ đồ không hợp lệ')) chartId: string,
    @Query('format') formatText: string | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const format = readTableFileFormat(formatText ?? 'pdf');
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    sendWorkbook(response, await this.seating.export(currentUser, chartId, format, request.ip ?? null));
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.seating.create(currentUser, parseSeatingInput(body), originOf(request, currentUser));
  }

  @Put(':id')
  update(
    @Param('id', uuidParameter('Mã sơ đồ không hợp lệ')) chartId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.seating.update(currentUser, chartId, parseSeatingInput(body, true), originOf(request, currentUser));
  }

  @Delete(':id')
  remove(
    @Param('id', uuidParameter('Mã sơ đồ không hợp lệ')) chartId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.seating.remove(currentUser, chartId, originOf(request, currentUser));
  }
}
