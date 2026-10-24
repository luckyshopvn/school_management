import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase, YearResultCode } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  ASSESSMENT_DEFAULTS,
  PERMISSION_CODES,
  suggestYearResult,
  type SchoolLevelCode,
} from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, notFoundError, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { readCurriculumSubjects } from '../subjects/subjects.js';
import { ASSESSMENT_RULE_CODE, readAssessmentConfig } from './assessment-config.js';

// Đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c, YCTD-161): nhận xét thường xuyên; kết quả định kỳ theo kỳ (mức
// đạt môn học, hoạt động, điểm bài kiểm tra định kỳ; mức phẩm chất, năng lực); bảng tổng hợp cuối kỳ của lớp; tổng hợp cuối
// năm (gợi ý theo Điều 9, giáo viên chủ nhiệm xác nhận); khoá số liệu theo kỳ và lớp; phụ huynh xem kết quả đã khoá.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - quyền nhập: giáo viên bộ môn được phân công môn của lớp nhập môn đó; giáo viên chủ nhiệm nhập môn chưa có giáo viên bộ
//   môn, phẩm chất, năng lực, tổng hợp cuối năm; người quản lý đánh giá nhập thay mọi lớp; giáo viên cần `P02.assessment.enter`;
// - hạn nhập là ngày ghi ở kỳ, trống thì là ngày kết thúc học kỳ của kỳ theo lịch của cấp (19b); quá hạn hoặc đã khoá thì chỉ
//   người quản lý sửa được (đã khoá thì phải mở khoá kèm lý do trước);
// - điểm bài kiểm tra là số nguyên 1 đến 10, chỉ nhập ở môn, khối có bài kiểm tra của kỳ; mức phải có ở thang của cấp
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
const YEAR_RESULTS: YearResultCode[] = ['excellent', 'good', 'completed', 'not_completed'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface ClassContext {
  id: string;
  name: string;
  org_unit_id: string;
  grade_level: string;
  school_level: SchoolLevelCode;
  curriculum_id: string | null;
}

interface Access {
  manage: boolean;
  homeroom: boolean;
  // Môn người dùng nhập được ở lớp
  subjectIds: string[];
  competency: boolean;
}

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function asText(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  private async findClass(database: Executor, classId: string): Promise<ClassContext> {
    const row = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'grade_level', 'school_level', 'curriculum_id'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return row as ClassContext;
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    if (!currentUser.hasPermission(permission)) {
      return false;
    }
    const scope = await this.organizationScopes.resolve(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  // Môn của lớp theo chương trình của lớp (trống là chương trình mặc định của cấp) và khối
  private async classSubjects(database: Executor, classRow: ClassContext) {
    const curriculum = classRow.curriculum_id
      ? { id: classRow.curriculum_id }
      : await database
          .selectFrom('curricula')
          .select('id')
          .where('school_level', '=', classRow.school_level)
          .where('is_default', '=', true)
          .executeTakeFirst();
    if (!curriculum) {
      return [];
    }
    return (await readCurriculumSubjects(database, curriculum.id)).filter(
      (row) => row.grade_level_code === classRow.grade_level,
    );
  }

  private async access(database: Executor, currentUser: CurrentUser, classRow: ClassContext): Promise<Access> {
    const subjects = await this.classSubjects(database, classRow);
    if (await this.inScope(currentUser, PERMISSION_CODES.assessmentManage, classRow.org_unit_id)) {
      return { manage: true, homeroom: false, subjectIds: subjects.map((row) => row.subject_id), competency: true };
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.assessmentEnter)) {
      return { manage: false, homeroom: false, subjectIds: [], competency: false };
    }
    const assignments = await database
      .selectFrom('class_staff_assignments')
      .select(['staff_user_id', 'assignment_role', 'subject_id'])
      .where('class_id', '=', classRow.id)
      .where('status', '=', 'active')
      .execute();
    const homeroom = assignments.some(
      (row) => row.staff_user_id === currentUser.id && row.assignment_role === 'homeroom',
    );
    const subjectIds = subjects
      .map((row) => row.subject_id)
      .filter((subjectId) => {
        const teacher = assignments.find((row) => row.subject_id === subjectId);
        return teacher ? teacher.staff_user_id === currentUser.id : homeroom;
      });
    return { manage: false, homeroom, subjectIds, competency: homeroom };
  }

  private async assertView(database: Executor, currentUser: CurrentUser, classRow: ClassContext) {
    const access = await this.access(database, currentUser, classRow);
    if (
      access.manage ||
      access.homeroom ||
      access.subjectIds.length > 0 ||
      (await this.inScope(currentUser, PERMISSION_CODES.assessmentView, classRow.org_unit_id))
    ) {
      return access;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được đánh giá của lớp này');
  }

  private async findPeriod(database: Executor, periodId: string, classRow: ClassContext) {
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'code', 'name', 'school_level', 'term_type', 'kind', 'is_year_end', 'entry_deadline'])
      .where('id', '=', periodId)
      .executeTakeFirst();
    if (!period) {
      throw notFoundError('Không tìm thấy kỳ đánh giá', 'assessment_period');
    }
    if (period.school_level !== classRow.school_level) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, 'Kỳ đánh giá không cùng cấp với lớp');
    }
    return period;
  }

  // Hạn nhập của kỳ: ngày ghi ở kỳ, trống thì ngày kết thúc học kỳ (lịch riêng của cấp nếu có, không thì lịch chung)
  private async deadline(period: {
    school_level: SchoolLevelCode;
    term_type: 'first_term' | 'second_term';
    entry_deadline: string | null;
  }): Promise<string | null> {
    if (period.entry_deadline) {
      return asText(period.entry_deadline);
    }
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.databases.system
      .selectFrom('academic_terms')
      .select(['school_level', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .where('term_type', '=', period.term_type)
      .execute();
    const row =
      rows.find((item) => item.school_level === period.school_level) ?? rows.find((item) => item.school_level === null);
    return row ? asText(row.end_date) : null;
  }

  private async lockOf(database: Executor, periodId: string, classId: string) {
    return database
      .selectFrom('assessment_locks')
      .select(['locked_by_name', 'locked_at'])
      .where('period_id', '=', periodId)
      .where('class_id', '=', classId)
      .executeTakeFirst();
  }

  // Sửa được: chưa khoá; trong hạn hoặc là người quản lý
  private async assertWritable(
    database: Executor,
    access: Access,
    period: Awaited<ReturnType<AssessmentsService['findPeriod']>>,
    classId: string,
  ) {
    if (await this.lockOf(database, period.id, classId)) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, `${period.name} của lớp đã khoá số liệu; nhờ Hiệu trưởng mở khoá`);
    }
    const deadline = await this.deadline(period);
    if (!access.manage && deadline !== null && this.today() > deadline) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, `Đã quá hạn nhập ${period.name} (${deadline})`);
    }
  }

  private async students(database: Executor, classId: string) {
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id as child_id', 'children.full_name'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .orderBy('children.full_name')
      .execute();
  }

  private async hasTest(database: Executor, periodId: string, subjectId: string, grade: string) {
    return Boolean(
      await database
        .selectFrom('assessment_tests')
        .select('period_id')
        .where('period_id', '=', periodId)
        .where('subject_id', '=', subjectId)
        .where('grade_level_code', '=', grade)
        .executeTakeFirst(),
    );
  }

  // Lớp: kỳ, môn của lớp, quyền nhập của người dùng, kỳ đã khoá
  async classOverview(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const config = await readAssessmentConfig(database, classRow.school_level);
    const subjects = await this.classSubjects(database, classRow);
    const locks = await database
      .selectFrom('assessment_locks')
      .select(['period_id', 'locked_by_name', 'locked_at'])
      .where('class_id', '=', classId)
      .execute();
    return {
      class: classRow,
      access: {
        manage: access.manage,
        homeroom: access.homeroom,
        subject_ids: access.subjectIds,
        competency: access.competency,
      },
      subjects: subjects.map((row) => ({
        subject_id: row.subject_id,
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        kind: row.kind,
      })),
      periods: await Promise.all(
        config.periods.map(async (period) => ({
          ...period,
          deadline: await this.deadline({ ...period, school_level: classRow.school_level }),
          locked: locks.find((lock) => lock.period_id === period.id) ?? null,
        })),
      ),
      levels: config.levels,
      items: config.items.filter((item) => item.status === 'active'),
      templates: config.templates.filter((item) => item.status === 'active'),
      tests: config.tests.filter((test) => test.grade_level_code === classRow.grade_level),
    };
  }

  // Bảng nhập một môn của lớp trong kỳ
  async subjectSheet(currentUser: CurrentUser, classId: string, periodId: string, subjectId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const period = await this.findPeriod(database, periodId, classRow);
    const subjects = await this.classSubjects(database, classRow);
    const subject = subjects.find((row) => row.subject_id === subjectId);
    if (!subject) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, 'Môn không có trong chương trình của khối của lớp');
    }
    const [students, results, lock] = await Promise.all([
      this.students(database, classId),
      database
        .selectFrom('subject_results')
        .select(['child_id', 'level_code', 'score', 'comment', 'updated_by_name', 'updated_at'])
        .where('period_id', '=', periodId)
        .where('class_id', '=', classId)
        .where('subject_id', '=', subjectId)
        .execute(),
      this.lockOf(database, periodId, classId),
    ]);
    return {
      period,
      subject,
      has_test: await this.hasTest(database, periodId, subjectId, classRow.grade_level),
      locked: lock ?? null,
      deadline: await this.deadline(period),
      can_edit: access.subjectIds.includes(subjectId) && !lock,
      rows: students.map((student) => ({
        ...student,
        result: results.find((row) => row.child_id === student.child_id) ?? null,
      })),
    };
  }

  async saveSubject(
    currentUser: CurrentUser,
    classId: string,
    input: {
      periodId: string;
      subjectId: string;
      entries: Array<{ child_id: string; level_code: string | null; score: number | null; comment: string | null }>;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.access(database, currentUser, classRow);
    if (!access.subjectIds.includes(input.subjectId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được phân công nhập môn này của lớp');
    }
    const period = await this.findPeriod(database, input.periodId, classRow);
    await this.assertWritable(database, access, period, classId);
    const levels = await this.levelCodes(database, classRow.school_level, 'subject');
    const hasTest = await this.hasTest(database, period.id, input.subjectId, classRow.grade_level);
    const students = new Set((await this.students(database, classId)).map((row) => row.child_id));
    const errors: FieldError[] = [];
    input.entries.forEach((entry, index) => {
      if (!students.has(entry.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh không học lớp này' });
      }
      if (entry.level_code !== null && !levels.includes(entry.level_code)) {
        errors.push({ field: `entries[${index}].level_code`, message: `Mức là ${levels.join(', ')}` });
      }
      if (entry.score !== null && !hasTest) {
        errors.push({ field: `entries[${index}].score`, message: 'Môn không có bài kiểm tra định kỳ ở kỳ này' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const entry of input.entries) {
        const values = {
          level_code: entry.level_code,
          score: entry.score,
          comment: entry.comment,
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
          updated_at: now,
        };
        await transaction
          .insertInto('subject_results')
          .values({
            ...values,
            period_id: period.id,
            class_id: classId,
            child_id: entry.child_id,
            subject_id: input.subjectId,
          })
          .onConflict((conflict) => conflict.columns(['period_id', 'child_id', 'subject_id']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'subject_results',
        entityId: classId,
        action: 'update',
        before: null,
        after: { period_id: period.id, subject_id: input.subjectId, entries: input.entries },
      });
    });
    return this.subjectSheet(currentUser, classId, period.id, input.subjectId);
  }

  private async levelCodes(database: Executor, level: SchoolLevelCode, scale: 'subject' | 'competency') {
    return (
      await database
        .selectFrom('assessment_levels')
        .select('code')
        .where('school_level', '=', level)
        .where('scale', '=', scale)
        .execute()
    ).map((row) => row.code);
  }

  // Bảng nhập phẩm chất, năng lực của lớp trong kỳ
  async competencySheet(currentUser: CurrentUser, classId: string, periodId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const period = await this.findPeriod(database, periodId, classRow);
    const [students, results, lock, items] = await Promise.all([
      this.students(database, classId),
      database
        .selectFrom('competency_results')
        .select(['child_id', 'item_id', 'level_code', 'comment'])
        .where('period_id', '=', periodId)
        .where('class_id', '=', classId)
        .execute(),
      this.lockOf(database, periodId, classId),
      database
        .selectFrom('competency_items')
        .select(['id', 'group_code', 'code', 'name'])
        .where('school_level', '=', classRow.school_level)
        .where('status', '=', 'active')
        .orderBy('order_no')
        .orderBy('code')
        .execute(),
    ]);
    return {
      period,
      items,
      locked: lock ?? null,
      deadline: await this.deadline(period),
      can_edit: access.competency && !lock,
      rows: students.map((student) => ({
        ...student,
        results: results.filter((row) => row.child_id === student.child_id),
      })),
    };
  }

  async saveCompetencies(
    currentUser: CurrentUser,
    classId: string,
    input: {
      periodId: string;
      entries: Array<{ child_id: string; item_id: string; level_code: string | null; comment: string | null }>;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.access(database, currentUser, classRow);
    if (!access.competency) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm nhập phẩm chất, năng lực của lớp');
    }
    const period = await this.findPeriod(database, input.periodId, classRow);
    await this.assertWritable(database, access, period, classId);
    const levels = await this.levelCodes(database, classRow.school_level, 'competency');
    const items = new Set(
      (
        await database
          .selectFrom('competency_items')
          .select('id')
          .where('school_level', '=', classRow.school_level)
          .where('status', '=', 'active')
          .execute()
      ).map((row) => row.id),
    );
    const students = new Set((await this.students(database, classId)).map((row) => row.child_id));
    const errors: FieldError[] = [];
    input.entries.forEach((entry, index) => {
      if (!students.has(entry.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh không học lớp này' });
      }
      if (!items.has(entry.item_id)) {
        errors.push({ field: `entries[${index}].item_id`, message: 'Phẩm chất, năng lực không có hoặc đã ngừng dùng' });
      }
      if (entry.level_code !== null && !levels.includes(entry.level_code)) {
        errors.push({ field: `entries[${index}].level_code`, message: `Mức là ${levels.join(', ')}` });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const entry of input.entries) {
        const values = {
          level_code: entry.level_code,
          comment: entry.comment,
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
          updated_at: now,
        };
        await transaction
          .insertInto('competency_results')
          .values({
            ...values,
            period_id: period.id,
            class_id: classId,
            child_id: entry.child_id,
            item_id: entry.item_id,
          })
          .onConflict((conflict) => conflict.columns(['period_id', 'child_id', 'item_id']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'competency_results',
        entityId: classId,
        action: 'update',
        before: null,
        after: { period_id: period.id, entries: input.entries },
      });
    });
    return this.competencySheet(currentUser, classId, period.id);
  }

  // Nhận xét thường xuyên của lớp trong khoảng ngày (một học sinh nếu có)
  async comments(
    currentUser: CurrentUser,
    classId: string,
    filter: { from: string; to: string; childId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertView(database, currentUser, classRow);
    return database
      .selectFrom('regular_comments')
      .leftJoin('subjects', 'subjects.id', 'regular_comments.subject_id')
      .leftJoin('competency_items', 'competency_items.id', 'regular_comments.item_id')
      .select([
        'regular_comments.id',
        'regular_comments.child_id',
        'regular_comments.subject_id',
        'subjects.name as subject_name',
        'regular_comments.item_id',
        'competency_items.name as item_name',
        'regular_comments.comment_date',
        'regular_comments.content',
        'regular_comments.author_id',
        'regular_comments.author_name',
        'regular_comments.created_at',
      ])
      .where('regular_comments.class_id', '=', classId)
      .where('regular_comments.comment_date', '>=', filter.from)
      .where('regular_comments.comment_date', '<=', filter.to)
      .$if(filter.childId !== null, (query) => query.where('regular_comments.child_id', '=', filter.childId ?? ''))
      .orderBy('regular_comments.comment_date', 'desc')
      .orderBy('regular_comments.created_at', 'desc')
      .execute();
  }

  async addComment(
    currentUser: CurrentUser,
    classId: string,
    input: { childId: string; subjectId: string | null; itemId: string | null; date: string; content: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.access(database, currentUser, classRow);
    const allowed =
      access.manage ||
      (input.subjectId !== null
        ? access.subjectIds.includes(input.subjectId)
        : access.homeroom || access.subjectIds.length > 0);
    if (!allowed || (input.itemId !== null && !access.competency)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được phân công nhận xét nội dung này của lớp');
    }
    if (input.date > this.today()) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, 'Không ghi nhận xét cho ngày chưa đến');
    }
    const students = new Set((await this.students(database, classId)).map((row) => row.child_id));
    if (!students.has(input.childId)) {
      throw validationError([{ field: 'child_id', message: 'Học sinh không học lớp này' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('regular_comments')
        .values({
          class_id: classId,
          child_id: input.childId,
          subject_id: input.subjectId,
          item_id: input.itemId,
          comment_date: input.date,
          content: input.content,
          author_id: currentUser.id,
          author_name: currentUser.description.full_name,
        })
        .returning(['id', 'child_id', 'subject_id', 'item_id', 'comment_date', 'content', 'author_name'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'regular_comments',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Người viết xóa nhận xét của mình; người quản lý xóa mọi nhận xét
  async removeComment(currentUser: CurrentUser, commentId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const comment = await database
      .selectFrom('regular_comments')
      .selectAll()
      .where('id', '=', commentId)
      .executeTakeFirst();
    if (!comment) {
      throw notFoundError('Không tìm thấy nhận xét', 'regular_comment');
    }
    const classRow = await this.findClass(database, comment.class_id);
    const manage = await this.inScope(currentUser, PERMISSION_CODES.assessmentManage, classRow.org_unit_id);
    if (!manage && comment.author_id !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ xóa được nhận xét của mình');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('regular_comments').where('id', '=', commentId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'regular_comments',
        entityId: commentId,
        action: 'delete',
        before: comment,
        after: null,
      });
    });
    return { id: commentId, deleted: true };
  }

  // Bảng tổng hợp cuối kỳ của lớp: số học sinh theo mức của từng môn, phẩm chất, năng lực; điểm kiểm tra theo khoảng
  async summary(currentUser: CurrentUser, classId: string, periodId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    await this.assertView(database, currentUser, classRow);
    const period = await this.findPeriod(database, periodId, classRow);
    const [students, subjects, levels, items, subjectRows, competencyRows, tests] = await Promise.all([
      this.students(database, classId),
      this.classSubjects(database, classRow),
      database
        .selectFrom('assessment_levels')
        .select(['scale', 'code', 'name', 'rank'])
        .where('school_level', '=', classRow.school_level)
        .orderBy('rank')
        .execute(),
      database
        .selectFrom('competency_items')
        .select(['id', 'group_code', 'code', 'name'])
        .where('school_level', '=', classRow.school_level)
        .where('status', '=', 'active')
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('subject_results')
        .select(['child_id', 'subject_id', 'level_code', 'score'])
        .where('period_id', '=', periodId)
        .where('class_id', '=', classId)
        .execute(),
      database
        .selectFrom('competency_results')
        .select(['child_id', 'item_id', 'level_code'])
        .where('period_id', '=', periodId)
        .where('class_id', '=', classId)
        .execute(),
      database
        .selectFrom('assessment_tests')
        .select('subject_id')
        .where('period_id', '=', periodId)
        .where('grade_level_code', '=', classRow.grade_level)
        .execute(),
    ]);
    const enrolled = new Set(students.map((row) => row.child_id));
    const count = (rows: Array<{ child_id: string; level_code: string | null }>, scale: 'subject' | 'competency') =>
      Object.fromEntries(
        levels
          .filter((level) => level.scale === scale)
          .map((level) => [
            level.code,
            rows.filter((row) => enrolled.has(row.child_id) && row.level_code === level.code).length,
          ]),
      );
    const bands = [
      { band: '9-10', from: 9, to: 10 },
      { band: '7-8', from: 7, to: 8 },
      { band: '5-6', from: 5, to: 6 },
      { band: 'duoi-5', from: 1, to: 4 },
    ];
    return {
      period,
      class: classRow,
      student_count: students.length,
      levels,
      locked: (await this.lockOf(database, periodId, classId)) ?? null,
      subjects: subjects.map((subject) => {
        const rows = subjectRows.filter((row) => row.subject_id === subject.subject_id);
        const hasTest = tests.some((test) => test.subject_id === subject.subject_id);
        return {
          subject_id: subject.subject_id,
          subject_name: subject.subject_name,
          has_test: hasTest,
          by_level: count(rows, 'subject'),
          missing: students.length - rows.filter((row) => enrolled.has(row.child_id) && row.level_code).length,
          scores: hasTest
            ? Object.fromEntries(
                bands.map((band) => [
                  band.band,
                  rows.filter(
                    (row) =>
                      enrolled.has(row.child_id) &&
                      row.score !== null &&
                      row.score >= band.from &&
                      row.score <= band.to,
                  ).length,
                ]),
              )
            : null,
        };
      }),
      items: items.map((item) => {
        const rows = competencyRows.filter((row) => row.item_id === item.id);
        return {
          ...item,
          by_level: count(rows, 'competency'),
          missing: students.length - rows.filter((row) => enrolled.has(row.child_id) && row.level_code).length,
        };
      }),
    };
  }

  // Tổng hợp cuối năm của lớp: gợi ý theo kết quả kỳ cuối năm, kết quả đã xác nhận
  async yearResults(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'name', 'school_level', 'term_type', 'kind', 'is_year_end', 'entry_deadline', 'code'])
      .where('school_level', '=', classRow.school_level)
      .where('is_year_end', '=', true)
      .orderBy('order_no', 'desc')
      .executeTakeFirst();
    if (!period) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, 'Chưa có kỳ cuối năm; nạp cấu hình đánh giá trước');
    }
    const [students, subjects, levels, items, subjectRows, competencyRows, tests, confirmed, lock] = await Promise.all([
      this.students(database, classId),
      this.classSubjects(database, classRow),
      database
        .selectFrom('assessment_levels')
        .select(['scale', 'code', 'rank'])
        .where('school_level', '=', classRow.school_level)
        .execute(),
      database
        .selectFrom('competency_items')
        .select('id')
        .where('school_level', '=', classRow.school_level)
        .where('status', '=', 'active')
        .execute(),
      database
        .selectFrom('subject_results')
        .select(['child_id', 'subject_id', 'level_code', 'score'])
        .where('period_id', '=', period.id)
        .where('class_id', '=', classId)
        .execute(),
      database
        .selectFrom('competency_results')
        .select(['child_id', 'item_id', 'level_code'])
        .where('period_id', '=', period.id)
        .where('class_id', '=', classId)
        .execute(),
      database
        .selectFrom('assessment_tests')
        .select('subject_id')
        .where('period_id', '=', period.id)
        .where('grade_level_code', '=', classRow.grade_level)
        .execute(),
      database
        .selectFrom('year_results')
        .select(['child_id', 'suggested', 'result', 'note', 'confirmed_by_name', 'confirmed_at'])
        .where('class_id', '=', classId)
        .execute(),
      this.lockOf(database, period.id, classId),
    ]);
    const rankOf = (scale: string, code: string | null | undefined) =>
      code ? (levels.find((level) => level.scale === scale && level.code === code)?.rank ?? null) : null;
    const worst = (scale: string) => Math.max(...levels.filter((level) => level.scale === scale).map((l) => l.rank), 1);
    const thresholds = ASSESSMENT_DEFAULTS[classRow.school_level]?.score_thresholds ?? {
      excellent: 9,
      good: 7,
      completed: 5,
    };
    return {
      period,
      locked: lock ?? null,
      can_confirm: (access.manage || access.homeroom) && !lock,
      rows: students.map((student) => {
        const own = subjectRows.filter((row) => row.child_id === student.child_id);
        const ownCompetency = competencyRows.filter((row) => row.child_id === student.child_id);
        const suggested = suggestYearResult({
          subjectRanks: subjects.map((subject) =>
            rankOf('subject', own.find((row) => row.subject_id === subject.subject_id)?.level_code),
          ),
          subjectWorstRank: worst('subject'),
          competencyRanks: items.map((item) =>
            rankOf('competency', ownCompetency.find((row) => row.item_id === item.id)?.level_code),
          ),
          competencyWorstRank: worst('competency'),
          scores: tests.map((test) => own.find((row) => row.subject_id === test.subject_id)?.score ?? null),
          thresholds,
        });
        return {
          ...student,
          suggested,
          confirmed: confirmed.find((row) => row.child_id === student.child_id) ?? null,
        };
      }),
    };
  }

  async confirmYearResults(
    currentUser: CurrentUser,
    classId: string,
    entries: Array<{ child_id: string; result: YearResultCode; note: string | null }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const view = await this.yearResults(currentUser, classId);
    if (!view.can_confirm) {
      throw view.locked
        ? ruleViolationError(ASSESSMENT_RULE_CODE, 'Kỳ cuối năm của lớp đã khoá số liệu')
        : new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm xác nhận kết quả cuối năm của lớp');
    }
    const errors: FieldError[] = [];
    entries.forEach((entry, index) => {
      if (!view.rows.some((row) => row.child_id === entry.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh không học lớp này' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const entry of entries) {
        const values = {
          suggested: view.rows.find((row) => row.child_id === entry.child_id)?.suggested ?? null,
          result: entry.result,
          note: entry.note,
          confirmed_by: currentUser.id,
          confirmed_by_name: currentUser.description.full_name,
          confirmed_at: now,
        };
        await transaction
          .insertInto('year_results')
          .values({ ...values, class_id: classId, child_id: entry.child_id })
          .onConflict((conflict) => conflict.columns(['class_id', 'child_id']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'year_results',
        entityId: classId,
        action: 'update',
        before: null,
        after: entries,
      });
    });
    return this.yearResults(currentUser, classId);
  }

  // Khoá số liệu của kỳ ở các lớp (trống là mọi lớp đang học của cấp trong phạm vi người dùng)
  async lock(currentUser: CurrentUser, periodId: string, classIds: string[] | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'name', 'school_level'])
      .where('id', '=', periodId)
      .executeTakeFirst();
    if (!period) {
      throw notFoundError('Không tìm thấy kỳ đánh giá', 'assessment_period');
    }
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.assessmentManage);
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id'])
      .where('school_level', '=', period.school_level)
      .where('status', '=', 'active')
      .$if(classIds !== null, (query) =>
        query.where('id', 'in', [...(classIds ?? []), '00000000-0000-0000-0000-000000000000']),
      )
      .$if(!scope.wholeSchool, (query) => query.where('org_unit_id', 'in', [...scope.orgUnitIds, '']))
      .execute();
    if (classIds !== null && classes.length !== classIds.length) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Có lớp không thuộc cấp của kỳ hoặc ngoài phạm vi của bạn');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      if (classes.length > 0) {
        await transaction
          .insertInto('assessment_locks')
          .values(
            classes.map((row) => ({
              period_id: periodId,
              class_id: row.id,
              locked_by: currentUser.id,
              locked_by_name: currentUser.description.full_name,
              locked_at: now,
            })),
          )
          .onConflict((conflict) => conflict.doNothing())
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'assessment_locks',
        entityId: periodId,
        action: 'create',
        before: null,
        after: { period_id: periodId, class_ids: classes.map((row) => row.id) },
      });
    });
    return { period_id: periodId, locked_class_count: classes.length };
  }

  // Lớp đang học của cấp của kỳ trong phạm vi người quản lý, kèm trạng thái khoá
  async locks(currentUser: CurrentUser, periodId: string) {
    const { database } = await this.currentSchoolYear.require();
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'name', 'school_level'])
      .where('id', '=', periodId)
      .executeTakeFirst();
    if (!period) {
      throw notFoundError('Không tìm thấy kỳ đánh giá', 'assessment_period');
    }
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.assessmentManage);
    const classes = await database
      .selectFrom('classes')
      .leftJoin('assessment_locks', (join) =>
        join.onRef('assessment_locks.class_id', '=', 'classes.id').on('assessment_locks.period_id', '=', periodId),
      )
      .select([
        'classes.id as class_id',
        'classes.name as class_name',
        'classes.grade_level',
        'assessment_locks.locked_by_name',
        'assessment_locks.locked_at',
      ])
      .where('classes.school_level', '=', period.school_level)
      .where('classes.status', '=', 'active')
      .$if(!scope.wholeSchool, (query) => query.where('classes.org_unit_id', 'in', [...scope.orgUnitIds, '']))
      .orderBy('classes.grade_level')
      .orderBy('classes.name')
      .execute();
    return { period, classes };
  }

  async unlock(currentUser: CurrentUser, periodId: string, classId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    if (!(await this.inScope(currentUser, PERMISSION_CODES.assessmentManage, classRow.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp ngoài phạm vi của bạn');
    }
    const lock = await this.lockOf(database, periodId, classId);
    if (!lock) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, 'Kỳ của lớp chưa khoá');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('assessment_locks')
        .where('period_id', '=', periodId)
        .where('class_id', '=', classId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'assessment_locks',
        entityId: periodId,
        action: 'delete',
        before: { class_id: classId, ...lock },
        after: { class_id: classId, reason },
      });
    });
    return { period_id: periodId, class_id: classId, unlocked: true };
  }

  // Phụ huynh: kết quả các kỳ đã khoá của lớp đang học, kết quả cuối năm khi kỳ cuối năm đã khoá, nhận xét thường xuyên
  async forParent(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
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
      return { periods: [], year_result: null, comments: [], levels: [] };
    }
    const classRow = await this.findClass(database, enrollment.class_id);
    const locked = await database
      .selectFrom('assessment_locks')
      .innerJoin('assessment_periods', 'assessment_periods.id', 'assessment_locks.period_id')
      .select([
        'assessment_periods.id',
        'assessment_periods.code',
        'assessment_periods.name',
        'assessment_periods.is_year_end',
        'assessment_periods.order_no',
      ])
      .where('assessment_locks.class_id', '=', classRow.id)
      .orderBy('assessment_periods.order_no')
      .execute();
    const periodIds = locked.map((row) => row.id);
    const [subjectRows, competencyRows, levels, comments, year] = await Promise.all([
      periodIds.length === 0
        ? []
        : database
            .selectFrom('subject_results')
            .innerJoin('subjects', 'subjects.id', 'subject_results.subject_id')
            .select([
              'subject_results.period_id',
              'subjects.name as subject_name',
              'subjects.order_no',
              'subject_results.level_code',
              'subject_results.score',
              'subject_results.comment',
            ])
            .where('subject_results.child_id', '=', childId)
            .where('subject_results.class_id', '=', classRow.id)
            .where('subject_results.period_id', 'in', periodIds)
            .orderBy('subjects.order_no')
            .execute(),
      periodIds.length === 0
        ? []
        : database
            .selectFrom('competency_results')
            .innerJoin('competency_items', 'competency_items.id', 'competency_results.item_id')
            .select([
              'competency_results.period_id',
              'competency_items.group_code',
              'competency_items.name as item_name',
              'competency_items.order_no',
              'competency_results.level_code',
              'competency_results.comment',
            ])
            .where('competency_results.child_id', '=', childId)
            .where('competency_results.class_id', '=', classRow.id)
            .where('competency_results.period_id', 'in', periodIds)
            .orderBy('competency_items.order_no')
            .execute(),
      database
        .selectFrom('assessment_levels')
        .select(['scale', 'code', 'name', 'rank'])
        .where('school_level', '=', classRow.school_level)
        .orderBy('rank')
        .execute(),
      database
        .selectFrom('regular_comments')
        .leftJoin('subjects', 'subjects.id', 'regular_comments.subject_id')
        .select([
          'regular_comments.id',
          'regular_comments.comment_date',
          'subjects.name as subject_name',
          'regular_comments.content',
          'regular_comments.author_name',
        ])
        .where('regular_comments.child_id', '=', childId)
        .where('regular_comments.class_id', '=', classRow.id)
        .orderBy('regular_comments.comment_date', 'desc')
        .limit(100)
        .execute(),
      locked.some((row) => row.is_year_end)
        ? database
            .selectFrom('year_results')
            .select(['result', 'note', 'confirmed_at'])
            .where('child_id', '=', childId)
            .where('class_id', '=', classRow.id)
            .executeTakeFirst()
        : undefined,
    ]);
    return {
      class_name: classRow.name,
      levels,
      periods: locked.map((period) => ({
        ...period,
        subjects: subjectRows.filter((row) => row.period_id === period.id),
        competencies: competencyRows.filter((row) => row.period_id === period.id),
      })),
      year_result: year ?? null,
      comments,
    };
  }
}

function readEntries(body: RequestBody, errors: FieldError[]): Array<Record<string, unknown>> {
  if (!Array.isArray(body?.entries) || body.entries.length > 200) {
    errors.push({ field: 'entries', message: 'Cần danh sách tối đa 200 dòng' });
    return [];
  }
  return (body.entries as unknown[]).map((value) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
  );
}

function readComment(value: unknown, field: string, errors: FieldError[]): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || value.length > 1000) {
    errors.push({ field, message: 'Nhận xét tối đa 1000 ký tự' });
    return null;
  }
  return value.trim() || null;
}

function readLevel(value: unknown, field: string, errors: FieldError[]): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Mức không hợp lệ' });
    return null;
  }
  return value;
}

function throwIf(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller('assessment')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('classes/:id')
  overview(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assessments.classOverview(currentUser, classId);
  }

  @Get('classes/:id/subjects/:subjectId')
  subjectSheet(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('subjectId', uuidParameter('Mã môn không hợp lệ')) subjectId: string,
    @Query('period_id') periodId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(periodId)) {
      throw validationError([{ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' }]);
    }
    return this.assessments.subjectSheet(currentUser, classId, periodId, subjectId);
  }

  @Put('classes/:id/subjects/:subjectId')
  saveSubject(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('subjectId', uuidParameter('Mã môn không hợp lệ')) subjectId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.period_id)) {
      errors.push({ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' });
    }
    const entries = readEntries(body, errors).map((item, index) => {
      const score = item.score === undefined || item.score === null || item.score === '' ? null : item.score;
      if (score !== null && (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 10)) {
        errors.push({ field: `entries[${index}].score`, message: 'Điểm là số nguyên từ 1 đến 10' });
      }
      if (!isUuid(item.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Mã học sinh không hợp lệ' });
      }
      return {
        child_id: String(item.child_id),
        level_code: readLevel(item.level_code, `entries[${index}].level_code`, errors),
        score: typeof score === 'number' ? score : null,
        comment: readComment(item.comment, `entries[${index}].comment`, errors),
      };
    });
    throwIf(errors);
    return this.assessments.saveSubject(
      currentUser,
      classId,
      { periodId: String(body?.period_id), subjectId, entries },
      originOf(request, currentUser),
    );
  }

  @Get('classes/:id/competencies')
  competencySheet(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('period_id') periodId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(periodId)) {
      throw validationError([{ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' }]);
    }
    return this.assessments.competencySheet(currentUser, classId, periodId);
  }

  @Put('classes/:id/competencies')
  saveCompetencies(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.period_id)) {
      errors.push({ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' });
    }
    const entries = readEntries(body, errors).map((item, index) => {
      if (!isUuid(item.child_id) || !isUuid(item.item_id)) {
        errors.push({ field: `entries[${index}]`, message: 'Mã học sinh, phẩm chất, năng lực không hợp lệ' });
      }
      return {
        child_id: String(item.child_id),
        item_id: String(item.item_id),
        level_code: readLevel(item.level_code, `entries[${index}].level_code`, errors),
        comment: readComment(item.comment, `entries[${index}].comment`, errors),
      };
    });
    throwIf(errors);
    return this.assessments.saveCompetencies(
      currentUser,
      classId,
      { periodId: String(body?.period_id), entries },
      originOf(request, currentUser),
    );
  }

  @Get('classes/:id/comments')
  comments(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query() query: Record<string, string | undefined>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const from = readDate(query.from, 'from', errors);
    const to = readDate(query.to ?? query.from, 'to', errors);
    if (query.child_id && !isUuid(query.child_id)) {
      errors.push({ field: 'child_id', message: 'Mã học sinh không hợp lệ' });
    }
    throwIf(errors);
    return this.assessments.comments(currentUser, classId, { from, to, childId: query.child_id || null });
  }

  @Post('classes/:id/comments')
  addComment(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.child_id)) {
      errors.push({ field: 'child_id', message: 'Bắt buộc chọn học sinh' });
    }
    for (const field of ['subject_id', 'item_id']) {
      if (body?.[field] !== undefined && body[field] !== null && !isUuid(body[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const content = readOptionalText(body, 'content', errors) ?? '';
    if (content === '' || content.length > 1000) {
      errors.push({ field: 'content', message: 'Nhận xét từ 1 đến 1000 ký tự' });
    }
    const date = readDate(body?.date, 'date', errors);
    throwIf(errors);
    return this.assessments.addComment(
      currentUser,
      classId,
      {
        childId: String(body?.child_id),
        subjectId: isUuid(body?.subject_id) ? body.subject_id : null,
        itemId: isUuid(body?.item_id) ? body.item_id : null,
        date,
        content,
      },
      originOf(request, currentUser),
    );
  }

  @Delete('comments/:id')
  removeComment(
    @Param('id', uuidParameter('Mã nhận xét không hợp lệ')) commentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assessments.removeComment(currentUser, commentId, originOf(request, currentUser));
  }

  @Get('classes/:id/summary')
  summary(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('period_id') periodId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(periodId)) {
      throw validationError([{ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' }]);
    }
    return this.assessments.summary(currentUser, classId, periodId);
  }

  @Get('classes/:id/year-results')
  yearResults(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assessments.yearResults(currentUser, classId);
  }

  @Put('classes/:id/year-results')
  confirmYearResults(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const entries = readEntries(body, errors).map((item, index) => {
      if (!isUuid(item.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Mã học sinh không hợp lệ' });
      }
      if (!YEAR_RESULTS.includes(item.result as YearResultCode)) {
        errors.push({ field: `entries[${index}].result`, message: `Kết quả là ${YEAR_RESULTS.join(', ')}` });
      }
      return {
        child_id: String(item.child_id),
        result: item.result as YearResultCode,
        note: readComment(item.note, `entries[${index}].note`, errors),
      };
    });
    throwIf(errors);
    return this.assessments.confirmYearResults(currentUser, classId, entries, originOf(request, currentUser));
  }

  @Get('locks')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  locks(@Query('period_id') periodId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(periodId)) {
      throw validationError([{ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' }]);
    }
    return this.assessments.locks(currentUser, periodId);
  }

  @Post('locks')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  lock(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.period_id)) {
      errors.push({ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' });
    }
    let classIds: string[] | null = null;
    if (body?.class_ids !== undefined && body.class_ids !== null) {
      if (!Array.isArray(body.class_ids) || !body.class_ids.every((value) => isUuid(value))) {
        errors.push({ field: 'class_ids', message: 'Danh sách mã lớp không hợp lệ' });
      } else {
        classIds = [...new Set(body.class_ids as string[])];
      }
    }
    throwIf(errors);
    return this.assessments.lock(currentUser, String(body?.period_id), classIds, originOf(request, currentUser));
  }

  @Post('locks/unlock')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  unlock(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.period_id) || !isUuid(body?.class_id)) {
      errors.push({ field: 'class_id', message: 'Bắt buộc chọn kỳ và lớp' });
    }
    const reason = readOptionalText(body, 'reason', errors);
    if (!reason) {
      errors.push({ field: 'reason', message: 'Bắt buộc ghi lý do mở khoá' });
    }
    throwIf(errors);
    return this.assessments.unlock(
      currentUser,
      String(body?.period_id),
      String(body?.class_id),
      reason ?? '',
      originOf(request, currentUser),
    );
  }

  @Get('children/:id')
  forParent(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assessments.forParent(currentUser, childId);
  }
}
