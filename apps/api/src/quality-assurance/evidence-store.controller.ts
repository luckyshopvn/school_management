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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { validationError, type FieldError } from '@school-management/server';
import {
  EVIDENCE_RECORD_TYPE_LABELS,
  EVIDENCE_VALIDITY_LABELS,
  QUALITY_EVIDENCE_STATUS_LABELS,
  QUALITY_MAXIMUM_FILE_BYTES,
  type EvidenceRecordTypeCode,
  type EvidenceValidityCode,
  type QualityEvidenceStatusCode,
} from '@school-management/shared';
import type { Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import {
  readChoice,
  readDate,
  readInteger,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from '../incoming-documents/incoming-fields.js';
import {
  EVIDENCE_PERMISSIONS,
  EvidenceStoreService,
  type EvidenceCreateInput,
  type EvidenceItemInput,
} from './evidence-store.js';

// Điểm cuối của kho minh chứng dùng chung (YCTD-396 lát L1). Đường dẫn giữ `/quality/evidences` của 22f để trang 1.1 của
// phân hệ "Minh chứng và kiểm định" và liên kết cũ dùng tiếp. Bộ bảo vệ chặn người không có quyền nào của kho; quyền thêm,
// sửa, xóa và quyền xem nguồn kiểm ở dịch vụ
const EVIDENCE = 'Mã minh chứng không hợp lệ';

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function requiredUuid(value: unknown, field: string): string {
  if (!isUuid(value)) {
    throw validationError([{ field, message: 'Mã không hợp lệ' }]);
  }
  return value;
}

function readSchoolYears(body: RequestBody, errors: FieldError[]): string[] {
  const value = body?.school_year_names;
  if (value === undefined || value === null) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some((item) => typeof item !== 'string' || item.trim() === '' || item.length > 50)
  ) {
    errors.push({ field: 'school_year_names', message: 'Tối đa 20 năm học, mỗi tên từ 1 đến 50 ký tự' });
    return [];
  }
  return [...new Set((value as string[]).map((item) => item.trim()))];
}

function readItem(body: RequestBody, errors: FieldError[]): EvidenceItemInput {
  return {
    title: readText(body, 'title', errors, { required: true, maximum: 500 }) ?? '',
    document_number: readText(body, 'document_number', errors, { maximum: 100 }),
    issued_date: readDate(body, 'issued_date', errors),
    issuer: readText(body, 'issuer', errors, { maximum: 300 }),
    description: readText(body, 'description', errors, { maximum: 2000 }),
    valid_until: readDate(body, 'valid_until', errors),
    status: readChoice(body, 'status', QUALITY_EVIDENCE_STATUS_LABELS, 'missing', errors),
    school_year_names: readSchoolYears(body, errors),
    shared_node_ids: readUuidList(body, 'shared_node_ids', errors, 100),
  };
}

function readRecordType(value: unknown, field: string, errors: FieldError[]): EvidenceRecordTypeCode | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !(value in EVIDENCE_RECORD_TYPE_LABELS)) {
    errors.push({ field, message: 'Loại dữ liệu nguồn không hợp lệ' });
    return null;
  }
  return value as EvidenceRecordTypeCode;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, 200) : null;
}

@Controller('quality/evidences')
@RequirePermission(...EVIDENCE_PERMISSIONS)
export class EvidenceStoreController {
  constructor(private readonly store: EvidenceStoreService) {}

  @Get('frameworks')
  frameworks(@AuthenticatedUser() user: CurrentUser) {
    return this.store.frameworks(user);
  }

  @Get('sources')
  sources(
    @Query('record_type') recordType: string | undefined,
    @Query('q') q: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const type = readRecordType(recordType, 'record_type', errors);
    throwIfAny(errors);
    if (!type) {
      throw validationError([{ field: 'record_type', message: 'Bắt buộc chọn loại dữ liệu nguồn' }]);
    }
    return this.store.sources(user, type, text(q));
  }

  @Get('export')
  async export(
    @Query('framework_id') frameworkId: string | undefined,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.store.listFile(
      user,
      requiredUuid(frameworkId, 'framework_id'),
      readTableFileFormat(format) ?? 'xlsx',
    );
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }

  @Get()
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() user: CurrentUser) {
    const status =
      typeof query.status === 'string' && query.status in QUALITY_EVIDENCE_STATUS_LABELS ? query.status : null;
    const validity =
      typeof query.validity === 'string' && query.validity in EVIDENCE_VALIDITY_LABELS ? query.validity : null;
    return this.store.list(user, {
      framework_id: requiredUuid(query.framework_id, 'framework_id'),
      node_id: query.node_id === undefined || query.node_id === '' ? null : requiredUuid(query.node_id, 'node_id'),
      status: status as QualityEvidenceStatusCode | null,
      validity: validity as EvidenceValidityCode | null,
      q: text(query.q),
    });
  }

  @Post()
  create(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    const errors: FieldError[] = [];
    const input: EvidenceCreateInput = {
      ...readItem(body, errors),
      framework_id: readUuid(body, 'framework_id', errors, true) ?? '',
      node_id: readUuid(body, 'node_id', errors, true) ?? '',
      box: readInteger(body, 'box', errors, { min: 1, max: 99 }),
      record_type: readRecordType(body?.record_type, 'record_type', errors),
      record_id: readUuid(body, 'record_id', errors),
    };
    if (input.record_type && !input.record_id) {
      errors.push({ field: 'record_id', message: 'Bắt buộc chọn dữ liệu nguồn' });
    }
    throwIfAny(errors);
    return this.store.create(user, input);
  }

  @Get(':id')
  detail(@Param('id', uuidParameter(EVIDENCE)) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.store.detail(user, id);
  }

  @Put(':id')
  update(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const frameworkId = readUuid(body, 'framework_id', errors, true) ?? '';
    const input = readItem(body, errors);
    throwIfAny(errors);
    return this.store.update(user, id, frameworkId, input);
  }

  @Post(':id/codes')
  attach(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const frameworkId = readUuid(body, 'framework_id', errors, true) ?? '';
    const nodeId = readUuid(body, 'node_id', errors, true) ?? '';
    const box = readInteger(body, 'box', errors, { min: 1, max: 99 });
    throwIfAny(errors);
    return this.store.attach(user, id, frameworkId, nodeId, box);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', uuidParameter(EVIDENCE)) id: string, @AuthenticatedUser() user: CurrentUser) {
    await this.store.remove(user, id);
  }

  @Post(':id/versions')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: QUALITY_MAXIMUM_FILE_BYTES, files: 1 } }))
  addVersion(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const recordType = readRecordType(body?.record_type, 'record_type', errors);
    const recordId = readUuid(body, 'record_id', errors);
    const note = readText(body, 'note', errors, { maximum: 500 });
    throwIfAny(errors);
    if (recordType) {
      if (!recordId) {
        throw validationError([{ field: 'record_id', message: 'Bắt buộc chọn dữ liệu nguồn' }]);
      }
      return this.store.addRecord(user, id, recordType, recordId);
    }
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.store.addUpload(
      user,
      id,
      { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      note,
    );
  }

  @Get(':id/file')
  async file(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @Query('version') version: string | undefined,
    @Query('download') download: string | undefined,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const versionNo = version === undefined || version === '' ? null : Number(version);
    if (versionNo !== null && (!Number.isInteger(versionNo) || versionNo < 1)) {
      throw validationError([{ field: 'version', message: 'Số phiên bản không hợp lệ' }]);
    }
    const file = await this.store.file(user, id, versionNo, download === 'true');
    response.setHeader('content-type', file.content_type);
    response.setHeader(
      'content-disposition',
      `${download === 'true' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
    );
    response.setHeader('cache-control', 'no-store');
    response.send(file.body);
  }
}
