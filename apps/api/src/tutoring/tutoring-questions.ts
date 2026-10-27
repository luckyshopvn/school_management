import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Selectable } from 'kysely';
import { AiAssistantService } from '../ai-assistant/ai-assistant.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { DiscussionsService } from '../learning/discussions/discussions.js';
import { assertTutoringModule } from './tutoring.js';

// Hỏi đáp bài tập của chương trình gia sư (DT-27 phần 27e, YCTD-255; tài liệu 32 mục 19.5, YCTD-270). Câu hỏi, trả lời, xác nhận câu
// trả lời, lọc thông tin liên lạc, báo cáo là của bộ máy hỏi đáp 28e: học sinh hỏi ở khoá học ghi sẵn của chương trình (27d1) như ở mọi
// lớp học trực tuyến. Phần này thêm phần riêng của gia sư:
// - hàng chờ câu hỏi theo chương trình của giáo viên dạy (Ban Giám hiệu xem mọi chương trình), thời hạn trả lời theo chương trình;
// - nút "Gợi ý bằng AI": bản nháp chỉ giáo viên thấy, qua `AiAssistantService.draftAnswer` của 23d (chỉ chữ của câu hỏi đã quét dữ
//   liệu cá nhân, không gửi ảnh, không gửi tên học sinh; nhật ký, hạn mức theo 23d); trường tắt AI hoặc phụ huynh tắt AI cho con thì
//   không gợi ý được; giáo viên sửa rồi mới gửi, câu trả lời gửi từ bản nháp mang dấu "có AI hỗ trợ";
// - học sinh đánh dấu đã hiểu hoặc chưa hiểu (chưa hiểu thì câu trở lại hàng chờ); cha mẹ xem câu hỏi của con, tắt bật AI cho con.
type Database = Kysely<SchoolYearDatabase>;
type ThreadRow = Selectable<SchoolYearDatabase['discussion_threads']>;

const MANAGE = PERMISSION_CODES.tutoringManage;
const MAX_NOTE = 500;

interface ProgramCourse {
  program_id: string;
  program_name: string;
  school_level: string;
  subject_id: string | null;
  answer_hours: number;
  space_id: string;
}

@Injectable()
export class TutoringQuestionsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly discussions: DiscussionsService,
    private readonly ai: AiAssistantService,
    private readonly clock: Clock,
  ) {}

  private async database(): Promise<Database> {
    assertTutoringModule();
    return (await this.currentSchoolYear.require()).database;
  }

  // Chương trình có khoá học ghi sẵn; giáo viên chỉ thấy chương trình mình dạy, Ban Giám hiệu thấy mọi chương trình
  private async programCourses(database: Database, currentUser: CurrentUser): Promise<ProgramCourse[]> {
    let query = database
      .selectFrom('tutoring_program_courses')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_program_courses.program_id')
      .select([
        'tutoring_programs.id as program_id',
        'tutoring_programs.name as program_name',
        'tutoring_programs.school_level',
        'tutoring_programs.subject_id',
        'tutoring_programs.answer_hours',
        'tutoring_program_courses.course_space_id as space_id',
      ]);
    if (!currentUser.hasPermission(MANAGE)) {
      query = query.where((builder) =>
        builder.exists(
          builder
            .selectFrom('tutoring_program_teachers')
            .select('tutoring_program_teachers.program_id')
            .whereRef('tutoring_program_teachers.program_id', '=', 'tutoring_programs.id')
            .where('tutoring_program_teachers.teacher_user_id', '=', currentUser.id),
        ),
      );
    }
    return query.orderBy('tutoring_programs.name').execute();
  }

  // Câu hỏi của khoá gia sư mà người dùng được trả lời: giáo viên dạy chương trình hoặc Ban Giám hiệu
  private async staffQuestion(database: Database, currentUser: CurrentUser, threadId: string) {
    if (!isUuid(threadId)) {
      throw notFoundError('Không tìm thấy câu hỏi', 'discussion_thread');
    }
    const thread = await database
      .selectFrom('discussion_threads')
      .selectAll()
      .where('id', '=', threadId)
      .where('kind', '=', 'question')
      .executeTakeFirst();
    const course = thread
      ? (await this.programCourses(database, currentUser)).find((row) => row.space_id === thread.space_id)
      : undefined;
    if (!thread || !course) {
      throw notFoundError('Không tìm thấy câu hỏi trong chương trình gia sư bạn dạy', 'discussion_thread');
    }
    return { thread, course };
  }

  // Câu trả lời của giáo viên, dấu "có AI hỗ trợ", dấu đã hiểu của các câu hỏi
  private async answersOf(database: Database, threadIds: string[]) {
    if (threadIds.length === 0) {
      return {
        teacherPosts: new Map<string, number>(),
        aiPosts: new Set<string>(),
        marks: new Map<string, { understood: boolean; at: number }>(),
      };
    }
    const [posts, aiAnswers, marks] = await Promise.all([
      database
        .selectFrom('discussion_posts')
        .select(['id', 'thread_id', 'created_at'])
        .where('thread_id', 'in', threadIds)
        .where('author_kind', '=', 'teacher')
        .where('hidden_at', 'is', null)
        .execute(),
      database.selectFrom('tutoring_ai_answers').select('post_id').where('thread_id', 'in', threadIds).execute(),
      database
        .selectFrom('tutoring_question_marks')
        .select(['thread_id', 'understood', 'marked_at'])
        .where('thread_id', 'in', threadIds)
        .execute(),
    ]);
    const teacherPosts = new Map<string, number>();
    for (const post of posts) {
      teacherPosts.set(post.thread_id, Math.max(teacherPosts.get(post.thread_id) ?? 0, post.created_at.getTime()));
    }
    return {
      teacherPosts,
      aiPosts: new Set(aiAnswers.map((row) => row.post_id)),
      marks: new Map(
        marks.map((mark) => [mark.thread_id, { understood: mark.understood, at: mark.marked_at.getTime() }]),
      ),
    };
  }

  private async consentOf(database: Database, childId: string | null): Promise<boolean> {
    if (!childId) {
      return true;
    }
    const row = await database
      .selectFrom('tutoring_ai_consents')
      .select('allowed')
      .where('child_id', '=', childId)
      .executeTakeFirst();
    return row?.allowed ?? true;
  }

  // Hàng chờ của giáo viên: câu chưa có giáo viên trả lời, hoặc học sinh đánh dấu chưa hiểu sau câu trả lời mới nhất; quá thời hạn
  // của chương trình là quá hạn
  async queue(currentUser: CurrentUser) {
    const database = await this.database();
    const courses = await this.programCourses(database, currentUser);
    if (courses.length === 0) {
      return { programs: [], questions: [] };
    }
    const threads = await database
      .selectFrom('discussion_threads')
      .selectAll()
      .where(
        'space_id',
        'in',
        courses.map((course) => course.space_id),
      )
      .where('kind', '=', 'question')
      .where('hidden_at', 'is', null)
      .orderBy('created_at')
      .execute();
    const answers = await this.answersOf(
      database,
      threads.map((thread) => thread.id),
    );
    const settings = await this.ai.settings();
    const now = this.clock.now().getTime();
    const questions = [];
    for (const thread of threads) {
      const course = courses.find((row) => row.space_id === thread.space_id);
      if (!course) continue;
      const lastAnswer = answers.teacherPosts.get(thread.id);
      const answered = lastAnswer !== undefined;
      const mark = answers.marks.get(thread.id);
      // Chưa hiểu sau câu trả lời mới nhất thì câu trở lại hàng chờ; giáo viên trả lời thêm thì ra khỏi hàng chờ
      const stillUnclear = mark !== undefined && !mark.understood && mark.at >= (lastAnswer ?? 0);
      if (answered && !stillUnclear) continue;
      const dueAt = thread.created_at.getTime() + course.answer_hours * 3_600_000;
      questions.push({
        id: thread.id,
        program_id: course.program_id,
        program_name: course.program_name,
        title: thread.title,
        body: thread.body,
        author_name: thread.author_name,
        private: thread.private,
        created_at: thread.created_at,
        due_at: new Date(dueAt),
        overdue: !answered && dueAt < now,
        reason: answered ? 'not_understood' : 'unanswered',
        ai_available: settings.enabled && (await this.consentOf(database, thread.author_child_id)),
      });
    }
    return {
      programs: courses.map((course) => ({
        program_id: course.program_id,
        program_name: course.program_name,
        answer_hours: course.answer_hours,
        course_id: course.space_id,
      })),
      questions,
    };
  }

  // Thời hạn trả lời của chương trình (giờ), do giáo viên dạy hoặc Ban Giám hiệu đặt
  async setAnswerHours(currentUser: CurrentUser, programId: string, body: RequestBody) {
    const database = await this.database();
    const hours = body?.answer_hours;
    if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 336) {
      throw validationError([{ field: 'answer_hours', message: 'Thời hạn trả lời từ 1 đến 336 giờ' }]);
    }
    const course = (await this.programCourses(database, currentUser)).find((row) => row.program_id === programId);
    if (!course) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên dạy chương trình có khoá học hoặc Ban Giám hiệu đặt thời hạn',
      );
    }
    await database
      .updateTable('tutoring_programs')
      .set({ answer_hours: hours, updated_at: this.clock.now() })
      .where('id', '=', programId)
      .execute();
    return { program_id: programId, answer_hours: hours };
  }

  // Câu hỏi và các câu trả lời, có dấu "có AI hỗ trợ"; giáo viên thấy cả câu đã ẩn
  private async present(database: Database, thread: ThreadRow, includeHidden: boolean) {
    let query = database
      .selectFrom('discussion_posts')
      .select(['id', 'body', 'author_name', 'author_kind', 'author_child_id', 'hidden_at', 'created_at'])
      .where('thread_id', '=', thread.id)
      .orderBy('created_at');
    if (!includeHidden) query = query.where('hidden_at', 'is', null);
    const [posts, answers] = await Promise.all([query.execute(), this.answersOf(database, [thread.id])]);
    return {
      id: thread.id,
      space_id: thread.space_id,
      title: thread.title,
      body: thread.body,
      author_name: thread.author_name,
      private: thread.private,
      status: thread.status,
      accepted_post_id: thread.accepted_post_id,
      created_at: thread.created_at,
      understood: answers.marks.get(thread.id)?.understood ?? null,
      posts: posts.map((post) => ({
        id: post.id,
        body: post.body,
        author_name: post.author_name,
        author_kind: post.author_kind,
        hidden: post.hidden_at !== null,
        ai_assisted: answers.aiPosts.has(post.id),
        created_at: post.created_at,
      })),
    };
  }

  async question(currentUser: CurrentUser, threadId: string) {
    const database = await this.database();
    const { thread, course } = await this.staffQuestion(database, currentUser, threadId);
    const settings = await this.ai.settings();
    return {
      program_id: course.program_id,
      program_name: course.program_name,
      ai_available: settings.enabled && (await this.consentOf(database, thread.author_child_id)),
      ...(await this.present(database, thread, true)),
    };
  }

  // Gợi ý bằng AI: bản nháp chỉ trả cho giáo viên, không lưu vào câu hỏi
  async draft(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const database = await this.database();
    const { thread, course } = await this.staffQuestion(database, currentUser, threadId);
    if (!(await this.consentOf(database, thread.author_child_id))) {
      throw new ApplicationError('ERR_CONFLICT', 'Phụ huynh đã tắt việc dùng trợ lý AI cho câu hỏi của em');
    }
    const subject = course.subject_id
      ? await database.selectFrom('subjects').select('name').where('id', '=', course.subject_id).executeTakeFirst()
      : undefined;
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
    return this.ai.draftAnswer(currentUser, {
      school_level: course.school_level,
      grade_level_code: null,
      subject_name: subject?.name ?? course.program_name,
      question: [thread.title, thread.body],
      note: note === '' ? null : note,
    });
  }

  // Gửi câu trả lời qua bộ máy hỏi đáp 28e (lọc, nhật ký như mọi câu trả lời); gửi từ bản nháp AI của chính giáo viên thì mang dấu
  // "có AI hỗ trợ"
  async answer(currentUser: CurrentUser, threadId: string, body: RequestBody) {
    const database = await this.database();
    const { thread } = await this.staffQuestion(database, currentUser, threadId);
    const requestId = body?.ai_request_id;
    if (requestId !== undefined && requestId !== null) {
      const request = isUuid(requestId)
        ? await this.databases.system
            .selectFrom('ai_requests')
            .select('id')
            .where('id', '=', requestId)
            .where('user_id', '=', currentUser.id)
            .where('kind', '=', 'answer')
            .where('status', '=', 'success')
            .executeTakeFirst()
        : undefined;
      if (!request) {
        throw validationError([{ field: 'ai_request_id', message: 'Không tìm thấy bản nháp AI của bạn' }]);
      }
    }
    const post = await this.discussions.reply(currentUser, thread.id, { body: body?.body });
    if (typeof requestId === 'string') {
      await database
        .insertInto('tutoring_ai_answers')
        .values({ post_id: post.id, thread_id: thread.id, ai_request_id: requestId, teacher_user_id: currentUser.id })
        .execute();
    }
    return { ...post, ai_assisted: typeof requestId === 'string' };
  }

  // ---------- Học sinh, cha mẹ

  private async childQuestionsOf(database: Database, childId: string) {
    const threads = await database
      .selectFrom('discussion_threads')
      .innerJoin('tutoring_program_courses', 'tutoring_program_courses.course_space_id', 'discussion_threads.space_id')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_program_courses.program_id')
      .selectAll('discussion_threads')
      .select(['tutoring_programs.id as program_id', 'tutoring_programs.name as program_name'])
      .where('discussion_threads.kind', '=', 'question')
      .where('discussion_threads.author_child_id', '=', childId)
      .where('discussion_threads.hidden_at', 'is', null)
      .orderBy('discussion_threads.created_at', 'desc')
      .execute();
    const result = [];
    for (const thread of threads) {
      result.push({
        program_id: thread.program_id,
        program_name: thread.program_name,
        ...(await this.present(database, thread, false)),
      });
    }
    return result;
  }

  async studentQuestions(childId: string) {
    const database = await this.database();
    return {
      questions: await this.childQuestionsOf(database, childId),
      ai_allowed: await this.consentOf(database, childId),
    };
  }

  // Học sinh đánh dấu đã hiểu, hoặc chưa hiểu (câu trở lại hàng chờ của giáo viên); chỉ câu của em, đã có giáo viên trả lời
  async mark(childId: string, threadId: string, body: RequestBody) {
    const database = await this.database();
    if (typeof body?.understood !== 'boolean') {
      throw validationError([{ field: 'understood', message: 'Chọn đã hiểu (true) hoặc chưa hiểu (false)' }]);
    }
    const thread = isUuid(threadId)
      ? await database
          .selectFrom('discussion_threads')
          .innerJoin(
            'tutoring_program_courses',
            'tutoring_program_courses.course_space_id',
            'discussion_threads.space_id',
          )
          .select('discussion_threads.id')
          .where('discussion_threads.id', '=', threadId)
          .where('discussion_threads.kind', '=', 'question')
          .where('discussion_threads.author_child_id', '=', childId)
          .executeTakeFirst()
      : undefined;
    if (!thread) {
      throw notFoundError('Không tìm thấy câu hỏi của em', 'discussion_thread');
    }
    const answers = await this.answersOf(database, [thread.id]);
    if (!answers.teacherPosts.has(thread.id)) {
      throw new ApplicationError('ERR_CONFLICT', 'Câu hỏi chưa có giáo viên trả lời');
    }
    const now = this.clock.now();
    const understood = body.understood;
    await database
      .insertInto('tutoring_question_marks')
      .values({ thread_id: thread.id, child_id: childId, understood, marked_at: now })
      .onConflict((conflict) => conflict.column('thread_id').doUpdateSet({ understood, marked_at: now }))
      .execute();
    return { thread_id: thread.id, understood };
  }

  private async assertGuardian(database: Database, currentUser: CurrentUser, childId: string) {
    const row = isUuid(childId)
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('guardians.id')
          .where('child_guardians.child_id', '=', childId)
          .where('guardians.user_id', '=', currentUser.id)
          .executeTakeFirst()
      : undefined;
    if (!row) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
  }

  async childQuestions(currentUser: CurrentUser, childId: string) {
    const database = await this.database();
    await this.assertGuardian(database, currentUser, childId);
    return {
      questions: await this.childQuestionsOf(database, childId),
      ai_allowed: await this.consentOf(database, childId),
    };
  }

  // Cha mẹ tắt, bật việc dùng trợ lý AI cho câu hỏi của con (chưa chọn là theo mặc định của trường: cho phép)
  async setConsent(currentUser: CurrentUser, childId: string, body: RequestBody) {
    const database = await this.database();
    await this.assertGuardian(database, currentUser, childId);
    if (typeof body?.allowed !== 'boolean') {
      throw validationError([{ field: 'allowed', message: 'Chọn cho phép (true) hoặc không (false)' }]);
    }
    const values = {
      allowed: body.allowed,
      decided_by_user_id: currentUser.id,
      decided_by_name: currentUser.description.full_name,
      decided_at: this.clock.now(),
    };
    await database
      .insertInto('tutoring_ai_consents')
      .values({ child_id: childId, ...values })
      .onConflict((conflict) => conflict.column('child_id').doUpdateSet(values))
      .execute();
    return { child_id: childId, ai_allowed: body.allowed };
  }
}
