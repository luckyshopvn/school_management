import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { WebsiteContentStatus, WebsiteFilePurpose, WebsitePostKind } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  WEBSITE_MAXIMUM_ALBUM_PHOTOS,
  WEBSITE_MAXIMUM_FILE_BYTES,
  WEBSITE_MAXIMUM_IMAGE_BYTES,
  WEBSITE_MAXIMUM_POST_FILES,
  WEBSITE_PAGE_KEYS,
  WEBSITE_POST_KIND_LABELS,
  WEBSITE_STATUS_LABELS,
} from '@school-management/shared';
import type { Response } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';
import { conflictOnDuplicate, notFoundError, type RequestBody } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import {
  escapeLike,
  readBoolean,
  readChoice,
  readDate,
  readText,
  throwIfAny,
} from '../incoming-documents/incoming-fields.js';
import { plainText, sanitizeContent, slugify } from './website-html.js';
import {
  CONTENT_PERMISSIONS,
  detectAttachmentType,
  detectImageType,
  recordEvent,
  requireAny,
  sha256,
  WEBSITE_PERMISSIONS,
  WEBSITE_RULE_CODE,
  type SystemExecutor,
} from './website-support.js';

// Nội dung website trường (DT-18 phần 18f, YCTD-144): tin tức, thông báo, trang giới thiệu và cơ cấu tổ chức, công khai theo
// quy định (Thông tư 09/2024/TT-BGDĐT), thư viện ảnh; luồng soạn, gửi duyệt, duyệt và đăng, trả lại, gỡ; thư liên hệ.
// Quy tắc (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
// - chỉ sửa, đính kèm khi bài ở nháp hoặc đã gỡ; bài chờ duyệt phải trả lại mới sửa; bài đã đăng phải gỡ mới sửa;
// - gửi duyệt cần tiêu đề và nội dung (bài công khai có thể chỉ có tệp đính kèm); album cần ít nhất một ảnh và xác nhận ảnh có
//   trẻ đã được cha mẹ đồng ý đăng công khai;
// - người duyệt đăng bài chờ duyệt, trả lại kèm lý do, gỡ bài đã đăng kèm lý do;
// - chỉ xóa bài, album chưa từng đăng; đã đăng thì chỉ gỡ để còn lịch sử công khai.
// Nội dung HTML lọc theo danh sách thẻ cho phép trước khi lưu (website-html.ts)
const POST_MESSAGE = 'Mã bài không hợp lệ';
const ALBUM_MESSAGE = 'Mã album không hợp lệ';
const FILE_MESSAGE = 'Mã tệp không hợp lệ';
const EDITABLE: WebsiteContentStatus[] = ['draft', 'unpublished'];
const MAXIMUM_BODY = 200_000;
const PAGE_KEYS = new Set<string>(WEBSITE_PAGE_KEYS.map((page) => page.key));
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);
const YEAR_PATTERN = /^\d{4}-\d{4}$/;

type ContentTable = 'website_posts' | 'website_albums';
type TargetType = 'post' | 'album';

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface PostInput {
  kind: WebsitePostKind;
  page_key: string | null;
  disclosure_category: string | null;
  disclosure_year: string | null;
  title: string;
  summary: string | null;
  body_html: string;
  pinned: boolean;
}

export function parsePost(body: RequestBody, kindFallback?: WebsitePostKind): PostInput {
  const errors: FieldError[] = [];
  const kind = kindFallback ?? readChoice<WebsitePostKind>(body, 'kind', WEBSITE_POST_KIND_LABELS, 'news', errors);
  const rawBody = body?.body_html;
  if (rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string') {
    errors.push({ field: 'body_html', message: 'Phải là chữ' });
  }
  const html = typeof rawBody === 'string' ? rawBody : '';
  if (html.length > MAXIMUM_BODY) {
    errors.push({ field: 'body_html', message: 'Nội dung quá dài' });
  }
  const pageKey = kind === 'page' ? readText(body, 'page_key', errors, { required: true, maximum: 50 }) : null;
  if (pageKey && !PAGE_KEYS.has(pageKey)) {
    errors.push({ field: 'page_key', message: 'Chọn trang Giới thiệu hoặc Cơ cấu tổ chức' });
  }
  const category =
    kind === 'disclosure' ? readText(body, 'disclosure_category', errors, { required: true, maximum: 50 }) : null;
  const year = kind === 'disclosure' ? readText(body, 'disclosure_year', errors, { maximum: 9 }) : null;
  if (year && !YEAR_PATTERN.test(year)) {
    errors.push({ field: 'disclosure_year', message: 'Năm học dạng 2026-2027' });
  }
  const input: PostInput = {
    kind,
    page_key: pageKey,
    disclosure_category: category,
    disclosure_year: year,
    title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
    summary: readText(body, 'summary', errors, { maximum: 1000 }),
    body_html: sanitizeContent(html),
    pinned: kind === 'news' || kind === 'announcement' ? readBoolean(body, 'pinned', errors) : false,
  };
  throwIfAny(errors);
  return input;
}

export interface AlbumInput {
  title: string;
  description: string | null;
  event_date: string | null;
}

export function parseAlbum(body: RequestBody): AlbumInput {
  const errors: FieldError[] = [];
  const input = {
    title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
    description: readText(body, 'description', errors, { maximum: 2000 }),
    event_date: readDate(body, 'event_date', errors),
  };
  throwIfAny(errors);
  return input;
}

function readReason(body: RequestBody, field: string): string {
  const errors: FieldError[] = [];
  const reason = readText(body, field, errors, { required: true, maximum: 1000 });
  throwIfAny(errors);
  return reason ?? '';
}

export interface ContentFilter {
  kind: WebsitePostKind | null;
  status: WebsiteContentStatus | null;
  keyword: string | null;
  page: number;
  pageSize: number;
}

export function readContentFilter(query: Record<string, unknown>): ContentFilter {
  const kind = typeof query.kind === 'string' && query.kind in WEBSITE_POST_KIND_LABELS ? query.kind : null;
  const status = typeof query.status === 'string' && query.status in WEBSITE_STATUS_LABELS ? query.status : null;
  const keyword = typeof query.q === 'string' && query.q.trim() ? query.q.trim().slice(0, 200) : null;
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const size = Number.parseInt(String(query.page_size ?? '20'), 10);
  return {
    kind: kind as WebsitePostKind | null,
    status: status as WebsiteContentStatus | null,
    keyword,
    page,
    pageSize: PAGE_SIZES.has(size) ? size : 20,
  };
}

@Injectable()
export class WebsiteContentService {
  // Đọc theo từng lần dùng để đúng trường trong ngữ cảnh ở chế độ nhiều trường (DT-SaaS phần S1a)
  private get system() {
    return this.databases.system;
  }

  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  // ---- Bài viết ----

  async listPosts(filter: ContentFilter) {
    let query = this.system.selectFrom('website_posts');
    if (filter.kind) {
      query = query.where('kind', '=', filter.kind);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.keyword) {
      query = query.where('title', 'ilike', `%${escapeLike(filter.keyword)}%`);
    }
    const total = await query.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirst();
    const items = await query
      .select([
        'id',
        'kind',
        'page_key',
        'disclosure_category',
        'disclosure_year',
        'slug',
        'title',
        'summary',
        'pinned',
        'status',
        'return_note',
        'submitted_at',
        'published_at',
        'published_by_name',
        'unpublished_at',
        'unpublish_reason',
        'is_sample',
        'created_by_name',
        'updated_at',
      ])
      .orderBy('updated_at', 'desc')
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    return { items, total: Number(total?.count ?? 0), page: filter.page, page_size: filter.pageSize };
  }

  async post(id: string) {
    const post = await this.system.selectFrom('website_posts').selectAll().where('id', '=', id).executeTakeFirst();
    if (!post) {
      throw notFoundError('Không tìm thấy bài', 'website_post');
    }
    return { ...post, files: await this.files('post', id), events: await this.events('post', id) };
  }

  async createPost(currentUser: CurrentUser, input: PostInput) {
    await this.assertCategory(input);
    const created = await this.system.transaction().execute(async (transaction) => {
      const row = await conflictOnDuplicate(
        transaction
          .insertInto('website_posts')
          .values({
            ...input,
            slug: slugify(input.title),
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .returning('id')
          .executeTakeFirstOrThrow(),
        'Trang này đã có bài; mở bài đã có để sửa',
        'page_key',
      );
      await recordEvent(transaction, 'post', row.id, 'create', null, currentUser);
      return row;
    });
    return this.post(created.id);
  }

  async updatePost(currentUser: CurrentUser, id: string, body: RequestBody) {
    const current = await this.post(id);
    const input = parsePost(body, current.kind);
    if (current.kind === 'page') {
      input.page_key = current.page_key;
    }
    await this.assertCategory(input);
    await this.system.transaction().execute(async (transaction) => {
      await this.lockEditable(transaction, 'website_posts', id);
      await transaction
        .updateTable('website_posts')
        .set({
          ...input,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await recordEvent(transaction, 'post', id, 'update', null, currentUser);
    });
    return this.post(id);
  }

  async deletePost(currentUser: CurrentUser, id: string) {
    await this.deleteContent(currentUser, 'website_posts', 'post', id);
  }

  async submitPost(currentUser: CurrentUser, id: string) {
    const post = await this.post(id);
    const empty = plainText(post.body_html) === '' && !/<img\b/i.test(post.body_html);
    const hasFiles = post.files.some((file) => file.purpose === 'attachment');
    if (empty && !(post.kind === 'disclosure' && hasFiles)) {
      throw ruleViolationError(WEBSITE_RULE_CODE, 'Bài chưa có nội dung', [
        { field: 'body_html', message: 'Nhập nội dung trước khi gửi duyệt' },
      ]);
    }
    await this.transition(currentUser, 'website_posts', 'post', id, 'submit', null);
    return this.post(id);
  }

  async approvePost(currentUser: CurrentUser, id: string) {
    await this.transition(currentUser, 'website_posts', 'post', id, 'approve', null);
    return this.post(id);
  }

  async returnPost(currentUser: CurrentUser, id: string, note: string) {
    await this.transition(currentUser, 'website_posts', 'post', id, 'return', note);
    return this.post(id);
  }

  async unpublishPost(currentUser: CurrentUser, id: string, reason: string) {
    await this.transition(currentUser, 'website_posts', 'post', id, 'unpublish', reason);
    return this.post(id);
  }

  private async assertCategory(input: PostInput) {
    if (input.kind !== 'disclosure') {
      return;
    }
    const category = await this.system
      .selectFrom('website_disclosure_categories')
      .select('code')
      .where('code', '=', input.disclosure_category ?? '')
      .where('active', '=', true)
      .executeTakeFirst();
    if (!category) {
      throw validationError([{ field: 'disclosure_category', message: 'Chọn nhóm công khai' }]);
    }
  }

  // ---- Album ảnh ----

  async listAlbums(filter: ContentFilter) {
    let query = this.system.selectFrom('website_albums');
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.keyword) {
      query = query.where('title', 'ilike', `%${escapeLike(filter.keyword)}%`);
    }
    const total = await query.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirst();
    const items = await query
      .select((expression) => [
        'website_albums.id',
        'website_albums.slug',
        'website_albums.title',
        'website_albums.event_date',
        'website_albums.status',
        'website_albums.consent_confirmed',
        'website_albums.return_note',
        'website_albums.published_at',
        'website_albums.unpublish_reason',
        'website_albums.is_sample',
        'website_albums.created_by_name',
        'website_albums.updated_at',
        expression
          .selectFrom('website_files')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .where('website_files.owner_type', '=', 'album')
          .whereRef('website_files.owner_id', '=', 'website_albums.id')
          .as('photo_count'),
      ])
      .orderBy('website_albums.updated_at', 'desc')
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    return {
      items: items.map((item) => ({ ...item, photo_count: Number(item.photo_count ?? 0) })),
      total: Number(total?.count ?? 0),
      page: filter.page,
      page_size: filter.pageSize,
    };
  }

  async album(id: string) {
    const album = await this.system.selectFrom('website_albums').selectAll().where('id', '=', id).executeTakeFirst();
    if (!album) {
      throw notFoundError('Không tìm thấy album', 'website_album');
    }
    return { ...album, files: await this.files('album', id), events: await this.events('album', id) };
  }

  async createAlbum(currentUser: CurrentUser, input: AlbumInput) {
    const created = await this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('website_albums')
        .values({
          ...input,
          slug: slugify(input.title),
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await recordEvent(transaction, 'album', row.id, 'create', null, currentUser);
      return row;
    });
    return this.album(created.id);
  }

  async updateAlbum(currentUser: CurrentUser, id: string, input: AlbumInput) {
    await this.album(id);
    await this.system.transaction().execute(async (transaction) => {
      await this.lockEditable(transaction, 'website_albums', id);
      await transaction
        .updateTable('website_albums')
        .set({ ...input, updated_by_name: currentUser.description.full_name, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await recordEvent(transaction, 'album', id, 'update', null, currentUser);
    });
    return this.album(id);
  }

  async deleteAlbum(currentUser: CurrentUser, id: string) {
    await this.deleteContent(currentUser, 'website_albums', 'album', id);
  }

  async submitAlbum(currentUser: CurrentUser, id: string, consent: boolean) {
    const album = await this.album(id);
    if (!album.files.some((file) => file.purpose === 'photo')) {
      throw ruleViolationError(WEBSITE_RULE_CODE, 'Album chưa có ảnh', [
        { field: 'file', message: 'Tải ít nhất một ảnh trước khi gửi duyệt' },
      ]);
    }
    if (!consent) {
      throw ruleViolationError(WEBSITE_RULE_CODE, 'Xác nhận ảnh có trẻ đã được cha mẹ đồng ý đăng công khai', [
        { field: 'consent_confirmed', message: 'Bắt buộc xác nhận trước khi gửi duyệt' },
      ]);
    }
    await this.system
      .updateTable('website_albums')
      .set({ consent_confirmed: true, consent_confirmed_by_name: currentUser.description.full_name })
      .where('id', '=', id)
      .where('status', 'in', EDITABLE)
      .execute();
    await this.transition(currentUser, 'website_albums', 'album', id, 'submit', null);
    return this.album(id);
  }

  async approveAlbum(currentUser: CurrentUser, id: string) {
    await this.transition(currentUser, 'website_albums', 'album', id, 'approve', null);
    return this.album(id);
  }

  async returnAlbum(currentUser: CurrentUser, id: string, note: string) {
    await this.transition(currentUser, 'website_albums', 'album', id, 'return', note);
    return this.album(id);
  }

  async unpublishAlbum(currentUser: CurrentUser, id: string, reason: string) {
    await this.transition(currentUser, 'website_albums', 'album', id, 'unpublish', reason);
    return this.album(id);
  }

  // ---- Luồng duyệt chung ----

  private async lockEditable(executor: SystemExecutor, table: ContentTable, id: string) {
    const row = await (executor as SystemExecutor)
      .selectFrom(table as 'website_posts')
      .select('status')
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy nội dung', table);
    }
    if (!EDITABLE.includes(row.status)) {
      throw ruleViolationError(
        WEBSITE_RULE_CODE,
        row.status === 'pending'
          ? 'Nội dung đang chờ duyệt; người duyệt trả lại thì mới sửa được'
          : 'Nội dung đã đăng; gỡ xuống trước khi sửa',
      );
    }
    return row;
  }

  private async transition(
    currentUser: CurrentUser,
    table: ContentTable,
    target: TargetType,
    id: string,
    action: 'submit' | 'approve' | 'return' | 'unpublish',
    note: string | null,
  ) {
    if (action !== 'submit') {
      requireAny(currentUser, [WEBSITE_PERMISSIONS.approve]);
    }
    const name = currentUser.description.full_name;
    const now = this.clock.now();
    await this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom(table as 'website_posts')
        .select(['status', 'first_published_at'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy nội dung', table);
      }
      const allowed: Record<typeof action, WebsiteContentStatus[]> = {
        submit: EDITABLE,
        approve: ['pending'],
        return: ['pending'],
        unpublish: ['published'],
      };
      if (!allowed[action].includes(row.status)) {
        const messages = {
          submit: 'Chỉ gửi duyệt nội dung nháp hoặc đã gỡ',
          approve: 'Chỉ đăng nội dung đang chờ duyệt',
          return: 'Chỉ trả lại nội dung đang chờ duyệt',
          unpublish: 'Chỉ gỡ nội dung đã đăng',
        };
        throw ruleViolationError(WEBSITE_RULE_CODE, messages[action]);
      }
      const changes =
        action === 'submit'
          ? { status: 'pending' as const, submitted_at: now, submitted_by_name: name, return_note: null }
          : action === 'approve'
            ? {
                status: 'published' as const,
                published_at: now,
                published_by_name: name,
                first_published_at: row.first_published_at ?? now,
                unpublished_at: null,
                unpublished_by_name: null,
                unpublish_reason: null,
              }
            : action === 'return'
              ? { status: 'draft' as const, return_note: note }
              : {
                  status: 'unpublished' as const,
                  unpublished_at: now,
                  unpublished_by_name: name,
                  unpublish_reason: note,
                };
      await transaction
        .updateTable(table as 'website_posts')
        .set({ ...changes, updated_at: now })
        .where('id', '=', id)
        .execute();
      await recordEvent(transaction, target, id, action, note, currentUser);
    });
  }

  private async deleteContent(currentUser: CurrentUser, table: ContentTable, target: TargetType, id: string) {
    const keys = await this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom(table as 'website_posts')
        .select(['status', 'first_published_at', 'title'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy nội dung', table);
      }
      if (row.first_published_at) {
        throw ruleViolationError(WEBSITE_RULE_CODE, 'Nội dung đã từng đăng không xóa được, chỉ gỡ xuống');
      }
      if (row.status === 'pending') {
        throw ruleViolationError(WEBSITE_RULE_CODE, 'Nội dung đang chờ duyệt không xóa được');
      }
      const files = await transaction
        .deleteFrom('website_files')
        .where('owner_type', '=', target)
        .where('owner_id', '=', id)
        .returning('storage_key')
        .execute();
      await transaction
        .deleteFrom(table as 'website_posts')
        .where('id', '=', id)
        .execute();
      await recordEvent(transaction, target, id, 'delete', row.title, currentUser);
      return files.map((file) => file.storage_key);
    });
    for (const key of keys) {
      await this.fileStorage.delete(key).catch(() => undefined);
    }
  }

  // ---- Tệp ----

  private files(owner: TargetType, id: string) {
    return this.system
      .selectFrom('website_files')
      .select(['id', 'purpose', 'file_name', 'content_type', 'size_bytes', 'caption', 'order_no', 'created_at'])
      .where('owner_type', '=', owner)
      .where('owner_id', '=', id)
      .orderBy('order_no')
      .orderBy('created_at')
      .execute();
  }

  private events(target: TargetType, id: string) {
    return this.system
      .selectFrom('website_events')
      .select(['id', 'action', 'note', 'actor_name', 'created_at'])
      .where('target_type', '=', target)
      .where('target_id', '=', id)
      .orderBy('created_at', 'desc')
      .execute();
  }

  // Ảnh bìa, tệp đính kèm của bài; ảnh của album. Ảnh bìa mới thay ảnh bìa cũ
  async addFile(
    currentUser: CurrentUser,
    owner: TargetType,
    id: string,
    purpose: string,
    upload: UploadedPart | undefined,
    caption: string | null,
  ) {
    const allowedPurposes: WebsiteFilePurpose[] = owner === 'post' ? ['cover', 'attachment'] : ['photo'];
    if (!allowedPurposes.includes(purpose as WebsiteFilePurpose)) {
      throw validationError([{ field: 'purpose', message: 'Loại tệp không hợp lệ' }]);
    }
    if (!upload) {
      throw validationError([{ field: 'file', message: 'Chọn tệp' }]);
    }
    const imageOnly = purpose !== 'attachment';
    const limit = imageOnly ? WEBSITE_MAXIMUM_IMAGE_BYTES : WEBSITE_MAXIMUM_FILE_BYTES;
    if (upload.size > limit) {
      throw validationError([{ field: 'file', message: imageOnly ? 'Ảnh tối đa 10 MB' : 'Tệp tối đa 20 MB' }]);
    }
    const fileName = Buffer.from(upload.originalname, 'latin1').toString('utf8').slice(0, 200);
    const contentType = imageOnly ? detectImageType(upload.buffer) : detectAttachmentType(fileName, upload.buffer);
    if (!contentType) {
      throw validationError([
        {
          field: 'file',
          message: imageOnly
            ? 'Ảnh là JPEG, PNG hoặc WebP'
            : 'Tệp là ảnh, PDF, Word (.doc, .docx) hoặc Excel (.xls, .xlsx)',
        },
      ]);
    }
    const table: ContentTable = owner === 'post' ? 'website_posts' : 'website_albums';
    const key = storageKey('website', owner, id, randomUUID());
    await this.fileStorage.put(key, upload.buffer, contentType);
    let replaced: string | undefined;
    try {
      replaced = await this.system.transaction().execute(async (transaction) => {
        await this.lockEditable(transaction, table, id);
        const count = await transaction
          .selectFrom('website_files')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('owner_type', '=', owner)
          .where('owner_id', '=', id)
          .executeTakeFirstOrThrow();
        const maximum = owner === 'post' ? WEBSITE_MAXIMUM_POST_FILES : WEBSITE_MAXIMUM_ALBUM_PHOTOS;
        if (Number(count.count) >= maximum) {
          throw ruleViolationError(
            WEBSITE_RULE_CODE,
            owner === 'post' ? `Mỗi bài tối đa ${maximum} tệp` : `Mỗi album tối đa ${maximum} ảnh`,
          );
        }
        const file = await transaction
          .insertInto('website_files')
          .values({
            owner_type: owner,
            owner_id: id,
            purpose: purpose as WebsiteFilePurpose,
            file_name: fileName,
            content_type: contentType,
            size_bytes: upload.size,
            sha256: sha256(upload.buffer),
            storage_key: key,
            caption,
            order_no: Number(count.count) + 1,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        let oldKey: string | undefined;
        if (purpose === 'cover') {
          const previous = await transaction
            .selectFrom('website_posts')
            .select('cover_file_id')
            .where('id', '=', id)
            .executeTakeFirstOrThrow();
          await transaction.updateTable('website_posts').set({ cover_file_id: file.id }).where('id', '=', id).execute();
          if (previous.cover_file_id) {
            oldKey = (
              await transaction
                .deleteFrom('website_files')
                .where('id', '=', previous.cover_file_id)
                .returning('storage_key')
                .executeTakeFirst()
            )?.storage_key;
          }
        }
        if (owner === 'album') {
          // Ảnh đầu tiên làm ảnh bìa của album
          await transaction
            .updateTable('website_albums')
            .set({ cover_file_id: sql`coalesce(cover_file_id, ${file.id}::uuid)` })
            .where('id', '=', id)
            .execute();
        }
        await recordEvent(transaction, owner, id, 'file_add', fileName, currentUser);
        return oldKey;
      });
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      throw error;
    }
    if (replaced) {
      await this.fileStorage.delete(replaced).catch(() => undefined);
    }
    return owner === 'post' ? this.post(id) : this.album(id);
  }

  async deleteFile(currentUser: CurrentUser, owner: TargetType, id: string, fileId: string) {
    const table: ContentTable = owner === 'post' ? 'website_posts' : 'website_albums';
    const key = await this.system.transaction().execute(async (transaction) => {
      await this.lockEditable(transaction, table, id);
      const file = await transaction
        .deleteFrom('website_files')
        .where('id', '=', fileId)
        .where('owner_type', '=', owner)
        .where('owner_id', '=', id)
        .returning(['storage_key', 'file_name'])
        .executeTakeFirst();
      if (!file) {
        throw notFoundError('Không tìm thấy tệp', 'website_file');
      }
      if (owner === 'album') {
        // Xóa ảnh bìa thì lấy ảnh còn lại đầu tiên làm bìa
        await sql`update website_albums set cover_file_id = (select id from website_files
          where owner_type = 'album' and owner_id = ${id} order by order_no, created_at limit 1)
          where id = ${id} and cover_file_id is null`.execute(transaction);
      }
      await recordEvent(transaction, owner, id, 'file_delete', file.file_name, currentUser);
      return file.storage_key;
    });
    await this.fileStorage.delete(key).catch(() => undefined);
    return owner === 'post' ? this.post(id) : this.album(id);
  }

  async setAlbumCover(currentUser: CurrentUser, id: string, fileId: string) {
    await this.system.transaction().execute(async (transaction) => {
      await this.lockEditable(transaction, 'website_albums', id);
      const file = await transaction
        .selectFrom('website_files')
        .select('id')
        .where('id', '=', fileId)
        .where('owner_type', '=', 'album')
        .where('owner_id', '=', id)
        .executeTakeFirst();
      if (!file) {
        throw notFoundError('Không tìm thấy ảnh', 'website_file');
      }
      await transaction.updateTable('website_albums').set({ cover_file_id: fileId }).where('id', '=', id).execute();
      await recordEvent(transaction, 'album', id, 'cover', null, currentUser);
    });
    return this.album(id);
  }

  // Xem tệp trong trang quản trị (kể cả nội dung chưa đăng)
  async readFile(fileId: string) {
    const file = await this.system
      .selectFrom('website_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'website_file');
    }
    return {
      fileName: file.file_name,
      contentType: file.content_type,
      body: await this.fileStorage.get(file.storage_key),
    };
  }

  // ---- Nội dung chờ duyệt ----

  async review() {
    const posts = await this.system
      .selectFrom('website_posts')
      .select(['id', 'kind', 'title', 'submitted_at', 'submitted_by_name', 'created_by_name'])
      .where('status', '=', 'pending')
      .execute();
    const albums = await this.system
      .selectFrom('website_albums')
      .select(['id', 'title', 'submitted_at', 'submitted_by_name', 'created_by_name'])
      .where('status', '=', 'pending')
      .execute();
    const items = [
      ...posts.map((post) => ({ ...post, target_type: 'post' as const })),
      ...albums.map((album) => ({ ...album, kind: 'album' as const, target_type: 'album' as const })),
    ].sort((left, right) => (left.submitted_at?.getTime() ?? 0) - (right.submitted_at?.getTime() ?? 0));
    return { items, total: items.length };
  }

  // ---- Thư liên hệ ----

  async contacts(status: string | undefined, page: number, pageSize: number) {
    let query = this.system.selectFrom('website_contact_messages');
    if (status === 'new' || status === 'handled') {
      query = query.where('status', '=', status);
    }
    const total = await query.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirst();
    const items = await query
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();
    return { items, total: Number(total?.count ?? 0), page, page_size: pageSize };
  }

  async handleContact(currentUser: CurrentUser, id: string, note: string | null) {
    return this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('website_contact_messages')
        .set({
          status: 'handled',
          handled_note: note,
          handled_at: this.clock.now(),
          handled_by_name: currentUser.description.full_name,
        })
        .where('id', '=', id)
        .where('status', '=', 'new')
        .returningAll()
        .executeTakeFirst();
      if (!row) {
        throw ruleViolationError(WEBSITE_RULE_CODE, 'Thư không có hoặc đã xử lý');
      }
      await recordEvent(transaction, 'contact', id, 'handle', note, currentUser);
      return row;
    });
  }
}

const upload = (bytes: number) =>
  UseInterceptors(FileInterceptor('file', { limits: { fileSize: bytes + 1, files: 1 } }));

function captionOf(body: RequestBody): string | null {
  const errors: FieldError[] = [];
  const caption = readText(body, 'caption', errors, { maximum: 300 });
  throwIfAny(errors);
  return caption;
}

@Controller('website')
@RequirePermission(...CONTENT_PERMISSIONS)
export class WebsiteContentController {
  constructor(private readonly content: WebsiteContentService) {}

  @Get('posts')
  listPosts(@Query() query: Record<string, unknown>) {
    return this.content.listPosts(readContentFilter(query));
  }

  @Post('posts')
  createPost(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.content.createPost(currentUser, parsePost(body));
  }

  @Get('posts/:id')
  post(@Param('id', uuidParameter(POST_MESSAGE)) id: string) {
    return this.content.post(id);
  }

  @Put('posts/:id')
  updatePost(
    @Param('id', uuidParameter(POST_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.updatePost(currentUser, id, body);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async deletePost(
    @Param('id', uuidParameter(POST_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.content.deletePost(currentUser, id);
  }

  @Post('posts/:id/submit')
  @HttpCode(200)
  submitPost(@Param('id', uuidParameter(POST_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.content.submitPost(currentUser, id);
  }

  @Post('posts/:id/approve')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  approvePost(@Param('id', uuidParameter(POST_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.content.approvePost(currentUser, id);
  }

  @Post('posts/:id/return')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  returnPost(
    @Param('id', uuidParameter(POST_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.returnPost(currentUser, id, readReason(body, 'note'));
  }

  @Post('posts/:id/unpublish')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  unpublishPost(
    @Param('id', uuidParameter(POST_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.unpublishPost(currentUser, id, readReason(body, 'reason'));
  }

  @Post('posts/:id/files')
  @HttpCode(200)
  @upload(WEBSITE_MAXIMUM_FILE_BYTES)
  addPostFile(
    @Param('id', uuidParameter(POST_MESSAGE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.addFile(currentUser, 'post', id, String(body?.purpose ?? ''), file, captionOf(body));
  }

  @Delete('posts/:id/files/:fileId')
  deletePostFile(
    @Param('id', uuidParameter(POST_MESSAGE)) id: string,
    @Param('fileId', uuidParameter(FILE_MESSAGE)) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.deleteFile(currentUser, 'post', id, fileId);
  }

  @Get('albums')
  listAlbums(@Query() query: Record<string, unknown>) {
    return this.content.listAlbums(readContentFilter(query));
  }

  @Post('albums')
  createAlbum(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.content.createAlbum(currentUser, parseAlbum(body));
  }

  @Get('albums/:id')
  album(@Param('id', uuidParameter(ALBUM_MESSAGE)) id: string) {
    return this.content.album(id);
  }

  @Put('albums/:id')
  updateAlbum(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.updateAlbum(currentUser, id, parseAlbum(body));
  }

  @Delete('albums/:id')
  @HttpCode(204)
  async deleteAlbum(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.content.deleteAlbum(currentUser, id);
  }

  @Post('albums/:id/submit')
  @HttpCode(200)
  submitAlbum(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const consent = readBoolean(body, 'consent_confirmed', errors);
    throwIfAny(errors);
    return this.content.submitAlbum(currentUser, id, consent);
  }

  @Post('albums/:id/approve')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  approveAlbum(@Param('id', uuidParameter(ALBUM_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.content.approveAlbum(currentUser, id);
  }

  @Post('albums/:id/return')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  returnAlbum(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.returnAlbum(currentUser, id, readReason(body, 'note'));
  }

  @Post('albums/:id/unpublish')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  unpublishAlbum(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.unpublishAlbum(currentUser, id, readReason(body, 'reason'));
  }

  @Post('albums/:id/files')
  @HttpCode(200)
  @upload(WEBSITE_MAXIMUM_IMAGE_BYTES)
  addAlbumPhoto(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.addFile(currentUser, 'album', id, 'photo', file, captionOf(body));
  }

  @Delete('albums/:id/files/:fileId')
  deleteAlbumPhoto(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @Param('fileId', uuidParameter(FILE_MESSAGE)) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.deleteFile(currentUser, 'album', id, fileId);
  }

  @Post('albums/:id/cover/:fileId')
  @HttpCode(200)
  setAlbumCover(
    @Param('id', uuidParameter(ALBUM_MESSAGE)) id: string,
    @Param('fileId', uuidParameter(FILE_MESSAGE)) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.content.setAlbumCover(currentUser, id, fileId);
  }

  @Get('files/:fileId')
  @RequirePermission(...CONTENT_PERMISSIONS, WEBSITE_PERMISSIONS.configure)
  async readFile(@Param('fileId', uuidParameter(FILE_MESSAGE)) fileId: string, @Res() response: Response) {
    const file = await this.content.readFile(fileId);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.send(file.body);
  }

  @Get('review')
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  review() {
    return this.content.review();
  }

  @Get('contacts')
  contacts(@Query() query: Record<string, unknown>) {
    const filter = readContentFilter(query);
    return this.content.contacts(
      typeof query.status === 'string' ? query.status : undefined,
      filter.page,
      filter.pageSize,
    );
  }

  @Post('contacts/:id/handle')
  @HttpCode(200)
  @RequirePermission(WEBSITE_PERMISSIONS.approve)
  handleContact(
    @Param('id', uuidParameter('Mã thư không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readText(body, 'note', errors, { maximum: 1000 });
    throwIfAny(errors);
    return this.content.handleContact(currentUser, id, note);
  }
}
