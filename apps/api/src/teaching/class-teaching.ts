import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase, TeachingPlanPeriod, TeachingPlanStatus } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
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
  readOptionalUuid,
  readRequiredInteger,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { TeachingAccess, type TeachingClass } from './teaching-access.js';
import {
  addDays,
  check,
  isoWeekday,
  mondayOf,
  optionalQueryDate,
  overlaps,
  readDate,
  readName,
  readPeriod,
  readText,
  readTime,
} from './teaching-fields.js';

// Thời khóa biểu, lịch hoạt động lớp, kế hoạch giảng dạy (P03-04, P03-05, P03-07; BR-69; YCTD-80).
// Thời khóa biểu lưu theo phiên bản áp dụng từ thứ Hai của một tuần; trong lớp không trùng thứ và tiết, không trùng khung
// giờ trong cùng thứ; một giáo viên không dạy hai lớp cùng khung giờ. Phiên bản đã công bố không sửa được, lập phiên bản
// mới từ tuần sau. Phụ huynh chỉ đọc thời khóa biểu và lịch hoạt động đã công bố của lớp có con đang học (phạm vi theo lớp)
const TEACHING_PLAN_PERIODS: TeachingPlanPeriod[] = ['term', 'month', 'week'];
const TEACHING_PLAN_STATUSES: TeachingPlanStatus[] = ['planned', 'in_progress', 'completed'];
const DEFAULT_SCHEDULE_DAYS = 7;

interface SlotInput {
  weekday: number;
  period_no: number;
  start_time: string;
  end_time: string;
  activity_name: string;
  teacher_id: string | null;
}

interface ScheduleInput {
  activity_date?: string;
  start_time?: string;
  end_time?: string;
  activity_name?: string;
  note?: string | null;
}

const WEEKDAY_LABELS = ['', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy', 'Chủ nhật'];

@Injectable()
export class ClassTeachingService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: TeachingAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Người xem: nhân sự xem được lớp thấy cả bản nháp; phụ huynh có con trong lớp chỉ thấy bản đã công bố
  private async viewer(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, classId: string) {
    const found = await this.access.findClass(database, classId);
    if (await this.access.canViewClass(currentUser, database, found)) {
      return { found, publishedOnly: false };
    }
    if (await this.access.isGuardianInClass(database, currentUser, classId)) {
      return { found, publishedOnly: true };
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Lớp này nằm ngoài phạm vi của bạn');
  }

  async timetable(currentUser: CurrentUser, classId: string, week: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const { found, publishedOnly } = await this.viewer(currentUser, database, classId);
    return this.timetableOf(database, found, mondayOf(week ?? this.today()), publishedOnly);
  }

  async timetableOf(
    database: Kysely<SchoolYearDatabase>,
    found: TeachingClass,
    monday: string,
    publishedOnly: boolean,
  ) {
    let versionQuery = database
      .selectFrom('timetables')
      .select('effective_from')
      .where('class_id', '=', found.id)
      .where('effective_from', '<=', monday)
      .orderBy('effective_from', 'desc');
    if (publishedOnly) {
      versionQuery = versionQuery.where('status', '=', 'published');
    }
    const version = await versionQuery.executeTakeFirst();
    const slots = version
      ? await database
          .selectFrom('timetables')
          .select([
            'id',
            'weekday',
            'period_no',
            'start_time',
            'end_time',
            'activity_name',
            'teacher_id',
            'teacher_name',
            'status',
            'published_at',
          ])
          .where('class_id', '=', found.id)
          .where('effective_from', '=', version.effective_from)
          .orderBy('weekday')
          .orderBy('period_no')
          .execute()
      : [];
    const versions = publishedOnly
      ? []
      : await database
          .selectFrom('timetables')
          .select(['effective_from', 'status'])
          .select((expression) => expression.fn.countAll<number>().as('slot_count'))
          .where('class_id', '=', found.id)
          .groupBy(['effective_from', 'status'])
          .orderBy('effective_from', 'desc')
          .execute();
    return {
      class_id: found.id,
      class_name: found.name,
      week: monday,
      effective_from: version?.effective_from ?? null,
      status: slots[0]?.status ?? null,
      published_at: slots[0]?.published_at ?? null,
      slots,
      versions: versions.map((row) => ({ ...row, slot_count: Number(row.slot_count) })),
    };
  }

  // Lưu bản nháp của phiên bản áp dụng từ thứ Hai đã chọn; thay toàn bộ các tiết của bản nháp đó
  async saveTimetable(
    currentUser: CurrentUser,
    classId: string,
    effectiveFrom: string,
    slots: SlotInput[],
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.access.assertCanManageClass(
      currentUser,
      database,
      classId,
      PERMISSION_CODES.curriculumManage,
      { homeroomOnly: true },
    );
    if (isoWeekday(effectiveFrom) !== 1) {
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: 'effective_from', message: 'Ngày áp dụng là thứ Hai' },
      ]);
    }
    if (effectiveFrom < mondayOf(this.today())) {
      throw ruleViolationError('P03-04', 'Không lập thời khóa biểu cho tuần đã qua');
    }
    const published = await database
      .selectFrom('timetables')
      .select('id')
      .where('class_id', '=', classId)
      .where('effective_from', '=', effectiveFrom)
      .where('status', '=', 'published')
      .executeTakeFirst();
    if (published) {
      throw ruleViolationError('P03-04', 'Thời khóa biểu áp dụng từ tuần này đã công bố, lập phiên bản từ tuần khác');
    }
    // Trong lớp: không trùng thứ và tiết, không trùng khung giờ trong cùng thứ
    const errors: FieldError[] = [];
    slots.forEach((slot, index) => {
      for (const other of slots.slice(0, index)) {
        if (other.weekday === slot.weekday && (other.period_no === slot.period_no || overlaps(other, slot))) {
          errors.push({
            field: `slots[${index}]`,
            message: `Trùng khung giờ ${WEEKDAY_LABELS[slot.weekday]} ${other.start_time}–${other.end_time}`,
          });
        }
      }
    });
    if (errors.length > 0) {
      throw ruleViolationError('P03-04', 'Thời khóa biểu của lớp bị trùng khung giờ', errors);
    }
    const teachers = await this.teachersOf(database, classId);
    const unknown = slots.findIndex((slot) => slot.teacher_id !== null && !teachers.has(slot.teacher_id));
    if (unknown >= 0) {
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: `slots[${unknown}].teacher_id`, message: 'Giáo viên chưa được phân công lớp này' },
      ]);
    }
    await this.assertNoTeacherConflict(database, classId, effectiveFrom, slots);
    return database.transaction().execute(async (transaction) => {
      const before = await transaction
        .deleteFrom('timetables')
        .where('class_id', '=', classId)
        .where('effective_from', '=', effectiveFrom)
        .where('status', '=', 'draft')
        .returningAll()
        .execute();
      if (slots.length > 0) {
        await transaction
          .insertInto('timetables')
          .values(
            slots.map((slot) => ({
              class_id: classId,
              effective_from: effectiveFrom,
              weekday: slot.weekday,
              period_no: slot.period_no,
              start_time: slot.start_time,
              end_time: slot.end_time,
              activity_name: slot.activity_name,
              teacher_id: slot.teacher_id,
              teacher_name: slot.teacher_id ? (teachers.get(slot.teacher_id) ?? null) : null,
              created_by: origin.actorUserId,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'timetables',
        entityId: classId,
        action: 'update',
        before: { effective_from: effectiveFrom, slots: before.length },
        after: { effective_from: effectiveFrom, slots },
      });
      return this.timetableOf(transaction, found, effectiveFrom, false);
    });
  }

  private async teachersOf(database: Kysely<SchoolYearDatabase>, classId: string) {
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select(['staff_user_id', 'staff_name'])
      .where('class_id', '=', classId)
      .where('status', '=', 'active')
      .execute();
    return new Map(rows.map((row) => [row.staff_user_id, row.staff_name]));
  }

  // Giáo viên không được xếp hai lớp cùng khung giờ: so với phiên bản đang áp dụng của các lớp khác tại ngày áp dụng
  private async assertNoTeacherConflict(
    database: Kysely<SchoolYearDatabase>,
    classId: string,
    effectiveFrom: string,
    slots: SlotInput[],
  ) {
    const teacherIds = [...new Set(slots.map((slot) => slot.teacher_id).filter((id): id is string => id !== null))];
    if (teacherIds.length === 0) {
      return;
    }
    const others = await database
      .selectFrom('timetables as slot')
      .innerJoin('classes', 'classes.id', 'slot.class_id')
      .select([
        'slot.teacher_id',
        'slot.weekday',
        'slot.start_time',
        'slot.end_time',
        'classes.name as class_name',
      ])
      .where('slot.class_id', '<>', classId)
      .where('slot.teacher_id', 'in', teacherIds)
      .where(
        'slot.effective_from',
        '=',
        sql<string>`(select max(version.effective_from) from timetables as version
          where version.class_id = slot.class_id and version.effective_from <= ${effectiveFrom})`,
      )
      .execute();
    const conflicts: FieldError[] = [];
    slots.forEach((slot, index) => {
      const clash = others.find(
        (other) => other.teacher_id === slot.teacher_id && other.weekday === slot.weekday && overlaps(other, slot),
      );
      if (clash) {
        conflicts.push({
          field: `slots[${index}].teacher_id`,
          message: `Giáo viên đã có tiết ở lớp ${clash.class_name} ${WEEKDAY_LABELS[slot.weekday]} ${clash.start_time}–${clash.end_time}`,
        });
      }
    });
    if (conflicts.length > 0) {
      throw ruleViolationError('P03-04', 'Giáo viên bị trùng khung giờ ở lớp khác', conflicts);
    }
  }

  async publishTimetable(currentUser: CurrentUser, classId: string, effectiveFrom: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.access.assertCanManageClass(
      currentUser,
      database,
      classId,
      PERMISSION_CODES.curriculumManage,
      { homeroomOnly: true },
    );
    return database.transaction().execute(async (transaction) => {
      const published = await transaction
        .updateTable('timetables')
        .set({ status: 'published', published_at: this.clock.now() })
        .where('class_id', '=', classId)
        .where('effective_from', '=', effectiveFrom)
        .where('status', '=', 'draft')
        .returning('id')
        .execute();
      if (published.length === 0) {
        throw ruleViolationError('P03-04', 'Không có bản nháp thời khóa biểu áp dụng từ ngày này để công bố');
      }
      await queueNotification(transaction, {
        orgUnitId: found.org_unit_id,
        templateCode: 'timetable_published',
        title: 'Thời khóa biểu mới',
        body: `Thời khóa biểu lớp ${found.name} áp dụng từ ${effectiveFrom}`,
        targetType: 'classes',
        targetId: classId,
        recipients: (await this.access.guardianUserIdsOfClass(transaction, classId)).map((userId) => ({
          userId,
          channel: 'in_app' as const,
        })),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'timetables',
        entityId: classId,
        action: 'update',
        before: { effective_from: effectiveFrom, status: 'draft' },
        after: { effective_from: effectiveFrom, status: 'published' },
      });
      return this.timetableOf(transaction, found, effectiveFrom, false);
    });
  }

  async schedules(currentUser: CurrentUser, classId: string, from: string | null, to: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const { found, publishedOnly } = await this.viewer(currentUser, database, classId);
    const start = from ?? this.today();
    return this.schedulesOf(database, found.id, start, to ?? addDays(start, DEFAULT_SCHEDULE_DAYS - 1), publishedOnly);
  }

  async schedulesOf(
    database: Kysely<SchoolYearDatabase>,
    classId: string,
    from: string,
    to: string,
    publishedOnly: boolean,
  ) {
    let query = database
      .selectFrom('class_activity_schedules')
      .select([
        'id',
        'class_id',
        'activity_date',
        'start_time',
        'end_time',
        'activity_name',
        'note',
        'status',
        'published_at',
      ])
      .where('class_id', '=', classId)
      .where('activity_date', '>=', from)
      .where('activity_date', '<=', to)
      .orderBy('activity_date')
      .orderBy('start_time');
    query = publishedOnly
      ? query.where('status', '=', 'published')
      : query.where('status', '<>', 'cancelled');
    return query.execute();
  }

  private async assertNoScheduleOverlap(
    database: Kysely<SchoolYearDatabase>,
    classId: string,
    slot: { activity_date: string; start_time: string; end_time: string },
    exceptId: string | null,
  ) {
    let query = database
      .selectFrom('class_activity_schedules')
      .select(['start_time', 'end_time', 'activity_name'])
      .where('class_id', '=', classId)
      .where('activity_date', '=', slot.activity_date)
      .where('status', '<>', 'cancelled');
    if (exceptId) {
      query = query.where('id', '<>', exceptId);
    }
    const clash = (await query.execute()).find((other) => overlaps(other, slot));
    if (clash) {
      throw ruleViolationError(
        'P03-07',
        `Trùng khung giờ với hoạt động "${clash.activity_name}" ${clash.start_time}–${clash.end_time}`,
      );
    }
  }

  async createSchedule(currentUser: CurrentUser, classId: string, input: Required<ScheduleInput>, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.access.assertCanManageClass(
      currentUser,
      database,
      classId,
      PERMISSION_CODES.curriculumManage,
      { homeroomOnly: true },
    );
    if (input.activity_date < this.today()) {
      throw ruleViolationError('P03-07', 'Không lập lịch hoạt động cho ngày đã qua');
    }
    await this.assertNoScheduleOverlap(database, classId, input, null);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('class_activity_schedules')
        .values({ class_id: classId, ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'class_activity_schedules',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Sửa hoạt động còn nháp hoặc hủy hoạt động; hoạt động đã công bố chỉ hủy được (BR-75)
  async updateSchedule(
    currentUser: CurrentUser,
    scheduleId: string,
    input: ScheduleInput & { cancel: boolean },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('class_activity_schedules')
      .selectAll()
      .where('id', '=', scheduleId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy hoạt động', 'class_activity_schedule');
    }
    const found = await this.access.assertCanManageClass(
      currentUser,
      database,
      before.class_id,
      PERMISSION_CODES.curriculumManage,
      { homeroomOnly: true },
    );
    if (before.status === 'cancelled') {
      throw ruleViolationError('P03-07', 'Hoạt động đã hủy');
    }
    const { cancel, ...fields } = input;
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    if (!cancel && Object.keys(changes).length > 0) {
      if (before.status !== 'draft') {
        throw ruleViolationError('P03-07', 'Hoạt động đã công bố chỉ hủy được, không sửa');
      }
      const next = { ...before, ...changes };
      if (next.end_time <= next.start_time) {
        throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
          { field: 'end_time', message: 'Giờ kết thúc sau giờ bắt đầu' },
        ]);
      }
      await this.assertNoScheduleOverlap(database, before.class_id, next, scheduleId);
    }
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('class_activity_schedules')
        .set({ ...(cancel ? { status: 'cancelled' as const } : changes), updated_at: this.clock.now() })
        .where('id', '=', scheduleId)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (cancel && before.status === 'published') {
        await queueNotification(transaction, {
          orgUnitId: found.org_unit_id,
          templateCode: 'activity_schedule_cancelled',
          title: 'Hủy hoạt động của lớp',
          body: `Lớp ${found.name} hủy hoạt động "${before.activity_name}" ngày ${before.activity_date}`,
          targetType: 'class_activity_schedules',
          targetId: scheduleId,
          recipients: (await this.access.guardianUserIdsOfClass(transaction, before.class_id)).map((userId) => ({
            userId,
            channel: 'in_app' as const,
          })),
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'class_activity_schedules',
        entityId: scheduleId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  async publishSchedules(currentUser: CurrentUser, classId: string, from: string, to: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.access.assertCanManageClass(
      currentUser,
      database,
      classId,
      PERMISSION_CODES.curriculumManage,
      { homeroomOnly: true },
    );
    return database.transaction().execute(async (transaction) => {
      const published = await transaction
        .updateTable('class_activity_schedules')
        .set({ status: 'published', published_at: this.clock.now(), updated_at: this.clock.now() })
        .where('class_id', '=', classId)
        .where('status', '=', 'draft')
        .where('activity_date', '>=', from)
        .where('activity_date', '<=', to)
        .returning('id')
        .execute();
      if (published.length === 0) {
        throw ruleViolationError('P03-07', 'Không có hoạt động nháp trong khoảng ngày để công bố');
      }
      await queueNotification(transaction, {
        orgUnitId: found.org_unit_id,
        templateCode: 'activity_schedule_published',
        title: 'Lịch hoạt động của lớp',
        body: `Lớp ${found.name} công bố lịch hoạt động từ ${from} đến ${to}`,
        targetType: 'classes',
        targetId: classId,
        recipients: (await this.access.guardianUserIdsOfClass(transaction, classId)).map((userId) => ({
          userId,
          channel: 'in_app' as const,
        })),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'class_activity_schedules',
        entityId: classId,
        action: 'update',
        before: { status: 'draft', from, to },
        after: { status: 'published', count: published.length },
      });
      return { published_count: published.length };
    });
  }

  async teachingPlans(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.access.findClass(database, classId);
    if (!(await this.access.canViewClass(currentUser, database, found))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được kế hoạch giảng dạy của lớp này');
    }
    return database
      .selectFrom('teaching_plans')
      .selectAll()
      .where('class_id', '=', classId)
      .orderBy('period_type')
      .orderBy('period_value', 'desc')
      .execute();
  }

  async createTeachingPlan(
    currentUser: CurrentUser,
    input: { class_id: string; period_type: TeachingPlanPeriod; period_value: string; objectives: string; content: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.access.assertCanManageClass(
      currentUser,
      database,
      input.class_id,
      PERMISSION_CODES.curriculumManage,
      { homeroomOnly: true },
    );
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('teaching_plans')
          .values({ ...input, org_unit_id: found.org_unit_id, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Lớp đã có kế hoạch giảng dạy của kỳ này',
        'period_value',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'teaching_plans',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateTeachingPlan(
    currentUser: CurrentUser,
    planId: string,
    changes: { objectives?: string; content?: string; progress_note?: string | null; status?: TeachingPlanStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('teaching_plans').selectAll().where('id', '=', planId).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy kế hoạch giảng dạy', 'teaching_plan');
    }
    await this.access.assertCanManageClass(currentUser, database, before.class_id, PERMISSION_CODES.curriculumManage, {
      homeroomOnly: true,
    });
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('teaching_plans')
        .set({ ...changes, updated_by: origin.actorUserId, updated_at: this.clock.now() })
        .where('id', '=', planId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'teaching_plans',
        entityId: planId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }
}

function readSlots(body: RequestBody): { effective_from: string; slots: SlotInput[] } {
  const errors: FieldError[] = [];
  const effectiveFrom = readDate(body, 'effective_from', errors, true) ?? '';
  const raw = body?.slots;
  const slots: SlotInput[] = [];
  if (!Array.isArray(raw) || raw.length > 100) {
    errors.push({ field: 'slots', message: 'Danh sách tiết tối đa 100 dòng' });
  } else {
    raw.forEach((item: unknown, index) => {
      const slot = (item ?? {}) as RequestBody;
      const slotErrors: FieldError[] = [];
      const value: SlotInput = {
        weekday: readRequiredInteger(slot, 'weekday', slotErrors, { min: 1, max: 7 }),
        period_no: readRequiredInteger(slot, 'period_no', slotErrors, { min: 1, max: 20 }),
        start_time: readTime(slot, 'start_time', slotErrors),
        end_time: readTime(slot, 'end_time', slotErrors),
        activity_name: readName(slot, 'activity_name', slotErrors),
        teacher_id: readOptionalUuid(slot, 'teacher_id', slotErrors) ?? null,
      };
      if (value.start_time && value.end_time && value.end_time <= value.start_time) {
        slotErrors.push({ field: 'end_time', message: 'Giờ kết thúc sau giờ bắt đầu' });
      }
      errors.push(...slotErrors.map((error) => ({ ...error, field: `slots[${index}].${error.field}` })));
      slots.push(value);
    });
  }
  check(errors);
  return { effective_from: effectiveFrom, slots };
}

function readSchedule(body: RequestBody, creating: boolean): ScheduleInput {
  const errors: FieldError[] = [];
  const input: ScheduleInput = {};
  if (creating || body?.activity_date !== undefined) {
    input.activity_date = readDate(body, 'activity_date', errors, true) ?? '';
  }
  for (const field of ['start_time', 'end_time'] as const) {
    if (creating || body?.[field] !== undefined) {
      input[field] = readTime(body, field, errors);
    }
  }
  if (creating || body?.activity_name !== undefined) {
    input.activity_name = readName(body, 'activity_name', errors);
  }
  if (creating || body?.note !== undefined) {
    input.note = readText(body, 'note', errors, { maximum: 1000 });
  }
  if (creating && input.start_time && input.end_time && input.end_time <= input.start_time) {
    errors.push({ field: 'end_time', message: 'Giờ kết thúc sau giờ bắt đầu' });
  }
  check(errors);
  return input;
}

function requiredRange(body: RequestBody): { from: string; to: string } {
  const errors: FieldError[] = [];
  const from = readDate(body, 'from', errors, true) ?? '';
  const to = readDate(body, 'to', errors, true) ?? '';
  if (from && to && to < from) {
    errors.push({ field: 'to', message: 'Đến ngày không trước từ ngày' });
  }
  check(errors);
  return { from, to };
}

@Controller()
export class ClassTeachingController {
  constructor(private readonly service: ClassTeachingService) {}

  @Get('classes/:id/timetable')
  timetable(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('week') week: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.timetable(currentUser, classId, optionalQueryDate(week, 'week'));
  }

  @Put('classes/:id/timetable')
  saveTimetable(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = readSlots(body);
    return this.service.saveTimetable(
      currentUser,
      classId,
      input.effective_from,
      input.slots,
      originOf(request, currentUser),
    );
  }

  @Post('classes/:id/timetable/publish')
  @HttpCode(200)
  publishTimetable(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const effectiveFrom = readDate(body, 'effective_from', errors, true) ?? '';
    check(errors);
    return this.service.publishTimetable(currentUser, classId, effectiveFrom, originOf(request, currentUser));
  }

  @Get('classes/:id/activity-schedules')
  schedules(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query() query: Record<string, string | undefined>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.schedules(
      currentUser,
      classId,
      optionalQueryDate(query.from, 'from'),
      optionalQueryDate(query.to, 'to'),
    );
  }

  @Post('classes/:id/activity-schedules')
  @HttpCode(201)
  createSchedule(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.createSchedule(
      currentUser,
      classId,
      readSchedule(body, true) as Required<ScheduleInput>,
      originOf(request, currentUser),
    );
  }

  @Post('classes/:id/activity-schedules/publish')
  @HttpCode(200)
  publishSchedules(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const range = requiredRange(body);
    return this.service.publishSchedules(currentUser, classId, range.from, range.to, originOf(request, currentUser));
  }

  @Patch('class-activity-schedules/:id')
  updateSchedule(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) scheduleId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (body?.status !== undefined && body.status !== 'cancelled') {
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: 'status', message: 'Chỉ đổi trạng thái sang cancelled' },
      ]);
    }
    return this.service.updateSchedule(
      currentUser,
      scheduleId,
      { ...readSchedule(body, false), cancel: body?.status === 'cancelled' },
      originOf(request, currentUser),
    );
  }

  @Get('teaching-plans')
  teachingPlans(@Query('class_id') classId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(classId)) {
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: 'class_id', message: 'Bắt buộc chọn lớp' },
      ]);
    }
    return this.service.teachingPlans(currentUser, classId);
  }

  @Post('teaching-plans')
  @HttpCode(201)
  createTeachingPlan(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const classId = readOptionalUuid(body, 'class_id', errors);
    if (!classId) {
      errors.push({ field: 'class_id', message: 'Bắt buộc chọn lớp' });
    }
    const period = readPeriod(body, errors, TEACHING_PLAN_PERIODS);
    const input = {
      class_id: classId ?? '',
      ...period,
      objectives: readText(body, 'objectives', errors, { required: true }) ?? '',
      content: readText(body, 'content', errors, { required: true }) ?? '',
    };
    check(errors);
    return this.service.createTeachingPlan(currentUser, input, originOf(request, currentUser));
  }

  @Patch('teaching-plans/:id')
  updateTeachingPlan(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: { objectives?: string; content?: string; progress_note?: string | null; status?: TeachingPlanStatus } =
      {};
    for (const field of ['objectives', 'content'] as const) {
      if (body?.[field] !== undefined) {
        changes[field] = readText(body, field, errors, { required: true }) ?? '';
      }
    }
    if (body?.progress_note !== undefined) {
      changes.progress_note = readText(body, 'progress_note', errors);
    }
    if (body?.status !== undefined) {
      if (!TEACHING_PLAN_STATUSES.includes(body.status as TeachingPlanStatus)) {
        errors.push({ field: 'status', message: `Trạng thái là ${TEACHING_PLAN_STATUSES.join(', ')}` });
      } else {
        changes.status = body.status as TeachingPlanStatus;
      }
    }
    check(errors);
    return this.service.updateTeachingPlan(currentUser, planId, changes, originOf(request, currentUser));
  }
}
