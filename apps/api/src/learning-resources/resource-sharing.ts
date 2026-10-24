import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ResourceQuestionItemKind, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { buildDocumentPdf, PDF_TYPE, type DocumentBlock } from '../kpi/kpi-documents.js';
import { FileStorage } from '../files/file-storage.js';
import { LearningResourcesService, type ResourceContext } from './learning-resources.js';
import {
  buildPackage,
  PACKAGE_FORMAT,
  readPackage,
  RESOURCE_SHARING_RULE_CODE,
  rubricMaxScore,
  sha256,
  topicGaps,
  type PackageItem,
  type RubricCriterion,
  type RubricInput,
  type RubricLevel,
} from './resource-sharing-rules.js';

// Kho học liệu số, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Một nguồn sự thật: câu hỏi, đề, ma trận đọc thẳng từ ngân hàng của 22g1 ở năm học hiện hành; kho không sao chép, không có
//   luồng duyệt thứ hai, chỉ hiện trạng thái của 22g1 và đường dẫn sang màn hình 8.1, 8.2, 8.4. Ai thấy gì theo 22g1: câu dùng
//   được ai dùng kho cũng thấy, câu chưa duyệt chỉ người soạn và người thẩm định; đề chỉ người ra đề, người thẩm định, người
//   quản lý đề; ma trận ai dùng kho cũng thấy;
// - Bộ sưu tập của kho chứa thêm câu hỏi, đề, ma trận bằng tham chiếu (bảng năm học, theo năm như ngân hàng câu hỏi);
// - Thống kê sử dụng câu hỏi lấy từ lịch sử dùng câu (22g1 ghi khi khoá đề, 22g2 ghi số bài, độ khó khi khoá điểm);
// - Rubric: ai dùng kho cũng tạo, nhân bản, in; phạm vi cá nhân hoặc toàn trường; nối câu tự luận của ngân hàng;
// - Gói chia sẻ: người có quyền chia sẻ xuất một bộ sưu tập (chỉ học liệu đã công bố, tệp hoặc liên kết, giấy phép không bị
//   chặn, không "chỉ cá nhân"; kế hoạch bài dạy tham chiếu và câu hỏi không vào gói) và nhập gói của trường khác: học liệu
//   nhập thuộc người nhập, phạm vi toàn trường, gửi duyệt ngay theo luồng của 22h1, ghi nguồn gốc gói.
type YearDatabase = Kysely<SchoolYearDatabase>;

const KIND_LABELS: Record<ResourceQuestionItemKind, string> = { question: 'Câu hỏi', exam: 'Đề', matrix: 'Ma trận' };
const KIND_LINKS: Record<ResourceQuestionItemKind, string> = {
  question: '/question-bank',
  exam: '/exams',
  matrix: '/exam-matrices',
};

export function sharingRule(message: string) {
  return ruleViolationError(RESOURCE_SHARING_RULE_CODE, message);
}

@Injectable()
export class ResourceSharingService {
  constructor(
    private readonly databases: Databases,
    private readonly resources: LearningResourcesService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private year(context: ResourceContext): YearDatabase {
    if (!context.year) {
      throw sharingRule('Chưa có năm học đang dùng, hãy mở năm học trước');
    }
    return context.year.database;
  }

  private canReviewBank(currentUser: CurrentUser) {
    return (
      currentUser.hasPermission(PERMISSION_CODES.examReview) || currentUser.hasPermission(PERMISSION_CODES.examManage)
    );
  }

  // ---- Câu hỏi, đề, ma trận của ngân hàng 22g1 trong kho ----

  private visibleQuestions(database: YearDatabase, currentUser: CurrentUser) {
    let query = database
      .selectFrom('questions')
      .innerJoin('subjects', 'subjects.id', 'questions.subject_id')
      .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
      .select([
        'questions.id',
        'questions.content',
        'questions.question_type',
        'questions.cognitive_level',
        'questions.grade_level_code',
        'questions.subject_id',
        'questions.status',
        'questions.score',
        'questions.use_count',
        'questions.last_used_at',
        'questions.author_name',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'question_topics.name as topic_name',
      ]);
    if (!this.canReviewBank(currentUser)) {
      query = query.where((expression) =>
        expression.or([
          expression('questions.status', '=', 'approved'),
          expression('questions.author_user_id', '=', currentUser.id),
        ]),
      );
    }
    return query;
  }

  private visibleExams(database: YearDatabase, currentUser: CurrentUser) {
    let query = database
      .selectFrom('exams')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .select([
        'exams.id',
        'exams.title',
        'exams.status',
        'exams.grade_level_code',
        'exams.subject_id',
        'exams.author_name',
        'subjects.name as subject_name',
      ]);
    if (!currentUser.hasPermission(PERMISSION_CODES.examManage)) {
      query = query.where((expression) =>
        expression.or([
          expression('exams.author_user_id', '=', currentUser.id),
          expression('exams.reviewer_user_id', '=', currentUser.id),
        ]),
      );
    }
    return query;
  }

  async bank(
    currentUser: CurrentUser,
    filter: {
      kind: ResourceQuestionItemKind;
      q: string | null;
      subject_id: string | null;
      grade_level_code: string | null;
      cognitive_level: string | null;
    },
  ) {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const pattern = filter.q ? `%${filter.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    if (filter.kind === 'question') {
      let query = this.visibleQuestions(database, currentUser);
      query = query.where('questions.status', '!=', 'retired');
      if (pattern) query = query.where('questions.content', 'ilike', pattern);
      if (filter.subject_id) query = query.where('questions.subject_id', '=', filter.subject_id);
      if (filter.grade_level_code) query = query.where('questions.grade_level_code', '=', filter.grade_level_code);
      if (filter.cognitive_level) {
        query = query.where('questions.cognitive_level', '=', filter.cognitive_level as never);
      }
      const rows = await query.orderBy('questions.updated_at', 'desc').limit(500).execute();
      const usage = await this.usageByQuestion(
        database,
        rows.map((row) => row.id),
      );
      return rows.map((row) => ({
        kind: 'question' as const,
        id: row.id,
        title: row.content.length > 160 ? `${row.content.slice(0, 157)}...` : row.content,
        question_type: row.question_type,
        cognitive_level: row.cognitive_level,
        subject_name: row.subject_name,
        grade_level_code: row.grade_level_code,
        topic_name: row.topic_name,
        status: row.status,
        score: Number(row.score),
        author_name: row.author_name,
        ...(usage.get(row.id) ?? { exams: 0, attempts: 0, difficulty: null }),
        link: KIND_LINKS.question,
      }));
    }
    if (filter.kind === 'exam') {
      let query = this.visibleExams(database, currentUser);
      if (pattern) query = query.where('exams.title', 'ilike', pattern);
      if (filter.subject_id) query = query.where('exams.subject_id', '=', filter.subject_id);
      if (filter.grade_level_code) query = query.where('exams.grade_level_code', '=', filter.grade_level_code);
      const rows = await query.orderBy('exams.updated_at', 'desc').limit(500).execute();
      return rows.map((row) => ({ kind: 'exam' as const, ...row, link: KIND_LINKS.exam }));
    }
    let query = database
      .selectFrom('exam_matrices')
      .innerJoin('subjects', 'subjects.id', 'exam_matrices.subject_id')
      .select([
        'exam_matrices.id',
        'exam_matrices.name as title',
        'exam_matrices.grade_level_code',
        'exam_matrices.total_score',
        'exam_matrices.status',
        'subjects.name as subject_name',
      ])
      .where('exam_matrices.status', '=', 'active');
    if (pattern) query = query.where('exam_matrices.name', 'ilike', pattern);
    if (filter.subject_id) query = query.where('exam_matrices.subject_id', '=', filter.subject_id);
    if (filter.grade_level_code) query = query.where('exam_matrices.grade_level_code', '=', filter.grade_level_code);
    const rows = await query.orderBy('exam_matrices.updated_at', 'desc').limit(500).execute();
    return rows.map((row) => ({
      kind: 'matrix' as const,
      ...row,
      total_score: Number(row.total_score),
      link: KIND_LINKS.matrix,
    }));
  }

  // Lịch sử dùng câu: số đề đã khoá dùng câu, số bài đã chấm, độ khó trung bình theo số bài (22g1, 22g2)
  private async usageByQuestion(database: YearDatabase, ids: string[]) {
    const result = new Map<string, { exams: number; attempts: number; difficulty: number | null }>();
    if (ids.length === 0) return result;
    const rows = await database
      .selectFrom('question_usages')
      .select(['question_id', 'attempts', 'difficulty'])
      .where('question_id', 'in', ids)
      .execute();
    for (const id of ids) {
      const own = rows.filter((row) => row.question_id === id);
      const attempts = own.reduce((sum, row) => sum + (row.attempts ?? 0), 0);
      const weighted = own.reduce((sum, row) => sum + (row.attempts ?? 0) * Number(row.difficulty ?? 0), 0);
      result.set(id, {
        exams: own.length,
        attempts,
        difficulty: attempts > 0 ? Math.round((weighted / attempts) * 100) / 100 : null,
      });
    }
    return result;
  }

  // ---- Câu hỏi, đề, ma trận trong bộ sưu tập ----

  async collectionItems(currentUser: CurrentUser, collectionId: string) {
    const context = await this.resources.context(currentUser);
    await this.resources.visibleCollection(context, collectionId);
    const database = this.year(context);
    const items = await database
      .selectFrom('resource_collection_questions')
      .select(['item_kind', 'item_id', 'position'])
      .where('collection_id', '=', collectionId)
      .orderBy('position')
      .execute();
    const ids = (kind: ResourceQuestionItemKind) =>
      items.filter((item) => item.item_kind === kind).map((item) => item.item_id);
    const [questions, exams, matrices] = await Promise.all([
      ids('question').length > 0
        ? this.visibleQuestions(database, currentUser).where('questions.id', 'in', ids('question')).execute()
        : Promise.resolve([]),
      ids('exam').length > 0
        ? this.visibleExams(database, currentUser).where('exams.id', 'in', ids('exam')).execute()
        : Promise.resolve([]),
      ids('matrix').length > 0
        ? database.selectFrom('exam_matrices').select(['id', 'name']).where('id', 'in', ids('matrix')).execute()
        : Promise.resolve([]),
    ]);
    // Mục người xem không thấy theo 22g1 (đề chưa giao cho mình) hoặc đã xoá thì không hiện
    return items.flatMap((item) => {
      const found =
        item.item_kind === 'question'
          ? questions.find((row) => row.id === item.item_id)
          : item.item_kind === 'exam'
            ? exams.find((row) => row.id === item.item_id)
            : matrices.find((row) => row.id === item.item_id);
      if (!found) return [];
      const title =
        'content' in found
          ? found.content.slice(0, 160)
          : 'title' in found
            ? found.title
            : (found as { name: string }).name;
      return [
        {
          kind: item.item_kind,
          kind_label: KIND_LABELS[item.item_kind],
          id: item.item_id,
          position: item.position,
          title,
          status: 'status' in found ? found.status : 'active',
          link: KIND_LINKS[item.item_kind],
        },
      ];
    });
  }

  // Thay danh sách câu hỏi, đề, ma trận của bộ sưu tập theo thứ tự gửi lên; chỉ người lập, chỉ mục người lập thấy được
  async setCollectionItems(
    currentUser: CurrentUser,
    collectionId: string,
    items: Array<{ kind: ResourceQuestionItemKind; id: string }>,
  ) {
    const context = await this.resources.context(currentUser);
    const collection = await this.resources.visibleCollection(context, collectionId);
    if (collection.owner_user_id !== context.userId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập sửa được bộ sưu tập');
    }
    const database = this.year(context);
    const keys = items.map((item) => `${item.kind}:${item.id}`);
    if (new Set(keys).size !== keys.length || items.length > 500) {
      throw validationError([{ field: 'items', message: 'Danh sách không trùng, tối đa 500 mục' }]);
    }
    const ids = (kind: ResourceQuestionItemKind) => items.filter((item) => item.kind === kind).map((item) => item.id);
    const [questions, exams, matrices] = await Promise.all([
      ids('question').length > 0
        ? this.visibleQuestions(database, currentUser).where('questions.id', 'in', ids('question')).execute()
        : Promise.resolve([]),
      ids('exam').length > 0
        ? this.visibleExams(database, currentUser).where('exams.id', 'in', ids('exam')).execute()
        : Promise.resolve([]),
      ids('matrix').length > 0
        ? database.selectFrom('exam_matrices').select('id').where('id', 'in', ids('matrix')).execute()
        : Promise.resolve([]),
    ]);
    const known = new Set([
      ...questions.map((row) => `question:${row.id}`),
      ...exams.map((row) => `exam:${row.id}`),
      ...matrices.map((row) => `matrix:${row.id}`),
    ]);
    if (keys.some((key) => !known.has(key))) {
      throw validationError([
        { field: 'items', message: 'Có câu hỏi, đề, ma trận không tồn tại hoặc bạn không xem được' },
      ]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('resource_collection_questions').where('collection_id', '=', collectionId).execute();
      if (items.length > 0) {
        await transaction
          .insertInto('resource_collection_questions')
          .values(
            items.map((item, index) => ({
              collection_id: collectionId,
              item_kind: item.kind,
              item_id: item.id,
              position: index + 1,
              added_by: context.userId,
            })),
          )
          .execute();
      }
    });
    return this.collectionItems(currentUser, collectionId);
  }

  // ---- Thống kê sử dụng chung ----

  async statistics(currentUser: CurrentUser) {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const system = this.databases.system;
    const [questions, usage, questionTopics, resourceTopics, resources, subjects] = await Promise.all([
      database
        .selectFrom('questions')
        .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
        .select(['questions.id', 'questions.subject_id', 'questions.grade_level_code', 'questions.cognitive_level'])
        .select('question_topics.name as topic_name')
        .where('questions.status', '=', 'approved')
        .execute(),
      database.selectFrom('question_usages').select(['question_id', 'attempts', 'difficulty']).execute(),
      database
        .selectFrom('question_topics')
        .select(['subject_id', 'grade_level_code', 'name'])
        .where('status', '=', 'active')
        .execute(),
      system
        .selectFrom('resource_topics')
        .select(['id', 'subject_code', 'grade_level_code', 'name'])
        .where('status', '=', 'active')
        .execute(),
      system
        .selectFrom('learning_resources')
        .select(['subject_code', 'grade_level_code', 'topic_id'])
        .where('status', '=', 'published')
        .execute(),
      database.selectFrom('subjects').select(['id', 'code', 'name']).execute(),
    ]);
    const subjectOf = (id: string) => subjects.find((row) => row.id === id);
    const nameOfCode = (code: string | null) =>
      subjects.find((row) => row.code === code)?.name ?? code ?? 'Chưa ghi môn';
    const count = <Row>(rows: Row[], key: (row: Row) => string) => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + 1);
      return [...map.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'vi'));
    };
    const usedIds = new Set(usage.map((row) => row.question_id));
    const levelLabels: Record<string, string> = {
      recognition: 'Nhận biết',
      comprehension: 'Thông hiểu',
      application: 'Vận dụng',
      high_application: 'Vận dụng cao',
    };
    const byLevel = ['recognition', 'comprehension', 'application', 'high_application'].map((level) => {
      const own = questions.filter((row) => row.cognitive_level === level);
      const ids = new Set(own.map((row) => row.id));
      const rows = usage.filter((row) => ids.has(row.question_id));
      const attempts = rows.reduce((sum, row) => sum + (row.attempts ?? 0), 0);
      const weighted = rows.reduce((sum, row) => sum + (row.attempts ?? 0) * Number(row.difficulty ?? 0), 0);
      return {
        level,
        label: levelLabels[level] as string,
        questions: own.length,
        used: own.filter((row) => usedIds.has(row.id)).length,
        attempts,
        difficulty: attempts > 0 ? Math.round((weighted / attempts) * 100) / 100 : null,
      };
    });
    // Khoá chủ đề so khớp giữa danh mục chủ đề của kho (mã môn) và chủ đề câu hỏi (mã môn qua môn của năm học)
    const key = (subjectCode: string | null | undefined, grade: string | null, name: string) =>
      `${subjectCode ?? ''}|${grade ?? ''}|${name.trim().toLowerCase()}`;
    const topics = new Map<string, string>();
    for (const topic of resourceTopics) {
      topics.set(
        key(topic.subject_code, topic.grade_level_code, topic.name),
        `${nameOfCode(topic.subject_code)}: ${topic.name}`,
      );
    }
    for (const topic of questionTopics) {
      const subject = subjectOf(topic.subject_id);
      topics.set(key(subject?.code, topic.grade_level_code, topic.name), `${subject?.name ?? ''}: ${topic.name}`);
    }
    const resourceCounts = new Map<string, number>();
    for (const row of resources) {
      const topic = resourceTopics.find((item) => item.id === row.topic_id);
      if (!topic) continue;
      const topicKey = key(topic.subject_code, topic.grade_level_code, topic.name);
      resourceCounts.set(topicKey, (resourceCounts.get(topicKey) ?? 0) + 1);
    }
    const questionCounts = new Map<string, number>();
    for (const row of questions) {
      if (!row.topic_name) continue;
      const topicKey = key(subjectOf(row.subject_id)?.code, row.grade_level_code, row.topic_name);
      questionCounts.set(topicKey, (questionCounts.get(topicKey) ?? 0) + 1);
    }
    return {
      questions: questions.length,
      used_questions: questions.filter((row) => usedIds.has(row.id)).length,
      questions_by_subject: count(questions, (row) => subjectOf(row.subject_id)?.name ?? 'Chưa ghi môn'),
      questions_by_topic: count(questions, (row) => row.topic_name ?? 'Chưa phân chủ đề'),
      questions_by_level: byLevel,
      resources_by_subject: count(resources, (row) => nameOfCode(row.subject_code)),
      gaps: topicGaps(
        [...topics.entries()].map(([topicKey, name]) => ({ key: topicKey, name })),
        resourceCounts,
        questionCounts,
      ).sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    };
  }

  // ---- Rubric ----

  private async visibleRubric(database: YearDatabase, context: ResourceContext, id: string) {
    const row = await database.selectFrom('rubrics').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row || (row.visibility === 'private' && row.owner_user_id !== context.userId && !context.canManage)) {
      throw notFoundError('Không tìm thấy rubric', 'rubric');
    }
    return row;
  }

  private publicRubric<Row extends { levels: unknown; criteria: unknown; max_score: string; owner_user_id: string }>(
    row: Row,
    context: ResourceContext,
  ) {
    return {
      ...row,
      levels: row.levels as RubricLevel[],
      criteria: row.criteria as RubricCriterion[],
      max_score: Number(row.max_score),
      is_owner: row.owner_user_id === context.userId,
    };
  }

  async rubrics(currentUser: CurrentUser) {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const rows = await database
      .selectFrom('rubrics')
      .leftJoin('subjects', 'subjects.id', 'rubrics.subject_id')
      .leftJoin('questions', 'questions.id', 'rubrics.question_id')
      .selectAll('rubrics')
      .select(['subjects.name as subject_name', 'questions.content as question_content'])
      .where((expression) =>
        expression.or([
          expression('rubrics.visibility', '=', 'school'),
          expression('rubrics.owner_user_id', '=', context.userId),
        ]),
      )
      .orderBy('rubrics.status')
      .orderBy('rubrics.updated_at', 'desc')
      .execute();
    return rows.map((row) => this.publicRubric(row, context));
  }

  private async checkRubricLinks(database: YearDatabase, input: RubricInput) {
    if (input.subject_id) {
      const subject = await database
        .selectFrom('subjects')
        .select('id')
        .where('id', '=', input.subject_id)
        .executeTakeFirst();
      if (!subject) throw validationError([{ field: 'subject_id', message: 'Môn không có trong danh mục' }]);
    }
    if (input.question_id) {
      const question = await database
        .selectFrom('questions')
        .select('question_type')
        .where('id', '=', input.question_id)
        .executeTakeFirst();
      if (!question || question.question_type !== 'essay') {
        throw validationError([{ field: 'question_id', message: 'Rubric chỉ nối câu tự luận của ngân hàng câu hỏi' }]);
      }
    }
  }

  async saveRubric(currentUser: CurrentUser, id: string | null, input: RubricInput) {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    await this.checkRubricLinks(database, input);
    const values = {
      ...input,
      levels: JSON.stringify(input.levels),
      criteria: JSON.stringify(input.criteria),
      max_score: rubricMaxScore(input.levels, input.criteria),
    };
    if (id === null) {
      const row = await database
        .insertInto('rubrics')
        .values({ ...values, owner_user_id: context.userId, owner_name: context.name })
        .returningAll()
        .executeTakeFirstOrThrow();
      return this.publicRubric(row, context);
    }
    const existing = await this.visibleRubric(database, context, id);
    if (existing.owner_user_id !== context.userId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập sửa được rubric; hãy nhân bản để dùng riêng');
    }
    const row = await database
      .updateTable('rubrics')
      .set({ ...values, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.publicRubric(row, context);
  }

  async cloneRubric(currentUser: CurrentUser, id: string) {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const source = await this.visibleRubric(database, context, id);
    const row = await database
      .insertInto('rubrics')
      .values({
        name: `Bản sao của ${source.name}`.slice(0, 300),
        description: source.description,
        school_level: source.school_level,
        subject_id: source.subject_id,
        grade_level_code: source.grade_level_code,
        question_id: source.question_id,
        levels: JSON.stringify(source.levels),
        criteria: JSON.stringify(source.criteria),
        max_score: Number(source.max_score),
        visibility: 'private',
        source_rubric_id: source.id,
        owner_user_id: context.userId,
        owner_name: context.name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.publicRubric(row, context);
  }

  async setRubricStatus(currentUser: CurrentUser, id: string, status: 'active' | 'archived') {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const row = await this.visibleRubric(database, context, id);
    if (row.owner_user_id !== context.userId && !context.canManage) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập hoặc thủ kho lưu trữ được rubric');
    }
    const updated = await database
      .updateTable('rubrics')
      .set({ status, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.publicRubric(updated, context);
  }

  async printRubric(currentUser: CurrentUser, id: string) {
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const row = this.publicRubric(await this.visibleRubric(database, context, id), context);
    const blocks: DocumentBlock[] = [
      { kind: 'title', text: `RUBRIC: ${row.name.toUpperCase()}`, subtitle: `Điểm tối đa ${row.max_score}` },
    ];
    if (row.description) blocks.push({ kind: 'paragraph', text: row.description, italic: true });
    blocks.push({
      kind: 'table',
      header: ['Tiêu chí (trọng số)', ...row.levels.map((level) => `${level.label} (${level.score})`)],
      rows: row.criteria.map((criterion) => [`${criterion.name} (×${criterion.weight})`, ...criterion.descriptors]),
    });
    blocks.push({
      kind: 'paragraph',
      text: 'Điểm bài = tổng (điểm mức đạt × trọng số) của các tiêu chí.',
      italic: true,
    });
    return {
      buffer: await buildDocumentPdf(blocks, { title: row.name }),
      contentType: PDF_TYPE,
      fileName: 'rubric.pdf',
    };
  }

  // ---- Gói chia sẻ liên trường (bản chạy nội bộ) ----

  private assertShare(currentUser: CurrentUser) {
    if (!currentUser.hasPermission(PERMISSION_CODES.learningResourceShare)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xuất, nhập gói chia sẻ');
    }
  }

  // Học liệu của bộ sưu tập chia thành xuất được và bỏ qua (kèm lý do)
  async packagePreview(currentUser: CurrentUser, collectionId: string) {
    this.assertShare(currentUser);
    const context = await this.resources.context(currentUser);
    const collection = await this.resources.visibleCollection(context, collectionId);
    const rows = await this.databases.system
      .selectFrom('resource_collection_items')
      .innerJoin('learning_resources', 'learning_resources.id', 'resource_collection_items.resource_id')
      .innerJoin('resource_types', 'resource_types.id', 'learning_resources.type_id')
      .leftJoin('resource_licenses', 'resource_licenses.id', 'learning_resources.license_id')
      .leftJoin('learning_resource_versions', (join) =>
        join
          .onRef('learning_resource_versions.resource_id', '=', 'learning_resources.id')
          .onRef('learning_resource_versions.version_no', '=', 'learning_resources.published_version'),
      )
      .select([
        'learning_resources.id',
        'learning_resources.title',
        'learning_resources.description',
        'learning_resources.school_level',
        'learning_resources.grade_level_code',
        'learning_resources.subject_code',
        'learning_resources.subject_name',
        'learning_resources.keywords',
        'learning_resources.author_name',
        'learning_resources.language',
        'learning_resources.duration_minutes',
        'learning_resources.license_source',
        'learning_resources.origin',
        'learning_resources.status',
        'learning_resources.published_version',
        'resource_types.code as type_code',
        'resource_licenses.code as license_code',
        'resource_licenses.blocked',
        'resource_licenses.private_only',
        'learning_resource_versions.kind',
        'learning_resource_versions.storage_key',
        'learning_resource_versions.file_name',
        'learning_resource_versions.content_type',
        'learning_resource_versions.sha256',
        'learning_resource_versions.url',
        'learning_resource_versions.link_title',
      ])
      .where('resource_collection_items.collection_id', '=', collectionId)
      .orderBy('resource_collection_items.position')
      .execute();
    const exportable: typeof rows = [];
    const skipped: Array<{ title: string; reason: string }> = [];
    for (const row of rows) {
      const reason =
        row.published_version === null || row.status === 'hidden' || row.status === 'retired'
          ? 'Chưa công bố hoặc đang ẩn, ngừng dùng'
          : !row.license_code
            ? 'Thiếu giấy phép'
            : row.blocked || row.private_only
              ? 'Giấy phép bị chặn hoặc không rõ'
              : row.kind !== 'file' && row.kind !== 'link'
                ? 'Kế hoạch bài dạy tham chiếu không đóng gói được'
                : null;
      if (reason) skipped.push({ title: row.title, reason });
      else exportable.push(row);
    }
    return { collection: { id: collection.id, name: collection.name }, exportable, skipped };
  }

  async exportPackage(currentUser: CurrentUser, collectionId: string, sourceSchool: string) {
    const preview = await this.packagePreview(currentUser, collectionId);
    if (preview.exportable.length === 0) {
      throw sharingRule('Bộ sưu tập không có học liệu nào xuất được');
    }
    const items: PackageItem[] = [];
    let size = 0;
    for (const row of preview.exportable) {
      let data: string | null = null;
      if (row.kind === 'file' && row.storage_key) {
        const body = await this.fileStorage.get(row.storage_key);
        size += body.length;
        if (size > 100 * 1024 * 1024) {
          throw sharingRule('Gói vượt 100 MB; hãy tách bộ sưu tập nhỏ hơn');
        }
        data = body.toString('base64');
      }
      items.push({
        title: row.title,
        description: row.description,
        type_code: row.type_code,
        school_level: row.school_level,
        grade_level_code: row.grade_level_code,
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        keywords: row.keywords,
        author_name: row.author_name,
        language: row.language,
        duration_minutes: row.duration_minutes,
        license_code: row.license_code as string,
        license_source: row.license_source,
        origin: row.origin,
        kind: row.kind as 'file' | 'link',
        file_name: row.file_name,
        content_type: row.content_type,
        sha256: row.sha256,
        data,
        url: row.url,
        link_title: row.link_title,
      });
    }
    const code = `GOI-${randomUUID().slice(0, 8).toUpperCase()}`;
    const buffer = buildPackage({
      format: PACKAGE_FORMAT,
      package_code: code,
      source_school: sourceSchool,
      created_at: this.clock.now().toISOString(),
      items,
    });
    return { buffer, contentType: 'application/gzip', fileName: `${code.toLowerCase()}.hoclieu.gz`, code };
  }

  // Nhập gói: học liệu hợp lệ, chưa có trong kho thì tạo, thêm phiên bản, gửi duyệt; còn lại ghi lý do bỏ qua
  async importPackage(currentUser: CurrentUser, body: Buffer) {
    this.assertShare(currentUser);
    const context = await this.resources.context(currentUser);
    const database = this.year(context);
    const { manifest, problems } = readPackage(body);
    const system = this.databases.system;
    const [types, licenses, subjects] = await Promise.all([
      system.selectFrom('resource_types').select(['id', 'code', 'status']).execute(),
      system.selectFrom('resource_licenses').select(['id', 'code', 'blocked', 'private_only', 'status']).execute(),
      database.selectFrom('subjects').select('code').execute(),
    ]);
    const other = types.find((type) => type.code === 'other');
    const skipped: Array<{ title: string; reason: string }> = [];
    const created: string[] = [];
    for (const [index, item] of manifest.items.entries()) {
      const title = typeof item?.title === 'string' ? item.title : `Mục ${index + 1}`;
      const problem = problems.find((row) => row.index === index);
      if (problem) {
        skipped.push({ title, reason: problem.message });
        continue;
      }
      const license = licenses.find((row) => row.code === item.license_code && row.status === 'active');
      if (!license || license.blocked || license.private_only) {
        skipped.push({ title, reason: 'Giấy phép không có trong danh mục của trường, bị chặn hoặc không rõ' });
        continue;
      }
      const duplicate =
        item.kind === 'file'
          ? await system
              .selectFrom('learning_resource_versions')
              .select('resource_id')
              .where('sha256', '=', item.sha256 as string)
              .executeTakeFirst()
          : await system
              .selectFrom('learning_resource_versions')
              .select('resource_id')
              .where('url', '=', item.url as string)
              .executeTakeFirst();
      if (duplicate) {
        skipped.push({ title, reason: 'Trùng học liệu đã có trong kho' });
        continue;
      }
      const type = types.find((row) => row.code === item.type_code && row.status === 'active') ?? other;
      try {
        const resource = await this.resources.create(currentUser, {
          title: title.slice(0, 300),
          description: item.description ?? null,
          type_id: type?.id as string,
          school_level: ['MN', 'TH', 'THCS', 'THPT'].includes(item.school_level ?? '') ? item.school_level : null,
          grade_level_code: item.grade_level_code ?? null,
          subject_code: subjects.some((row) => row.code === item.subject_code) ? item.subject_code : null,
          topic_id: null,
          week_no: null,
          keywords: Array.isArray(item.keywords) ? item.keywords.slice(0, 20) : [],
          author_name: item.author_name ?? null,
          language: item.language || 'vi',
          duration_minutes: item.duration_minutes ?? null,
          license_id: license.id,
          license_source: item.license_source ?? null,
          origin:
            `Gói ${manifest.package_code} của ${manifest.source_school}${item.origin ? `; ${item.origin}` : ''}`.slice(
              0,
              1000,
            ),
          responsible_name: context.name,
          license_expires_on: null,
          visibility: 'school',
        });
        if (item.kind === 'file') {
          await this.resources.addFile(currentUser, resource.id, {
            fileName: item.file_name as string,
            body: Buffer.from(item.data as string, 'base64'),
          });
        } else {
          await this.resources.addLink(currentUser, resource.id, { url: item.url, link_title: item.link_title });
        }
        await this.resources.submit(currentUser, resource.id);
        created.push(resource.id);
      } catch (error) {
        skipped.push({ title, reason: error instanceof Error ? error.message : 'Không nhập được' });
      }
    }
    const log = await database
      .insertInto('resource_package_imports')
      .values({
        package_code: manifest.package_code,
        source_school: manifest.source_school,
        package_created_at: Number.isNaN(Date.parse(manifest.created_at)) ? null : new Date(manifest.created_at),
        imported_count: created.length,
        skipped: JSON.stringify(skipped),
        resource_ids: JSON.stringify(created),
        imported_by: context.userId,
        imported_by_name: context.name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...log, skipped, resource_ids: created };
  }

  async packageImports(currentUser: CurrentUser) {
    this.assertShare(currentUser);
    const context = await this.resources.context(currentUser);
    return this.year(context)
      .selectFrom('resource_package_imports')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
  }
}
