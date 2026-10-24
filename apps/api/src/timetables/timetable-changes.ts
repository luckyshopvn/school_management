import { randomBytes } from 'node:crypto';
import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { TimetablesService } from './timetables.js';

// Dạy thay, đổi tiết, báo cáo tiết dạy, dùng phòng, mã QR tra cứu thời khoá biểu (DT-20 phần 22c2, YCTD-164). Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11:
// - dạy thay, đổi tiết ghi theo ngày ở `timetable_changes`, không sửa bản đã ban hành; tiết thực tế của một ngày là tiết của bản
//   đang áp dụng vào ngày đó, thay bằng thay đổi của ngày (sổ đầu bài 20d đọc tiết thực tế này);
// - dạy thay: một giáo viên khác dạy đúng tiết đó, môn giữ nguyên; giáo viên dạy thay không được đang có tiết khác cùng lúc;
// - đổi tiết: hai tiết của cùng một lớp (cùng ngày hoặc khác ngày) đổi chỗ cho nhau; giáo viên của mỗi tiết phải rảnh ở chỗ
//   mới; một tiết đã có thay đổi thì xoá thay đổi cũ trước;
// - báo cáo tiết dạy theo giáo viên trong một khoảng ngày (tối đa 92 ngày): tiết theo thời khoá biểu, tiết dạy thay, tiết được
//   người khác dạy thay, tiết thực dạy; ngày nghỉ lễ ở danh mục ngày nghỉ không tính;
// - báo cáo dùng phòng của bản đang áp dụng: số tiết mỗi tuần, tỉ lệ dùng so với số ô của khung, số tiết theo thứ;
// - mã tra cứu: chuỗi ngẫu nhiên 12 ký tự cho một lớp hoặc một giáo viên, in thành mã QR trỏ tới trang tra cứu công khai của
//   cổng quản trị (địa chỉ ghép từ tên miền đang mở, không ghi cứng); trang chỉ hiện thời khoá biểu đang áp dụng và thay đổi
//   7 ngày tới của lớp hoặc giáo viên đó; thu hồi mã thì đường dẫn hết hiệu lực.
const MANAGE = PERMISSION_CODES.timetableManage;
const RULE_CODE = 'YCTD-164';
const MAXIMUM_REPORT_DAYS = 92;
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface EffectiveLesson {
  // Tiết của thời khoá biểu ở ô đó (sổ đầu bài 20d trỏ về); trống khi ô không có tiết theo thời khoá biểu
  id: string | null;
  class_id: string;
  class_name: string;
  weekday: number;
  period_no: number;
  subject_id: string;
  subject_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  room_name: string | null;
  change: {
    id: string;
    kind: 'substitute' | 'swap';
    reason: string | null;
    original_subject_name: string | null;
    original_teacher_user_id: string | null;
    original_teacher_name: string | null;
  } | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function readDate(source: RequestBody, field: string, errors: FieldError[]): string {
  const value = source?.[field];
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function readPeriod(source: RequestBody, field: string, errors: FieldError[]): number {
  const value = source?.[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 15) {
    errors.push({ field, message: 'Tiết là số nguyên từ 1 đến 15' });
    return 0;
  }
  return value;
}

export function parseChange(body: RequestBody) {
  const errors: FieldError[] = [];
  const kind = body?.kind;
  if (kind !== 'substitute' && kind !== 'swap') {
    errors.push({ field: 'kind', message: 'Loại là substitute (dạy thay) hoặc swap (đổi tiết)' });
  }
  const date = readDate(body, 'date', errors);
  const periodNo = readPeriod(body, 'period_no', errors);
  if (!isUuid(body?.class_id)) {
    errors.push({ field: 'class_id', message: 'Bắt buộc chọn lớp' });
  }
  const reason = readOptionalText(body, 'reason', errors) ?? null;
  if (reason && reason.length > 500) {
    errors.push({ field: 'reason', message: 'Lý do tối đa 500 ký tự' });
  }
  let teacherUserId: string | null = null;
  let targetDate = '';
  let targetPeriod = 0;
  if (kind === 'substitute') {
    if (!isUuid(body?.teacher_user_id)) {
      errors.push({ field: 'teacher_user_id', message: 'Bắt buộc chọn giáo viên dạy thay' });
    }
    teacherUserId = body?.teacher_user_id as string;
  } else if (kind === 'swap') {
    targetDate = readDate(body, 'target_date', errors);
    targetPeriod = readPeriod(body, 'target_period_no', errors);
    if (targetDate === date && targetPeriod === periodNo) {
      errors.push({ field: 'target_period_no', message: 'Tiết đổi phải khác tiết gốc' });
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    kind: kind as 'substitute' | 'swap',
    date,
    class_id: body?.class_id as string,
    period_no: periodNo,
    teacher_user_id: teacherUserId,
    target_date: targetDate,
    target_period_no: targetPeriod,
    reason,
  };
}

@Injectable()
export class TimetableChangesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
  ) {}

  // Tiết thực tế của một ngày: tiết của bản đang áp dụng, thay bằng dạy thay, đổi tiết của ngày đó
  async effectiveDay(database: Executor, date: string): Promise<EffectiveLesson[]> {
    const weekday = isoWeekday(date);
    const versions = await this.timetables.applyingVersions(database, date);
    const base = (
      await this.timetables.lessons(
        database,
        versions.map((version) => version.id),
      )
    ).filter((lesson) => lesson.weekday === weekday);
    const changes = await database
      .selectFrom('timetable_changes')
      .innerJoin('classes', 'classes.id', 'timetable_changes.class_id')
      .innerJoin('subjects', 'subjects.id', 'timetable_changes.subject_id')
      .leftJoin('subjects as original', 'original.id', 'timetable_changes.original_subject_id')
      .leftJoin('rooms', 'rooms.id', 'timetable_changes.room_id')
      .select([
        'timetable_changes.id',
        'timetable_changes.kind',
        'timetable_changes.class_id',
        'classes.name as class_name',
        'timetable_changes.period_no',
        'timetable_changes.subject_id',
        'subjects.name as subject_name',
        'timetable_changes.teacher_user_id',
        'timetable_changes.teacher_name',
        'timetable_changes.room_id',
        'rooms.name as room_name',
        'timetable_changes.reason',
        'original.name as original_subject_name',
        'timetable_changes.original_teacher_user_id',
        'timetable_changes.original_teacher_name',
      ])
      .where('timetable_changes.change_date', '=', date)
      .execute();
    const result = new Map<string, EffectiveLesson>();
    for (const lesson of base) {
      result.set(`${lesson.class_id}:${lesson.period_no}`, {
        id: lesson.id,
        class_id: lesson.class_id,
        class_name: lesson.class_name,
        weekday,
        period_no: lesson.period_no,
        subject_id: lesson.subject_id,
        subject_name: lesson.subject_name,
        teacher_user_id: lesson.teacher_user_id,
        teacher_name: lesson.teacher_name,
        room_id: lesson.room_id,
        room_name: lesson.room_name,
        change: null,
      });
    }
    for (const change of changes) {
      result.set(`${change.class_id}:${change.period_no}`, {
        id: result.get(`${change.class_id}:${change.period_no}`)?.id ?? null,
        class_id: change.class_id,
        class_name: change.class_name,
        weekday,
        period_no: change.period_no,
        subject_id: change.subject_id,
        subject_name: change.subject_name,
        teacher_user_id: change.teacher_user_id,
        teacher_name: change.teacher_name,
        room_id: change.room_id,
        room_name: change.room_name,
        change: {
          id: change.id,
          kind: change.kind,
          reason: change.reason,
          original_subject_name: change.original_subject_name,
          original_teacher_user_id: change.original_teacher_user_id,
          original_teacher_name: change.original_teacher_name,
        },
      });
    }
    return [...result.values()].sort(
      (left, right) => left.period_no - right.period_no || left.class_name.localeCompare(right.class_name, 'vi'),
    );
  }

  async day(date: string, filter: { classId?: string; teacherUserId?: string }) {
    const { database } = await this.currentSchoolYear.require();
    const lessons = await this.effectiveDay(database, date);
    return lessons.filter(
      (lesson) =>
        (!filter.classId || lesson.class_id === filter.classId) &&
        (!filter.teacherUserId || lesson.teacher_user_id === filter.teacherUserId),
    );
  }

  async list(filter: { from: string; to: string; classId?: string; teacherUserId?: string }) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('timetable_changes')
      .innerJoin('classes', 'classes.id', 'timetable_changes.class_id')
      .innerJoin('subjects', 'subjects.id', 'timetable_changes.subject_id')
      .leftJoin('subjects as original', 'original.id', 'timetable_changes.original_subject_id')
      .select([
        'timetable_changes.id',
        'timetable_changes.change_date',
        'timetable_changes.kind',
        'timetable_changes.pair_id',
        'timetable_changes.class_id',
        'classes.name as class_name',
        'timetable_changes.period_no',
        'subjects.name as subject_name',
        'timetable_changes.teacher_user_id',
        'timetable_changes.teacher_name',
        'original.name as original_subject_name',
        'timetable_changes.original_teacher_user_id',
        'timetable_changes.original_teacher_name',
        'timetable_changes.reason',
        'timetable_changes.created_by_name',
        'timetable_changes.created_at',
      ])
      .where('timetable_changes.change_date', '>=', filter.from)
      .where('timetable_changes.change_date', '<=', filter.to);
    if (filter.classId) {
      query = query.where('timetable_changes.class_id', '=', filter.classId);
    }
    if (filter.teacherUserId) {
      const teacher = filter.teacherUserId;
      query = query.where((expression) =>
        expression.or([
          expression('timetable_changes.teacher_user_id', '=', teacher),
          expression('timetable_changes.original_teacher_user_id', '=', teacher),
        ]),
      );
    }
    return query
      .orderBy('timetable_changes.change_date')
      .orderBy('timetable_changes.period_no')
      .orderBy('classes.name')
      .execute();
  }

  // Giáo viên có thể dạy thay: giáo viên đang được phân công ở lớp bất kỳ
  async teachers() {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select(['staff_user_id', 'staff_name'])
      .where('status', '=', 'active')
      .distinct()
      .orderBy('staff_name')
      .execute();
    return [...new Map(rows.map((row) => [row.staff_user_id, row])).values()].map((row) => ({
      teacher_user_id: row.staff_user_id,
      teacher_name: row.staff_name,
    }));
  }

  private async lessonAt(database: Executor, date: string, classId: string, periodNo: number) {
    const lessons = await this.effectiveDay(database, date);
    const lesson = lessons.find((item) => item.class_id === classId && item.period_no === periodNo);
    if (!lesson) {
      throw ruleViolationError(
        RULE_CODE,
        `Lớp không có tiết ${periodNo} vào ngày ${date} theo thời khoá biểu đang áp dụng`,
      );
    }
    if (lesson.change) {
      throw ruleViolationError(
        RULE_CODE,
        `Tiết ${periodNo} ngày ${date} của lớp đã có thay đổi; xoá thay đổi cũ trước`,
      );
    }
    return { lesson, lessons };
  }

  // Giáo viên không được có tiết khác cùng lúc (ngoài các tiết đang được đổi)
  private assertTeacherFree(
    lessons: EffectiveLesson[],
    teacherUserId: string | null,
    teacherName: string | null,
    periodNo: number,
    date: string,
    except: Array<{ class_id: string; period_no: number }>,
  ) {
    if (!teacherUserId) {
      return;
    }
    const busy = lessons.find(
      (item) =>
        item.teacher_user_id === teacherUserId &&
        item.period_no === periodNo &&
        !except.some((skip) => skip.class_id === item.class_id && skip.period_no === item.period_no),
    );
    if (busy) {
      throw ruleViolationError(
        RULE_CODE,
        `Giáo viên ${teacherName ?? ''} đang dạy lớp ${busy.class_name} tiết ${periodNo} ngày ${date}`,
      );
    }
  }

  async create(currentUser: CurrentUser, input: ReturnType<typeof parseChange>, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const base = {
      class_id: input.class_id,
      reason: input.reason,
      created_by: currentUser.id,
      created_by_name: currentUser.description.full_name,
    };
    const created = await database.transaction().execute(async (transaction) => {
      const { lesson, lessons } = await this.lessonAt(transaction, input.date, input.class_id, input.period_no);
      const original = {
        original_subject_id: lesson.subject_id,
        original_teacher_user_id: lesson.teacher_user_id,
        original_teacher_name: lesson.teacher_name,
      };
      if (input.kind === 'substitute') {
        const teacher = await transaction
          .selectFrom('class_staff_assignments')
          .select('staff_name')
          .where('staff_user_id', '=', input.teacher_user_id as string)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!teacher) {
          throw validationError([{ field: 'teacher_user_id', message: 'Giáo viên chưa được phân công ở lớp nào' }]);
        }
        if (input.teacher_user_id === lesson.teacher_user_id) {
          throw validationError([{ field: 'teacher_user_id', message: 'Giáo viên dạy thay trùng giáo viên của tiết' }]);
        }
        this.assertTeacherFree(lessons, input.teacher_user_id, teacher.staff_name, input.period_no, input.date, []);
        return transaction
          .insertInto('timetable_changes')
          .values({
            ...base,
            ...original,
            change_date: input.date,
            period_no: input.period_no,
            kind: 'substitute',
            subject_id: lesson.subject_id,
            teacher_user_id: input.teacher_user_id,
            teacher_name: teacher.staff_name,
            room_id: lesson.room_id,
          })
          .returning(['id', 'change_date', 'kind', 'period_no'])
          .execute();
      }
      const target = await this.lessonAt(transaction, input.target_date, input.class_id, input.target_period_no);
      const skip = [
        { class_id: input.class_id, period_no: input.period_no },
        { class_id: input.class_id, period_no: input.target_period_no },
      ];
      // Giáo viên của tiết đích sang chỗ tiết gốc và ngược lại
      this.assertTeacherFree(
        lessons,
        target.lesson.teacher_user_id,
        target.lesson.teacher_name,
        input.period_no,
        input.date,
        input.date === input.target_date ? skip : [skip[0] as { class_id: string; period_no: number }],
      );
      this.assertTeacherFree(
        target.lessons,
        lesson.teacher_user_id,
        lesson.teacher_name,
        input.target_period_no,
        input.target_date,
        input.date === input.target_date ? skip : [skip[1] as { class_id: string; period_no: number }],
      );
      const pairId = (
        await transaction
          .selectNoFrom((expression) => expression.fn<string>('gen_random_uuid').as('id'))
          .executeTakeFirstOrThrow()
      ).id;
      return transaction
        .insertInto('timetable_changes')
        .values([
          {
            ...base,
            ...original,
            change_date: input.date,
            period_no: input.period_no,
            kind: 'swap',
            pair_id: pairId,
            subject_id: target.lesson.subject_id,
            teacher_user_id: target.lesson.teacher_user_id,
            teacher_name: target.lesson.teacher_name,
            room_id: target.lesson.room_id,
          },
          {
            ...base,
            original_subject_id: target.lesson.subject_id,
            original_teacher_user_id: target.lesson.teacher_user_id,
            original_teacher_name: target.lesson.teacher_name,
            change_date: input.target_date,
            period_no: input.target_period_no,
            kind: 'swap',
            pair_id: pairId,
            subject_id: lesson.subject_id,
            teacher_user_id: lesson.teacher_user_id,
            teacher_name: lesson.teacher_name,
            room_id: lesson.room_id,
          },
        ])
        .returning(['id', 'change_date', 'kind', 'period_no'])
        .execute();
    });
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'timetable_changes',
      entityId: (created[0] as { id: string }).id,
      action: 'create',
      before: null,
      after: { ...input, rows: created },
    });
    return created;
  }

  async remove(changeId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const change = await database
      .selectFrom('timetable_changes')
      .select(['id', 'pair_id', 'change_date', 'class_id', 'period_no', 'kind'])
      .where('id', '=', changeId)
      .executeTakeFirst();
    if (!change) {
      throw notFoundError('Không tìm thấy thay đổi', 'timetable_change');
    }
    await database.transaction().execute(async (transaction) => {
      let query = transaction.deleteFrom('timetable_changes');
      query = change.pair_id ? query.where('pair_id', '=', change.pair_id) : query.where('id', '=', changeId);
      await query.execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_changes',
        entityId: changeId,
        action: 'delete',
        before: change,
        after: null,
      });
    });
  }

  // Báo cáo tiết dạy theo giáo viên trong khoảng ngày
  async teachingReport(from: string, to: string) {
    const { database } = await this.currentSchoolYear.require();
    const holidays = new Set(
      (
        await database
          .selectFrom('holidays')
          .select('holiday_date')
          .where('holiday_date', '>=', from)
          .where('holiday_date', '<=', to)
          .execute()
      ).map((row) => String(row.holiday_date)),
    );
    const rows = new Map<
      string,
      {
        teacher_user_id: string;
        teacher_name: string;
        planned: number;
        substitute_taught: number;
        substituted_away: number;
        swapped: number;
        actual: number;
      }
    >();
    const row = (id: string, name: string | null) => {
      let value = rows.get(id);
      if (!value) {
        value = {
          teacher_user_id: id,
          teacher_name: name ?? '',
          planned: 0,
          substitute_taught: 0,
          substituted_away: 0,
          swapped: 0,
          actual: 0,
        };
        rows.set(id, value);
      }
      return value;
    };
    let days = 0;
    for (let date = from; date <= to; date = addDays(date, 1)) {
      if (holidays.has(date)) continue;
      const lessons = await this.effectiveDay(database, date);
      if (lessons.length > 0) days += 1;
      for (const lesson of lessons) {
        const plannedTeacher = lesson.change ? lesson.change.original_teacher_name : lesson.teacher_name;
        const plannedId = lesson.change ? lesson.change.original_teacher_user_id : lesson.teacher_user_id;
        if (plannedId) {
          row(plannedId, plannedTeacher).planned += 1;
        }
        if (lesson.teacher_user_id) {
          row(lesson.teacher_user_id, lesson.teacher_name).actual += 1;
        }
        if (lesson.change?.kind === 'substitute') {
          if (lesson.teacher_user_id) row(lesson.teacher_user_id, lesson.teacher_name).substitute_taught += 1;
          if (plannedId) row(plannedId, plannedTeacher).substituted_away += 1;
        } else if (lesson.change?.kind === 'swap' && lesson.teacher_user_id) {
          row(lesson.teacher_user_id, lesson.teacher_name).swapped += 1;
        }
      }
    }
    return {
      from,
      to,
      days,
      teachers: [...rows.values()].sort((left, right) => left.teacher_name.localeCompare(right.teacher_name, 'vi')),
    };
  }

  // Báo cáo dùng phòng của bản đang áp dụng vào một ngày
  async roomReport(date: string) {
    const { database } = await this.currentSchoolYear.require();
    const versions = await this.timetables.applyingVersions(database, date);
    const lessons = (
      await this.timetables.lessons(
        database,
        versions.map((version) => version.id),
      )
    ).filter((lesson) => lesson.room_id);
    let slotCount = 0;
    for (const version of versions) {
      const level = version.school_level as Parameters<TimetablesService['periodSlots']>[0];
      const slots = await this.timetables.periodSlots(level);
      const days = await this.timetables.schoolDays(level);
      slotCount = Math.max(slotCount, slots.length * days.length);
    }
    const rooms = new Map<
      string,
      { room_id: string; room_name: string; periods: number; by_weekday: Record<number, number>; classes: Set<string> }
    >();
    for (const lesson of lessons) {
      const id = lesson.room_id as string;
      const room = rooms.get(id) ?? {
        room_id: id,
        room_name: lesson.room_name ?? '',
        periods: 0,
        by_weekday: {},
        classes: new Set<string>(),
      };
      room.periods += 1;
      room.by_weekday[lesson.weekday] = (room.by_weekday[lesson.weekday] ?? 0) + 1;
      room.classes.add(lesson.class_name);
      rooms.set(id, room);
    }
    return {
      date,
      versions,
      slot_count: slotCount,
      rooms: [...rooms.values()]
        .map((room) => ({
          room_id: room.room_id,
          room_name: room.room_name,
          periods: room.periods,
          usage_percent: slotCount > 0 ? Math.round((room.periods / slotCount) * 1000) / 10 : 0,
          by_weekday: room.by_weekday,
          classes: [...room.classes].sort((left, right) => left.localeCompare(right, 'vi')),
        }))
        .sort((left, right) => left.room_name.localeCompare(right.room_name, 'vi')),
    };
  }

  // Mã tra cứu
  async lookupCodes() {
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('timetable_lookup_codes')
      .select(['id', 'kind', 'target_id', 'target_name', 'code', 'created_at'])
      .where('revoked_at', 'is', null)
      .orderBy('kind')
      .orderBy('target_name')
      .execute();
  }

  async createLookupCode(kind: 'class' | 'teacher', targetId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('timetable_lookup_codes')
      .select(['id', 'kind', 'target_id', 'target_name', 'code', 'created_at'])
      .where('kind', '=', kind)
      .where('target_id', '=', targetId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (existing) {
      return existing;
    }
    const targetName =
      kind === 'class'
        ? (await database.selectFrom('classes').select('name').where('id', '=', targetId).executeTakeFirst())?.name
        : (
            await database
              .selectFrom('class_staff_assignments')
              .select('staff_name')
              .where('staff_user_id', '=', targetId)
              .where('status', '=', 'active')
              .executeTakeFirst()
          )?.staff_name;
    if (!targetName) {
      throw notFoundError(kind === 'class' ? 'Không tìm thấy lớp' : 'Giáo viên chưa được phân công', kind);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('timetable_lookup_codes')
        .values({
          kind,
          target_id: targetId,
          target_name: targetName,
          code: randomBytes(9).toString('base64url'),
          created_by: origin.actorUserId,
        })
        .returning(['id', 'kind', 'target_id', 'target_name', 'code', 'created_at'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_lookup_codes',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { kind, target_id: targetId, target_name: targetName },
      });
      return created;
    });
  }

  async revokeLookupCode(id: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const revoked = await database
      .updateTable('timetable_lookup_codes')
      .set({ revoked_at: new Date() })
      .where('id', '=', id)
      .where('revoked_at', 'is', null)
      .returning(['id', 'kind', 'target_name'])
      .executeTakeFirst();
    if (!revoked) {
      throw notFoundError('Không tìm thấy mã tra cứu', 'timetable_lookup_code');
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'timetable_lookup_codes',
      entityId: id,
      action: 'delete',
      before: revoked,
      after: null,
    });
  }

  // Trang tra cứu công khai theo mã: thời khoá biểu đang áp dụng và thay đổi 7 ngày tới của lớp hoặc giáo viên
  async publicLookup(code: string) {
    const current = await this.currentSchoolYear.find();
    const row = current
      ? await current.database
          .selectFrom('timetable_lookup_codes')
          .select(['kind', 'target_id', 'target_name'])
          .where('code', '=', code)
          .where('revoked_at', 'is', null)
          .executeTakeFirst()
      : undefined;
    if (!current || !row) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Mã tra cứu không đúng hoặc đã bị thu hồi');
    }
    const filter = row.kind === 'class' ? { classId: row.target_id } : { teacherUserId: row.target_id };
    const view = await this.timetables.view(filter);
    const today = this.timetables.today();
    const changes = await this.list({ from: today, to: addDays(today, 6), ...filter });
    return {
      kind: row.kind,
      target_name: row.target_name,
      versions: view.versions.map((version) => ({ name: version.name, effective_from: version.effective_from })),
      slots: view.slots,
      lessons: view.lessons.map((lesson) => ({
        weekday: lesson.weekday,
        period_no: lesson.period_no,
        class_name: lesson.class_name,
        subject_name: lesson.subject_name,
        teacher_name: lesson.teacher_name,
        room_name: lesson.room_name,
      })),
      changes: changes.map((change) => ({
        change_date: change.change_date,
        kind: change.kind,
        class_name: change.class_name,
        period_no: change.period_no,
        subject_name: change.subject_name,
        teacher_name: change.teacher_name,
        original_subject_name: change.original_subject_name,
        original_teacher_name: change.original_teacher_name,
      })),
    };
  }
}

function readRange(query: Record<string, string | undefined>, defaultDays: number) {
  const errors: FieldError[] = [];
  const from = readDate(query, 'from', errors);
  const to = query.to === undefined ? addDays(from || '2000-01-01', defaultDays) : readDate(query, 'to', errors);
  if (errors.length === 0 && to < from) {
    errors.push({ field: 'to', message: 'Ngày kết thúc không trước ngày bắt đầu' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { from, to };
}

@Controller('timetable-changes')
export class TimetableChangesController {
  constructor(
    private readonly changes: TimetableChangesService,
    private readonly timetables: TimetablesService,
  ) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    this.timetables.assertCanView(currentUser);
    const range = readRange(query, 6);
    for (const field of ['class_id', 'teacher_user_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        throw validationError([{ field, message: 'Mã không hợp lệ' }]);
      }
    }
    return this.changes.list({ ...range, classId: query.class_id, teacherUserId: query.teacher_user_id });
  }

  // Tiết thực tế của một ngày (sau dạy thay, đổi tiết)
  @Get('day')
  day(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    this.timetables.assertCanView(currentUser);
    const errors: FieldError[] = [];
    const date = readDate(query, 'date', errors);
    for (const field of ['class_id', 'teacher_user_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.changes.day(date, { classId: query.class_id, teacherUserId: query.teacher_user_id });
  }

  @Get('teachers')
  @RequirePermission(MANAGE)
  teachers() {
    return this.changes.teachers();
  }

  @Post()
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.changes.create(currentUser, parseChange(body), originOf(request, currentUser));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async remove(
    @Param('id', uuidParameter('Mã thay đổi không hợp lệ')) changeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.changes.remove(changeId, originOf(request, currentUser));
  }
}

@Controller('timetable-reports')
export class TimetableReportsController {
  constructor(
    private readonly changes: TimetableChangesService,
    private readonly timetables: TimetablesService,
  ) {}

  @Get('teaching')
  teaching(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    this.timetables.assertCanView(currentUser);
    const range = readRange(query, 6);
    if ((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000 >= MAXIMUM_REPORT_DAYS) {
      throw validationError([{ field: 'to', message: `Khoảng ngày tối đa ${MAXIMUM_REPORT_DAYS} ngày` }]);
    }
    return this.changes.teachingReport(range.from, range.to);
  }

  @Get('rooms')
  rooms(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    this.timetables.assertCanView(currentUser);
    const errors: FieldError[] = [];
    const date = query.date === undefined ? this.timetables.today() : readDate(query, 'date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.changes.roomReport(date);
  }
}

@Controller('timetable-lookup-codes')
@RequirePermission(MANAGE)
export class TimetableLookupCodesController {
  constructor(private readonly changes: TimetableChangesService) {}

  @Get()
  list() {
    return this.changes.lookupCodes();
  }

  @Post()
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (body?.kind !== 'class' && body?.kind !== 'teacher') {
      errors.push({ field: 'kind', message: 'Loại là class (lớp) hoặc teacher (giáo viên)' });
    }
    if (!isUuid(body?.target_id)) {
      errors.push({ field: 'target_id', message: 'Bắt buộc chọn lớp hoặc giáo viên' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.changes.createLookupCode(
      body?.kind as 'class' | 'teacher',
      body?.target_id as string,
      originOf(request, currentUser),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @Param('id', uuidParameter('Mã không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.changes.revokeLookupCode(id, originOf(request, currentUser));
  }
}

@Controller('public/timetable-lookup')
@PublicEndpoint()
export class TimetableLookupController {
  constructor(private readonly changes: TimetableChangesService) {}

  @Get(':code')
  read(@Param('code') code: string) {
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(code)) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Mã tra cứu không đúng hoặc đã bị thu hồi');
    }
    return this.changes.publicLookup(code);
  }
}
