import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, TimesheetDayStatus } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { attendanceTimes, monthRange, StaffAttendanceService, type WorkHours } from './staff-attendance.service.js';
import { leavePortions } from './timesheet-periods.js';

// Chốt bảng công (P08-04, QT-06 bước 4, 5, 9; BR-39, BR-40, BR-82, BR-84; Q-135, Q-153; YCTD-59). Phòng nhân sự chốt
// từ mùng 1 tháng sau khi không còn đơn nghỉ chờ duyệt; mỗi ngày làm việc ghi đi làm, nghỉ theo đơn đã duyệt hoặc vắng
// không phép; ngày lễ, ngày nghỉ bù ghi riêng. Kỳ đã chốt chỉ mở lại khi Ban Giám hiệu duyệt đề nghị kèm lý do
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface TimesheetDayRow {
  staff_id: string;
  work_date: string;
  status: TimesheetDayStatus;
  worked_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  overtime_minutes: number;
  leave_request_id: string | null;
  leave_days: number;
  absent_days: number;
  unpaid_days: number;
  insurance_days: number;
  note: string | null;
}

const MAXIMUM_OVERTIME_MINUTES = 60;

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly attendance: StaffAttendanceService,
    private readonly clock: Clock,
  ) {}

  // Trạng thái kỳ công kèm đề nghị mở lại gần nhất và tổng hợp bảng công đã chốt
  async period(currentUser: CurrentUser, orgUnitId: string, month: string) {
    if (
      !(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceView, orgUnitId)) &&
      !(await this.inScope(currentUser, PERMISSION_CODES.timesheetReopenApprove, orgUnitId))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem bảng công của đơn vị này');
    }
    monthRange(month);
    const { database } = await this.currentSchoolYear.require();
    const period = await this.findPeriod(database, orgUnitId, month);
    const requests = period
      ? await database
          .selectFrom('timesheet_reopen_requests')
          .selectAll()
          .where('period_id', '=', period.id)
          .orderBy('requested_at', 'desc')
          .execute()
      : [];
    const days = period
      ? await database
          .selectFrom('timesheet_days')
          .innerJoin('staff', 'staff.id', 'timesheet_days.staff_id')
          .select([
            'timesheet_days.staff_id',
            'staff.full_name',
            'staff.code',
            'timesheet_days.status',
            'timesheet_days.overtime_minutes',
            'timesheet_days.leave_days',
            'timesheet_days.absent_days',
            'timesheet_days.unpaid_days',
            'timesheet_days.insurance_days',
          ])
          .where('timesheet_days.period_id', '=', period.id)
          .execute()
      : [];
    const summary = new Map<string, Record<string, number | string>>();
    for (const day of days) {
      const row = summary.get(day.staff_id) ?? {
        staff_id: day.staff_id,
        code: day.code,
        full_name: day.full_name,
        present_days: 0,
        leave_days: 0,
        absent_days: 0,
        unpaid_days: 0,
        insurance_days: 0,
        overtime_minutes: 0,
      };
      row.present_days = Number(row.present_days) + (day.status === 'present' ? 1 - Number(day.leave_days) : 0);
      row.leave_days = Number(row.leave_days) + Number(day.leave_days);
      row.absent_days = Number(row.absent_days) + Number(day.absent_days);
      row.unpaid_days = Number(row.unpaid_days) + Number(day.unpaid_days);
      row.insurance_days = Number(row.insurance_days) + Number(day.insurance_days);
      row.overtime_minutes = Number(row.overtime_minutes) + day.overtime_minutes;
      summary.set(day.staff_id, row);
    }
    return {
      org_unit_id: orgUnitId,
      month,
      status: period?.status ?? 'open',
      closed_at: period?.closed_at ?? null,
      can_close: await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceManage, orgUnitId),
      can_approve_reopen: await this.inScope(currentUser, PERMISSION_CODES.timesheetReopenApprove, orgUnitId),
      reopen_requests: requests,
      summary: [...summary.values()].sort((left, right) =>
        String(left.full_name).localeCompare(String(right.full_name), 'vi'),
      ),
    };
  }

  async close(currentUser: CurrentUser, orgUnitId: string, month: string, origin: ChangeOrigin) {
    await this.assertManager(currentUser, orgUnitId);
    const { from, to } = monthRange(month);
    const today = VIETNAM_DATE.format(this.clock.now());
    if (today <= to) {
      throw ruleViolationError('YCTD-41', 'Chỉ chốt bảng công từ mùng 1 tháng sau');
    }
    const { database } = await this.currentSchoolYear.require();
    const period = await this.findPeriod(database, orgUnitId, month);
    if (period?.status === 'closed') {
      throw ruleViolationError('Q-135', 'Bảng công tháng này đã chốt');
    }
    const hours = await this.attendance.workHours(orgUnitId);
    if (hours.startMinutes === null || hours.endMinutes === null) {
      throw ruleViolationError(
        'BR-39',
        'Đơn vị chưa cấu hình giờ vào làm và giờ tan làm của nhân sự, cấu hình xong mới chốt được bảng công',
      );
    }
    const pending = await database
      .selectFrom('leave_requests')
      .innerJoin('staff', 'staff.id', 'leave_requests.staff_id')
      .select(['staff.full_name', 'leave_requests.from_date', 'leave_requests.to_date'])
      .where('staff.org_unit_id', '=', orgUnitId)
      .where('leave_requests.status', '=', 'pending')
      .where('leave_requests.from_date', '<=', to)
      .where('leave_requests.to_date', '>=', from)
      .orderBy('staff.full_name')
      .execute();
    if (pending.length > 0) {
      throw ruleViolationError(
        'BR-40',
        'Còn đơn nghỉ phép chưa xử lý, xử lý xong mới chốt được',
        pending.map((row) => ({
          field: 'leave_requests',
          message: `${row.full_name}: ${row.from_date} đến ${row.to_date}`,
        })),
      );
    }
    const rows = await this.buildDays(database, orgUnitId, from, to, hours);
    const periodId = await database.transaction().execute(async (transaction) => {
      const [year, monthNumber] = month.split('-').map(Number) as [number, number];
      const saved = period
        ? await transaction
            .updateTable('timesheet_periods')
            .set({
              status: 'closed',
              closed_by: origin.actorUserId,
              closed_at: this.clock.now(),
              updated_at: this.clock.now(),
            })
            .where('id', '=', period.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('timesheet_periods')
            .values({
              org_unit_id: orgUnitId,
              period_year: year,
              period_month: monthNumber,
              status: 'closed',
              closed_by: origin.actorUserId,
              closed_at: this.clock.now(),
            })
            .returning('id')
            .executeTakeFirstOrThrow();
      await transaction.deleteFrom('timesheet_days').where('period_id', '=', saved.id).execute();
      if (rows.length > 0) {
        await transaction
          .insertInto('timesheet_days')
          .values(rows.map((row) => ({ ...row, period_id: saved.id })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'timesheet_periods',
        entityId: saved.id,
        action: 'update',
        before: period ? { status: period.status } : null,
        after: { status: 'closed', month, days: rows.length },
      });
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: 'timesheet_closed',
        title: 'Bảng công đã chốt',
        body: `Bảng công tháng ${month} đã chốt`,
        targetType: 'timesheet_periods',
        targetId: saved.id,
        recipients: [
          { roleCode: 'VT-04', orgUnitId, channel: 'in_app' },
          { roleCode: 'VT-03', orgUnitId, channel: 'in_app' },
        ],
      });
      return saved.id;
    });
    return { id: periodId, ...(await this.period(currentUser, orgUnitId, month)) };
  }

  async requestReopen(
    currentUser: CurrentUser,
    orgUnitId: string,
    month: string,
    reason: string,
    origin: ChangeOrigin,
  ) {
    await this.assertManager(currentUser, orgUnitId);
    monthRange(month);
    const { database } = await this.currentSchoolYear.require();
    const period = await this.findPeriod(database, orgUnitId, month);
    if (period?.status !== 'closed') {
      throw ruleViolationError('Q-135', 'Bảng công tháng này chưa chốt nên không cần mở lại');
    }
    const pending = await database
      .selectFrom('timesheet_reopen_requests')
      .select('id')
      .where('period_id', '=', period.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (pending) {
      throw ruleViolationError('Q-135', 'Đã có đề nghị mở lại đang chờ duyệt');
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('timesheet_reopen_requests')
        .values({ period_id: period.id, reason, requested_by: origin.actorUserId })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'timesheet_reopen_requests',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { month, reason },
      });
      const root = await transaction
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: 'timesheet_reopen_requested',
        title: 'Đề nghị mở lại bảng công',
        body: `Đề nghị mở lại bảng công tháng ${month}: ${reason}`,
        targetType: 'timesheet_reopen_requests',
        targetId: row.id,
        recipients: [
          { roleCode: 'VT-15', orgUnitId, channel: 'in_app' },
          ...(root ? [{ roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' as const }] : []),
        ],
      });
      return row;
    });
    return database
      .selectFrom('timesheet_reopen_requests')
      .selectAll()
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();
  }

  // Đề nghị mở lại đang chờ trong phạm vi người duyệt
  async pendingReopenRequests(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.timesheetReopenApprove);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt mở lại bảng công');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('timesheet_reopen_requests')
      .innerJoin('timesheet_periods', 'timesheet_periods.id', 'timesheet_reopen_requests.period_id')
      .innerJoin('org_units', 'org_units.id', 'timesheet_periods.org_unit_id')
      .selectAll('timesheet_reopen_requests')
      .select([
        'timesheet_periods.org_unit_id',
        'timesheet_periods.period_year',
        'timesheet_periods.period_month',
        'org_units.name as unit_name',
      ])
      .where('timesheet_reopen_requests.status', '=', 'pending');
    if (!scope.wholeSchool) {
      query = query.where('timesheet_periods.org_unit_id', 'in', scope.orgUnitIds);
    }
    return query.orderBy('timesheet_reopen_requests.requested_at').execute();
  }

  async decideReopen(
    currentUser: CurrentUser,
    requestId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await database
      .selectFrom('timesheet_reopen_requests')
      .innerJoin('timesheet_periods', 'timesheet_periods.id', 'timesheet_reopen_requests.period_id')
      .select([
        'timesheet_reopen_requests.id',
        'timesheet_reopen_requests.status',
        'timesheet_reopen_requests.requested_by',
        'timesheet_periods.id as period_id',
        'timesheet_periods.org_unit_id',
        'timesheet_periods.period_year',
        'timesheet_periods.period_month',
      ])
      .where('timesheet_reopen_requests.id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị mở lại bảng công', 'timesheet_reopen_request');
    }
    if (!(await this.inScope(currentUser, PERMISSION_CODES.timesheetReopenApprove, request.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu được duyệt mở lại bảng công');
    }
    if (request.status !== 'pending') {
      throw ruleViolationError('Q-135', 'Đề nghị này đã được xử lý');
    }
    const month = `${request.period_year}-${String(request.period_month).padStart(2, '0')}`;
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('timesheet_reopen_requests')
        .set({
          status: decision.approve ? 'approved' : 'rejected',
          reject_reason: decision.approve ? null : decision.reason,
          decided_by: origin.actorUserId,
          decided_at: this.clock.now(),
        })
        .where('id', '=', requestId)
        .execute();
      if (decision.approve) {
        await transaction
          .updateTable('timesheet_periods')
          .set({ status: 'reopened', updated_at: this.clock.now() })
          .where('id', '=', request.period_id)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'timesheet_reopen_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: decision.approve ? 'approved' : 'rejected', reason: decision.reason, month },
      });
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: decision.approve ? 'timesheet_reopened' : 'timesheet_reopen_rejected',
        title: decision.approve ? 'Bảng công đã được mở lại' : 'Đề nghị mở lại bảng công bị từ chối',
        body: `Bảng công tháng ${month}${decision.reason ? `: ${decision.reason}` : ''}`,
        targetType: 'timesheet_reopen_requests',
        targetId: requestId,
        recipients: [{ userId: request.requested_by, channel: 'in_app' }],
      });
    });
    return this.period(currentUser, request.org_unit_id, month);
  }

  // Bảng công từng ngày của nhân sự có đơn vị chính là đơn vị đó, trong thời gian làm việc
  async buildDays(
    database: Executor,
    orgUnitId: string,
    from: string,
    to: string,
    hours: WorkHours,
  ): Promise<TimesheetDayRow[]> {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'start_date', 'end_date'])
      .where('org_unit_id', '=', orgUnitId)
      .where('start_date', '<=', to)
      .where((expression) => expression.or([expression('end_date', 'is', null), expression('end_date', '>=', from)]))
      .execute();
    if (staff.length === 0) {
      return [];
    }
    const staffIds = staff.map((row) => row.id);
    const days = await this.calendar.staffDays(from, to);
    const logs = await database
      .selectFrom('attendance_logs')
      .select(['staff_id', 'work_date', 'check_in', 'check_out'])
      .where('staff_id', 'in', staffIds)
      .where('work_date', '>=', from)
      .where('work_date', '<=', to)
      .execute();
    const requests = await database
      .selectFrom('leave_requests')
      .select([
        'id',
        'staff_id',
        'from_date',
        'to_date',
        'first_day_half',
        'last_day_half',
        'is_paid',
        'insurance_paid',
      ])
      .where('staff_id', 'in', staffIds)
      .where('status', '=', 'approved')
      .where('from_date', '<=', to)
      .where('to_date', '>=', from)
      .execute();
    const requestDays = await this.calendar.staffDays(
      requests.reduce((earliest, row) => (row.from_date < earliest ? row.from_date : earliest), from),
      requests.reduce((latest, row) => (row.to_date > latest ? row.to_date : latest), to),
    );
    const standardMinutes = (hours.endMinutes ?? 0) - (hours.startMinutes ?? 0) - hours.lunchMinutes;
    const result: TimesheetDayRow[] = [];
    for (const person of staff) {
      const ownLogs = new Map(logs.filter((log) => log.staff_id === person.id).map((log) => [log.work_date, log]));
      const ownLeaves = requests
        .filter((request) => request.staff_id === person.id)
        .map((request) => ({ request, portions: leavePortions(requestDays, request) }));
      for (const [date, day] of days) {
        if (date < person.start_date || (person.end_date !== null && date > person.end_date) || day.kind === 'rest') {
          continue;
        }
        const base = {
          staff_id: person.id,
          work_date: date,
          worked_minutes: null,
          late_minutes: null,
          early_leave_minutes: null,
          overtime_minutes: 0,
          leave_request_id: null,
          leave_days: 0,
          absent_days: 0,
          unpaid_days: 0,
          insurance_days: 0,
          note: null,
        };
        if (day.kind === 'holiday') {
          result.push({ ...base, status: 'holiday', unpaid_days: day.is_paid ? 0 : 1, note: day.name });
          continue;
        }
        if (day.kind === 'compensatory_day_off') {
          result.push({ ...base, status: 'day_off' });
          continue;
        }
        const leave = ownLeaves.find((item) => item.portions.has(date));
        const leaveDays = leave?.portions.get(date) ?? 0;
        const log = ownLogs.get(date);
        const times = log ? attendanceTimes(log.check_in, log.check_out, hours) : null;
        const absentDays = log ? 0 : 1 - leaveDays;
        const status: TimesheetDayStatus = log ? 'present' : leaveDays > 0 ? 'leave' : 'absent';
        result.push({
          ...base,
          status,
          worked_minutes: times?.worked_minutes ?? null,
          late_minutes: leaveDays > 0 ? null : (times?.late_minutes ?? null),
          early_leave_minutes: leaveDays > 0 ? null : (times?.early_leave_minutes ?? null),
          // Giờ làm thêm là phần vượt giờ làm chuẩn, tối đa 1 giờ mỗi ngày (BR-82)
          overtime_minutes:
            leaveDays === 0 && times?.worked_minutes
              ? Math.min(MAXIMUM_OVERTIME_MINUTES, Math.max(0, times.worked_minutes - standardMinutes))
              : 0,
          leave_request_id: leave?.request.id ?? null,
          leave_days: leaveDays,
          absent_days: absentDays,
          unpaid_days: absentDays + (leave && !leave.request.is_paid ? leaveDays : 0),
          insurance_days: leave?.request.insurance_paid ? leaveDays : 0,
        });
      }
    }
    return result;
  }

  private async findPeriod(database: Executor, orgUnitId: string, month: string) {
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    return database
      .selectFrom('timesheet_periods')
      .selectAll()
      .where('org_unit_id', '=', orgUnitId)
      .where('period_year', '=', year)
      .where('period_month', '=', monthNumber)
      .executeTakeFirst();
  }

  private async assertManager(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceManage, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền chốt bảng công của đơn vị này');
    }
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }
}
