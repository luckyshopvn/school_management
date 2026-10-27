import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query } from '@nestjs/common';
import { vietnamDate, type QuestionTypeCode, type SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ChildScope } from '../children/child-scope.js';

// Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213; tài liệu 32 mục 15.4). Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - câu hỏi chỉ lấy từ ngân hàng câu hỏi đã duyệt (22g1) của khối của lớp, lọc theo môn, chủ đề, mức nhận thức, dạng câu;
//   giáo viên được dùng với lớp mình phụ trách (cùng phạm vi của công cụ lớp học 23b), không cần quyền soạn câu hỏi;
// - trò chơi chạy trên máy giáo viên (màn hình lớp); máy chủ chỉ cấp câu hỏi và ghi kết quả lượt chơi khi kết thúc (gửi lại
//   từ hàng đợi ngoại tuyến không trùng nhờ `client_id`);
// - câu trắc nghiệm, đúng sai có đáp án là khóa lựa chọn thì máy chủ tự chấm lại theo đáp án trong ngân hàng; câu khác (ô chữ,
//   hỏi đáp trả lời miệng) theo đánh giá của giáo viên;
// - mỗi câu đã dùng ghi một dòng `question_usages` (nguồn trò chơi) kèm tỷ lệ đúng của lớp, tăng số lần dùng của câu;
// - không lưu hình ảnh của thẻ đáp án giấy (xử lý trên máy giáo viên); điểm trò chơi không vào sổ điểm.
export const CLASSROOM_GAMES_RULE_CODE = 'YCTD-213';
export const GAME_KINDS = ['crossword', 'wheel', 'quiz_rounds', 'answer_cards'] as const;
export type GameKind = (typeof GAME_KINDS)[number];
export const MAX_GAME_QUESTIONS = 60;
export const MAX_GAME_ANSWERS = 3000;
const MAX_QUESTION_LIMIT = 60;
const MAX_CLIENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLIENT_AHEAD_MS = 5 * 60 * 1000;
const QUESTION_TYPES: QuestionTypeCode[] = ['multiple_choice', 'true_false', 'short_answer'];

export interface GameAnswerInput {
  question_id: string;
  child_id: string | null;
  group_name: string | null;
  answer: string | null;
  correct: boolean | null;
}

export interface GameSessionInput {
  client_id: string;
  class_id: string;
  kind: GameKind;
  title: string;
  started_at: string | null;
  finished_at: string | null;
  config: Record<string, unknown>;
  group_scores: Record<string, number>;
  question_ids: string[];
  answers: GameAnswerInput[];
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function readGameSession(body: RequestBody | undefined): GameSessionInput {
  const errors: FieldError[] = [];
  const clientId = body?.client_id;
  const classId = body?.class_id;
  const kind = body?.kind;
  const title = text(body?.title, 200);
  if (!isUuid(clientId)) errors.push({ field: 'client_id', message: 'Mã lượt chơi do máy sinh không hợp lệ' });
  if (!isUuid(classId)) errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
  if (typeof kind !== 'string' || !(GAME_KINDS as readonly string[]).includes(kind)) {
    errors.push({ field: 'kind', message: 'Loại trò chơi không hợp lệ' });
  }
  if (!title) errors.push({ field: 'title', message: 'Cần tên lượt chơi' });
  const questionIds = Array.isArray(body?.question_ids) ? [...new Set(body.question_ids.filter(isUuid))] : [];
  if (questionIds.length === 0 || questionIds.length > MAX_GAME_QUESTIONS) {
    errors.push({ field: 'question_ids', message: `Lượt chơi có từ 1 đến ${MAX_GAME_QUESTIONS} câu hỏi` });
  }
  const rawAnswers = Array.isArray(body?.answers) ? (body.answers as unknown[]) : [];
  if (rawAnswers.length > MAX_GAME_ANSWERS) {
    errors.push({ field: 'answers', message: `Tối đa ${MAX_GAME_ANSWERS} câu trả lời mỗi lượt` });
  }
  const answers: GameAnswerInput[] = [];
  rawAnswers.forEach((value, index) => {
    const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const questionId = item.question_id;
    const childId = item.child_id === null || item.child_id === undefined ? null : item.child_id;
    const groupName = text(item.group_name, 60);
    if (!isUuid(questionId) || !questionIds.includes(questionId)) {
      errors.push({ field: `answers[${index}].question_id`, message: 'Câu hỏi không thuộc lượt chơi' });
      return;
    }
    if (childId !== null && !isUuid(childId)) {
      errors.push({ field: `answers[${index}].child_id`, message: 'Mã học sinh không hợp lệ' });
      return;
    }
    if (childId !== null && groupName) {
      errors.push({ field: `answers[${index}]`, message: 'Câu trả lời của một học sinh hoặc một nhóm, không cả hai' });
      return;
    }
    answers.push({
      question_id: questionId,
      child_id: childId as string | null,
      group_name: groupName,
      answer: text(item.answer, 200),
      correct: typeof item.correct === 'boolean' ? item.correct : null,
    });
  });
  const scores: Record<string, number> = {};
  if (body?.group_scores && typeof body.group_scores === 'object') {
    for (const [name, value] of Object.entries(body.group_scores as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && name.trim()) {
        scores[name.trim().slice(0, 60)] = Math.round(value);
      }
    }
  }
  if (errors.length) {
    throw validationError(errors);
  }
  return {
    client_id: clientId as string,
    class_id: classId as string,
    kind: kind as GameKind,
    title: title as string,
    started_at: typeof body?.started_at === 'string' ? body.started_at : null,
    finished_at: typeof body?.finished_at === 'string' ? body.finished_at : null,
    config: body?.config && typeof body.config === 'object' ? (body.config as Record<string, unknown>) : {},
    group_scores: scores,
    question_ids: questionIds,
    answers,
  };
}

// Chấm lại câu trắc nghiệm, đúng sai theo đáp án trong ngân hàng; câu khác dùng đánh giá của giáo viên. Không có đánh giá thì
// không tính vào tỷ lệ đúng
export function judgeAnswer(
  question: { question_type: QuestionTypeCode; answer: unknown },
  input: GameAnswerInput,
): boolean | null {
  const key = input.answer?.trim().toUpperCase() ?? null;
  const expected = Array.isArray(question.answer) ? (question.answer as unknown[]).map(String) : [];
  if (question.question_type === 'multiple_choice' && key && /^[A-F]$/.test(key)) {
    return expected.length === 1 ? expected[0] === key : expected.includes(key);
  }
  return input.correct;
}

// Tỷ lệ đúng của lớp (phần trăm, hai chữ số thập phân) trên các câu trả lời đã có đánh giá; không có thì null
export function correctRate(judged: Array<boolean | null>): number | null {
  const counted = judged.filter((value): value is boolean => value !== null);
  if (counted.length === 0) {
    return null;
  }
  return Math.round((counted.filter(Boolean).length / counted.length) * 10000) / 100;
}

@Injectable()
export class ClassroomGamesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly childScope: ChildScope,
    private readonly clock: Clock,
  ) {}

  // Cùng phạm vi của công cụ lớp học 23b: giáo viên được phân công lớp hoặc vai trò đơn vị xem được lớp
  private async classFor(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, classId: string) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'grade_level'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    const scope = await this.childScope.resolve(currentUser, database);
    if (!(
      scope.wholeSchool ||
      scope.unitIds.includes(classRecord.org_unit_id) ||
      scope.classIds.includes(classRecord.id)
    )) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    return classRecord;
  }

  // Môn, chủ đề có câu đã duyệt của khối của lớp, kèm số câu theo dạng
  async catalog(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.classFor(currentUser, database, classId);
    const rows = await database
      .selectFrom('questions')
      .innerJoin('subjects', 'subjects.id', 'questions.subject_id')
      .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
      .select((eb) => [
        'subjects.id as subject_id',
        'subjects.name as subject_name',
        'question_topics.id as topic_id',
        'question_topics.name as topic_name',
        'questions.question_type',
        eb.fn.countAll<string>().as('count'),
      ])
      .where('questions.status', '=', 'approved')
      .where('questions.grade_level_code', '=', classRecord.grade_level)
      .where('questions.question_type', 'in', QUESTION_TYPES)
      .groupBy([
        'subjects.id',
        'subjects.name',
        'question_topics.id',
        'question_topics.name',
        'questions.question_type',
      ])
      .orderBy('subjects.name')
      .execute();
    const subjects = new Map<
      string,
      {
        id: string;
        name: string;
        counts: Record<string, number>;
        topics: Map<string, { id: string; name: string; count: number }>;
      }
    >();
    for (const row of rows) {
      const subject = subjects.get(row.subject_id) ?? {
        id: row.subject_id,
        name: row.subject_name,
        counts: {} as Record<string, number>,
        topics: new Map(),
      };
      subjects.set(row.subject_id, subject);
      subject.counts[row.question_type] = (subject.counts[row.question_type] ?? 0) + Number(row.count);
      if (row.topic_id && row.topic_name) {
        const topic = subject.topics.get(row.topic_id) ?? { id: row.topic_id, name: row.topic_name, count: 0 };
        topic.count += Number(row.count);
        subject.topics.set(row.topic_id, topic);
      }
    }
    return {
      class_id: classRecord.id,
      class_name: classRecord.name,
      grade_level: classRecord.grade_level,
      subjects: [...subjects.values()].map((subject) => ({
        id: subject.id,
        name: subject.name,
        counts: subject.counts,
        topics: [...subject.topics.values()],
      })),
    };
  }

  // Câu đã duyệt cho trò chơi; máy giáo viên trộn thứ tự. Câu trả lời ngắn chỉ lấy đáp án đầu tiên làm từ của ô chữ
  async questions(
    currentUser: CurrentUser,
    classId: string,
    filter: { subjectId?: string; topicId?: string; cognitiveLevel?: string; types?: string; limit?: string },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.classFor(currentUser, database, classId);
    if (!isUuid(filter.subjectId)) {
      throw validationError([{ field: 'subject_id', message: 'Chọn môn' }]);
    }
    const types = (filter.types ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is QuestionTypeCode => (QUESTION_TYPES as string[]).includes(value));
    const limit = Math.min(Math.max(Number(filter.limit) || 30, 1), MAX_QUESTION_LIMIT);
    let query = database
      .selectFrom('questions')
      .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
      .select([
        'questions.id',
        'questions.question_type',
        'questions.cognitive_level',
        'questions.content',
        'questions.options',
        'questions.answer',
        'question_topics.name as topic_name',
      ])
      .where('questions.status', '=', 'approved')
      .where('questions.grade_level_code', '=', classRecord.grade_level)
      .where('questions.subject_id', '=', filter.subjectId)
      .where('questions.question_type', 'in', types.length ? types : QUESTION_TYPES);
    if (isUuid(filter.topicId)) {
      query = query.where('questions.topic_id', '=', filter.topicId);
    }
    if (filter.cognitiveLevel) {
      query = query.where('questions.cognitive_level', '=', filter.cognitiveLevel as never);
    }
    // Ưu tiên câu ít dùng để câu trong ngân hàng được dùng đều
    const rows = await query
      .orderBy('questions.use_count')
      .orderBy(sql`random()`)
      .limit(limit)
      .execute();
    return { items: rows };
  }

  async record(currentUser: CurrentUser, input: GameSessionInput) {
    const { database } = await this.currentSchoolYear.require();
    await this.classFor(currentUser, database, input.class_id);
    const existing = await database
      .selectFrom('classroom_game_sessions')
      .select(['id', 'class_id'])
      .where('client_id', '=', input.client_id)
      .executeTakeFirst();
    if (existing) {
      if (existing.class_id !== input.class_id) {
        throw validationError([{ field: 'client_id', message: 'Mã lượt chơi đã dùng cho lớp khác' }]);
      }
      return { id: existing.id, duplicate: true };
    }
    const questions = await database
      .selectFrom('questions')
      .select(['id', 'question_type', 'answer', 'status'])
      .where('id', 'in', input.question_ids)
      .execute();
    const byId = new Map(questions.map((question) => [question.id, question]));
    const missing = input.question_ids.filter((id) => byId.get(id)?.status !== 'approved');
    if (missing.length) {
      throw validationError([{ field: 'question_ids', message: 'Có câu không còn trong ngân hàng câu hỏi đã duyệt' }]);
    }
    const childIds = [
      ...new Set(input.answers.map((answer) => answer.child_id).filter((id): id is string => Boolean(id))),
    ];
    if (childIds.length) {
      const enrolled = await database
        .selectFrom('class_enrollments')
        .select('child_id')
        .distinct()
        .where('class_id', '=', input.class_id)
        .where('child_id', 'in', childIds)
        .execute();
      if (enrolled.length !== childIds.length) {
        throw validationError([{ field: 'answers', message: 'Có học sinh không thuộc lớp' }]);
      }
    }
    const now = this.clock.now();
    const clamp = (value: string | null) => {
      const parsed = value ? new Date(value) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return now;
      const diff = now.getTime() - parsed.getTime();
      return diff > MAX_CLIENT_AGE_MS || diff < -MAX_CLIENT_AHEAD_MS ? now : parsed;
    };
    const finishedAt = clamp(input.finished_at);
    const startedAt = clamp(input.started_at ?? input.finished_at);
    const judged = input.answers.map((answer) => {
      const question = byId.get(answer.question_id);
      return question ? judgeAnswer(question, answer) : null;
    });
    const usedOn = vietnamDate(finishedAt);
    const sessionId = await database.transaction().execute(async (transaction) => {
      const session = await transaction
        .insertInto('classroom_game_sessions')
        .values({
          client_id: input.client_id,
          class_id: input.class_id,
          kind: input.kind,
          title: input.title,
          config: JSON.stringify(input.config),
          group_scores: JSON.stringify(input.group_scores),
          question_count: input.question_ids.length,
          started_at: startedAt.getTime() <= finishedAt.getTime() ? startedAt : finishedAt,
          finished_at: finishedAt,
          recorded_by: currentUser.id,
          recorded_by_name: actorNameOf(currentUser),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (input.answers.length) {
        await transaction
          .insertInto('classroom_game_answers')
          .values(
            input.answers.map((answer, index) => ({
              session_id: session.id,
              question_id: answer.question_id,
              child_id: answer.child_id,
              group_name: answer.group_name,
              answer: answer.answer,
              correct: judged[index] ?? false,
            })),
          )
          .execute();
      }
      await transaction
        .insertInto('question_usages')
        .values(
          input.question_ids.map((questionId) => ({
            question_id: questionId,
            exam_id: null,
            source: 'game' as const,
            game_session_id: session.id,
            used_on: usedOn,
            attempts: input.answers.filter((answer) => answer.question_id === questionId).length || null,
            correct_rate: correctRate(
              judged.filter((_value, index) => input.answers[index]?.question_id === questionId),
            ),
          })),
        )
        .execute();
      await transaction
        .updateTable('questions')
        .set((expression) => ({ last_used_at: usedOn, use_count: expression('use_count', '+', 1) }))
        .where('id', 'in', input.question_ids)
        .execute();
      return session.id;
    });
    return { id: sessionId, duplicate: false };
  }

  async sessions(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.classFor(currentUser, database, classId);
    const rows = await database
      .selectFrom('classroom_game_sessions')
      .select([
        'id',
        'kind',
        'title',
        'question_count',
        'group_scores',
        'started_at',
        'finished_at',
        'recorded_by_name',
      ])
      .where('class_id', '=', classId)
      .orderBy('finished_at', 'desc')
      .limit(30)
      .execute();
    return { items: rows };
  }

  // Kết quả từng câu của một lượt chơi: tỷ lệ đúng của lớp và lựa chọn của từng học sinh (thẻ đáp án)
  async session(currentUser: CurrentUser, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const session = await database
      .selectFrom('classroom_game_sessions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!session) {
      throw notFoundError('Không tìm thấy lượt chơi', 'session');
    }
    await this.classFor(currentUser, database, session.class_id);
    const usages = await database
      .selectFrom('question_usages')
      .innerJoin('questions', 'questions.id', 'question_usages.question_id')
      .select(['questions.id', 'questions.content', 'question_usages.attempts', 'question_usages.correct_rate'])
      .where('question_usages.game_session_id', '=', id)
      .execute();
    const answers = await database
      .selectFrom('classroom_game_answers')
      .leftJoin('children', 'children.id', 'classroom_game_answers.child_id')
      .select([
        'classroom_game_answers.question_id',
        'classroom_game_answers.child_id',
        'children.full_name',
        'classroom_game_answers.group_name',
        'classroom_game_answers.answer',
        'classroom_game_answers.correct',
      ])
      .where('classroom_game_answers.session_id', '=', id)
      .execute();
    return {
      ...session,
      questions: usages.map((usage) => ({
        ...usage,
        correct_rate: usage.correct_rate === null ? null : Number(usage.correct_rate),
      })),
      answers,
    };
  }
}

@Controller('classroom-games')
export class ClassroomGamesController {
  constructor(private readonly games: ClassroomGamesService) {}

  @Get('classes/:classId/catalog')
  catalog(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.games.catalog(user, classId);
  }

  @Get('classes/:classId/questions')
  questions(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('subject_id') subjectId: string | undefined,
    @Query('topic_id') topicId: string | undefined,
    @Query('cognitive_level') cognitiveLevel: string | undefined,
    @Query('types') types: string | undefined,
    @Query('limit') limit: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.games.questions(user, classId, {
      ...(subjectId ? { subjectId } : {}),
      ...(topicId ? { topicId } : {}),
      ...(cognitiveLevel ? { cognitiveLevel } : {}),
      ...(types ? { types } : {}),
      ...(limit ? { limit } : {}),
    });
  }

  @Get('classes/:classId/sessions')
  sessions(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.games.sessions(user, classId);
  }

  @Get('sessions/:id')
  session(@Param('id', uuidParameter('Mã lượt chơi không hợp lệ')) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.games.session(user, id);
  }

  @Post('sessions')
  @HttpCode(200)
  record(@Body() body: RequestBody | undefined, @AuthenticatedUser() user: CurrentUser) {
    return this.games.record(user, readGameSession(body));
  }
}
