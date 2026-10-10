import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { SchoolCalendar, VIETNAM_DATE, type StaffDay } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';

// Chấm công của nhân sự (P08-01, BR-39, YCTD-59). Nhân sự có hồ sơ liên kết tài khoản tự bấm vào ca, ra ca cho ngày
// hôm nay, giờ lấy theo máy chủ; phòng nhân sự nhập hoặc sửa giờ cho mọi người trong đơn vị, có nhật ký.
// Số phút làm = giờ ra − giờ vào − nghỉ trưa; vào sau giờ vào làm là đi muộn, ra trước giờ tan làm là về sớm
export interface WorkHours {
  startMinutes: number | null;
  endMinutes: number | null;
  lunchMinutes: number;
}

export interface AttendanceTimes {
  worked_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
}

const VIETNAM_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function attendanceTimes(checkIn: string, checkOut: string | null, hours: WorkHours): AttendanceTimes {
  const start = minutesOf(checkIn);
  const late = hours.startMinutes === null ? null : Math.max(0, start - hours.startMinutes);
  if (checkOut === null) {
    return { worked_minutes: null, late_minutes: late, early_leave_minutes: null };
  }
  const end = minutesOf(checkOut);
  return {
    worked_minutes: Math.max(0, end - start - hours.lunchMinutes),
    late_minutes: late,
    early_leave_minutes: hours.endMinutes === null ? null : Math.max(0, hours.endMinutes - end),
  };
}

export function monthRange(month: string): { from: string; to: string } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw validationError([{ field: 'month', message: 'Tháng theo dạng YYYY-MM' }]);
  }
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

const LOG_COLUMNS = [
  'attendance_logs.id',
  'attendance_logs.staff_id',
  'attendance_logs.work_date',
  'attendance_logs.check_in',
  'attendance_logs.check_out',
  'attendance_logs.worked_minutes',
  'attendance_logs.late_minutes',
  'attendance_logs.early_leave_minutes',
  'attendance_logs.source',
  'attendance_logs.note',
] as const;

@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  // Giờ làm việc hiệu lực của đơn vị; thiếu cấu hình thì để trống phần tương ứng
  async workHours(orgUnitId: string): Promise<WorkHours> {
    const effective = await this.settings.effective(orgUnitId);
    const value = (key: string) => effective.find((item) => item.key === key)?.value;
    const start = value('work_start_time');
    const end = value('work_end_time');
    const lunch = value('lunch_break_minutes');
    return {
      startMinutes: typeof start === 'string' ? minutesOf(start) : null,
      endMinutes: typeof end === 'string' ? minutesOf(end) : null,
      lunchMinutes: typeof lunch === 'number' ? lunch : 0,
    };
  }

  // Chấm công của chính mình trong một tháng, kèm loại ngày để hiện lịch
  async mine(currentUser: CurrentUser, month: string) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.ownStaff(database, currentUser);
    const { from, to } = monthRange(month);
    const logs = await database
      .selectFrom('attendance_logs')
      .select(LOG_COLUMNS)
      .where('attendance_logs.staff_id', '=', staff.id)
      .where('attendance_logs.work_date', '>=', from)
      .where('attendance_logs.work_date', '<=', to)
      .orderBy('attendance_logs.work_date')
      .execute();
    const today = this.today();
    const todayLog =
      logs.find((log) => log.work_date === today) ??
      (await database
        .selectFrom('attendance_logs')
        .select(LOG_COLUMNS)
        .where('attendance_logs.staff_id', '=', staff.id)
        .where('attendance_logs.work_date', '=', today)
        .executeTakeFirst()) ??
      null;
    return {
      staff: { id: staff.id, code: staff.code, full_name: staff.full_name, status: staff.status },
      today,
      today_log: todayLog,
      days: this.describeDays(await this.calendar.staffDays(from, to)),
      logs,
    };
  }

  // Bấm vào ca: một lần mỗi ngày, giờ theo máy chủ
  async checkIn(currentUser: CurrentUser, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.ownStaff(database, currentUser);
    this.assertActive(staff.status);
    const today = this.today();
    const existing = await database
      .selectFrom('attendance_logs')
      .select('check_in')
      .where('staff_id', '=', staff.id)
      .where('work_date', '=', today)
      .executeTakeFirst();
    if (existing) {
      throw ruleViolationError('BR-39', `Hôm nay bạn đã vào ca lúc ${existing.check_in}`);
    }
    const checkIn = this.nowTime();
    const times = attendanceTimes(checkIn, null, await this.workHours(staff.org_unit_id));
    await database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('attendance_logs')
        .values({
          staff_id: staff.id,
          work_date: today,
          check_in: checkIn,
          ...times,
          source: 'self',
          updated_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'attendance_logs',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { staff_id: staff.id, work_date: today, check_in: checkIn, source: 'self' },
      });
    });
    return this.mine(currentUser, today.slice(0, 7));
  }

  // Bấm ra ca: phải vào ca trước; bấm lại thì lấy giờ ra mới nhất
  async checkOut(currentUser: CurrentUser, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.ownStaff(database, currentUser);
    this.assertActive(staff.status);
    const today = this.today();
    const existing = await database
      .selectFrom('attendance_logs')
      .select(['id', 'check_in', 'check_out'])
      .where('staff_id', '=', staff.id)
      .where('work_date', '=', today)
      .executeTakeFirst();
    if (!existing) {
      throw ruleViolationError('BR-39', 'Hôm nay bạn chưa vào ca');
    }
    const checkOut = this.nowTime();
    if (checkOut <= existing.check_in) {
      throw ruleViolationError('BR-39', 'Giờ ra phải lớn hơn giờ vào');
    }
    const times = attendanceTimes(existing.check_in, checkOut, await this.workHours(staff.org_unit_id));
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('attendance_logs')
        .set({ check_out: checkOut, ...times, updated_by: origin.actorUserId, updated_at: this.clock.now() })
        .where('id', '=', existing.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'attendance_logs',
        entityId: existing.id,
        action: 'update',
        before: { check_out: existing.check_out },
        after: { check_out: checkOut, source: 'self' },
      });
    });
    return this.mine(currentUser, today.slice(0, 7));
  }

  // Bảng chấm công của một đơn vị trong tháng: nhân sự có đơn vị chính là đơn vị đó và còn làm việc trong tháng
  async sheet(currentUser: CurrentUser, orgUnitId: string, month: string) {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceView, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem bảng chấm công của đơn vị này');
    }
    const { database } = await this.currentSchoolYear.require();
    const { from, to } = monthRange(month);
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name', 'start_date', 'end_date', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .where('start_date', '<=', to)
      .where((expression) => expression.or([expression('end_date', 'is', null), expression('end_date', '>=', from)]))
      .orderBy('full_name')
      .execute();
    const logs =
      staff.length === 0
        ? []
        : await database
            .selectFrom('attendance_logs')
            .select(LOG_COLUMNS)
            .where(
              'attendance_logs.staff_id',
              'in',
              staff.map((row) => row.id),
            )
            .where('attendance_logs.work_date', '>=', from)
            .where('attendance_logs.work_date', '<=', to)
            .orderBy('attendance_logs.work_date')
            .execute();
    const hours = await this.workHours(orgUnitId);
    return {
      org_unit_id: orgUnitId,
      month,
      today: this.today(),
      work_hours: {
        start_time: hours.startMinutes === null ? null : this.formatMinutes(hours.startMinutes),
        end_time: hours.endMinutes === null ? null : this.formatMinutes(hours.endMinutes),
        lunch_break_minutes: hours.lunchMinutes,
      },
      can_manage: await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceManage, orgUnitId),
      days: this.describeDays(await this.calendar.staffDays(from, to)),
      staff: staff.map((row) => ({ ...row, logs: logs.filter((log) => log.staff_id === row.id) })),
    };
  }

  // Phòng nhân sự nhập hoặc sửa giờ của một ngày đã qua hoặc hôm nay; nhân sự phải đang làm việc vào ngày đó
  async save(
    currentUser: CurrentUser,
    input: { staffId: string; workDate: string; checkIn: string; checkOut: string | null; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'start_date', 'end_date'])
      .where('id', '=', input.staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    if (!(await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceManage, staff.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền chấm công cho nhân sự của đơn vị này');
    }
    if (input.workDate > this.today()) {
      throw validationError([{ field: 'work_date', message: 'Không chấm công trước cho ngày chưa tới' }]);
    }
    if (input.workDate < staff.start_date || (staff.end_date !== null && input.workDate > staff.end_date)) {
      throw ruleViolationError('BR-39', 'Ngày này nhân sự chưa vào làm hoặc đã nghỉ việc');
    }
    if (input.checkOut !== null && input.checkOut <= input.checkIn) {
      throw validationError([{ field: 'check_out', message: 'Giờ ra phải lớn hơn giờ vào' }]);
    }
    const times = attendanceTimes(input.checkIn, input.checkOut, await this.workHours(staff.org_unit_id));
    const existing = await database
      .selectFrom('attendance_logs')
      .select(['id', 'check_in', 'check_out', 'note', 'source'])
      .where('staff_id', '=', input.staffId)
      .where('work_date', '=', input.workDate)
      .executeTakeFirst();
    const values = {
      check_in: input.checkIn,
      check_out: input.checkOut,
      ...times,
      note: input.note,
      source: 'manual' as const,
      updated_by: origin.actorUserId,
    };
    const logId = await database.transaction().execute(async (transaction) => {
      const row = existing
        ? await transaction
            .updateTable('attendance_logs')
            .set({ ...values, updated_at: this.clock.now() })
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('attendance_logs')
            .values({ staff_id: input.staffId, work_date: input.workDate, ...values })
            .returning('id')
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'attendance_logs',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: { staff_id: input.staffId, work_date: input.workDate, ...values },
      });
      return row.id;
    });
    return database.selectFrom('attendance_logs').select(LOG_COLUMNS).where('id', '=', logId).executeTakeFirstOrThrow();
  }

  private describeDays(days: Map<string, StaffDay>) {
    return [...days.entries()].map(([date, day]) => ({ date, ...day }));
  }

  private async ownStaff(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser) {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'code', 'full_name', 'status'])
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  private assertActive(status: string): void {
    if (status !== 'active') {
      throw ruleViolationError('BR-39', 'Hồ sơ nhân sự đã nghỉ việc, không chấm công được');
    }
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private nowTime(): string {
    return VIETNAM_TIME.format(this.clock.now());
  }

  private formatMinutes(total: number): string {
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
}
