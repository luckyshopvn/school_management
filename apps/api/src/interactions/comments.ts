import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type {
  CommentModerationAction,
  CommentTargetType,
  LikeTargetType,
  SchoolYearDatabase,
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
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { InteractionAccess, readChoice, readLimitedText } from './interaction-access.js';
import { PollsService } from './polls.js';

// Bình luận và lượt thích trên đối tượng của P15 theo cặp loại và mã đối tượng (P15-06; BR-66; YCTD-79). Hiện có loại
// poll (bình chọn, biểu quyết, khảo sát); thêm loại thì thêm vào ràng buộc và hàm kiểm tra quyền xem đối tượng. Không có
// thao tác xóa bình luận: người xem báo bình luận tiêu cực cho quản lý đơn vị; quản lý ẩn kèm lý do, khôi phục hoặc ghi
// chú; nội dung giữ nguyên, mỗi lần xử lý có một bản ghi xử lý
const COMMENT_TARGETS: CommentTargetType[] = ['poll'];
const LIKE_TARGETS: LikeTargetType[] = ['poll', 'comment'];
const MODERATION_ACTIONS: CommentModerationAction[] = ['hide', 'restore', 'note'];

@Injectable()
export class CommentsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InteractionAccess,
    private readonly polls: PollsService,
    private readonly clock: Clock,
  ) {}

  // Quyền xem đối tượng được bình luận; trả đơn vị của đối tượng và người gọi có quản lý được không
  private async viewTarget(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<{ orgUnitId: string; manager: boolean }> {
    switch (targetType) {
      case 'poll': {
        const { poll, manager } = await this.polls.assertCanView(database, currentUser, targetId);
        return { orgUnitId: poll.org_unit_id, manager };
      }
    }
  }

  private async findComment(database: Kysely<SchoolYearDatabase>, commentId: string) {
    const comment = await database
      .selectFrom('interaction_comments')
      .selectAll()
      .where('id', '=', commentId)
      .executeTakeFirst();
    if (!comment) {
      throw notFoundError('Không tìm thấy bình luận', 'comment');
    }
    return comment;
  }

  async list(currentUser: CurrentUser, targetType: CommentTargetType, targetId: string) {
    const { database } = await this.currentSchoolYear.require();
    const { manager } = await this.viewTarget(database, currentUser, targetType, targetId);
    const comments = await database
      .selectFrom('interaction_comments')
      .selectAll()
      .where('target_type', '=', targetType)
      .where('target_id', '=', targetId)
      .orderBy('created_at')
      .execute();
    // Bình luận ẩn chỉ người quản lý và người viết còn thấy
    const visible = comments.filter((comment) => !comment.hidden_at || manager || comment.user_id === currentUser.id);
    return this.decorate(database, currentUser, visible, manager);
  }

  private async decorate(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    comments: Array<Awaited<ReturnType<CommentsService['findComment']>>>,
    manager: boolean,
  ) {
    if (comments.length === 0) {
      return [];
    }
    const ids = comments.map((comment) => comment.id);
    const likes = await database
      .selectFrom('interaction_likes')
      .select(['target_id', 'user_id'])
      .where('target_type', '=', 'comment')
      .where('target_id', 'in', ids)
      .execute();
    const moderations = manager
      ? await database
          .selectFrom('comment_moderations')
          .select(['id', 'comment_id', 'action', 'reason', 'handled_by', 'handled_at'])
          .where('comment_id', 'in', ids)
          .orderBy('handled_at')
          .execute()
      : [];
    return comments.map((comment) => ({
      id: comment.id,
      target_type: comment.target_type,
      target_id: comment.target_id,
      org_unit_id: comment.org_unit_id,
      user_id: comment.user_id,
      author_name: comment.author_name,
      author_side: comment.author_side,
      content: comment.content,
      created_at: comment.created_at,
      is_hidden: comment.hidden_at !== null,
      hide_reason: manager || comment.user_id === currentUser.id ? comment.hide_reason : null,
      reported_at: manager ? comment.reported_at : null,
      like_count: likes.filter((like) => like.target_id === comment.id).length,
      liked_by_me: likes.some((like) => like.target_id === comment.id && like.user_id === currentUser.id),
      moderations: manager ? moderations.filter((row) => row.comment_id === comment.id) : undefined,
    }));
  }

  async create(
    currentUser: CurrentUser,
    input: { target_type: CommentTargetType; target_id: string; content: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const { orgUnitId } = await this.viewTarget(database, currentUser, input.target_type, input.target_id);
    const side = (await this.access.staffScope(currentUser)) ? 'staff' : 'guardian';
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('interaction_comments')
        .values({
          org_unit_id: orgUnitId,
          target_type: input.target_type,
          target_id: input.target_id,
          user_id: currentUser.id,
          author_name: currentUser.description.full_name,
          author_side: side,
          content: input.content,
          created_at: this.clock.now(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'interaction_comments',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { target_type: created.target_type, target_id: created.target_id },
      });
      return created;
    });
  }

  // BR-66: bình luận tiêu cực được chuyển cho quản lý đơn vị
  async report(currentUser: CurrentUser, commentId: string, reason: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const comment = await this.findComment(database, commentId);
    await this.viewTarget(database, currentUser, comment.target_type, comment.target_id);
    if (comment.reported_at) {
      return { id: comment.id, reported_at: comment.reported_at };
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('interaction_comments')
        .set({ reported_at: this.clock.now(), reported_by: currentUser.id })
        .where('id', '=', commentId)
        .returning(['id', 'reported_at'])
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: comment.org_unit_id,
        templateCode: 'comment_reported',
        title: 'Bình luận cần xử lý',
        body: `${comment.author_name}: ${comment.content.slice(0, 150)}${reason ? ` (Lý do báo: ${reason})` : ''}`,
        targetType: 'interaction_comments',
        targetId: comment.id,
        recipients: [{ roleCode: 'VT-03', orgUnitId: comment.org_unit_id, channel: 'in_app' }],
      });
      return updated;
    });
  }

  // Bình luận đã bị báo hoặc đã ẩn trong phạm vi quản lý, để quản lý đơn vị xử lý riêng
  async listReported(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.managerScope(currentUser, PERMISSION_CODES.interactionManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xử lý bình luận');
    }
    let query = database
      .selectFrom('interaction_comments')
      .selectAll()
      .where((expression) =>
        expression.or([expression('reported_at', 'is not', null), expression('hidden_at', 'is not', null)]),
      )
      .orderBy('created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    return this.decorate(database, currentUser, await query.execute(), true);
  }

  async moderate(
    currentUser: CurrentUser,
    commentId: string,
    input: { action: CommentModerationAction; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const comment = await this.findComment(database, commentId);
    if (!(await this.access.canManageUnit(currentUser, PERMISSION_CODES.interactionManage, comment.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ quản lý đơn vị xử lý được bình luận');
    }
    if (input.action === 'hide' && comment.hidden_at) {
      throw ruleViolationError('BR-66', 'Bình luận đã được ẩn');
    }
    if (input.action === 'restore' && !comment.hidden_at) {
      throw ruleViolationError('BR-66', 'Bình luận đang hiện, không cần khôi phục');
    }
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const moderation = await transaction
        .insertInto('comment_moderations')
        .values({
          comment_id: commentId,
          action: input.action,
          reason: input.reason,
          handled_by: currentUser.id,
          handled_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (input.action !== 'note') {
        await transaction
          .updateTable('interaction_comments')
          .set(
            input.action === 'hide'
              ? { hidden_at: now, hidden_by: currentUser.id, hide_reason: input.reason }
              : { hidden_at: null, hidden_by: null, hide_reason: null },
          )
          .where('id', '=', commentId)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: comment.org_unit_id,
        entityName: 'interaction_comments',
        entityId: commentId,
        action: 'update',
        before: { hidden: comment.hidden_at !== null },
        after: {
          hidden: input.action === 'note' ? comment.hidden_at !== null : input.action === 'hide',
          moderation_id: moderation.id,
        },
      });
      return moderation;
    });
  }

  // Thích hoặc bỏ thích; mỗi tài khoản một lượt thích cho mỗi đối tượng
  async toggleLike(currentUser: CurrentUser, targetType: LikeTargetType, targetId: string) {
    const { database } = await this.currentSchoolYear.require();
    if (targetType === 'comment') {
      const comment = await this.findComment(database, targetId);
      await this.viewTarget(database, currentUser, comment.target_type, comment.target_id);
      if (comment.hidden_at) {
        throw ruleViolationError('BR-66', 'Bình luận đã bị ẩn');
      }
    } else {
      await this.viewTarget(database, currentUser, targetType, targetId);
    }
    const existing = await database
      .selectFrom('interaction_likes')
      .select('id')
      .where('target_type', '=', targetType)
      .where('target_id', '=', targetId)
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (existing) {
      await database.deleteFrom('interaction_likes').where('id', '=', existing.id).execute();
    } else {
      await database
        .insertInto('interaction_likes')
        .values({ target_type: targetType, target_id: targetId, user_id: currentUser.id })
        .onConflict((conflict) => conflict.columns(['target_type', 'target_id', 'user_id']).doNothing())
        .execute();
    }
    const count = await database
      .selectFrom('interaction_likes')
      .select(database.fn.countAll<string>().as('count'))
      .where('target_type', '=', targetType)
      .where('target_id', '=', targetId)
      .executeTakeFirstOrThrow();
    return { liked: !existing, like_count: Number(count.count) };
  }
}

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('interaction-comments')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const targetType = readChoice(query, 'target_type', errors, COMMENT_TARGETS);
    const targetId = readRequiredUuid(query, 'target_id', errors, 'Bắt buộc chọn đối tượng');
    if (errors.length) {
      throw validationError(errors);
    }
    return this.comments.list(currentUser, targetType, targetId);
  }

  @Get('interaction-comments/reported')
  listReported(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.comments.listReported(currentUser);
  }

  @Post('interaction-comments')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      target_type: readChoice(body, 'target_type', errors, COMMENT_TARGETS),
      target_id: readRequiredUuid(body, 'target_id', errors, 'Bắt buộc chọn đối tượng'),
      content: readLimitedText(body, 'content', errors, { required: true, maximum: 1000 }) ?? '',
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.comments.create(currentUser, input, originOf(request, currentUser));
  }

  @Post('interaction-comments/:id/report')
  @HttpCode(200)
  report(
    @Param('id', uuidParameter('Mã bình luận không hợp lệ')) commentId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readLimitedText(body, 'reason', errors, { maximum: 500 });
    if (errors.length) {
      throw validationError(errors);
    }
    return this.comments.report(currentUser, commentId, reason);
  }

  @Post('interaction-comments/:id/moderate')
  @HttpCode(201)
  moderate(
    @Param('id', uuidParameter('Mã bình luận không hợp lệ')) commentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      action: readChoice(body, 'action', errors, MODERATION_ACTIONS),
      reason: readLimitedText(body, 'reason', errors, { required: true, maximum: 1000 }) ?? '',
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.comments.moderate(currentUser, commentId, input, originOf(request, currentUser));
  }

  @Post('interaction-likes')
  @HttpCode(200)
  toggleLike(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const targetType = readChoice(body, 'target_type', errors, LIKE_TARGETS);
    const targetId = readRequiredUuid(body, 'target_id', errors, 'Bắt buộc chọn đối tượng');
    if (errors.length) {
      throw validationError(errors);
    }
    return this.comments.toggleLike(currentUser, targetType, targetId);
  }
}
