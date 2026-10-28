import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { PeriodAttendanceStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  LESSON_RATING_RULE_LABELS,
  LESSON_RATINGS,
  lessonRatingIssue,
  PERMISSION_CODES,
  type LessonRating,
  type LessonRatingRule,
  type LessonRatingSettings,
  type SchoolLevelCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { periodDefault } from './period-defaults.js';
import { readSchoolLevel } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { effectiveSeating } from '../seating/seating.js';
import { TimetableChangesService } from '../timetables/timetable-changes.js';
import { TimetablesService } from '../timetables/timetables.js';

// Sổ đầu bài và điểm danh theo tiết (DT-20 phần 20d, YCTD-162). Tiết cần ghi lấy từ thời khoá biểu đang áp dụng vào ngày đó
// (22c1). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giáo viên của tiết theo thời khoá biểu ghi tên bài, nội
// dung, nhận xét, xếp loại tiết (A đến D, tùy trường), điểm danh từng học sinh, rồi ký sổ (khoá với giáo viên); không ghi
// trước ngày dạy; Ban giám hiệu (P02.class-log.review) ký sổ theo tuần, tuần đã ký khoá mọi tiết. Học sinh có báo vắng của
// ngày (`absence_records`) mặc định "vắng có phép"; điểm danh theo ngày của Mầm non không đổi. Dạy thay, đổi tiết theo ngày
// là 22c2: tiết của một ngày là tiết thực tế sau dạy thay, đổi tiết (người dạy thực tế ghi sổ, YCTD-164).
// THCS, THPT (DT-21 phần 21d, YCTD-171): tiết nhóm của 21b ghi sổ riêng từng nhóm, danh sách điểm danh là học sinh có môn của
// tiết trong tổ hợp đang hiệu lực (lớp chưa ai đăng ký tổ hợp thì cả lớp); quy tắc xếp loại tiết theo cấp
// (`class_log_settings`); chi tiết tiết kèm sơ đồ chỗ ngồi đang áp dụng; xuất sổ đầu bài tuần ra Excel, PDF
export const CLASS_LOG_RULE_CODE = 'YCTD-162';
export const SECONDARY_CLASS_LOG_RULE_CODE = 'YCTD-171';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const STATUSES: PeriodAttendanceStatus[] = ['present', 'late', 'absent_excused', 'absent_unexcused'];
const RATINGS = ['A', 'B', 'C', 'D'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ClassLogInput {
  class_id: string;
  lesson_date: string;
  period_no: number;
  group_no: number;
  lesson_title: string;
  content: string | null;
  comment: string | null;
  rating: string | null;
  attendance: Array<{ child_id: string; status: PeriodAttendanceStatus; note: string | null }>;
}

const DEFAULT_RATING_SETTINGS: LessonRatingSettings = {
  rating_mode: 'optional',
  rating_labels: { A: 'Tốt', B: 'Khá', C: 'Trung bình', D: 'Chưa đạt' },
  low_rating_comment: false,
  conduct_points: null,
};

// Quy tắc xếp loại tiết của cấp; cấp chưa có dòng (Mầm non) theo mặc định của 20d
export async function readRatingSettings(database: Executor, level: SchoolLevelCode): Promise<LessonRatingSettings> {
  const row = await database
    .selectFrom('class_log_settings')
    .select(['rating_mode', 'rating_labels', 'low_rating_comment', 'conduct_points'])
    .where('school_level', '=', level)
    .executeTakeFirst();
  return row ?? DEFAULT_RATING_SETTINGS;
}

function readGroupNo(value: unknown, errors: FieldError[]): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 9) {
    errors.push({ field: 'group_no', message: 'Nhóm là số nguyên từ 0 (cả lớp) đến 9' });
    return 0;
  }
  return number;
}

// Thứ theo ISO (1 là thứ Hai) của một ngày YYYY-MM-DD
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Thứ Hai của tuần chứa ngày
export function weekStartOf(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - (isoWeekday(date) - 1));
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function parseClassLogInput(body: RequestBody): ClassLogInput {
  const errors: FieldError[] = [];
  if (!isUuid(body?.class_id)) {
    errors.push({ field: 'class_id', message: 'Bắt buộc chọn lớp' });
  }
  if (!isDate(body?.lesson_date)) {
    errors.push({ field: 'lesson_date', message: 'Ngày dạng YYYY-MM-DD' });
  }
  const period = body?.period_no;
  if (typeof period !== 'number' || !Number.isInteger(period) || period < 1 || period > 15) {
    errors.push({ field: 'period_no', message: 'Tiết là số nguyên từ 1 đến 15' });
  }
  const groupNo = readGroupNo(body?.group_no, errors);
  const title = typeof body?.lesson_title === 'string' ? body.lesson_title.trim() : '';
  if (title === '' || title.length > 300) {
    errors.push({ field: 'lesson_title', message: 'Tên bài từ 1 đến 300 ký tự' });
  }
  const content = readOptionalText(body, 'content', errors) ?? null;
  if (content && content.length > 2000) {
    errors.push({ field: 'content', message: 'Tối đa 2000 ký tự' });
  }
  const comment = readOptionalText(body, 'comment', errors) ?? null;
  if (comment && comment.length > 1000) {
    errors.push({ field: 'comment', message: 'Tối đa 1000 ký tự' });
  }
  const rating = body?.rating === undefined || body.rating === null || body.rating === '' ? null : body.rating;
  if (rating !== null && !RATINGS.includes(rating as string)) {
    errors.push({ field: 'rating', message: 'Xếp loại tiết là A, B, C hoặc D' });
  }
  const raw = body?.attendance ?? [];
  if (!Array.isArray(raw)) {
    errors.push({ field: 'attendance', message: 'Danh sách điểm danh không hợp lệ' });
  }
  const seen = new Set<string>();
  const attendance = (Array.isArray(raw) ? raw : []).map((value, index) => {
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    if (!isUuid(item.child_id) || seen.has(item.child_id)) {
      errors.push({ field: `attendance[${index}].child_id`, message: 'Học sinh không hợp lệ hoặc bị trùng' });
    }
    seen.add(item.child_id as string);
    if (!STATUSES.includes(item.status as PeriodAttendanceStatus)) {
      errors.push({
        field: `attendance[${index}].status`,
        message: 'Trạng thái là present, late, absent_excused hoặc absent_unexcused',
      });
    }
    const note = typeof item.note === 'string' && item.note.trim() !== '' ? item.note.trim() : null;
    if (note && note.length > 300) {
      errors.push({ field: `attendance[${index}].note`, message: 'Tối đa 300 ký tự' });
    }
    return { child_id: item.child_id as string, status: item.status as PeriodAttendanceStatus, note };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    class_id: body?.class_id as string,
    lesson_date: body?.lesson_date as string,
    period_no: period as number,
    group_no: groupNo,
    lesson_title: title,
    content,
    comment,
    rating: rating as string | null,
    attendance,
  };
}

const LOG_COLUMNS = [
  'id',
  'class_id',
  'lesson_date',
  'period_no',
  'group_no',
  'subject_id',
  'timetable_lesson_id',
  'teacher_user_id',
  'teacher_name',
  'lesson_title',
  'content',
  'comment',
  'rating',
  'status',
  'signed_at',
] as const;

@Injectable()
export class ClassLogsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
    private readonly changes: TimetableChangesService,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  private async findClass(database: Executor, classId: string) {
    const row = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'school_level'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return row;
  }

  // Nhân sự xem được lớp hoặc giáo viên đang dạy, chủ nhiệm lớp
  private async assertCanView(database: Executor, currentUser: CurrentUser, classId: string) {
    if (this.timetables.isStaffViewer(currentUser) || currentUser.hasPermission(PERMISSION_CODES.classLogReview)) {
      return;
    }
    const assigned = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!assigned) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được sổ đầu bài của lớp này');
    }
  }

  // Tiết của lớp vào một ngày theo thời khoá biểu đang áp dụng, sau dạy thay, đổi tiết của ngày (22c2)
  private async plannedLessons(database: Executor, _level: SchoolLevelCode, classId: string, date: string) {
    return (await this.changes.effectiveDay(database, date)).filter((lesson) => lesson.class_id === classId);
  }

  private async review(database: Executor, classId: string, weekStart: string) {
    return database
      .selectFrom('class_log_reviews')
      .select(['id', 'week_start', 'reviewer_name', 'comment', 'signed_at'])
      .where('class_id', '=', classId)
      .where('week_start', '=', weekStart)
      .executeTakeFirst();
  }

  // Sổ đầu bài một tuần của lớp: mỗi ngày các tiết theo thời khoá biểu kèm tiết đã ghi, số học sinh vắng; tiết đã ghi mà
  // không còn trong thời khoá biểu (đổi bản) vẫn hiện
  async week(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertCanView(database, currentUser, classId);
    const weekStart = weekStartOf(date);
    const dates = Array.from({ length: 7 }, (_value, index) => addDays(weekStart, index));
    const logs = await database
      .selectFrom('class_logs')
      .innerJoin('subjects', 'subjects.id', 'class_logs.subject_id')
      .select([...LOG_COLUMNS.map((column) => `class_logs.${column}` as const), 'subjects.name as subject_name'])
      .where('class_logs.class_id', '=', classId)
      .where('class_logs.lesson_date', '>=', weekStart)
      .where('class_logs.lesson_date', '<=', dates[6] as string)
      .execute();
    const absences = logs.length
      ? await database
          .selectFrom('period_attendance')
          .select(['class_log_id', 'status'])
          .where(
            'class_log_id',
            'in',
            logs.map((log) => log.id),
          )
          .where('status', '!=', 'present')
          .execute()
      : [];
    const days = [];
    for (const day of dates) {
      const planned = await this.plannedLessons(database, classRow.school_level as SchoolLevelCode, classId, day);
      const dayLogs = logs.filter((log) => log.lesson_date === day);
      // Mỗi tiết, mỗi nhóm học (21b) một dòng
      const slots = [
        ...new Set([
          ...planned.map((lesson) => `${lesson.period_no}:${lesson.group_no}`),
          ...dayLogs.map((log) => `${log.period_no}:${log.group_no}`),
        ]),
      ]
        .map((key) => key.split(':').map(Number) as [number, number])
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
      if (slots.length === 0) {
        continue;
      }
      days.push({
        date: day,
        weekday: isoWeekday(day),
        lessons: slots.map(([period, group]) => {
          const lesson = planned.find((item) => item.period_no === period && item.group_no === group);
          const log = dayLogs.find((item) => item.period_no === period && item.group_no === group);
          const logAbsences = log ? absences.filter((row) => row.class_log_id === log.id) : [];
          return {
            period_no: period,
            group_no: group,
            subject_id: log?.subject_id ?? lesson?.subject_id ?? null,
            subject_name: log?.subject_name ?? lesson?.subject_name ?? null,
            teacher_user_id: log?.teacher_user_id ?? lesson?.teacher_user_id ?? null,
            teacher_name: log?.teacher_name ?? lesson?.teacher_name ?? null,
            log: log ?? null,
            absent_count: logAbsences.filter((row) => row.status !== 'late').length,
            late_count: logAbsences.filter((row) => row.status === 'late').length,
          };
        }),
      });
    }
    return {
      class: classRow,
      week_start: weekStart,
      days,
      review: (await this.review(database, classId, weekStart)) ?? null,
    };
  }

  // Lịch dạy hôm nay (hoặc một ngày) của tôi kèm trạng thái sổ đầu bài, cho ứng dụng giáo viên
  async mine(currentUser: CurrentUser, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const lessons = (await this.changes.effectiveDay(database, date)).filter(
      (lesson) => lesson.teacher_user_id === currentUser.id,
    );
    const logs = lessons.length
      ? await database
          .selectFrom('class_logs')
          .select(['id', 'class_id', 'period_no', 'group_no', 'status', 'lesson_title'])
          .where('lesson_date', '=', date)
          .where(
            'class_id',
            'in',
            lessons.map((lesson) => lesson.class_id),
          )
          .execute()
      : [];
    return {
      date,
      lessons: lessons.map((lesson) => ({
        class_id: lesson.class_id,
        class_name: lesson.class_name,
        period_no: lesson.period_no,
        group_no: lesson.group_no,
        subject_name: lesson.subject_name,
        log:
          logs.find(
            (log) =>
              log.class_id === lesson.class_id &&
              log.period_no === lesson.period_no &&
              log.group_no === lesson.group_no,
          ) ?? null,
      })),
    };
  }

  // Một tiết: thông tin theo thời khoá biểu, tiết đã ghi và danh sách học sinh kèm điểm danh (chưa ghi thì có mặt, có báo
  // vắng của ngày thì vắng có phép)
  // Học sinh của tiết nhóm: có môn của tiết trong tổ hợp đang hiệu lực (tổ hợp đã duyệt, hoặc tổ hợp cũ khi đổi tổ hợp còn chờ
  // duyệt, như thời khoá biểu của con ở 21b). Trống là lớp chưa ai đăng ký tổ hợp có môn đó: điểm danh cả lớp
  private async groupMembers(database: Executor, classId: string, subjectId: string): Promise<Set<string> | null> {
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('child_subject_combinations', 'child_subject_combinations.child_id', 'class_enrollments.child_id')
      .innerJoin('subject_combination_subjects', (join) =>
        join
          .on('subject_combination_subjects.subject_id', '=', subjectId)
          .on((expression) =>
            expression.or([
              expression.and([
                expression('child_subject_combinations.status', '=', 'approved'),
                expression(
                  'subject_combination_subjects.combination_id',
                  '=',
                  expression.ref('child_subject_combinations.combination_id'),
                ),
              ]),
              expression.and([
                expression('child_subject_combinations.status', '!=', 'approved'),
                expression(
                  'subject_combination_subjects.combination_id',
                  '=',
                  expression.ref('child_subject_combinations.previous_combination_id'),
                ),
              ]),
            ]),
          ),
      )
      .select('class_enrollments.child_id')
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .execute();
    return rows.length > 0 ? new Set(rows.map((row) => row.child_id)) : null;
  }

  async detail(currentUser: CurrentUser, classId: string, date: string, periodNo: number, groupNo = 0) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertCanView(database, currentUser, classId);
    const lesson = (await this.plannedLessons(database, classRow.school_level as SchoolLevelCode, classId, date)).find(
      (item) => item.period_no === periodNo && item.group_no === groupNo,
    );
    const log = await database
      .selectFrom('class_logs')
      .select(LOG_COLUMNS)
      .where('class_id', '=', classId)
      .where('lesson_date', '=', date)
      .where('period_no', '=', periodNo)
      .where('group_no', '=', groupNo)
      .executeTakeFirst();
    if (!lesson && !log) {
      throw notFoundError('Lớp không có tiết này theo thời khoá biểu đang áp dụng', 'class_log');
    }
    const subjectId = log?.subject_id ?? (lesson?.subject_id as string);
    const members = groupNo > 0 ? await this.groupMembers(database, classId, subjectId) : null;
    const allStudents = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('absence_records', (join) =>
        join.onRef('absence_records.child_id', '=', 'children.id').on('absence_records.absence_date', '=', date),
      )
      // Điểm danh đầu ngày của học sinh ở lớp (YCTD-350) làm mặc định cho tiết chưa ghi điểm danh
      .leftJoin('attendance_records', (join) =>
        join
          .onRef('attendance_records.child_id', '=', 'children.id')
          .on('attendance_records.class_id', '=', classId)
          .on('attendance_records.attendance_date', '=', date),
      )
      .select([
        'children.id',
        'children.full_name',
        'absence_records.reason as absence_reason',
        'absence_records.id as absence_id',
        'attendance_records.status as daily_status',
        'attendance_records.note as daily_note',
      ])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
    const marks = log
      ? await database
          .selectFrom('period_attendance')
          .select(['child_id', 'status', 'note'])
          .where('class_log_id', '=', log.id)
          .execute()
      : [];
    const students = allStudents.filter(
      (student) => !members || members.has(student.id) || marks.some((mark) => mark.child_id === student.id),
    );
    const review = await this.review(database, classId, weekStartOf(date));
    const seating = await effectiveSeating(database, classId, subjectId, date);
    return {
      class: classRow,
      lesson_date: date,
      period_no: periodNo,
      group_no: groupNo,
      // Tiết nhóm mà lớp chưa ai đăng ký tổ hợp có môn: danh sách là cả lớp
      group_filtered: members !== null,
      subject_name: lesson?.subject_name ?? null,
      teacher_name: log?.teacher_name ?? lesson?.teacher_name ?? null,
      log: log ?? null,
      week_signed: Boolean(review),
      can_edit: this.canEdit(currentUser, log, lesson?.teacher_user_id ?? null, Boolean(review)),
      rating: await readRatingSettings(database, classRow.school_level as SchoolLevelCode),
      seating,
      students: students.map((student) => {
        const mark = marks.find((item) => item.child_id === student.id);
        const fallback = periodDefault(student.daily_status, student.absence_id !== null);
        return {
          child_id: student.id,
          full_name: student.full_name,
          absence_reason: student.absence_id ? (student.absence_reason ?? '') : null,
          status: mark?.status ?? fallback.status,
          note: mark?.note ?? (student.daily_status ? student.daily_note : null),
          // Nguồn của trạng thái: tiết đã ghi, điểm danh đầu ngày, báo vắng của phụ huynh hoặc mặc định có mặt
          status_source: mark ? 'period' : fallback.source,
          daily_status: student.daily_status ?? null,
        };
      }),
    };
  }

  private canEdit(
    currentUser: CurrentUser,
    log: { teacher_user_id: string; status: string } | undefined,
    lessonTeacher: string | null,
    weekSigned: boolean,
  ) {
    const teacher = log?.teacher_user_id ?? lessonTeacher;
    return !weekSigned && log?.status !== 'signed' && teacher === currentUser.id;
  }

  async save(currentUser: CurrentUser, input: ClassLogInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, input.class_id);
    if (input.lesson_date > this.today()) {
      throw ruleViolationError(CLASS_LOG_RULE_CODE, 'Chưa đến ngày dạy, không ghi sổ trước');
    }
    const lesson = (
      await this.plannedLessons(database, classRow.school_level as SchoolLevelCode, input.class_id, input.lesson_date)
    ).find((item) => item.period_no === input.period_no && item.group_no === input.group_no);
    const existing = await database
      .selectFrom('class_logs')
      .select(LOG_COLUMNS)
      .where('class_id', '=', input.class_id)
      .where('lesson_date', '=', input.lesson_date)
      .where('period_no', '=', input.period_no)
      .where('group_no', '=', input.group_no)
      .executeTakeFirst();
    if (!lesson && !existing) {
      throw ruleViolationError(CLASS_LOG_RULE_CODE, 'Lớp không có tiết này theo thời khoá biểu đang áp dụng');
    }
    const ratingIssue = lessonRatingIssue(
      await readRatingSettings(database, classRow.school_level as SchoolLevelCode),
      input,
      false,
    );
    if (ratingIssue) {
      throw ruleViolationError(SECONDARY_CLASS_LOG_RULE_CODE, ratingIssue);
    }
    const weekSigned = Boolean(await this.review(database, input.class_id, weekStartOf(input.lesson_date)));
    if (weekSigned) {
      throw ruleViolationError(CLASS_LOG_RULE_CODE, 'Ban giám hiệu đã ký sổ tuần này, không sửa được');
    }
    if (existing?.status === 'signed') {
      throw ruleViolationError(CLASS_LOG_RULE_CODE, 'Tiết đã ký sổ, không sửa được');
    }
    const teacherUserId = existing?.teacher_user_id ?? lesson?.teacher_user_id ?? null;
    if (teacherUserId !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy tiết này theo thời khoá biểu ghi sổ đầu bài');
    }
    const enrolled = new Set(
      (
        await database
          .selectFrom('class_enrollments')
          .select('child_id')
          .where('class_id', '=', input.class_id)
          .where('is_current', '=', true)
          .execute()
      ).map((row) => row.child_id),
    );
    const outside = input.attendance.filter((mark) => !enrolled.has(mark.child_id));
    if (outside.length > 0) {
      throw validationError([{ field: 'attendance', message: 'Có học sinh không thuộc lớp' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const values = {
        lesson_title: input.lesson_title,
        content: input.content,
        comment: input.comment,
        rating: input.rating,
        updated_at: this.clock.now(),
      };
      const saved = existing
        ? await transaction
            .updateTable('class_logs')
            .set(values)
            .where('id', '=', existing.id)
            .returning(LOG_COLUMNS)
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('class_logs')
            .values({
              ...values,
              class_id: input.class_id,
              lesson_date: input.lesson_date,
              period_no: input.period_no,
              group_no: input.group_no,
              subject_id: lesson?.subject_id as string,
              timetable_lesson_id: lesson?.id ?? null,
              teacher_user_id: currentUser.id,
              teacher_name: lesson?.teacher_name ?? currentUser.description.full_name,
              created_by: currentUser.id,
            })
            .returning(LOG_COLUMNS)
            .executeTakeFirstOrThrow();
      await transaction.deleteFrom('period_attendance').where('class_log_id', '=', saved.id).execute();
      if (input.attendance.length > 0) {
        await transaction
          .insertInto('period_attendance')
          .values(input.attendance.map((mark) => ({ ...mark, class_log_id: saved.id })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'class_logs',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: { ...saved, attendance: input.attendance },
      });
      return saved;
    });
  }

  async sign(currentUser: CurrentUser, logId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const log = await database.selectFrom('class_logs').select(LOG_COLUMNS).where('id', '=', logId).executeTakeFirst();
    if (!log) {
      throw notFoundError('Không tìm thấy tiết trong sổ đầu bài', 'class_log');
    }
    if (log.teacher_user_id !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy tiết ký sổ');
    }
    if (log.status === 'signed') {
      throw ruleViolationError(CLASS_LOG_RULE_CODE, 'Tiết đã ký sổ');
    }
    const classRow = await this.findClass(database, log.class_id);
    const ratingIssue = lessonRatingIssue(
      await readRatingSettings(database, classRow.school_level as SchoolLevelCode),
      log,
      true,
    );
    if (ratingIssue) {
      throw ruleViolationError(SECONDARY_CLASS_LOG_RULE_CODE, ratingIssue);
    }
    return database.transaction().execute(async (transaction) => {
      const signed = await transaction
        .updateTable('class_logs')
        .set({ status: 'signed', signed_at: this.clock.now(), updated_at: this.clock.now() })
        .where('id', '=', logId)
        .returning(LOG_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'class_logs',
        entityId: logId,
        action: 'update',
        before: { status: log.status },
        after: { status: 'signed' },
      });
      return signed;
    });
  }

  // Ban giám hiệu ký sổ đầu bài một tuần của lớp; tuần còn tiết chưa ghi hoặc chưa ký vẫn ký được, số tiết đó trả về để biết
  async signWeek(
    currentUser: CurrentUser,
    classId: string,
    date: string,
    comment: string | null,
    origin: ChangeOrigin,
  ) {
    const week = await this.week(currentUser, classId, date);
    if (week.review) {
      throw ruleViolationError(CLASS_LOG_RULE_CODE, 'Tuần này đã ký sổ');
    }
    const { database } = await this.currentSchoolYear.require();
    const lessons = week.days.flatMap((day) => day.lessons);
    const unsigned = lessons.filter((lesson) => lesson.log?.status !== 'signed').length;
    const review = await database
      .insertInto('class_log_reviews')
      .values({
        class_id: classId,
        week_start: week.week_start,
        reviewer_user_id: currentUser.id,
        reviewer_name: currentUser.description.full_name,
        comment,
      })
      .returning(['id', 'week_start', 'reviewer_name', 'comment', 'signed_at'])
      .executeTakeFirstOrThrow();
    await writeAuditLog(database, {
      origin,
      orgUnitId: week.class.org_unit_id,
      entityName: 'class_log_reviews',
      entityId: review.id,
      action: 'create',
      before: null,
      after: { ...review, class_id: classId, unsigned_lessons: unsigned },
    });
    return { review, lessons: lessons.length, unsigned_lessons: unsigned };
  }

  // Chuyên cần theo tiết của lớp trong khoảng ngày, đối chiếu với báo vắng theo ngày và điểm danh theo ngày (nếu có)
  async summary(currentUser: CurrentUser, classId: string, from: string, to: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.findClass(database, classId);
    await this.assertCanView(database, currentUser, classId);
    const students = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .orderBy('children.full_name')
      .execute();
    const marks = await database
      .selectFrom('period_attendance')
      .innerJoin('class_logs', 'class_logs.id', 'period_attendance.class_log_id')
      .select(['period_attendance.child_id', 'period_attendance.status', 'class_logs.lesson_date'])
      .where('class_logs.class_id', '=', classId)
      .where('class_logs.lesson_date', '>=', from)
      .where('class_logs.lesson_date', '<=', to)
      .execute();
    const childIds = students.map((student) => student.id);
    const notices = childIds.length
      ? await database
          .selectFrom('absence_records')
          .select(['child_id', 'absence_date'])
          .where('child_id', 'in', childIds)
          .where('absence_date', '>=', from)
          .where('absence_date', '<=', to)
          .execute()
      : [];
    const daily = childIds.length
      ? await database
          .selectFrom('attendance_records')
          .select(['child_id', 'attendance_date', 'status'])
          .where('child_id', 'in', childIds)
          .where('attendance_date', '>=', from)
          .where('attendance_date', '<=', to)
          .execute()
      : [];
    const lessonCount = await database
      .selectFrom('class_logs')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', '=', classId)
      .where('lesson_date', '>=', from)
      .where('lesson_date', '<=', to)
      .executeTakeFirstOrThrow();
    return {
      from,
      to,
      lessons: Number(lessonCount.count),
      students: students.map((student) => {
        const own = marks.filter((mark) => mark.child_id === student.id);
        const count = (status: PeriodAttendanceStatus) => own.filter((mark) => mark.status === status).length;
        const absentDays = new Set(
          own.filter((mark) => mark.status.startsWith('absent')).map((mark) => mark.lesson_date),
        );
        const noticeDays = new Set(notices.filter((row) => row.child_id === student.id).map((row) => row.absence_date));
        const presentDays = new Set(
          own.filter((mark) => mark.status === 'present' || mark.status === 'late').map((mark) => mark.lesson_date),
        );
        return {
          child_id: student.id,
          full_name: student.full_name,
          present: count('present'),
          late: count('late'),
          absent_excused: count('absent_excused'),
          absent_unexcused: count('absent_unexcused'),
          absent_days: absentDays.size,
          notice_days: noticeDays.size,
          // Vắng trong tiết mà không có báo vắng của ngày; có báo vắng mà vẫn có mặt ở tiết nào đó trong ngày
          absent_without_notice_days: [...absentDays].filter((day) => !noticeDays.has(day)).length,
          notice_but_present_days: [...noticeDays].filter((day) => presentDays.has(day)).length,
          daily_absent_days: daily.filter((row) => row.child_id === student.id && row.status.startsWith('absent'))
            .length,
        };
      }),
    };
  }

  // Điểm danh theo tiết của con trong một tháng (ứng dụng phụ huynh): các tiết không có mặt kèm số tiết theo trạng thái
  async childMonth(currentUser: CurrentUser, childId: string, month: string) {
    const { database } = await this.currentSchoolYear.require();
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian && !this.timetables.isStaffViewer(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của học sinh hoặc nhân sự xem được điểm danh này');
    }
    const from = `${month}-01`;
    const to = addDays(addDays(`${month}-01`, 31).slice(0, 8) + '01', -1);
    const rows = await database
      .selectFrom('period_attendance')
      .innerJoin('class_logs', 'class_logs.id', 'period_attendance.class_log_id')
      .innerJoin('subjects', 'subjects.id', 'class_logs.subject_id')
      .select([
        'class_logs.lesson_date',
        'class_logs.period_no',
        'subjects.name as subject_name',
        'period_attendance.status',
        'period_attendance.note',
      ])
      .where('period_attendance.child_id', '=', childId)
      .where('class_logs.lesson_date', '>=', from)
      .where('class_logs.lesson_date', '<=', to)
      .orderBy('class_logs.lesson_date')
      .orderBy('class_logs.period_no')
      .execute();
    const counts = Object.fromEntries(
      STATUSES.map((status) => [status, rows.filter((row) => row.status === status).length]),
    );
    return { month, counts, records: rows.filter((row) => row.status !== 'present') };
  }

  // Quy tắc xếp loại tiết của các cấp phổ thông (21d)
  async settings() {
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('class_log_settings')
      .select([
        'school_level',
        'rating_mode',
        'rating_labels',
        'low_rating_comment',
        'conduct_points',
        'updated_by_name',
        'updated_at',
      ])
      .orderBy('school_level')
      .execute();
  }

  async saveSettings(
    currentUser: CurrentUser,
    level: SchoolLevelCode,
    input: LessonRatingSettings,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('class_log_settings')
        .selectAll()
        .where('school_level', '=', level)
        .executeTakeFirst();
      const values = {
        rating_mode: input.rating_mode,
        rating_labels: JSON.stringify(input.rating_labels),
        low_rating_comment: input.low_rating_comment,
        conduct_points: input.conduct_points ? JSON.stringify(input.conduct_points) : null,
        updated_by_name: currentUser.description.full_name,
        updated_at: this.clock.now(),
      };
      const saved = await transaction
        .insertInto('class_log_settings')
        .values({ school_level: level, ...values })
        .onConflict((conflict) => conflict.column('school_level').doUpdateSet(values))
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'class_log_settings',
        entityId: '00000000-0000-0000-0000-000000000001',
        action: before ? 'update' : 'create',
        before: before ?? null,
        after: saved,
      });
      return saved;
    });
  }

  // Sổ đầu bài một tuần của lớp ra Excel, PDF: mỗi tiết, mỗi nhóm một dòng; ghi nhật ký xuất như các báo cáo khác
  async exportWeek(currentUser: CurrentUser, classId: string, date: string, format: 'xlsx' | 'pdf', ip: string | null) {
    const week = await this.week(currentUser, classId, date);
    const { database } = await this.currentSchoolYear.require();
    const settings = await readRatingSettings(database, week.class.school_level as SchoolLevelCode);
    const logs = week.days.flatMap((day) => day.lessons.map((lesson) => ({ day, lesson })));
    const now = this.clock.now();
    const dateText = (value: string) => value.split('-').reverse().join('/');
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'class-log-week',
      fileName: `so-dau-bai-${week.week_start}-${fileStamp(now)}`,
      filters: { class_id: classId, week_start: week.week_start },
      orgUnitIds: [week.class.org_unit_id],
      sheets: [
        {
          title: 'Sổ đầu bài',
          heading: [
            `Sổ đầu bài ${week.class.name}, tuần từ ${dateText(week.week_start)}`,
            week.review
              ? `Ban giám hiệu ký: ${week.review.reviewer_name}${week.review.comment ? `. ${week.review.comment}` : ''}`
              : 'Ban giám hiệu chưa ký sổ tuần này',
          ],
          columns: [
            { key: 'date', label: 'Ngày', width: 12 },
            { key: 'period', label: 'Tiết', width: 6 },
            { key: 'subject', label: 'Môn', width: 18 },
            { key: 'title', label: 'Tên bài', width: 32 },
            { key: 'absent', label: 'Vắng', width: 7 },
            { key: 'late', label: 'Muộn', width: 7 },
            { key: 'comment', label: 'Nhận xét', width: 30 },
            { key: 'rating', label: 'Xếp loại', width: 12 },
            { key: 'teacher', label: 'Giáo viên', width: 20 },
            { key: 'status', label: 'Ký', width: 10 },
          ],
          rows: logs.map(({ day, lesson }) => ({
            date: dateText(day.date),
            period: lesson.group_no > 0 ? `${lesson.period_no} (N${lesson.group_no})` : lesson.period_no,
            subject: lesson.subject_name ?? '',
            title: lesson.log?.lesson_title ?? 'Chưa ghi',
            absent: lesson.log ? lesson.absent_count : '',
            late: lesson.log ? lesson.late_count : '',
            comment: lesson.log?.comment ?? '',
            rating: lesson.log?.rating
              ? `${lesson.log.rating} (${settings.rating_labels[lesson.log.rating as LessonRating]})`
              : '',
            teacher: lesson.teacher_name ?? '',
            status: lesson.log?.status === 'signed' ? 'Đã ký' : '',
          })),
        },
      ],
      ipAddress: ip,
      createdAt: now,
      format,
    });
  }
}

export function parseRatingSettings(body: RequestBody): { level: SchoolLevelCode; settings: LessonRatingSettings } {
  const errors: FieldError[] = [];
  const level = readSchoolLevel(body, 'school_level', errors);
  if (!level || level === 'MN') {
    errors.push({ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' });
  }
  const mode = body?.rating_mode as LessonRatingRule;
  if (!(mode in LESSON_RATING_RULE_LABELS)) {
    errors.push({ field: 'rating_mode', message: 'Quy tắc là off, optional hoặc required' });
  }
  const rawLabels = (
    typeof body?.rating_labels === 'object' && body.rating_labels !== null ? body.rating_labels : {}
  ) as Record<string, unknown> | undefined;
  const labels = {} as Record<LessonRating, string>;
  for (const code of LESSON_RATINGS) {
    const text = typeof rawLabels?.[code] === 'string' ? (rawLabels[code] as string).trim() : '';
    if (text === '' || text.length > 50) {
      errors.push({ field: `rating_labels.${code}`, message: 'Nhãn xếp loại từ 1 đến 50 ký tự' });
    }
    labels[code] = text;
  }
  let points: Record<LessonRating, number> | null = null;
  if (body?.conduct_points !== undefined && body.conduct_points !== null) {
    const raw = (typeof body.conduct_points === 'object' ? body.conduct_points : {}) as Record<string, unknown>;
    points = {} as Record<LessonRating, number>;
    for (const code of LESSON_RATINGS) {
      const value = raw[code];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < -20 || value > 20) {
        errors.push({ field: `conduct_points.${code}`, message: 'Điểm thi đua mỗi tiết là số nguyên từ -20 đến 20' });
      }
      points[code] = value as number;
    }
  }
  if (typeof body?.low_rating_comment !== 'boolean') {
    errors.push({ field: 'low_rating_comment', message: 'Bắt buộc chọn có hoặc không' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    level: level as SchoolLevelCode,
    settings: {
      rating_mode: mode,
      rating_labels: labels,
      low_rating_comment: body?.low_rating_comment as boolean,
      conduct_points: points,
    },
  };
}

function readDateQuery(value: unknown, field: string, fallback?: string): string {
  if (value === undefined && fallback) {
    return fallback;
  }
  if (!isDate(value)) {
    throw validationError([{ field, message: 'Ngày dạng YYYY-MM-DD' }]);
  }
  return value;
}

const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

@Controller('class-logs')
export class ClassLogsController {
  constructor(private readonly classLogs: ClassLogsService) {}

  @Get('week')
  week(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.class_id)) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp' }]);
    }
    return this.classLogs.week(currentUser, query.class_id, readDateQuery(query.date, 'date', todayInVietnam()));
  }

  @Get('week/export')
  async exportWeek(
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const format = readTableFileFormat(query.format ?? 'xlsx');
    if (!isUuid(query.class_id) || !format) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp; định dạng là xlsx hoặc pdf' }]);
    }
    sendWorkbook(
      response,
      await this.classLogs.exportWeek(
        currentUser,
        query.class_id,
        readDateQuery(query.date, 'date', todayInVietnam()),
        format,
        request.ip ?? null,
      ),
    );
  }

  @Get('settings')
  settings() {
    return this.classLogs.settings();
  }

  @Put('settings')
  @RequirePermission(PERMISSION_CODES.classLogSettings)
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const { level, settings } = parseRatingSettings(body);
    return this.classLogs.saveSettings(currentUser, level, settings, originOf(request, currentUser));
  }

  @Get('mine')
  mine(@Query('date') date: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.classLogs.mine(currentUser, readDateQuery(date, 'date', todayInVietnam()));
  }

  @Get('lesson')
  detail(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const period = Number(query.period_no);
    if (!isUuid(query.class_id) || !Number.isInteger(period) || period < 1 || period > 15) {
      throw validationError([{ field: 'period_no', message: 'Bắt buộc chọn lớp và tiết' }]);
    }
    const errors: FieldError[] = [];
    const group = readGroupNo(query.group_no, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classLogs.detail(currentUser, query.class_id, readDateQuery(query.date, 'date'), period, group);
  }

  @Put()
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.classLogs.save(currentUser, parseClassLogInput(body), originOf(request, currentUser));
  }

  @Post(':id/sign')
  @HttpCode(200)
  sign(
    @Param('id', uuidParameter('Mã tiết không hợp lệ')) logId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.classLogs.sign(currentUser, logId, originOf(request, currentUser));
  }

  @Post('reviews')
  @HttpCode(201)
  @RequirePermission(PERMISSION_CODES.classLogReview)
  signWeek(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.class_id)) {
      errors.push({ field: 'class_id', message: 'Bắt buộc chọn lớp' });
    }
    if (!isDate(body?.date)) {
      errors.push({ field: 'date', message: 'Ngày trong tuần dạng YYYY-MM-DD' });
    }
    const comment = readOptionalText(body, 'comment', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.classLogs.signWeek(
      currentUser,
      body?.class_id as string,
      body?.date as string,
      comment,
      originOf(request, currentUser),
    );
  }
}

@Controller('period-attendance')
export class PeriodAttendanceController {
  constructor(private readonly classLogs: ClassLogsService) {}

  @Get('summary')
  summary(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.class_id)) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp' }]);
    }
    const from = readDateQuery(query.from, 'from');
    const to = readDateQuery(query.to, 'to');
    if (to < from) {
      throw validationError([{ field: 'to', message: 'Ngày kết thúc trước ngày bắt đầu' }]);
    }
    return this.classLogs.summary(currentUser, query.class_id, from, to);
  }
}

@Controller('children/:id/period-attendance')
export class ChildPeriodAttendanceController {
  constructor(private readonly classLogs: ClassLogsService) {}

  @Get()
  read(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Query('month') month: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const value = month ?? todayInVietnam().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
      throw validationError([{ field: 'month', message: 'Tháng dạng YYYY-MM' }]);
    }
    return this.classLogs.childMonth(currentUser, childId, value);
  }
}
