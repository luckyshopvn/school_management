import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { FeedbackCategory, FeedbackPrivacy, FeedbackStatus } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readOptionalUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { InteractionAccess, readChoice, readLimitedText } from './interaction-access.js';

// Góp ý (P15-02; BR-66, BR-72; YCTD-79): phụ huynh góp ý gắn với con, nhân sự góp ý cho đơn vị mình; quản lý đơn vị có
// quyền P15.interaction.manage tiếp nhận, chuyển người xử lý và ghi kết quả. Góp ý ẩn danh không hiện người gửi với người
// xử lý; người gửi xem được góp ý của mình và kết quả
export const FEEDBACK_CATEGORIES: FeedbackCategory[] = ['teaching', 'care', 'meal', 'facility', 'fee', 'other'];
const PRIVACY_LEVELS: FeedbackPrivacy[] = ['named', 'anonymous'];
const HANDLE_STATUSES = ['in_progress', 'resolved'] as const;

@Injectable()
export class FeedbacksService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InteractionAccess,
    private readonly clock: Clock,
  ) {}

  async submit(
    currentUser: CurrentUser,
    input: {
      child_id: string | null;
      org_unit_id: string | null;
      category: FeedbackCategory;
      content: string;
      privacy_level: FeedbackPrivacy;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    let orgUnitId: string;
    if (input.child_id) {
      const child = await this.access.findChild(database, input.child_id);
      if (!(await this.access.isGuardianOf(database, child.id, currentUser.id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ gửi được góp ý gắn với trẻ');
      }
      orgUnitId = child.org_unit_id;
    } else if (input.org_unit_id) {
      if (!(await this.access.isStaffOfUnit(currentUser, input.org_unit_id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
      }
      orgUnitId = input.org_unit_id;
    } else {
      throw validationError([{ field: 'child_id', message: 'Chọn trẻ hoặc đơn vị nhận góp ý' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('feedbacks')
        .values({
          org_unit_id: orgUnitId,
          child_id: input.child_id,
          submitted_by_user_id: currentUser.id,
          submitter_name: currentUser.description.full_name,
          category: input.category,
          content: input.content,
          privacy_level: input.privacy_level,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: 'feedback_received',
        title: 'Góp ý mới',
        body: input.content.length > 200 ? `${input.content.slice(0, 200)}…` : input.content,
        targetType: 'feedbacks',
        targetId: created.id,
        recipients: [{ roleCode: 'VT-03', orgUnitId, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'feedbacks',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { id: created.id, category: created.category, privacy_level: created.privacy_level },
      });
      return created;
    });
  }

  // Người xử lý thấy góp ý của đơn vị trong phạm vi; ai cũng thấy góp ý mình đã gửi
  async list(currentUser: CurrentUser, filter: { status: FeedbackStatus | null; orgUnitId: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.managerScope(currentUser, PERMISSION_CODES.interactionManage);
    let query = database
      .selectFrom('feedbacks')
      .leftJoin('children', 'children.id', 'feedbacks.child_id')
      .select([
        'feedbacks.id',
        'feedbacks.org_unit_id',
        'feedbacks.child_id',
        'children.full_name as child_name',
        'feedbacks.submitted_by_user_id',
        'feedbacks.submitter_name',
        'feedbacks.category',
        'feedbacks.content',
        'feedbacks.privacy_level',
        'feedbacks.status',
        'feedbacks.assigned_to_user_id',
        'feedbacks.handled_at',
        'feedbacks.handling_note',
        'feedbacks.created_at',
      ])
      .orderBy('feedbacks.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where((expression) =>
        expression.or([
          expression('feedbacks.submitted_by_user_id', '=', currentUser.id),
          ...(scope.orgUnitIds.length ? [expression('feedbacks.org_unit_id', 'in', scope.orgUnitIds)] : []),
        ]),
      );
    }
    if (filter.status) {
      query = query.where('feedbacks.status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('feedbacks.org_unit_id', '=', filter.orgUnitId);
    }
    const rows = await query.execute();
    return rows.map((row) => {
      const mine = row.submitted_by_user_id === currentUser.id;
      if (mine || row.privacy_level === 'named') {
        return { ...row, mine };
      }
      return { ...row, mine, submitted_by_user_id: null, submitter_name: 'Ẩn danh', child_id: null, child_name: null };
    });
  }

  async handle(
    currentUser: CurrentUser,
    feedbackId: string,
    input: { status: 'in_progress' | 'resolved'; handling_note: string | null; assigned_to_user_id: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const feedback = await database.selectFrom('feedbacks').selectAll().where('id', '=', feedbackId).executeTakeFirst();
    if (!feedback) {
      throw notFoundError('Không tìm thấy góp ý', 'feedback');
    }
    if (!(await this.access.canManageUnit(currentUser, PERMISSION_CODES.interactionManage, feedback.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xử lý góp ý của đơn vị này');
    }
    if (feedback.status === 'resolved') {
      throw ruleViolationError('P15-02', 'Góp ý đã có kết quả xử lý');
    }
    if (input.status === 'resolved' && !input.handling_note) {
      throw validationError([{ field: 'handling_note', message: 'Ghi kết quả xử lý' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('feedbacks')
        .set({
          status: input.status,
          handling_note: input.handling_note ?? feedback.handling_note,
          assigned_to_user_id: input.assigned_to_user_id ?? feedback.assigned_to_user_id,
          handled_by: currentUser.id,
          handled_at: this.clock.now(),
        })
        .where('id', '=', feedbackId)
        .returningAll()
        .executeTakeFirstOrThrow();
      const recipients = [
        ...(input.status === 'resolved' ? [{ userId: feedback.submitted_by_user_id, channel: 'in_app' as const }] : []),
        ...(input.assigned_to_user_id && input.assigned_to_user_id !== feedback.assigned_to_user_id
          ? [{ userId: input.assigned_to_user_id, channel: 'in_app' as const }]
          : []),
      ];
      await queueNotification(transaction, {
        orgUnitId: feedback.org_unit_id,
        templateCode: input.status === 'resolved' ? 'feedback_resolved' : 'feedback_assigned',
        title: input.status === 'resolved' ? 'Kết quả xử lý góp ý' : 'Góp ý cần xử lý',
        body: input.handling_note ?? feedback.content.slice(0, 200),
        targetType: 'feedbacks',
        targetId: feedbackId,
        recipients,
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: feedback.org_unit_id,
        entityName: 'feedbacks',
        entityId: feedbackId,
        action: 'update',
        before: { status: feedback.status, assigned_to_user_id: feedback.assigned_to_user_id },
        after: { status: updated.status, assigned_to_user_id: updated.assigned_to_user_id },
      });
      return updated;
    });
  }
}

@Controller()
export class FeedbacksController {
  constructor(private readonly feedbacks: FeedbacksService) {}

  @Post('feedbacks')
  @HttpCode(201)
  submit(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      child_id: readOptionalUuid(body, 'child_id', errors) ?? null,
      org_unit_id: readOptionalUuid(body, 'org_unit_id', errors) ?? null,
      category: readChoice(body, 'category', errors, FEEDBACK_CATEGORIES, 'other'),
      content: readLimitedText(body, 'content', errors, { required: true, maximum: 2000 }) ?? '',
      privacy_level: readChoice(body, 'privacy_level', errors, PRIVACY_LEVELS, 'named'),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.feedbacks.submit(currentUser, input, originOf(request, currentUser));
  }

  @Get('feedbacks')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const status =
      query.status === undefined
        ? null
        : readChoice(query, 'status', errors, ['received', 'in_progress', 'resolved'] as const);
    const orgUnitId = readOptionalUuid(query, 'org_unit_id', errors) ?? null;
    if (errors.length) {
      throw validationError(errors);
    }
    return this.feedbacks.list(currentUser, { status, orgUnitId });
  }

  @Post('feedbacks/:id/handle')
  @HttpCode(200)
  handle(
    @Param('id', uuidParameter('Mã góp ý không hợp lệ')) feedbackId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      status: readChoice(body, 'status', errors, HANDLE_STATUSES),
      handling_note: readLimitedText(body, 'handling_note', errors, { maximum: 2000 }),
      assigned_to_user_id: readOptionalUuid(body, 'assigned_to_user_id', errors) ?? null,
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.feedbacks.handle(currentUser, feedbackId, input, originOf(request, currentUser));
  }
}
