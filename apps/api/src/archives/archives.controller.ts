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
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { parseFondInput, parseHoldingInput, parseRecordInput, readRecordFilter } from './archive-fields.js';
import {
  ARCHIVE_RECORD_EXPORT_COLUMNS,
  ArchivesService,
  DEFAULT_ARCHIVE_RECORD_EXPORT_COLUMNS,
  MAXIMUM_ARCHIVE_FILE_BYTES,
  type ArchiveReportFilter,
} from './archives.js';

// Phần tệp do bộ nhận tệp nhiều phần của Express trả về
interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const VIEW = PERMISSION_CODES.archiveView;
const MANAGE = PERMISSION_CODES.archiveManage;
const EXPORT = PERMISSION_CODES.archiveExport;
const FOND_MESSAGE = 'Mã phông không hợp lệ';
const HOLDING_MESSAGE = 'Mã thông tin lưu trữ không hợp lệ';
const RECORD_MESSAGE = 'Mã hồ sơ không hợp lệ';
const FILE_MESSAGE = 'Mã tệp không hợp lệ';

function readReportFilter(query: Record<string, unknown>): ArchiveReportFilter {
  const errors: FieldError[] = [];
  const fondId = typeof query.fond_id === 'string' && query.fond_id !== '' ? query.fond_id : null;
  if (fondId && !isUuid(fondId)) {
    errors.push({ field: 'fond_id', message: FOND_MESSAGE });
  }
  const location = typeof query.storage_location === 'string' ? query.storage_location.trim() : '';
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { fond_id: fondId, storage_location: location || null };
}

// Văn thư lưu trữ (DT-15 phần 15h2, YCTD-118). Xem cần P09.archive.view; người có quyền quản lý hoặc xuất cũng xem được
// để dùng màn hình của mình. Thêm, sửa, xóa, đính kèm cần P09.archive.manage; xuất Excel cần P09.archive.export và ghi
// nhật ký xuất (BR-74). Máy chủ kiểm tra quyền ở mọi yêu cầu (AI-12)
@Controller()
export class ArchivesController {
  constructor(private readonly archives: ArchivesService) {}

  // ---- Phông lưu trữ ----

  @Get('archive-fonds')
  @RequirePermission(VIEW, MANAGE, EXPORT)
  listFonds() {
    return this.archives.listFonds();
  }

  @Post('archive-fonds')
  @RequirePermission(MANAGE)
  createFond(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.archives.createFond(parseFondInput(body), originOf(request, currentUser));
  }

  @Put('archive-fonds/:id')
  @RequirePermission(MANAGE)
  updateFond(
    @Param('id', uuidParameter(FOND_MESSAGE)) fondId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.archives.updateFond(fondId, parseFondInput(body), originOf(request, currentUser));
  }

  @Delete('archive-fonds/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteFond(
    @Param('id', uuidParameter(FOND_MESSAGE)) fondId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.archives.deleteFond(fondId, originOf(request, currentUser));
  }

  // ---- Thông tin lưu trữ ----

  @Get('archive-holdings')
  @RequirePermission(VIEW, MANAGE, EXPORT)
  listHoldings(@Query('fond_id') fondId: string | undefined) {
    if (fondId && !isUuid(fondId)) {
      throw validationError([{ field: 'fond_id', message: FOND_MESSAGE }]);
    }
    return this.archives.listHoldings(fondId || null);
  }

  @Post('archive-holdings')
  @RequirePermission(MANAGE)
  createHolding(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.archives.createHolding(parseHoldingInput(body), originOf(request, currentUser));
  }

  @Put('archive-holdings/:id')
  @RequirePermission(MANAGE)
  updateHolding(
    @Param('id', uuidParameter(HOLDING_MESSAGE)) holdingId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.archives.updateHolding(holdingId, parseHoldingInput(body), originOf(request, currentUser));
  }

  @Delete('archive-holdings/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteHolding(
    @Param('id', uuidParameter(HOLDING_MESSAGE)) holdingId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.archives.deleteHolding(holdingId, originOf(request, currentUser));
  }

  // ---- Báo cáo lưu trữ ----

  @Get('archive-report')
  @RequirePermission(VIEW, MANAGE, EXPORT)
  report(@Query() query: Record<string, unknown>) {
    return this.archives.report(readReportFilter(query));
  }

  @Post('archive-report/export')
  @HttpCode(200)
  @RequirePermission(EXPORT)
  async exportReport(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const filter = readReportFilter(body ?? {});
    sendWorkbook(response, await this.archives.exportReport(currentUser, filter, request.ip ?? null));
  }

  // ---- Hồ sơ tài liệu ----

  @Get('archive-records')
  @RequirePermission(VIEW, MANAGE, EXPORT)
  searchRecords(@Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 200' });
    }
    const filter = readRecordFilter(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.archives.searchRecords(filter, page, pageSize);
  }

  // Xuất theo bộ lọc và các cột đang hiện trên lưới
  @Post('archive-records/export')
  @HttpCode(200)
  @RequirePermission(EXPORT)
  async exportRecords(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readRecordFilter(body ?? {}, errors);
    const rawColumns = body?.columns;
    let columns = DEFAULT_ARCHIVE_RECORD_EXPORT_COLUMNS;
    if (rawColumns !== undefined && rawColumns !== null) {
      if (
        !Array.isArray(rawColumns) ||
        rawColumns.length === 0 ||
        rawColumns.some((id) => !ARCHIVE_RECORD_EXPORT_COLUMNS.some((column) => column.id === id)) ||
        new Set(rawColumns).size !== rawColumns.length
      ) {
        errors.push({ field: 'columns', message: 'Danh sách cột không hợp lệ' });
      } else {
        columns = rawColumns as string[];
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.archives.exportRecords(currentUser, filter, columns, request.ip ?? null));
  }

  @Get('archive-records/:id')
  @RequirePermission(VIEW, MANAGE, EXPORT)
  readRecord(@Param('id', uuidParameter(RECORD_MESSAGE)) recordId: string) {
    return this.archives.findRecord(recordId);
  }

  @Post('archive-records')
  @RequirePermission(MANAGE)
  createRecord(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.archives.createRecord(parseRecordInput(body), originOf(request, currentUser));
  }

  @Put('archive-records/:id')
  @RequirePermission(MANAGE)
  updateRecord(
    @Param('id', uuidParameter(RECORD_MESSAGE)) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.archives.updateRecord(recordId, parseRecordInput(body), originOf(request, currentUser));
  }

  @Delete('archive-records/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteRecord(
    @Param('id', uuidParameter(RECORD_MESSAGE)) recordId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.archives.deleteRecord(recordId, originOf(request, currentUser));
  }

  // ---- Tệp đính kèm ----

  @Post('archive-records/:id/files')
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_ARCHIVE_FILE_BYTES + 1, files: 1 } }))
  addFile(
    @Param('id', uuidParameter(RECORD_MESSAGE)) recordId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Chọn tệp đính kèm' }]);
    }
    return this.archives.addFile(
      recordId,
      { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      originOf(request, currentUser),
    );
  }

  @Get('archive-records/:id/files/:fileId')
  @RequirePermission(VIEW, MANAGE, EXPORT)
  async readFile(
    @Param('id', uuidParameter(RECORD_MESSAGE)) recordId: string,
    @Param('fileId', uuidParameter(FILE_MESSAGE)) fileId: string,
    @Res() response: Response,
  ) {
    const file = await this.archives.readFile(recordId, fileId);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.body);
  }

  @Delete('archive-records/:id/files/:fileId')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteFile(
    @Param('id', uuidParameter(RECORD_MESSAGE)) recordId: string,
    @Param('fileId', uuidParameter(FILE_MESSAGE)) fileId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.archives.deleteFile(recordId, fileId, originOf(request, currentUser));
  }
}
