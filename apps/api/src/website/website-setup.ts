import { randomUUID } from 'node:crypto';
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
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { WebsiteDomainKind } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  WEBSITE_DOMAIN_KIND_LABELS,
  WEBSITE_MAXIMUM_IMAGE_BYTES,
  WEBSITE_SCHOOL_LEVELS,
} from '@school-management/shared';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { conflictOnDuplicate, notFoundError, type RequestBody } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import { readBoolean, readChoice, readText, throwIfAny } from '../incoming-documents/incoming-fields.js';
import { normalizeHostname, slugify } from './website-html.js';
import {
  CONTENT_PERMISSIONS,
  detectImageType,
  recordEvent,
  sha256,
  type SystemExecutor,
  WEBSITE_PERMISSIONS,
  WEBSITE_RULE_CODE,
} from './website-support.js';

// Thiết lập website trường (DT-18 phần 18f, YCTD-144): thông tin website, biểu trưng, ảnh đầu trang, tên miền, chế độ
// trình diễn và nội dung mẫu. Tên miền lưu ở cơ sở dữ liệu hệ thống, không ở biến môi trường; máy chủ web hỏi điểm cuối
// công khai kiểm tra tên miền trước khi xin chứng chỉ (chỉ tên miền đã đăng ký, đang dùng). Trỏ tên miền về máy chủ là việc
// làm tay của quản trị; hệ thống chỉ ghi trạng thái đánh dấu đã trỏ (ngày, người đánh dấu)
const CONFIGURE = WEBSITE_PERMISSIONS.configure;
const URL_PATTERN = /^https?:\/\/[^\s<>"']+$/i;
const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const LEVELS = new Set<string>(WEBSITE_SCHOOL_LEVELS.map((level) => level.value));
const DOMAIN_MESSAGE = 'Mã tên miền không hợp lệ';

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface WebsiteSettingsInput {
  site_name: string;
  slogan: string | null;
  introduction: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  map_url: string | null;
  office_hours: string | null;
  facebook_url: string | null;
  admission_form_url: string | null;
  footer_note: string | null;
  primary_color: string;
  school_levels: string[];
  show_timetable: boolean;
  demo_mode: boolean;
}

function readUrl(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = readText(body, field, errors, { maximum: 500 });
  if (value && !URL_PATTERN.test(value)) {
    errors.push({ field, message: 'Địa chỉ bắt đầu bằng http:// hoặc https://' });
  }
  return value;
}

export function parseSettings(body: RequestBody): WebsiteSettingsInput {
  const errors: FieldError[] = [];
  const email = readText(body, 'email', errors, { maximum: 200 });
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', message: 'Thư điện tử không hợp lệ' });
  }
  const color = (readText(body, 'primary_color', errors, { maximum: 7 }) ?? '#1d4ed8').toLowerCase();
  if (!COLOR_PATTERN.test(color)) {
    errors.push({ field: 'primary_color', message: 'Màu dạng #RRGGBB' });
  }
  const levels = body?.school_levels;
  let schoolLevels: string[] = ['MN'];
  if (levels !== undefined) {
    if (
      !Array.isArray(levels) ||
      levels.length === 0 ||
      !levels.every((level) => typeof level === 'string' && LEVELS.has(level))
    ) {
      errors.push({ field: 'school_levels', message: 'Chọn ít nhất một cấp học' });
    } else {
      schoolLevels = [...new Set(levels as string[])];
    }
  }
  const input: WebsiteSettingsInput = {
    site_name: readText(body, 'site_name', errors, { required: true, maximum: 200 }) ?? '',
    slogan: readText(body, 'slogan', errors, { maximum: 300 }),
    introduction: readText(body, 'introduction', errors, { maximum: 2000 }),
    address: readText(body, 'address', errors, { maximum: 500 }),
    phone: readText(body, 'phone', errors, { maximum: 50 }),
    email,
    map_url: readUrl(body, 'map_url', errors),
    office_hours: readText(body, 'office_hours', errors, { maximum: 300 }),
    facebook_url: readUrl(body, 'facebook_url', errors),
    admission_form_url: readUrl(body, 'admission_form_url', errors),
    footer_note: readText(body, 'footer_note', errors, { maximum: 1000 }),
    primary_color: color,
    school_levels: schoolLevels,
    show_timetable: readBoolean(body, 'show_timetable', errors),
    demo_mode: readBoolean(body, 'demo_mode', errors),
  };
  throwIfAny(errors);
  return input;
}

// Nội dung mẫu của chế độ trình diễn: chữ chung chung, không có tên trường, tên người hay số liệu thật
const SAMPLE_POSTS = [
  {
    kind: 'news' as const,
    title: '[Mẫu] Lễ khai giảng năm học mới',
    summary: 'Bài mẫu của chế độ trình diễn: tin hoạt động đầu năm học.',
    body: '<p>Đây là bài viết mẫu để xem thử giao diện website. Nhà trường thay bằng tin thật trước khi đưa website vào dùng.</p><h3>Chương trình buổi lễ</h3><ul><li>Chào cờ</li><li>Phát biểu khai giảng</li><li>Văn nghệ chào mừng</li></ul>',
    pinned: true,
  },
  {
    kind: 'news' as const,
    title: '[Mẫu] Hội thi bé khỏe, bé ngoan',
    summary: 'Bài mẫu của chế độ trình diễn: tin hoạt động trong năm.',
    body: '<p>Bài viết mẫu mô tả một hoạt động của nhà trường. Nội dung chỉ để minh họa.</p>',
    pinned: false,
  },
  {
    kind: 'announcement' as const,
    title: '[Mẫu] Thông báo lịch nghỉ lễ',
    summary: 'Thông báo mẫu của chế độ trình diễn.',
    body: '<p>Thông báo mẫu: nhà trường thông báo lịch nghỉ lễ tới cha mẹ học sinh. Nội dung chỉ để minh họa.</p>',
    pinned: false,
  },
  {
    kind: 'announcement' as const,
    title: '[Mẫu] Thông báo họp cha mẹ học sinh đầu năm',
    summary: 'Thông báo mẫu của chế độ trình diễn.',
    body: '<p>Thông báo mẫu về buổi họp cha mẹ học sinh. Nội dung chỉ để minh họa.</p>',
    pinned: false,
  },
];

@Injectable()
export class WebsiteSetupService {
  // Đọc theo từng lần dùng để đúng trường trong ngữ cảnh ở chế độ nhiều trường (DT-SaaS phần S1a)
  private get system() {
    return this.databases.system;
  }

  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  async settings() {
    const settings = await this.system
      .selectFrom('website_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    const files = await this.system
      .selectFrom('website_files')
      .select(['id', 'purpose', 'file_name', 'content_type', 'size_bytes'])
      .where('owner_type', '=', 'settings')
      .execute();
    const sample = await this.system
      .selectFrom('website_posts')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('is_sample', '=', true)
      .executeTakeFirstOrThrow();
    return {
      ...settings,
      // Cấp học của trường đọc từ school_levels (DT-19 phần 19a); ghi thông tin website chép lại vào cột cũ làm dự phòng
      school_levels: await this.schoolLevels.enabled(),
      logo: files.find((file) => file.id === settings.logo_file_id) ?? null,
      banner: files.find((file) => file.id === settings.banner_file_id) ?? null,
      sample_count: Number(sample.count),
    };
  }

  async saveSettings(currentUser: CurrentUser, input: WebsiteSettingsInput) {
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('website_settings')
        .set({
          ...input,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', 1)
        .execute();
      await recordEvent(transaction, 'settings', null, 'update', null, currentUser);
    });
    return this.settings();
  }

  // Biểu trưng hoặc ảnh đầu trang; ảnh mới thay ảnh cũ
  async uploadSettingsImage(currentUser: CurrentUser, purpose: string, upload: UploadedPart | undefined) {
    if (purpose !== 'logo' && purpose !== 'banner') {
      throw validationError([{ field: 'purpose', message: 'Chọn biểu trưng hoặc ảnh đầu trang' }]);
    }
    if (!upload) {
      throw validationError([{ field: 'file', message: 'Chọn tệp ảnh' }]);
    }
    if (upload.size > WEBSITE_MAXIMUM_IMAGE_BYTES) {
      throw validationError([{ field: 'file', message: 'Ảnh tối đa 10 MB' }]);
    }
    const contentType = detectImageType(upload.buffer);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Ảnh là JPEG, PNG hoặc WebP' }]);
    }
    const column = purpose === 'logo' ? 'logo_file_id' : 'banner_file_id';
    const key = storageKey('website', 'settings', randomUUID());
    await this.fileStorage.put(key, upload.buffer, contentType);
    const old = await this.system.transaction().execute(async (transaction) => {
      const previous = await transaction
        .selectFrom('website_settings')
        .select(column)
        .where('id', '=', 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const file = await transaction
        .insertInto('website_files')
        .values({
          owner_type: 'settings',
          owner_id: null,
          purpose,
          file_name: Buffer.from(upload.originalname, 'latin1').toString('utf8').slice(0, 200),
          content_type: contentType,
          size_bytes: upload.size,
          sha256: sha256(upload.buffer),
          storage_key: key,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('website_settings')
        .set({ [column]: file.id, updated_at: this.clock.now() })
        .where('id', '=', 1)
        .execute();
      await recordEvent(transaction, 'settings', null, `upload_${purpose}`, null, currentUser);
      const previousId = (previous as Record<string, string | null>)[column];
      return previousId
        ? await transaction
            .deleteFrom('website_files')
            .where('id', '=', previousId)
            .returning('storage_key')
            .executeTakeFirst()
        : undefined;
    });
    if (old) {
      await this.fileStorage.delete(old.storage_key).catch(() => undefined);
    }
    return this.settings();
  }

  async removeSettingsImage(currentUser: CurrentUser, purpose: string) {
    if (purpose !== 'logo' && purpose !== 'banner') {
      throw validationError([{ field: 'purpose', message: 'Chọn biểu trưng hoặc ảnh đầu trang' }]);
    }
    const column = purpose === 'logo' ? 'logo_file_id' : 'banner_file_id';
    const old = await this.system.transaction().execute(async (transaction) => {
      const settings = await transaction
        .selectFrom('website_settings')
        .select(column)
        .where('id', '=', 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const fileId = (settings as Record<string, string | null>)[column];
      if (!fileId) {
        return undefined;
      }
      await transaction
        .updateTable('website_settings')
        .set({ [column]: null, updated_at: this.clock.now() })
        .where('id', '=', 1)
        .execute();
      await recordEvent(transaction, 'settings', null, `remove_${purpose}`, null, currentUser);
      return transaction
        .deleteFrom('website_files')
        .where('id', '=', fileId)
        .returning('storage_key')
        .executeTakeFirst();
    });
    if (old) {
      await this.fileStorage.delete(old.storage_key).catch(() => undefined);
    }
    return this.settings();
  }

  // ---- Tên miền ----

  domains() {
    return this.system.selectFrom('website_domains').selectAll().orderBy('kind').orderBy('hostname').execute();
  }

  async addDomain(currentUser: CurrentUser, body: RequestBody) {
    const errors: FieldError[] = [];
    const raw = readText(body, 'hostname', errors, { required: true, maximum: 253 });
    const hostname = raw ? normalizeHostname(raw) : null;
    if (raw && !hostname) {
      errors.push({
        field: 'hostname',
        message: 'Tên miền gồm chữ không dấu, số, dấu gạch ngang, có dấu chấm, không có http:// và cổng',
      });
    }
    const kind = readChoice<WebsiteDomainKind>(body, 'kind', WEBSITE_DOMAIN_KIND_LABELS, 'primary', errors);
    const note = readText(body, 'note', errors, { maximum: 500 });
    throwIfAny(errors);
    const created = await this.system.transaction().execute(async (transaction) => {
      if (kind === 'primary') {
        await this.assertNoOtherPrimary(transaction, null);
      }
      const row = await conflictOnDuplicate(
        transaction
          .insertInto('website_domains')
          .values({
            hostname: hostname!,
            kind,
            note,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Tên miền đã có trong danh sách',
        'hostname',
      );
      await recordEvent(transaction, 'domain', row.id, 'create', row.hostname, currentUser);
      return row;
    });
    return created;
  }

  async updateDomain(currentUser: CurrentUser, id: string, body: RequestBody) {
    const errors: FieldError[] = [];
    const current = await this.findDomain(id);
    const kind =
      body?.kind === undefined
        ? current.kind
        : readChoice<WebsiteDomainKind>(body, 'kind', WEBSITE_DOMAIN_KIND_LABELS, current.kind, errors);
    const active = readBoolean(body, 'active', errors, current.active);
    const note = body?.note === undefined ? current.note : readText(body, 'note', errors, { maximum: 500 });
    throwIfAny(errors);
    return this.system.transaction().execute(async (transaction) => {
      if (kind === 'primary' && active) {
        await this.assertNoOtherPrimary(transaction, id);
      }
      const row = await transaction
        .updateTable('website_domains')
        .set({ kind, active, note, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await recordEvent(transaction, 'domain', id, active ? 'update' : 'deactivate', row.hostname, currentUser);
      return row;
    });
  }

  // Đánh dấu tay đã trỏ tên miền về máy chủ (hoặc bỏ đánh dấu); hệ thống không tự kiểm tra bản ghi DNS
  async confirmDns(currentUser: CurrentUser, id: string, confirmed: boolean) {
    await this.findDomain(id);
    return this.system.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('website_domains')
        .set({
          dns_confirmed_at: confirmed ? this.clock.now() : null,
          dns_confirmed_by_name: confirmed ? currentUser.description.full_name : null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await recordEvent(
        transaction,
        'domain',
        id,
        confirmed ? 'dns_confirm' : 'dns_unconfirm',
        row.hostname,
        currentUser,
      );
      return row;
    });
  }

  async deleteDomain(currentUser: CurrentUser, id: string) {
    const domain = await this.findDomain(id);
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('website_domains').where('id', '=', id).execute();
      await recordEvent(transaction, 'domain', id, 'delete', domain.hostname, currentUser);
    });
  }

  private async findDomain(id: string) {
    const domain = await this.system.selectFrom('website_domains').selectAll().where('id', '=', id).executeTakeFirst();
    if (!domain) {
      throw notFoundError('Không tìm thấy tên miền', 'website_domain');
    }
    return domain;
  }

  private async assertNoOtherPrimary(executor: SystemExecutor, exceptId: string | null) {
    let query = executor
      .selectFrom('website_domains')
      .select('hostname')
      .where('kind', '=', 'primary')
      .where('active', '=', true);
    if (exceptId) {
      query = query.where('id', '<>', exceptId);
    }
    const other = await query.executeTakeFirst();
    if (other) {
      throw ruleViolationError(
        WEBSITE_RULE_CODE,
        `Trường đã có tên miền chính ${other.hostname}; đổi tên miền đó thành tên miền phụ hoặc ngừng dùng trước`,
        [{ field: 'kind', message: 'Mỗi trường một tên miền chính đang dùng' }],
      );
    }
  }

  // ---- Chế độ trình diễn: nội dung mẫu ----

  async createSampleContent(currentUser: CurrentUser) {
    const settings = await this.system
      .selectFrom('website_settings')
      .select('demo_mode')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    if (!settings.demo_mode) {
      throw ruleViolationError(WEBSITE_RULE_CODE, 'Chỉ tạo nội dung mẫu khi bật chế độ trình diễn');
    }
    const now = this.clock.now();
    await this.system.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('website_posts')
        .select('id')
        .where('is_sample', '=', true)
        .executeTakeFirst();
      if (existing) {
        throw ruleViolationError(WEBSITE_RULE_CODE, 'Đã có nội dung mẫu; xóa nội dung mẫu cũ trước khi tạo lại');
      }
      for (const [index, post] of SAMPLE_POSTS.entries()) {
        const publishedAt = new Date(now.getTime() - index * 86_400_000);
        await transaction
          .insertInto('website_posts')
          .values({
            kind: post.kind,
            slug: slugify(post.title),
            title: post.title,
            summary: post.summary,
            body_html: post.body,
            pinned: post.pinned,
            status: 'published',
            published_at: publishedAt,
            first_published_at: publishedAt,
            published_by_name: currentUser.description.full_name,
            is_sample: true,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .execute();
      }
      await recordEvent(transaction, 'settings', null, 'sample_create', null, currentUser);
    });
    return this.settings();
  }

  async deleteSampleContent(currentUser: CurrentUser) {
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('website_posts').where('is_sample', '=', true).execute();
      await transaction.deleteFrom('website_albums').where('is_sample', '=', true).execute();
      await recordEvent(transaction, 'settings', null, 'sample_delete', null, currentUser);
    });
    return this.settings();
  }

  disclosureCategories() {
    return this.system
      .selectFrom('website_disclosure_categories')
      .selectAll()
      .where('active', '=', true)
      .orderBy('order_no')
      .execute();
  }
}

@Controller('website')
export class WebsiteSetupController {
  constructor(private readonly setup: WebsiteSetupService) {}

  @Get('settings')
  @RequirePermission(CONFIGURE, ...CONTENT_PERMISSIONS)
  settings() {
    return this.setup.settings();
  }

  @Put('settings')
  @RequirePermission(CONFIGURE)
  saveSettings(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.setup.saveSettings(currentUser, parseSettings(body));
  }

  @Post('settings/images/:purpose')
  @HttpCode(200)
  @RequirePermission(CONFIGURE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: WEBSITE_MAXIMUM_IMAGE_BYTES + 1, files: 1 } }))
  uploadImage(
    @Param('purpose') purpose: string,
    @UploadedFile() file: UploadedPart | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.setup.uploadSettingsImage(currentUser, purpose, file);
  }

  @Delete('settings/images/:purpose')
  @RequirePermission(CONFIGURE)
  removeImage(@Param('purpose') purpose: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.setup.removeSettingsImage(currentUser, purpose);
  }

  @Get('domains')
  @RequirePermission(CONFIGURE)
  async domains() {
    return { items: await this.setup.domains() };
  }

  @Post('domains')
  @RequirePermission(CONFIGURE)
  addDomain(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.setup.addDomain(currentUser, body);
  }

  @Patch('domains/:id')
  @RequirePermission(CONFIGURE)
  updateDomain(
    @Param('id', uuidParameter(DOMAIN_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.setup.updateDomain(currentUser, id, body);
  }

  @Post('domains/:id/dns-confirmation')
  @HttpCode(200)
  @RequirePermission(CONFIGURE)
  confirmDns(
    @Param('id', uuidParameter(DOMAIN_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const confirmed = readBoolean(body, 'confirmed', errors, true);
    throwIfAny(errors);
    return this.setup.confirmDns(currentUser, id, confirmed);
  }

  @Delete('domains/:id')
  @HttpCode(204)
  @RequirePermission(CONFIGURE)
  async deleteDomain(
    @Param('id', uuidParameter(DOMAIN_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.setup.deleteDomain(currentUser, id);
  }

  @Post('sample-content')
  @HttpCode(200)
  @RequirePermission(CONFIGURE)
  createSample(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.setup.createSampleContent(currentUser);
  }

  @Delete('sample-content')
  @RequirePermission(CONFIGURE)
  deleteSample(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.setup.deleteSampleContent(currentUser);
  }

  @Get('disclosure-categories')
  @RequirePermission(CONFIGURE, ...CONTENT_PERMISSIONS)
  async disclosureCategories() {
    return { items: await this.setup.disclosureCategories() };
  }
}
