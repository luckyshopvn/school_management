import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { SigningDossierStatus, SigningObjectType, SigningSignatureType } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES, SIGNING_OBJECT_TYPES, SIGNING_SIGNATURE_TYPE_LABELS } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { isSigningMonth } from './signing-content.js';
import { MAXIMUM_BATCH, MAXIMUM_SEAL_BYTES, SigningService, type CertificateInput } from './signing.js';

// Điểm cuối của phân hệ Quản lý kí hồ sơ (DT-16 phần 16k). Bộ bảo vệ chỉ chặn người không có quyền nào của phân hệ; quyền
// của từng thao tác và phạm vi toàn trường kiểm tra trong dịch vụ
const ALL = [
  PERMISSION_CODES.signingView,
  PERMISSION_CODES.signingManage,
  PERMISSION_CODES.signingSign,
  PERMISSION_CODES.signingCertificate,
];
const DOSSIER_MESSAGE = 'Mã hồ sơ không hợp lệ';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_TYPES = SIGNING_OBJECT_TYPES.map((type) => type.value);
const STATUSES: SigningDossierStatus[] = ['created', 'signed', 'completed', 'sent', 'cancelled'];
const SIGNATURE_TYPES = Object.keys(SIGNING_SIGNATURE_TYPE_LABELS) as SigningSignatureType[];
const MAXIMUM_TEXT = 200;
const MAXIMUM_NOTE = 500;

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function readText(body: RequestBody, field: string, errors: FieldError[], maximum = MAXIMUM_TEXT): string | null {
  const value = readOptionalText(body, field, errors) ?? null;
  if (value && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value;
}

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

function readIds(body: RequestBody, errors: FieldError[]): string[] {
  const value = body?.ids;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAXIMUM_BATCH || !value.every(isUuid)) {
    errors.push({ field: 'ids', message: `Chọn từ 1 đến ${MAXIMUM_BATCH} hồ sơ` });
    return [];
  }
  return [...new Set(value)];
}

function readObjectType(value: unknown, errors: FieldError[], field = 'object_type'): SigningObjectType {
  if (!OBJECT_TYPES.includes(value as SigningObjectType)) {
    errors.push({ field, message: 'Loại hồ sơ không hợp lệ' });
  }
  return value as SigningObjectType;
}

function readPeriod(type: SigningObjectType, value: unknown, errors: FieldError[]): string {
  if (type !== 'class_log') {
    return '';
  }
  if (!isSigningMonth(value)) {
    errors.push({ field: 'period', message: 'Chọn tháng của sổ đầu bài (YYYY-MM)' });
    return '';
  }
  return value;
}

function throwIfAny(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller('signing')
@RequirePermission(...ALL)
export class SigningController {
  constructor(private readonly signing: SigningService) {}

  @Get('certificate')
  certificate(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.signing.certificate(currentUser);
  }

  @Put('certificate')
  saveCertificate(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const signatureType = body?.signature_type;
    if (!SIGNATURE_TYPES.includes(signatureType as SigningSignatureType)) {
      errors.push({ field: 'signature_type', message: 'Chọn kiểu chữ ký' });
    }
    const input: CertificateInput = {
      signature_type: signatureType as SigningSignatureType,
      provider: readText(body, 'provider', errors),
      login_name: readText(body, 'login_name', errors),
      holder_name: readText(body, 'holder_name', errors),
      holder_title: readText(body, 'holder_title', errors),
      serial_number: readText(body, 'serial_number', errors),
      valid_from: readDate(body, 'valid_from', errors, false),
      valid_to: readDate(body, 'valid_to', errors, false),
    };
    // Bản nội bộ không giữ mật khẩu, mã PIN hay khóa bí mật của chứng thư
    for (const field of ['password', 'pin', 'private_key']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Phần mềm không lưu mật khẩu, mã PIN hay khóa bí mật của chứng thư' });
      }
    }
    throwIfAny(errors);
    return this.signing.saveCertificate(currentUser, input);
  }

  @Post('certificate/register')
  @HttpCode(200)
  register(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.signing.registerCertificate(currentUser);
  }

  @Post('certificate/revoke')
  @HttpCode(200)
  revoke(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.signing.revokeCertificate(currentUser);
  }

  @Post('certificate/seal')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_SEAL_BYTES + 1, files: 1 } }))
  uploadSeal(@UploadedFile() file: UploadedPart | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Chọn ảnh con dấu' }]);
    }
    return this.signing.uploadSeal(currentUser, {
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      body: file.buffer,
    });
  }

  @Get('certificate/seal')
  async seal(@Res() response: Response, @AuthenticatedUser() currentUser: CurrentUser) {
    const seal = await this.signing.seal(currentUser);
    response.setHeader('content-type', seal.contentType);
    response.setHeader('cache-control', 'no-store');
    response.send(seal.body);
  }

  @Delete('certificate/seal')
  deleteSeal(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.signing.deleteSeal(currentUser);
  }

  @Post('certificate/sync')
  @HttpCode(200)
  markSynced(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const syncedOn = readDate(body, 'synced_on', errors, true);
    const note = readText(body, 'note', errors, MAXIMUM_NOTE);
    throwIfAny(errors);
    return this.signing.markSynced(currentUser, { syncedOn: syncedOn!, note });
  }

  @Post('certificate/unsync')
  @HttpCode(200)
  unmarkSynced(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.signing.unmarkSynced(currentUser);
  }

  @Get('objects')
  async objects(
    @Query('object_type') objectType: string | undefined,
    @Query('period') period: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const type = readObjectType(objectType, errors);
    const month = errors.length === 0 ? readPeriod(type, period, errors) : '';
    throwIfAny(errors);
    return { items: await this.signing.objects(currentUser, type, month) };
  }

  @Post('dossiers')
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const type = readObjectType(body?.object_type, errors);
    const period = errors.length === 0 ? readPeriod(type, body?.period, errors) : '';
    const objectIds = body?.object_ids;
    if (
      !Array.isArray(objectIds) ||
      objectIds.length === 0 ||
      objectIds.length > MAXIMUM_BATCH ||
      !objectIds.every(isUuid)
    ) {
      errors.push({ field: 'object_ids', message: `Chọn từ 1 đến ${MAXIMUM_BATCH} đối tượng` });
    }
    throwIfAny(errors);
    return this.signing.create(currentUser, {
      objectType: type,
      objectIds: [...new Set(objectIds as string[])],
      period,
    });
  }

  @Post('dossiers/sign')
  @HttpCode(200)
  sign(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    throwIfAny(errors);
    return this.signing.sign(currentUser, ids);
  }

  @Post('dossiers/check-changes')
  @HttpCode(200)
  checkChanges(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    throwIfAny(errors);
    return this.signing.checkChanges(currentUser, ids);
  }

  @Post('dossiers/complete')
  @HttpCode(200)
  complete(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    throwIfAny(errors);
    return this.signing.complete(currentUser, ids);
  }

  @Post('dossiers/mark-sent')
  @HttpCode(200)
  markSent(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    const sentOn = readDate(body, 'sent_on', errors, true);
    const note = readText(body, 'note', errors, MAXIMUM_NOTE);
    throwIfAny(errors);
    return this.signing.markSent(currentUser, ids, { sentOn: sentOn!, note });
  }

  @Get('submissions')
  async submissions(
    @Query('object_type') objectType: string | undefined,
    @Query('status') status: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const type = objectType ? readObjectType(objectType, errors) : undefined;
    if (status && !STATUSES.includes(status as SigningDossierStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
    }
    throwIfAny(errors);
    return {
      items: await this.signing.submissions(currentUser, {
        objectType: type,
        status: (status || undefined) as SigningDossierStatus | undefined,
      }),
    };
  }

  @Post('class-log/export')
  @HttpCode(200)
  async exportClassLog(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.class_id)) {
      errors.push({ field: 'class_id', message: 'Chọn lớp' });
    }
    if (!isSigningMonth(body?.month)) {
      errors.push({ field: 'month', message: 'Chọn tháng (YYYY-MM)' });
    }
    throwIfAny(errors);
    sendWorkbook(
      response,
      await this.signing.exportClassLog(
        currentUser,
        body!.class_id as string,
        body!.month as string,
        request.ip ?? null,
      ),
    );
  }

  @Get('dossiers/:id')
  read(@Param('id', uuidParameter(DOSSIER_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.signing.read(currentUser, id);
  }

  @Get('dossiers/:id/file')
  async file(
    @Param('id', uuidParameter(DOSSIER_MESSAGE)) id: string,
    @Query('version') version: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (version !== undefined && version !== 'original' && version !== 'signed') {
      throw validationError([{ field: 'version', message: 'Chọn tệp gốc hoặc tệp đã kí' }]);
    }
    sendWorkbook(
      response,
      await this.signing.file(currentUser, id, version === 'signed' ? 'signed' : 'original', request.ip ?? null),
    );
  }

  @Post('dossiers/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter(DOSSIER_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, MAXIMUM_NOTE);
    if (!reason) {
      errors.push({ field: 'reason', message: 'Nhập lý do hủy hồ sơ' });
    }
    throwIfAny(errors);
    return this.signing.cancel(currentUser, id, reason!);
  }

  @Post('dossiers/:id/uncomplete')
  @HttpCode(200)
  uncomplete(
    @Param('id', uuidParameter(DOSSIER_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, MAXIMUM_NOTE);
    throwIfAny(errors);
    return this.signing.uncomplete(currentUser, id, reason);
  }
}
