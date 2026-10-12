import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type {
  PollAnswerType,
  PollAudience,
  PollStatus,
  PollType,
  SchoolYearDatabase,
  SurveyTemplateQuestion,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { InteractionAccess, readChoice, readLimitedText } from './interaction-access.js';

// Bình chọn, biểu quyết, khảo sát và danh mục khảo sát (P15-03, P15-04, P15-05; BR-67, BR-68, BR-72; YCTD-79).
// Quản lý đơn vị có quyền P15.interaction.manage lập ở trạng thái nháp, mở, đóng sớm và công bố kết quả. Đối tượng là phụ
// huynh, nhân sự hoặc cả hai của một đơn vị hoặc một lớp. Bình chọn và biểu quyết có một câu hỏi chọn một; khảo sát có
// nhiều câu hỏi, lập tay hoặc chép từ danh mục khảo sát. Mỗi tài khoản một phiếu, phiếu không sửa; ngoài thời gian không
// nhận phiếu
const POLL_TYPES: PollType[] = ['poll', 'vote', 'survey'];
const AUDIENCES: PollAudience[] = ['guardians', 'staff', 'everyone'];
const ANSWER_TYPES: PollAnswerType[] = ['single_choice', 'multiple_choice', 'text', 'rating'];
const POLL_LABELS: Record<PollType, string> = { poll: 'bình chọn', vote: 'biểu quyết', survey: 'khảo sát' };
const MAXIMUM_QUESTIONS = 50;
const MAXIMUM_OPTIONS = 20;

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface PollRow {
  id: string;
  org_unit_id: string;
  poll_type: PollType;
  title: string;
  description: string | null;
  class_id: string | null;
  audience: PollAudience;
  start_at: Date;
  end_at: Date;
  is_anonymous: boolean;
  survey_template_id: string | null;
  status: PollStatus;
  published_at: Date | null;
  closed_at: Date | null;
  results_published_at: Date | null;
  created_by: string;
  created_at: Date;
}

// Những gì quyết định một tài khoản có là đối tượng của bình chọn hay không, tính một lần cho mỗi yêu cầu
interface Participation {
  guardianChildren: Array<{ org_unit_id: string; class_id: string | null }>;
  staffScope: OrganizationScope | null;
  teacherClassIds: string[];
  managerScope: OrganizationScope;
}

export interface AnswerInput {
  question_id: string;
  option_ids: string[];
  text: string | null;
  number: number | null;
}

@Injectable()
export class PollsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InteractionAccess,
    private readonly clock: Clock,
  ) {}

  private async participation(database: Executor, currentUser: CurrentUser): Promise<Participation> {
    const guardianChildren = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('children', 'children.id', 'child_guardians.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select(['children.org_unit_id', 'class_enrollments.class_id'])
      .where('guardians.user_id', '=', currentUser.id)
      .where('children.status', '=', 'active')
      .execute();
    const teacherClassIds = (
      await database
        .selectFrom('class_staff_assignments')
        .select('class_id')
        .where('staff_user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .execute()
    ).map((row) => row.class_id);
    return {
      guardianChildren,
      staffScope: await this.access.staffScope(currentUser),
      teacherClassIds,
      managerScope: await this.access.managerScope(currentUser, PERMISSION_CODES.interactionManage),
    };
  }

  private static manages(poll: { org_unit_id: string }, participation: Participation): boolean {
    const scope = participation.managerScope;
    return scope.wholeSchool || scope.orgUnitIds.includes(poll.org_unit_id);
  }

  // Tài khoản là đối tượng của bình chọn: phụ huynh có con đang học ở đơn vị hoặc lớp; nhân sự của đơn vị hoặc giáo viên
  // của lớp
  private static eligible(poll: PollRow, participation: Participation): boolean {
    const guardianOk =
      poll.audience !== 'staff' &&
      participation.guardianChildren.some(
        (child) => child.org_unit_id === poll.org_unit_id && (!poll.class_id || child.class_id === poll.class_id),
      );
    const scope = participation.staffScope;
    const staffOk =
      poll.audience !== 'guardians' &&
      (poll.class_id
        ? participation.teacherClassIds.includes(poll.class_id)
        : scope !== null && (scope.wholeSchool || scope.orgUnitIds.includes(poll.org_unit_id)));
    return guardianOk || staffOk;
  }

  private async findPoll(database: Executor, pollId: string): Promise<PollRow> {
    const poll = await database.selectFrom('polls').selectAll().where('id', '=', pollId).executeTakeFirst();
    if (!poll) {
      throw notFoundError('Không tìm thấy bình chọn', 'poll');
    }
    return poll;
  }

  // Dùng cho bình luận và lượt thích: người quản lý hoặc đối tượng của bình chọn đã mở mới xem được
  async assertCanView(database: Executor, currentUser: CurrentUser, pollId: string) {
    const poll = await this.findPoll(database, pollId);
    const participation = await this.participation(database, currentUser);
    const manager = PollsService.manages(poll, participation);
    if (!manager && (poll.status === 'draft' || !PollsService.eligible(poll, participation))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bình chọn này không dành cho bạn');
    }
    return { poll, manager };
  }

  async create(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      poll_type: PollType;
      title: string;
      description: string | null;
      class_id: string | null;
      audience: PollAudience;
      start_at: Date;
      end_at: Date;
      is_anonymous: boolean;
      survey_template_id: string | null;
      options: string[];
      questions: SurveyTemplateQuestion[];
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await this.access.canManageUnit(currentUser, PERMISSION_CODES.interactionManage, input.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập bình chọn cho đơn vị này');
    }
    if (input.class_id) {
      const classRow = await database
        .selectFrom('classes')
        .select('org_unit_id')
        .where('id', '=', input.class_id)
        .executeTakeFirst();
      if (!classRow || classRow.org_unit_id !== input.org_unit_id) {
        throw validationError([{ field: 'class_id', message: 'Lớp không thuộc đơn vị đã chọn' }]);
      }
    }
    let questions: SurveyTemplateQuestion[];
    if (input.poll_type === 'survey') {
      if (input.survey_template_id) {
        const template = await database
          .selectFrom('survey_templates')
          .select(['questions', 'status'])
          .where('id', '=', input.survey_template_id)
          .executeTakeFirst();
        if (!template || template.status !== 'active') {
          throw validationError([{ field: 'survey_template_id', message: 'Mẫu khảo sát không có hoặc đã ngừng dùng' }]);
        }
        questions = template.questions;
      } else {
        questions = input.questions;
      }
      if (questions.length === 0) {
        throw validationError([{ field: 'questions', message: 'Khảo sát cần ít nhất một câu hỏi' }]);
      }
    } else {
      if (input.options.length < 2) {
        throw validationError([{ field: 'options', message: 'Cần ít nhất hai phương án' }]);
      }
      questions = [
        { question_text: input.title, answer_type: 'single_choice', is_required: true, options: input.options },
      ];
    }
    return database.transaction().execute(async (transaction) => {
      const poll = await transaction
        .insertInto('polls')
        .values({
          org_unit_id: input.org_unit_id,
          poll_type: input.poll_type,
          title: input.title,
          description: input.description,
          class_id: input.class_id,
          audience: input.audience,
          start_at: input.start_at,
          end_at: input.end_at,
          is_anonymous: input.is_anonymous,
          survey_template_id: input.poll_type === 'survey' ? input.survey_template_id : null,
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      for (const [index, question] of questions.entries()) {
        const created = await transaction
          .insertInto('poll_questions')
          .values({
            poll_id: poll.id,
            question_text: question.question_text,
            answer_type: question.answer_type,
            order_no: index + 1,
            is_required: question.is_required,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (question.options.length) {
          await transaction
            .insertInto('poll_options')
            .values(
              question.options.map((label, optionIndex) => ({
                poll_id: poll.id,
                question_id: created.id,
                label,
                order_no: optionIndex + 1,
              })),
            )
            .execute();
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: poll.org_unit_id,
        entityName: 'polls',
        entityId: poll.id,
        action: 'create',
        before: null,
        after: poll,
      });
      return poll;
    });
  }

  private async assertManager(database: Executor, currentUser: CurrentUser, pollId: string) {
    const poll = await this.findPoll(database, pollId);
    if (!(await this.access.canManageUnit(currentUser, PERMISSION_CODES.interactionManage, poll.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý bình chọn này');
    }
    return poll;
  }

  // Người nhận thông báo theo đối tượng: phụ huynh của trẻ trong lớp, hoặc mọi phụ huynh, giáo viên của đơn vị
  private async audienceRecipients(database: Executor, poll: PollRow): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = [];
    if (poll.audience !== 'staff') {
      if (poll.class_id) {
        const rows = await database
          .selectFrom('class_enrollments')
          .innerJoin('child_guardians', 'child_guardians.child_id', 'class_enrollments.child_id')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('guardians.user_id')
          .where('class_enrollments.class_id', '=', poll.class_id)
          .where('class_enrollments.is_current', '=', true)
          .where('guardians.user_id', 'is not', null)
          .execute();
        for (const row of rows) {
          if (row.user_id) {
            recipients.push({ userId: row.user_id, channel: 'in_app' });
          }
        }
      } else {
        recipients.push({ roleCode: 'VT-14', orgUnitId: poll.org_unit_id, channel: 'in_app' });
      }
    }
    if (poll.audience !== 'guardians') {
      if (poll.class_id) {
        const rows = await database
          .selectFrom('class_staff_assignments')
          .select('staff_user_id')
          .where('class_id', '=', poll.class_id)
          .where('status', '=', 'active')
          .execute();
        recipients.push(...rows.map((row) => ({ userId: row.staff_user_id, channel: 'in_app' as const })));
      } else {
        for (const roleCode of ['VT-07', 'VT-08']) {
          recipients.push({ roleCode, orgUnitId: poll.org_unit_id, channel: 'in_app' });
        }
      }
    }
    return recipients;
  }

  async publish(currentUser: CurrentUser, pollId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const poll = await this.assertManager(database, currentUser, pollId);
    if (poll.status !== 'draft') {
      throw ruleViolationError('BR-68', 'Chỉ mở được bình chọn đang ở trạng thái nháp');
    }
    if (poll.end_at.getTime() <= this.clock.now().getTime()) {
      throw ruleViolationError('BR-68', 'Thời gian kết thúc đã qua, sửa thời gian trước khi mở');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('polls')
        .set({ status: 'open', published_at: this.clock.now() })
        .where('id', '=', pollId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: poll.org_unit_id,
        templateCode: 'poll_opened',
        title: `Mời tham gia ${POLL_LABELS[poll.poll_type]}`,
        body: poll.title,
        targetType: 'polls',
        targetId: poll.id,
        recipients: await this.audienceRecipients(transaction, poll),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: poll.org_unit_id,
        entityName: 'polls',
        entityId: poll.id,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'open' },
      });
      return updated;
    });
  }

  async close(currentUser: CurrentUser, pollId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const poll = await this.assertManager(database, currentUser, pollId);
    if (poll.status !== 'open') {
      throw ruleViolationError('BR-68', 'Chỉ đóng được bình chọn đang mở');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('polls')
        .set({ status: 'closed', closed_at: this.clock.now() })
        .where('id', '=', pollId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: poll.org_unit_id,
        entityName: 'polls',
        entityId: poll.id,
        action: 'update',
        before: { status: 'open' },
        after: { status: 'closed' },
      });
      return updated;
    });
  }

  // Công bố kết quả cho đối tượng; người đã gửi phiếu nhận thông báo
  async publishResults(currentUser: CurrentUser, pollId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const poll = await this.assertManager(database, currentUser, pollId);
    if (poll.status === 'draft') {
      throw ruleViolationError('BR-68', 'Bình chọn chưa mở nên chưa có kết quả');
    }
    if (poll.results_published_at) {
      return poll;
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('polls')
        .set({ results_published_at: this.clock.now() })
        .where('id', '=', pollId)
        .returningAll()
        .executeTakeFirstOrThrow();
      const respondents = await transaction
        .selectFrom('poll_responses')
        .select('user_id')
        .where('poll_id', '=', pollId)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: poll.org_unit_id,
        templateCode: 'poll_results',
        title: `Kết quả ${POLL_LABELS[poll.poll_type]}`,
        body: poll.title,
        targetType: 'polls',
        targetId: poll.id,
        recipients: respondents.map((row) => ({ userId: row.user_id, channel: 'in_app' as const })),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: poll.org_unit_id,
        entityName: 'polls',
        entityId: poll.id,
        action: 'update',
        before: { results_published_at: null },
        after: { results_published_at: updated.results_published_at },
      });
      return updated;
    });
  }

  async list(
    currentUser: CurrentUser,
    filter: { status: PollStatus | null; orgUnitId: string | null; pollType: PollType | null; openOnly: boolean },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const participation = await this.participation(database, currentUser);
    let query = database.selectFrom('polls').selectAll().orderBy('start_at', 'desc');
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.pollType) {
      query = query.where('poll_type', '=', filter.pollType);
    }
    const now = this.clock.now().getTime();
    const polls = (await query.execute()).filter((poll) =>
      PollsService.manages(poll, participation)
        ? !filter.openOnly || PollsService.eligible(poll, participation)
        : poll.status !== 'draft' && PollsService.eligible(poll, participation),
    );
    if (polls.length === 0) {
      return [];
    }
    const ids = polls.map((poll) => poll.id);
    const counts = await database
      .selectFrom('poll_responses')
      .select(['poll_id', database.fn.countAll<string>().as('count')])
      .where('poll_id', 'in', ids)
      .groupBy('poll_id')
      .execute();
    const mine = new Set(
      (
        await database
          .selectFrom('poll_responses')
          .select('poll_id')
          .where('poll_id', 'in', ids)
          .where('user_id', '=', currentUser.id)
          .execute()
      ).map((row) => row.poll_id),
    );
    return polls
      .map((poll) => {
        const manager = PollsService.manages(poll, participation);
        const isOpenNow = poll.status === 'open' && poll.start_at.getTime() <= now && poll.end_at.getTime() > now;
        return {
          ...poll,
          can_manage: manager,
          can_respond: isOpenNow && !mine.has(poll.id) && PollsService.eligible(poll, participation),
          is_open_now: isOpenNow,
          has_responded: mine.has(poll.id),
          response_count: manager ? Number(counts.find((row) => row.poll_id === poll.id)?.count ?? 0) : null,
        };
      })
      .filter((poll) => !filter.openOnly || poll.is_open_now);
  }

  async detail(currentUser: CurrentUser, pollId: string) {
    const { database } = await this.currentSchoolYear.require();
    const { poll, manager } = await this.assertCanView(database, currentUser, pollId);
    const questions = await this.questionsOf(database, pollId);
    const responded = await database
      .selectFrom('poll_responses')
      .select('id')
      .where('poll_id', '=', pollId)
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    const likes = await database
      .selectFrom('interaction_likes')
      .select('user_id')
      .where('target_type', '=', 'poll')
      .where('target_id', '=', pollId)
      .execute();
    const now = this.clock.now().getTime();
    return {
      ...poll,
      can_manage: manager,
      is_open_now: poll.status === 'open' && poll.start_at.getTime() <= now && poll.end_at.getTime() > now,
      has_responded: responded !== undefined,
      like_count: likes.length,
      liked_by_me: likes.some((like) => like.user_id === currentUser.id),
      questions,
    };
  }

  private async questionsOf(database: Executor, pollId: string) {
    const questions = await database
      .selectFrom('poll_questions')
      .select(['id', 'question_text', 'answer_type', 'order_no', 'is_required'])
      .where('poll_id', '=', pollId)
      .orderBy('order_no')
      .execute();
    const options = await database
      .selectFrom('poll_options')
      .select(['id', 'question_id', 'label', 'order_no'])
      .where('poll_id', '=', pollId)
      .orderBy('order_no')
      .execute();
    return questions.map((question) => ({
      ...question,
      options: options.filter((option) => option.question_id === question.id).map(({ id, label }) => ({ id, label })),
    }));
  }

  // BR-67, BR-68: gửi phiếu một lần, trong thời gian bình chọn
  async respond(
    currentUser: CurrentUser,
    pollId: string,
    input: { option_id: string | null; answers: AnswerInput[] },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const poll = await this.findPoll(database, pollId);
    const participation = await this.participation(database, currentUser);
    if (poll.status === 'draft' || !PollsService.eligible(poll, participation)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không là đối tượng của bình chọn này');
    }
    const now = this.clock.now().getTime();
    if (poll.status === 'closed' || now >= poll.end_at.getTime()) {
      throw ruleViolationError('BR-68', `Đã hết thời gian ${POLL_LABELS[poll.poll_type]}, không nhận phiếu`);
    }
    if (now < poll.start_at.getTime()) {
      throw ruleViolationError('BR-68', `Chưa tới thời gian ${POLL_LABELS[poll.poll_type]}, chưa nhận phiếu`);
    }
    const existing = await database
      .selectFrom('poll_responses')
      .select('id')
      .where('poll_id', '=', pollId)
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (existing) {
      throw ruleViolationError('BR-67', 'Bạn đã gửi phiếu; mỗi tài khoản một phiếu và phiếu đã gửi không sửa được');
    }
    const questions = await this.questionsOf(database, pollId);
    const answers = input.answers.length
      ? input.answers
      : input.option_id && questions.length === 1 && questions[0]
        ? [{ question_id: questions[0].id, option_ids: [input.option_id], text: null, number: null }]
        : [];
    const rows = validateAnswers(questions, answers);
    try {
      return await database.transaction().execute(async (transaction) => {
        const response = await transaction
          .insertInto('poll_responses')
          .values({ poll_id: pollId, user_id: currentUser.id, submitted_at: this.clock.now() })
          .returningAll()
          .executeTakeFirstOrThrow();
        if (rows.length) {
          await transaction
            .insertInto('poll_answers')
            .values(rows.map((row) => ({ ...row, response_id: response.id })))
            .execute();
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: poll.org_unit_id,
          entityName: 'poll_responses',
          entityId: response.id,
          action: 'create',
          before: null,
          after: { poll_id: pollId, answers: rows.length },
        });
        return response;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw ruleViolationError('BR-67', 'Bạn đã gửi phiếu; mỗi tài khoản một phiếu và phiếu đã gửi không sửa được');
      }
      throw error;
    }
  }

  // Người quản lý xem kết quả bất cứ lúc nào; đối tượng xem khi đã công bố kết quả
  async results(currentUser: CurrentUser, pollId: string) {
    const { database } = await this.currentSchoolYear.require();
    const { poll, manager } = await this.assertCanView(database, currentUser, pollId);
    if (!manager && !poll.results_published_at) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Kết quả chưa được công bố');
    }
    const questions = await this.questionsOf(database, pollId);
    const responses = await database
      .selectFrom('poll_responses')
      .select(['id', 'user_id', 'submitted_at'])
      .where('poll_id', '=', pollId)
      .orderBy('submitted_at')
      .execute();
    const answers = responses.length
      ? await database
          .selectFrom('poll_answers')
          .select(['question_id', 'option_id', 'answer_text', 'answer_number'])
          .where(
            'response_id',
            'in',
            responses.map((response) => response.id),
          )
          .execute()
      : [];
    let respondents: Array<{ user_id: string; name: string | null; submitted_at: Date }> | null = null;
    if (manager && !poll.is_anonymous && responses.length) {
      const names = await database
        .selectFrom('guardians')
        .select(['user_id', 'full_name'])
        .where(
          'user_id',
          'in',
          responses.map((response) => response.user_id),
        )
        .execute();
      respondents = responses.map((response) => ({
        user_id: response.user_id,
        name: names.find((row) => row.user_id === response.user_id)?.full_name ?? null,
        submitted_at: response.submitted_at,
      }));
    }
    return {
      poll: { id: poll.id, title: poll.title, poll_type: poll.poll_type, status: poll.status, end_at: poll.end_at },
      response_count: responses.length,
      respondents,
      questions: questions.map((question) => {
        const own = answers.filter((answer) => answer.question_id === question.id);
        const numbers = own.map((answer) => answer.answer_number).filter((value): value is number => value !== null);
        return {
          id: question.id,
          question_text: question.question_text,
          answer_type: question.answer_type,
          options: question.options.map((option) => ({
            ...option,
            count: own.filter((answer) => answer.option_id === option.id).length,
          })),
          texts: own.map((answer) => answer.answer_text).filter((value): value is string => value !== null),
          average: numbers.length
            ? Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100
            : null,
        };
      }),
    };
  }

  // Danh mục khảo sát dùng chung toàn trường
  async listTemplates(currentUser: CurrentUser, includeInactive: boolean) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertTemplateManager(currentUser);
    let query = database.selectFrom('survey_templates').selectAll().orderBy('name');
    if (!includeInactive) {
      query = query.where('status', '=', 'active');
    }
    return query.execute();
  }

  private async assertTemplateManager(currentUser: CurrentUser) {
    const scope = await this.access.managerScope(currentUser, PERMISSION_CODES.interactionManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý danh mục khảo sát');
    }
  }

  async createTemplate(
    currentUser: CurrentUser,
    input: { name: string; description: string | null; questions: SurveyTemplateQuestion[] },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertTemplateManager(currentUser);
    if (input.questions.length === 0) {
      throw validationError([{ field: 'questions', message: 'Mẫu khảo sát cần ít nhất một câu hỏi' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('survey_templates')
          .values({
            name: input.name,
            description: input.description,
            questions: JSON.stringify(input.questions),
            created_by: currentUser.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Tên mẫu khảo sát đã có',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'survey_templates',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async setTemplateStatus(
    currentUser: CurrentUser,
    templateId: string,
    status: 'active' | 'inactive',
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertTemplateManager(currentUser);
    const template = await database
      .selectFrom('survey_templates')
      .select(['id', 'status'])
      .where('id', '=', templateId)
      .executeTakeFirst();
    if (!template) {
      throw notFoundError('Không tìm thấy mẫu khảo sát', 'survey_template');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('survey_templates')
        .set({ status })
        .where('id', '=', templateId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'survey_templates',
        entityId: templateId,
        action: 'update',
        before: { status: template.status },
        after: { status },
      });
      return updated;
    });
  }
}

// Mỗi câu hỏi bắt buộc phải có trả lời; lựa chọn phải thuộc câu hỏi; điểm đánh giá từ 1 đến 5
function validateAnswers(
  questions: Array<{
    id: string;
    answer_type: PollAnswerType;
    is_required: boolean;
    options: Array<{ id: string }>;
  }>,
  answers: AnswerInput[],
) {
  const errors: FieldError[] = [];
  const rows: Array<{
    question_id: string;
    option_id: string | null;
    answer_text: string | null;
    answer_number: number | null;
  }> = [];
  for (const answer of answers) {
    if (!questions.some((question) => question.id === answer.question_id)) {
      errors.push({ field: 'answers', message: 'Câu trả lời cho câu hỏi không thuộc bình chọn' });
    }
  }
  for (const question of questions) {
    const answer = answers.find((item) => item.question_id === question.id);
    const field = `answers.${question.id}`;
    const optionIds = [...new Set(answer?.option_ids ?? [])];
    const empty =
      !answer ||
      (question.answer_type === 'text' && !answer.text) ||
      (question.answer_type === 'rating' && answer.number === null) ||
      ((question.answer_type === 'single_choice' || question.answer_type === 'multiple_choice') &&
        optionIds.length === 0);
    if (empty) {
      if (question.is_required) {
        errors.push({ field, message: 'Câu hỏi bắt buộc trả lời' });
      }
      continue;
    }
    if (question.answer_type === 'single_choice' || question.answer_type === 'multiple_choice') {
      if (question.answer_type === 'single_choice' && optionIds.length > 1) {
        errors.push({ field, message: 'Chỉ chọn một phương án' });
        continue;
      }
      if (!optionIds.every((id) => question.options.some((option) => option.id === id))) {
        errors.push({ field, message: 'Phương án không thuộc câu hỏi' });
        continue;
      }
      rows.push(
        ...optionIds.map((optionId) => ({
          question_id: question.id,
          option_id: optionId,
          answer_text: null,
          answer_number: null,
        })),
      );
    } else if (question.answer_type === 'text') {
      rows.push({ question_id: question.id, option_id: null, answer_text: answer?.text ?? null, answer_number: null });
    } else {
      const value = answer?.number ?? 0;
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        errors.push({ field, message: 'Điểm đánh giá từ 1 đến 5' });
        continue;
      }
      rows.push({ question_id: question.id, option_id: null, answer_text: null, answer_number: value });
    }
  }
  if (errors.length) {
    throw validationError(errors);
  }
  return rows;
}

function readDateTime(body: RequestBody, field: string, errors: FieldError[]): Date {
  const value = body?.[field];
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Thời điểm dạng ISO 8601' });
    return new Date(NaN);
  }
  return new Date(value);
}

function readStringList(value: unknown, field: string, errors: FieldError[], maximum: number): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > maximum) {
    errors.push({ field, message: `Danh sách tối đa ${maximum} mục` });
    return [];
  }
  const labels = value.map((item) => (typeof item === 'string' ? item.trim() : ''));
  if (labels.some((label) => label === '' || label.length > 300)) {
    errors.push({ field, message: 'Mỗi mục là chữ, không trống, tối đa 300 ký tự' });
    return [];
  }
  if (new Set(labels).size !== labels.length) {
    errors.push({ field, message: 'Các mục không được trùng nhau' });
    return [];
  }
  return labels;
}

export function readQuestions(value: unknown, errors: FieldError[]): SurveyTemplateQuestion[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAXIMUM_QUESTIONS) {
    errors.push({ field: 'questions', message: `Danh sách câu hỏi tối đa ${MAXIMUM_QUESTIONS} câu` });
    return [];
  }
  return value.map((item, index) => {
    const body = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const field = `questions.${index}`;
    const questionErrors: FieldError[] = [];
    const questionText = readLimitedText(body, 'question_text', questionErrors, { required: true, maximum: 500 }) ?? '';
    const answerType = readChoice(body, 'answer_type', questionErrors, ANSWER_TYPES);
    const options = readStringList(body.options, 'options', questionErrors, MAXIMUM_OPTIONS);
    if ((answerType === 'single_choice' || answerType === 'multiple_choice') && options.length < 2) {
      questionErrors.push({ field: 'options', message: 'Câu hỏi chọn phương án cần ít nhất hai phương án' });
    }
    errors.push(...questionErrors.map((error) => ({ field: `${field}.${error.field}`, message: error.message })));
    return {
      question_text: questionText,
      answer_type: answerType,
      is_required: body.is_required !== false,
      options: answerType === 'single_choice' || answerType === 'multiple_choice' ? options : [],
    };
  });
}

function readAnswers(value: unknown, errors: FieldError[]): AnswerInput[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push({ field: 'answers', message: 'Danh sách câu trả lời' });
    return [];
  }
  return value.map((item) => {
    const body = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const optionIds = Array.isArray(body.option_ids)
      ? body.option_ids
      : body.option_id !== undefined && body.option_id !== null
        ? [body.option_id]
        : [];
    if (!isUuid(body.question_id) || !optionIds.every((id) => isUuid(id))) {
      errors.push({ field: 'answers', message: 'Mã câu hỏi hoặc phương án không hợp lệ' });
    }
    const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 1000) : null;
    const number = typeof body.number === 'number' ? body.number : null;
    return { question_id: String(body.question_id), option_ids: optionIds as string[], text, number };
  });
}

@Controller()
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get('polls')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const status =
      query.status === undefined ? null : readChoice(query, 'status', errors, ['draft', 'open', 'closed'] as const);
    const pollType = query.poll_type === undefined ? null : readChoice(query, 'poll_type', errors, POLL_TYPES);
    const orgUnitId = readOptionalUuid(query, 'org_unit_id', errors) ?? null;
    if (errors.length) {
      throw validationError(errors);
    }
    return this.polls.list(currentUser, { status, pollType, orgUnitId, openOnly: query.open === 'true' });
  }

  @Post('polls')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      poll_type: readChoice(body, 'poll_type', errors, POLL_TYPES),
      title: readLimitedText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
      description: readLimitedText(body, 'description', errors, { maximum: 2000 }),
      class_id: readOptionalUuid(body, 'class_id', errors) ?? null,
      audience: readChoice(body, 'audience', errors, AUDIENCES, 'guardians'),
      start_at: readDateTime(body, 'start_at', errors),
      end_at: readDateTime(body, 'end_at', errors),
      is_anonymous: body?.is_anonymous === true,
      survey_template_id: readOptionalUuid(body, 'survey_template_id', errors) ?? null,
      options: readStringList(body?.options, 'options', errors, MAXIMUM_OPTIONS),
      questions: readQuestions(body?.questions, errors),
    };
    if (
      !Number.isNaN(input.start_at.getTime()) &&
      !Number.isNaN(input.end_at.getTime()) &&
      input.end_at.getTime() <= input.start_at.getTime()
    ) {
      errors.push({ field: 'end_at', message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
    }
    if (errors.length) {
      throw validationError(errors);
    }
    return this.polls.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('polls/:id')
  detail(
    @Param('id', uuidParameter('Mã bình chọn không hợp lệ')) pollId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.polls.detail(currentUser, pollId);
  }

  @Post('polls/:id/publish')
  @HttpCode(200)
  publish(
    @Param('id', uuidParameter('Mã bình chọn không hợp lệ')) pollId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.polls.publish(currentUser, pollId, originOf(request, currentUser));
  }

  @Post('polls/:id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã bình chọn không hợp lệ')) pollId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.polls.close(currentUser, pollId, originOf(request, currentUser));
  }

  @Post('polls/:id/publish-results')
  @HttpCode(200)
  publishResults(
    @Param('id', uuidParameter('Mã bình chọn không hợp lệ')) pollId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.polls.publishResults(currentUser, pollId, originOf(request, currentUser));
  }

  @Post('polls/:id/responses')
  @HttpCode(201)
  respond(
    @Param('id', uuidParameter('Mã bình chọn không hợp lệ')) pollId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      option_id: readOptionalUuid(body, 'option_id', errors) ?? null,
      answers: readAnswers(body?.answers, errors),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.polls.respond(currentUser, pollId, input, originOf(request, currentUser));
  }

  @Get('polls/:id/results')
  results(
    @Param('id', uuidParameter('Mã bình chọn không hợp lệ')) pollId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.polls.results(currentUser, pollId);
  }

  @Get('survey-templates')
  listTemplates(@Query('include_inactive') includeInactive: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.polls.listTemplates(currentUser, includeInactive === 'true');
  }

  @Post('survey-templates')
  @HttpCode(201)
  createTemplate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      name: readLimitedText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      description: readLimitedText(body, 'description', errors, { maximum: 2000 }),
      questions: readQuestions(body?.questions, errors),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.polls.createTemplate(currentUser, input, originOf(request, currentUser));
  }

  @Post('survey-templates/:id/status')
  @HttpCode(200)
  setTemplateStatus(
    @Param('id', uuidParameter('Mã mẫu khảo sát không hợp lệ')) templateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const status = readChoice(body, 'status', errors, ['active', 'inactive'] as const);
    if (errors.length) {
      throw validationError(errors);
    }
    return this.polls.setTemplateStatus(currentUser, templateId, status, originOf(request, currentUser));
  }
}
