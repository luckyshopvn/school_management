import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { SchoolDayChangeType } from '@school-management/database';
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
import { dayOfWeek, VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { conflictOnDuplicate, notFoundError, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Ngày nghỉ lễ (P08-09) và ngày học bù, nghỉ bù (P08-10) chung toàn trường (BR-84, YCTD-59). Thứ bảy mặc định nghỉ;
// học bù chỉ chọn ngày thứ bảy trong học kỳ, nghỉ bù chỉ chọn ngày thứ hai đến thứ sáu. Chỉ lập, sửa, xóa ngày từ
// ngày mai trở đi để không đổi ngày đã điểm danh, chấm công
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_TEXT = 200;
const SCHOOL_DAY_CHANGE_TYPES: readonly SchoolDayChangeType[] = ['makeup_school_day', 'compensatory_day_off'];

function readDate(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = body?.[field];
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function readName(body: RequestBody, errors: FieldError[]): string {
  const name = readRequiredText(body, 'name', errors);
  if (name.length > MAXIMUM_TEXT) {
    errors.push({ field: 'name', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
  }
  return name;
}

function readPaid(body: RequestBody, errors: FieldError[]): boolean {
  if (typeof body?.is_paid !== 'boolean') {
    errors.push({ field: 'is_paid', message: 'Bắt buộc chọn có hưởng lương hay không' });
    return false;
  }
  return body.is_paid;
}

@Injectable()
export class SchoolDaysService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // Mọi người đã đăng nhập xem được lịch của một năm dương lịch
  async list(year: number) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { holidays: [], changes: [] };
    }
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const holidays = await current.database
      .selectFrom('holidays')
      .select(['id', 'holiday_date', 'name', 'is_paid'])
      .where('holiday_date', '>=', from)
      .where('holiday_date', '<=', to)
      .orderBy('holiday_date')
      .execute();
    const changes = await current.database
      .selectFrom('school_day_changes')
      .select(['id', 'change_date', 'change_type', 'note'])
      .where('change_date', '>=', from)
      .where('change_date', '<=', to)
      .orderBy('change_date')
      .execute();
    return { holidays, changes };
  }

  async createHoliday(
    currentUser: CurrentUser,
    input: { date: string; name: string; isPaid: boolean },
    origin: ChangeOrigin,
  ) {
    await this.assertHolidayManager(currentUser);
    this.assertFuture(input.date, 'holiday_date');
    const { database } = await this.currentSchoolYear.require();
    const change = await database
      .selectFrom('school_day_changes')
      .select('change_type')
      .where('change_date', '=', input.date)
      .executeTakeFirst();
    if (change) {
      throw ruleViolationError('BR-84', 'Ngày này đã có lịch học bù hoặc nghỉ bù, xóa lịch đó trước', [
        { field: 'holiday_date', message: change.change_type },
      ]);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('holidays')
          .values({
            holiday_date: input.date,
            name: input.name,
            is_paid: input.isPaid,
            created_by: origin.actorUserId,
          })
          .returning(['id', 'holiday_date', 'name', 'is_paid'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'holidays',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Ngày này đã có trong lịch nghỉ lễ',
      'holiday_date',
    );
  }

  async updateHoliday(
    currentUser: CurrentUser,
    holidayId: string,
    input: { name: string; isPaid: boolean },
    origin: ChangeOrigin,
  ) {
    await this.assertHolidayManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.loadHoliday(holidayId);
    this.assertFuture(existing.holiday_date, 'holiday_date');
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('holidays')
        .set({ name: input.name, is_paid: input.isPaid, updated_at: this.clock.now() })
        .where('id', '=', holidayId)
        .returning(['id', 'holiday_date', 'name', 'is_paid'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'holidays',
        entityId: holidayId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async deleteHoliday(currentUser: CurrentUser, holidayId: string, origin: ChangeOrigin): Promise<void> {
    await this.assertHolidayManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.loadHoliday(holidayId);
    this.assertFuture(existing.holiday_date, 'holiday_date');
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('holidays').where('id', '=', holidayId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'holidays',
        entityId: holidayId,
        action: 'delete',
        before: existing,
        after: null,
      });
    });
  }

  async createChange(
    currentUser: CurrentUser,
    input: { date: string; changeType: SchoolDayChangeType; note: string | null },
    origin: ChangeOrigin,
  ) {
    this.assertChangeManager(currentUser);
    this.assertFuture(input.date, 'change_date');
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const weekday = dayOfWeek(input.date);
    if (input.changeType === 'makeup_school_day') {
      if (weekday !== 6) {
        throw validationError([{ field: 'change_date', message: 'Ngày học bù phải là ngày thứ bảy' }]);
      }
      const term = await this.databases.system
        .selectFrom('academic_terms')
        .select('id')
        .where('academic_year_id', '=', academicYearId)
        .where('start_date', '<=', input.date)
        .where('end_date', '>=', input.date)
        .executeTakeFirst();
      if (!term) {
        throw ruleViolationError('BR-84', 'Ngày học bù phải thuộc một học kỳ của năm học đang mở');
      }
    } else if (weekday > 5) {
      throw validationError([{ field: 'change_date', message: 'Ngày nghỉ bù phải là ngày thứ hai đến thứ sáu' }]);
    }
    const holiday = await database
      .selectFrom('holidays')
      .select('name')
      .where('holiday_date', '=', input.date)
      .executeTakeFirst();
    if (holiday) {
      throw ruleViolationError('BR-84', `Ngày này là ngày nghỉ lễ: ${holiday.name}`);
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('school_day_changes')
          .values({
            change_date: input.date,
            change_type: input.changeType,
            note: input.note,
            created_by: origin.actorUserId,
          })
          .returning(['id', 'change_date', 'change_type', 'note'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'school_day_changes',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Ngày này đã có lịch học bù hoặc nghỉ bù',
      'change_date',
    );
  }

  async deleteChange(currentUser: CurrentUser, changeId: string, origin: ChangeOrigin): Promise<void> {
    this.assertChangeManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('school_day_changes')
      .select(['id', 'change_date', 'change_type', 'note'])
      .where('id', '=', changeId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy lịch học bù hoặc nghỉ bù', 'school_day_change');
    }
    this.assertFuture(existing.change_date, 'change_date');
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('school_day_changes').where('id', '=', changeId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'school_day_changes',
        entityId: changeId,
        action: 'delete',
        before: existing,
        after: null,
      });
    });
  }

  private async loadHoliday(holidayId: string) {
    const { database } = await this.currentSchoolYear.require();
    const holiday = await database
      .selectFrom('holidays')
      .select(['id', 'holiday_date', 'name', 'is_paid'])
      .where('id', '=', holidayId)
      .executeTakeFirst();
    if (!holiday) {
      throw notFoundError('Không tìm thấy ngày nghỉ lễ', 'holiday');
    }
    return holiday;
  }

  private assertFuture(date: string, field: string): void {
    if (date <= VIETNAM_DATE.format(this.clock.now())) {
      throw ruleViolationError('BR-84', 'Chỉ lập, sửa hoặc xóa lịch cho ngày từ ngày mai trở đi', [
        { field, message: date },
      ]);
    }
  }

  // Lịch nghỉ lễ chung toàn trường nên phòng nhân sự phải được gán ở Trường chính (YCTD-59)
  private async assertHolidayManager(currentUser: CurrentUser): Promise<void> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.holidayManage);
    if (!scope.wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phòng nhân sự gán ở Trường chính được lập lịch nghỉ lễ');
    }
  }

  private assertChangeManager(currentUser: CurrentUser): void {
    if (!currentUser.hasPermission(PERMISSION_CODES.schoolDayChangeManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu được lập lịch học bù và nghỉ bù');
    }
  }
}

@Controller()
export class SchoolDaysController {
  constructor(private readonly schoolDays: SchoolDaysService) {}

  @Get('school-days')
  list(@Query('year') year?: string) {
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
      throw validationError([{ field: 'year', message: 'Năm không hợp lệ' }]);
    }
    return this.schoolDays.list(parsed);
  }

  @Post('holidays')
  @HttpCode(201)
  createHoliday(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      date: readDate(body, 'holiday_date', errors),
      name: readName(body, errors),
      isPaid: readPaid(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.schoolDays.createHoliday(currentUser, input, originOf(request, currentUser));
  }

  @Put('holidays/:id')
  updateHoliday(
    @Param('id', uuidParameter('Mã ngày nghỉ lễ không hợp lệ')) holidayId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = { name: readName(body, errors), isPaid: readPaid(body, errors) };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.schoolDays.updateHoliday(currentUser, holidayId, input, originOf(request, currentUser));
  }

  @Delete('holidays/:id')
  @HttpCode(204)
  async deleteHoliday(
    @Param('id', uuidParameter('Mã ngày nghỉ lễ không hợp lệ')) holidayId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ): Promise<void> {
    await this.schoolDays.deleteHoliday(currentUser, holidayId, originOf(request, currentUser));
  }

  @Post('school-day-changes')
  @HttpCode(201)
  createChange(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const date = readDate(body, 'change_date', errors);
    const changeType = readEnum(body, 'change_type', SCHOOL_DAY_CHANGE_TYPES, errors, true);
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null;
    if (note && note.length > MAXIMUM_TEXT) {
      errors.push({ field: 'note', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    if (errors.length > 0 || !changeType) {
      throw validationError(errors);
    }
    return this.schoolDays.createChange(currentUser, { date, changeType, note }, originOf(request, currentUser));
  }

  @Delete('school-day-changes/:id')
  @HttpCode(204)
  async deleteChange(
    @Param('id', uuidParameter('Mã lịch học bù hoặc nghỉ bù không hợp lệ')) changeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ): Promise<void> {
    await this.schoolDays.deleteChange(currentUser, changeId, originOf(request, currentUser));
  }
}
