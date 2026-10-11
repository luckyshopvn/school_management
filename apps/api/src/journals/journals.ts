import { Body, Controller, Get, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { JournalMood, SchoolYearDatabase } from '@school-management/database';
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
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds, isGuardianOf } from '../finance/receivables.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { monthRange } from '../staff-attendance/staff-attendance.service.js';

// Nhật ký của bé (P04-04, P04-05; BR-15, BR-16; QT-09; YCTD-65). Giáo viên chủ nhiệm của lớp ghi nháp cho từng trẻ trong
// ngày rồi công bố cả lớp; phụ huynh chỉ xem nhật ký đã công bố của con mình; sửa nhật ký đã công bố phải có lý do.
// Quản lý đơn vị có quyền điểm danh xem được nhật ký của lớp trong phạm vi, không ghi
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MOODS: readonly JournalMood[] = ['happy', 'normal', 'tired', 'sad', 'unwell'];
const NOTE_FIELDS = ['meal_note', 'sleep_note', 'hygiene_note', 'activity_note'] as const;
const MAXIMUM_NOTE = 1000;

export interface JournalInput {
  meal_note: string | null;
  sleep_note: string | null;
  hygiene_note: string | null;
  mood: JournalMood | null;
  activity_note: string | null;
}

const JOURNAL_COLUMNS = [
  'id',
  'child_id',
  'class_id',
  'journal_date',
  'meal_note',
  'sleep_note',
  'hygiene_note',
  'mood',
  'activity_note',
  'status',
  'published_at',
] as const;

@Injectable()
export class JournalsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // Nhật ký của lớp trong ngày: mỗi trẻ đang học kèm nhật ký nếu đã ghi
  async classDay(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.loadClass(database, classId);
    const role = await this.role(currentUser, database, classRecord);
    if (!role) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    const children = await this.classChildren(database, classId);
    const journals = children.length
      ? await database
          .selectFrom('daily_journals')
          .select(JOURNAL_COLUMNS)
          .where('journal_date', '=', date)
          .where(
            'child_id',
            'in',
            children.map((child) => child.id),
          )
          .execute()
      : [];
    return {
      class_id: classId,
      class_name: classRecord.name,
      date,
      can_write: role === 'teacher',
      children: children.map((child) => ({
        child_id: child.id,
        full_name: child.full_name,
        journal: journals.find((journal) => journal.child_id === child.id) ?? null,
      })),
    };
  }

  async save(
    currentUser: CurrentUser,
    childId: string,
    date: string,
    input: JournalInput,
    reason: string | null,
    origin: ChangeOrigin,
  ) {
    if (date > VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'date', message: 'Không ghi nhật ký trước cho ngày chưa tới' }]);
    }
    if (NOTE_FIELDS.every((field) => !input[field]) && !input.mood) {
      throw validationError([{ field: 'meal_note', message: 'Cần ghi ít nhất một nội dung nhật ký' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    const enrollment = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select([
        'classes.id',
        'classes.name',
        'classes.org_unit_id',
        'classes.status',
        'children.status as child_status',
      ])
      .where('class_enrollments.child_id', '=', childId)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    if (!enrollment) {
      throw notFoundError('Trẻ chưa thuộc lớp nào', 'child');
    }
    const role = await this.role(currentUser, database, enrollment);
    if (role !== 'teacher') {
      throw new ApplicationError('ERR_FORBIDDEN', 'Trẻ không thuộc lớp bạn chủ nhiệm');
    }
    const existing = await database
      .selectFrom('daily_journals')
      .select(JOURNAL_COLUMNS)
      .where('child_id', '=', childId)
      .where('journal_date', '=', date)
      .executeTakeFirst();
    if (existing?.status === 'published' && !reason) {
      throw ruleViolationError('BR-15', 'Nhật ký đã công bố, sửa phải ghi lý do', [
        { field: 'reason', message: 'Bắt buộc nhập lý do sửa' },
      ]);
    }
    const journalId = await database.transaction().execute(async (transaction) => {
      const row = existing
        ? await transaction
            .updateTable('daily_journals')
            .set({ ...input, updated_by: origin.actorUserId, updated_at: this.clock.now() })
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('daily_journals')
            .values({
              ...input,
              child_id: childId,
              class_id: enrollment.id,
              journal_date: date,
              updated_by: origin.actorUserId,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
      if (existing?.status === 'published' && reason) {
        await transaction
          .insertInto('journal_amendments')
          .values({
            journal_id: existing.id,
            reason,
            before_data: JSON.stringify(existing),
            after_data: JSON.stringify(input),
            amended_by: origin.actorUserId,
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: enrollment.org_unit_id,
        entityName: 'daily_journals',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: { ...input, reason },
      });
      return row.id;
    });
    return database
      .selectFrom('daily_journals')
      .select(JOURNAL_COLUMNS)
      .where('id', '=', journalId)
      .executeTakeFirstOrThrow();
  }

  // Công bố nhật ký nháp của lớp trong ngày; còn trẻ chưa có nội dung thì cảnh báo, phải xác nhận mới công bố (QT-09 E4)
  async publish(currentUser: CurrentUser, classId: string, date: string, confirm: boolean, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.loadClass(database, classId);
    if ((await this.role(currentUser, database, classRecord)) !== 'teacher') {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm công bố nhật ký của lớp');
    }
    const children = await this.classChildren(database, classId);
    const journals = children.length
      ? await database
          .selectFrom('daily_journals')
          .select(['id', 'child_id', 'status'])
          .where('journal_date', '=', date)
          .where(
            'child_id',
            'in',
            children.map((child) => child.id),
          )
          .execute()
      : [];
    const drafts = journals.filter((journal) => journal.status === 'draft');
    if (drafts.length === 0) {
      throw ruleViolationError('BR-15', 'Không có nhật ký nháp nào để công bố');
    }
    const missing = children.filter((child) => !journals.some((journal) => journal.child_id === child.id));
    if (missing.length > 0 && !confirm) {
      throw ruleViolationError(
        'BR-15',
        'Còn trẻ chưa có nội dung nhật ký, xác nhận để vẫn công bố',
        missing.map((child) => ({ field: 'children', message: child.full_name })),
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('daily_journals')
        .set({ status: 'published', published_at: this.clock.now(), published_by: origin.actorUserId })
        .where(
          'id',
          'in',
          drafts.map((journal) => journal.id),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRecord.org_unit_id,
        entityName: 'daily_journals',
        entityId: classId,
        action: 'update',
        before: null,
        after: { date, published: drafts.length, missing: missing.length },
      });
      for (const draft of drafts) {
        const child = children.find((item) => item.id === draft.child_id);
        const userIds = await guardianUserIds(transaction, draft.child_id);
        await queueNotification(transaction, {
          orgUnitId: classRecord.org_unit_id,
          templateCode: 'journal_published',
          title: 'Nhật ký của bé',
          body: `Đã có nhật ký ngày ${date} của ${child?.full_name ?? 'bé'}`,
          targetType: 'daily_journals',
          targetId: draft.id,
          recipients: userIds.map((userId) => ({ userId, channel: 'in_app' as const })),
        });
      }
    });
    return this.classDay(currentUser, classId, date);
  }

  // Nhật ký của trẻ theo tháng: phụ huynh chỉ thấy bản đã công bố của con mình
  async childMonth(currentUser: CurrentUser, childId: string, month: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select(['id', 'full_name', 'org_unit_id'])
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    let publishedOnly = true;
    if (!(await isGuardianOf(database, childId, currentUser.id))) {
      const enrollment = await database
        .selectFrom('class_enrollments')
        .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
        .select(['classes.id', 'classes.name', 'classes.org_unit_id', 'classes.status'])
        .where('class_enrollments.child_id', '=', childId)
        .where('class_enrollments.is_current', '=', true)
        .executeTakeFirst();
      if (!enrollment || !(await this.role(currentUser, database, enrollment))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem nhật ký của trẻ này');
      }
      publishedOnly = false;
    }
    let query = database
      .selectFrom('daily_journals')
      .select(JOURNAL_COLUMNS)
      .where('child_id', '=', childId)
      .where('journal_date', '>=', monthRange(month).from)
      .where('journal_date', '<=', monthRange(month).to);
    if (publishedOnly) {
      query = query.where('status', '=', 'published');
    }
    return {
      child_id: child.id,
      full_name: child.full_name,
      journals: await query.orderBy('journal_date', 'desc').execute(),
    };
  }

  // Giáo viên chủ nhiệm đang phụ trách thì ghi; quản lý có quyền điểm danh trong phạm vi thì chỉ xem
  private async role(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    classRecord: { id: string; org_unit_id: string; status: string },
  ): Promise<'teacher' | 'manager' | null> {
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classRecord.id)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (homeroom && classRecord.status === 'active') {
      return 'teacher';
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.attendanceManage);
    if (scope.wholeSchool || scope.orgUnitIds.includes(classRecord.org_unit_id)) {
      return 'manager';
    }
    return null;
  }

  private async loadClass(database: Kysely<SchoolYearDatabase>, classId: string) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return classRecord;
  }

  private classChildren(database: Kysely<SchoolYearDatabase>, classId: string) {
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
  }
}

function readDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw validationError([{ field, message: 'Ngày theo dạng YYYY-MM-DD' }]);
  }
  return value;
}

function readJournal(body: RequestBody): { input: JournalInput; reason: string | null } {
  const errors: FieldError[] = [];
  const text = (field: string) => {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value !== 'string' || value.trim().length > MAXIMUM_NOTE) {
      errors.push({ field, message: `Tối đa ${MAXIMUM_NOTE} ký tự` });
      return null;
    }
    return value.trim() || null;
  };
  const mood = body?.mood;
  if (mood !== undefined && mood !== null && mood !== '' && !MOODS.includes(mood as JournalMood)) {
    errors.push({ field: 'mood', message: `Tâm trạng là một trong: ${MOODS.join(', ')}` });
  }
  const input = {
    meal_note: text('meal_note'),
    sleep_note: text('sleep_note'),
    hygiene_note: text('hygiene_note'),
    mood: MOODS.includes(mood as JournalMood) ? (mood as JournalMood) : null,
    activity_note: text('activity_note'),
  };
  const reason = text('reason');
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { input, reason };
}

@Controller()
export class JournalsController {
  constructor(private readonly journals: JournalsService) {}

  @Get('classes/:id/journals')
  classDay(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('date') date: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.journals.classDay(currentUser, classId, readDate(date, 'date'));
  }

  @Put('children/:id/journals/:date')
  save(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Param('date') date: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { input, reason } = readJournal(body);
    return this.journals.save(
      currentUser,
      childId,
      readDate(date, 'date'),
      input,
      reason,
      originOf(request, currentUser),
    );
  }

  @Post('classes/:id/journals/publish')
  publish(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.journals.publish(
      currentUser,
      classId,
      readDate(body?.date, 'date'),
      body?.confirm === true,
      originOf(request, currentUser),
    );
  }

  @Get('children/:id/journals')
  childMonth(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Query('month') month: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
      throw validationError([{ field: 'month', message: 'Tháng theo dạng YYYY-MM' }]);
    }
    return this.journals.childMonth(currentUser, childId, month);
  }
}
