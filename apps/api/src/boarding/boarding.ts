import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, readOptionalText, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import { BOARDING_RULE_CODE, classRoster, registeredChildren } from './boarding-roster.js';

// Bán trú lớp ngoài Mầm non (DT-20 phần 20b, YCTD-159; tài liệu 32 mục 11.4). Lớp Mầm non giữ điểm danh theo ngày và báo cơm.
// Giáo viên chủ nhiệm của lớp hoặc người có quyền P04.boarding.manage ở đơn vị của lớp xem danh sách ăn, cắt suất hộ, chốt và
// mở lại suất của ngày; phụ huynh báo hoặc hủy cắt suất của con cho ngày học từ hôm nay, hôm nay thì trước giờ bắt đầu học
// (giờ chốt cắt suất dùng chung "Giờ bắt đầu học" của đơn vị, mặc định 07:30). Ngày đã chốt thì không cắt suất được, mở lại
// để sửa. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

interface ClassContext {
  id: string;
  name: string;
  org_unit_id: string;
  school_level: string;
  status: string;
}

@Injectable()
export class BoardingService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async findClass(database: Kysely<SchoolYearDatabase>, classId: string): Promise<ClassContext> {
    const row = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'school_level', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    if (row.school_level === 'MN') {
      throw ruleViolationError(
        BOARDING_RULE_CODE,
        'Lớp Mầm non dùng điểm danh và báo cơm; bán trú theo danh sách dành cho cấp khác',
      );
    }
    return row;
  }

  // Giáo viên chủ nhiệm của lớp ('teacher'), hoặc người có quyền bán trú ở đơn vị của lớp ('school')
  private async assertStaff(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    classRow: ClassContext,
  ): Promise<'teacher' | 'school'> {
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classRow.id)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (homeroom) {
      return 'teacher';
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.boardingManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách bán trú của lớp này');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.boardingManage, classRow.org_unit_id);
    return 'school';
  }

  private async day(database: Kysely<SchoolYearDatabase>, classId: string, date: string) {
    return database
      .selectFrom('boarding_meal_days')
      .select(['status', 'headcount', 'closed_by_name', 'closed_at'])
      .where('class_id', '=', classId)
      .where('meal_date', '=', date)
      .executeTakeFirst();
  }

  // Danh sách ăn của lớp trong ngày
  async roster(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertStaff(database, currentUser, classRow);
    const [children, day] = await Promise.all([
      classRoster(database, classId, date),
      this.day(database, classId, date),
    ]);
    const eating = children.filter((child) => child.cut === null).length;
    return {
      class_id: classId,
      class_name: classRow.name,
      school_level: classRow.school_level,
      date,
      registered_count: children.length,
      headcount: day?.status === 'closed' ? day.headcount : eating,
      closed: day?.status === 'closed',
      closed_by_name: day?.status === 'closed' ? day.closed_by_name : null,
      closed_at: day?.status === 'closed' ? day.closed_at : null,
      children,
    };
  }

  private async assertOpen(database: Kysely<SchoolYearDatabase>, classId: string, date: string): Promise<void> {
    if ((await this.day(database, classId, date))?.status === 'closed') {
      throw ruleViolationError(BOARDING_RULE_CODE, 'Suất ăn của lớp trong ngày đã chốt; mở lại để sửa');
    }
  }

  private async assertRegistered(
    database: Kysely<SchoolYearDatabase>,
    classId: string,
    childId: string,
    date: string,
  ): Promise<void> {
    const registered = await registeredChildren(database, [classId], date);
    if (!registered.some((row) => row.child_id === childId)) {
      throw ruleViolationError(
        BOARDING_RULE_CODE,
        'Học sinh không đăng ký bán trú của tháng này hoặc không học lớp này',
      );
    }
  }

  private async writeCut(
    database: Kysely<SchoolYearDatabase>,
    input: { classRow: ClassContext; childId: string; date: string; cut: boolean; reason: string | null },
    source: 'parent' | 'teacher' | 'school',
    currentUser: CurrentUser,
    origin: ChangeOrigin,
  ): Promise<void> {
    await database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('boarding_meal_cuts')
        .selectAll()
        .where('child_id', '=', input.childId)
        .where('meal_date', '=', input.date)
        .executeTakeFirst();
      if (input.cut) {
        await transaction
          .insertInto('boarding_meal_cuts')
          .values({
            child_id: input.childId,
            class_id: input.classRow.id,
            meal_date: input.date,
            reason: input.reason,
            source,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .onConflict((conflict) =>
            conflict.columns(['child_id', 'meal_date']).doUpdateSet({ reason: input.reason, source }),
          )
          .execute();
      } else {
        await transaction
          .deleteFrom('boarding_meal_cuts')
          .where('child_id', '=', input.childId)
          .where('meal_date', '=', input.date)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.classRow.org_unit_id,
        entityName: 'boarding_meal_cuts',
        entityId: input.childId,
        action: input.cut ? 'create' : 'delete',
        before: before ?? null,
        after: input.cut ? { meal_date: input.date, reason: input.reason, source } : null,
      });
    });
  }

  // Cắt suất hoặc bỏ cắt suất hộ học sinh (giáo viên, nhà trường), trước khi chốt
  async setCut(
    currentUser: CurrentUser,
    classId: string,
    input: { childId: string; date: string; cut: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const source = await this.assertStaff(database, currentUser, classRow);
    await this.calendar.assertSchoolDay(input.date);
    await this.assertOpen(database, classId, input.date);
    await this.assertRegistered(database, classId, input.childId, input.date);
    await this.writeCut(database, { classRow, ...input }, source, currentUser, origin);
    return this.roster(currentUser, classId, input.date);
  }

  // Chốt suất của lớp trong ngày: lưu số suất lúc chốt cho bếp và tiền ăn
  async close(currentUser: CurrentUser, classId: string, date: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertStaff(database, currentUser, classRow);
    if (date > this.today()) {
      throw ruleViolationError(BOARDING_RULE_CODE, 'Chỉ chốt suất cho hôm nay hoặc ngày đã qua');
    }
    await this.calendar.assertSchoolDay(date);
    const children = await classRoster(database, classId, date);
    const headcount = children.filter((child) => child.cut === null).length;
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('boarding_meal_days')
        .values({
          class_id: classId,
          meal_date: date,
          status: 'closed',
          headcount,
          closed_by: currentUser.id,
          closed_by_name: currentUser.description.full_name,
          closed_at: now,
        })
        .onConflict((conflict) =>
          conflict.columns(['class_id', 'meal_date']).doUpdateSet({
            status: 'closed',
            headcount,
            closed_by: currentUser.id,
            closed_by_name: currentUser.description.full_name,
            closed_at: now,
            updated_at: now,
          }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'boarding_meal_days',
        entityId: classId,
        action: 'update',
        before: null,
        after: { meal_date: date, status: 'closed', headcount },
      });
    });
    return this.roster(currentUser, classId, date);
  }

  // Mở lại suất đã chốt để sửa cắt suất; tiền ăn đã tính không tự đổi
  async reopen(currentUser: CurrentUser, classId: string, date: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertStaff(database, currentUser, classRow);
    const day = await this.day(database, classId, date);
    if (day?.status !== 'closed') {
      throw ruleViolationError(BOARDING_RULE_CODE, 'Suất ăn của lớp trong ngày chưa chốt');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('boarding_meal_days')
        .set({ status: 'reopened', updated_at: this.clock.now() })
        .where('class_id', '=', classId)
        .where('meal_date', '=', date)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'boarding_meal_days',
        entityId: classId,
        action: 'update',
        before: { meal_date: date, status: 'closed', headcount: day.headcount },
        after: { meal_date: date, status: 'reopened', reason },
      });
    });
    return this.roster(currentUser, classId, date);
  }

  // Lớp hiện tại và quan hệ phụ huynh của học sinh
  private async parentChild(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, childId: string) {
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phải phụ huynh của học sinh này');
    }
    const enrollment = await database
      .selectFrom('class_enrollments')
      .select('class_id')
      .where('child_id', '=', childId)
      .where('is_current', '=', true)
      .executeTakeFirst();
    if (!enrollment) {
      throw ruleViolationError(BOARDING_RULE_CODE, 'Học sinh chưa xếp lớp');
    }
    return this.findClass(database, enrollment.class_id);
  }

  // Phụ huynh báo hoặc hủy cắt suất của con
  async parentCut(
    currentUser: CurrentUser,
    input: { childId: string; date: string; cut: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.parentChild(database, currentUser, input.childId);
    const today = this.today();
    if (input.date < today) {
      throw ruleViolationError(BOARDING_RULE_CODE, 'Chỉ báo cắt suất từ hôm nay trở đi');
    }
    if (input.date === today) {
      const setting = (await this.settings.effective(classRow.org_unit_id)).find(
        (item) => item.key === 'school_start_time',
      );
      const cutOff = typeof setting?.value === 'string' ? setting.value : '07:30';
      if (this.clock.now() >= new Date(`${today}T${cutOff}:00+07:00`)) {
        throw ruleViolationError(
          BOARDING_RULE_CODE,
          `Đã qua giờ chốt cắt suất hôm nay (${cutOff}); liên hệ giáo viên chủ nhiệm`,
        );
      }
    }
    await this.calendar.assertSchoolDay(input.date);
    await this.assertOpen(database, classRow.id, input.date);
    await this.assertRegistered(database, classRow.id, input.childId, input.date);
    await this.writeCut(database, { classRow, ...input }, 'parent', currentUser, origin);
    return this.parentCuts(currentUser, input.childId, input.date.slice(0, 7));
  }

  // Ngày cắt suất của con trong tháng
  async parentCuts(currentUser: CurrentUser, childId: string, month: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.parentChild(database, currentUser, childId);
    const rows = await database
      .selectFrom('boarding_meal_cuts')
      .select(['meal_date', 'reason', 'source'])
      .where('child_id', '=', childId)
      .where('meal_date', '>=', `${month}-01`)
      .where('meal_date', '<=', `${month}-31`)
      .orderBy('meal_date')
      .execute();
    const registered = await registeredChildren(database, [classRow.id], `${month}-28`);
    return {
      child_id: childId,
      month,
      registered: registered.some((row) => row.child_id === childId),
      cuts: rows,
    };
  }
}

@Controller()
export class BoardingController {
  constructor(private readonly boarding: BoardingService) {}

  @Get('boarding/classes/:id/roster')
  roster(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('date') date: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const day = readDate(date, 'date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.boarding.roster(currentUser, classId, day);
  }

  @Post('boarding/classes/:id/cuts')
  @HttpCode(200)
  setCut(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn học sinh');
    const date = readDate(body?.date, 'date', errors);
    if (typeof body?.cut !== 'boolean') {
      errors.push({ field: 'cut', message: 'Phải là đúng hoặc sai' });
    }
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.boarding.setCut(
      currentUser,
      classId,
      { childId, date, cut: body?.cut === true, reason },
      originOf(request, currentUser),
    );
  }

  @Post('boarding/classes/:id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const date = readDate(body?.date, 'date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.boarding.close(currentUser, classId, date, originOf(request, currentUser));
  }

  @Post('boarding/classes/:id/reopen')
  @HttpCode(200)
  reopen(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const date = readDate(body?.date, 'date', errors);
    const reason = readOptionalText(body, 'reason', errors);
    if (!reason) {
      errors.push({ field: 'reason', message: 'Bắt buộc ghi lý do mở lại' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.boarding.reopen(currentUser, classId, date, reason ?? '', originOf(request, currentUser));
  }

  // Phụ huynh: ngày cắt suất của con trong tháng; báo, hủy cắt suất
  @Get('boarding/children/:id/cuts')
  parentCuts(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Query('month') month: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw validationError([{ field: 'month', message: 'Tháng theo dạng YYYY-MM' }]);
    }
    return this.boarding.parentCuts(currentUser, childId, month);
  }

  @Post('boarding/children/:id/cuts')
  @HttpCode(200)
  parentCut(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const date = readDate(body?.date, 'date', errors);
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.boarding.parentCut(currentUser, { childId, date, cut: true, reason }, originOf(request, currentUser));
  }

  @Delete('boarding/children/:id/cuts/:date')
  parentUncut(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Param('date') date: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const day = readDate(date, 'date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.boarding.parentCut(
      currentUser,
      { childId, date: day, cut: false, reason: null },
      originOf(request, currentUser),
    );
  }
}
