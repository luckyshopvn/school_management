import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ActivityStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds } from '../finance/receivables.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import {
  ActivityAccess,
  check,
  covers,
  MAXIMUM_CONTENT,
  NO_ID,
  readDate,
  readReason,
  readText,
} from './activity-access.js';
import { decodeFileName, sendStoredFile, storeContentFile, type UploadedPart } from './content-files.js';

// Hoạt động của lớp, duyệt và công bố, hình ảnh kèm gắn thẻ trẻ, lượt thích (P14-01, P14-02, P14-04; QT-10; BR-64, BR-65;
// Q-71, Q-72; YCTD-78). Giáo viên được phân công lớp tạo hoạt động ở trạng thái chờ duyệt (hoặc lưu nháp); quản lý đơn vị
// hoặc Ban Giám hiệu duyệt thì công bố cho phụ huynh của lớp. Hình có trẻ chưa đồng ý hình ảnh được cảnh báo khi tải và
// không hiển thị cho phụ huynh; phụ huynh rút đồng ý thì hình đã công bố có trẻ đó tự ẩn vì điều kiện xét lúc đọc
export const MAXIMUM_ACTIVITY_PHOTOS = 30;
const EDITABLE: ActivityStatus[] = ['draft', 'pending', 'rejected'];
const STATUSES: ActivityStatus[] = ['draft', 'pending', 'published', 'rejected', 'hidden'];

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

interface ActivityRow {
  id: string;
  org_unit_id: string;
  class_id: string;
  category_id: string;
  title: string;
  status: ActivityStatus;
  created_by: string;
}

export interface ActivityMediaView {
  id: string;
  caption: string | null;
  file_name: string;
  child_ids: string[];
  // Trẻ được gắn thẻ chưa đồng ý hình ảnh; hình không hiển thị cho phụ huynh (BR-65)
  unconsented_children: Array<{ id: string; full_name: string }>;
  excluded: boolean;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async create(
    currentUser: CurrentUser,
    input: {
      class_id: string;
      category_id: string;
      title: string;
      content: string;
      activity_date: string;
      draft: boolean;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.assertCreator(database, currentUser, input.class_id);
    await this.assertCategory(database, input.category_id, classRow.org_unit_id);
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('activities')
        .values({
          org_unit_id: classRow.org_unit_id,
          class_id: input.class_id,
          category_id: input.category_id,
          title: input.title,
          content: input.content,
          activity_date: input.activity_date,
          // BR-64: hoạt động do giáo viên tạo ở trạng thái chờ duyệt, trừ khi giáo viên chọn lưu nháp để thêm hình
          status: input.draft ? 'draft' : 'pending',
          submitted_at: input.draft ? null : now,
          created_by: currentUser.id,
          created_by_name: origin.actorName,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (!input.draft) {
        await this.notifyApprovers(transaction, created, classRow.name);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'activities',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Sửa khi chưa công bố (QT-10 E6); hoạt động bị từ chối sửa xong về nháp
  async update(
    currentUser: CurrentUser,
    activityId: string,
    input: { category_id?: string; title?: string; content?: string; activity_date?: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertCreator(database, currentUser, activity.class_id);
    if (!EDITABLE.includes(activity.status)) {
      throw ruleViolationError('BR-64', 'Hoạt động đã công bố, gửi lại trình duyệt để sửa');
    }
    if (input.category_id) {
      await this.assertCategory(database, input.category_id, activity.org_unit_id);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('activities')
        .set({
          ...input,
          ...(activity.status === 'rejected' ? { status: 'draft' as const, reject_reason: null } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', activityId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: activity.org_unit_id,
        entityName: 'activities',
        entityId: activityId,
        action: 'update',
        before: activity,
        after: updated,
      });
      return updated;
    });
  }

  async submit(currentUser: CurrentUser, activityId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    const classRow = await this.assertCreator(database, currentUser, activity.class_id);
    if (activity.status !== 'draft' && activity.status !== 'rejected') {
      throw ruleViolationError('BR-64', 'Chỉ gửi trình duyệt hoạt động nháp hoặc bị từ chối');
    }
    return this.transition(
      activity,
      origin,
      { status: 'pending', submitted_at: this.clock.now(), reject_reason: null },
      async (transaction, updated) => {
        await this.notifyApprovers(transaction, updated, classRow.name);
      },
    );
  }

  async approve(currentUser: CurrentUser, activityId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertApprover(currentUser, activity);
    if (activity.status !== 'pending') {
      throw ruleViolationError('BR-64', 'Chỉ duyệt hoạt động đang chờ duyệt');
    }
    const now = this.clock.now();
    return this.transition(
      activity,
      origin,
      { status: 'published', approved_by: currentUser.id, approved_at: now, published_at: now },
      (transaction) => this.notifyParents(transaction, activity),
    );
  }

  async reject(currentUser: CurrentUser, activityId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertApprover(currentUser, activity);
    if (activity.status !== 'pending') {
      throw ruleViolationError('BR-64', 'Chỉ từ chối hoạt động đang chờ duyệt');
    }
    return this.transition(activity, origin, { status: 'rejected', reject_reason: reason }, (transaction) =>
      this.notifyCreator(transaction, activity, 'activity_rejected', 'Hoạt động bị từ chối', reason),
    );
  }

  // Q-72: ẩn hoạt động đã công bố kèm lý do và công bố lại
  async hide(currentUser: CurrentUser, activityId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertApprover(currentUser, activity);
    if (activity.status !== 'published') {
      throw ruleViolationError('BR-64', 'Chỉ ẩn hoạt động đã công bố');
    }
    return this.transition(
      activity,
      origin,
      { status: 'hidden', hidden_reason: reason, hidden_by: currentUser.id, hidden_at: this.clock.now() },
      (transaction) => this.notifyCreator(transaction, activity, 'activity_hidden', 'Hoạt động đã bị ẩn', reason),
    );
  }

  async republish(currentUser: CurrentUser, activityId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertApprover(currentUser, activity);
    if (activity.status !== 'hidden') {
      throw ruleViolationError('BR-64', 'Chỉ công bố lại hoạt động đã ẩn');
    }
    return this.transition(activity, origin, {
      status: 'published',
      hidden_reason: null,
      hidden_by: null,
      hidden_at: null,
      published_at: this.clock.now(),
    });
  }

  // P14-04: tải ảnh, gắn thẻ trẻ của lớp, cảnh báo trẻ chưa đồng ý hình ảnh (BR-65, QT-10 E5), tối đa 30 ảnh (Q-71)
  async addMedia(
    currentUser: CurrentUser,
    activityId: string,
    input: { part: UploadedPart; childIds: string[]; caption: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertCreator(database, currentUser, activity.class_id);
    if (!EDITABLE.includes(activity.status)) {
      throw ruleViolationError('BR-64', 'Hoạt động đã công bố, gửi lại trình duyệt để thêm hình');
    }
    const count = await database
      .selectFrom('activity_media')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('activity_id', '=', activityId)
      .executeTakeFirstOrThrow();
    if (Number(count.count) >= MAXIMUM_ACTIVITY_PHOTOS) {
      throw ruleViolationError('Q-71', `Mỗi hoạt động tối đa ${MAXIMUM_ACTIVITY_PHOTOS} ảnh`);
    }
    const tagged =
      input.childIds.length > 0
        ? await database
            .selectFrom('children')
            .innerJoin('class_enrollments', (join) =>
              join
                .onRef('class_enrollments.child_id', '=', 'children.id')
                .on('class_enrollments.is_current', '=', true),
            )
            .select(['children.id', 'children.full_name', 'children.photo_consent'])
            .where('children.id', 'in', input.childIds)
            .where('class_enrollments.class_id', '=', activity.class_id)
            .execute()
        : [];
    if (tagged.length !== new Set(input.childIds).size) {
      throw validationError([{ field: 'child_ids', message: 'Chỉ gắn thẻ trẻ đang học trong lớp của hoạt động' }]);
    }
    const order = Number(count.count) + 1;
    const media = await database.transaction().execute(async (transaction) => {
      const file = await storeContentFile(this.fileStorage, transaction, {
        orgUnitId: activity.org_unit_id,
        purpose: 'activity_photo',
        fileName: decodeFileName(input.part),
        body: input.part.buffer,
        createdBy: currentUser.id,
      });
      const created = await transaction
        .insertInto('activity_media')
        .values({
          activity_id: activityId,
          file_id: file.id,
          caption: input.caption,
          order_no: order,
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (tagged.length > 0) {
        await transaction
          .insertInto('activity_media_children')
          .values(tagged.map((child) => ({ media_id: created.id, child_id: child.id })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: activity.org_unit_id,
        entityName: 'activity_media',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { ...created, child_ids: tagged.map((child) => child.id) },
      });
      return { ...created, file_name: file.file_name };
    });
    const unconsented = tagged
      .filter((child) => child.photo_consent !== 'granted')
      .map((child) => ({ id: child.id, full_name: child.full_name }));
    return {
      media: {
        id: media.id,
        caption: media.caption,
        file_name: media.file_name,
        child_ids: tagged.map((child) => child.id),
        unconsented_children: unconsented,
        excluded: unconsented.length > 0,
      },
      warnings: unconsented.map((child) => ({
        child_id: child.id,
        message: `${child.full_name} chưa đồng ý sử dụng hình ảnh; hình này không được công bố cho phụ huynh`,
      })),
    };
  }

  // Gỡ hình khỏi hoạt động chưa công bố, ví dụ hình có trẻ chưa đồng ý; dòng tệp vẫn giữ
  async removeMedia(currentUser: CurrentUser, activityId: string, mediaId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.assertCreator(database, currentUser, activity.class_id);
    if (!EDITABLE.includes(activity.status)) {
      throw ruleViolationError('BR-64', 'Hoạt động đã công bố, gửi lại trình duyệt để sửa hình');
    }
    await database.transaction().execute(async (transaction) => {
      const removed = await transaction
        .deleteFrom('activity_media')
        .where('id', '=', mediaId)
        .where('activity_id', '=', activityId)
        .returningAll()
        .executeTakeFirst();
      if (!removed) {
        throw notFoundError('Không tìm thấy hình của hoạt động', 'activity_media');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: activity.org_unit_id,
        entityName: 'activity_media',
        entityId: mediaId,
        action: 'delete',
        before: removed,
        after: null,
      });
    });
    return this.read(currentUser, activityId);
  }

  async like(currentUser: CurrentUser, activityId: string, liked: boolean) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    await this.viewMode(database, currentUser, activity);
    if (activity.status !== 'published') {
      throw ruleViolationError('BR-64', 'Chỉ thích hoạt động đã công bố');
    }
    if (liked) {
      await database
        .insertInto('activity_likes')
        .values({ activity_id: activityId, user_id: currentUser.id })
        .onConflict((conflict) => conflict.columns(['activity_id', 'user_id']).doNothing())
        .execute();
    } else {
      await database
        .deleteFrom('activity_likes')
        .where('activity_id', '=', activityId)
        .where('user_id', '=', currentUser.id)
        .execute();
    }
    const count = await database
      .selectFrom('activity_likes')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('activity_id', '=', activityId)
      .executeTakeFirstOrThrow();
    return { activity_id: activityId, liked_by_me: liked, like_count: Number(count.count) };
  }

  // Danh sách hoạt động: người duyệt theo đơn vị, giáo viên theo lớp được phân công (mọi trạng thái); phụ huynh chỉ hoạt
  // động đã công bố của lớp con (BR-64, QT-10 E7)
  async list(
    currentUser: CurrentUser,
    filter: { classId: string | null; childId: string | null; status: ActivityStatus | null; orgUnitId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const manageUnits = await this.manageUnits(currentUser);
    const teacherClasses = await this.access.teacherClassIds(database, currentUser);
    const children = await this.access.guardianChildren(database, currentUser);
    let parentClasses = children.map((child) => child.class_id).filter((id): id is string => id !== null);
    if (filter.childId) {
      const child = children.find((row) => row.child_id === filter.childId);
      if (child) {
        parentClasses = child.class_id ? [child.class_id] : [];
      } else {
        // Nhân sự lọc theo trẻ thì lấy lớp hiện tại của trẻ
        const enrollment = await database
          .selectFrom('class_enrollments')
          .select('class_id')
          .where('child_id', '=', filter.childId)
          .where('is_current', '=', true)
          .executeTakeFirst();
        if (!enrollment) {
          return [];
        }
        filter = { ...filter, classId: enrollment.class_id };
        parentClasses = [];
      }
    }
    let query = database
      .selectFrom('activities')
      .innerJoin('classes', 'classes.id', 'activities.class_id')
      .innerJoin('activity_categories', 'activity_categories.id', 'activities.category_id')
      .selectAll('activities')
      .select(['classes.name as class_name', 'activity_categories.name as category_name'])
      .where((expression) =>
        expression.or([
          ...(manageUnits.wholeSchool
            ? [expression.lit(true)]
            : [
                expression(
                  'activities.org_unit_id',
                  'in',
                  manageUnits.orgUnitIds.length ? manageUnits.orgUnitIds : [NO_ID],
                ),
              ]),
          expression('activities.class_id', 'in', teacherClasses.length ? teacherClasses : [NO_ID]),
          expression.and([
            expression('activities.status', '=', 'published'),
            expression('activities.class_id', 'in', parentClasses.length ? parentClasses : [NO_ID]),
          ]),
        ]),
      );
    if (filter.classId) {
      query = query.where('activities.class_id', '=', filter.classId);
    }
    if (filter.status) {
      query = query.where('activities.status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('activities.org_unit_id', '=', filter.orgUnitId);
    }
    const rows = await query
      .orderBy('activities.activity_date', 'desc')
      .orderBy('activities.created_at', 'desc')
      .limit(200)
      .execute();
    const staffView = (row: { org_unit_id: string; class_id: string }) =>
      covers(manageUnits, row.org_unit_id) || teacherClasses.includes(row.class_id);
    return this.decorate(database, currentUser, rows, staffView);
  }

  async read(currentUser: CurrentUser, activityId: string) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await this.findActivity(database, activityId);
    const mode = await this.viewMode(database, currentUser, activity);
    const row = await database
      .selectFrom('activities')
      .innerJoin('classes', 'classes.id', 'activities.class_id')
      .innerJoin('activity_categories', 'activity_categories.id', 'activities.category_id')
      .selectAll('activities')
      .select(['classes.name as class_name', 'activity_categories.name as category_name'])
      .where('activities.id', '=', activityId)
      .executeTakeFirstOrThrow();
    const [decorated] = await this.decorate(database, currentUser, [row], () => mode === 'staff');
    return decorated;
  }

  // Ảnh của hoạt động: nhân sự có quyền xem hoạt động; phụ huynh chỉ ảnh không có trẻ chưa đồng ý của hoạt động đã công bố
  async mediaFile(currentUser: CurrentUser, mediaId: string) {
    const { database } = await this.currentSchoolYear.require();
    const media = await database
      .selectFrom('activity_media')
      .innerJoin('files', 'files.id', 'activity_media.file_id')
      .select([
        'activity_media.id',
        'activity_media.activity_id',
        'files.file_name',
        'files.content_type',
        'files.storage_key',
      ])
      .where('activity_media.id', '=', mediaId)
      .executeTakeFirst();
    if (!media) {
      throw notFoundError('Không tìm thấy hình', 'activity_media');
    }
    const activity = await this.findActivity(database, media.activity_id);
    const mode = await this.viewMode(database, currentUser, activity);
    if (mode === 'parent') {
      const blocked = await database
        .selectFrom('activity_media_children')
        .innerJoin('children', 'children.id', 'activity_media_children.child_id')
        .select('children.id')
        .where('activity_media_children.media_id', '=', mediaId)
        .where('children.photo_consent', '<>', 'granted')
        .executeTakeFirst();
      if (blocked) {
        throw ruleViolationError('BR-65', 'Hình có trẻ chưa đồng ý sử dụng hình ảnh, không được công bố');
      }
    }
    return { file: media, body: await this.fileStorage.get(media.storage_key) };
  }

  // Chế độ xem: staff thấy mọi trạng thái và hình bị loại trừ; parent chỉ thấy hoạt động đã công bố của lớp con
  async viewMode(database: Executor, currentUser: CurrentUser, activity: ActivityRow): Promise<'staff' | 'parent'> {
    if (covers(await this.manageUnits(currentUser), activity.org_unit_id)) {
      return 'staff';
    }
    if ((await this.access.teacherClassIds(database, currentUser)).includes(activity.class_id)) {
      return 'staff';
    }
    const children = await this.access.guardianChildren(database, currentUser);
    if (activity.status === 'published' && children.some((child) => child.class_id === activity.class_id)) {
      return 'parent';
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem hoạt động này');
  }

  async findActivity(database: Executor, activityId: string): Promise<ActivityRow> {
    const activity = await database
      .selectFrom('activities')
      .select(['id', 'org_unit_id', 'class_id', 'category_id', 'title', 'status', 'created_by'])
      .where('id', '=', activityId)
      .executeTakeFirst();
    if (!activity) {
      throw notFoundError('Hoạt động không tồn tại', 'activity');
    }
    return activity;
  }

  // Người duyệt hoặc quản lý nội dung của đơn vị thấy mọi hoạt động của đơn vị
  private async manageUnits(currentUser: CurrentUser) {
    const approve = await this.access.officeScope(currentUser, PERMISSION_CODES.activityApprove);
    const manage = await this.access.officeScope(currentUser, PERMISSION_CODES.contentManage);
    return {
      wholeSchool: approve.wholeSchool || manage.wholeSchool,
      orgUnitIds: [...new Set([...approve.orgUnitIds, ...manage.orgUnitIds])],
    };
  }

  private async decorate<Row extends { id: string; org_unit_id: string; class_id: string }>(
    database: Executor,
    currentUser: CurrentUser,
    rows: Row[],
    staffView: (row: Row) => boolean,
  ) {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const media = await database
      .selectFrom('activity_media')
      .innerJoin('files', 'files.id', 'activity_media.file_id')
      .select([
        'activity_media.id',
        'activity_media.activity_id',
        'activity_media.caption',
        'activity_media.order_no',
        'files.file_name',
      ])
      .where('activity_media.activity_id', 'in', ids)
      .orderBy('activity_media.order_no')
      .execute();
    const tags =
      media.length > 0
        ? await database
            .selectFrom('activity_media_children')
            .innerJoin('children', 'children.id', 'activity_media_children.child_id')
            .select(['activity_media_children.media_id', 'children.id', 'children.full_name', 'children.photo_consent'])
            .where(
              'activity_media_children.media_id',
              'in',
              media.map((row) => row.id),
            )
            .execute()
        : [];
    const likes = await database
      .selectFrom('activity_likes')
      .select(['activity_id', 'user_id'])
      .where('activity_id', 'in', ids)
      .execute();
    const comments = await database
      .selectFrom('content_comments')
      .select(['target_id', 'hidden_at'])
      .where('target_type', '=', 'activity')
      .where('target_id', 'in', ids)
      .execute();
    return rows.map((row) => {
      const staff = staffView(row);
      const items: ActivityMediaView[] = media
        .filter((item) => item.activity_id === row.id)
        .map((item) => {
          const childTags = tags.filter((tag) => tag.media_id === item.id);
          const unconsented = childTags
            .filter((tag) => tag.photo_consent !== 'granted')
            .map((tag) => ({ id: tag.id, full_name: tag.full_name }));
          return {
            id: item.id,
            caption: item.caption,
            file_name: item.file_name,
            child_ids: childTags.map((tag) => tag.id),
            unconsented_children: unconsented,
            excluded: unconsented.length > 0,
          };
        });
      return {
        ...row,
        media: staff
          ? items
          : items
              .filter((item) => !item.excluded)
              .map((item) => ({ ...item, child_ids: [], unconsented_children: [] })),
        like_count: likes.filter((like) => like.activity_id === row.id).length,
        liked_by_me: likes.some((like) => like.activity_id === row.id && like.user_id === currentUser.id),
        comment_count: comments.filter((comment) => comment.target_id === row.id && (staff || !comment.hidden_at))
          .length,
      };
    });
  }

  // Giáo viên có quyền tạo hoạt động và đang được phân công lớp (chủ nhiệm hoặc bộ môn)
  private async assertCreator(database: Executor, currentUser: CurrentUser, classId: string) {
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    if (
      !currentUser.hasPermission(PERMISSION_CODES.activityCreate) ||
      !(await this.access.teacherClassIds(database, currentUser)).includes(classId)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này nên không lập được hoạt động');
    }
    return classRow;
  }

  private async assertCategory(database: Executor, categoryId: string, orgUnitId: string) {
    const category = await database
      .selectFrom('activity_categories')
      .select(['id', 'org_unit_id', 'status'])
      .where('id', '=', categoryId)
      .executeTakeFirst();
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    // Danh mục của đơn vị hoặc của Trường chính dùng chung toàn trường
    if (
      !category ||
      category.status !== 'active' ||
      (category.org_unit_id !== orgUnitId && category.org_unit_id !== root?.id)
    ) {
      throw validationError([{ field: 'category_id', message: 'Danh mục hoạt động không có hoặc đã ngừng dùng' }]);
    }
  }

  // QT-10 E9: người duyệt là quản lý đơn vị hoặc Ban Giám hiệu có phạm vi trên đơn vị của hoạt động
  private async assertApprover(currentUser: CurrentUser, activity: ActivityRow) {
    if (!(await this.access.canOffice(currentUser, PERMISSION_CODES.activityApprove, activity.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt hoạt động của đơn vị này');
    }
  }

  private async transition(
    activity: ActivityRow,
    origin: ChangeOrigin,
    changes: Partial<{
      status: ActivityStatus;
      submitted_at: Date | null;
      approved_by: string | null;
      approved_at: Date | null;
      published_at: Date | null;
      reject_reason: string | null;
      hidden_reason: string | null;
      hidden_by: string | null;
      hidden_at: Date | null;
    }>,
    after?: (transaction: Transaction<SchoolYearDatabase>, updated: ActivityRow) => Promise<void>,
  ) {
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('activities')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', activity.id)
        .where('status', '=', activity.status)
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw new ApplicationError('ERR_CONFLICT', 'Hoạt động vừa được người khác cập nhật, tải lại để xem');
      }
      await after?.(transaction, updated);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: activity.org_unit_id,
        entityName: 'activities',
        entityId: activity.id,
        action: 'update',
        before: { status: activity.status },
        after: changes,
      });
      return updated;
    });
  }

  private async notifyApprovers(
    transaction: Transaction<SchoolYearDatabase>,
    activity: ActivityRow,
    className: string,
  ) {
    await queueNotification(transaction, {
      orgUnitId: activity.org_unit_id,
      templateCode: 'activity_submitted',
      title: 'Có hoạt động chờ duyệt',
      body: `Lớp ${className}: ${activity.title}`,
      targetType: 'activities',
      targetId: activity.id,
      recipients: ['VT-03', 'VT-15'].map((roleCode) => ({
        roleCode,
        orgUnitId: activity.org_unit_id,
        channel: 'in_app' as const,
      })),
    });
  }

  // Phụ huynh của trẻ đang học trong lớp nhận thông báo hoạt động mới (QT-10 bước 8)
  private async notifyParents(transaction: Transaction<SchoolYearDatabase>, activity: ActivityRow) {
    const children = await transaction
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select('children.id')
      .where('class_enrollments.class_id', '=', activity.class_id)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .execute();
    const userIds = new Set<string>();
    for (const child of children) {
      (await guardianUserIds(transaction, child.id)).forEach((id) => userIds.add(id));
    }
    await queueNotification(transaction, {
      orgUnitId: activity.org_unit_id,
      templateCode: 'activity_published',
      title: 'Lớp của con có hoạt động mới',
      body: activity.title,
      targetType: 'activities',
      targetId: activity.id,
      recipients: [...userIds].map((userId) => ({ userId, channel: 'in_app' as const })),
    });
  }

  private async notifyCreator(
    transaction: Transaction<SchoolYearDatabase>,
    activity: ActivityRow,
    templateCode: string,
    title: string,
    reason: string,
  ) {
    await queueNotification(transaction, {
      orgUnitId: activity.org_unit_id,
      templateCode,
      title,
      body: `${activity.title}: ${reason}`,
      targetType: 'activities',
      targetId: activity.id,
      recipients: [{ userId: activity.created_by, channel: 'in_app' }],
    });
  }
}

function readActivityInput(body: RequestBody, errors: FieldError[], required: boolean) {
  const input: { category_id?: string; title?: string; content?: string; activity_date?: string } = {};
  if (required || body?.category_id !== undefined) {
    input.category_id = readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn danh mục hoạt động');
  }
  const title = readText(body, 'title', errors, { required, maximum: 200 });
  if (title) {
    input.title = title;
  } else if (!required && body?.title !== undefined) {
    errors.push({ field: 'title', message: 'Bắt buộc nhập' });
  }
  const content = readText(body, 'content', errors, { required, maximum: MAXIMUM_CONTENT });
  if (content) {
    input.content = content;
  } else if (!required && body?.content !== undefined) {
    errors.push({ field: 'content', message: 'Bắt buộc nhập' });
  }
  const date = readDate(body, 'activity_date', errors, required);
  if (date) {
    input.activity_date = date;
  }
  return input;
}

@Controller()
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post('activities')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const classId = readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp');
    const input = readActivityInput(body, errors, true);
    if (body?.draft !== undefined && typeof body.draft !== 'boolean') {
      errors.push({ field: 'draft', message: 'Phải là true hoặc false' });
    }
    check(errors);
    return this.activities.create(
      currentUser,
      {
        class_id: classId,
        category_id: input.category_id ?? '',
        title: input.title ?? '',
        content: input.content ?? '',
        activity_date: input.activity_date ?? '',
        draft: body?.draft === true,
      },
      originOf(request, currentUser),
    );
  }

  @Get('activities')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    for (const field of ['class_id', 'child_id', 'org_unit_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        throw validationError([{ field, message: 'Mã không hợp lệ' }]);
      }
    }
    const status = query.status as ActivityStatus | undefined;
    if (status !== undefined && !STATUSES.includes(status)) {
      throw validationError([{ field: 'status', message: `Trạng thái là ${STATUSES.join(', ')}` }]);
    }
    return this.activities.list(currentUser, {
      classId: query.class_id ?? null,
      childId: query.child_id ?? null,
      status: status ?? null,
      orgUnitId: query.org_unit_id ?? null,
    });
  }

  @Get('activities/:id')
  read(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.read(currentUser, id);
  }

  @Patch('activities/:id')
  update(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readActivityInput(body, errors, false);
    check(errors);
    return this.activities.update(currentUser, id, input, originOf(request, currentUser));
  }

  @Post('activities/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.submit(currentUser, id, originOf(request, currentUser));
  }

  @Post('activities/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.approve(currentUser, id, originOf(request, currentUser));
  }

  @Post('activities/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.reject(currentUser, id, readReason(body), originOf(request, currentUser));
  }

  @Post('activities/:id/hide')
  @HttpCode(200)
  hide(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.hide(currentUser, id, readReason(body), originOf(request, currentUser));
  }

  @Post('activities/:id/republish')
  @HttpCode(200)
  republish(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.republish(currentUser, id, originOf(request, currentUser));
  }

  @Post('activities/:id/media')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  addMedia(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn ảnh' });
    }
    // Biểu mẫu nhiều phần gửi danh sách trẻ dạng mã cách nhau bởi dấu phẩy
    const raw = body?.child_ids;
    const childIds =
      typeof raw === 'string' && raw.trim() !== ''
        ? raw.split(',').map((value) => value.trim())
        : Array.isArray(raw)
          ? (raw as unknown[]).map(String)
          : [];
    if (childIds.some((value) => !isUuid(value))) {
      errors.push({ field: 'child_ids', message: 'Mã trẻ không hợp lệ' });
    }
    const caption = readText(body, 'caption', errors, { maximum: 500 });
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.activities.addMedia(
      currentUser,
      id,
      { part: file, childIds: [...new Set(childIds)], caption: caption ?? null },
      originOf(request, currentUser),
    );
  }

  @Delete('activities/:id/media/:mediaId')
  removeMedia(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Param('mediaId', uuidParameter('Mã hình không hợp lệ')) mediaId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.removeMedia(currentUser, id, mediaId, originOf(request, currentUser));
  }

  @Get('activity-media/:id/file')
  async mediaFile(
    @Param('id', uuidParameter('Mã hình không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.activities.mediaFile(currentUser, id);
    sendStoredFile(response, file, body);
  }

  @Post('activities/:id/like')
  @HttpCode(200)
  like(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.like(currentUser, id, true);
  }

  @Delete('activities/:id/like')
  unlike(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.activities.like(currentUser, id, false);
  }
}
