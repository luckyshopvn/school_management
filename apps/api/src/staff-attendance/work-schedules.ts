import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { WorkScheduleType } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { monthRange } from './staff-attendance.service.js';
import { assertMonthsOpen } from './timesheet-periods.js';

// Lịch nghỉ và lịch công tác (P08-02; YCTD-68): phòng nhân sự, quản lý đơn vị lập lịch nháp cho nhân sự trong đơn vị,
// công bố theo tháng thì nhân sự nhận thông báo và xem được lịch của mình. Ngày công tác đã công bố mà chưa chấm công được
// bảng công tính là ngày làm việc đủ giờ chuẩn; lịch nghỉ chỉ để thông báo, ngày nghỉ ảnh hưởng lương đi qua đơn nghỉ
// phép (BR-40)
const TYPES: WorkScheduleType[] = ['business_trip', 'day_off'];
const TYPE_LABELS: Record<WorkScheduleType, string> = { business_trip: 'công tác', day_off: 'nghỉ' };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

@Injectable()
export class WorkSchedulesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private async assertManager(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.workScheduleManage, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập lịch công tác của đơn vị này');
    }
  }

  async list(currentUser: CurrentUser, orgUnitId: string, month: string) {
    const canView =
      (await this.inScope(currentUser, PERMISSION_CODES.workScheduleManage, orgUnitId)) ||
      (await this.inScope(currentUser, PERMISSION_CODES.staffAttendanceView, orgUnitId));
    if (!canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem lịch công tác của đơn vị này');
    }
    const { database } = await this.currentSchoolYear.require();
    const { from, to } = monthRange(month);
    return database
      .selectFrom('work_schedules')
      .innerJoin('staff', 'staff.id', 'work_schedules.staff_id')
      .select([
        'work_schedules.id',
        'work_schedules.staff_id',
        'staff.full_name',
        'work_schedules.schedule_date',
        'work_schedules.schedule_type',
        'work_schedules.note',
        'work_schedules.status',
        'work_schedules.published_at',
      ])
      .where('work_schedules.org_unit_id', '=', orgUnitId)
      .where('work_schedules.schedule_date', '>=', from)
      .where('work_schedules.schedule_date', '<=', to)
      .orderBy('work_schedules.schedule_date')
      .orderBy('staff.full_name')
      .execute();
  }

  async mine(currentUser: CurrentUser, month: string) {
    const { database } = await this.currentSchoolYear.require();
    const { from, to } = monthRange(month);
    return database
      .selectFrom('work_schedules')
      .innerJoin('staff', 'staff.id', 'work_schedules.staff_id')
      .select([
        'work_schedules.id',
        'work_schedules.schedule_date',
        'work_schedules.schedule_type',
        'work_schedules.note',
      ])
      .where('staff.user_id', '=', currentUser.id)
      .where('work_schedules.status', '=', 'published')
      .where('work_schedules.schedule_date', '>=', from)
      .where('work_schedules.schedule_date', '<=', to)
      .orderBy('work_schedules.schedule_date')
      .execute();
  }

  // Lập lịch nháp: nhân sự đang làm việc trong đơn vị, ngày trong thời gian làm việc, kỳ công của tháng chưa chốt
  async create(
    currentUser: CurrentUser,
    input: { staffId: string; scheduleDate: string; scheduleType: WorkScheduleType; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'start_date', 'end_date', 'status'])
      .where('id', '=', input.staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    await this.assertManager(currentUser, staff.org_unit_id);
    if (
      input.scheduleDate < staff.start_date ||
      (staff.end_date !== null && input.scheduleDate > staff.end_date) ||
      staff.status === 'terminated'
    ) {
      throw validationError([{ field: 'schedule_date', message: 'Ngày nằm ngoài thời gian làm việc của nhân sự' }]);
    }
    await assertMonthsOpen(database, staff.org_unit_id, input.scheduleDate, input.scheduleDate);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('work_schedules')
          .values({
            staff_id: staff.id,
            org_unit_id: staff.org_unit_id,
            schedule_date: input.scheduleDate,
            schedule_type: input.scheduleType,
            note: input.note,
            created_by: origin.actorUserId,
          })
          .returning(['id', 'staff_id', 'schedule_date', 'schedule_type', 'note', 'status'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: staff.org_unit_id,
          entityName: 'work_schedules',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return { ...created, full_name: staff.full_name };
      }),
      'Nhân sự đã có lịch trong ngày này',
      'schedule_date',
    );
  }

  // Công bố mọi lịch nháp của đơn vị trong tháng; mỗi nhân sự có tài khoản nhận một thông báo
  async publish(currentUser: CurrentUser, orgUnitId: string, month: string, origin: ChangeOrigin) {
    await this.assertManager(currentUser, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const { from, to } = monthRange(month);
    return database.transaction().execute(async (transaction) => {
      const published = await transaction
        .updateTable('work_schedules')
        .set({ status: 'published', published_at: this.clock.now(), published_by: origin.actorUserId })
        .where('org_unit_id', '=', orgUnitId)
        .where('status', '=', 'draft')
        .where('schedule_date', '>=', from)
        .where('schedule_date', '<=', to)
        .returning(['id', 'staff_id', 'schedule_date', 'schedule_type'])
        .execute();
      if (published.length === 0) {
        throw ruleViolationError('P08-02', 'Tháng này không có lịch nháp để công bố');
      }
      const staff = await transaction
        .selectFrom('staff')
        .select(['id', 'user_id'])
        .where(
          'id',
          'in',
          published.map((row) => row.staff_id),
        )
        .execute();
      for (const person of staff) {
        if (!person.user_id) {
          continue;
        }
        const own = published.filter((row) => row.staff_id === person.id);
        await queueNotification(transaction, {
          orgUnitId,
          templateCode: 'work_schedule_published',
          title: 'Lịch công tác',
          body: own.map((row) => `${row.schedule_date}: ${TYPE_LABELS[row.schedule_type]}`).join('; '),
          targetType: 'work_schedules',
          targetId: own[0]?.id ?? '',
          recipients: [{ userId: person.user_id, channel: 'in_app' }],
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'work_schedules',
        entityId: orgUnitId,
        action: 'update',
        before: { status: 'draft', month },
        after: { status: 'published', month, count: published.length },
      });
      return { published_count: published.length };
    });
  }

  // Xóa lịch khi kỳ công còn mở; lịch đã công bố bị xóa thì nhân sự nhận thông báo
  async remove(currentUser: CurrentUser, scheduleId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const schedule = await database
      .selectFrom('work_schedules')
      .innerJoin('staff', 'staff.id', 'work_schedules.staff_id')
      .select([
        'work_schedules.id',
        'work_schedules.org_unit_id',
        'work_schedules.schedule_date',
        'work_schedules.schedule_type',
        'work_schedules.status',
        'staff.user_id',
      ])
      .where('work_schedules.id', '=', scheduleId)
      .executeTakeFirst();
    if (!schedule) {
      throw notFoundError('Không tìm thấy lịch', 'work_schedule');
    }
    await this.assertManager(currentUser, schedule.org_unit_id);
    await assertMonthsOpen(database, schedule.org_unit_id, schedule.schedule_date, schedule.schedule_date);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('work_schedules').where('id', '=', scheduleId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: schedule.org_unit_id,
        entityName: 'work_schedules',
        entityId: scheduleId,
        action: 'delete',
        before: schedule,
        after: null,
      });
      if (schedule.status === 'published' && schedule.user_id) {
        await queueNotification(transaction, {
          orgUnitId: schedule.org_unit_id,
          templateCode: 'work_schedule_removed',
          title: 'Lịch công tác thay đổi',
          body: `Đã hủy lịch ${TYPE_LABELS[schedule.schedule_type]} ngày ${schedule.schedule_date}`,
          targetType: 'work_schedules',
          targetId: scheduleId,
          recipients: [{ userId: schedule.user_id, channel: 'in_app' }],
        });
      }
    });
  }
}

function readMonth(value: unknown): string {
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value)) {
    throw validationError([{ field: 'month', message: 'Tháng dạng YYYY-MM' }]);
  }
  return value;
}

function readUnit(value: unknown): string {
  if (!isUuid(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
  }
  return value;
}

@Controller()
export class WorkSchedulesController {
  constructor(private readonly schedules: WorkSchedulesService) {}

  @Get('work-schedules')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.list(currentUser, readUnit(query.org_unit_id), readMonth(query.month));
  }

  @Get('me/work-schedules')
  mine(@Query('month') month: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.mine(currentUser, readMonth(month ?? VIETNAM_DATE.format(new Date()).slice(0, 7)));
  }

  @Post('work-schedules')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffId = readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự');
    const scheduleDate = body?.schedule_date;
    if (
      typeof scheduleDate !== 'string' ||
      !DATE_PATTERN.test(scheduleDate) ||
      Number.isNaN(Date.parse(scheduleDate))
    ) {
      errors.push({ field: 'schedule_date', message: 'Ngày dạng YYYY-MM-DD' });
    }
    const scheduleType = body?.schedule_type as WorkScheduleType;
    if (!TYPES.includes(scheduleType)) {
      errors.push({ field: 'schedule_type', message: 'Loại lịch là business_trip hoặc day_off' });
    }
    const note = readOptionalText(body, 'note', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.schedules.create(
      currentUser,
      { staffId, scheduleDate: scheduleDate as string, scheduleType, note: note ?? null },
      originOf(request, currentUser),
    );
  }

  @Post('work-schedules/publish')
  @HttpCode(200)
  publish(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.publish(
      currentUser,
      readUnit(body?.org_unit_id),
      readMonth(body?.month),
      originOf(request, currentUser),
    );
  }

  @Delete('work-schedules/:id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParameter('Mã lịch không hợp lệ')) scheduleId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.schedules.remove(currentUser, scheduleId, originOf(request, currentUser));
  }
}
