import {
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UserFeedbackStatus, UserFeedbackType } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import { sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';

// Ý kiến phản hồi gửi từ chân trang cổng quản trị (DT-15 phần 15g, YCTD-110): người dùng gửi góp ý, báo lỗi, đề nghị kèm
// trang đang mở và ảnh chụp màn hình; xem lại ý kiến của mình ở "Danh sách ý kiến đã gửi"; người có quyền
// P01.feedback.manage (Quản trị nền tảng, Hiệu trưởng) xem mọi ý kiến, đổi trạng thái và trả lời. Lưu ở cơ sở dữ liệu hệ
// thống nên giữ qua các năm học
export const FEEDBACK_RULE_CODE = 'YCTD-110';
export const FEEDBACK_TYPES: UserFeedbackType[] = ['suggestion', 'bug', 'request'];
export const FEEDBACK_STATUSES: UserFeedbackStatus[] = ['new', 'in_progress', 'resolved'];
// Mỗi tài khoản gửi tối đa 10 ý kiến trong một giờ để tránh gửi tràn
export const MAXIMUM_FEEDBACK_PER_HOUR = 10;
export const MAXIMUM_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAXIMUM_TITLE = 200;
const MAXIMUM_CONTENT = 5000;
const MAXIMUM_REPLY = 5000;
const MAXIMUM_PAGE_URL = 500;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

export interface FeedbackInput {
  feedback_type: UserFeedbackType;
  title: string;
  content: string;
  page_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface FeedbackUpdate {
  status?: UserFeedbackStatus;
  reply?: string | null;
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface FeedbackView {
  id: string;
  user_id: string;
  user_name: string;
  org_unit_id: string | null;
  org_unit_name: string | null;
  page_url: string | null;
  feedback_type: UserFeedbackType;
  title: string;
  content: string;
  contact_phone: string | null;
  contact_email: string | null;
  attachment_name: string | null;
  status: UserFeedbackStatus;
  reply: string | null;
  replied_by_name: string | null;
  replied_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const VIEW_COLUMNS = [
  'id',
  'user_id',
  'user_name',
  'org_unit_id',
  'page_url',
  'feedback_type',
  'title',
  'content',
  'contact_phone',
  'contact_email',
  'attachment_name',
  'status',
  'reply',
  'replied_by_name',
  'replied_at',
  'created_at',
  'updated_at',
] as const;

function readLimitedText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  maximum: number,
  required: boolean,
): string | null {
  const value = readOptionalText(body, field, errors);
  if (!value) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value;
}

// Kiểm tra biểu mẫu Gửi phản hồi: loại, tiêu đề, nội dung bắt buộc; trang đang mở là đường dẫn trong cổng; số điện thoại,
// thư điện tử liên hệ không bắt buộc
export function parseFeedbackInput(body: RequestBody): FeedbackInput {
  const errors: FieldError[] = [];
  const feedbackType = body?.feedback_type;
  if (typeof feedbackType !== 'string' || !(FEEDBACK_TYPES as string[]).includes(feedbackType)) {
    errors.push({ field: 'feedback_type', message: 'Chọn loại ý kiến: góp ý, báo lỗi hoặc đề nghị' });
  }
  const title = readLimitedText(body, 'title', errors, MAXIMUM_TITLE, true);
  const content = readLimitedText(body, 'content', errors, MAXIMUM_CONTENT, true);
  const pageUrl = readLimitedText(body, 'page_url', errors, MAXIMUM_PAGE_URL, false);
  if (pageUrl && !pageUrl.startsWith('/')) {
    errors.push({ field: 'page_url', message: 'Đường dẫn trang không hợp lệ' });
  }
  const contactPhone = readLimitedText(body, 'contact_phone', errors, 20, false);
  if (contactPhone && !PHONE_PATTERN.test(contactPhone)) {
    errors.push({ field: 'contact_phone', message: 'Số điện thoại gồm 9 đến 15 chữ số' });
  }
  const contactEmail = readLimitedText(body, 'contact_email', errors, 200, false);
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    errors.push({ field: 'contact_email', message: 'Thư điện tử không hợp lệ' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    feedback_type: feedbackType as UserFeedbackType,
    title: title ?? '',
    content: content ?? '',
    page_url: pageUrl,
    contact_phone: contactPhone,
    contact_email: contactEmail,
  };
}

// Quản trị đổi trạng thái và/hoặc trả lời; gửi reply rỗng là xóa câu trả lời
export function parseFeedbackUpdate(body: RequestBody): FeedbackUpdate {
  const errors: FieldError[] = [];
  const update: FeedbackUpdate = {};
  if (body?.status !== undefined) {
    if (typeof body.status !== 'string' || !(FEEDBACK_STATUSES as string[]).includes(body.status)) {
      errors.push({ field: 'status', message: 'Trạng thái là mới, đang xử lý hoặc đã xử lý' });
    } else {
      update.status = body.status as UserFeedbackStatus;
    }
  }
  if (body?.reply !== undefined) {
    update.reply = readLimitedText(body, 'reply', errors, MAXIMUM_REPLY, false);
  }
  if (errors.length === 0 && update.status === undefined && update.reply === undefined) {
    errors.push({ field: 'status', message: 'Cần trạng thái hoặc nội dung trả lời' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return update;
}

function detectImage(body: Buffer): string | undefined {
  return IMAGE_SIGNATURES.find((signature) => signature.bytes.every((byte, index) => body[index] === byte))
    ?.contentType;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger('Feedback');

  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.databases.system;
  }

  // Đơn vị của người gửi: đơn vị của vai trò đầu tiên gán theo đơn vị; vai trò toàn trường thì để trống
  async submit(
    currentUser: CurrentUser,
    input: FeedbackInput,
    attachment: { fileName: string; body: Buffer } | null,
  ): Promise<FeedbackView> {
    let stored: { key: string; contentType: string } | null = null;
    if (attachment) {
      const contentType = detectImage(attachment.body);
      if (!contentType) {
        throw validationError([{ field: 'attachment', message: 'Ảnh đính kèm là ảnh JPEG hoặc PNG' }]);
      }
      if (attachment.body.length > MAXIMUM_ATTACHMENT_BYTES) {
        throw validationError([{ field: 'attachment', message: 'Ảnh đính kèm tối đa 5 MB' }]);
      }
      stored = { key: `feedback/${randomUUID()}`, contentType };
    }
    const now = this.clock.now();
    const orgUnitId =
      currentUser.description.assignments.find((assignment) => assignment.org_unit_id !== null)?.org_unit_id ?? null;
    const id = await this.database.transaction().execute(async (transaction) => {
      // Khóa theo tài khoản để hai lần gửi cùng lúc không vượt giới hạn
      await sql`select pg_advisory_xact_lock(hashtext(${`feedback:${currentUser.id}`}))`.execute(transaction);
      const recent = await transaction
        .selectFrom('feedback')
        .select((expression) => [
          expression.fn.countAll<string>().as('count'),
          expression.fn.min('created_at').as('oldest'),
        ])
        .where('user_id', '=', currentUser.id)
        .where('created_at', '>', new Date(now.getTime() - HOUR_MILLISECONDS))
        .executeTakeFirstOrThrow();
      if (Number(recent.count) >= MAXIMUM_FEEDBACK_PER_HOUR) {
        // Gửi lại được khi ý kiến cũ nhất trong một giờ qua ra khỏi khoảng tính
        const oldest = recent.oldest ? new Date(recent.oldest).getTime() : now.getTime();
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + HOUR_MILLISECONDS - now.getTime()) / 1000));
        throw new ApplicationError(
          'ERR_RATE_LIMIT',
          `Mỗi tài khoản gửi tối đa ${MAXIMUM_FEEDBACK_PER_HOUR} ý kiến trong một giờ, vui lòng thử lại sau`,
          [],
          retryAfterSeconds,
          FEEDBACK_RULE_CODE,
        );
      }
      if (stored && attachment) {
        await this.fileStorage.put(stored.key, attachment.body, stored.contentType);
      }
      const row = await transaction
        .insertInto('feedback')
        .values({
          user_id: currentUser.id,
          user_name: currentUser.description.full_name,
          org_unit_id: orgUnitId,
          page_url: input.page_url,
          feedback_type: input.feedback_type,
          title: input.title,
          content: input.content,
          contact_phone: input.contact_phone,
          contact_email: input.contact_email,
          attachment_key: stored?.key ?? null,
          attachment_name: attachment ? attachment.fileName.slice(0, 200) : null,
          attachment_content_type: stored?.contentType ?? null,
          attachment_size: attachment ? attachment.body.length : null,
          created_at: now,
          updated_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    });
    return this.find(id);
  }

  // Danh sách ý kiến đã gửi của chính tài khoản, mới nhất trước
  async listOwn(currentUser: CurrentUser): Promise<FeedbackView[]> {
    const rows = await this.database
      .selectFrom('feedback')
      .select(VIEW_COLUMNS)
      .where('user_id', '=', currentUser.id)
      .orderBy('created_at', 'desc')
      .execute();
    return this.withUnitNames(rows);
  }

  // Mọi ý kiến cho người xử lý; lọc theo trạng thái
  async listAll(currentUser: CurrentUser, status: UserFeedbackStatus | undefined): Promise<FeedbackView[]> {
    this.assertManager(currentUser);
    let query = this.database.selectFrom('feedback').select(VIEW_COLUMNS);
    if (status) {
      query = query.where('status', '=', status);
    }
    return this.withUnitNames(await query.orderBy('created_at', 'desc').execute());
  }

  // Đổi trạng thái, trả lời; câu trả lời mới hoặc đã sửa thì báo người gửi trong ứng dụng
  async update(currentUser: CurrentUser, feedbackId: string, update: FeedbackUpdate): Promise<FeedbackView> {
    this.assertManager(currentUser);
    const existing = await this.database
      .selectFrom('feedback')
      .select(['id', 'user_id', 'title', 'reply'])
      .where('id', '=', feedbackId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy ý kiến phản hồi', 'feedback');
    }
    const now = this.clock.now();
    const replyChanged = update.reply !== undefined && update.reply !== existing.reply;
    await this.database
      .updateTable('feedback')
      .set({
        ...(update.status ? { status: update.status } : {}),
        ...(replyChanged
          ? {
              reply: update.reply ?? null,
              replied_by: update.reply ? currentUser.id : null,
              replied_by_name: update.reply ? currentUser.description.full_name : null,
              replied_at: update.reply ? now : null,
            }
          : {}),
        updated_at: now,
        updated_by: currentUser.id,
      })
      .where('id', '=', feedbackId)
      .execute();
    if (replyChanged && update.reply) {
      await this.notifyReply(existing.user_id, feedbackId, existing.title, update.reply);
    }
    return this.find(feedbackId);
  }

  // Ảnh đính kèm: người gửi hoặc người xử lý ý kiến
  async attachment(
    currentUser: CurrentUser,
    feedbackId: string,
  ): Promise<{ fileName: string; contentType: string; body: Buffer }> {
    const row = await this.database
      .selectFrom('feedback')
      .select(['user_id', 'attachment_key', 'attachment_name', 'attachment_content_type'])
      .where('id', '=', feedbackId)
      .executeTakeFirst();
    if (!row || (row.user_id !== currentUser.id && !this.canManage(currentUser))) {
      throw notFoundError('Không tìm thấy ý kiến phản hồi', 'feedback');
    }
    if (!row.attachment_key || !row.attachment_content_type) {
      throw notFoundError('Ý kiến không có ảnh đính kèm', 'attachment');
    }
    return {
      fileName: row.attachment_name ?? 'anh-dinh-kem',
      contentType: row.attachment_content_type,
      body: await this.fileStorage.get(row.attachment_key),
    };
  }

  private canManage(currentUser: CurrentUser): boolean {
    return currentUser.hasPermission(PERMISSION_CODES.feedbackManage);
  }

  private assertManager(currentUser: CurrentUser): void {
    if (!this.canManage(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem ý kiến phản hồi của người khác');
    }
  }

  private async find(feedbackId: string): Promise<FeedbackView> {
    const row = await this.database
      .selectFrom('feedback')
      .select(VIEW_COLUMNS)
      .where('id', '=', feedbackId)
      .executeTakeFirstOrThrow();
    const [view] = await this.withUnitNames([row]);
    return view as FeedbackView;
  }

  // Tên đơn vị đọc ở năm học đang dùng; chưa có năm học thì để trống
  private async withUnitNames(rows: Array<Omit<FeedbackView, 'org_unit_name'>>): Promise<FeedbackView[]> {
    const unitIds = [...new Set(rows.map((row) => row.org_unit_id).filter((id): id is string => id !== null))];
    const names = new Map<string, string>();
    const current = unitIds.length > 0 ? await this.currentSchoolYear.find() : undefined;
    if (current) {
      for (const unit of await current.database
        .selectFrom('org_units')
        .select(['id', 'name'])
        .where('id', 'in', unitIds)
        .execute()) {
        names.set(unit.id, unit.name);
      }
    }
    return rows.map((row) => ({
      ...row,
      org_unit_name: row.org_unit_id ? (names.get(row.org_unit_id) ?? null) : null,
    }));
  }

  // Thông báo nằm ở cơ sở dữ liệu năm học; chưa có năm học đang dùng thì không báo được, người gửi vẫn xem câu trả lời ở
  // Danh sách ý kiến đã gửi
  private async notifyReply(userId: string, feedbackId: string, title: string, reply: string): Promise<void> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      this.logger.warn(`Chưa có năm học đang dùng, không gửi thông báo trả lời ý kiến ${feedbackId}`);
      return;
    }
    await queueNotification(current.database, {
      orgUnitId: null,
      templateCode: 'feedback_reply',
      title: 'Ý kiến phản hồi đã được trả lời',
      body: `Ý kiến "${title}": ${reply.length > 500 ? `${reply.slice(0, 500)}…` : reply}`,
      targetType: 'feedback',
      targetId: feedbackId,
      recipients: [{ userId, channel: 'in_app' }],
    });
  }
}

@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // Gửi bằng biểu mẫu nhiều phần (có ảnh đính kèm) hoặc JSON; mọi tài khoản đăng nhập đều gửi được
  @Post('user-feedback')
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: MAXIMUM_ATTACHMENT_BYTES, files: 1 } }))
  submit(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = parseFeedbackInput(body);
    const attachment =
      file && file.size > 0
        ? { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer }
        : null;
    return this.feedbackService.submit(currentUser, input, attachment);
  }

  @Get('me/user-feedback')
  listOwn(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.feedbackService.listOwn(currentUser);
  }

  @Get('user-feedback')
  listAll(@Query('status') status: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (status !== undefined && status !== '' && !(FEEDBACK_STATUSES as string[]).includes(status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là new, in_progress hoặc resolved' }]);
    }
    return this.feedbackService.listAll(currentUser, status ? (status as UserFeedbackStatus) : undefined);
  }

  @Put('user-feedback/:id')
  update(
    @Param('id', uuidParameter('Mã ý kiến không hợp lệ')) feedbackId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.feedbackService.update(currentUser, feedbackId, parseFeedbackUpdate(body));
  }

  @Get('user-feedback/:id/attachment')
  async attachment(
    @Param('id', uuidParameter('Mã ý kiến không hợp lệ')) feedbackId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.feedbackService.attachment(currentUser, feedbackId);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.body);
  }
}
