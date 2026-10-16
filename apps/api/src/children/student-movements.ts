import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req, Res } from '@nestjs/common';
import type { ChildGender } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid } from '../common/request-fields.js';
import { ChildScope } from './child-scope.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from './student-workbook.js';
import { readTableFileFormat, type TableFileFormat } from '../exports/table-file.js';

// 4.2 Biến động học sinh (DT-15 phần 15c, YCTD-108): danh sách thay đổi của học sinh theo khoảng ngày, dựng từ lịch sử đã
// có trong năm học, không có bảng riêng: nhập học (ngày nhập học của hồ sơ), chuyển lớp (dòng lịch sử lớp nối tiếp dòng
// trước, không do chuyển đơn vị), chuyển đơn vị (`child_unit_transfers`, P02-07), thôi học (ngày thôi học, P02-08). Người
// dùng chỉ thấy học sinh trong phạm vi xem trẻ (BR-72). Trường chưa liên thông với trường khác nên chưa có chuyển đến,
// chuyển đi giữa các trường như của Sở
export const MOVEMENT_KINDS = ['enrolled', 'class_transfer', 'unit_transfer', 'withdrawn'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  enrolled: 'Nhập học',
  class_transfer: 'Chuyển lớp',
  unit_transfer: 'Chuyển đơn vị',
  withdrawn: 'Thôi học',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);

export interface MovementFilter {
  from: string | null;
  to: string | null;
  kind: MovementKind | null;
  orgUnitId: string | null;
  q: string | null;
}

export interface MovementRow {
  id: string;
  kind: MovementKind;
  date: string;
  child_id: string;
  full_name: string;
  dob: string;
  gender: ChildGender;
  moet_student_code: string | null;
  org_unit_id: string;
  from_name: string | null;
  to_name: string | null;
  reason: string | null;
}

const MOVEMENT_COLUMNS: Array<{ key: string; label: string; value(row: MovementRow): string }> = [
  { key: 'date', label: 'Ngày', value: (row) => row.date.split('-').reverse().join('/') },
  { key: 'kind', label: 'Loại biến động', value: (row) => MOVEMENT_KIND_LABELS[row.kind] },
  { key: 'moet_student_code', label: 'Mã định danh Bộ GD&ĐT', value: (row) => row.moet_student_code ?? '' },
  { key: 'full_name', label: 'Họ tên', value: (row) => row.full_name },
  { key: 'dob', label: 'Ngày sinh', value: (row) => row.dob.split('-').reverse().join('/') },
  { key: 'gender', label: 'Giới tính', value: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
  { key: 'from_name', label: 'Từ', value: (row) => row.from_name ?? '' },
  { key: 'to_name', label: 'Đến', value: (row) => row.to_name ?? '' },
  { key: 'reason', label: 'Lý do', value: (row) => row.reason ?? '' },
];

export function readMovementFilter(query: Record<string, unknown>, errors: FieldError[]): MovementFilter {
  const date = (field: string) => {
    const value = query[field];
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
      errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
      return null;
    }
    return value;
  };
  const from = date('from');
  const to = date('to');
  if (from && to && from > to) {
    errors.push({ field: 'to', message: 'Đến ngày không trước từ ngày' });
  }
  const kind = query.kind;
  if (kind !== undefined && kind !== '' && !MOVEMENT_KINDS.includes(kind as MovementKind)) {
    errors.push({ field: 'kind', message: 'Loại biến động không hợp lệ' });
  }
  const orgUnitId = query.org_unit_id;
  if (orgUnitId !== undefined && orgUnitId !== '' && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q.length > 100) {
    errors.push({ field: 'q', message: 'Tối đa 100 ký tự' });
  }
  return {
    from,
    to,
    kind: MOVEMENT_KINDS.includes(kind as MovementKind) ? (kind as MovementKind) : null,
    orgUnitId: isUuid(orgUnitId) ? orgUnitId : null,
    q: q || null,
  };
}

@Injectable()
export class StudentMovementsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly childScope: ChildScope,
    private readonly clock: Clock,
  ) {}

  // Mọi biến động theo bộ lọc, mới nhất trước
  async rows(currentUser: CurrentUser, filter: MovementFilter): Promise<MovementRow[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const database = current.database;
    const scope = await this.childScope.resolve(currentUser, database);
    const children = () => {
      let query = database.selectFrom('children').where(this.childScope.filter(scope));
      if (filter.orgUnitId) {
        query = query.where('children.org_unit_id', '=', filter.orgUnitId);
      }
      if (filter.q) {
        query = query.where('children.full_name', 'ilike', `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`);
      }
      return query;
    };
    const inPeriod = (date: string | null) =>
      date !== null && (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to);
    const wants = (kind: MovementKind) => !filter.kind || filter.kind === kind;
    const childColumns = [
      'children.id as child_id',
      'children.full_name',
      'children.dob',
      'children.gender',
      'children.moet_student_code',
      'children.org_unit_id',
    ] as const;
    const result: MovementRow[] = [];

    if (wants('enrolled')) {
      const rows = await children()
        .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
        .select([
          ...childColumns,
          'children.enroll_date',
          'org_units.name as unit_name',
          (expression) =>
            expression
              .selectFrom('class_enrollments')
              .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
              .select('classes.name')
              .whereRef('class_enrollments.child_id', '=', 'children.id')
              .whereRef('class_enrollments.from_date', '=', 'children.enroll_date')
              .orderBy('class_enrollments.created_at')
              .limit(1)
              .as('class_name'),
        ])
        .where('children.enroll_date', 'is not', null)
        .execute();
      for (const row of rows) {
        if (inPeriod(row.enroll_date)) {
          result.push({
            ...this.child(row),
            id: `enrolled:${row.child_id}`,
            kind: 'enrolled',
            date: row.enroll_date ?? '',
            from_name: null,
            to_name: row.class_name ? `${row.class_name} (${row.unit_name})` : row.unit_name,
            reason: null,
          });
        }
      }
    }

    if (wants('class_transfer')) {
      const rows = await children()
        .innerJoin('class_enrollments as next', 'next.child_id', 'children.id')
        .innerJoin('class_enrollments as previous', (join) =>
          join
            .onRef('previous.child_id', '=', 'next.child_id')
            .onRef('previous.to_date', '=', 'next.from_date')
            .onRef('previous.id', '!=', 'next.id'),
        )
        .innerJoin('classes as next_class', 'next_class.id', 'next.class_id')
        .innerJoin('classes as previous_class', 'previous_class.id', 'previous.class_id')
        .select([
          ...childColumns,
          'next.id as enrollment_id',
          'next.from_date',
          'next.reason',
          'next_class.name as to_name',
          'previous_class.name as from_name',
        ])
        // Dòng lớp mới do chuyển đơn vị đã có ở loại chuyển đơn vị
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom('child_unit_transfers')
                .select('child_unit_transfers.id')
                .whereRef('child_unit_transfers.child_id', '=', 'next.child_id')
                .whereRef('child_unit_transfers.to_class_id', '=', 'next.class_id')
                .whereRef('child_unit_transfers.effective_date', '=', 'next.from_date'),
            ),
          ),
        )
        .execute();
      for (const row of rows) {
        if (inPeriod(row.from_date)) {
          result.push({
            ...this.child(row),
            id: `class_transfer:${row.enrollment_id}`,
            kind: 'class_transfer',
            date: row.from_date,
            from_name: row.from_name,
            to_name: row.to_name,
            reason: row.reason,
          });
        }
      }
    }

    if (wants('unit_transfer')) {
      const rows = await children()
        .innerJoin('child_unit_transfers', 'child_unit_transfers.child_id', 'children.id')
        .innerJoin('org_units as from_unit', 'from_unit.id', 'child_unit_transfers.from_org_unit_id')
        .innerJoin('org_units as to_unit', 'to_unit.id', 'child_unit_transfers.to_org_unit_id')
        .innerJoin('classes as to_class', 'to_class.id', 'child_unit_transfers.to_class_id')
        .leftJoin('classes as from_class', 'from_class.id', 'child_unit_transfers.from_class_id')
        .select([
          ...childColumns,
          'child_unit_transfers.id as transfer_id',
          'child_unit_transfers.effective_date',
          'child_unit_transfers.reason',
          'from_unit.name as from_unit',
          'to_unit.name as to_unit',
          'from_class.name as from_class',
          'to_class.name as to_class',
        ])
        .execute();
      for (const row of rows) {
        if (inPeriod(row.effective_date)) {
          result.push({
            ...this.child(row),
            id: `unit_transfer:${row.transfer_id}`,
            kind: 'unit_transfer',
            date: row.effective_date,
            from_name: row.from_class ? `${row.from_class} (${row.from_unit})` : row.from_unit,
            to_name: `${row.to_class} (${row.to_unit})`,
            reason: row.reason,
          });
        }
      }
    }

    if (wants('withdrawn')) {
      const rows = await children()
        .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
        .select([
          ...childColumns,
          'children.leave_date',
          'children.leave_reason',
          'org_units.name as unit_name',
          (expression) =>
            expression
              .selectFrom('class_enrollments')
              .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
              .select('classes.name')
              .whereRef('class_enrollments.child_id', '=', 'children.id')
              .whereRef('class_enrollments.to_date', '=', 'children.leave_date')
              .orderBy('class_enrollments.from_date', 'desc')
              .limit(1)
              .as('class_name'),
        ])
        .where('children.status', '=', 'withdrawn')
        .where('children.leave_date', 'is not', null)
        .execute();
      for (const row of rows) {
        if (inPeriod(row.leave_date)) {
          result.push({
            ...this.child(row),
            id: `withdrawn:${row.child_id}`,
            kind: 'withdrawn',
            date: row.leave_date ?? '',
            from_name: row.class_name ? `${row.class_name} (${row.unit_name})` : row.unit_name,
            to_name: null,
            reason: row.leave_reason,
          });
        }
      }
    }

    const collator = new Intl.Collator('vi');
    return result.sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        collator.compare(left.full_name, right.full_name) ||
        left.id.localeCompare(right.id),
    );
  }

  async list(currentUser: CurrentUser, filter: MovementFilter, page: number, pageSize: number) {
    const rows = await this.rows(currentUser, filter);
    const counts = Object.fromEntries(
      MOVEMENT_KINDS.map((kind) => [kind, rows.filter((row) => row.kind === kind).length]),
    ) as Record<MovementKind, number>;
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      page_size: pageSize,
      total: rows.length,
      total_pages: Math.max(1, Math.ceil(rows.length / pageSize)),
      counts,
    };
  }

  // Tệp Excel hoặc PDF (DT-16 phần 16a) theo bộ lọc đang chọn; ghi nhật ký xuất có dữ liệu cá nhân (BR-74)
  async export(currentUser: CurrentUser, filter: MovementFilter, ipAddress: string | null, format: TableFileFormat = 'xlsx') {
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.rows(currentUser, filter);
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'student-movements',
      title: 'Biến động học sinh',
      fileName: `bien-dong-hoc-sinh-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      columns: MOVEMENT_COLUMNS.map((column) => ({ key: column.key, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(MOVEMENT_COLUMNS.map((column) => [column.key, column.value(row)]))),
      ipAddress,
      createdAt,
      format,
    });
  }

  private child(row: {
    child_id: string;
    full_name: string;
    dob: string;
    gender: ChildGender;
    moet_student_code: string | null;
    org_unit_id: string;
  }) {
    return {
      child_id: row.child_id,
      full_name: row.full_name,
      dob: row.dob,
      gender: row.gender,
      moet_student_code: row.moet_student_code,
      org_unit_id: row.org_unit_id,
    };
  }
}

// Xem cần quyền lập hoặc duyệt hồ sơ trẻ; xuất Excel cần thêm quyền xuất dữ liệu (BR-74)
@Controller('student-movements')
export class StudentMovementsController {
  constructor(private readonly movements: StudentMovementsService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readMovementFilter(query, errors);
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!PAGE_SIZES.has(pageSize)) {
      errors.push({ field: 'page_size', message: 'Cỡ trang là 10, 20, 50, 100 hoặc 200' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.movements.list(currentUser, filter, page, pageSize);
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async export(
    @Body() body: Record<string, unknown> | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readMovementFilter(body ?? {}, errors);
    const format = readTableFileFormat(body?.format);
    if (!format) {
      errors.push({ field: 'format', message: 'Định dạng xuất là xlsx hoặc pdf' });
    }
    if (errors.length > 0 || !format) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.movements.export(currentUser, filter, request.ip ?? null, format));
  }
}
