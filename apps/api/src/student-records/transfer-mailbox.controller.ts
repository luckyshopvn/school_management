import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApplicationError, Clock, readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { VIETNAM_DATE } from './student-records-common.js';
import { TransferMailboxService } from './transfer-mailbox.js';
import { OPTIONAL_TRANSFER_PARTS, type OptionalTransferPart } from './transfer-package-rules.js';

// Hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390 lát L2; tài liệu 17 giao kèo hộp thư chuyển trường)
@Controller('student-transfers')
export class TransferMailboxController {
  constructor(
    private readonly service: TransferMailboxService,
    private readonly clock: Clock,
  ) {}

  @Get('mailbox/settings')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  settings() {
    return this.service.settings();
  }

  // Bật, tắt nhận và gửi hồ sơ chuyển trường trong hệ thống (BR-510)
  @Put('mailbox/settings')
  @RequirePermission(PERMISSION_CODES.childApprove)
  updateSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    if (typeof body?.enabled !== 'boolean') {
      throw validationError([{ field: 'enabled', message: 'Bật hoặc tắt' }]);
    }
    return this.service.updateSettings(body.enabled, originOf(request, currentUser));
  }

  @Get('mailbox/directory')
  @RequirePermission(PERMISSION_CODES.childApprove)
  directory(@Query('q') query: string | undefined) {
    const text = query?.trim() || null;
    if (text && text.length > 100) {
      throw validationError([{ field: 'q', message: 'Tối đa 100 ký tự' }]);
    }
    return this.service.directory(text);
  }

  @Get('mailbox/inbox')
  @RequirePermission(PERMISSION_CODES.childApprove)
  inbox() {
    return this.service.inbox();
  }

  @Get('mailbox/outbox')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  outbox() {
    return this.service.outbox();
  }

  // Gửi gói qua hộp thư: cùng điều kiện lập gói của lát L1 (BR-480, BR-481) và trường đến trong danh bạ (BR-510, BR-511)
  @Post(':id/send')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  send(
    @Param('id', uuidParameter('Mã hồ sơ chuyển không hợp lệ')) transferId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (
      !currentUser.hasPermission(PERMISSION_CODES.dataExport) ||
      !currentUser.hasPermission(PERMISSION_CODES.nationalIdView)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Gói có số định danh, cần quyền xuất dữ liệu và xem số định danh');
    }
    const errors: FieldError[] = [];
    if (!isUuid(body?.to_school_id)) {
      errors.push({ field: 'to_school_id', message: 'Chọn trường đến trong danh bạ' });
    }
    const raw: unknown = body?.optional_parts ?? [];
    if (
      !Array.isArray(raw) ||
      raw.some((part) => !OPTIONAL_TRANSFER_PARTS.includes(part as OptionalTransferPart)) ||
      new Set(raw).size !== raw.length
    ) {
      errors.push({ field: 'optional_parts', message: 'Phần thêm là suc-khoe, khen-thuong' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.send(
      currentUser,
      transferId,
      {
        toSchoolId: body?.to_school_id as string,
        optionalParts: raw as OptionalTransferPart[],
        consentRecorded: body?.consent_recorded === true,
        applicationReceived: body?.application_received === true,
      },
      originOf(request, currentUser),
    );
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  revoke(
    @Param('id', uuidParameter('Mã hồ sơ chuyển không hợp lệ')) transferId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.revoke(currentUser, transferId, originOf(request, currentUser));
  }

  @Post('mailbox/:mailboxId/preview')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  preview(@Param('mailboxId', uuidParameter('Mã thư không hợp lệ')) mailboxId: string) {
    return this.service.preview(mailboxId);
  }

  // Tiếp nhận thư: như tiếp nhận gói bằng tệp (BR-482), thư chuyển sang "đã tiếp nhận" (BR-513)
  @Post('mailbox/:mailboxId/accept')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  accept(
    @Param('mailboxId', uuidParameter('Mã thư không hợp lệ')) mailboxId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.class_id)) {
      errors.push({ field: 'class_id', message: 'Chọn lớp' });
    }
    const today = VIETNAM_DATE.format(this.clock.now());
    const fromDate = typeof body?.from_date === 'string' && body.from_date ? body.from_date : today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || Number.isNaN(Date.parse(fromDate))) {
      errors.push({ field: 'from_date', message: 'Ngày dạng YYYY-MM-DD' });
    } else if (fromDate > today) {
      errors.push({ field: 'from_date', message: 'Ngày bắt đầu học không sau hôm nay' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.accept(
      currentUser,
      readBearerToken(request.header('authorization')),
      mailboxId,
      { classId: body?.class_id as string, fromDate, confirmOverCapacity: body?.confirm_over_capacity === true },
      originOf(request, currentUser),
    );
  }

  @Post('mailbox/:mailboxId/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  reject(
    @Param('mailboxId', uuidParameter('Mã thư không hợp lệ')) mailboxId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const note = typeof body?.note === 'string' ? body.note : '';
    return this.service.reject(currentUser, mailboxId, note, originOf(request, currentUser));
  }
}
