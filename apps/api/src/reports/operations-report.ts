import { Controller, Get, Inject, Injectable, Query } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { check, dateRange, optionalUuid, type QueryValues } from './report-filters.js';
import { ReportsService } from './reports.service.js';

// Báo cáo hoạt động và công việc (P17-10; BR-01, BR-64; YCTD-83): quản lý đơn vị xem tình hình vận hành của các lớp trong
// đơn vị được gán theo khoảng ngày. Báo cáo gồm nhiều mục, mỗi mục do một nguồn số liệu cung cấp qua giao diện
// `OperationsSectionProvider`. Các mục có sẵn: điểm danh, sổ liên lạc hằng ngày, y tế, dặn thuốc, thông báo. Mục hoạt động
// (P14) và công việc (P09) được thêm sau bằng cách đăng ký thêm nguồn vào OPERATIONS_SECTION_PROVIDERS khi các phân hệ đó
// có dữ liệu, không phải sửa dịch vụ báo cáo
export const OPERATIONS_SECTION_PROVIDERS = Symbol('OPERATIONS_SECTION_PROVIDERS');
const MAXIMUM_RANGE_DAYS = 366;
const PRESENT_STATUSES = ['present', 'late', 'early_leave', 'late_and_early_leave'];
const NO_ID = '00000000-0000-0000-0000-000000000000';
const VIETNAM_DAY = (column: string) => sql<string>`(${sql.ref(column)} at time zone 'Asia/Ho_Chi_Minh')::date`;

export interface ReportColumn {
  key: string;
  label: string;
}
export type ReportRow = Record<string, string | number | null>;

export interface OperationsClass {
  id: string;
  name: string;
  org_unit_id: string;
  org_unit_name: string;
}

export interface OperationsContext {
  database: Kysely<SchoolYearDatabase>;
  orgUnits: Array<{ id: string; name: string }>;
  classes: OperationsClass[];
  from: string;
  to: string;
}

export interface OperationsSectionProvider {
  code: string;
  title: string;
  build(context: OperationsContext): Promise<{ columns: ReportColumn[]; rows: ReportRow[] }>;
}

const classIds = (context: OperationsContext) =>
  context.classes.length ? context.classes.map((row) => row.id) : [NO_ID];
const CLASS_COLUMNS: ReportColumn[] = [
  { key: 'org_unit_name', label: 'Đơn vị' },
  { key: 'class_name', label: 'Lớp' },
];
const percent = (part: number, whole: number) => (whole ? Math.round((part * 1000) / whole) / 10 : null);

// Một dòng cho mỗi lớp trong phạm vi, các cột số mặc định 0
function perClass(
  context: OperationsContext,
  values: Map<string, Record<string, number>>,
  keys: string[],
): Array<Record<string, string | number>> {
  return context.classes.map((row) => ({
    org_unit_name: row.org_unit_name,
    class_name: row.name,
    ...Object.fromEntries(keys.map((key) => [key, values.get(row.id)?.[key] ?? 0])),
  }));
}

function add(values: Map<string, Record<string, number>>, classId: string, key: string, amount: number) {
  const row = values.get(classId) ?? {};
  row[key] = (row[key] ?? 0) + amount;
  values.set(classId, row);
}

async function presentCounts(context: OperationsContext) {
  const rows = await context.database
    .selectFrom('attendance_records')
    .select(['class_id', 'status'])
    .select((expression) => expression.fn.countAll<string>().as('count'))
    .where('class_id', 'in', classIds(context))
    .where('attendance_date', '>=', context.from)
    .where('attendance_date', '<=', context.to)
    .groupBy(['class_id', 'status'])
    .execute();
  const values = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const count = Number(row.count);
    add(values, row.class_id, 'total', count);
    if (PRESENT_STATUSES.includes(row.status)) {
      add(values, row.class_id, 'present', count);
    } else if (row.status === 'absent_notified') {
      add(values, row.class_id, 'absent_notified', count);
    } else {
      add(values, row.class_id, 'absent_unnotified', count);
    }
  }
  return values;
}

export const attendanceSection: OperationsSectionProvider = {
  code: 'attendance',
  title: 'Điểm danh',
  async build(context) {
    const values = await presentCounts(context);
    const enrolled = await context.database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select('class_enrollments.class_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_enrollments.class_id', 'in', classIds(context))
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .groupBy('class_enrollments.class_id')
      .execute();
    for (const row of enrolled) {
      add(values, row.class_id, 'children_count', Number(row.count));
    }
    const rows = perClass(context, values, [
      'children_count',
      'present',
      'absent_notified',
      'absent_unnotified',
      'total',
    ]).map((row) => ({ ...row, rate_percent: percent(Number(row.present), Number(row.total)) }));
    return {
      columns: [
        ...CLASS_COLUMNS,
        { key: 'children_count', label: 'Sĩ số' },
        { key: 'present', label: 'Lượt đi học' },
        { key: 'absent_notified', label: 'Vắng có báo' },
        { key: 'absent_unnotified', label: 'Vắng không báo' },
        { key: 'rate_percent', label: 'Tỷ lệ đi học (%)' },
      ],
      rows,
    };
  },
};

// Sổ liên lạc: số bản đã công bố, còn nháp, số lần sửa sau công bố; tỷ lệ công bố trên số lượt đi học
export const journalsSection: OperationsSectionProvider = {
  code: 'journals',
  title: 'Sổ liên lạc hằng ngày',
  async build(context) {
    const values = new Map<string, Record<string, number>>();
    const journals = await context.database
      .selectFrom('daily_journals')
      .select(['class_id', 'status'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', 'in', classIds(context))
      .where('journal_date', '>=', context.from)
      .where('journal_date', '<=', context.to)
      .groupBy(['class_id', 'status'])
      .execute();
    for (const row of journals) {
      add(values, row.class_id, row.status === 'published' ? 'published_count' : 'draft_count', Number(row.count));
    }
    const amendments = await context.database
      .selectFrom('journal_amendments')
      .innerJoin('daily_journals', 'daily_journals.id', 'journal_amendments.journal_id')
      .select('daily_journals.class_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('daily_journals.class_id', 'in', classIds(context))
      .where(VIETNAM_DAY('journal_amendments.amended_at'), '>=', context.from)
      .where(VIETNAM_DAY('journal_amendments.amended_at'), '<=', context.to)
      .groupBy('daily_journals.class_id')
      .execute();
    for (const row of amendments) {
      add(values, row.class_id, 'amendment_count', Number(row.count));
    }
    const present = await presentCounts(context);
    for (const [classId, row] of present) {
      add(values, classId, 'present', row.present ?? 0);
    }
    const rows = perClass(context, values, ['published_count', 'draft_count', 'amendment_count', 'present']).map(
      (row) => ({ ...row, coverage_percent: percent(Number(row.published_count), Number(row.present)) }),
    );
    return {
      columns: [
        ...CLASS_COLUMNS,
        { key: 'published_count', label: 'Đã công bố' },
        { key: 'draft_count', label: 'Còn nháp' },
        { key: 'amendment_count', label: 'Lần sửa sau công bố' },
        { key: 'coverage_percent', label: 'Công bố trên lượt đi học (%)' },
      ],
      rows,
    };
  },
};

// Y tế: sự kiện y tế theo mức độ và số lượt chăm sóc hằng ngày, gắn theo lớp hiện tại của trẻ
export const healthSection: OperationsSectionProvider = {
  code: 'health',
  title: 'Y tế',
  async build(context) {
    const values = new Map<string, Record<string, number>>();
    const events = await context.database
      .selectFrom('medical_events')
      .innerJoin('class_enrollments', (join) =>
        join
          .onRef('class_enrollments.child_id', '=', 'medical_events.child_id')
          .on('class_enrollments.is_current', '=', true),
      )
      .select(['class_enrollments.class_id', 'medical_events.severity'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_enrollments.class_id', 'in', classIds(context))
      .where(VIETNAM_DAY('medical_events.occurred_at'), '>=', context.from)
      .where(VIETNAM_DAY('medical_events.occurred_at'), '<=', context.to)
      .groupBy(['class_enrollments.class_id', 'medical_events.severity'])
      .execute();
    for (const row of events) {
      add(values, row.class_id, 'medical_event_count', Number(row.count));
      if (row.severity === 'severe') {
        add(values, row.class_id, 'severe_event_count', Number(row.count));
      }
    }
    const care = await context.database
      .selectFrom('daily_care_logs')
      .innerJoin('class_enrollments', (join) =>
        join
          .onRef('class_enrollments.child_id', '=', 'daily_care_logs.child_id')
          .on('class_enrollments.is_current', '=', true),
      )
      .select('class_enrollments.class_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_enrollments.class_id', 'in', classIds(context))
      .where('daily_care_logs.care_date', '>=', context.from)
      .where('daily_care_logs.care_date', '<=', context.to)
      .groupBy('class_enrollments.class_id')
      .execute();
    for (const row of care) {
      add(values, row.class_id, 'daily_care_count', Number(row.count));
    }
    return {
      columns: [
        ...CLASS_COLUMNS,
        { key: 'medical_event_count', label: 'Sự kiện y tế' },
        { key: 'severe_event_count', label: 'Sự kiện mức nặng' },
        { key: 'daily_care_count', label: 'Lượt chăm sóc' },
      ],
      rows: perClass(context, values, ['medical_event_count', 'severe_event_count', 'daily_care_count']),
    };
  },
};

// Dặn thuốc: số yêu cầu có hiệu lực trong khoảng, số liều đã cho uống và đã bỏ
export const medicationSection: OperationsSectionProvider = {
  code: 'medication',
  title: 'Dặn thuốc',
  async build(context) {
    const values = new Map<string, Record<string, number>>();
    const requests = await context.database
      .selectFrom('medication_requests')
      .select('class_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', 'in', classIds(context))
      .where('from_date', '<=', context.to)
      .where('to_date', '>=', context.from)
      .where('status', '!=', 'rejected')
      .groupBy('class_id')
      .execute();
    for (const row of requests) {
      if (row.class_id) {
        add(values, row.class_id, 'request_count', Number(row.count));
      }
    }
    const doses = await context.database
      .selectFrom('medication_administrations')
      .innerJoin('medication_requests', 'medication_requests.id', 'medication_administrations.request_id')
      .select(['medication_requests.class_id', 'medication_administrations.is_skipped'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('medication_requests.class_id', 'in', classIds(context))
      .where('medication_administrations.scheduled_date', '>=', context.from)
      .where('medication_administrations.scheduled_date', '<=', context.to)
      .groupBy(['medication_requests.class_id', 'medication_administrations.is_skipped'])
      .execute();
    for (const row of doses) {
      if (row.class_id) {
        add(values, row.class_id, row.is_skipped ? 'skipped_count' : 'given_count', Number(row.count));
      }
    }
    return {
      columns: [
        ...CLASS_COLUMNS,
        { key: 'request_count', label: 'Yêu cầu dặn thuốc' },
        { key: 'given_count', label: 'Liều đã cho uống' },
        { key: 'skipped_count', label: 'Liều bỏ' },
      ],
      rows: perClass(context, values, ['request_count', 'given_count', 'skipped_count']),
    };
  },
};

// Thông báo theo đơn vị: số thông báo tạo trong khoảng, tin nhắn đã gửi và gửi lỗi
export const notificationsSection: OperationsSectionProvider = {
  code: 'notifications',
  title: 'Thông báo',
  async build(context) {
    const unitIds = context.orgUnits.map((unit) => unit.id);
    const counts = await context.database
      .selectFrom('notifications')
      .select('org_unit_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('org_unit_id', 'in', unitIds)
      .where(VIETNAM_DAY('notifications.created_at'), '>=', context.from)
      .where(VIETNAM_DAY('notifications.created_at'), '<=', context.to)
      .groupBy('org_unit_id')
      .execute();
    const sms = await context.database
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notifications.org_unit_id', 'notification_recipients.channel_status'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('notifications.org_unit_id', 'in', unitIds)
      .where('notification_recipients.channel', '=', 'sms')
      .where(VIETNAM_DAY('notifications.created_at'), '>=', context.from)
      .where(VIETNAM_DAY('notifications.created_at'), '<=', context.to)
      .groupBy(['notifications.org_unit_id', 'notification_recipients.channel_status'])
      .execute();
    return {
      columns: [
        { key: 'org_unit_name', label: 'Đơn vị' },
        { key: 'notification_count', label: 'Số thông báo' },
        { key: 'sms_sent_count', label: 'Tin nhắn đã gửi' },
        { key: 'sms_failed_count', label: 'Tin nhắn lỗi' },
      ],
      rows: context.orgUnits.map((unit) => ({
        org_unit_name: unit.name,
        notification_count: Number(counts.find((row) => row.org_unit_id === unit.id)?.count ?? 0),
        sms_sent_count: sms
          .filter((row) => row.org_unit_id === unit.id && row.channel_status === 'sent')
          .reduce((sum, row) => sum + Number(row.count), 0),
        sms_failed_count: sms
          .filter((row) => row.org_unit_id === unit.id && row.channel_status === 'failed')
          .reduce((sum, row) => sum + Number(row.count), 0),
      })),
    };
  },
};

// Nguồn số liệu có sẵn trong G2 đến phần 10j; phần hoạt động (P14) và công việc (P09) thêm nguồn của mình vào cuối danh sách
// Hoạt động của lớp theo ngày hoạt động: đã công bố, chờ duyệt, bị từ chối hoặc ẩn (BR-64; YCTD-78, YCTD-83)
export const activitiesSection: OperationsSectionProvider = {
  code: 'activities',
  title: 'Hoạt động của lớp',
  async build(context) {
    const values = new Map<string, Record<string, number>>();
    const activities = await context.database
      .selectFrom('activities')
      .select(['class_id', 'status'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', 'in', classIds(context))
      .where('activity_date', '>=', context.from)
      .where('activity_date', '<=', context.to)
      .groupBy(['class_id', 'status'])
      .execute();
    const keyOf: Record<string, string> = {
      published: 'published_count',
      pending: 'pending_count',
      draft: 'pending_count',
      rejected: 'rejected_count',
      hidden: 'hidden_count',
    };
    for (const row of activities) {
      add(values, row.class_id, keyOf[row.status] ?? 'pending_count', Number(row.count));
    }
    return {
      columns: [
        ...CLASS_COLUMNS,
        { key: 'published_count', label: 'Đã công bố' },
        { key: 'pending_count', label: 'Nháp hoặc chờ duyệt' },
        { key: 'rejected_count', label: 'Bị từ chối' },
        { key: 'hidden_count', label: 'Đã ẩn' },
      ],
      rows: perClass(context, values, ['published_count', 'pending_count', 'rejected_count', 'hidden_count']),
    };
  },
};

// Công việc được giao theo đơn vị, hạn trong khoảng ngày: đã xong, đang làm, quá hạn chưa xong, đã hủy; việc cá nhân không
// tính (BR-70; YCTD-81, YCTD-83)
export const tasksSection: OperationsSectionProvider = {
  code: 'tasks',
  title: 'Công việc được giao',
  async build(context) {
    const unitIds = context.orgUnits.length ? context.orgUnits.map((unit) => unit.id) : [NO_ID];
    const rows = await context.database
      .selectFrom('tasks')
      .select(['org_unit_id', 'status', 'due_date'])
      .where('org_unit_id', 'in', unitIds)
      .where('task_type', '=', 'assigned')
      .where('due_date', '>=', context.from)
      .where('due_date', '<=', context.to)
      .execute();
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const count = (unitId: string, test: (row: { status: string; due_date: string | null }) => boolean) =>
      rows.filter((row) => row.org_unit_id === unitId && test(row)).length;
    return {
      columns: [
        { key: 'org_unit_name', label: 'Đơn vị' },
        { key: 'total_count', label: 'Việc có hạn trong kỳ' },
        { key: 'done_count', label: 'Đã xong' },
        { key: 'open_count', label: 'Chưa xong' },
        { key: 'overdue_count', label: 'Quá hạn chưa xong' },
        { key: 'cancelled_count', label: 'Đã hủy' },
      ],
      rows: context.orgUnits.map((unit) => ({
        org_unit_name: unit.name,
        total_count: count(unit.id, () => true),
        done_count: count(unit.id, (row) => row.status === 'done'),
        open_count: count(unit.id, (row) => row.status === 'todo' || row.status === 'in_progress'),
        overdue_count: count(
          unit.id,
          (row) => (row.status === 'todo' || row.status === 'in_progress') && (row.due_date ?? '') < today,
        ),
        cancelled_count: count(unit.id, (row) => row.status === 'cancelled'),
      })),
    };
  },
};

export const DEFAULT_OPERATIONS_SECTIONS: OperationsSectionProvider[] = [
  attendanceSection,
  journalsSection,
  activitiesSection,
  healthSection,
  medicationSection,
  notificationsSection,
  tasksSection,
];

export interface OperationsFilter {
  orgUnitId: string | null;
  classId: string | null;
  from: string;
  to: string;
}

@Injectable()
export class OperationsReportService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    @Inject(OPERATIONS_SECTION_PROVIDERS) private readonly providers: OperationsSectionProvider[],
  ) {}

  async report(currentUser: CurrentUser, filter: OperationsFilter) {
    const days = (Date.parse(`${filter.to}T00:00:00Z`) - Date.parse(`${filter.from}T00:00:00Z`)) / 86_400_000 + 1;
    if (days > MAXIMUM_RANGE_DAYS) {
      throw validationError([{ field: 'to', message: `Khoảng ngày tối đa ${MAXIMUM_RANGE_DAYS} ngày` }]);
    }
    const { orgUnitIds } = await this.reports.unitScope(
      currentUser,
      PERMISSION_CODES.operationsReport,
      filter.orgUnitId,
      false,
    );
    const { database } = await this.currentSchoolYear.require();
    const orgUnits = await database
      .selectFrom('org_units')
      .select(['id', 'name'])
      .where('id', 'in', orgUnitIds)
      .orderBy('code')
      .execute();
    let classQuery = database
      .selectFrom('classes')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .select(['classes.id', 'classes.name', 'classes.org_unit_id', 'org_units.name as org_unit_name'])
      .where('classes.org_unit_id', 'in', orgUnitIds);
    if (filter.classId) {
      classQuery = classQuery.where('classes.id', '=', filter.classId);
    } else {
      classQuery = classQuery.where('classes.status', '=', 'active');
    }
    const classes = (await classQuery.orderBy('org_units.code').execute()).sort(
      (left, right) =>
        left.org_unit_name.localeCompare(right.org_unit_name, 'vi') || left.name.localeCompare(right.name, 'vi'),
    );
    if (filter.classId && classes.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp này nằm ngoài phạm vi của bạn');
    }
    const context: OperationsContext = { database, orgUnits, classes, from: filter.from, to: filter.to };
    const sections = [];
    for (const provider of this.providers) {
      sections.push({ code: provider.code, title: provider.title, ...(await provider.build(context)) });
    }
    return { from: filter.from, to: filter.to, org_unit_ids: orgUnitIds, class_id: filter.classId, sections };
  }
}

@Controller('reports')
export class OperationsReportController {
  constructor(private readonly operations: OperationsReportService) {}

  @Get('activities')
  activities(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      classId: optionalUuid(query, 'class_id', errors),
      ...dateRange(query, errors),
    };
    check(errors);
    return this.operations.report(currentUser, filter);
  }
}
