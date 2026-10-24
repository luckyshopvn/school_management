import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { RatingTermValue, RatingValue, SchoolYearDatabase, ScoreTermTypeValue } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  isRatingCode,
  isValidScore,
  PERMISSION_CODES,
  requiredRegularCount,
  SCORE_DEFAULTS,
  suggestLearningRating,
  termAverage,
  validateScoreConfig,
  yearAverage,
  type RatingSubject,
  type SchoolLevelCode,
  type ScoreConfig,
} from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { readCurriculumSubjects } from '../subjects/subjects.js';

// Sổ điểm THCS, THPT theo Thông tư 22/2021 (DT-21 phần 21c, YCTD-170): điểm đánh giá thường xuyên, giữa kỳ, cuối kỳ; kết quả
// môn đánh giá bằng nhận xét; điểm trung bình môn học kỳ, cả năm (tính khi đọc); xếp loại học tập (gợi ý của máy, giáo viên
// chủ nhiệm xác nhận), rèn luyện; khoá điểm theo học kỳ và lớp; phụ huynh xem điểm đã khoá. Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11:
// - quyền nhập như đánh giá học sinh (20c): giáo viên bộ môn nhập môn mình được phân công ở lớp, giáo viên chủ nhiệm nhập môn
//   chưa có giáo viên bộ môn, xếp loại, rèn luyện; người có `P02.assessment.manage` nhập thay mọi lớp, khoá, mở khoá;
// - hạn nhập là ngày kết thúc học kỳ theo lịch của cấp (19b); quá hạn hoặc đã khoá thì chỉ người quản lý sửa được (đã khoá
//   thì phải mở khoá kèm lý do trước); xếp loại cả năm theo khoá của học kỳ II;
// - điểm 0 đến 10, một chữ số thập phân; điểm kiểm tra tập trung của 22g2 ghi vào cùng bảng với nguồn `exam`
export const SCORE_RULE_CODE = 'YCTD-170';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type TermType = ScoreTermTypeValue;
const MAX_REGULAR_SCORES = 10;
// Mã cố định cho nhật ký thay đổi cấu hình theo cấp (nhật ký ghi mã định danh của đối tượng)
const CONFIG_AUDIT_IDS: Partial<Record<SchoolLevelCode, string>> = {
  THCS: '00000000-0000-4000-8000-0000021c0001',
  THPT: '00000000-0000-4000-8000-0000021c0002',
};

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
  subjectIds: string[];
}

interface ClassSubject {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  periods_per_week: number;
  mode: 'score' | 'comment';
  // Môn tự chọn không tính vào xếp loại học tập chung (học sinh không học đủ mọi môn tự chọn)
  is_elective: boolean;
  required_regular: number;
}

const asText = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const lockTerm = (term: RatingTermValue): TermType => (term === 'year' ? 'second_term' : term);

function readTermType(value: unknown, allowYear: boolean): RatingTermValue {
  if (value === 'first_term' || value === 'second_term' || (allowYear && value === 'year')) {
    return value;
  }
  throw validationError([
    {
      field: 'term_type',
      message: allowYear ? 'Học kỳ là first_term, second_term hoặc year' : 'Học kỳ là first_term hoặc second_term',
    },
  ]);
}

// Điểm cấu hình của cấp: dòng đã lưu hoặc bộ mặc định; cấp không phải THCS, THPT không có sổ điểm
export async function readScoreConfig(database: Executor, level: SchoolLevelCode): Promise<ScoreConfig> {
  const defaults = SCORE_DEFAULTS[level];
  if (!defaults) {
    throw ruleViolationError(SCORE_RULE_CODE, 'Sổ điểm chỉ có ở THCS, THPT', [
      { field: 'school_level', message: 'Chọn cấp THCS hoặc THPT' },
    ]);
  }
  const row = await database
    .selectFrom('score_configs')
    .select('config')
    .where('school_level', '=', level)
    .executeTakeFirst();
  return row ? ({ ...defaults, ...(row.config as ScoreConfig) } as ScoreConfig) : defaults;
}

@Injectable()
export class ScoresService {
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
    if (row.school_level !== 'THCS' && row.school_level !== 'THPT') {
      throw ruleViolationError(SCORE_RULE_CODE, 'Sổ điểm chỉ có ở lớp THCS, THPT', [
        { field: 'class_id', message: 'Lớp không thuộc THCS, THPT' },
      ]);
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

  // Môn của lớp theo chương trình của lớp (trống là chương trình mặc định của cấp) và khối, kèm cách đánh giá
  private async classSubjects(
    database: Executor,
    classRow: ClassContext,
    config: ScoreConfig,
  ): Promise<ClassSubject[]> {
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
    const rows = (await readCurriculumSubjects(database, curriculum.id)).filter(
      (row) => row.grade_level_code === classRow.grade_level,
    );
    if (rows.length === 0) {
      return [];
    }
    const assessments = await database
      .selectFrom('subjects')
      .select(['id', 'assessment'])
      .where(
        'id',
        'in',
        rows.map((row) => row.subject_id),
      )
      .execute();
    return rows.map((row) => ({
      subject_id: row.subject_id,
      subject_code: row.subject_code,
      subject_name: row.subject_name,
      periods_per_week: row.periods_per_week,
      mode: assessments.find((item) => item.id === row.subject_id)?.assessment === 'comment' ? 'comment' : 'score',
      is_elective: row.is_elective,
      required_regular: requiredRegularCount(row.periods_per_week, config),
    }));
  }

  private async access(
    database: Executor,
    currentUser: CurrentUser,
    classRow: ClassContext,
    subjects: ClassSubject[],
  ): Promise<Access> {
    if (await this.inScope(currentUser, PERMISSION_CODES.assessmentManage, classRow.org_unit_id)) {
      return { manage: true, homeroom: false, subjectIds: subjects.map((row) => row.subject_id) };
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.assessmentEnter)) {
      return { manage: false, homeroom: false, subjectIds: [] };
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
    return { manage: false, homeroom, subjectIds };
  }

  private async assertView(
    database: Executor,
    currentUser: CurrentUser,
    classRow: ClassContext,
    subjects: ClassSubject[],
  ): Promise<Access> {
    const access = await this.access(database, currentUser, classRow, subjects);
    if (
      access.manage ||
      access.homeroom ||
      access.subjectIds.length > 0 ||
      (await this.inScope(currentUser, PERMISSION_CODES.assessmentView, classRow.org_unit_id))
    ) {
      return access;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được sổ điểm của lớp này');
  }

  // Hạn nhập: ngày kết thúc học kỳ theo lịch riêng của cấp nếu có, không thì lịch chung
  private async deadline(level: SchoolLevelCode, term: TermType): Promise<string | null> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.databases.system
      .selectFrom('academic_terms')
      .select(['school_level', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .where('term_type', '=', term)
      .execute();
    const row = rows.find((item) => item.school_level === level) ?? rows.find((item) => item.school_level === null);
    return row ? asText(row.end_date) : null;
  }

  private async lockOf(database: Executor, classId: string, term: TermType) {
    return database
      .selectFrom('score_locks')
      .select(['locked_by_name', 'locked_at'])
      .where('class_id', '=', classId)
      .where('term_type', '=', term)
      .executeTakeFirst();
  }

  private async assertWritable(database: Executor, access: Access, classRow: ClassContext, term: TermType) {
    if (await this.lockOf(database, classRow.id, term)) {
      throw ruleViolationError(SCORE_RULE_CODE, 'Điểm của học kỳ đã khoá; nhờ Hiệu trưởng mở khoá');
    }
    const deadline = await this.deadline(classRow.school_level, term);
    if (!access.manage && deadline !== null && this.today() > deadline) {
      throw ruleViolationError(SCORE_RULE_CODE, `Đã quá hạn nhập điểm (${deadline})`);
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

  async config(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    return { school_level: level, config: await readScoreConfig(database, level) };
  }

  async saveConfig(level: SchoolLevelCode, config: ScoreConfig, currentUser: CurrentUser, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await readScoreConfig(database, level);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('score_configs')
        .values({
          school_level: level,
          config: JSON.stringify(config),
          updated_by: currentUser.id,
          updated_at: this.clock.now(),
        })
        .onConflict((conflict) =>
          conflict.column('school_level').doUpdateSet({
            config: JSON.stringify(config),
            updated_by: currentUser.id,
            updated_at: this.clock.now(),
          }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'score_configs',
        entityId: CONFIG_AUDIT_IDS[level] ?? randomUUID(),
        action: 'update',
        before,
        after: config,
      });
    });
    return this.config(level);
  }

  // Lớp: môn (cách đánh giá, số lần đánh giá thường xuyên tối thiểu), quyền nhập của người dùng, học kỳ (hạn, khoá)
  async overview(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const config = await readScoreConfig(database, classRow.school_level);
    const subjects = await this.classSubjects(database, classRow, config);
    const access = await this.assertView(database, currentUser, classRow, subjects);
    const terms = await Promise.all(
      (['first_term', 'second_term'] as const).map(async (term) => ({
        term_type: term,
        deadline: await this.deadline(classRow.school_level, term),
        locked: (await this.lockOf(database, classId, term)) ?? null,
      })),
    );
    return {
      class: classRow,
      access: { manage: access.manage, homeroom: access.homeroom, subject_ids: access.subjectIds },
      subjects,
      terms,
      config,
    };
  }

  private async termScores(database: Executor, classId: string, subjectId: string | null, terms: TermType[]) {
    return database
      .selectFrom('score_entries')
      .select(['child_id', 'subject_id', 'term_type', 'kind', 'seq', 'score', 'source'])
      .where('class_id', '=', classId)
      .where('term_type', 'in', terms)
      .$if(subjectId !== null, (query) => query.where('subject_id', '=', subjectId ?? ''))
      .orderBy('seq')
      .execute();
  }

  // Bảng nhập một môn của lớp trong học kỳ
  async sheet(currentUser: CurrentUser, classId: string, subjectId: string, term: TermType) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const config = await readScoreConfig(database, classRow.school_level);
    const subjects = await this.classSubjects(database, classRow, config);
    const access = await this.assertView(database, currentUser, classRow, subjects);
    const subject = subjects.find((row) => row.subject_id === subjectId);
    if (!subject) {
      throw ruleViolationError(SCORE_RULE_CODE, 'Môn không có trong chương trình của khối của lớp');
    }
    const [students, entries, results, lock] = await Promise.all([
      this.students(database, classId),
      this.termScores(database, classId, subjectId, [term]),
      database
        .selectFrom('subject_term_results')
        .select(['child_id', 'result', 'comment', 'updated_by_name', 'updated_at'])
        .where('class_id', '=', classId)
        .where('subject_id', '=', subjectId)
        .where('term_type', '=', term)
        .execute(),
      this.lockOf(database, classId, term),
    ]);
    return {
      term_type: term,
      subject,
      locked: lock ?? null,
      deadline: await this.deadline(classRow.school_level, term),
      can_edit: access.subjectIds.includes(subjectId) && !lock,
      rows: students.map((student) => {
        const own = entries.filter((entry) => entry.child_id === student.child_id);
        const regular = own.filter((entry) => entry.kind === 'regular').map((entry) => Number(entry.score));
        const mid = own.find((entry) => entry.kind === 'mid');
        const final = own.find((entry) => entry.kind === 'final');
        const result = results.find((row) => row.child_id === student.child_id);
        const scores = { regular, mid: mid ? Number(mid.score) : null, final: final ? Number(final.score) : null };
        return {
          ...student,
          ...scores,
          average: termAverage(scores, config),
          result: result?.result ?? null,
          comment: result?.comment ?? null,
          sources: own.filter((entry) => entry.source !== 'manual').map((entry) => `${entry.kind}:${entry.source}`),
        };
      }),
    };
  }

  async saveSheet(
    currentUser: CurrentUser,
    classId: string,
    subjectId: string,
    term: TermType,
    entries: Array<{
      child_id: string;
      regular: Array<number | null>;
      mid: number | null;
      final: number | null;
      result: 'pass' | 'fail' | null;
      comment: string | null;
    }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const config = await readScoreConfig(database, classRow.school_level);
    const subjects = await this.classSubjects(database, classRow, config);
    const access = await this.access(database, currentUser, classRow, subjects);
    const subject = subjects.find((row) => row.subject_id === subjectId);
    if (!subject) {
      throw ruleViolationError(SCORE_RULE_CODE, 'Môn không có trong chương trình của khối của lớp');
    }
    if (!access.subjectIds.includes(subjectId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được phân công nhập môn này của lớp');
    }
    await this.assertWritable(database, access, classRow, term);
    const students = new Set((await this.students(database, classId)).map((row) => row.child_id));
    const errors: FieldError[] = [];
    entries.forEach((entry, index) => {
      if (!students.has(entry.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh không học lớp này' });
      }
      if (
        subject.mode === 'comment' &&
        (entry.regular.some((value) => value !== null) || entry.mid !== null || entry.final !== null)
      ) {
        errors.push({ field: `entries[${index}]`, message: 'Môn đánh giá bằng nhận xét không nhập điểm số' });
      }
      if (subject.mode === 'score' && entry.result !== null) {
        errors.push({ field: `entries[${index}].result`, message: 'Môn tính điểm không có kết quả Đạt, Chưa đạt' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    const base = { updated_by: currentUser.id, updated_by_name: currentUser.description.full_name, updated_at: now };
    await database.transaction().execute(async (transaction) => {
      for (const entry of entries) {
        const slots: Array<{ kind: 'regular' | 'mid' | 'final'; seq: number; score: number | null }> = [
          ...Array.from({ length: MAX_REGULAR_SCORES }, (_unused, index) => ({
            kind: 'regular' as const,
            seq: index + 1,
            score: entry.regular[index] ?? null,
          })),
          { kind: 'mid', seq: 1, score: entry.mid },
          { kind: 'final', seq: 1, score: entry.final },
        ];
        for (const slot of slots) {
          const where = {
            child_id: entry.child_id,
            subject_id: subjectId,
            term_type: term,
            kind: slot.kind,
            seq: slot.seq,
          };
          if (slot.score === null) {
            await transaction
              .deleteFrom('score_entries')
              .where('child_id', '=', where.child_id)
              .where('subject_id', '=', subjectId)
              .where('term_type', '=', term)
              .where('kind', '=', slot.kind)
              .where('seq', '=', slot.seq)
              .execute();
          } else {
            const score: number = slot.score;
            await transaction
              .insertInto('score_entries')
              .values({ ...where, class_id: classId, score, source: 'manual', ...base })
              .onConflict((conflict) =>
                conflict
                  .columns(['child_id', 'subject_id', 'term_type', 'kind', 'seq'])
                  .doUpdateSet({ score, source: 'manual', class_id: classId, ...base }),
              )
              .execute();
          }
        }
        const values = { result: entry.result, comment: entry.comment, ...base };
        await transaction
          .insertInto('subject_term_results')
          .values({ ...values, class_id: classId, child_id: entry.child_id, subject_id: subjectId, term_type: term })
          .onConflict((conflict) => conflict.columns(['child_id', 'subject_id', 'term_type']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'score_entries',
        entityId: classId,
        action: 'update',
        before: null,
        after: { subject_id: subjectId, term_type: term, entries },
      });
    });
    return this.sheet(currentUser, classId, subjectId, term);
  }

  // Một cửa ghi điểm bài kiểm tra tập trung từ 22g2 (YCTD-173): giáo viên được phân công môn của lớp (hoặc người quản lý)
  // xác nhận; cùng kiểm tra khoá, hạn nhập như nhập tay; điểm ghi nguồn `exam` vào đúng loại điểm, lần
  async recordExamScores(
    currentUser: CurrentUser,
    input: {
      class_id: string;
      subject_id: string;
      term_type: TermType;
      kind: 'regular' | 'mid' | 'final';
      seq: number;
      scores: Array<{ child_id: string; score: number }>;
    },
    transaction: Executor,
  ) {
    const classRow = await this.findClass(transaction, input.class_id);
    const config = await readScoreConfig(transaction, classRow.school_level);
    const subjects = await this.classSubjects(transaction, classRow, config);
    const subject = subjects.find((row) => row.subject_id === input.subject_id);
    if (!subject || subject.mode !== 'score') {
      throw ruleViolationError(SCORE_RULE_CODE, 'Môn không tính điểm số ở khối của lớp, không chuyển được điểm');
    }
    const access = await this.access(transaction, currentUser, classRow, subjects);
    if (!access.subjectIds.includes(input.subject_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên được phân công môn của lớp xác nhận chuyển điểm');
    }
    await this.assertWritable(transaction, access, classRow, input.term_type);
    const seq = input.kind === 'regular' ? input.seq : 1;
    const base = {
      updated_by: currentUser.id,
      updated_by_name: currentUser.description.full_name,
      updated_at: this.clock.now(),
    };
    for (const row of input.scores) {
      await transaction
        .insertInto('score_entries')
        .values({
          class_id: input.class_id,
          child_id: row.child_id,
          subject_id: input.subject_id,
          term_type: input.term_type,
          kind: input.kind,
          seq,
          score: row.score,
          source: 'exam',
          ...base,
        })
        .onConflict((conflict) =>
          conflict
            .columns(['child_id', 'subject_id', 'term_type', 'kind', 'seq'])
            .doUpdateSet({ score: row.score, source: 'exam', class_id: input.class_id, ...base }),
        )
        .execute();
    }
    return { written: input.scores.length };
  }

  // Điểm trung bình, kết quả từng môn và gợi ý xếp loại của từng học sinh trong học kỳ hoặc cả năm
  private async studentSummaries(
    database: Executor,
    classRow: ClassContext,
    config: ScoreConfig,
    term: RatingTermValue,
  ) {
    const subjects = await this.classSubjects(database, classRow, config);
    const terms: TermType[] = term === 'year' ? ['first_term', 'second_term'] : [term];
    const [students, entries, results, ratings] = await Promise.all([
      this.students(database, classRow.id),
      this.termScores(database, classRow.id, null, terms),
      database
        .selectFrom('subject_term_results')
        .select(['child_id', 'subject_id', 'term_type', 'result'])
        .where('class_id', '=', classRow.id)
        .where('term_type', 'in', terms)
        .execute(),
      database
        .selectFrom('term_ratings')
        .select(['child_id', 'learning_suggested', 'learning', 'conduct', 'comment'])
        .where('class_id', '=', classRow.id)
        .where('term_type', '=', term)
        .execute(),
    ]);
    const averageOf = (childId: string, subjectId: string, forTerm: TermType) => {
      const own = entries.filter(
        (entry) => entry.child_id === childId && entry.subject_id === subjectId && entry.term_type === forTerm,
      );
      return termAverage(
        {
          regular: own.filter((entry) => entry.kind === 'regular').map((entry) => Number(entry.score)),
          mid: own.find((entry) => entry.kind === 'mid')
            ? Number(own.find((entry) => entry.kind === 'mid')?.score)
            : null,
          final: own.find((entry) => entry.kind === 'final')
            ? Number(own.find((entry) => entry.kind === 'final')?.score)
            : null,
        },
        config,
      );
    };
    const passedOf = (childId: string, subjectId: string, forTerm: TermType) =>
      results.find((row) => row.child_id === childId && row.subject_id === subjectId && row.term_type === forTerm)
        ?.result ?? null;
    return {
      subjects,
      rows: students.map((student) => {
        const perSubject = subjects.map((subject) => {
          const average =
            term === 'year'
              ? yearAverage(
                  averageOf(student.child_id, subject.subject_id, 'first_term'),
                  averageOf(student.child_id, subject.subject_id, 'second_term'),
                  config,
                )
              : averageOf(student.child_id, subject.subject_id, term);
          const first = passedOf(student.child_id, subject.subject_id, 'first_term');
          const second = passedOf(student.child_id, subject.subject_id, 'second_term');
          const passed =
            term === 'year'
              ? first === null || second === null
                ? null
                : second
              : passedOf(student.child_id, subject.subject_id, term);
          return { subject_id: subject.subject_id, mode: subject.mode, average, passed };
        });
        const rating = ratings.find((row) => row.child_id === student.child_id);
        const forRating: RatingSubject[] = perSubject
          .filter((item) => !subjects.find((subject) => subject.subject_id === item.subject_id)?.is_elective)
          .map((item) => ({
            code: subjects.find((subject) => subject.subject_id === item.subject_id)?.subject_code ?? '',
            mode: item.mode,
            average: item.average,
            passed: item.passed,
          }));
        return {
          ...student,
          subjects: perSubject,
          suggested: suggestLearningRating(forRating, config),
          learning: rating?.learning ?? null,
          conduct: rating?.conduct ?? null,
          comment: rating?.comment ?? null,
        };
      }),
    };
  }

  // Tổng hợp cho các phần khác đọc (học bạ 21e): không kiểm quyền, nơi gọi tự kiểm; lớp phải thuộc THCS, THPT
  async summariesFor(database: Executor, classId: string, term: RatingTermValue) {
    const classRow = await this.findClass(database, classId);
    const config = await readScoreConfig(database, classRow.school_level);
    return { config, ...(await this.studentSummaries(database, classRow, config, term)) };
  }

  // Học kỳ II của lớp đã khoá điểm chưa (điều kiện lập học bạ, xét lên lớp, khen thưởng)
  async isYearLocked(database: Executor, classId: string): Promise<boolean> {
    return Boolean(await this.lockOf(database, classId, 'second_term'));
  }

  async summary(currentUser: CurrentUser, classId: string, term: RatingTermValue) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const config = await readScoreConfig(database, classRow.school_level);
    const subjects = await this.classSubjects(database, classRow, config);
    const access = await this.assertView(database, currentUser, classRow, subjects);
    const summary = await this.studentSummaries(database, classRow, config, term);
    return {
      term_type: term,
      locked: (await this.lockOf(database, classId, lockTerm(term))) ?? null,
      can_rate: access.manage || access.homeroom,
      subjects: summary.subjects.map(({ subject_id, subject_code, subject_name, mode }) => ({
        subject_id,
        subject_code,
        subject_name,
        mode,
      })),
      rows: summary.rows,
    };
  }

  // Xác nhận xếp loại học tập, rèn luyện, nhận xét của giáo viên chủ nhiệm; ghi kèm gợi ý của máy lúc ghi
  async saveRatings(
    currentUser: CurrentUser,
    classId: string,
    term: RatingTermValue,
    entries: Array<{
      child_id: string;
      learning: RatingValue | null;
      conduct: RatingValue | null;
      comment: string | null;
    }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const config = await readScoreConfig(database, classRow.school_level);
    const subjects = await this.classSubjects(database, classRow, config);
    const access = await this.access(database, currentUser, classRow, subjects);
    if (!access.manage && !access.homeroom) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm hoặc người quản lý xác nhận xếp loại');
    }
    await this.assertWritable(database, access, classRow, lockTerm(term));
    const summary = await this.studentSummaries(database, classRow, config, term);
    const known = new Set(summary.rows.map((row) => row.child_id));
    const errors: FieldError[] = [];
    entries.forEach((entry, index) => {
      if (!known.has(entry.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh không học lớp này' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const entry of entries) {
        const suggested = summary.rows.find((row) => row.child_id === entry.child_id)?.suggested ?? null;
        const values = {
          learning_suggested: suggested,
          learning: entry.learning,
          conduct: entry.conduct,
          comment: entry.comment,
          updated_by: currentUser.id,
          updated_by_name: currentUser.description.full_name,
          updated_at: now,
        };
        await transaction
          .insertInto('term_ratings')
          .values({ ...values, class_id: classId, child_id: entry.child_id, term_type: term })
          .onConflict((conflict) => conflict.columns(['class_id', 'child_id', 'term_type']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'term_ratings',
        entityId: classId,
        action: 'update',
        before: null,
        after: { term_type: term, entries },
      });
    });
    return this.summary(currentUser, classId, term);
  }

  async lock(
    currentUser: CurrentUser,
    term: TermType,
    level: SchoolLevelCode,
    classIds: string[] | null,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.assessmentManage);
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id'])
      .where('school_level', '=', level)
      .where('status', '=', 'active')
      .$if(classIds !== null, (query) =>
        query.where('id', 'in', [...(classIds ?? []), '00000000-0000-0000-0000-000000000000']),
      )
      .$if(!scope.wholeSchool, (query) =>
        query.where('org_unit_id', 'in', [...scope.orgUnitIds, '00000000-0000-0000-0000-000000000000']),
      )
      .execute();
    if (classIds !== null && classes.length !== classIds.length) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Có lớp không thuộc cấp đã chọn hoặc ngoài phạm vi của bạn');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      if (classes.length > 0) {
        await transaction
          .insertInto('score_locks')
          .values(
            classes.map((row) => ({
              class_id: row.id,
              term_type: term,
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
        entityName: 'score_locks',
        entityId: randomUUID(),
        action: 'create',
        before: null,
        after: { term_type: term, class_ids: classes.map((row) => row.id) },
      });
    });
    return { term_type: term, locked_class_count: classes.length };
  }

  async locks(currentUser: CurrentUser, term: TermType, level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.assessmentManage);
    const classes = await database
      .selectFrom('classes')
      .leftJoin('score_locks', (join) =>
        join.onRef('score_locks.class_id', '=', 'classes.id').on('score_locks.term_type', '=', term),
      )
      .select([
        'classes.id as class_id',
        'classes.name as class_name',
        'score_locks.locked_by_name',
        'score_locks.locked_at',
      ])
      .where('classes.school_level', '=', level)
      .where('classes.status', '=', 'active')
      .$if(!scope.wholeSchool, (query) =>
        query.where('classes.org_unit_id', 'in', [...scope.orgUnitIds, '00000000-0000-0000-0000-000000000000']),
      )
      .orderBy('classes.grade_level')
      .orderBy('classes.name')
      .execute();
    return { term_type: term, classes };
  }

  async unlock(currentUser: CurrentUser, term: TermType, classId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    if (!(await this.inScope(currentUser, PERMISSION_CODES.assessmentManage, classRow.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp ngoài phạm vi của bạn');
    }
    const lock = await this.lockOf(database, classId, term);
    if (!lock) {
      throw ruleViolationError(SCORE_RULE_CODE, 'Học kỳ của lớp chưa khoá điểm');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('score_locks')
        .where('class_id', '=', classId)
        .where('term_type', '=', term)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'score_locks',
        entityId: classId,
        action: 'delete',
        before: { term_type: term, ...lock },
        after: { term_type: term, reason },
      });
    });
    return { term_type: term, class_id: classId, unlocked: true };
  }

  // Phụ huynh: điểm các học kỳ đã khoá của lớp đang học; xếp loại cả năm khi học kỳ II đã khoá
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
      return { terms: [] };
    }
    const classRow = await this.findClass(database, enrollment.class_id);
    const config = await readScoreConfig(database, classRow.school_level);
    const locked = (
      await database.selectFrom('score_locks').select('term_type').where('class_id', '=', classRow.id).execute()
    ).map((row) => row.term_type);
    const termList = (['first_term', 'second_term'] as const).filter((term) => locked.includes(term));
    if (termList.length === 0) {
      return { class_name: classRow.name, terms: [] };
    }
    const subjects = await this.classSubjects(database, classRow, config);
    const [entries, results, ratings] = await Promise.all([
      database
        .selectFrom('score_entries')
        .select(['subject_id', 'term_type', 'kind', 'seq', 'score'])
        .where('child_id', '=', childId)
        .where('class_id', '=', classRow.id)
        .where('term_type', 'in', termList)
        .orderBy('seq')
        .execute(),
      database
        .selectFrom('subject_term_results')
        .select(['subject_id', 'term_type', 'result', 'comment'])
        .where('child_id', '=', childId)
        .where('class_id', '=', classRow.id)
        .where('term_type', 'in', termList)
        .execute(),
      database
        .selectFrom('term_ratings')
        .select(['term_type', 'learning', 'conduct', 'comment'])
        .where('child_id', '=', childId)
        .where('class_id', '=', classRow.id)
        .execute(),
    ]);
    const termView = (term: TermType) => ({
      term_type: term,
      subjects: subjects.map((subject) => {
        const own = entries.filter((entry) => entry.subject_id === subject.subject_id && entry.term_type === term);
        const scores = {
          regular: own.filter((entry) => entry.kind === 'regular').map((entry) => Number(entry.score)),
          mid: own.find((entry) => entry.kind === 'mid')
            ? Number(own.find((entry) => entry.kind === 'mid')?.score)
            : null,
          final: own.find((entry) => entry.kind === 'final')
            ? Number(own.find((entry) => entry.kind === 'final')?.score)
            : null,
        };
        const result = results.find((row) => row.subject_id === subject.subject_id && row.term_type === term);
        return {
          subject_name: subject.subject_name,
          mode: subject.mode,
          ...scores,
          average: termAverage(scores, config),
          result: result?.result ?? null,
          comment: result?.comment ?? null,
        };
      }),
      rating: ratings.find((row) => row.term_type === term) ?? null,
    });
    return {
      class_name: classRow.name,
      terms: termList.map(termView),
      year_rating: locked.includes('second_term') ? (ratings.find((row) => row.term_type === 'year') ?? null) : null,
    };
  }
}

function readNumber(value: unknown, field: string, errors: FieldError[]): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isValidScore(value)) {
    errors.push({ field, message: 'Điểm là số từ 0 đến 10, một chữ số thập phân' });
    return null;
  }
  return value;
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

function readLevel(value: unknown): SchoolLevelCode {
  if (value === 'THCS' || value === 'THPT') {
    return value;
  }
  throw validationError([{ field: 'school_level', message: 'Cấp học là THCS hoặc THPT' }]);
}

function entriesOf(body: RequestBody): unknown[] {
  if (!Array.isArray(body?.entries) || body.entries.length > 200) {
    throw validationError([{ field: 'entries', message: 'Cần danh sách tối đa 200 dòng' }]);
  }
  return body.entries as unknown[];
}

function throwIf(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller('scores')
export class ScoresController {
  constructor(private readonly scores: ScoresService) {}

  @Get('config')
  config(@Query('school_level') level: string | undefined) {
    return this.scores.config(readLevel(level));
  }

  @Put('config')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  saveConfig(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const level = readLevel(body?.school_level);
    throwIf(validateScoreConfig(body?.config));
    return this.scores.saveConfig(level, body?.config as ScoreConfig, currentUser, originOf(request, currentUser));
  }

  @Get('classes/:id')
  overview(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.scores.overview(currentUser, classId);
  }

  @Get('classes/:id/subjects/:subjectId')
  sheet(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('subjectId', uuidParameter('Mã môn không hợp lệ')) subjectId: string,
    @Query('term_type') term: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.scores.sheet(currentUser, classId, subjectId, readTermType(term, false) as TermType);
  }

  @Put('classes/:id/subjects/:subjectId')
  saveSheet(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Param('subjectId', uuidParameter('Mã môn không hợp lệ')) subjectId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const term = readTermType(body?.term_type, false) as TermType;
    const errors: FieldError[] = [];
    const entries = entriesOf(body).map((value, index) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
      const prefix = `entries[${index}]`;
      if (!isUuid(item.child_id)) {
        errors.push({ field: `${prefix}.child_id`, message: 'Mã học sinh không hợp lệ' });
      }
      const regularRaw = item.regular === undefined ? [] : item.regular;
      if (!Array.isArray(regularRaw) || regularRaw.length > MAX_REGULAR_SCORES) {
        errors.push({ field: `${prefix}.regular`, message: `Tối đa ${MAX_REGULAR_SCORES} điểm đánh giá thường xuyên` });
      }
      const regular = (Array.isArray(regularRaw) ? regularRaw : [])
        .slice(0, MAX_REGULAR_SCORES)
        .map((score, position) => readNumber(score, `${prefix}.regular[${position}]`, errors));
      const result = item.result === undefined || item.result === null || item.result === '' ? null : item.result;
      if (result !== null && result !== 'pass' && result !== 'fail') {
        errors.push({ field: `${prefix}.result`, message: 'Kết quả là pass hoặc fail' });
      }
      return {
        child_id: String(item.child_id),
        regular,
        mid: readNumber(item.mid, `${prefix}.mid`, errors),
        final: readNumber(item.final, `${prefix}.final`, errors),
        result: result === 'pass' || result === 'fail' ? result : null,
        comment: readComment(item.comment, `${prefix}.comment`, errors),
      } as const;
    });
    throwIf(errors);
    return this.scores.saveSheet(
      currentUser,
      classId,
      subjectId,
      term,
      entries.map((entry) => ({ ...entry, result: entry.result as 'pass' | 'fail' | null })),
      originOf(request, currentUser),
    );
  }

  @Get('classes/:id/summary')
  summary(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('term_type') term: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.scores.summary(currentUser, classId, readTermType(term, true));
  }

  @Put('classes/:id/ratings')
  saveRatings(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const term = readTermType(body?.term_type, true);
    const errors: FieldError[] = [];
    const entries = entriesOf(body).map((value, index) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
      const prefix = `entries[${index}]`;
      if (!isUuid(item.child_id)) {
        errors.push({ field: `${prefix}.child_id`, message: 'Mã học sinh không hợp lệ' });
      }
      const rating = (field: 'learning' | 'conduct'): RatingValue | null => {
        const raw = item[field];
        if (raw === undefined || raw === null || raw === '') {
          return null;
        }
        if (!isRatingCode(raw)) {
          errors.push({ field: `${prefix}.${field}`, message: 'Mức là good, fair, pass hoặc fail' });
          return null;
        }
        return raw;
      };
      return {
        child_id: String(item.child_id),
        learning: rating('learning'),
        conduct: rating('conduct'),
        comment: readComment(item.comment, `${prefix}.comment`, errors),
      };
    });
    throwIf(errors);
    return this.scores.saveRatings(currentUser, classId, term, entries, originOf(request, currentUser));
  }

  @Get('locks')
  locks(
    @Query('term_type') term: string | undefined,
    @Query('school_level') level: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.scores.locks(currentUser, readTermType(term, false) as TermType, readLevel(level));
  }

  @Post('locks')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  lock(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const term = readTermType(body?.term_type, false) as TermType;
    const level = readLevel(body?.school_level);
    let classIds: string[] | null = null;
    if (body?.class_ids !== undefined) {
      if (!Array.isArray(body.class_ids) || body.class_ids.some((id) => !isUuid(id))) {
        throw validationError([{ field: 'class_ids', message: 'Danh sách mã lớp không hợp lệ' }]);
      }
      classIds = [...new Set(body.class_ids as string[])];
    }
    return this.scores.lock(currentUser, term, level, classIds, originOf(request, currentUser));
  }

  @Post('locks/unlock')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  unlock(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const term = readTermType(body?.term_type, false) as TermType;
    const errors: FieldError[] = [];
    if (!isUuid(body?.class_id)) {
      errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
    }
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 3 || reason.length > 500) {
      errors.push({ field: 'reason', message: 'Lý do mở khoá từ 3 đến 500 ký tự' });
    }
    throwIf(errors);
    return this.scores.unlock(currentUser, term, String(body?.class_id), reason, originOf(request, currentUser));
  }

  @Get('children/:id')
  forParent(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.scores.forParent(currentUser, childId);
  }
}
