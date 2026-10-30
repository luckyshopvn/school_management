import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationError, Clock, readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { VIETNAM_DATE } from './student-records-common.js';
import { TransferPackagesService } from './transfer-packages.js';
import {
  MAXIMUM_TRANSFER_PACKAGE_BYTES,
  OPTIONAL_TRANSFER_PARTS,
  type OptionalTransferPart,
} from './transfer-package-rules.js';

interface UploadedPart {
  size: number;
  buffer: Buffer;
}

const readPassword = (body: RequestBody, errors: FieldError[]) => {
  const value = body?.password;
  if (typeof value !== 'string' || value.replace(/[^A-Za-z0-9]/g, '').length !== 16) {
    errors.push({ field: 'password', message: 'Nhập mật khẩu 16 ký tự in trên bản in của gói' });
    return '';
  }
  return value;
};

// Gói chuyển trường, lát L1 (YCTD-390; tài liệu 17 mục gói chuyển trường)
@Controller('student-transfers')
export class TransferPackagesController {
  constructor(
    private readonly service: TransferPackagesService,
    private readonly clock: Clock,
  ) {}

  // Lập gói cho đề nghị chuyển đi: tệp gói và bản in trả về một lần, mật khẩu không lưu (BR-480, BR-481)
  @Post(':id/package')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  build(
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
    const raw: unknown = body?.optional_parts ?? [];
    if (
      !Array.isArray(raw) ||
      raw.some((part) => !OPTIONAL_TRANSFER_PARTS.includes(part as OptionalTransferPart)) ||
      new Set(raw).size !== raw.length
    ) {
      throw validationError([{ field: 'optional_parts', message: 'Phần thêm là suc-khoe, khen-thuong' }]);
    }
    return this.service.build(
      currentUser,
      transferId,
      {
        optionalParts: raw as OptionalTransferPart[],
        consentRecorded: body?.consent_recorded === true,
        applicationReceived: body?.application_received === true,
      },
      request.ip ?? null,
      originOf(request, currentUser),
    );
  }

  @Post('package/preview')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_TRANSFER_PACKAGE_BYTES, files: 1 } }))
  preview(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Chọn tệp gói chuyển trường' });
    }
    const password = readPassword(body, errors);
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.service.preview(currentUser, file.buffer, password);
  }

  // Tiếp nhận: hồ sơ Đang học, xếp lớp từ ngày bắt đầu học (BR-482)
  @Post('package/accept')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_TRANSFER_PACKAGE_BYTES, files: 1 } }))
  accept(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Chọn tệp gói chuyển trường' });
    }
    const password = readPassword(body, errors);
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
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.service.accept(
      currentUser,
      readBearerToken(request.header('authorization')),
      {
        body: file.buffer,
        password,
        classId: body?.class_id as string,
        fromDate,
        confirmOverCapacity: body?.confirm_over_capacity === true || body?.confirm_over_capacity === 'true',
      },
      originOf(request, currentUser),
    );
  }

  // Học bạ nhận từ trường khác của một học sinh (BR-483)
  @Get('received-learning-records')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  receivedLearningRecords(
    @Query('child_id') childId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(childId)) {
      throw validationError([{ field: 'child_id', message: 'Chọn học sinh' }]);
    }
    return this.service.receivedLearningRecords(currentUser, childId as string);
  }

  @Get('received-learning-records/:id/file')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  async receivedLearningRecordFile(
    @Param('id', uuidParameter('Mã học bạ không hợp lệ')) recordId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { fileName, pdf } = await this.service.receivedLearningRecordFile(currentUser, recordId);
    response.setHeader('content-type', 'application/pdf');
    response.setHeader('content-disposition', `attachment; filename="${fileName}"`);
    response.send(pdf);
  }
}
