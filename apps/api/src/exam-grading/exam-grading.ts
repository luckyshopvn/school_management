import { Injectable } from '@nestjs/common';
import type { ExamSessionStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { TRUE_FALSE_KEYS } from '../exams/exam-inputs.js';
import { COGNITIVE_LABELS, OPTION_KEYS, QUESTION_TYPE_LABELS, type VariantItem } from '../exams/exam-rules.js';
import type { QuestionSnapshot } from '../exams/exams.js';
import { buildTableFile, CONTENT_TYPES, withExtension, type TableFileFormat } from '../exports/table-file.js';
import { buildTemplate, readSheet, type ImportColumn, type RowError } from '../imports/excel.js';
import { buildDocumentPdf, PDF_TYPE, type DocumentBlock } from '../kpi/kpi-documents.js';
import { ScoresService } from '../scores/scores.js';
import {
  gradeSheet,
  groupRates,
  normalizeTrueFalse,
  questionStats,
  roundScore,
  scoreDistribution,
  type GradedQuestion,
  type QuestionResult,
  type SheetInput,
  type TrueFalseRule,
} from './grading-rules.js';

// Chấm bài kiểm tra (DT-21 phần 22g2, YCTD-173). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - bài kiểm tra của lớp dùng một đề đã khoá của 22g1 (đúng cấp, khối, đã trộn mã đề); mỗi đề một lần cho mỗi lớp; người tạo
//   là giáo viên được phân công môn của đề ở lớp (hoặc chủ nhiệm), người quản lý tạo cho mọi lớp;
// - phiếu trả lời in theo mã đề thứ nhất (các mã cùng dạng câu theo số câu); chấm theo phiếu: nhập tay từng bài hoặc nhập tệp
//   quét theo mẫu Excel (mỗi dòng một học sinh, mã đề, đáp án từng câu; ô câu tự luận ghi điểm). Nhận dạng ảnh chụp phiếu
//   (OMR) chưa làm ở phần này: phần mềm đọc phiếu xuất ra tệp theo mẫu rồi nhập vào;
// - điểm tự luận nhập theo câu, chấm hai người thì nhập điểm người thứ hai, lệch quá ngưỡng thì phải xem lại trước khi khoá;
// - khoá: người quản lý khoá khi mọi học sinh đã có bài (hoặc ghi vắng), không còn bài thiếu điểm tự luận hay cần xem lại;
//   khoá xong ghi số bài, độ khó, độ phân biệt của từng câu vào lịch sử dùng câu (gộp mọi bài đã khoá của đề); mở khoá phải
//   ghi lý do, đã chuyển điểm thì không mở được;
// - chuyển điểm: bài đã khoá, giáo viên được phân công môn của lớp (hoặc người quản lý sổ điểm) xác nhận; điểm ghi qua sổ
//   điểm 21c (một cửa), đúng học kỳ, loại điểm, lần; học sinh vắng bỏ qua hoặc ghi 0 theo cấu hình của bài; kiểm tra bù thì
//   mở khoá, nhập bài, khoá và chuyển lại;
// - báo cáo theo đề: từng câu (độ khó, độ phân biệt, câu nên xem lại), chủ đề, mức nhận thức, từng lớp (giáo viên), phân bố
//   điểm; chỉ tính bài kiểm tra đã khoá; xuất Excel, PDF.
export const GRADING_RULE_CODE = 'YCTD-173';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const GRADE = PERMISSION_CODES.examGrade;
const REVIEW = PERMISSION_CODES.examReview;
const MANAGE = PERMISSION_CODES.examManage;
const PASS_SCORE = 5;

export interface SessionInput {
  exam_id: string;
  class_id: string;
  term_type: 'first_term' | 'second_term';
  score_kind: 'regular' | 'mid' | 'final';
  score_seq: number;
  true_false_rule: TrueFalseRule;
  double_marking: boolean;
  mark_tolerance: number;
  absent_policy: 'skip' | 'zero';
}

export interface SheetBody {
  variant_code: string | null;
  absent: boolean;
  answers: Record<string, string[]>;
  essay: Record<string, { first: number | null; second: number | null }>;
}

const SESSION_COLUMNS = [
  'exam_sessions.id',
  'exam_sessions.exam_id',
  'exam_sessions.class_id',
  'exam_sessions.subject_id',
  'exam_sessions.term_type',
  'exam_sessions.score_kind',
  'exam_sessions.score_seq',
  'exam_sessions.true_false_rule',
  'exam_sessions.double_marking',
  'exam_sessions.mark_tolerance',
  'exam_sessions.absent_policy',
  'exam_sessions.status',
  'exam_sessions.locked_at',
  'exam_sessions.locked_by_name',
  'exam_sessions.transferred_at',
  'exam_sessions.transferred_by_name',
  'exam_sessions.created_by',
  'exam_sessions.created_by_name',
  'exam_sessions.updated_at',
  'exams.title as exam_title',
  'exams.school_level',
  'exams.grade_level_code',
  'classes.name as class_name',
  'classes.org_unit_id',
  'subjects.name as subject_name',
] as const;

type Variant = { code: string; items: VariantItem[] };

// Ô đáp án của tệp quét: nhiều lựa chọn ghi khoá (B hoặc A,B), đúng sai ghi Đ/S từng ý (Đ,S,Đ,Đ hoặc ĐSĐĐ), trả lời ngắn ghi
// đáp số
export function parseAnswerCell(type: GradedQuestion['question_type'], text: string): string[] {
  const value = text.trim();
  if (value === '') return [];
  if (type === 'short_answer') return [value];
  const parts = /[,;\s]/.test(value) ? value.split(/[,;\s]+/) : [...value];
  return parts.map((part) => part.trim()).filter(Boolean);
}

@Injectable()
export class ExamGradingService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly scores: ScoresService,
    private readonly clock: Clock,
  ) {}

  // Đề đã khoá của cấp, đủ điều kiện tạo bài kiểm tra cho lớp
  async lockedExams(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('exams')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([
        'exams.id',
        'exams.title',
        'exams.subject_id',
        'exams.grade_level_code',
        'exams.locked_at',
        'subjects.name as subject_name',
      ])
      .where('exams.school_level', '=', level)
      .where('exams.status', '=', 'locked')
      .orderBy('exams.locked_at', 'desc')
      .execute();
  }

  // Lớp tạo được bài kiểm tra của đề: cùng cấp, khối; người không có quyền quản lý chỉ thấy lớp mình dạy môn của đề hoặc chủ
  // nhiệm
  async classesFor(currentUser: CurrentUser, examId: string) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'name'])
      .where('school_level', '=', exam.school_level)
      .where('grade_level', '=', exam.grade_level_code)
      .where('status', '=', 'active')
      .orderBy('name')
      .execute();
    if (currentUser.hasPermission(MANAGE)) {
      return classes;
    }
    const assigned = await this.assignedClassIds(database, currentUser, exam.subject_id);
    return classes.filter((row) => assigned.has(row.id));
  }

  private async assignedClassIds(database: Executor, currentUser: CurrentUser, subjectId: string) {
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select(['class_id', 'assignment_role', 'subject_id'])
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .execute();
    return new Set(
      rows
        .filter((row) => row.assignment_role === 'homeroom' || row.subject_id === subjectId)
        .map((row) => row.class_id),
    );
  }

  private async findExam(database: Executor, examId: string) {
    const exam = await database
      .selectFrom('exams')
      .select(['id', 'title', 'school_level', 'subject_id', 'grade_level_code', 'status'])
      .where('id', '=', examId)
      .executeTakeFirst();
    if (!exam) {
      throw notFoundError('Không tìm thấy đề', 'exam');
    }
    return exam;
  }

  private async examContent(database: Executor, examId: string) {
    const [rows, variants] = await Promise.all([
      database
        .selectFrom('exam_questions')
        .select(['question_id', 'order_no', 'score', 'snapshot'])
        .where('exam_id', '=', examId)
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('exam_variants')
        .select(['code', 'items'])
        .where('exam_id', '=', examId)
        .orderBy('code')
        .execute(),
    ]);
    const questions: GradedQuestion[] = rows.map((row) => {
      const snapshot = row.snapshot as QuestionSnapshot;
      return {
        question_id: row.question_id,
        question_type: snapshot.question_type,
        cognitive_level: snapshot.cognitive_level,
        topic_name: snapshot.topic_name,
        score: Number(row.score),
      };
    });
    const snapshots = new Map(rows.map((row) => [row.question_id, row.snapshot as QuestionSnapshot]));
    return { questions, snapshots, variants: variants as Variant[] };
  }

  async listSessions(currentUser: CurrentUser, level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    let query = this.sessionQuery(database).where('exams.school_level', '=', level);
    if (!currentUser.hasPermission(MANAGE) && !currentUser.hasPermission(REVIEW)) {
      query = query.where((expression) =>
        expression.or([
          expression('exam_sessions.created_by', '=', currentUser.id),
          expression(
            'exam_sessions.class_id',
            'in',
            database
              .selectFrom('class_staff_assignments')
              .select('class_id')
              .where('staff_user_id', '=', currentUser.id)
              .where('status', '=', 'active'),
          ),
        ]),
      );
    }
    const rows = await query.orderBy('exam_sessions.updated_at', 'desc').execute();
    const counts = await this.sheetCounts(
      database,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({ ...this.publicSession(row), ...(counts.get(row.id) ?? { graded: 0, average: null }) }));
  }

  private sessionQuery(database: Executor) {
    return database
      .selectFrom('exam_sessions')
      .innerJoin('exams', 'exams.id', 'exam_sessions.exam_id')
      .innerJoin('classes', 'classes.id', 'exam_sessions.class_id')
      .innerJoin('subjects', 'subjects.id', 'exam_sessions.subject_id')
      .select(SESSION_COLUMNS);
  }

  private publicSession<Row extends { mark_tolerance: string; org_unit_id: string }>(
    row: Row,
  ): Omit<Row, 'org_unit_id' | 'mark_tolerance'> & { mark_tolerance: number } {
    const copy: Record<string, unknown> = { ...row, mark_tolerance: Number(row.mark_tolerance) };
    delete copy.org_unit_id;
    return copy as Omit<Row, 'org_unit_id' | 'mark_tolerance'> & { mark_tolerance: number };
  }

  private async sheetCounts(database: Executor, sessionIds: string[]) {
    const result = new Map<string, { graded: number; average: number | null }>();
    if (sessionIds.length === 0) return result;
    const rows = await database
      .selectFrom('exam_sheets')
      .select(['session_id', 'total_score', 'absent'])
      .where('session_id', 'in', sessionIds)
      .execute();
    for (const sessionId of sessionIds) {
      const own = rows.filter((row) => row.session_id === sessionId && !row.absent && row.total_score !== null);
      result.set(sessionId, {
        graded: own.length,
        average:
          own.length > 0 ? roundScore(own.reduce((sum, row) => sum + Number(row.total_score), 0) / own.length) : null,
      });
    }
    return result;
  }

  private async findSession(database: Executor, sessionId: string) {
    const row = await this.sessionQuery(database).where('exam_sessions.id', '=', sessionId).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy bài kiểm tra của lớp', 'exam_session');
    }
    return row;
  }

  private async assertCanSee(
    database: Executor,
    currentUser: CurrentUser,
    session: { created_by: string; class_id: string },
  ) {
    if (
      currentUser.hasPermission(MANAGE) ||
      currentUser.hasPermission(REVIEW) ||
      session.created_by === currentUser.id
    ) {
      return;
    }
    const assignment = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', session.class_id)
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!assignment) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không dạy lớp của bài kiểm tra này');
    }
  }

  private async assertCanGrade(
    database: Executor,
    currentUser: CurrentUser,
    session: { created_by: string; class_id: string; subject_id: string; status: ExamSessionStatus },
  ) {
    if (session.status !== 'grading') {
      throw ruleViolationError(GRADING_RULE_CODE, 'Bài kiểm tra đã khoá điểm, không sửa được bài làm');
    }
    if (currentUser.hasPermission(MANAGE) || session.created_by === currentUser.id) {
      return;
    }
    if (!currentUser.hasPermission(GRADE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền chấm bài kiểm tra');
    }
    const assigned = await this.assignedClassIds(database, currentUser, session.subject_id);
    if (!assigned.has(session.class_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy môn của lớp chấm bài kiểm tra này');
    }
  }

  async createSession(currentUser: CurrentUser, input: SessionInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, input.exam_id);
    if (exam.status !== 'locked') {
      throw ruleViolationError(GRADING_RULE_CODE, 'Chỉ dùng được đề đã khoá');
    }
    if (exam.school_level !== 'THCS' && exam.school_level !== 'THPT') {
      throw ruleViolationError(GRADING_RULE_CODE, 'Chấm bài kiểm tra có ở THCS, THPT');
    }
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'school_level', 'grade_level'])
      .where('id', '=', input.class_id)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    if (classRow.school_level !== exam.school_level || classRow.grade_level !== exam.grade_level_code) {
      throw validationError([{ field: 'class_id', message: 'Lớp khác cấp hoặc khác khối của đề' }]);
    }
    if (!currentUser.hasPermission(MANAGE)) {
      const assigned = await this.assignedClassIds(database, currentUser, exam.subject_id);
      if (!assigned.has(input.class_id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên dạy môn của đề ở lớp tạo bài kiểm tra');
      }
    }
    const variants = await database
      .selectFrom('exam_variants')
      .select('code')
      .where('exam_id', '=', exam.id)
      .executeTakeFirst();
    if (!variants) {
      throw ruleViolationError(GRADING_RULE_CODE, 'Đề chưa trộn mã đề');
    }
    const duplicate = await database
      .selectFrom('exam_sessions')
      .select('id')
      .where('exam_id', '=', exam.id)
      .where('class_id', '=', input.class_id)
      .executeTakeFirst();
    if (duplicate) {
      throw ruleViolationError(GRADING_RULE_CODE, 'Lớp đã có bài kiểm tra của đề này');
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('exam_sessions')
        .values({
          ...input,
          score_seq: input.score_kind === 'regular' ? input.score_seq : 1,
          subject_id: exam.subject_id,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'exam_sessions',
        entityId: row.id,
        action: 'create',
        before: null,
        after: input,
      });
      return row;
    });
    return this.session(currentUser, created.id);
  }

  private async students(database: Executor, classId: string) {
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id as child_id', 'children.full_name', 'children.moet_student_code'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .orderBy('children.full_name')
      .execute();
  }

  private async sheets(database: Executor, sessionId: string) {
    return database
      .selectFrom('exam_sheets')
      .select([
        'child_id',
        'variant_code',
        'absent',
        'answers',
        'essay',
        'objective_score',
        'essay_score',
        'total_score',
        'results',
        'needs_review',
        'source',
        'updated_by_name',
        'updated_at',
      ])
      .where('session_id', '=', sessionId)
      .execute();
  }

  // Chi tiết bài kiểm tra của lớp: cấu hình, các câu theo số câu của từng mã đề (không lộ nội dung câu), bài làm của từng học
  // sinh, các điều còn chặn khoá điểm
  async session(currentUser: CurrentUser, sessionId: string) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    await this.assertCanSee(database, currentUser, session);
    const [{ questions, variants }, students, sheets] = await Promise.all([
      this.examContent(database, session.exam_id),
      this.students(database, session.class_id),
      this.sheets(database, sessionId),
    ]);
    const rows = students.map((student) => {
      const sheet = sheets.find((row) => row.child_id === student.child_id);
      return {
        ...student,
        sheet: sheet
          ? {
              ...sheet,
              objective_score: sheet.objective_score === null ? null : Number(sheet.objective_score),
              essay_score: sheet.essay_score === null ? null : Number(sheet.essay_score),
              total_score: sheet.total_score === null ? null : Number(sheet.total_score),
            }
          : null,
      };
    });
    return {
      ...this.publicSession(session),
      total_score: Math.round(questions.reduce((sum, row) => sum + row.score, 0) * 100) / 100,
      variants: variants.map((variant) => ({
        code: variant.code,
        items: variant.items.map((item) => {
          const question = questions.find((row) => row.question_id === item.question_id);
          return {
            number: item.number,
            question_id: item.question_id,
            question_type: question?.question_type ?? 'essay',
            option_count: item.option_order.length || item.answer.length,
            score: question?.score ?? 0,
          };
        }),
      })),
      students: rows,
      blockers: this.blockers(rows),
    };
  }

  private blockers(
    rows: Array<{
      full_name: string;
      sheet: { absent: boolean; needs_review: boolean; total_score: number | null; results: unknown } | null;
    }>,
  ) {
    const missing = rows.filter((row) => !row.sheet).map((row) => row.full_name);
    const review = rows
      .filter((row) => row.sheet && !row.sheet.absent && row.sheet.needs_review)
      .map((row) => row.full_name);
    const incomplete = rows
      .filter((row) => row.sheet && !row.sheet.absent && row.sheet.total_score === null)
      .map((row) => row.full_name);
    return { missing, review, incomplete };
  }

  // Chấm và ghi một bài; điểm tổng để trống khi còn câu tự luận chưa có điểm (đủ người chấm)
  private grade(
    session: { true_false_rule: TrueFalseRule; double_marking: boolean; mark_tolerance: string },
    content: { questions: GradedQuestion[]; variants: Variant[] },
    body: SheetBody,
    field: string,
  ) {
    if (body.absent) {
      return {
        variant_code: body.variant_code,
        answers: {},
        essay: {},
        objective_score: null,
        essay_score: null,
        total_score: null,
        results: [] as QuestionResult[],
        needs_review: false,
      };
    }
    const variant = content.variants.find((row) => row.code === body.variant_code);
    if (!variant) {
      throw validationError([{ field: `${field}.variant_code`, message: 'Mã đề không có trong đề' }]);
    }
    const errors: FieldError[] = [];
    for (const [questionId, marks] of Object.entries(body.essay)) {
      const question = content.questions.find((row) => row.question_id === questionId);
      if (!question || question.question_type !== 'essay') {
        errors.push({ field: `${field}.essay`, message: 'Điểm tự luận ghi cho câu không phải tự luận của đề' });
        continue;
      }
      for (const mark of [marks.first, marks.second]) {
        if (mark !== null && (mark < 0 || mark > question.score)) {
          errors.push({ field: `${field}.essay`, message: `Điểm câu tự luận từ 0 đến ${question.score}` });
        }
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const answers = Object.fromEntries(
      Object.entries(body.answers).map(([number, values]) => [Number(number), values]),
    ) as SheetInput['answers'];
    const graded = gradeSheet(
      variant.items,
      content.questions,
      { answers, essay: body.essay },
      {
        rule: session.true_false_rule,
        doubleMarking: session.double_marking,
        tolerance: Number(session.mark_tolerance),
      },
    );
    return {
      variant_code: body.variant_code,
      answers: body.answers,
      essay: body.essay,
      objective_score: graded.objective,
      essay_score: graded.essay,
      total_score: graded.missing_essay > 0 ? null : graded.total,
      results: graded.results,
      needs_review: graded.needs_review,
    };
  }

  async saveSheet(currentUser: CurrentUser, sessionId: string, childId: string, body: SheetBody, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    await this.assertCanGrade(database, currentUser, session);
    const students = await this.students(database, session.class_id);
    if (!students.some((row) => row.child_id === childId)) {
      throw validationError([{ field: 'child_id', message: 'Học sinh không học lớp này' }]);
    }
    const content = await this.examContent(database, session.exam_id);
    const graded = this.grade(session, content, body, 'sheet');
    await database.transaction().execute(async (transaction) => {
      await this.writeSheet(transaction, currentUser, sessionId, childId, body.absent, graded, 'manual');
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: session.org_unit_id,
        entityName: 'exam_sheets',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { child_id: childId, ...body },
      });
    });
    return this.session(currentUser, sessionId);
  }

  private async writeSheet(
    transaction: Executor,
    currentUser: CurrentUser,
    sessionId: string,
    childId: string,
    absent: boolean,
    graded: ReturnType<ExamGradingService['grade']>,
    source: 'manual' | 'import',
  ) {
    const values = {
      ...graded,
      absent,
      answers: JSON.stringify(graded.answers),
      essay: JSON.stringify(graded.essay),
      results: JSON.stringify(graded.results),
      source,
      updated_by: currentUser.id,
      updated_by_name: currentUser.description.full_name,
      updated_at: this.clock.now(),
    };
    await transaction
      .insertInto('exam_sheets')
      .values({ ...values, session_id: sessionId, child_id: childId })
      .onConflict((conflict) => conflict.columns(['session_id', 'child_id']).doUpdateSet(values))
      .execute();
    await transaction
      .updateTable('exam_sessions')
      .set({ updated_at: this.clock.now() })
      .where('id', '=', sessionId)
      .execute();
  }

  private importColumns(count: number): ImportColumn[] {
    return [
      { key: 'child_id', header: 'Mã hệ thống', note: 'Mã học sinh trong hệ thống, giữ nguyên như tệp mẫu' },
      { key: 'full_name', header: 'Họ và tên', note: 'Chỉ để đối chiếu, không đọc' },
      { key: 'variant_code', header: 'Mã đề', note: 'Mã đề học sinh làm' },
      { key: 'absent', header: 'Vắng', note: 'Ghi x nếu học sinh vắng' },
      ...Array.from({ length: count }, (_unused, index) => ({
        key: `q${index + 1}`,
        header: `Câu ${index + 1}`,
        note: 'Nhiều lựa chọn: khoá đã tô (ví dụ B); đúng sai: Đ hoặc S từng ý (ví dụ Đ,S,Đ,Đ); trả lời ngắn: đáp số; câu tự luận: điểm của người chấm thứ nhất',
      })),
    ];
  }

  // Tệp mẫu nhập kết quả quét phiếu: kèm danh sách học sinh của lớp
  async importTemplate(currentUser: CurrentUser, sessionId: string) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    await this.assertCanSee(database, currentUser, session);
    const [{ variants }, students] = await Promise.all([
      this.examContent(database, session.exam_id),
      this.students(database, session.class_id),
    ]);
    const count = Math.max(0, ...variants.map((variant) => variant.items.length));
    return buildTemplate('Kết quả quét phiếu', this.importColumns(count), {
      rows: students.map((student) => ({ child_id: student.child_id, full_name: student.full_name })),
      catalogs: [
        {
          key: 'variants',
          title: 'Mã đề',
          column: 'Mã đề',
          items: variants.map((variant) => ({ code: variant.code, name: `Mã đề ${variant.code}` })),
        },
      ],
    });
  }

  // Nhập tệp quét phiếu: mọi dòng hợp lệ mới ghi; bài đã có điểm tự luận người thứ hai giữ nguyên điểm đó
  async importSheets(currentUser: CurrentUser, sessionId: string, body: Buffer, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    await this.assertCanGrade(database, currentUser, session);
    const [content, students, existing] = await Promise.all([
      this.examContent(database, session.exam_id),
      this.students(database, session.class_id),
      this.sheets(database, sessionId),
    ]);
    const count = Math.max(0, ...content.variants.map((variant) => variant.items.length));
    const rows = await readSheet(body, this.importColumns(count));
    const errors: RowError[] = [];
    const prepared: Array<{ childId: string; body: SheetBody; graded: ReturnType<ExamGradingService['grade']> }> = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const childId = row.values.child_id ?? '';
      if (!students.some((student) => student.child_id === childId)) {
        errors.push({ row: row.row, column: 'Mã hệ thống', message: 'Học sinh không học lớp này' });
        continue;
      }
      if (seen.has(childId)) {
        errors.push({ row: row.row, column: 'Mã hệ thống', message: 'Học sinh ghi hai lần trong tệp' });
        continue;
      }
      seen.add(childId);
      const absent = (row.values.absent ?? '').trim() !== '';
      const variantCode = (row.values.variant_code ?? '').trim() || null;
      const variant = content.variants.find((item) => item.code === variantCode);
      if (!absent && !variant) {
        errors.push({ row: row.row, column: 'Mã đề', message: 'Mã đề không có trong đề' });
        continue;
      }
      const answers: SheetBody['answers'] = {};
      const essay: SheetBody['essay'] = {};
      const previous = existing.find((sheet) => sheet.child_id === childId);
      const previousEssay = (previous?.essay ?? {}) as SheetBody['essay'];
      let rowValid = true;
      for (const item of absent ? [] : (variant?.items ?? [])) {
        const question = content.questions.find((entry) => entry.question_id === item.question_id);
        const text = row.values[`q${item.number}`] ?? '';
        if (!question) continue;
        if (question.question_type === 'essay') {
          if (text.trim() === '') continue;
          const mark = Number(text.replace(',', '.'));
          if (!Number.isFinite(mark) || mark < 0 || mark > question.score) {
            errors.push({
              row: row.row,
              column: `Câu ${item.number}`,
              message: `Điểm tự luận từ 0 đến ${question.score}`,
            });
            rowValid = false;
            continue;
          }
          essay[item.question_id] = { first: mark, second: previousEssay[item.question_id]?.second ?? null };
          continue;
        }
        const values = parseAnswerCell(question.question_type, text);
        if (question.question_type === 'multiple_choice') {
          const allowed = OPTION_KEYS.slice(0, item.option_order.length);
          if (values.some((value) => !allowed.includes(value.toUpperCase()))) {
            errors.push({ row: row.row, column: `Câu ${item.number}`, message: `Chỉ ghi ${allowed.join(', ')}` });
            rowValid = false;
            continue;
          }
        }
        if (question.question_type === 'true_false' && values.some((value) => normalizeTrueFalse(value) === null)) {
          errors.push({ row: row.row, column: `Câu ${item.number}`, message: 'Mỗi ý ghi Đ hoặc S' });
          rowValid = false;
          continue;
        }
        if (values.length > 0) answers[String(item.number)] = values;
      }
      if (!rowValid) continue;
      const sheetBody: SheetBody = { variant_code: variantCode, absent, answers, essay };
      prepared.push({ childId, body: sheetBody, graded: this.grade(session, content, sheetBody, `rows[${row.row}]`) });
    }
    if (errors.length > 0) {
      return { imported: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      for (const entry of prepared) {
        await this.writeSheet(
          transaction,
          currentUser,
          sessionId,
          entry.childId,
          entry.body.absent,
          entry.graded,
          'import',
        );
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: session.org_unit_id,
        entityName: 'exam_sheets',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { imported: prepared.length },
      });
    });
    return { imported: prepared.length, errors };
  }

  // Phiếu trả lời in cho lớp: ô thông tin, mã đề; bảng tô khoá theo phần (theo dạng câu của mã đề thứ nhất)
  async answerSheet(currentUser: CurrentUser, sessionId: string) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    await this.assertCanSee(database, currentUser, session);
    const { questions, variants } = await this.examContent(database, session.exam_id);
    const first = variants[0];
    const blocks = answerSheetBlocks(
      session.exam_title,
      `Môn ${session.subject_name} – Lớp ${session.class_name}`,
      first?.items ?? [],
      questions,
    );
    return {
      buffer: await buildDocumentPdf(blocks, { title: `Phiếu trả lời – ${session.exam_title}` }),
      contentType: PDF_TYPE,
      fileName: 'phieu-tra-loi.pdf',
    };
  }

  // Khoá điểm: đủ bài, không còn bài thiếu điểm tự luận hay cần xem lại; ghi kết quả dùng câu của đề
  async lock(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const detail = await this.session(currentUser, sessionId);
    if (detail.status !== 'grading') {
      throw ruleViolationError(GRADING_RULE_CODE, 'Bài kiểm tra đã khoá');
    }
    const { missing, review, incomplete } = detail.blockers;
    const problems = [
      missing.length > 0 ? `chưa có bài: ${missing.join(', ')}` : null,
      incomplete.length > 0 ? `thiếu điểm tự luận: ${incomplete.join(', ')}` : null,
      review.length > 0 ? `điểm hai người chấm lệch quá ngưỡng: ${review.join(', ')}` : null,
    ].filter(Boolean);
    if (problems.length > 0) {
      throw ruleViolationError(GRADING_RULE_CODE, `Chưa khoá được; ${problems.join('; ')}`);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exam_sessions')
        .set({
          status: 'locked',
          locked_at: this.clock.now(),
          locked_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', sessionId)
        .execute();
      await this.writeUsageStats(transaction, detail.exam_id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_sessions',
        entityId: sessionId,
        action: 'update',
        before: { status: 'grading' },
        after: { status: 'locked' },
      });
    });
    return this.session(currentUser, sessionId);
  }

  async unlock(currentUser: CurrentUser, sessionId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    if (session.status !== 'locked') {
      throw ruleViolationError(
        GRADING_RULE_CODE,
        session.status === 'transferred' ? 'Điểm đã chuyển vào sổ điểm, không mở khoá được' : 'Bài kiểm tra chưa khoá',
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exam_sessions')
        .set({ status: 'grading', locked_at: null, locked_by_name: null, updated_at: this.clock.now() })
        .where('id', '=', sessionId)
        .execute();
      await this.writeUsageStats(transaction, session.exam_id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: session.org_unit_id,
        entityName: 'exam_sessions',
        entityId: sessionId,
        action: 'update',
        before: { status: 'locked' },
        after: { status: 'grading', reason },
      });
    });
    return this.session(currentUser, sessionId);
  }

  // Bài đã chấm của các bài kiểm tra đã khoá của đề (bỏ bài vắng)
  private async lockedPapers(database: Executor, examId: string, classId?: string) {
    let query = database
      .selectFrom('exam_sheets')
      .innerJoin('exam_sessions', 'exam_sessions.id', 'exam_sheets.session_id')
      .innerJoin('classes', 'classes.id', 'exam_sessions.class_id')
      .select([
        'exam_sessions.id as session_id',
        'exam_sessions.class_id',
        'classes.name as class_name',
        'exam_sessions.created_by_name',
        'exam_sheets.total_score',
        'exam_sheets.results',
      ])
      .where('exam_sessions.exam_id', '=', examId)
      .where('exam_sessions.status', 'in', ['locked', 'transferred'])
      .where('exam_sheets.absent', '=', false)
      .where('exam_sheets.total_score', 'is not', null);
    if (classId) {
      query = query.where('exam_sessions.class_id', '=', classId);
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      session_id: row.session_id,
      class_id: row.class_id,
      class_name: row.class_name,
      teacher: row.created_by_name,
      total: Number(row.total_score),
      results: row.results as QuestionResult[],
    }));
  }

  private async writeUsageStats(transaction: Executor, examId: string) {
    const [papers, { questions }] = await Promise.all([
      this.lockedPapers(transaction, examId),
      this.examContent(transaction, examId),
    ]);
    for (const stat of questionStats(papers, questions)) {
      await transaction
        .updateTable('question_usages')
        .set({
          attempts: stat.attempts,
          difficulty: stat.attempts > 0 ? stat.difficulty : null,
          discrimination: stat.discrimination,
        })
        .where('exam_id', '=', examId)
        .where('question_id', '=', stat.question_id)
        .execute();
    }
  }

  // Chuyển điểm vào sổ điểm 21c qua một cửa của sổ điểm; vắng bỏ qua hoặc ghi 0 theo cấu hình
  async transfer(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    if (session.status !== 'locked') {
      throw ruleViolationError(
        GRADING_RULE_CODE,
        session.status === 'transferred' ? 'Điểm đã chuyển vào sổ điểm' : 'Khoá điểm trước khi chuyển vào sổ điểm',
      );
    }
    const sheets = await this.sheets(database, sessionId);
    const scores = sheets.flatMap((sheet) => {
      if (sheet.absent) {
        return session.absent_policy === 'zero' ? [{ child_id: sheet.child_id, score: 0 }] : [];
      }
      return sheet.total_score === null ? [] : [{ child_id: sheet.child_id, score: Number(sheet.total_score) }];
    });
    const result = await database.transaction().execute(async (transaction) => {
      const written = await this.scores.recordExamScores(
        currentUser,
        {
          class_id: session.class_id,
          subject_id: session.subject_id,
          term_type: session.term_type,
          kind: session.score_kind,
          seq: session.score_seq,
          scores,
        },
        transaction,
      );
      await transaction
        .updateTable('exam_sessions')
        .set({
          status: 'transferred',
          transferred_at: this.clock.now(),
          transferred_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', sessionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: session.org_unit_id,
        entityName: 'exam_sessions',
        entityId: sessionId,
        action: 'update',
        before: { status: 'locked' },
        after: {
          status: 'transferred',
          term_type: session.term_type,
          kind: session.score_kind,
          seq: session.score_seq,
          written: written.written,
        },
      });
      return written;
    });
    return { ...(await this.session(currentUser, sessionId)), written: result.written };
  }

  // Báo cáo kết quả của một đề (tuỳ chọn một lớp): chỉ tính bài kiểm tra đã khoá
  async report(currentUser: CurrentUser, examId: string, classId?: string) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await database
      .selectFrom('exams')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([
        'exams.id',
        'exams.title',
        'exams.grade_level_code',
        'exams.subject_id',
        'subjects.name as subject_name',
      ])
      .where('exams.id', '=', examId)
      .executeTakeFirst();
    if (!exam) {
      throw notFoundError('Không tìm thấy đề', 'exam');
    }
    let papers = await this.lockedPapers(database, examId, classId);
    if (!currentUser.hasPermission(MANAGE) && !currentUser.hasPermission(REVIEW)) {
      const assigned = await this.assignedClassIds(database, currentUser, exam.subject_id);
      papers = papers.filter((paper) => assigned.has(paper.class_id));
    }
    const { questions, snapshots, variants } = await this.examContent(database, examId);
    const firstVariant = variants[0];
    const stats = questionStats(papers, questions);
    const questionRows = questions.map((question, index) => {
      const stat = stats.find((row) => row.question_id === question.question_id);
      const snapshot = snapshots.get(question.question_id);
      return {
        order: index + 1,
        number: firstVariant?.items.find((item) => item.question_id === question.question_id)?.number ?? index + 1,
        question_id: question.question_id,
        content: snapshot?.content ?? '',
        question_type: question.question_type,
        cognitive_level: question.cognitive_level,
        topic_name: question.topic_name,
        score: question.score,
        attempts: stat?.attempts ?? 0,
        difficulty: stat?.difficulty ?? 0,
        discrimination: stat?.discrimination ?? null,
        review: stat?.review ?? false,
      };
    });
    const classes = [...new Map(papers.map((paper) => [paper.class_id, paper])).values()].map((first) => {
      const own = papers.filter((paper) => paper.class_id === first.class_id).map((paper) => paper.total);
      return {
        class_id: first.class_id,
        class_name: first.class_name,
        teacher: first.teacher,
        papers: own.length,
        average: roundScore(own.reduce((sum, total) => sum + total, 0) / own.length),
        min: Math.min(...own),
        max: Math.max(...own),
        pass_rate: Math.round((own.filter((total) => total >= PASS_SCORE).length / own.length) * 100) / 100,
      };
    });
    classes.sort((left, right) => left.class_name.localeCompare(right.class_name, 'vi'));
    const totals = papers.map((paper) => paper.total);
    return {
      exam: {
        id: exam.id,
        title: exam.title,
        subject_name: exam.subject_name,
        grade_level_code: exam.grade_level_code,
      },
      papers: papers.length,
      average: totals.length > 0 ? roundScore(totals.reduce((sum, total) => sum + total, 0) / totals.length) : null,
      questions: questionRows,
      review: questionRows.filter((row) => row.review),
      topics: groupRates(papers, questions, (question) => question.topic_name ?? 'Chưa phân chủ đề'),
      levels: groupRates(papers, questions, (question) => question.cognitive_level).map((row) => ({
        ...row,
        label: COGNITIVE_LABELS[row.key as keyof typeof COGNITIVE_LABELS] ?? row.key,
      })),
      classes,
      distribution: scoreDistribution(totals),
    };
  }

  async exportReport(currentUser: CurrentUser, examId: string, classId: string | undefined, format: TableFileFormat) {
    const report = await this.report(currentUser, examId, classId);
    const heading = [
      `Báo cáo kết quả kiểm tra: ${report.exam.title}`,
      `Môn ${report.exam.subject_name}, khối ${report.exam.grade_level_code}; ${report.papers} bài; điểm trung bình ${report.average ?? '—'}`,
    ];
    const percent = (value: number) => `${Math.round(value * 100)}%`;
    const buffer = await buildTableFile(
      format,
      [
        {
          title: 'Theo câu',
          heading,
          columns: [
            { key: 'number', label: 'Câu (mã đầu)' },
            { key: 'type', label: 'Dạng' },
            { key: 'level', label: 'Mức' },
            { key: 'topic', label: 'Chủ đề' },
            { key: 'score', label: 'Điểm' },
            { key: 'difficulty', label: 'Độ khó' },
            { key: 'discrimination', label: 'Độ phân biệt' },
            { key: 'review', label: 'Nên xem lại' },
          ],
          rows: report.questions.map((row) => ({
            number: row.number,
            type: QUESTION_TYPE_LABELS[row.question_type],
            level: COGNITIVE_LABELS[row.cognitive_level],
            topic: row.topic_name ?? '',
            score: row.score,
            difficulty: row.difficulty,
            discrimination: row.discrimination ?? '',
            review: row.review ? 'Có' : '',
          })),
        },
        {
          title: 'Theo chủ đề',
          heading,
          columns: [
            { key: 'key', label: 'Chủ đề' },
            { key: 'questions', label: 'Số câu' },
            { key: 'max', label: 'Điểm tối đa' },
            { key: 'rate', label: 'Tỉ lệ điểm đạt' },
          ],
          rows: report.topics.map((row) => ({ ...row, rate: percent(row.rate) })),
        },
        {
          title: 'Theo mức nhận thức',
          heading,
          columns: [
            { key: 'label', label: 'Mức' },
            { key: 'questions', label: 'Số câu' },
            { key: 'max', label: 'Điểm tối đa' },
            { key: 'rate', label: 'Tỉ lệ điểm đạt' },
          ],
          rows: report.levels.map((row) => ({ ...row, rate: percent(row.rate) })),
        },
        {
          title: 'Theo lớp',
          heading,
          columns: [
            { key: 'class_name', label: 'Lớp' },
            { key: 'teacher', label: 'Giáo viên' },
            { key: 'papers', label: 'Số bài' },
            { key: 'average', label: 'Trung bình' },
            { key: 'min', label: 'Thấp nhất' },
            { key: 'max', label: 'Cao nhất' },
            { key: 'pass_rate', label: 'Tỉ lệ từ 5 điểm' },
          ],
          rows: report.classes.map((row) => ({ ...row, pass_rate: percent(row.pass_rate) })),
        },
        {
          title: 'Phân bố điểm',
          heading,
          columns: [
            { key: 'range', label: 'Khoảng điểm' },
            { key: 'count', label: 'Số bài' },
          ],
          rows: report.distribution.map((count, index) => ({
            range: index === 9 ? '9 đến 10' : `${index} đến dưới ${index + 1}`,
            count,
          })),
        },
      ],
      this.clock.now(),
    );
    return { buffer, contentType: CONTENT_TYPES[format], fileName: withExtension('bao-cao-ket-qua-kiem-tra', format) };
  }
}

// Phiếu trả lời: phần nhiều lựa chọn tô một ô; phần đúng sai tô Đúng hoặc Sai từng ý; phần trả lời ngắn ghi đáp số; tự luận
// làm trên giấy riêng
export function answerSheetBlocks(
  title: string,
  subtitle: string,
  items: VariantItem[],
  questions: GradedQuestion[],
): DocumentBlock[] {
  const box = '( )';
  const typeOf = (item: VariantItem) =>
    questions.find((question) => question.question_id === item.question_id)?.question_type;
  const blocks: DocumentBlock[] = [
    { kind: 'title', text: 'PHIẾU TRẢ LỜI', subtitle: `${title} – ${subtitle}` },
    { kind: 'paragraph', text: 'Họ và tên: ......................................  Số báo danh: ..........' },
    { kind: 'paragraph', text: 'Mã đề: ..........   (tô kín một ô cho mỗi lựa chọn; tẩy sạch khi đổi)', italic: true },
  ];
  const choice = items.filter((item) => typeOf(item) === 'multiple_choice');
  if (choice.length > 0) {
    const width = Math.max(...choice.map((item) => item.option_order.length || 4));
    blocks.push({ kind: 'heading', text: 'PHẦN I. NHIỀU LỰA CHỌN' });
    blocks.push({
      kind: 'table',
      header: ['Câu', ...OPTION_KEYS.slice(0, width)],
      rows: choice.map((item) => [String(item.number), ...OPTION_KEYS.slice(0, width).map(() => box)]),
    });
  }
  const trueFalse = items.filter((item) => typeOf(item) === 'true_false');
  if (trueFalse.length > 0) {
    blocks.push({ kind: 'heading', text: 'PHẦN II. ĐÚNG SAI' });
    blocks.push({
      kind: 'table',
      header: ['Câu', 'Ý', 'Đúng', 'Sai'],
      rows: trueFalse.flatMap((item) =>
        item.answer.map((_value, index) => [
          index === 0 ? String(item.number) : '',
          `${TRUE_FALSE_KEYS[index]})`,
          box,
          box,
        ]),
      ),
    });
  }
  const short = items.filter((item) => typeOf(item) === 'short_answer');
  if (short.length > 0) {
    blocks.push({ kind: 'heading', text: 'PHẦN III. TRẢ LỜI NGẮN' });
    blocks.push({
      kind: 'table',
      header: ['Câu', 'Đáp số'],
      rows: short.map((item) => [String(item.number), '']),
      widths: [60, 400],
    });
  }
  const essay = items.filter((item) => typeOf(item) === 'essay');
  if (essay.length > 0) {
    blocks.push({
      kind: 'paragraph',
      text: `Phần tự luận (câu ${essay.map((item) => item.number).join(', ')}) làm trên giấy kiểm tra riêng.`,
      italic: true,
    });
  }
  return blocks;
}
