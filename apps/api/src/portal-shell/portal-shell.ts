import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { isValidOrganizationIdentifier, PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';

// Khung trang cổng quản trị theo hệ thống của Sở (DT-16 phần 16c, khảo sát mục 2.1 và 2.2): thông báo hệ thống bật lên khi
// vào trang, lưới ứng dụng liên kết, tên trường và ô ngữ cảnh ở thanh đầu trang, tên và mã trường ở trang đăng nhập (bản
// chạy nội bộ thay cho bước chọn trường của Sở), nhắc cập nhật mã định danh tổ chức theo Nghị định 69. Thông báo và liên
// kết lưu ở cơ sở dữ liệu hệ thống nên giữ qua các năm học; người có quyền P01.announcement.manage (Quản trị nền tảng, Hiệu
// trưởng) soạn. Nhật ký thao tác ghi vào cơ sở dữ liệu năm học đang dùng nếu có
const MANAGE = PERMISSION_CODES.announcementManage;
const MAXIMUM_TITLE = 200;
const MAXIMUM_CONTENT = 5000;
const MAXIMUM_LINKS = 20;
const MAXIMUM_LINK_NAME = 100;
const MAXIMUM_LINK_DESCRIPTION = 200;
const MAXIMUM_URL = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Cấp học của trường: phần mềm phục vụ trường mầm non nên ô ngữ cảnh luôn là "Cấp MN" như của Sở
export const EDUCATION_LEVEL_LABEL = 'Cấp MN';

export interface AnnouncementInput {
  title: string;
  content: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export interface AppLinkInput {
  name: string;
  url: string;
  description: string | null;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readText(body: RequestBody, field: string, maximum: number, errors: FieldError[], required: boolean) {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chuỗi' });
    return null;
  }
  const text = value.trim();
  if (text.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return text;
}

// Hiệu lực từ ngày bắt buộc; đến ngày để trống là không hết hạn, có thì không trước từ ngày
export function parseAnnouncementInput(body: RequestBody): AnnouncementInput {
  const errors: FieldError[] = [];
  const title = readText(body, 'title', MAXIMUM_TITLE, errors, true) ?? '';
  const content = readText(body, 'content', MAXIMUM_CONTENT, errors, true) ?? '';
  const validFrom = readText(body, 'valid_from', 10, errors, true);
  const validUntil = readText(body, 'valid_until', 10, errors, false);
  if (validFrom !== null && !isCalendarDate(validFrom)) {
    errors.push({ field: 'valid_from', message: 'Ngày dạng YYYY-MM-DD' });
  }
  if (validUntil !== null && !isCalendarDate(validUntil)) {
    errors.push({ field: 'valid_until', message: 'Ngày dạng YYYY-MM-DD' });
  } else if (validUntil !== null && validFrom !== null && validUntil < validFrom) {
    errors.push({ field: 'valid_until', message: 'Đến ngày không được trước từ ngày' });
  }
  const isActive = body?.is_active;
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push({ field: 'is_active', message: 'Chọn có hoặc không' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { title, content, valid_from: validFrom ?? '', valid_until: validUntil, is_active: isActive !== false };
}

// Danh sách ứng dụng liên kết gửi cả danh sách; thứ tự trong mảng là thứ tự hiển thị. Chỉ nhận đường dẫn http, https
export function parseAppLinks(body: RequestBody): AppLinkInput[] {
  const links = body?.links;
  if (!Array.isArray(links)) {
    throw validationError([{ field: 'links', message: 'Danh sách ứng dụng phải là mảng' }]);
  }
  if (links.length > MAXIMUM_LINKS) {
    throw validationError([{ field: 'links', message: `Tối đa ${MAXIMUM_LINKS} ứng dụng` }]);
  }
  const errors: FieldError[] = [];
  const parsed = links.map((item: unknown, index) => {
    const link = (item ?? {}) as Record<string, unknown>;
    const nested: FieldError[] = [];
    const name = readText(link, 'name', MAXIMUM_LINK_NAME, nested, true) ?? '';
    const url = readText(link, 'url', MAXIMUM_URL, nested, true) ?? '';
    const description = readText(link, 'description', MAXIMUM_LINK_DESCRIPTION, nested, false);
    if (url !== '' && !isWebAddress(url)) {
      nested.push({ field: 'url', message: 'Đường dẫn phải bắt đầu bằng http:// hoặc https://' });
    }
    errors.push(...nested.map((error) => ({ field: `links[${index}].${error.field}`, message: error.message })));
    return { name, url, description };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return parsed;
}

function isWebAddress(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && /^https?:\/\//.test(value);
  } catch {
    return false;
  }
}

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
function vietnamDate(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(moment);
}

@Injectable()
export class SystemAnnouncementsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  list() {
    return this.databases.system
      .selectFrom('system_announcements')
      .selectAll()
      .orderBy('valid_from', 'desc')
      .orderBy('created_at', 'desc')
      .execute();
  }

  // Thông báo đang bật và còn hiệu lực hôm nay, hiện ở hộp thông báo khi vào cổng quản trị
  active() {
    const today = vietnamDate(this.clock.now());
    return this.databases.system
      .selectFrom('system_announcements')
      .select(['id', 'title', 'content', 'valid_from', 'valid_until', 'updated_at'])
      .where('is_active', '=', true)
      .where('valid_from', '<=', today)
      .where((expression) => expression.or([expression('valid_until', 'is', null), expression('valid_until', '>=', today)]))
      .orderBy('valid_from', 'desc')
      .orderBy('created_at', 'desc')
      .execute();
  }

  async create(input: AnnouncementInput, origin: ChangeOrigin) {
    const created = await this.databases.system
      .insertInto('system_announcements')
      .values({
        ...input,
        created_by: origin.actorUserId,
        created_by_name: origin.actorName,
        updated_by: origin.actorUserId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.audit(origin, created.id, 'create', null, created);
    return created;
  }

  async update(id: string, input: AnnouncementInput, origin: ChangeOrigin) {
    const before = await this.find(id);
    const updated = await this.databases.system
      .updateTable('system_announcements')
      .set({ ...input, updated_by: origin.actorUserId, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.audit(origin, id, 'update', before, updated);
    return updated;
  }

  async remove(id: string, origin: ChangeOrigin): Promise<void> {
    const before = await this.find(id);
    await this.databases.system.deleteFrom('system_announcements').where('id', '=', id).execute();
    await this.audit(origin, id, 'delete', before, null);
  }

  private async find(id: string) {
    const row = await this.databases.system
      .selectFrom('system_announcements')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy thông báo', 'system_announcement');
    }
    return row;
  }

  private async audit(
    origin: ChangeOrigin,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin,
        orgUnitId: null,
        entityName: 'system_announcements',
        entityId,
        action,
        before,
        after,
      });
    }
  }
}

@Injectable()
export class AppLinksService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  list() {
    return this.databases.system
      .selectFrom('portal_app_links')
      .select(['id', 'name', 'url', 'description', 'position'])
      .orderBy('position')
      .execute();
  }

  // Thay cả danh sách trong một giao dịch; hai lần lưu cùng lúc chạy lần lượt
  async replace(links: AppLinkInput[], origin: ChangeOrigin) {
    const before = await this.list();
    await this.databases.system.transaction().execute(async (transaction) => {
      await sql`select pg_advisory_xact_lock(hashtext('portal_app_links'))`.execute(transaction);
      await transaction.deleteFrom('portal_app_links').execute();
      if (links.length > 0) {
        await transaction
          .insertInto('portal_app_links')
          .values(
            links.map((link, position) => ({
              ...link,
              position,
              updated_by: origin.actorUserId,
              updated_at: this.clock.now(),
            })),
          )
          .execute();
      }
    });
    const after = await this.list();
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin,
        orgUnitId: null,
        entityName: 'portal_app_links',
        entityId: '00000000-0000-0000-0000-000000000000',
        action: 'update',
        before,
        after,
      });
    }
    return after;
  }
}

export interface SchoolIdentity {
  school_name: string | null;
  school_code: string | null;
  academic_year: string | null;
}

@Injectable()
export class PortalContextService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
  ) {}

  // Tên Trường chính trong cây đơn vị; mã trường lấy mã định danh ở hồ sơ trường, chưa có thì lấy mã đơn vị
  async schoolIdentity(): Promise<SchoolIdentity & { electronic_id_code: string | null }> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { school_name: null, school_code: null, academic_year: null, electronic_id_code: null };
    }
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select('name')
      .where('id', '=', current.academicYearId)
      .executeTakeFirst();
    const root = await current.database
      .selectFrom('org_units')
      .select(['id', 'code', 'name'])
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    const profile = root
      ? await current.database
          .selectFrom('school_profiles')
          .select('general')
          .where('org_unit_id', '=', root.id)
          .executeTakeFirst()
      : undefined;
    const general = (profile?.general ?? {}) as Record<string, unknown>;
    const moetCode = typeof general.moet_code === 'string' && general.moet_code !== '' ? general.moet_code : null;
    const electronicId = typeof general.electronic_id_code === 'string' ? general.electronic_id_code : null;
    return {
      school_name: root?.name ?? null,
      school_code: moetCode ?? root?.code ?? null,
      academic_year: year?.name ?? null,
      electronic_id_code: electronicId,
    };
  }

  // Người cập nhật được hồ sơ trường thấy lời nhắc khi mã định danh tổ chức chưa có hoặc sai định dạng (NĐ 69)
  async context(currentUser: CurrentUser) {
    const identity = await this.schoolIdentity();
    const canUpdateProfile = currentUser.hasPermission(PERMISSION_CODES.schoolProfileManage);
    return {
      school_name: identity.school_name,
      school_code: identity.school_code,
      academic_year: identity.academic_year,
      education_level: EDUCATION_LEVEL_LABEL,
      organization_id_reminder:
        canUpdateProfile && identity.school_name !== null && !isValidOrganizationIdentifier(identity.electronic_id_code),
    };
  }
}

@Controller('system-announcements')
export class SystemAnnouncementsController {
  constructor(private readonly announcements: SystemAnnouncementsService) {}

  @Get()
  @RequirePermission(MANAGE)
  list() {
    return this.announcements.list();
  }

  // Mọi người đã đăng nhập đọc được thông báo đang hiệu lực
  @Get('active')
  active() {
    return this.announcements.active();
  }

  @Post()
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.announcements.create(parseAnnouncementInput(body), originOf(request, currentUser));
  }

  @Put(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', uuidParameter('Mã thông báo không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.announcements.update(id, parseAnnouncementInput(body), originOf(request, currentUser));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async remove(
    @Param('id', uuidParameter('Mã thông báo không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ): Promise<void> {
    await this.announcements.remove(id, originOf(request, currentUser));
  }
}

@Controller('app-links')
export class AppLinksController {
  constructor(private readonly appLinks: AppLinksService) {}

  @Get()
  list() {
    return this.appLinks.list();
  }

  @Put()
  @RequirePermission(MANAGE)
  replace(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.appLinks.replace(parseAppLinks(body), originOf(request, currentUser));
  }
}

@Controller('portal-context')
export class PortalContextController {
  constructor(private readonly portalContext: PortalContextService) {}

  @Get()
  context(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.portalContext.context(currentUser);
  }
}

// Trang đăng nhập hiện tên, mã trường và năm học đang dùng mà chưa cần đăng nhập
@Controller('public/login-info')
@PublicEndpoint()
export class PublicLoginInfoController {
  constructor(private readonly portalContext: PortalContextService) {}

  @Get()
  async info(): Promise<SchoolIdentity> {
    const identity = await this.portalContext.schoolIdentity();
    return { school_name: identity.school_name, school_code: identity.school_code, academic_year: identity.academic_year };
  }
}
