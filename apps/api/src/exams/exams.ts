import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
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
import { buildTemplate, readSheet, type ImportColumn, type RowError } from '../imports/excel.js';
import { buildDocumentPdf, buildDocx, DOCX_TYPE, PDF_TYPE, type DocumentBlock } from '../kpi/kpi-documents.js';
import { TimetablesService } from '../timetables/timetables.js';
import {
  parseQuestion,
  TRUE_FALSE_KEYS,
  type ExamInput,
  type MatrixInputBody,
  type PlanInput,
  type QuestionInput,
  type QuestionOption,
} from './exam-inputs.js';
import {
  buildVariants,
  checkMatrix,
  COGNITIVE_LABELS,
  COGNITIVE_LEVELS,
  createRandom,
  OPTION_KEYS,
  pickQuestions,
  QUESTION_TYPE_LABELS,
  summarizeMatrix,
  type CognitiveLevel,
  type MatrixRow,
  type QuestionType,
  type VariantItem,
} from './exam-rules.js';

// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168): ngân hàng câu hỏi, chủ đề, ma trận và bảng đặc tả, kế hoạch kiểm
// tra, phân công ra đề, bốc câu theo ma trận, đề nhiều mã, thẩm định, khoá đề, xuất đề và đáp án. Claude tự chọn theo ủy
// quyền của Eric ngày 2026-10-11:
// - câu hỏi: người soạn lưu nháp, gửi thẩm định; người có quyền thẩm định duyệt (dùng được) hoặc trả lại có lý do, cho ngừng
//   dùng; câu dùng được ai soạn đề cũng thấy, câu nháp chỉ người soạn và người thẩm định thấy; sửa câu đã duyệt thì về nháp;
// - đề: người quản lý giao đề (người ra đề, người thẩm định, hạn nộp); người ra đề bốc câu theo ma trận hoặc thêm tay, trộn mã
//   đề, gửi thẩm định; người thẩm định duyệt hoặc trả lại; người quản lý khoá đề đã duyệt (ghi lịch sử dùng câu), mở khoá phải
//   ghi lý do; đề chỉ người ra đề, người thẩm định, người quản lý xem; mỗi lần tải đề ghi nhật ký;
// - câu trong đề lưu bản chụp nội dung lúc đưa vào đề nên sửa câu ở ngân hàng không đổi đề đã soạn;
// - kế hoạch kiểm tra theo học kỳ, khối, môn; người thẩm định lập, gửi; người quản lý duyệt hoặc trả lại; ngày kiểm tra tập
//   trung đối chiếu thời khoá biểu đang áp dụng ở mức nhắc việc (số tiết của các lớp khối đó trong ngày).
export const EXAM_RULE_CODE = 'YCTD-168';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const REVIEW = PERMISSION_CODES.examReview;
const MANAGE = PERMISSION_CODES.examManage;

export interface QuestionSnapshot {
  content: string;
  question_type: QuestionType;
  cognitive_level: CognitiveLevel;
  topic_name: string | null;
  options: QuestionOption[];
  answer: string[];
  guidance: string | null;
}

const QUESTION_COLUMNS = [
  'questions.id',
  'questions.school_level',
  'questions.subject_id',
  'questions.grade_level_code',
  'questions.topic_id',
  'questions.cognitive_level',
  'questions.question_type',
  'questions.content',
  'questions.options',
  'questions.answer',
  'questions.guidance',
  'questions.score',
  'questions.status',
  'questions.review_note',
  'questions.author_user_id',
  'questions.author_name',
  'questions.reviewed_by_name',
  'questions.reviewed_at',
  'questions.last_used_at',
  'questions.use_count',
  'questions.updated_at',
] as const;

const EXAM_COLUMNS = [
  'exams.id',
  'exams.plan_id',
  'exams.matrix_id',
  'exams.school_level',
  'exams.subject_id',
  'exams.grade_level_code',
  'exams.title',
  'exams.duration_minutes',
  'exams.variant_count',
  'exams.avoid_recent_days',
  'exams.status',
  'exams.author_user_id',
  'exams.author_name',
  'exams.reviewer_user_id',
  'exams.reviewer_name',
  'exams.due_date',
  'exams.review_note',
  'exams.submitted_at',
  'exams.reviewed_at',
  'exams.locked_at',
  'exams.locked_by_name',
  'exams.updated_at',
] as const;

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'subject_code', header: 'Mã môn', note: 'Mã môn ở danh mục môn học của cấp' },
  { key: 'grade_level_code', header: 'Mã khối', note: 'Ví dụ K6' },
  { key: 'topic', header: 'Chủ đề', note: 'Tên chủ đề đã khai báo của môn, khối; để trống nếu chưa phân chủ đề' },
  { key: 'cognitive_level', header: 'Mức', note: 'Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao' },
  { key: 'question_type', header: 'Dạng', note: 'Nhiều lựa chọn, Đúng sai, Trả lời ngắn, Tự luận' },
  { key: 'content', header: 'Nội dung', note: 'Nội dung câu hỏi' },
  { key: 'option_1', header: 'Lựa chọn 1', note: 'Lựa chọn A hoặc ý a' },
  { key: 'option_2', header: 'Lựa chọn 2', note: 'Lựa chọn B hoặc ý b' },
  { key: 'option_3', header: 'Lựa chọn 3', note: 'Lựa chọn C hoặc ý c' },
  { key: 'option_4', header: 'Lựa chọn 4', note: 'Lựa chọn D hoặc ý d' },
  {
    key: 'answer',
    header: 'Đáp án',
    note: 'Nhiều lựa chọn: khoá đúng (ví dụ B); đúng sai: Đ hoặc S từng ý cách nhau dấu phẩy; trả lời ngắn: đáp số',
  },
  { key: 'guidance', header: 'Hướng dẫn chấm', note: 'Bắt buộc với câu tự luận' },
  { key: 'score', header: 'Điểm', note: 'Điểm của câu, mặc định 1' },
];

const byLabel = <T extends string>(labels: Record<T, string>, text: string): T | undefined =>
  (Object.entries(labels) as Array<[T, string]>).find(
    ([, label]) => label.toLowerCase() === text.trim().toLowerCase(),
  )?.[0];

@Injectable()
export class ExamsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  private canReview(currentUser: CurrentUser) {
    return currentUser.hasPermission(REVIEW) || currentUser.hasPermission(MANAGE);
  }

  // Môn đúng cấp; khối đúng cấp
  private async assertSubjectGrade(database: Executor, level: SchoolLevelCode, subjectId: string, grade: string) {
    const [subject, gradeRow] = await Promise.all([
      database.selectFrom('subjects').select(['id', 'school_level']).where('id', '=', subjectId).executeTakeFirst(),
      database.selectFrom('grade_levels').select(['code', 'school_level']).where('code', '=', grade).executeTakeFirst(),
    ]);
    const errors: FieldError[] = [];
    if (subject?.school_level !== level) {
      errors.push({ field: 'subject_id', message: 'Môn không có hoặc không cùng cấp' });
    }
    if (gradeRow?.school_level !== level) {
      errors.push({ field: 'grade_level_code', message: 'Khối không có hoặc không cùng cấp' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  // Chủ đề
  async topics(filter: { subjectId?: string; gradeLevelCode?: string }) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('question_topics')
      .select(['id', 'subject_id', 'grade_level_code', 'name', 'order_no', 'status']);
    if (filter.subjectId) query = query.where('subject_id', '=', filter.subjectId);
    if (filter.gradeLevelCode) query = query.where('grade_level_code', '=', filter.gradeLevelCode);
    return query.orderBy('order_no').orderBy('name').execute();
  }

  async createTopic(
    input: { subject_id: string; grade_level_code: string | null; name: string; order_no: number },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const subject = await database
      .selectFrom('subjects')
      .select('id')
      .where('id', '=', input.subject_id)
      .executeTakeFirst();
    if (!subject) {
      throw validationError([{ field: 'subject_id', message: 'Không có môn này' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('question_topics')
        .values({ ...input, created_by: origin.actorUserId })
        .returning(['id', 'subject_id', 'grade_level_code', 'name', 'order_no', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'question_topics',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Ngân hàng câu hỏi: câu dùng được và câu của mình; người thẩm định thấy mọi câu
  async listQuestions(
    currentUser: CurrentUser,
    filter: {
      subjectId?: string;
      gradeLevelCode?: string;
      topicId?: string;
      cognitiveLevel?: string;
      questionType?: string;
      status?: string;
      search?: string;
    },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('questions')
      .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
      .select([...QUESTION_COLUMNS, 'question_topics.name as topic_name']);
    if (!this.canReview(currentUser)) {
      query = query.where((expression) =>
        expression.or([
          expression('questions.status', '=', 'approved'),
          expression('questions.author_user_id', '=', currentUser.id),
        ]),
      );
    }
    if (filter.subjectId) query = query.where('questions.subject_id', '=', filter.subjectId);
    if (filter.gradeLevelCode) query = query.where('questions.grade_level_code', '=', filter.gradeLevelCode);
    if (filter.topicId) query = query.where('questions.topic_id', '=', filter.topicId);
    if (filter.cognitiveLevel)
      query = query.where('questions.cognitive_level', '=', filter.cognitiveLevel as CognitiveLevel);
    if (filter.questionType) query = query.where('questions.question_type', '=', filter.questionType as QuestionType);
    if (filter.status) query = query.where('questions.status', '=', filter.status as 'draft');
    if (filter.search) {
      const pattern = `%${filter.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      query = query.where('questions.content', 'ilike', pattern);
    }
    return query.orderBy('questions.updated_at', 'desc').limit(500).execute();
  }

  private async findQuestion(database: Executor, questionId: string) {
    const question = await database
      .selectFrom('questions')
      .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
      .select([...QUESTION_COLUMNS, 'question_topics.name as topic_name'])
      .where('questions.id', '=', questionId)
      .executeTakeFirst();
    if (!question) {
      throw notFoundError('Không tìm thấy câu hỏi', 'question');
    }
    return question;
  }

  async question(currentUser: CurrentUser, questionId: string) {
    const { database } = await this.currentSchoolYear.require();
    const question = await this.findQuestion(database, questionId);
    if (question.status !== 'approved' && question.author_user_id !== currentUser.id && !this.canReview(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Câu hỏi chưa duyệt chỉ người soạn và người thẩm định xem');
    }
    return question;
  }

  private async assertTopic(database: Executor, input: QuestionInput) {
    if (!input.topic_id) return;
    const topic = await database
      .selectFrom('question_topics')
      .select(['subject_id'])
      .where('id', '=', input.topic_id)
      .executeTakeFirst();
    if (topic?.subject_id !== input.subject_id) {
      throw validationError([{ field: 'topic_id', message: 'Chủ đề không thuộc môn của câu hỏi' }]);
    }
  }

  async createQuestion(currentUser: CurrentUser, input: QuestionInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertSubjectGrade(database, input.school_level, input.subject_id, input.grade_level_code);
    await this.assertTopic(database, input);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('questions')
        .values({
          ...input,
          options: JSON.stringify(input.options),
          answer: JSON.stringify(input.answer),
          author_user_id: currentUser.id,
          author_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'questions',
        entityId: created.id,
        action: 'create',
        before: null,
        after: input,
      });
      return this.findQuestion(transaction, created.id);
    });
  }

  // Người soạn sửa câu nháp của mình; người thẩm định sửa câu chưa ngừng dùng. Sửa câu đã duyệt thì về nháp
  async updateQuestion(currentUser: CurrentUser, questionId: string, input: QuestionInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findQuestion(database, questionId);
    const own = existing.author_user_id === currentUser.id;
    if (existing.status === 'retired') {
      throw ruleViolationError(EXAM_RULE_CODE, 'Câu hỏi đã ngừng dùng');
    }
    if (!this.canReview(currentUser) && !(own && existing.status === 'draft')) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ sửa được câu nháp của mình');
    }
    await this.assertSubjectGrade(database, input.school_level, input.subject_id, input.grade_level_code);
    await this.assertTopic(database, input);
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('questions')
        .set({
          ...input,
          options: JSON.stringify(input.options),
          answer: JSON.stringify(input.answer),
          status: existing.status === 'approved' ? 'draft' : existing.status,
          updated_at: this.clock.now(),
        })
        .where('id', '=', questionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'questions',
        entityId: questionId,
        action: 'update',
        before: existing,
        after: input,
      });
      return this.findQuestion(transaction, questionId);
    });
  }

  private async setQuestionStatus(
    questionId: string,
    from: Array<'draft' | 'review' | 'approved' | 'retired'>,
    changes: Partial<{
      status: 'draft' | 'review' | 'approved' | 'retired';
      review_note: string | null;
      reviewed_by: string;
      reviewed_by_name: string;
      reviewed_at: Date;
    }>,
    origin: ChangeOrigin,
    message: string,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findQuestion(database, questionId);
    if (!from.includes(existing.status)) {
      throw ruleViolationError(EXAM_RULE_CODE, message);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('questions')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', questionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'questions',
        entityId: questionId,
        action: 'update',
        before: { status: existing.status },
        after: changes,
      });
    });
    return this.findQuestion(database, questionId);
  }

  async submitQuestion(currentUser: CurrentUser, questionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findQuestion(database, questionId);
    if (existing.author_user_id !== currentUser.id && !this.canReview(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người soạn gửi thẩm định câu hỏi');
    }
    return this.setQuestionStatus(
      questionId,
      ['draft'],
      { status: 'review', review_note: null },
      origin,
      'Chỉ câu nháp mới gửi thẩm định',
    );
  }

  async reviewQuestion(
    currentUser: CurrentUser,
    questionId: string,
    decision: { approve: boolean; note: string | null },
    origin: ChangeOrigin,
  ) {
    return this.setQuestionStatus(
      questionId,
      ['review', 'draft'],
      {
        status: decision.approve ? 'approved' : 'draft',
        review_note: decision.note,
        reviewed_by: currentUser.id,
        reviewed_by_name: currentUser.description.full_name,
        reviewed_at: this.clock.now(),
      },
      origin,
      'Câu hỏi không ở trạng thái chờ thẩm định',
    );
  }

  async retireQuestion(questionId: string, origin: ChangeOrigin) {
    return this.setQuestionStatus(
      questionId,
      ['draft', 'review', 'approved'],
      { status: 'retired' },
      origin,
      'Câu hỏi đã ngừng dùng',
    );
  }

  // Thống kê câu dùng được theo chủ đề và mức nhận thức
  async questionStats(subjectId: string, gradeLevelCode: string) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('questions')
      .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
      .select([
        'questions.topic_id',
        'question_topics.name as topic_name',
        'questions.cognitive_level',
        'questions.question_type',
        (expression) => expression.fn.countAll<string>().as('count'),
      ])
      .where('questions.subject_id', '=', subjectId)
      .where('questions.grade_level_code', '=', gradeLevelCode)
      .where('questions.status', '=', 'approved')
      .groupBy(['questions.topic_id', 'question_topics.name', 'questions.cognitive_level', 'questions.question_type'])
      .execute();
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }

  async importTemplate(level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    const [subjects, grades] = await Promise.all([
      database
        .selectFrom('subjects')
        .select(['code', 'name'])
        .where('school_level', '=', level)
        .where('status', '=', 'active')
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('grade_levels')
        .select(['code', 'name'])
        .where('school_level', '=', level)
        .orderBy('order_no')
        .execute(),
    ]);
    return buildTemplate('Câu hỏi', IMPORT_COLUMNS, {
      catalogs: [
        { key: 'subjects', title: 'Môn học', column: 'Mã môn', items: subjects },
        { key: 'grades', title: 'Khối', column: 'Mã khối', items: grades },
      ],
    });
  }

  // Nhập câu hỏi từ Excel: mọi dòng hợp lệ mới ghi, câu nhập vào ở trạng thái nháp của người nhập
  async importQuestions(currentUser: CurrentUser, level: SchoolLevelCode, body: Buffer, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await readSheet(body, IMPORT_COLUMNS);
    const [subjects, grades, topics] = await Promise.all([
      database.selectFrom('subjects').select(['id', 'code']).where('school_level', '=', level).execute(),
      database.selectFrom('grade_levels').select('code').where('school_level', '=', level).execute(),
      database.selectFrom('question_topics').select(['id', 'subject_id', 'grade_level_code', 'name']).execute(),
    ]);
    const errors: RowError[] = [];
    const inputs: QuestionInput[] = [];
    for (const row of rows) {
      const values = row.values;
      const subject = subjects.find((item) => item.code === values.subject_code?.trim());
      const grade = values.grade_level_code?.trim() ?? '';
      const topicName = values.topic?.trim() ?? '';
      const topic = topicName
        ? topics.find(
            (item) =>
              item.subject_id === subject?.id &&
              (item.grade_level_code === null || item.grade_level_code === grade) &&
              item.name.toLowerCase() === topicName.toLowerCase(),
          )
        : undefined;
      const type = byLabel(QUESTION_TYPE_LABELS, values.question_type ?? '');
      const cognitive = byLabel(COGNITIVE_LABELS, values.cognitive_level ?? '');
      if (!subject) errors.push({ row: row.row, column: 'Mã môn', message: 'Không có môn này ở cấp' });
      if (!grades.some((item) => item.code === grade)) {
        errors.push({ row: row.row, column: 'Mã khối', message: 'Không có khối này ở cấp' });
      }
      if (topicName && !topic) errors.push({ row: row.row, column: 'Chủ đề', message: 'Chưa có chủ đề này' });
      if (!type) errors.push({ row: row.row, column: 'Dạng', message: 'Dạng câu hỏi không đúng' });
      if (!cognitive) errors.push({ row: row.row, column: 'Mức', message: 'Mức nhận thức không đúng' });
      if (!subject || !type || !cognitive || (topicName && !topic)) continue;
      const options = ['option_1', 'option_2', 'option_3', 'option_4']
        .map((key) => values[key]?.trim() ?? '')
        .filter(Boolean);
      const answerText = values.answer?.trim() ?? '';
      try {
        inputs.push(
          parseQuestion({
            school_level: level,
            subject_id: subject.id,
            grade_level_code: grade,
            topic_id: topic?.id ?? null,
            cognitive_level: cognitive,
            question_type: type,
            content: values.content ?? '',
            options: type === 'multiple_choice' || type === 'true_false' ? options : [],
            answer:
              type === 'essay'
                ? []
                : answerText
                    .split(',')
                    .map((part) => part.trim())
                    .filter(Boolean),
            guidance: values.guidance ?? null,
            score: values.score ? Number(values.score.replace(',', '.')) : 1,
          }),
        );
      } catch (error) {
        const details = error instanceof ApplicationError ? error.details : [];
        for (const detail of details) {
          errors.push({ row: row.row, column: detail.field, message: detail.message });
        }
      }
    }
    if (errors.length > 0) {
      return { imported: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      if (inputs.length > 0) {
        await transaction
          .insertInto('questions')
          .values(
            inputs.map((input) => ({
              ...input,
              options: JSON.stringify(input.options),
              answer: JSON.stringify(input.answer),
              author_user_id: currentUser.id,
              author_name: currentUser.description.full_name,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'questions',
        entityId: currentUser.id,
        action: 'create',
        before: null,
        after: { imported: inputs.length },
      });
    });
    return { imported: inputs.length, errors: [] };
  }

  // Ma trận đề
  async listMatrices(filter: { level?: SchoolLevelCode; subjectId?: string; gradeLevelCode?: string }) {
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('exam_matrices').selectAll();
    if (filter.level) query = query.where('school_level', '=', filter.level);
    if (filter.subjectId) query = query.where('subject_id', '=', filter.subjectId);
    if (filter.gradeLevelCode) query = query.where('grade_level_code', '=', filter.gradeLevelCode);
    const rows = await query.orderBy('updated_at', 'desc').execute();
    return rows.map((row) => this.describeMatrix(row));
  }

  private describeMatrix<T extends { total_score: string; target_ratios: unknown; tolerance: string; rows: unknown }>(
    row: T,
  ) {
    const rows = row.rows as MatrixRow[];
    const input = {
      total_score: Number(row.total_score),
      target_ratios: row.target_ratios as Record<CognitiveLevel, number>,
      tolerance: Number(row.tolerance),
      rows,
    };
    return { ...row, ...input, summary: summarizeMatrix(rows), issues: checkMatrix(input) };
  }

  private async findMatrix(database: Executor, matrixId: string) {
    const row = await database.selectFrom('exam_matrices').selectAll().where('id', '=', matrixId).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy ma trận', 'exam_matrix');
    }
    return this.describeMatrix(row);
  }

  async matrix(matrixId: string) {
    const { database } = await this.currentSchoolYear.require();
    return this.findMatrix(database, matrixId);
  }

  async saveMatrix(currentUser: CurrentUser, matrixId: string | null, input: MatrixInputBody, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertSubjectGrade(database, input.school_level, input.subject_id, input.grade_level_code);
    const topicIds = input.rows.map((row) => row.topic_id).filter((id): id is string => !!id);
    const topics = topicIds.length
      ? await database
          .selectFrom('question_topics')
          .select(['id', 'subject_id', 'name'])
          .where('id', 'in', topicIds)
          .execute()
      : [];
    const errors: FieldError[] = [];
    input.rows.forEach((row, index) => {
      const topic = topics.find((item) => item.id === row.topic_id);
      if (row.topic_id && topic?.subject_id !== input.subject_id) {
        errors.push({ field: `rows[${index}].topic_id`, message: 'Chủ đề không thuộc môn của ma trận' });
      }
      row.topic_name = topic?.name ?? (row.topic_name || 'Mọi chủ đề');
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const values = {
      ...input,
      target_ratios: JSON.stringify(input.target_ratios),
      rows: JSON.stringify(input.rows),
    };
    const before = matrixId ? await this.findMatrix(database, matrixId) : null;
    const saved = await database.transaction().execute(async (transaction) => {
      const row = matrixId
        ? await transaction
            .updateTable('exam_matrices')
            .set({ ...values, updated_at: this.clock.now() })
            .where('id', '=', matrixId)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('exam_matrices')
            .values({ ...values, created_by: currentUser.id, created_by_name: currentUser.description.full_name })
            .returning('id')
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_matrices',
        entityId: row.id,
        action: matrixId ? 'update' : 'create',
        before,
        after: input,
      });
      return row;
    });
    return this.findMatrix(database, saved.id);
  }

  // Kế hoạch kiểm tra, kèm số đề đã giao và nhắc trùng tiết với thời khoá biểu
  async listPlans(level: SchoolLevelCode, term?: string) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('assessment_plans')
      .innerJoin('subjects', 'subjects.id', 'assessment_plans.subject_id')
      .selectAll('assessment_plans')
      .select('subjects.name as subject_name')
      .where('assessment_plans.school_level', '=', level);
    if (term) query = query.where('assessment_plans.term', '=', term as 'HK1');
    const plans = await query
      .orderBy('assessment_plans.term')
      .orderBy('assessment_plans.grade_level_code')
      .orderBy('subjects.order_no')
      .execute();
    const exams = plans.length
      ? await database
          .selectFrom('exams')
          .select(['plan_id', 'status'])
          .where(
            'plan_id',
            'in',
            plans.map((plan) => plan.id),
          )
          .execute()
      : [];
    const result = [];
    for (const plan of plans) {
      const planExams = exams.filter((exam) => exam.plan_id === plan.id);
      result.push({
        ...plan,
        exam_count: planExams.length,
        locked_count: planExams.filter((exam) => exam.status === 'locked').length,
        timetable_note: plan.planned_date
          ? await this.timetableNote(database, plan.grade_level_code, plan.planned_date)
          : null,
      });
    }
    return result;
  }

  private async timetableNote(database: Executor, gradeLevelCode: string, date: string): Promise<string | null> {
    const versions = await this.timetables.applyingVersions(database, date);
    if (versions.length === 0) {
      return null;
    }
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    const lessons = (
      await this.timetables.lessons(
        database,
        versions.map((version) => version.id),
      )
    ).filter((lesson) => lesson.weekday === weekday);
    const classIds = [...new Set(lessons.map((lesson) => lesson.class_id))];
    const classes = classIds.length
      ? await database
          .selectFrom('classes')
          .select('id')
          .where('id', 'in', classIds)
          .where('grade_level', '=', gradeLevelCode)
          .execute()
      : [];
    const count = lessons.filter((lesson) => classes.some((row) => row.id === lesson.class_id)).length;
    return count > 0
      ? `Ngày ${date.split('-').reverse().join('/')} các lớp khối có ${count} tiết theo thời khoá biểu đang áp dụng; báo giáo viên đổi tiết nếu kiểm tra tập trung`
      : null;
  }

  private async findPlan(database: Executor, planId: string) {
    const plan = await database.selectFrom('assessment_plans').selectAll().where('id', '=', planId).executeTakeFirst();
    if (!plan) {
      throw notFoundError('Không tìm thấy kế hoạch kiểm tra', 'assessment_plan');
    }
    return plan;
  }

  async savePlan(currentUser: CurrentUser, planId: string | null, input: PlanInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertSubjectGrade(database, input.school_level, input.subject_id, input.grade_level_code);
    const before = planId ? await this.findPlan(database, planId) : null;
    if (before && before.status !== 'draft' && before.status !== 'rejected') {
      throw ruleViolationError(EXAM_RULE_CODE, 'Kế hoạch đã gửi duyệt hoặc đã duyệt, không sửa được');
    }
    return database.transaction().execute(async (transaction) => {
      const saved = planId
        ? await transaction
            .updateTable('assessment_plans')
            .set({ ...input, status: 'draft', updated_at: this.clock.now() })
            .where('id', '=', planId)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('assessment_plans')
            .values({ ...input, created_by: currentUser.id, created_by_name: currentUser.description.full_name })
            .returningAll()
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'assessment_plans',
        entityId: saved.id,
        action: planId ? 'update' : 'create',
        before,
        after: saved,
      });
      return saved;
    });
  }

  async submitPlan(planId: string, origin: ChangeOrigin) {
    return this.movePlan(
      planId,
      ['draft', 'rejected'],
      { status: 'submitted' },
      origin,
      'Chỉ kế hoạch nháp mới gửi duyệt',
    );
  }

  async decidePlan(
    currentUser: CurrentUser,
    planId: string,
    decision: { approve: boolean; note: string | null },
    origin: ChangeOrigin,
  ) {
    return this.movePlan(
      planId,
      ['submitted'],
      {
        status: decision.approve ? 'approved' : 'rejected',
        review_note: decision.note,
        reviewed_by_name: currentUser.description.full_name,
        reviewed_at: this.clock.now(),
      },
      origin,
      'Kế hoạch không ở trạng thái chờ duyệt',
    );
  }

  private async movePlan(
    planId: string,
    from: string[],
    changes: Partial<{
      status: 'draft' | 'submitted' | 'approved' | 'rejected';
      review_note: string | null;
      reviewed_by_name: string;
      reviewed_at: Date;
    }>,
    origin: ChangeOrigin,
    message: string,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.findPlan(database, planId);
    if (!from.includes(plan.status)) {
      throw ruleViolationError(EXAM_RULE_CODE, message);
    }
    return database.transaction().execute(async (transaction) => {
      const saved = await transaction
        .updateTable('assessment_plans')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', planId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'assessment_plans',
        entityId: planId,
        action: 'update',
        before: { status: plan.status },
        after: changes,
      });
      return saved;
    });
  }

  // Người có thể ra đề, thẩm định: nhân sự đang được phân công ở lớp bất kỳ
  async staff() {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select(['staff_user_id', 'staff_name'])
      .where('status', '=', 'active')
      .distinct()
      .orderBy('staff_name')
      .execute();
    return [...new Map(rows.map((row) => [row.staff_user_id, row])).values()].map((row) => ({
      user_id: row.staff_user_id,
      name: row.staff_name,
    }));
  }

  private async staffName(database: Executor, userId: string): Promise<string> {
    const row = await database
      .selectFrom('class_staff_assignments')
      .select('staff_name')
      .where('staff_user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!row) {
      throw validationError([{ field: 'author_user_id', message: 'Người được giao chưa được phân công giảng dạy' }]);
    }
    return row.staff_name;
  }

  // Đề: người quản lý thấy mọi đề; người khác thấy đề mình ra hoặc thẩm định
  async listExams(currentUser: CurrentUser, level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('exams')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([...EXAM_COLUMNS, 'subjects.name as subject_name'])
      .where('exams.school_level', '=', level);
    if (!currentUser.hasPermission(MANAGE)) {
      query = query.where((expression) =>
        expression.or([
          expression('exams.author_user_id', '=', currentUser.id),
          expression('exams.reviewer_user_id', '=', currentUser.id),
        ]),
      );
    }
    const today = this.today();
    const rows = await query.orderBy('exams.due_date').orderBy('exams.updated_at', 'desc').execute();
    return rows.map((row) => ({
      ...row,
      overdue: row.status === 'draft' && row.due_date !== null && row.due_date < today,
    }));
  }

  private async findExam(database: Executor, examId: string) {
    const exam = await database
      .selectFrom('exams')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([...EXAM_COLUMNS, 'subjects.name as subject_name'])
      .where('exams.id', '=', examId)
      .executeTakeFirst();
    if (!exam) {
      throw notFoundError('Không tìm thấy đề', 'exam');
    }
    return exam;
  }

  private assertCanSee(currentUser: CurrentUser, exam: { author_user_id: string; reviewer_user_id: string | null }) {
    if (
      !currentUser.hasPermission(MANAGE) &&
      exam.author_user_id !== currentUser.id &&
      exam.reviewer_user_id !== currentUser.id
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đề chỉ người ra đề, người thẩm định và người quản lý xem');
    }
  }

  private assertAuthorDraft(currentUser: CurrentUser, exam: { author_user_id: string; status: string }) {
    if (exam.author_user_id !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người được giao ra đề soạn đề');
    }
    if (exam.status !== 'draft') {
      throw ruleViolationError(EXAM_RULE_CODE, 'Đề đã gửi thẩm định hoặc đã khoá, không sửa được');
    }
  }

  async createExam(currentUser: CurrentUser, input: ExamInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    if (input.plan_id) {
      const plan = await this.findPlan(database, input.plan_id);
      if (plan.status !== 'approved') {
        throw ruleViolationError(EXAM_RULE_CODE, 'Kế hoạch kiểm tra chưa được duyệt');
      }
      input.school_level = plan.school_level;
      input.subject_id = plan.subject_id;
      input.grade_level_code = plan.grade_level_code;
      input.duration_minutes = plan.duration_minutes;
    }
    await this.assertSubjectGrade(database, input.school_level, input.subject_id, input.grade_level_code);
    if (input.matrix_id) {
      const matrix = await this.findMatrix(database, input.matrix_id);
      if (matrix.subject_id !== input.subject_id || matrix.grade_level_code !== input.grade_level_code) {
        throw validationError([{ field: 'matrix_id', message: 'Ma trận khác môn hoặc khác khối của đề' }]);
      }
    }
    const authorName = await this.staffName(database, input.author_user_id);
    const reviewerName = input.reviewer_user_id ? await this.staffName(database, input.reviewer_user_id) : null;
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('exams')
        .values({
          ...input,
          author_name: authorName,
          reviewer_name: reviewerName,
          created_by: currentUser.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: created.id,
        action: 'create',
        before: null,
        after: input,
      });
      return this.findExam(transaction, created.id);
    });
  }

  async exam(currentUser: CurrentUser, examId: string) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertCanSee(currentUser, exam);
    const [questions, variants] = await Promise.all([
      this.examQuestions(database, examId),
      database
        .selectFrom('exam_variants')
        .select(['code', 'items'])
        .where('exam_id', '=', examId)
        .orderBy('code')
        .execute(),
    ]);
    const matrix = exam.matrix_id ? await this.findMatrix(database, exam.matrix_id) : null;
    const total = questions.reduce((sum, question) => sum + Number(question.score), 0);
    return {
      ...exam,
      matrix: matrix
        ? { id: matrix.id, name: matrix.name, total_score: matrix.total_score, issues: matrix.issues }
        : null,
      questions,
      total_score: Math.round(total * 100) / 100,
      variants: variants.map((variant) => ({
        code: variant.code,
        answers: (variant.items as VariantItem[]).map((item) => ({ number: item.number, answer: item.answer })),
      })),
    };
  }

  private async examQuestions(database: Executor, examId: string) {
    const rows = await database
      .selectFrom('exam_questions')
      .select(['question_id', 'order_no', 'score', 'snapshot'])
      .where('exam_id', '=', examId)
      .orderBy('order_no')
      .execute();
    return rows.map((row) => ({ ...row, score: Number(row.score), snapshot: row.snapshot as QuestionSnapshot }));
  }

  private snapshotOf(question: Awaited<ReturnType<ExamsService['findQuestion']>>): QuestionSnapshot {
    return {
      content: question.content,
      question_type: question.question_type,
      cognitive_level: question.cognitive_level,
      topic_name: question.topic_name,
      options: question.options as QuestionOption[],
      answer: question.answer as string[],
      guidance: question.guidance,
    };
  }

  async updateExam(
    currentUser: CurrentUser,
    examId: string,
    changes: Partial<Pick<ExamInput, 'title' | 'variant_count' | 'avoid_recent_days' | 'matrix_id' | 'due_date'>>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertAuthorDraft(currentUser, exam);
    if (changes.matrix_id) {
      const matrix = await this.findMatrix(database, changes.matrix_id);
      if (matrix.subject_id !== exam.subject_id || matrix.grade_level_code !== exam.grade_level_code) {
        throw validationError([{ field: 'matrix_id', message: 'Ma trận khác môn hoặc khác khối của đề' }]);
      }
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exams')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', examId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: examId,
        action: 'update',
        before: exam,
        after: changes,
      });
    });
    return this.exam(currentUser, examId);
  }

  // Bốc câu theo ma trận của đề: thay toàn bộ câu của đề; thiếu câu thì báo từng dòng, không đổi đề
  async generateExam(currentUser: CurrentUser, examId: string, seed: number | undefined, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertAuthorDraft(currentUser, exam);
    if (!exam.matrix_id) {
      throw ruleViolationError(EXAM_RULE_CODE, 'Đề chưa chọn ma trận');
    }
    const matrix = await this.findMatrix(database, exam.matrix_id);
    if (matrix.issues.length > 0) {
      throw ruleViolationError(
        EXAM_RULE_CODE,
        'Ma trận chưa hợp lệ',
        matrix.issues.map((issue) => ({ field: issue.code, message: issue.message })),
      );
    }
    const pool = await database
      .selectFrom('questions')
      .select(['id', 'topic_id', 'cognitive_level', 'question_type', 'last_used_at'])
      .where('subject_id', '=', exam.subject_id)
      .where('grade_level_code', '=', exam.grade_level_code)
      .where('status', '=', 'approved')
      .execute();
    const usedSince =
      exam.avoid_recent_days > 0
        ? new Date(Date.parse(`${this.today()}T00:00:00Z`) - exam.avoid_recent_days * 86_400_000)
            .toISOString()
            .slice(0, 10)
        : null;
    const result = pickQuestions(matrix.rows, pool, {
      usedSince,
      random: createRandom(seed ?? randomInt(2 ** 31)),
    });
    if (result.shortages.length > 0) {
      throw ruleViolationError(
        EXAM_RULE_CODE,
        'Ngân hàng chưa đủ câu cho ma trận',
        result.shortages.map((shortage) => ({ field: `rows[${shortage.row - 1}]`, message: shortage.message })),
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('exam_questions').where('exam_id', '=', examId).execute();
      await transaction.deleteFrom('exam_variants').where('exam_id', '=', examId).execute();
      let order = 0;
      for (const item of result.picked) {
        const question = await this.findQuestion(transaction, item.question_id);
        order += 1;
        await transaction
          .insertInto('exam_questions')
          .values({
            exam_id: examId,
            question_id: item.question_id,
            order_no: order,
            score: item.score,
            snapshot: JSON.stringify(this.snapshotOf(question)),
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: examId,
        action: 'update',
        before: null,
        after: { generated_from: exam.matrix_id, questions: result.picked.length },
      });
    });
    return this.exam(currentUser, examId);
  }

  // Thêm tay một câu (câu dùng được của đúng môn, khối), thường là câu tự luận
  async addExamQuestion(
    currentUser: CurrentUser,
    examId: string,
    questionId: string,
    score: number | undefined,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertAuthorDraft(currentUser, exam);
    const question = await this.findQuestion(database, questionId);
    if (
      question.status !== 'approved' ||
      question.subject_id !== exam.subject_id ||
      question.grade_level_code !== exam.grade_level_code
    ) {
      throw ruleViolationError(EXAM_RULE_CODE, 'Chỉ thêm được câu đã duyệt của đúng môn, khối của đề');
    }
    await database.transaction().execute(async (transaction) => {
      const last = await transaction
        .selectFrom('exam_questions')
        .select((expression) => expression.fn.max('order_no').as('order_no'))
        .where('exam_id', '=', examId)
        .executeTakeFirst();
      await transaction
        .insertInto('exam_questions')
        .values({
          exam_id: examId,
          question_id: questionId,
          order_no: Number(last?.order_no ?? 0) + 1,
          score: score ?? Number(question.score),
          snapshot: JSON.stringify(this.snapshotOf(question)),
        })
        .onConflict((conflict) => conflict.columns(['exam_id', 'question_id']).doNothing())
        .execute();
      await transaction.deleteFrom('exam_variants').where('exam_id', '=', examId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: examId,
        action: 'update',
        before: null,
        after: { added_question: questionId },
      });
    });
    return this.exam(currentUser, examId);
  }

  async removeExamQuestion(currentUser: CurrentUser, examId: string, questionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertAuthorDraft(currentUser, exam);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('exam_questions')
        .where('exam_id', '=', examId)
        .where('question_id', '=', questionId)
        .execute();
      await transaction.deleteFrom('exam_variants').where('exam_id', '=', examId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: examId,
        action: 'update',
        before: { question_id: questionId },
        after: null,
      });
    });
    return this.exam(currentUser, examId);
  }

  // Trộn đề thành số mã đề của đề
  async buildExamVariants(currentUser: CurrentUser, examId: string, seed: number | undefined, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertAuthorDraft(currentUser, exam);
    const questions = await this.examQuestions(database, examId);
    if (questions.length === 0) {
      throw ruleViolationError(EXAM_RULE_CODE, 'Đề chưa có câu nào');
    }
    const variants = buildVariants(
      questions.map((question) => ({
        question_id: question.question_id,
        question_type: question.snapshot.question_type,
        option_count: question.snapshot.options.length,
        answer: question.snapshot.answer,
      })),
      exam.variant_count,
      seed ?? randomInt(2 ** 31),
    );
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('exam_variants').where('exam_id', '=', examId).execute();
      await transaction
        .insertInto('exam_variants')
        .values(
          variants.map((variant) => ({ exam_id: examId, code: variant.code, items: JSON.stringify(variant.items) })),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: examId,
        action: 'update',
        before: null,
        after: { variants: variants.map((variant) => variant.code) },
      });
    });
    return this.exam(currentUser, examId);
  }

  private async moveExam(
    examId: string,
    from: string[],
    changes: Partial<{
      status: 'draft' | 'submitted' | 'approved' | 'locked';
      review_note: string | null;
      submitted_at: Date;
      reviewed_at: Date;
      locked_at: Date | null;
      locked_by_name: string | null;
    }>,
    origin: ChangeOrigin,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    if (!from.includes(exam.status)) {
      throw ruleViolationError(EXAM_RULE_CODE, message);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('exams')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', examId)
        .execute();
      if (changes.status === 'locked') {
        const today = this.today();
        const questions = await transaction
          .selectFrom('exam_questions')
          .select('question_id')
          .where('exam_id', '=', examId)
          .execute();
        if (questions.length > 0) {
          const inserted = await transaction
            .insertInto('question_usages')
            .values(questions.map((row) => ({ question_id: row.question_id, exam_id: examId, used_on: today })))
            .onConflict((conflict) => conflict.columns(['question_id', 'exam_id']).doNothing())
            .returning('question_id')
            .execute();
          if (inserted.length > 0) {
            await transaction
              .updateTable('questions')
              .set((expression) => ({ last_used_at: today, use_count: expression('use_count', '+', 1) }))
              .where(
                'id',
                'in',
                inserted.map((row) => row.question_id),
              )
              .execute();
          }
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exams',
        entityId: examId,
        action: 'update',
        before: { status: exam.status },
        after: { ...changes, ...extra },
      });
    });
    return exam;
  }

  async submitExam(currentUser: CurrentUser, examId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertAuthorDraft(currentUser, exam);
    const variants = await database.selectFrom('exam_variants').select('code').where('exam_id', '=', examId).execute();
    if (variants.length === 0) {
      throw ruleViolationError(EXAM_RULE_CODE, 'Đề chưa trộn mã đề');
    }
    await this.moveExam(
      examId,
      ['draft'],
      { status: 'submitted', submitted_at: this.clock.now(), review_note: null },
      origin,
      'Đề không ở trạng thái soạn',
    );
    return this.exam(currentUser, examId);
  }

  async reviewExam(
    currentUser: CurrentUser,
    examId: string,
    decision: { approve: boolean; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    if (exam.reviewer_user_id !== currentUser.id && !currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người được giao thẩm định hoặc người quản lý thẩm định đề');
    }
    await this.moveExam(
      examId,
      ['submitted'],
      { status: decision.approve ? 'approved' : 'draft', review_note: decision.note, reviewed_at: this.clock.now() },
      origin,
      'Đề không ở trạng thái chờ thẩm định',
    );
    return this.exam(currentUser, examId);
  }

  async lockExam(currentUser: CurrentUser, examId: string, origin: ChangeOrigin) {
    await this.moveExam(
      examId,
      ['approved'],
      { status: 'locked', locked_at: this.clock.now(), locked_by_name: currentUser.description.full_name },
      origin,
      'Chỉ khoá được đề đã thẩm định',
    );
    return this.exam(currentUser, examId);
  }

  async unlockExam(currentUser: CurrentUser, examId: string, reason: string, origin: ChangeOrigin) {
    await this.moveExam(
      examId,
      ['locked'],
      { status: 'approved', locked_at: null, locked_by_name: null },
      origin,
      'Đề chưa khoá',
      { reason },
    );
    return this.exam(currentUser, examId);
  }

  // Xuất đề của một mã hoặc đáp án các mã thành Word, PDF; mỗi lần tải ghi nhật ký
  async exportExam(
    currentUser: CurrentUser,
    examId: string,
    part: 'paper' | 'answers',
    code: string | undefined,
    format: 'pdf' | 'docx',
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const exam = await this.findExam(database, examId);
    this.assertCanSee(currentUser, exam);
    const [questions, variants, grade] = await Promise.all([
      this.examQuestions(database, examId),
      database
        .selectFrom('exam_variants')
        .select(['code', 'items'])
        .where('exam_id', '=', examId)
        .orderBy('code')
        .execute(),
      database.selectFrom('grade_levels').select('name').where('code', '=', exam.grade_level_code).executeTakeFirst(),
    ]);
    if (variants.length === 0) {
      throw ruleViolationError(EXAM_RULE_CODE, 'Đề chưa trộn mã đề');
    }
    const subtitle = `Môn ${exam.subject_name} – ${grade?.name ?? exam.grade_level_code} – Thời gian làm bài ${exam.duration_minutes} phút`;
    let blocks: DocumentBlock[];
    let fileName: string;
    if (part === 'paper') {
      const variant = variants.find((item) => item.code === code) ?? variants[0];
      if (!variant) {
        throw notFoundError('Không có mã đề này', 'exam_variant');
      }
      blocks = paperBlocks(exam.title, subtitle, variant.code, variant.items as VariantItem[], questions);
      fileName = `de-${variant.code}`;
    } else {
      blocks = answerBlocks(exam.title, subtitle, variants as Array<{ code: string; items: VariantItem[] }>, questions);
      fileName = 'dap-an';
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'exams',
      entityId: examId,
      action: 'update',
      before: null,
      after: { downloaded: part, code: code ?? null, format },
    });
    return format === 'docx'
      ? { buffer: buildDocx(blocks, { title: exam.title }), contentType: DOCX_TYPE, fileName: `${fileName}.docx` }
      : {
          buffer: await buildDocumentPdf(blocks, { title: exam.title }),
          contentType: PDF_TYPE,
          fileName: `${fileName}.pdf`,
        };
  }
}

const SECTION_TITLES: Record<QuestionType, string> = {
  multiple_choice: 'PHẦN TRẮC NGHIỆM NHIỀU LỰA CHỌN',
  true_false: 'PHẦN TRẮC NGHIỆM ĐÚNG SAI',
  short_answer: 'PHẦN TRẢ LỜI NGẮN',
  essay: 'PHẦN TỰ LUẬN',
};

type ExamQuestionRow = { question_id: string; score: number; snapshot: QuestionSnapshot };

// Nội dung đề của một mã: các phần theo dạng câu, câu đánh số liên tục, lựa chọn theo thứ tự của mã đề
export function paperBlocks(
  title: string,
  subtitle: string,
  code: string,
  items: VariantItem[],
  questions: ExamQuestionRow[],
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [{ kind: 'title', text: title.toUpperCase(), subtitle }];
  blocks.push({ kind: 'paragraph', text: `Mã đề ${code}`, bold: true, align: 'right' });
  blocks.push({
    kind: 'paragraph',
    text: 'Họ và tên: ................................  Lớp: ..........',
    italic: true,
  });
  let section: QuestionType | null = null;
  for (const item of items) {
    const question = questions.find((row) => row.question_id === item.question_id);
    if (!question) continue;
    const snapshot = question.snapshot;
    if (snapshot.question_type !== section) {
      section = snapshot.question_type;
      blocks.push({ kind: 'heading', text: SECTION_TITLES[section] });
    }
    blocks.push({ kind: 'paragraph', text: `Câu ${item.number} (${question.score} điểm). ${snapshot.content}` });
    if (snapshot.question_type === 'multiple_choice') {
      item.option_order.forEach((original, index) => {
        const option = snapshot.options.find((row) => row.key === original);
        blocks.push({ kind: 'paragraph', text: `${OPTION_KEYS[index]}. ${option?.content ?? ''}` });
      });
    } else if (snapshot.question_type === 'true_false') {
      snapshot.options.forEach((option, index) => {
        blocks.push({ kind: 'paragraph', text: `${TRUE_FALSE_KEYS[index]}) ${option.content}` });
      });
    }
  }
  blocks.push({ kind: 'paragraph', text: '— HẾT —', align: 'center', bold: true });
  return blocks;
}

// Đáp án: bảng câu × mã đề cho câu có đáp án; hướng dẫn chấm câu tự luận theo thứ tự soạn
export function answerBlocks(
  title: string,
  subtitle: string,
  variants: Array<{ code: string; items: VariantItem[] }>,
  questions: ExamQuestionRow[],
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [
    { kind: 'title', text: `ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM – ${title.toUpperCase()}`, subtitle },
  ];
  const count = Math.max(...variants.map((variant) => variant.items.length));
  const rows: string[][] = [];
  for (let number = 1; number <= count; number += 1) {
    rows.push([
      String(number),
      ...variants.map((variant) => variant.items.find((item) => item.number === number)?.answer.join(', ') ?? ''),
    ]);
  }
  blocks.push({ kind: 'table', header: ['Câu', ...variants.map((variant) => `Mã ${variant.code}`)], rows });
  const essays = questions.filter((question) => question.snapshot.question_type === 'essay');
  if (essays.length > 0) {
    blocks.push({ kind: 'heading', text: 'Hướng dẫn chấm phần tự luận (theo thứ tự câu của mã đầu tiên)' });
    const first = variants[0];
    for (const question of essays) {
      const number = first?.items.find((item) => item.question_id === question.question_id)?.number;
      blocks.push({
        kind: 'paragraph',
        text: `Câu ${number ?? ''} (${question.score} điểm): ${question.snapshot.guidance ?? ''}`,
      });
    }
  }
  blocks.push({
    kind: 'paragraph',
    text: `Tổng điểm: ${questions.reduce((sum, question) => sum + question.score, 0)}. Mức nhận thức: ${COGNITIVE_LEVELS.map(
      (level) =>
        `${COGNITIVE_LABELS[level]} ${questions.filter((question) => question.snapshot.cognitive_level === level).length} câu`,
    ).join(', ')}.`,
    italic: true,
  });
  return blocks;
}
