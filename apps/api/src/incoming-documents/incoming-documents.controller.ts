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
import { INCOMING_MAXIMUM_FILE_BYTES, PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { INCOMING_PERMISSIONS } from './document-admin.js';
import {
  isDate,
  MAXIMUM_LONG_TEXT,
  parseDocumentInput,
  parseRegistration,
  parseTransfer,
  readBoolean,
  readDate,
  readIds,
  readListFilter,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from './incoming-fields.js';
import { IncomingDocumentsService } from './incoming-documents.js';
import { IncomingPrintService, SLIP_TYPES, type SlipType } from './incoming-print.js';

// Điểm cuối của văn bản đến (DT-18 phần 18a, YCTD-138). Bộ bảo vệ chỉ chặn người không có quyền nào của phân hệ; quyền văn
// thư, quyền trong luồng xử lý và phạm vi toàn trường kiểm tra ở dịch vụ
const REGISTER = PERMISSION_CODES.incomingDocumentRegister;
const DOCUMENT_MESSAGE = 'Mã văn bản không hợp lệ';
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function readNote(body: RequestBody, required = false): string | null {
  const errors: FieldError[] = [];
  const note = readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT, required });
  throwIfAny(errors);
  return note;
}

function readPage(query: Record<string, unknown>): { page: number; pageSize: number } {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.page_size ?? 20);
  if (!Number.isInteger(page) || page < 1 || !PAGE_SIZES.has(pageSize)) {
    throw validationError([{ field: 'page', message: 'Trang hoặc số dòng mỗi trang không hợp lệ' }]);
  }
  return { page, pageSize };
}

function readRange(query: Record<string, unknown>) {
  const pick = (field: string) => {
    const value = query[field];
    if (value === undefined || value === '') {
      return null;
    }
    if (!isDate(value)) {
      throw validationError([{ field, message: 'Ngày dạng YYYY-MM-DD' }]);
    }
    return value;
  };
  return { from: pick('from'), to: pick('to') };
}

@Controller()
@RequirePermission(...INCOMING_PERMISSIONS)
export class IncomingDocumentsController {
  constructor(
    private readonly documents: IncomingDocumentsService,
    private readonly print: IncomingPrintService,
  ) {}

  @Get('incoming-documents')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const { page, pageSize } = readPage(query);
    return this.documents.list(currentUser, readListFilter(query), page, pageSize);
  }

  @Get('incoming-documents/next-number')
  @RequirePermission(REGISTER)
  nextNumber(@Query('book_id') bookId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readUuid({ book_id: bookId }, 'book_id', errors, true);
    throwIfAny(errors);
    return this.documents.nextNumber(currentUser, id as string);
  }

  // Vào sổ văn bản đến (biểu mẫu Thêm mới)
  @Post('incoming-documents')
  @RequirePermission(REGISTER)
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = parseDocumentInput(body, errors);
    const registration = parseRegistration(body, errors);
    throwIfAny(errors);
    return this.documents.create(currentUser, input, registration);
  }

  // Nhập văn bản nhận qua trục liên thông (bản chạy nội bộ), chờ vào sổ
  @Post('incoming-documents/interconnect')
  @RequirePermission(REGISTER)
  receive(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = parseDocumentInput(body, errors);
    throwIfAny(errors);
    return this.documents.create(currentUser, input, null);
  }

  @Post('incoming-documents/complete')
  @HttpCode(200)
  completeMany(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    const note = readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT });
    throwIfAny(errors);
    return this.documents.completeMany(currentUser, ids, note);
  }

  @Post('incoming-documents/archive')
  @HttpCode(200)
  archiveMany(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    const recordId = readUuid(body, 'archive_record_id', errors, true);
    throwIfAny(errors);
    return this.documents.archiveMany(currentUser, ids, recordId as string);
  }

  @Post('incoming-documents/flags')
  @HttpCode(200)
  flags(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    const flags: { starred?: boolean; followed?: boolean } = {};
    for (const field of ['starred', 'followed'] as const) {
      if (body?.[field] !== undefined) {
        flags[field] = readBoolean(body, field, errors);
      }
    }
    if (flags.starred === undefined && flags.followed === undefined) {
      errors.push({ field: 'starred', message: 'Chọn đánh dấu hoặc theo dõi' });
    }
    throwIfAny(errors);
    return this.documents.setFlags(currentUser, ids, flags);
  }

  @Get('incoming-documents/:id')
  detail(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.documents.detail(currentUser, id);
  }

  @Put('incoming-documents/:id')
  update(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = parseDocumentInput(body, errors);
    throwIfAny(errors);
    return this.documents.update(currentUser, id, input);
  }

  @Delete('incoming-documents/:id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.documents.remove(currentUser, id);
  }

  @Post('incoming-documents/:id/register')
  @HttpCode(200)
  register(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const registration = parseRegistration(body, errors);
    throwIfAny(errors);
    return this.documents.register(currentUser, id, registration);
  }

  @Post('incoming-documents/:id/acknowledge')
  @HttpCode(200)
  acknowledge(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const acknowledged = readBoolean(body, 'acknowledged', errors, true);
    const reference = readText(body, 'reference', errors, { maximum: 200 });
    throwIfAny(errors);
    return this.documents.acknowledge(currentUser, id, acknowledged, reference);
  }

  @Post('incoming-documents/:id/files')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: INCOMING_MAXIMUM_FILE_BYTES + 1, files: 1 } }))
  addFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Chọn tệp đính kèm' }]);
    }
    const kind = body?.kind === 'related' ? 'related' : 'main';
    return this.documents.addFile(currentUser, id, {
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      body: file.buffer,
      kind,
      scanned: body?.scanned === 'true',
    });
  }

  @Get('incoming-documents/:id/files/:fileId')
  async readFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.documents.readFile(currentUser, id, fileId);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.body);
  }

  @Delete('incoming-documents/:id/files/:fileId')
  deleteFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.deleteFile(currentUser, id, fileId);
  }

  @Put('incoming-documents/:id/relations')
  relations(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const ids = readUuidList(body, 'related_ids', errors, 50);
    throwIfAny(errors);
    return this.documents.setRelations(currentUser, id, ids);
  }

  @Post('incoming-documents/:id/transfer')
  @HttpCode(200)
  transfer(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.transfer(currentUser, id, parseTransfer(body));
  }

  @Post('incoming-documents/:id/return')
  @HttpCode(200)
  giveBack(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.giveBack(currentUser, id, false, readNote(body, true));
  }

  @Post('incoming-documents/:id/refuse')
  @HttpCode(200)
  refuse(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.giveBack(currentUser, id, true, readNote(body, true));
  }

  @Post('incoming-documents/:id/revoke')
  @HttpCode(200)
  revoke(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.documents.revoke(currentUser, id);
  }

  @Post('incoming-documents/:id/finish')
  @HttpCode(200)
  finish(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.finish(currentUser, id, readNote(body));
  }

  @Post('incoming-documents/:id/extension')
  @HttpCode(200)
  requestExtension(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const until = readDate(body, 'until', errors, true);
    const reason = readText(body, 'reason', errors, { required: true, maximum: MAXIMUM_LONG_TEXT });
    throwIfAny(errors);
    return this.documents.requestExtension(currentUser, id, until as string, reason as string);
  }

  @Post('incoming-documents/:id/extension/decide')
  @HttpCode(200)
  decideExtension(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const assignmentId = readUuid(body, 'assignment_id', errors, true);
    if (typeof body?.approve !== 'boolean') {
      errors.push({ field: 'approve', message: 'Chọn đồng ý hoặc không đồng ý' });
    }
    const note = readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT });
    throwIfAny(errors);
    return this.documents.decideExtension(currentUser, id, assignmentId as string, body?.approve === true, note);
  }

  @Post('incoming-documents/:id/complete')
  @HttpCode(200)
  complete(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.complete(currentUser, id, readNote(body));
  }

  @Post('incoming-documents/:id/restrict')
  @HttpCode(200)
  restrict(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const restricted = readBoolean(body, 'restricted', errors, true);
    throwIfAny(errors);
    return this.documents.restrict(currentUser, id, restricted);
  }

  @Post('incoming-documents/:id/reply')
  @HttpCode(200)
  reply(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const symbol = readText(body, 'reply_symbol', errors, { required: true, maximum: 100 });
    const date = readDate(body, 'reply_date', errors, true);
    const note = readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT });
    throwIfAny(errors);
    return this.documents.reply(currentUser, id, { symbol: symbol as string, date: date as string, note });
  }

  @Post('incoming-documents/:id/unread')
  @HttpCode(200)
  unread(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.documents.markUnread(currentUser, id);
  }

  @Get('incoming-documents/:id/slips/:type')
  async slip(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Param('type') type: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!SLIP_TYPES.includes(type as SlipType)) {
      throw validationError([{ field: 'type', message: 'Chọn phiếu trình, phiếu xử lý hoặc phiếu giao nhận' }]);
    }
    const slip = await this.print.slip(currentUser, id, type as SlipType);
    response.setHeader('content-type', 'application/pdf');
    response.setHeader('content-disposition', `attachment; filename="${slip.fileName}"`);
    response.setHeader('cache-control', 'no-store');
    response.send(slip.body);
  }

  // Sổ văn bản đến: xem theo sổ và khoảng ngày đến, xuất Excel
  @Get('document-books/:id/register')
  bookRegister(
    @Param('id', uuidParameter('Mã sổ không hợp lệ')) id: string,
    @Query() query: Record<string, unknown>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { from, to } = readRange(query);
    return this.print.register(currentUser, id, from, to);
  }

  @Get('document-books/:id/register/export')
  async exportRegister(
    @Param('id', uuidParameter('Mã sổ không hợp lệ')) id: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { from, to } = readRange(query);
    sendWorkbook(response, await this.print.exportRegister(currentUser, id, from, to, request.ip ?? null));
  }
}
