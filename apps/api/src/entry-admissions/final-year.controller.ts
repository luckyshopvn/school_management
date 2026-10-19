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
import { validationError, type FieldError } from '@school-management/server';
import { FINAL_YEAR_FILE_KINDS, PERMISSION_CODES, type FinalYearFileKind } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import { MAXIMUM_IMPORT_BYTES } from '../imports/excel.js';
import { readFinalYearFilter, readFinalYearInput, FinalYearRecordsService } from './final-year-records.js';

// Điểm cuối của 1.1, 1.2, 4.1 (cổng quản trị) và màn hình Hồ sơ cuối cấp của ứng dụng phụ huynh (DT-17 phần 17c)
const VIEW = [PERMISSION_CODES.finalYearView, PERMISSION_CODES.finalYearManage, PERMISSION_CODES.finalYearApprove];
const MANAGE = PERMISSION_CODES.finalYearManage;
const MAXIMUM_SELECTED = 1000;

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readIds(body: RequestBody, errors: FieldError[], field = 'ids'): string[] {
  const value = body?.[field];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAXIMUM_SELECTED ||
    value.some((id) => !isUuid(id))
  ) {
    errors.push({ field, message: `Chọn từ 1 đến ${MAXIMUM_SELECTED} hồ sơ` });
    return [];
  }
  return [...new Set(value as string[])];
}

function readUpload(file: UploadedPart | undefined, body: RequestBody, errors: FieldError[]) {
  const kind = body?.kind as FinalYearFileKind;
  if (!FINAL_YEAR_FILE_KINDS.some((item) => item.value === kind)) {
    errors.push({ field: 'kind', message: 'Loại giấy tờ là birth_certificate, residence hoặc evidence' });
  }
  if (!file || file.size === 0) {
    errors.push({ field: 'file', message: 'Bắt buộc chọn tệp' });
  }
  check(errors);
  return {
    kind,
    fileName: Buffer.from(file!.originalname, 'latin1').toString('utf8'),
    body: file!.buffer,
  };
}

function sendFile(response: Response, file: { buffer: Buffer; fileName: string; contentType: string; logId: string }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('x-export-log-id', file.logId);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

@Controller('final-year-records')
export class FinalYearRecordsController {
  constructor(private readonly records: FinalYearRecordsService) {}

  @Get()
  @RequirePermission(...VIEW)
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readFinalYearFilter(query, errors);
    check(errors);
    return this.records.list(currentUser, filter);
  }

  @Get('settings')
  @RequirePermission(...VIEW)
  settings(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.readSettings(currentUser);
  }

  // Hạn điều chỉnh thông tin (ngày YYYY-MM-DD, trống là bỏ hạn)
  @Put('settings')
  @RequirePermission(MANAGE)
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const value = body?.edit_deadline;
    if (
      value !== null &&
      value !== '' &&
      (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
    ) {
      throw validationError([{ field: 'edit_deadline', message: 'Ngày dạng YYYY-MM-DD' }]);
    }
    return this.records.saveSettings(
      currentUser,
      typeof value === 'string' && value !== '' ? value : null,
      originOf(request, currentUser),
    );
  }

  @Post('actions')
  @HttpCode(200)
  @RequirePermission(MANAGE, PERMISSION_CODES.finalYearApprove)
  act(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const action = body?.action;
    if (action !== 'confirm' && action !== 'edited' && action !== 'approve' && action !== 'unapprove') {
      errors.push({ field: 'action', message: 'Thao tác là confirm, edited, approve hoặc unapprove' });
    }
    const ids = readIds(body, errors);
    check(errors);
    return this.records.act(
      currentUser,
      action as 'confirm' | 'edited' | 'approve' | 'unapprove',
      ids,
      originOf(request, currentUser),
    );
  }

  @Post('accounts')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  accounts(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    check(errors);
    return this.records.accounts(currentUser, ids);
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async export(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readFinalYearFilter((body?.filter as Record<string, unknown>) ?? {}, errors);
    check(errors);
    sendWorkbook(response, await this.records.exportWorkbook(currentUser, filter, request.ip ?? null));
  }

  // Xuất PDF A5 hoặc A4 gập đôi; toàn bộ (theo bộ lọc) hoặc hồ sơ chọn; một tệp hoặc tách tệp; In phiếu kê khai, phiếu
  // thông tin dùng cùng điểm cuối với kind
  @Post('pdf')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async pdf(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const format = body?.format;
    if (format !== 'a5' && format !== 'a4_folded') {
      errors.push({ field: 'format', message: 'Khổ giấy là a5 hoặc a4_folded' });
    }
    const kind = body?.kind ?? 'information';
    if (kind !== 'information' && kind !== 'declaration') {
      errors.push({ field: 'kind', message: 'Loại phiếu là information hoặc declaration' });
    }
    const ids = body?.ids === undefined || body?.ids === null ? null : readIds(body, errors);
    const filter = readFinalYearFilter((body?.filter as Record<string, unknown>) ?? {}, errors);
    check(errors);
    sendFile(
      response,
      await this.records.pdf(
        currentUser,
        {
          format: format as 'a5' | 'a4_folded',
          kind: kind as 'information' | 'declaration',
          split: body?.split === true,
          ids,
          filter,
        },
        request.ip ?? null,
      ),
    );
  }

  // Cập nhật từ Excel; error_file=true trả tệp đã tải lên kèm cột nội dung lỗi ("Tải danh sách lỗi")
  @Post('import')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  async import(
    @UploadedFile() file: UploadedPart | undefined,
    @Query('error_file') errorFile: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp Excel' }]);
    }
    const result = await this.records.importWorkbook(
      currentUser,
      file.buffer,
      originOf(request, currentUser),
      errorFile === 'true',
    );
    if ('errorWorkbook' in result) {
      response.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      response.setHeader('content-disposition', 'attachment; filename="danh-sach-loi-ho-so-cuoi-cap.xlsx"');
      response.setHeader('cache-control', 'no-store');
      response.send(result.errorWorkbook);
      return;
    }
    response.json(result);
  }

  @Get('files/:fileId')
  async download(
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.records.download(currentUser, fileId);
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Delete('files/:fileId')
  removeFile(
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.removeFile(currentUser, fileId, originOf(request, currentUser));
  }

  @Put(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readFinalYearInput(body, errors);
    check(errors);
    return this.records.update(currentUser, recordId, input, originOf(request, currentUser));
  }

  @Get(':id/events')
  @RequirePermission(...VIEW)
  events(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.events(currentUser, recordId);
  }

  @Post(':id/files')
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  attach(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = readUpload(file, body, []);
    return this.records.attachBySchool(currentUser, recordId, input, originOf(request, currentUser));
  }
}

@Controller('final-year-completion')
export class FinalYearCompletionController {
  constructor(private readonly records: FinalYearRecordsService) {}

  @Get()
  @RequirePermission(...VIEW)
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.completion(currentUser);
  }

  @Put()
  @RequirePermission(MANAGE)
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const items = body?.items;
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 500 ||
      items.some(
        (item) =>
          typeof item !== 'object' ||
          item === null ||
          !isUuid((item as Record<string, unknown>).class_id) ||
          typeof (item as Record<string, unknown>).confirmed !== 'boolean',
      )
    ) {
      throw validationError([{ field: 'items', message: 'Danh sách lớp gồm class_id và confirmed (true/false)' }]);
    }
    return this.records.saveCompletion(
      currentUser,
      items as Array<{ class_id: string; confirmed: boolean }>,
      originOf(request, currentUser),
    );
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async export(@Req() request: Request, @Res() response: Response, @AuthenticatedUser() currentUser: CurrentUser) {
    sendWorkbook(response, await this.records.exportCompletion(currentUser, request.ip ?? null));
  }
}

@Controller('final-year-statistics')
export class FinalYearStatisticsController {
  constructor(private readonly records: FinalYearRecordsService) {}

  @Get()
  @RequirePermission(...VIEW)
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.statistics(currentUser);
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async export(@Req() request: Request, @Res() response: Response, @AuthenticatedUser() currentUser: CurrentUser) {
    sendWorkbook(response, await this.records.exportStatistics(currentUser, request.ip ?? null));
  }
}

// Ứng dụng phụ huynh: không cần quyền, máy chủ kiểm tra quan hệ phụ huynh của trẻ ở từng hồ sơ
@Controller('parent/final-year-records')
export class ParentFinalYearController {
  constructor(private readonly records: FinalYearRecordsService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.listForParent(currentUser);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.parentAct(currentUser, recordId, 'parent_confirm', null, originOf(request, currentUser));
  }

  @Post(':id/propose')
  @HttpCode(200)
  propose(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    return this.records.parentAct(
      currentUser,
      recordId,
      'parent_propose',
      content || null,
      originOf(request, currentUser),
    );
  }

  @Post(':id/consent')
  @HttpCode(200)
  consent(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (typeof body?.consent !== 'boolean') {
      throw validationError([{ field: 'consent', message: 'Chọn đồng ý (true) hoặc chưa đồng ý (false)' }]);
    }
    return this.records.parentConsent(currentUser, recordId, body.consent, originOf(request, currentUser));
  }

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  attach(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) recordId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = readUpload(file, body, []);
    return this.records.parentAttach(currentUser, recordId, input, originOf(request, currentUser));
  }
}
