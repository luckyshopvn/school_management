import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ContentScopeType, ContentStatus, SchoolYearDatabase } from '@school-management/database';
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
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds } from '../finance/receivables.js';
import {
  ActivityAccess,
  audienceCondition,
  check,
  covers,
  inAudience,
  MAXIMUM_CONTENT,
  NO_ID,
  readReason,
  readScope,
  readText,
  type AudienceScope,
} from './activity-access.js';

// Tin tức (P14-05), nội dung thư viện (P14-06), hình tô màu (P14-09), album thư viện (P14-12) theo phạm vi công bố toàn
// trường, đơn vị, lớp hoặc từng trẻ (BR-69; YCTD-78). Tin tức do quản lý đơn vị soạn và công bố; thư viện, hình tô màu do
// quản lý đơn vị hoặc giáo viên; giáo viên chỉ công bố cho lớp hoặc trẻ của lớp mình được phân công. Ẩn nội dung đã công bố
// phải nhập lý do
export type PublishableTable = 'news' | 'library_items' | 'coloring_pages';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const PERMISSIONS: Record<PublishableTable, string> = {
  news: PERMISSION_CODES.contentManage,
  library_items: PERMISSION_CODES.libraryManage,
  coloring_pages: PERMISSION_CODES.libraryManage,
};
const LABELS: Record<PublishableTable, string> = {
  news: 'tin tức',
  library_items: 'nội dung thư viện',
  coloring_pages: 'hình tô màu',
};
const STATUSES: ContentStatus[] = ['draft', 'published', 'hidden'];

interface PublishableRow {
  id: string;
  org_unit_id: string;
  title: string;
  scope_type: ContentScopeType;
  scope_id: string | null;
  status: ContentStatus;
  created_by: string;
}

type ContentInput = Record<string, string | null | undefined> & {
  scope_type?: ContentScopeType;
  scope_id?: string | null;
};

@Injectable()
export class ContentService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly clock: Clock,
  ) {}

  async create(
    currentUser: CurrentUser,
    table: PublishableTable,
    orgUnitId: string,
    input: ContentInput,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertStaff(
      currentUser,
      PERMISSIONS[table],
      orgUnitId,
      `Bạn không có quyền quản lý ${LABELS[table]} của đơn vị này`,
    );
    await this.assertScope(
      database,
      currentUser,
      table,
      orgUnitId,
      input.scope_type ?? 'unit',
      input.scope_id ?? orgUnitId,
    );
    await this.assertReferences(database, orgUnitId, input);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto(table as 'news')
        .values({
          ...(input as Record<string, unknown>),
          org_unit_id: orgUnitId,
          scope_type: input.scope_type ?? 'unit',
          scope_id: input.scope_type === undefined ? orgUnitId : (input.scope_id ?? null),
          status: 'draft',
          created_by: currentUser.id,
        } as never)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: table,
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(
    currentUser: CurrentUser,
    table: PublishableTable,
    id: string,
    input: ContentInput,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findManaged(database, currentUser, table, id);
    if (input.scope_type !== undefined) {
      await this.assertScope(
        database,
        currentUser,
        table,
        existing.org_unit_id,
        input.scope_type,
        input.scope_id ?? null,
      );
    }
    await this.assertReferences(database, existing.org_unit_id, input);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable(table as 'news')
        .set({ ...(input as Record<string, unknown>), updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: table,
        entityId: id,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async publish(currentUser: CurrentUser, table: PublishableTable, id: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findManaged(database, currentUser, table, id);
    if (existing.status === 'published') {
      throw ruleViolationError('BR-69', `${capitalize(LABELS[table])} đã công bố`);
    }
    return this.changeStatus(existing, table, origin, {
      status: 'published',
      published_at: this.clock.now(),
      published_by: currentUser.id,
      hidden_reason: null,
      hidden_by: null,
      hidden_at: null,
    });
  }

  async hide(currentUser: CurrentUser, table: PublishableTable, id: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.findManaged(database, currentUser, table, id);
    if (existing.status !== 'published') {
      throw ruleViolationError('BR-69', `Chỉ ẩn ${LABELS[table]} đã công bố`);
    }
    return this.changeStatus(existing, table, origin, {
      status: 'hidden',
      hidden_reason: reason,
      hidden_by: currentUser.id,
      hidden_at: this.clock.now(),
    });
  }

  // Người quản lý thấy mọi trạng thái trong phạm vi đơn vị; người khác thấy nội dung đã công bố trong phạm vi xem
  async list(
    currentUser: CurrentUser,
    table: PublishableTable,
    filter: { orgUnitId: string | null; status: ContentStatus | null; childId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const managed = await this.access.staffScope(currentUser, PERMISSIONS[table]);
    const audience = await this.audienceFor(database, currentUser, filter.childId);
    let query = database
      .selectFrom(table as 'news')
      .selectAll()
      .where((expression) =>
        expression.or([
          ...(filter.childId
            ? []
            : managed.wholeSchool
              ? [expression.lit(true)]
              : [expression('org_unit_id', 'in', managed.orgUnitIds.length ? managed.orgUnitIds : [NO_ID])]),
          expression.and([expression('status', '=', 'published'), audienceCondition(audience)(expression)]),
        ]),
      );
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    const rows = await query.orderBy('published_at', 'desc').orderBy('created_at', 'desc').limit(200).execute();
    return rows.map((row) => ({ ...row, can_manage: covers(managed, row.org_unit_id) }));
  }

  async read(currentUser: CurrentUser, table: PublishableTable, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom(table as 'news')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError(`Không tìm thấy ${LABELS[table]}`, table);
    }
    await this.assertCanView(database, currentUser, table, row);
    return row;
  }

  async assertCanView(database: Executor, currentUser: CurrentUser, table: PublishableTable, row: PublishableRow) {
    if (await this.access.canStaff(currentUser, PERMISSIONS[table], row.org_unit_id)) {
      return 'manage' as const;
    }
    if (
      row.status === 'published' &&
      inAudience(await this.access.audience(database, currentUser), row.scope_type, row.scope_id)
    ) {
      return 'audience' as const;
    }
    throw new ApplicationError('ERR_FORBIDDEN', `Bạn không có quyền xem ${LABELS[table]} này`);
  }

  async findRow(database: Executor, table: PublishableTable, id: string): Promise<PublishableRow> {
    const row = await database
      .selectFrom(table as 'news')
      .select(['id', 'org_unit_id', 'title', 'scope_type', 'scope_id', 'status', 'created_by'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError(`Không tìm thấy ${LABELS[table]}`, table);
    }
    return row;
  }

  // Phạm vi xem của phụ huynh khi lọc theo một trẻ: chỉ đơn vị, lớp và trẻ đó
  private async audienceFor(
    database: Executor,
    currentUser: CurrentUser,
    childId: string | null,
  ): Promise<AudienceScope> {
    const audience = await this.access.audience(database, currentUser);
    if (!childId) {
      return audience;
    }
    const child = (await this.access.guardianChildren(database, currentUser)).find((row) => row.child_id === childId);
    if (!child) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ xem theo trẻ');
    }
    return {
      wholeSchool: false,
      unitIds: [child.org_unit_id],
      classIds: child.class_id ? [child.class_id] : [],
      childIds: [childId],
    };
  }

  // Người quản lý của đơn vị; giáo viên chỉ sửa nội dung do mình tạo
  private async findManaged(database: Executor, currentUser: CurrentUser, table: PublishableTable, id: string) {
    const row = await this.findRow(database, table, id);
    await this.access.assertStaff(
      currentUser,
      PERMISSIONS[table],
      row.org_unit_id,
      `Bạn không có quyền quản lý ${LABELS[table]} này`,
    );
    if (
      !(await this.access.canOffice(currentUser, PERMISSIONS[table], row.org_unit_id)) &&
      row.created_by !== currentUser.id
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', `Bạn chỉ sửa được ${LABELS[table]} do mình tạo`);
    }
    return row;
  }

  // BR-69: toàn trường cần phạm vi toàn trường; đơn vị là đơn vị của nội dung; lớp, trẻ thuộc đơn vị. Giáo viên (không có
  // quyền văn phòng ở đơn vị) chỉ chọn lớp được phân công hoặc trẻ của lớp đó
  private async assertScope(
    database: Executor,
    currentUser: CurrentUser,
    table: PublishableTable,
    orgUnitId: string,
    scopeType: ContentScopeType,
    scopeId: string | null,
  ) {
    const office = await this.access.officeScope(currentUser, PERMISSIONS[table]);
    const isOffice = covers(office, orgUnitId);
    const deny = (message: string) => {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    };
    if (scopeType === 'school') {
      if (!office.wholeSchool) {
        deny('Chỉ người có phạm vi toàn trường công bố cho toàn trường');
      }
      return;
    }
    if (scopeType === 'unit') {
      if (scopeId !== orgUnitId) {
        throw validationError([{ field: 'scope_id', message: 'Phạm vi đơn vị phải là đơn vị của nội dung' }]);
      }
      if (!isOffice) {
        deny('Giáo viên chỉ công bố cho lớp hoặc trẻ của lớp mình');
      }
      return;
    }
    const classId =
      scopeType === 'class'
        ? (
            await database
              .selectFrom('classes')
              .select(['id', 'org_unit_id'])
              .where('id', '=', scopeId ?? NO_ID)
              .executeTakeFirst()
          )?.id && scopeId
        : (
            await database
              .selectFrom('children')
              .leftJoin('class_enrollments', (join) =>
                join
                  .onRef('class_enrollments.child_id', '=', 'children.id')
                  .on('class_enrollments.is_current', '=', true),
              )
              .select(['children.org_unit_id', 'class_enrollments.class_id'])
              .where('children.id', '=', scopeId ?? NO_ID)
              .where('children.org_unit_id', '=', orgUnitId)
              .executeTakeFirst()
          )?.class_id;
    const scopeUnit =
      scopeType === 'class'
        ? (
            await database
              .selectFrom('classes')
              .select('org_unit_id')
              .where('id', '=', scopeId ?? NO_ID)
              .executeTakeFirst()
          )?.org_unit_id
        : orgUnitId;
    if (!classId && scopeType === 'class') {
      throw validationError([{ field: 'scope_id', message: 'Không tìm thấy lớp' }]);
    }
    if (scopeUnit !== orgUnitId) {
      throw validationError([{ field: 'scope_id', message: 'Lớp hoặc trẻ phải thuộc đơn vị của nội dung' }]);
    }
    if (scopeType === 'child' && classId === undefined) {
      throw validationError([{ field: 'scope_id', message: 'Không tìm thấy trẻ trong đơn vị' }]);
    }
    if (!isOffice && !(await this.access.teacherClassIds(database, currentUser)).includes(classId ?? '')) {
      deny('Giáo viên chỉ công bố cho lớp hoặc trẻ của lớp mình');
    }
  }

  // Tệp phải là tệp nội dung của đơn vị; danh mục, chủ đề, album thuộc đơn vị hoặc Trường chính
  private async assertReferences(database: Executor, orgUnitId: string, input: ContentInput) {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    const units = [orgUnitId, root?.id ?? orgUnitId];
    for (const field of ['file_id', 'cover_file_id']) {
      const fileId = input[field];
      if (fileId) {
        const file = await database
          .selectFrom('files')
          .select('id')
          .where('id', '=', fileId)
          .where('purpose', '=', 'content_file')
          .where('org_unit_id', '=', orgUnitId)
          .executeTakeFirst();
        if (!file) {
          throw validationError([{ field, message: 'Tệp không có hoặc không thuộc đơn vị' }]);
        }
      }
    }
    for (const [field, table] of [
      ['category_id', 'news_categories'],
      ['topic_id', 'library_topics'],
    ] as const) {
      const value = input[field];
      if (value) {
        const found = await database
          .selectFrom(table)
          .select('id')
          .where('id', '=', value)
          .where('org_unit_id', 'in', units)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!found) {
          throw validationError([{ field, message: 'Danh mục hoặc chủ đề không có hoặc đã ngừng dùng' }]);
        }
      }
    }
    if (input.album_id) {
      const album = await database
        .selectFrom('library_albums')
        .select('id')
        .where('id', '=', input.album_id)
        .where('org_unit_id', '=', orgUnitId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!album) {
        throw validationError([{ field: 'album_id', message: 'Album không có hoặc đã ngừng dùng' }]);
      }
    }
  }

  private async changeStatus(
    existing: PublishableRow,
    table: PublishableTable,
    origin: ChangeOrigin,
    changes: Partial<{
      status: ContentStatus;
      published_at: Date;
      published_by: string;
      hidden_reason: string | null;
      hidden_by: string | null;
      hidden_at: Date | null;
    }>,
  ) {
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable(table as 'news')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (table === 'news' && changes.status === 'published') {
        await queueNotification(transaction, {
          orgUnitId: existing.org_unit_id,
          templateCode: 'news_published',
          title: 'Nhà trường có tin mới',
          body: existing.title,
          targetType: 'news',
          targetId: existing.id,
          recipients: await audienceRecipients(transaction, existing.scope_type, existing.scope_id),
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: table,
        entityId: existing.id,
        action: 'update',
        before: { status: existing.status },
        after: changes,
      });
      return updated;
    });
  }
}

// Phụ huynh nhận thông báo theo phạm vi công bố: theo vai trò phụ huynh ở đơn vị, hoặc phụ huynh của lớp, của trẻ
async function audienceRecipients(
  transaction: Transaction<SchoolYearDatabase>,
  scopeType: ContentScopeType,
  scopeId: string | null,
): Promise<NotificationRecipient[]> {
  if (scopeType === 'school' || scopeType === 'unit') {
    const units =
      scopeType === 'unit'
        ? [scopeId ?? NO_ID]
        : (await transaction.selectFrom('org_units').select('id').where('status', '=', 'active').execute()).map(
            (row) => row.id,
          );
    return units.map((orgUnitId) => ({ roleCode: 'VT-14', orgUnitId, channel: 'in_app' as const }));
  }
  const childIds =
    scopeType === 'child'
      ? [scopeId ?? NO_ID]
      : (
          await transaction
            .selectFrom('class_enrollments')
            .select('child_id')
            .where('class_id', '=', scopeId ?? NO_ID)
            .where('is_current', '=', true)
            .execute()
        ).map((row) => row.child_id);
  const userIds = new Set<string>();
  for (const childId of childIds) {
    (await guardianUserIds(transaction, childId)).forEach((id) => userIds.add(id));
  }
  return [...userIds].map((userId) => ({ userId, channel: 'in_app' as const }));
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Trường riêng của từng loại nội dung
const FIELDS: Record<PublishableTable, Array<{ name: string; kind: 'text' | 'long' | 'uuid'; required?: boolean }>> = {
  news: [
    { name: 'title', kind: 'text', required: true },
    { name: 'summary', kind: 'text' },
    { name: 'content', kind: 'long', required: true },
    { name: 'category_id', kind: 'uuid' },
    { name: 'cover_file_id', kind: 'uuid' },
  ],
  library_items: [
    { name: 'title', kind: 'text', required: true },
    { name: 'description', kind: 'long' },
    { name: 'age_group', kind: 'text' },
    { name: 'topic_id', kind: 'uuid' },
    { name: 'album_id', kind: 'uuid' },
    { name: 'file_id', kind: 'uuid' },
  ],
  coloring_pages: [
    { name: 'title', kind: 'text', required: true },
    { name: 'topic', kind: 'text' },
    { name: 'age_group', kind: 'text' },
    { name: 'file_id', kind: 'uuid', required: true },
  ],
};

function readContentInput(
  table: PublishableTable,
  body: RequestBody,
  errors: FieldError[],
  creating: boolean,
): ContentInput {
  const input: ContentInput = {};
  for (const field of FIELDS[table]) {
    const required = creating && field.required === true;
    let value: string | null | undefined;
    if (field.kind === 'uuid') {
      value = required
        ? readRequiredUuid(body, field.name, errors, 'Bắt buộc chọn')
        : readOptionalUuid(body, field.name, errors);
    } else {
      value = readText(body, field.name, errors, { required, maximum: field.kind === 'long' ? MAXIMUM_CONTENT : 300 });
    }
    if (!creating && field.required && body?.[field.name] !== undefined && !value) {
      errors.push({ field: field.name, message: 'Bắt buộc nhập' });
    }
    if (value !== undefined) {
      input[field.name] = value;
    }
  }
  const scope = readScope(body, errors, false);
  if (scope) {
    input.scope_type = scope.scope_type;
    input.scope_id = scope.scope_id;
  }
  return input;
}

function publishableController(path: string, table: PublishableTable) {
  @Controller(path)
  class PublishableController {
    constructor(readonly content: ContentService) {}

    @Get()
    list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
      for (const field of ['org_unit_id', 'child_id']) {
        if (query[field] !== undefined && !isUuid(query[field])) {
          throw validationError([{ field, message: 'Mã không hợp lệ' }]);
        }
      }
      const status = query.status as ContentStatus | undefined;
      if (status !== undefined && !STATUSES.includes(status)) {
        throw validationError([{ field: 'status', message: 'Trạng thái là draft, published hoặc hidden' }]);
      }
      return this.content.list(currentUser, table, {
        orgUnitId: query.org_unit_id ?? null,
        status: status ?? null,
        childId: query.child_id ?? null,
      });
    }

    @Get(':id')
    read(@Param('id', uuidParameter('Mã không hợp lệ')) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
      return this.content.read(currentUser, table, id);
    }

    @Post()
    @HttpCode(201)
    create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
      const errors: FieldError[] = [];
      const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
      const input = readContentInput(table, body, errors, true);
      check(errors);
      return this.content.create(currentUser, table, orgUnitId, input, originOf(request, currentUser));
    }

    @Patch(':id')
    update(
      @Param('id', uuidParameter('Mã không hợp lệ')) id: string,
      @Body() body: RequestBody,
      @Req() request: Request,
      @AuthenticatedUser() currentUser: CurrentUser,
    ) {
      const errors: FieldError[] = [];
      const input = readContentInput(table, body, errors, false);
      check(errors);
      return this.content.update(currentUser, table, id, input, originOf(request, currentUser));
    }

    @Post(':id/publish')
    @HttpCode(200)
    publish(
      @Param('id', uuidParameter('Mã không hợp lệ')) id: string,
      @Req() request: Request,
      @AuthenticatedUser() currentUser: CurrentUser,
    ) {
      return this.content.publish(currentUser, table, id, originOf(request, currentUser));
    }

    @Post(':id/hide')
    @HttpCode(200)
    hide(
      @Param('id', uuidParameter('Mã không hợp lệ')) id: string,
      @Body() body: RequestBody,
      @Req() request: Request,
      @AuthenticatedUser() currentUser: CurrentUser,
    ) {
      return this.content.hide(currentUser, table, id, readReason(body), originOf(request, currentUser));
    }
  }
  return PublishableController;
}

export const NewsController = publishableController('news', 'news');
export const LibraryItemsController = publishableController('library-items', 'library_items');
export const ColoringPagesController = publishableController('coloring-pages', 'coloring_pages');

// Album thư viện (P14-12): người quản lý thư viện của đơn vị lập; người xem thấy album đang dùng có nội dung đã công bố
@Injectable()
export class LibraryAlbumsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const managed = await this.access.staffScope(currentUser, PERMISSION_CODES.libraryManage);
    const audience = await this.access.audience(database, currentUser);
    let query = database
      .selectFrom('library_albums')
      .selectAll('library_albums')
      .select((expression) =>
        expression
          .selectFrom('library_items')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('library_items.album_id', '=', 'library_albums.id')
          .where('library_items.status', '=', 'published')
          .where(audienceCondition(audience) as never)
          .as('published_item_count'),
      )
      .where((expression) =>
        expression.or([
          managed.wholeSchool
            ? expression.lit(true)
            : expression('library_albums.org_unit_id', 'in', managed.orgUnitIds.length ? managed.orgUnitIds : [NO_ID]),
          expression.and([
            expression('library_albums.status', '=', 'active'),
            expression.exists(
              expression
                .selectFrom('library_items')
                .select('library_items.id')
                .whereRef('library_items.album_id', '=', 'library_albums.id')
                .where('library_items.status', '=', 'published')
                .where(audienceCondition(audience) as never),
            ),
          ]),
        ]),
      );
    if (orgUnitId) {
      query = query.where('library_albums.org_unit_id', '=', orgUnitId);
    }
    const rows = await query.orderBy('library_albums.created_at', 'desc').execute();
    return rows.map((row) => ({
      ...row,
      published_item_count: Number(row.published_item_count ?? 0),
      can_manage: covers(managed, row.org_unit_id),
    }));
  }

  async create(
    currentUser: CurrentUser,
    input: { org_unit_id: string; title: string; topic_id: string | null; cover_file_id: string | null },
    origin: ChangeOrigin,
  ) {
    await this.access.assertStaff(
      currentUser,
      PERMISSION_CODES.libraryManage,
      input.org_unit_id,
      'Bạn không có quyền quản lý thư viện của đơn vị này',
    );
    const { database } = await this.currentSchoolYear.require();
    await this.assertAlbumReferences(database, input.org_unit_id, input);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('library_albums')
        .values({ ...input, created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'library_albums',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    input: { title?: string; topic_id?: string | null; cover_file_id?: string | null; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database.selectFrom('library_albums').selectAll().where('id', '=', id).executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy album', 'library_album');
    }
    await this.access.assertStaff(
      currentUser,
      PERMISSION_CODES.libraryManage,
      existing.org_unit_id,
      'Bạn không có quyền quản lý thư viện của đơn vị này',
    );
    await this.assertAlbumReferences(database, existing.org_unit_id, input);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('library_albums')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'library_albums',
        entityId: id,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  private async assertAlbumReferences(
    database: Executor,
    orgUnitId: string,
    input: { topic_id?: string | null; cover_file_id?: string | null },
  ) {
    if (input.cover_file_id) {
      const file = await database
        .selectFrom('files')
        .select('id')
        .where('id', '=', input.cover_file_id)
        .where('purpose', '=', 'content_file')
        .where('org_unit_id', '=', orgUnitId)
        .executeTakeFirst();
      if (!file) {
        throw validationError([{ field: 'cover_file_id', message: 'Tệp không có hoặc không thuộc đơn vị' }]);
      }
    }
    if (input.topic_id) {
      const root = await database
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      const topic = await database
        .selectFrom('library_topics')
        .select('id')
        .where('id', '=', input.topic_id)
        .where('org_unit_id', 'in', [orgUnitId, root?.id ?? orgUnitId])
        .executeTakeFirst();
      if (!topic) {
        throw validationError([{ field: 'topic_id', message: 'Chủ đề không có' }]);
      }
    }
  }
}

@Controller('library-albums')
export class LibraryAlbumsController {
  constructor(private readonly albums: LibraryAlbumsService) {}

  @Get()
  list(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.albums.list(currentUser, orgUnitId ?? null);
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      title: readText(body, 'title', errors, { required: true }) ?? '',
      topic_id: readOptionalUuid(body, 'topic_id', errors) ?? null,
      cover_file_id: readOptionalUuid(body, 'cover_file_id', errors) ?? null,
    };
    check(errors);
    return this.albums.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  update(
    @Param('id', uuidParameter('Mã album không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input: { title?: string; topic_id?: string | null; cover_file_id?: string | null; status?: RecordStatus } =
      {};
    const title = readText(body, 'title', errors);
    if (title) {
      input.title = title;
    }
    const topic = readOptionalUuid(body, 'topic_id', errors);
    if (topic !== undefined) {
      input.topic_id = topic;
    }
    const cover = readOptionalUuid(body, 'cover_file_id', errors);
    if (cover !== undefined) {
      input.cover_file_id = cover;
    }
    const status = readStatus(body, errors);
    if (status) {
      input.status = status;
    }
    check(errors);
    return this.albums.update(currentUser, id, input, originOf(request, currentUser));
  }
}
