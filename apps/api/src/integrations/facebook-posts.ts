import { Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { FacebookPostSourceType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { ActivityAccess, covers, unitIdsOrNone } from '../activities/activity-access.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import { optionalEnumQuery, optionalUuidQuery } from '../inventory/inventory-common.js';
import { FacebookPublisher, type FacebookPhoto } from './facebook-publisher.js';
import { readIntegration } from './integrations.js';

// Đăng hoạt động hoặc tin tức đã công bố lên Fanpage (P14-08, G3-03; BR-64, BR-65; YCTD-90). Quản lý đơn vị hoặc Ban Giám
// hiệu có quyền P14.facebook.manage trong phạm vi đơn vị của nội dung bấm đăng; chỉ nội dung đã công bố được đăng (BR-64);
// hình chỉ kèm khi mọi trẻ được gắn thẻ đã đồng ý sử dụng hình ảnh (BR-65), hình khác bị loại và đếm lại. Tin tức gửi riêng
// cho lớp hoặc trẻ không đăng công khai. Mỗi nội dung một bài; đăng lỗi thì ghi lỗi, người quản lý bấm thử lại. Ẩn nội dung
// trên hệ thống không tự gỡ bài trên Fanpage
type Database = Kysely<SchoolYearDatabase>;

interface PostSource {
  sourceType: FacebookPostSourceType;
  id: string;
  orgUnitId: string;
  title: string;
  message: string;
  photos: Array<{ file_id: string; file_name: string; content_type: string; storage_key: string }>;
  excludedPhotoCount: number;
}

const SOURCE_LABELS: Record<FacebookPostSourceType, string> = { activity: 'hoạt động', news: 'tin tức' };

@Injectable()
export class FacebookPostsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly publisher: FacebookPublisher,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async post(currentUser: CurrentUser, sourceType: FacebookPostSourceType, sourceId: string, origin: ChangeOrigin) {
    const scope = await this.access.officeScope(currentUser, PERMISSION_CODES.facebookManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền đăng nội dung lên Fanpage');
    }
    const { database } = await this.currentSchoolYear.require();
    // Kiểm tra kết nối trước để người dùng biết ngay khi nhà trường chưa bật Fanpage
    await this.pageId(database);
    const source = await this.loadSource(database, sourceType, sourceId);
    await this.assertManage(currentUser, source.orgUnitId);
    const existing = await database
      .selectFrom('facebook_posts')
      .select(['id', 'status'])
      .where('source_type', '=', sourceType)
      .where('source_id', '=', sourceId)
      .executeTakeFirst();
    if (existing?.status === 'posted') {
      throw new ApplicationError('ERR_CONFLICT', `${capitalize(SOURCE_LABELS[sourceType])} đã đăng lên Fanpage`);
    }
    return this.attempt(database, source, existing?.id ?? null, origin);
  }

  async retry(currentUser: CurrentUser, postId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('facebook_posts')
      .select(['id', 'status', 'source_type', 'source_id', 'org_unit_id'])
      .where('id', '=', postId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy bài đăng Fanpage', 'facebook_post');
    }
    await this.assertManage(currentUser, existing.org_unit_id);
    if (existing.status !== 'failed') {
      throw new ApplicationError('ERR_CONFLICT', 'Chỉ thử lại bài đăng lỗi');
    }
    const source = await this.loadSource(database, existing.source_type, existing.source_id);
    return this.attempt(database, source, existing.id, origin);
  }

  async list(currentUser: CurrentUser, filter: { sourceType: FacebookPostSourceType | null; sourceId: string | null }) {
    const scope = await this.access.officeScope(currentUser, PERMISSION_CODES.facebookManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem bài đăng Fanpage');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('facebook_posts').selectAll().orderBy('created_at', 'desc').limit(200);
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', unitIdsOrNone(scope));
    }
    if (filter.sourceType) {
      query = query.where('source_type', '=', filter.sourceType);
    }
    if (filter.sourceId) {
      query = query.where('source_id', '=', filter.sourceId);
    }
    return query.execute();
  }

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    const scope = await this.access.officeScope(currentUser, PERMISSION_CODES.facebookManage);
    if (!covers(scope, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền đăng nội dung của đơn vị này lên Fanpage');
    }
  }

  // Gọi Facebook và ghi kết quả; lỗi của Facebook không ném ra mà ghi vào bài đăng để người quản lý thử lại
  private async pageId(database: Database): Promise<string> {
    const facebook = await readIntegration(database, 'facebook');
    const pageId = facebook.config.page_id;
    if (!facebook.enabled || !pageId) {
      throw ruleViolationError('P14-08', 'Nhà trường chưa bật kết nối Fanpage');
    }
    if (!this.publisher.available) {
      throw ruleViolationError('P14-08', 'Máy chủ chưa có khóa truy cập Fanpage');
    }
    return pageId;
  }

  private async attempt(database: Database, source: PostSource, existingId: string | null, origin: ChangeOrigin) {
    const pageId = await this.pageId(database);
    let result: { postId: string } | null = null;
    let error: string | null = null;
    try {
      const photos: FacebookPhoto[] = [];
      for (const photo of source.photos) {
        photos.push({
          fileName: photo.file_name,
          contentType: photo.content_type,
          data: await this.fileStorage.get(photo.storage_key),
        });
      }
      result = await this.publisher.publish({ pageId, message: source.message, photos });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const now = this.clock.now();
    const values = {
      org_unit_id: source.orgUnitId,
      title: source.title,
      message: source.message,
      photo_file_ids: source.photos.map((photo) => photo.file_id),
      excluded_photo_count: source.excludedPhotoCount,
      status: result ? ('posted' as const) : ('failed' as const),
      page_id: pageId,
      provider: this.publisher.provider,
      external_post_id: result?.postId ?? null,
      last_error: error,
      posted_by: origin.actorUserId,
      posted_at: result ? now : null,
    };
    return database.transaction().execute(async (transaction) => {
      const saved = existingId
        ? await transaction
            .updateTable('facebook_posts')
            .set((expression) => ({
              ...values,
              attempt_count: expression('attempt_count', '+', 1),
              updated_at: now,
            }))
            .where('id', '=', existingId)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('facebook_posts')
            .values({ ...values, source_type: source.sourceType, source_id: source.id, attempt_count: 1 })
            .returningAll()
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: source.orgUnitId,
        entityName: 'facebook_posts',
        entityId: saved.id,
        action: existingId ? 'update' : 'create',
        before: null,
        after: {
          source_type: source.sourceType,
          source_id: source.id,
          status: saved.status,
          external_post_id: saved.external_post_id,
          last_error: saved.last_error,
          photo_count: saved.photo_file_ids.length,
          excluded_photo_count: saved.excluded_photo_count,
        },
      });
      return saved;
    });
  }

  private async loadSource(database: Database, sourceType: FacebookPostSourceType, id: string): Promise<PostSource> {
    if (sourceType === 'activity') {
      const activity = await database
        .selectFrom('activities')
        .select(['id', 'org_unit_id', 'title', 'content', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!activity) {
        throw notFoundError('Không tìm thấy hoạt động', 'activity');
      }
      if (activity.status !== 'published') {
        throw ruleViolationError('BR-64', 'Chỉ đăng lên Fanpage hoạt động đã duyệt và đang công bố');
      }
      const media = await database
        .selectFrom('activity_media')
        .innerJoin('files', 'files.id', 'activity_media.file_id')
        .select([
          'activity_media.id',
          'files.id as file_id',
          'files.file_name',
          'files.content_type',
          'files.storage_key',
        ])
        .where('activity_media.activity_id', '=', id)
        .orderBy('activity_media.order_no')
        .execute();
      const blocked = new Set(
        media.length
          ? (
              await database
                .selectFrom('activity_media_children')
                .innerJoin('children', 'children.id', 'activity_media_children.child_id')
                .select('activity_media_children.media_id')
                .where(
                  'activity_media_children.media_id',
                  'in',
                  media.map((item) => item.id),
                )
                .where('children.photo_consent', '<>', 'granted')
                .execute()
            ).map((row) => row.media_id)
          : [],
      );
      const photos = media.filter((item) => !blocked.has(item.id));
      return {
        sourceType,
        id,
        orgUnitId: activity.org_unit_id,
        title: activity.title,
        message: `${activity.title}\n\n${activity.content}`,
        photos,
        excludedPhotoCount: media.length - photos.length,
      };
    }
    const news = await database
      .selectFrom('news')
      .leftJoin('files', 'files.id', 'news.cover_file_id')
      .select([
        'news.id',
        'news.org_unit_id',
        'news.title',
        'news.summary',
        'news.content',
        'news.status',
        'news.scope_type',
        'files.id as file_id',
        'files.file_name',
        'files.content_type',
        'files.storage_key',
      ])
      .where('news.id', '=', id)
      .executeTakeFirst();
    if (!news) {
      throw notFoundError('Không tìm thấy tin tức', 'news');
    }
    if (news.status !== 'published') {
      throw ruleViolationError('BR-64', 'Chỉ đăng lên Fanpage tin tức đang công bố');
    }
    if (news.scope_type !== 'school' && news.scope_type !== 'unit') {
      throw ruleViolationError('P14-08', 'Tin tức gửi riêng cho lớp hoặc trẻ không đăng công khai lên Fanpage');
    }
    const photos =
      news.file_id && news.file_name && news.content_type && news.storage_key
        ? [
            {
              file_id: news.file_id,
              file_name: news.file_name,
              content_type: news.content_type,
              storage_key: news.storage_key,
            },
          ]
        : [];
    return {
      sourceType,
      id,
      orgUnitId: news.org_unit_id,
      title: news.title,
      message: `${news.title}\n\n${news.summary ? `${news.summary}\n\n` : ''}${news.content}`,
      photos,
      excludedPhotoCount: 0,
    };
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

@Controller()
export class FacebookPostsController {
  constructor(private readonly service: FacebookPostsService) {}

  @Get('facebook-posts')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.list(currentUser, {
      sourceType: optionalEnumQuery(query.source_type, 'source_type', ['activity', 'news'] as const),
      sourceId: optionalUuidQuery(query.source_id, 'source_id'),
    });
  }

  @Post('activities/:id/facebook-post')
  @HttpCode(201)
  postActivity(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.post(currentUser, 'activity', id, originOf(request, currentUser));
  }

  @Post('news/:id/facebook-post')
  @HttpCode(201)
  postNews(
    @Param('id', uuidParameter('Mã tin tức không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.post(currentUser, 'news', id, originOf(request, currentUser));
  }

  @Post('facebook-posts/:id/retry')
  @HttpCode(200)
  retry(
    @Param('id', uuidParameter('Mã bài đăng không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.retry(currentUser, id, originOf(request, currentUser));
  }
}
