import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { isSchoolLevelCode, PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { readSchoolLevel } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredText,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildTemplate, MAXIMUM_IMPORT_BYTES, readSheet, type ImportColumn, type RowError } from '../imports/excel.js';
import { findTimetableConflicts, type TimetableConflict, type TimetableLessonInput } from './timetable-rules.js';

// Thời khoá biểu phần khung (DT-20 phần 22c1, YCTD-160): khung giờ tiết học theo cấp (cơ sở dữ liệu hệ thống), bản thời khoá
// biểu theo cấp có ngày áp dụng, tiết của lớp (môn, giáo viên theo phân công của 20a, phòng), nhập Excel, kiểm tra xung đột,
// ban hành; xem theo lớp, giáo viên, phòng; lịch dạy của giáo viên; thời khoá biểu của con. Máy xếp tự động là 22c2, ghi kết
// quả vào bản nháp như nhập Excel. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giáo viên của tiết luôn lấy theo
// phân công môn ở lớp (đổi giáo viên ở 7.2); bản đã ban hành chỉ đọc; ban hành bị chặn khi còn xung đột cứng
export const TIMETABLE_RULE_CODE = 'YCTD-160';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const MANAGE = PERMISSION_CODES.timetableManage;
const VIEW_PERMISSIONS = ['P02.view', 'P02.edit', PERMISSION_CODES.classManage, MANAGE];
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const VERSION_COLUMNS = [
  'id',
  'school_level',
  'name',
  'effective_from',
  'status',
  'source',
  'note',
  'published_at',
  'published_by_name',
  'updated_at',
] as const;

export interface PeriodSlotInput {
  period_no: number;
  session: 'morning' | 'afternoon';
  start_time: string;
  end_time: string;
}

export interface LessonCellInput {
  weekday: number;
  period_no: number;
  subject_id: string;
  room_id: string | null;
}

export function parsePeriodSlots(body: RequestBody): PeriodSlotInput[] {
  const raw = body?.slots;
  if (!Array.isArray(raw)) {
    throw validationError([{ field: 'slots', message: 'Cần danh sách tiết' }]);
  }
  const errors: FieldError[] = [];
  const seen = new Set<number>();
  const slots = raw.map((value, index) => {
    const prefix = `slots[${index}]`;
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const periodNo = item.period_no;
    if (typeof periodNo !== 'number' || !Number.isInteger(periodNo) || periodNo < 1 || periodNo > 15) {
      errors.push({ field: `${prefix}.period_no`, message: 'Tiết là số nguyên từ 1 đến 15' });
    } else if (seen.has(periodNo)) {
      errors.push({ field: `${prefix}.period_no`, message: 'Tiết bị trùng' });
    }
    seen.add(periodNo as number);
    if (item.session !== 'morning' && item.session !== 'afternoon') {
      errors.push({ field: `${prefix}.session`, message: 'Buổi là morning hoặc afternoon' });
    }
    const start = typeof item.start_time === 'string' ? item.start_time : '';
    const end = typeof item.end_time === 'string' ? item.end_time : '';
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || end <= start) {
      errors.push({ field: `${prefix}.end_time`, message: 'Giờ dạng HH:MM, giờ kết thúc sau giờ bắt đầu' });
    }
    return {
      period_no: periodNo as number,
      session: item.session as PeriodSlotInput['session'],
      start_time: start,
      end_time: end,
    };
  });
  // Tiết sau bắt đầu không sớm hơn tiết trước kết thúc
  const ordered = [...slots].sort((left, right) => left.period_no - right.period_no);
  ordered.forEach((slot, index) => {
    const previous = ordered[index - 1];
    if (previous && slot.start_time < previous.end_time) {
      errors.push({
        field: 'slots',
        message: `Tiết ${slot.period_no} bắt đầu trước khi tiết ${previous.period_no} kết thúc`,
      });
    }
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return ordered;
}

export function parseLessonCells(body: RequestBody): LessonCellInput[] {
  const raw = body?.lessons;
  if (!Array.isArray(raw)) {
    throw validationError([{ field: 'lessons', message: 'Cần danh sách tiết của lớp' }]);
  }
  const errors: FieldError[] = [];
  const seen = new Set<string>();
  const cells = raw.map((value, index) => {
    const prefix = `lessons[${index}]`;
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const weekday = item.weekday;
    const periodNo = item.period_no;
    if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      errors.push({ field: `${prefix}.weekday`, message: 'Thứ là số nguyên từ 1 (thứ Hai) đến 7 (Chủ nhật)' });
    }
    if (typeof periodNo !== 'number' || !Number.isInteger(periodNo) || periodNo < 1 || periodNo > 15) {
      errors.push({ field: `${prefix}.period_no`, message: 'Tiết là số nguyên từ 1 đến 15' });
    }
    const key = `${String(weekday)}:${String(periodNo)}`;
    if (seen.has(key)) {
      errors.push({ field: `${prefix}.period_no`, message: 'Một tiết của lớp chỉ một môn' });
    }
    seen.add(key);
    if (!isUuid(item.subject_id)) {
      errors.push({ field: `${prefix}.subject_id`, message: 'Bắt buộc chọn môn' });
    }
    if (item.room_id !== undefined && item.room_id !== null && !isUuid(item.room_id)) {
      errors.push({ field: `${prefix}.room_id`, message: 'Mã phòng không hợp lệ' });
    }
    return {
      weekday: weekday as number,
      period_no: periodNo as number,
      subject_id: item.subject_id as string,
      room_id: (item.room_id as string | null | undefined) ?? null,
    };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return cells;
}

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'class_code', header: 'Mã lớp', note: 'Mã lớp của cấp của bản thời khoá biểu' },
  { key: 'weekday', header: 'Thứ', note: 'Số từ 2 (thứ Hai) đến 7 (thứ Bảy), CN là Chủ nhật' },
  { key: 'period_no', header: 'Tiết', note: 'Số tiết trong ngày theo khung giờ tiết học (1 đến 15)' },
  { key: 'subject_code', header: 'Mã môn', note: 'Mã môn ở 7.1 Môn học và hoạt động giáo dục' },
  {
    key: 'room_code',
    header: 'Mã phòng',
    note: 'Mã phòng ở danh mục phòng của đơn vị của lớp; để trống nếu không xếp phòng',
  },
];

// Thứ trong tệp ghi theo cách gọi thông thường (2 là thứ Hai ... 7 là thứ Bảy, CN hoặc 8 là Chủ nhật) đổi sang ISO
export function readWeekdayText(text: string): number | null {
  const value = text.trim().toUpperCase();
  if (value === 'CN' || value === '8') {
    return 7;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 2 && number <= 7 ? number - 1 : null;
}

@Injectable()
export class TimetablesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  assertCanView(currentUser: CurrentUser) {
    if (!VIEW_PERMISSIONS.some((code) => currentUser.hasPermission(code))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được thời khoá biểu');
    }
  }

  // Khung giờ tiết học của cấp ở năm học đang dùng
  async periodSlots(level: SchoolLevelCode) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return this.databases.system
      .selectFrom('period_slots')
      .select(['period_no', 'session', 'start_time', 'end_time'])
      .where('academic_year_id', '=', current.academicYearId)
      .where('school_level', '=', level)
      .orderBy('period_no')
      .execute();
  }

  async replacePeriodSlots(level: SchoolLevelCode, slots: PeriodSlotInput[], origin: ChangeOrigin) {
    const current = await this.currentSchoolYear.require();
    const before = await this.periodSlots(level);
    await this.databases.system.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('period_slots')
        .where('academic_year_id', '=', current.academicYearId)
        .where('school_level', '=', level)
        .execute();
      if (slots.length > 0) {
        await transaction
          .insertInto('period_slots')
          .values(
            slots.map((slot) => ({
              ...slot,
              academic_year_id: current.academicYearId,
              school_level: level,
              created_by: origin.actorUserId,
            })),
          )
          .execute();
      }
    });
    const after = await this.periodSlots(level);
    await writeAuditLog(current.database, {
      origin,
      orgUnitId: null,
      entityName: 'period_slots',
      entityId: current.academicYearId,
      action: 'update',
      before: { school_level: level, slots: before },
      after: { school_level: level, slots: after },
    });
    return after;
  }

  private async schoolDays(level: SchoolLevelCode): Promise<number[]> {
    const current = await this.currentSchoolYear.require();
    const levelDays = await this.databases.system
      .selectFrom('academic_year_level_settings')
      .select('school_days_of_week')
      .where('academic_year_id', '=', current.academicYearId)
      .where('school_level', '=', level)
      .executeTakeFirst();
    if (levelDays) {
      return levelDays.school_days_of_week;
    }
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select('school_days_of_week')
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    return year.school_days_of_week;
  }

  async listVersions(level?: SchoolLevelCode) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('timetable_versions').select(VERSION_COLUMNS);
    if (level) {
      query = query.where('school_level', '=', level);
    }
    const versions = await query.orderBy('effective_from', 'desc').orderBy('created_at', 'desc').execute();
    const today = this.today();
    const applying = new Map<string, string>();
    for (const version of versions) {
      if (version.status === 'published' && version.effective_from <= today && !applying.has(version.school_level)) {
        applying.set(version.school_level, version.id);
      }
    }
    return versions.map((version) => ({ ...version, is_current: applying.get(version.school_level) === version.id }));
  }

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  private async findVersion(database: Executor, versionId: string) {
    const version = await database
      .selectFrom('timetable_versions')
      .select(VERSION_COLUMNS)
      .where('id', '=', versionId)
      .executeTakeFirst();
    if (!version) {
      throw notFoundError('Không tìm thấy bản thời khoá biểu', 'timetable_version');
    }
    return version;
  }

  private assertDraft(version: { status: string }) {
    if (version.status !== 'draft') {
      throw ruleViolationError(TIMETABLE_RULE_CODE, 'Bản đã ban hành chỉ đọc; tạo bản nháp mới chép từ bản này để sửa');
    }
  }

  async createVersion(
    input: { school_level: SchoolLevelCode; name: string; effective_from: string; copy_from_id: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const source = input.copy_from_id ? await this.findVersion(database, input.copy_from_id) : null;
    if (source && source.school_level !== input.school_level) {
      throw validationError([{ field: 'copy_from_id', message: 'Bản chép phải cùng cấp' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('timetable_versions')
        .values({
          school_level: input.school_level,
          name: input.name,
          effective_from: input.effective_from,
          created_by: origin.actorUserId,
        })
        .returning(VERSION_COLUMNS)
        .executeTakeFirstOrThrow();
      if (source) {
        const lessons = await transaction
          .selectFrom('timetable_lessons')
          .select(['class_id', 'weekday', 'period_no', 'subject_id', 'teacher_user_id', 'teacher_name', 'room_id'])
          .where('version_id', '=', source.id)
          .execute();
        if (lessons.length > 0) {
          await transaction
            .insertInto('timetable_lessons')
            .values(lessons.map((lesson) => ({ ...lesson, version_id: created.id })))
            .execute();
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_versions',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { ...created, copy_from_id: input.copy_from_id },
      });
      return created;
    });
  }

  async updateVersion(
    versionId: string,
    changes: { name?: string; effective_from?: string; note?: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findVersion(database, versionId);
    this.assertDraft(existing);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('timetable_versions')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', versionId)
        .returning(VERSION_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_versions',
        entityId: versionId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async deleteVersion(versionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findVersion(database, versionId);
    this.assertDraft(existing);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('timetable_versions').where('id', '=', versionId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_versions',
        entityId: versionId,
        action: 'delete',
        before: existing,
        after: null,
      });
    });
  }

  // Tiết của một bản kèm tên lớp, môn, phòng; lọc theo lớp, giáo viên, phòng
  async lessons(
    database: Executor,
    versionIds: string[],
    filter: { classId?: string; teacherUserId?: string; roomId?: string } = {},
  ) {
    if (versionIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('timetable_lessons')
      .innerJoin('classes', 'classes.id', 'timetable_lessons.class_id')
      .innerJoin('subjects', 'subjects.id', 'timetable_lessons.subject_id')
      .leftJoin('rooms', 'rooms.id', 'timetable_lessons.room_id')
      .select([
        'timetable_lessons.id',
        'timetable_lessons.version_id',
        'timetable_lessons.class_id',
        'classes.name as class_name',
        'classes.org_unit_id',
        'timetable_lessons.weekday',
        'timetable_lessons.period_no',
        'timetable_lessons.subject_id',
        'subjects.code as subject_code',
        'subjects.name as subject_name',
        'timetable_lessons.teacher_user_id',
        'timetable_lessons.teacher_name',
        'timetable_lessons.room_id',
        'rooms.name as room_name',
      ])
      .where('timetable_lessons.version_id', 'in', versionIds);
    if (filter.classId) {
      query = query.where('timetable_lessons.class_id', '=', filter.classId);
    }
    if (filter.teacherUserId) {
      query = query.where('timetable_lessons.teacher_user_id', '=', filter.teacherUserId);
    }
    if (filter.roomId) {
      query = query.where('timetable_lessons.room_id', '=', filter.roomId);
    }
    return query
      .orderBy('timetable_lessons.weekday')
      .orderBy('timetable_lessons.period_no')
      .orderBy('classes.name')
      .execute();
  }

  async versionLessons(versionId: string, filter: { classId?: string; teacherUserId?: string; roomId?: string }) {
    const { database } = await this.currentSchoolYear.require();
    const version = await this.findVersion(database, versionId);
    return {
      version,
      slots: await this.periodSlots(version.school_level),
      lessons: await this.lessons(database, [versionId], filter),
    };
  }

  // Giáo viên của môn ở lớp theo phân công giảng dạy theo môn (20a) đang hiệu lực
  private async assignedTeachers(database: Executor, classIds: string[]) {
    if (classIds.length === 0) {
      return new Map<string, { staff_user_id: string; staff_name: string }>();
    }
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select(['class_id', 'subject_id', 'staff_user_id', 'staff_name'])
      .where('class_id', 'in', classIds)
      .where('status', '=', 'active')
      .where('subject_id', 'is not', null)
      .execute();
    return new Map(rows.map((row) => [`${row.class_id}:${row.subject_id}`, row]));
  }

  // Thay mọi tiết của một lớp trong bản nháp; giáo viên lấy theo phân công môn ở lớp; phòng phải thuộc đơn vị của lớp
  async replaceClassLessons(versionId: string, classId: string, cells: LessonCellInput[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const version = await this.findVersion(database, versionId);
    this.assertDraft(version);
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'school_level'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    if (classRow.school_level !== version.school_level) {
      throw ruleViolationError(TIMETABLE_RULE_CODE, 'Lớp không cùng cấp với bản thời khoá biểu');
    }
    await this.assertCells(database, version.school_level, classRow.org_unit_id, cells);
    const teachers = await this.assignedTeachers(database, [classId]);
    return database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('timetable_lessons')
        .where('version_id', '=', versionId)
        .where('class_id', '=', classId)
        .execute();
      if (cells.length > 0) {
        await transaction
          .insertInto('timetable_lessons')
          .values(
            cells.map((cell) => {
              const teacher = teachers.get(`${classId}:${cell.subject_id}`);
              return {
                ...cell,
                version_id: versionId,
                class_id: classId,
                teacher_user_id: teacher?.staff_user_id ?? null,
                teacher_name: teacher?.staff_name ?? null,
              };
            }),
          )
          .execute();
      }
      await transaction
        .updateTable('timetable_versions')
        .set({ updated_at: this.clock.now() })
        .where('id', '=', versionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'timetable_lessons',
        entityId: versionId,
        action: 'update',
        before: null,
        after: { class_id: classId, lessons: cells },
      });
      return this.lessons(transaction, [versionId], { classId });
    });
  }

  private async assertCells(database: Executor, level: SchoolLevelCode, orgUnitId: string, cells: LessonCellInput[]) {
    const subjectIds = [...new Set(cells.map((cell) => cell.subject_id))];
    const subjects = subjectIds.length
      ? await database.selectFrom('subjects').select(['id', 'school_level']).where('id', 'in', subjectIds).execute()
      : [];
    const roomIds = [...new Set(cells.map((cell) => cell.room_id).filter((id): id is string => id !== null))];
    const rooms = roomIds.length
      ? await database.selectFrom('rooms').select(['id', 'org_unit_id']).where('id', 'in', roomIds).execute()
      : [];
    const errors: FieldError[] = [];
    cells.forEach((cell, index) => {
      if (subjects.find((subject) => subject.id === cell.subject_id)?.school_level !== level) {
        errors.push({ field: `lessons[${index}].subject_id`, message: 'Môn không có hoặc không cùng cấp' });
      }
      if (cell.room_id && rooms.find((room) => room.id === cell.room_id)?.org_unit_id !== orgUnitId) {
        errors.push({ field: `lessons[${index}].room_id`, message: 'Phòng không thuộc đơn vị của lớp' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  // Xung đột của một bản (cứng chặn ban hành, mềm cảnh báo)
  async conflicts(versionId: string): Promise<TimetableConflict[]> {
    const { database } = await this.currentSchoolYear.require();
    const version = await this.findVersion(database, versionId);
    return this.conflictsOf(database, version.id, version.school_level);
  }

  private async conflictsOf(database: Executor, versionId: string, level: SchoolLevelCode) {
    const lessons = await this.lessons(database, [versionId]);
    const classIds = [...new Set(lessons.map((lesson) => lesson.class_id))];
    const classes = classIds.length
      ? await database
          .selectFrom('classes')
          .select(['id', 'grade_level', 'curriculum_id'])
          .where('id', 'in', classIds)
          .execute()
      : [];
    const defaultCurriculum = await database
      .selectFrom('curricula')
      .select('id')
      .where('school_level', '=', level)
      .where('is_default', '=', true)
      .executeTakeFirst();
    const curriculumIds = [
      ...new Set(classes.map((row) => row.curriculum_id ?? defaultCurriculum?.id).filter((id): id is string => !!id)),
    ];
    const planRows = curriculumIds.length
      ? await database
          .selectFrom('curriculum_subjects')
          .innerJoin('subjects', 'subjects.id', 'curriculum_subjects.subject_id')
          .select([
            'curriculum_subjects.curriculum_id',
            'curriculum_subjects.grade_level_code',
            'curriculum_subjects.subject_id',
            'curriculum_subjects.periods_per_week',
            'subjects.name',
          ])
          .where('curriculum_subjects.curriculum_id', 'in', curriculumIds)
          .execute()
      : [];
    const planned = new Map<string, Map<string, { subject_name: string; periods: number }>>();
    for (const classRow of classes) {
      const curriculumId = classRow.curriculum_id ?? defaultCurriculum?.id;
      planned.set(
        classRow.id,
        new Map(
          planRows
            .filter((row) => row.curriculum_id === curriculumId && row.grade_level_code === classRow.grade_level)
            .map((row) => [row.subject_id, { subject_name: row.name, periods: Number(row.periods_per_week) }]),
        ),
      );
    }
    const assigned = await this.assignedTeachers(database, classIds);
    const inputs: TimetableLessonInput[] = lessons.map((lesson) => ({
      class_id: lesson.class_id,
      class_name: lesson.class_name,
      weekday: lesson.weekday,
      period_no: lesson.period_no,
      subject_id: lesson.subject_id,
      subject_name: lesson.subject_name,
      teacher_user_id: lesson.teacher_user_id,
      teacher_name: lesson.teacher_name,
      room_id: lesson.room_id,
      room_name: lesson.room_name,
    }));
    return findTimetableConflicts(inputs, {
      periods: (await this.periodSlots(level)).map((slot) => slot.period_no),
      school_days: await this.schoolDays(level),
      planned,
      assigned: new Map([...assigned].map(([key, value]) => [key, value.staff_user_id])),
    });
  }

  async publish(currentUser: CurrentUser, versionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const version = await this.findVersion(database, versionId);
    this.assertDraft(version);
    const lessonCount = await database
      .selectFrom('timetable_lessons')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('version_id', '=', versionId)
      .executeTakeFirstOrThrow();
    if (Number(lessonCount.count) === 0) {
      throw ruleViolationError(TIMETABLE_RULE_CODE, 'Bản thời khoá biểu chưa có tiết nào');
    }
    const hard = (await this.conflictsOf(database, versionId, version.school_level)).filter(
      (conflict) => conflict.severity === 'hard',
    );
    if (hard.length > 0) {
      throw ruleViolationError(
        TIMETABLE_RULE_CODE,
        `Còn ${hard.length} xung đột phải sửa trước khi ban hành`,
        hard.slice(0, 50).map((conflict) => ({ field: conflict.code, message: conflict.message })),
      );
    }
    return database.transaction().execute(async (transaction) => {
      const published = await transaction
        .updateTable('timetable_versions')
        .set({
          status: 'published',
          published_at: this.clock.now(),
          published_by: currentUser.id,
          published_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', versionId)
        .returning(VERSION_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_versions',
        entityId: versionId,
        action: 'update',
        before: { status: version.status },
        after: { status: 'published' },
      });
      return published;
    });
  }

  // Bản đang áp dụng của các cấp vào một ngày: bản đã ban hành có ngày áp dụng gần nhất không sau ngày đó
  async applyingVersions(database: Executor, date: string, level?: SchoolLevelCode) {
    let query = database
      .selectFrom('timetable_versions')
      .select(['id', 'school_level', 'name', 'effective_from'])
      .where('status', '=', 'published')
      .where('effective_from', '<=', date);
    if (level) {
      query = query.where('school_level', '=', level);
    }
    const rows = await query.orderBy('effective_from', 'desc').orderBy('published_at', 'desc').execute();
    const byLevel = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!byLevel.has(row.school_level)) {
        byLevel.set(row.school_level, row);
      }
    }
    return [...byLevel.values()];
  }

  // Xem bản đang áp dụng theo lớp, giáo viên hoặc phòng (nhân sự), lịch dạy của tôi (giáo viên), thời khoá biểu của con
  async view(filter: { classId?: string; teacherUserId?: string; roomId?: string; date?: string }) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { versions: [], slots: {}, lessons: [] };
    }
    const versions = await this.applyingVersions(current.database, filter.date ?? this.today());
    const lessons = await this.lessons(
      current.database,
      versions.map((version) => version.id),
      filter,
    );
    const slots: Record<string, Awaited<ReturnType<TimetablesService['periodSlots']>>> = {};
    for (const version of versions) {
      slots[version.school_level] = await this.periodSlots(version.school_level as SchoolLevelCode);
    }
    return { versions, slots, lessons };
  }

  async childTimetable(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .innerJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select(['children.id', 'class_enrollments.class_id'])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian && !VIEW_PERMISSIONS.some((code) => currentUser.hasPermission(code))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ phụ huynh của học sinh hoặc nhân sự xem được thời khoá biểu này',
      );
    }
    if (!child) {
      return { versions: [], slots: {}, lessons: [] };
    }
    return this.view({ classId: child.class_id });
  }

  // Tệp mẫu nhập thời khoá biểu kèm danh mục lớp, môn, phòng của cấp
  async importTemplate(versionId: string): Promise<Buffer> {
    const { database } = await this.currentSchoolYear.require();
    const version = await this.findVersion(database, versionId);
    const [classes, subjects, rooms] = await Promise.all([
      database
        .selectFrom('classes')
        .select(['code', 'name'])
        .where('school_level', '=', version.school_level)
        .where('status', '=', 'active')
        .orderBy('code')
        .execute(),
      database
        .selectFrom('subjects')
        .select(['code', 'name'])
        .where('school_level', '=', version.school_level)
        .where('status', '=', 'active')
        .orderBy('order_no')
        .execute(),
      database.selectFrom('rooms').select(['code', 'name']).where('status', '=', 'active').orderBy('code').execute(),
    ]);
    return buildTemplate('Thời khoá biểu', IMPORT_COLUMNS, {
      catalogs: [
        { key: 'classes', title: 'Lớp', column: 'Mã lớp', items: classes },
        { key: 'subjects', title: 'Môn học', column: 'Mã môn', items: subjects },
        { key: 'rooms', title: 'Phòng', column: 'Mã phòng', items: rooms },
      ],
    });
  }

  // Nhập Excel vào bản nháp: mọi dòng hợp lệ mới ghi; lớp có trong tệp thay toàn bộ tiết của lớp đó, lớp không có giữ nguyên
  async importLessons(versionId: string, body: Buffer, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const version = await this.findVersion(database, versionId);
    this.assertDraft(version);
    const rows = await readSheet(body, IMPORT_COLUMNS);
    const [classes, subjects, rooms] = await Promise.all([
      database
        .selectFrom('classes')
        .select(['id', 'code', 'org_unit_id'])
        .where('school_level', '=', version.school_level)
        .execute(),
      database
        .selectFrom('subjects')
        .select(['id', 'code'])
        .where('school_level', '=', version.school_level)
        .where('status', '=', 'active')
        .execute(),
      database.selectFrom('rooms').select(['id', 'code', 'org_unit_id']).where('status', '=', 'active').execute(),
    ]);
    const errors: RowError[] = [];
    const byClass = new Map<string, LessonCellInput[]>();
    const seen = new Set<string>();
    for (const row of rows) {
      const values = row.values;
      const classRow = classes.find((item) => item.code === values.class_code?.trim());
      const weekday = readWeekdayText(values.weekday ?? '');
      const periodNo = Number(values.period_no);
      const subject = subjects.find((item) => item.code === values.subject_code?.trim());
      const roomCode = values.room_code?.trim() ?? '';
      const room = roomCode
        ? rooms.find((item) => item.code === roomCode && item.org_unit_id === classRow?.org_unit_id)
        : undefined;
      if (!classRow) {
        errors.push({ row: row.row, column: 'Mã lớp', message: 'Không có lớp này ở cấp của bản thời khoá biểu' });
      }
      if (weekday === null) {
        errors.push({ row: row.row, column: 'Thứ', message: 'Thứ là 2 đến 7 hoặc CN' });
      }
      if (!Number.isInteger(periodNo) || periodNo < 1 || periodNo > 15) {
        errors.push({ row: row.row, column: 'Tiết', message: 'Tiết là số nguyên từ 1 đến 15' });
      }
      if (!subject) {
        errors.push({ row: row.row, column: 'Mã môn', message: 'Không có môn này hoặc môn đã ngừng dùng' });
      }
      if (roomCode && !room) {
        errors.push({ row: row.row, column: 'Mã phòng', message: 'Không có phòng này ở đơn vị của lớp' });
      }
      if (!classRow || weekday === null || !subject || (roomCode && !room) || !Number.isInteger(periodNo)) {
        continue;
      }
      const key = `${classRow.id}:${weekday}:${periodNo}`;
      if (seen.has(key)) {
        errors.push({ row: row.row, column: 'Tiết', message: 'Lớp đã có môn ở tiết này trong tệp' });
        continue;
      }
      seen.add(key);
      byClass.set(classRow.id, [
        ...(byClass.get(classRow.id) ?? []),
        { weekday, period_no: periodNo, subject_id: subject.id, room_id: room?.id ?? null },
      ]);
    }
    if (errors.length > 0) {
      return { imported: 0, classes: 0, errors };
    }
    const teachers = await this.assignedTeachers(database, [...byClass.keys()]);
    await database.transaction().execute(async (transaction) => {
      for (const [classId, cells] of byClass) {
        await transaction
          .deleteFrom('timetable_lessons')
          .where('version_id', '=', versionId)
          .where('class_id', '=', classId)
          .execute();
        await transaction
          .insertInto('timetable_lessons')
          .values(
            cells.map((cell) => {
              const teacher = teachers.get(`${classId}:${cell.subject_id}`);
              return {
                ...cell,
                version_id: versionId,
                class_id: classId,
                teacher_user_id: teacher?.staff_user_id ?? null,
                teacher_name: teacher?.staff_name ?? null,
              };
            }),
          )
          .execute();
      }
      await transaction
        .updateTable('timetable_versions')
        .set({ source: 'import', updated_at: this.clock.now() })
        .where('id', '=', versionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'timetable_lessons',
        entityId: versionId,
        action: 'update',
        before: null,
        after: { rows: rows.length, classes: byClass.size },
      });
    });
    return { imported: rows.length, classes: byClass.size, errors: [] };
  }
}

function readLevel(value: unknown): SchoolLevelCode {
  const errors: FieldError[] = [];
  const level = readSchoolLevel({ school_level: value }, 'school_level', errors);
  if (!level) {
    throw validationError(errors.length > 0 ? errors : [{ field: 'school_level', message: 'Bắt buộc chọn cấp học' }]);
  }
  return level;
}

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | undefined {
  const value = body?.[field];
  if (value === undefined && !required) {
    return undefined;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Controller('period-slots')
export class PeriodSlotsController {
  constructor(private readonly timetables: TimetablesService) {}

  // Mọi người đã đăng nhập xem khung giờ (ứng dụng giáo viên, phụ huynh hiện giờ tiết)
  @Get()
  list(@Query('school_level') level: string | undefined) {
    return this.timetables.periodSlots(readLevel(level ?? 'TH'));
  }

  @Put()
  @RequirePermission(MANAGE)
  replace(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.timetables.replacePeriodSlots(
      readLevel(body?.school_level),
      parsePeriodSlots(body),
      originOf(request, currentUser),
    );
  }
}

@Controller('timetable-versions')
export class TimetableVersionsController {
  constructor(private readonly timetables: TimetablesService) {}

  @Get()
  list(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    this.timetables.assertCanView(currentUser);
    return this.timetables.listVersions(level === undefined ? undefined : readLevel(level));
  }

  @Post()
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const name = readRequiredText(body, 'name', errors);
    const effectiveFrom = readDate(body, 'effective_from', errors, true);
    const copyFrom = body?.copy_from_id;
    if (copyFrom !== undefined && copyFrom !== null && !isUuid(copyFrom)) {
      errors.push({ field: 'copy_from_id', message: 'Mã bản chép không hợp lệ' });
    }
    if (!isSchoolLevelCode(body?.school_level)) {
      errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.timetables.createVersion(
      {
        school_level: body?.school_level as SchoolLevelCode,
        name,
        effective_from: effectiveFrom as string,
        copy_from_id: (copyFrom as string | null | undefined) ?? null,
      },
      originOf(request, currentUser),
    );
  }

  @Patch(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      effective_from: readDate(body, 'effective_from', errors, false),
      note: readOptionalText(body, 'note', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.timetables.updateVersion(versionId, changes, originOf(request, currentUser));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async remove(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.timetables.deleteVersion(versionId, originOf(request, currentUser));
  }

  @Get(':id/lessons')
  lessons(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @Query() query: Record<string, string | undefined>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    this.timetables.assertCanView(currentUser);
    return this.timetables.versionLessons(versionId, readViewFilter(query));
  }

  @Put(':id/classes/:classId/lessons')
  @RequirePermission(MANAGE)
  replaceClassLessons(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.timetables.replaceClassLessons(
      versionId,
      classId,
      parseLessonCells(body),
      originOf(request, currentUser),
    );
  }

  @Get(':id/conflicts')
  conflicts(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    this.timetables.assertCanView(currentUser);
    return this.timetables.conflicts(versionId);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  publish(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.timetables.publish(currentUser, versionId, originOf(request, currentUser));
  }

  @Get(':id/import-template')
  @RequirePermission(MANAGE)
  async template(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @Res() response: Response,
  ) {
    const file = await this.timetables.importTemplate(versionId);
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('mau-thoi-khoa-bieu.xlsx')
      .send(file);
  }

  @Post(':id/import')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  importLessons(
    @Param('id', uuidParameter('Mã bản thời khoá biểu không hợp lệ')) versionId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.timetables.importLessons(versionId, file.buffer, originOf(request, currentUser));
  }
}

function readViewFilter(query: Record<string, string | undefined>) {
  const errors: FieldError[] = [];
  for (const field of ['class_id', 'teacher_user_id', 'room_id']) {
    if (query[field] !== undefined && !isUuid(query[field])) {
      errors.push({ field, message: 'Mã không hợp lệ' });
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { classId: query.class_id, teacherUserId: query.teacher_user_id, roomId: query.room_id };
}

@Controller('timetables')
export class TimetablesController {
  constructor(private readonly timetables: TimetablesService) {}

  // Bản đang áp dụng theo lớp, giáo viên, phòng (nhân sự xem được lớp)
  @Get()
  view(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    this.timetables.assertCanView(currentUser);
    const errors: FieldError[] = [];
    const date = readDate(query, 'date', errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.timetables.view({ ...readViewFilter(query), date });
  }

  // Lịch dạy của tôi (ứng dụng giáo viên): tiết đang áp dụng mà tôi là giáo viên
  @Get('mine')
  mine(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.timetables.view({ teacherUserId: currentUser.id });
  }
}

@Controller('children/:id/timetable')
export class ChildTimetableController {
  constructor(private readonly timetables: TimetablesService) {}

  @Get()
  read(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.timetables.childTimetable(currentUser, childId);
  }
}
