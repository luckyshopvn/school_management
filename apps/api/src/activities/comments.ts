import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { CommentTargetType, SchoolYearDatabase } from '@school-management/database';
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
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ActivitiesService } from './activities.js';
import { ActivityAccess, check, readReason, readText } from './activity-access.js';
import { ContentService, LibraryAlbumsService } from './content.js';

// Bình luận trên hoạt động, tin tức, nội dung và album thư viện (P14-12; BR-66; QT-10 bước 9, 10; YCTD-78). Bình luận
// không xóa được, kể cả của phụ huynh; quản lý đơn vị (hoặc giáo viên với hoạt động của lớp mình, nội dung mình tạo) ẩn
// bình luận vi phạm kèm lý do, bình luận ẩn vẫn được lưu và nhân sự quản lý vẫn thấy
const TARGETS: CommentTargetType[] = ['activity', 'news', 'library_item', 'library_album'];
export const MAXIMUM_COMMENT = 1000;

interface Target {
  org_unit_id: string;
  class_id: string | null;
  created_by: string;
  published: boolean;
  title: string;
  manage: boolean;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly activities: ActivitiesService,
    private readonly content: ContentService,
    private readonly albums: LibraryAlbumsService,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, targetType: CommentTargetType, targetId: string) {
    const { database } = await this.currentSchoolYear.require();
    const target = await this.target(database, currentUser, targetType, targetId);
    const moderator = target.manage || (await this.canModerate(database, currentUser, target));
    let query = database
      .selectFrom('content_comments')
      .selectAll()
      .where('target_type', '=', targetType)
      .where('target_id', '=', targetId);
    if (!moderator) {
      query = query.where('hidden_at', 'is', null);
    }
    return query.orderBy('created_at').execute();
  }

  async create(
    currentUser: CurrentUser,
    input: { target_type: CommentTargetType; target_id: string; content: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const target = await this.target(database, currentUser, input.target_type, input.target_id);
    if (!target.published) {
      throw ruleViolationError('BR-64', 'Chỉ bình luận nội dung đã công bố');
    }
    const isParent = this.access.isParent(currentUser) && !target.manage;
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('content_comments')
        .values({
          target_type: input.target_type,
          target_id: input.target_id,
          org_unit_id: target.org_unit_id,
          user_id: currentUser.id,
          author_name: origin.actorName,
          is_parent: isParent,
          content: input.content,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (isParent) {
        // QT-10: phụ huynh bình luận thì người tạo nội dung và quản lý đơn vị nhận thông báo
        await queueNotification(transaction, {
          orgUnitId: target.org_unit_id,
          templateCode: 'content_comment_created',
          title: 'Có bình luận mới',
          body: `${origin.actorName} bình luận "${target.title}"`,
          targetType: 'content_comments',
          targetId: created.id,
          recipients: [
            { userId: target.created_by, channel: 'in_app' },
            { roleCode: 'VT-03', orgUnitId: target.org_unit_id, channel: 'in_app' },
          ],
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: target.org_unit_id,
        entityName: 'content_comments',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async hide(currentUser: CurrentUser, commentId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const comment = await this.findComment(database, commentId);
    const target = await this.rawTarget(database, comment.target_type, comment.target_id);
    if (!(await this.canModerate(database, currentUser, target))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền ẩn bình luận này');
    }
    if (comment.hidden_at) {
      throw new ApplicationError('ERR_CONFLICT', 'Bình luận đã được ẩn');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('content_comments')
        .set({ hidden_reason: reason, hidden_by: currentUser.id, hidden_at: this.clock.now() })
        .where('id', '=', commentId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: comment.org_unit_id,
        entityName: 'content_comments',
        entityId: commentId,
        action: 'update',
        before: { hidden_at: null },
        after: { hidden_reason: reason },
      });
      return updated;
    });
  }

  // BR-66: không xóa bình luận; chỉ ẩn kèm lý do
  async remove(commentId: string): Promise<never> {
    const { database } = await this.currentSchoolYear.require();
    const comment = await this.findComment(database, commentId);
    throw ruleViolationError(
      'BR-66',
      comment.is_parent
        ? 'Không được xóa bình luận của phụ huynh; quản lý đơn vị chỉ ẩn bình luận vi phạm kèm lý do'
        : 'Bình luận không xóa được; chỉ ẩn kèm lý do',
    );
  }

  private async findComment(database: Kysely<SchoolYearDatabase>, commentId: string) {
    const comment = await database
      .selectFrom('content_comments')
      .selectAll()
      .where('id', '=', commentId)
      .executeTakeFirst();
    if (!comment) {
      throw notFoundError('Không tìm thấy bình luận', 'content_comment');
    }
    return comment;
  }

  // Người duyệt hoặc người có quyền xử lý bình luận của đơn vị; giáo viên với hoạt động của lớp mình hoặc nội dung mình tạo
  private async canModerate(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    target: Omit<Target, 'manage'>,
  ) {
    if (
      (await this.access.canOffice(currentUser, PERMISSION_CODES.commentModerate, target.org_unit_id)) ||
      (await this.access.canOffice(currentUser, PERMISSION_CODES.activityApprove, target.org_unit_id))
    ) {
      return true;
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.commentModerate)) {
      return false;
    }
    if (target.created_by === currentUser.id) {
      return true;
    }
    return (
      target.class_id !== null && (await this.access.teacherClassIds(database, currentUser)).includes(target.class_id)
    );
  }

  // Kiểm tra quyền xem đối tượng của bình luận và trả thông tin cần dùng
  private async target(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<Target> {
    const raw = await this.rawTarget(database, targetType, targetId);
    if (targetType === 'activity') {
      const activity = await this.activities.findActivity(database, targetId);
      const mode = await this.activities.viewMode(database, currentUser, activity);
      return { ...raw, manage: mode === 'staff' };
    }
    if (targetType === 'library_album') {
      const albums = await this.albums.list(currentUser, null);
      const album = albums.find((row) => row.id === targetId);
      if (!album) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem album này');
      }
      return { ...raw, manage: album.can_manage };
    }
    const table = targetType === 'news' ? 'news' : 'library_items';
    const row = await this.content.findRow(database, table, targetId);
    const mode = await this.content.assertCanView(database, currentUser, table, row);
    return { ...raw, manage: mode === 'manage' };
  }

  private async rawTarget(
    database: Kysely<SchoolYearDatabase>,
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<Omit<Target, 'manage'>> {
    if (targetType === 'activity') {
      const row = await database
        .selectFrom('activities')
        .select(['org_unit_id', 'class_id', 'created_by', 'status', 'title'])
        .where('id', '=', targetId)
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Hoạt động không tồn tại', 'activity');
      }
      return { ...row, published: row.status === 'published' };
    }
    if (targetType === 'library_album') {
      const row = await database
        .selectFrom('library_albums')
        .select(['org_unit_id', 'created_by', 'status', 'title'])
        .where('id', '=', targetId)
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy album', 'library_album');
      }
      return { ...row, class_id: null, published: row.status === 'active' };
    }
    const row = await database
      .selectFrom(targetType === 'news' ? 'news' : ('library_items' as 'news'))
      .select(['org_unit_id', 'created_by', 'status', 'title', 'scope_type', 'scope_id'])
      .where('id', '=', targetId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy nội dung', targetType);
    }
    return {
      org_unit_id: row.org_unit_id,
      created_by: row.created_by,
      title: row.title,
      class_id: row.scope_type === 'class' ? row.scope_id : null,
      published: row.status === 'published',
    };
  }
}

function readTarget(type: unknown, id: unknown): { targetType: CommentTargetType; targetId: string } {
  const errors: FieldError[] = [];
  if (!TARGETS.includes(type as CommentTargetType)) {
    errors.push({ field: 'target_type', message: `Đối tượng là ${TARGETS.join(', ')}` });
  }
  if (!isUuid(id)) {
    errors.push({ field: 'target_id', message: 'Mã đối tượng không hợp lệ' });
  }
  check(errors);
  return { targetType: type as CommentTargetType, targetId: id as string };
}

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('content-comments')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const { targetType, targetId } = readTarget(query.target_type, query.target_id);
    return this.comments.list(currentUser, targetType, targetId);
  }

  @Post('content-comments')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const { targetType, targetId } = readTarget(body?.target_type, body?.target_id);
    return this.createFor(currentUser, targetType, targetId, body, request);
  }

  @Get('activities/:id/comments')
  listOfActivity(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.comments.list(currentUser, 'activity', id);
  }

  @Post('activities/:id/comments')
  @HttpCode(201)
  createOfActivity(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.createFor(currentUser, 'activity', id, body, request);
  }

  @Post('comments/:id/hide')
  @HttpCode(200)
  hide(
    @Param('id', uuidParameter('Mã bình luận không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.comments.hide(currentUser, id, readReason(body), originOf(request, currentUser));
  }

  @Delete('content-comments/:id')
  remove(@Param('id', uuidParameter('Mã bình luận không hợp lệ')) id: string) {
    return this.comments.remove(id);
  }

  private createFor(
    currentUser: CurrentUser,
    targetType: CommentTargetType,
    targetId: string,
    body: RequestBody,
    request: Request,
  ) {
    const errors: FieldError[] = [];
    const content = readText(body, 'content', errors, { required: true, maximum: MAXIMUM_COMMENT });
    check(errors);
    if (!content) {
      throw validationError([{ field: 'content', message: 'Bắt buộc nhập' }]);
    }
    return this.comments.create(
      currentUser,
      { target_type: targetType, target_id: targetId, content },
      originOf(request, currentUser),
    );
  }
}
