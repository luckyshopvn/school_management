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
import type { OutgoingFileKind } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { OUTGOING_MAXIMUM_FILE_BYTES, PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import {
  isDate,
  MAXIMUM_LONG_TEXT,
  readBoolean,
  readIds,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from '../incoming-documents/incoming-fields.js';
import { OutgoingDocumentsService, OUTGOING_PERMISSIONS } from './outgoing-documents.js';
import {
  parseConsult,
  parseIssue,
  parseLinks,
  parseOutgoingInput,
  parseRecipients,
  readOutgoingFilter,
} from './outgoing-fields.js';
import { OutgoingPrintService } from './outgoing-print.js';

// Điểm cuối của văn bản đi (DT-18 phần 18b, YCTD-140). Bộ bảo vệ chỉ chặn người không có quyền nào của văn bản đi; quyền
// văn thư, người ký, người soạn, người được lấy ý kiến và phạm vi toàn trường kiểm tra ở dịch vụ
const DRAFT = PERMISSION_CODES.outgoingDocumentDraft;
const ISSUE = PERMISSION_CODES.outgoingDocumentIssue;
const DOCUMENT_MESSAGE = 'Mã văn bản không hợp lệ';
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);
const FILE_KINDS: OutgoingFileKind[] = ['draft', 'submission', 'attachment'];
const CODE_PATTERN = /^[A-Z0-9]{12}$/;
const SEND_STATUSES = new Set(['pending', 'sent', 'delivered', 'all']);

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

// Nguồn của cổng quản trị gửi yêu cầu (trình duyệt tự đặt, mã trang không sửa được) để in địa chỉ trang tra cứu vào mã QR
function originOf(request: Request): string | null {
  const origin = request.headers.origin;
  return typeof origin === 'string' ? origin : null;
}

function readDocumentBody(body: RequestBody) {
  const errors: FieldError[] = [];
  const input = parseOutgoingInput(body, errors);
  const recipients = parseRecipients(body, errors);
  const links = parseLinks(body, errors);
  throwIfAny(errors);
  return { input, recipients, links };
}

@Controller()
@RequirePermission(...OUTGOING_PERMISSIONS)
export class OutgoingDocumentsController {
  constructor(
    private readonly documents: OutgoingDocumentsService,
    private readonly print: OutgoingPrintService,
  ) {}

  @Get('outgoing-documents')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const { page, pageSize } = readPage(query);
    return this.documents.list(currentUser, readOutgoingFilter(query), page, pageSize);
  }

  @Get('outgoing-documents/recipients')
  @RequirePermission(ISSUE)
  recipients(@Query('status') status: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const value = status ?? 'pending';
    if (!SEND_STATUSES.has(value)) {
      throw validationError([{ field: 'status', message: 'Trạng thái gửi không hợp lệ' }]);
    }
    return this.documents.recipients(currentUser, value as 'pending' | 'sent' | 'delivered' | 'all');
  }

  @Get('outgoing-documents/next-number')
  @RequirePermission(ISSUE)
  nextNumber(@Query('book_id') bookId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readUuid({ book_id: bookId }, 'book_id', errors, true);
    throwIfAny(errors);
    return this.documents.nextNumber(currentUser, id as string);
  }

  // Tạo dự thảo
  @Post('outgoing-documents')
  @RequirePermission(DRAFT)
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const { input, recipients, links } = readDocumentBody(body);
    return this.documents.create(currentUser, input, recipients, links);
  }

  @Post('outgoing-documents/archive')
  @HttpCode(200)
  archiveMany(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    const recordId = readUuid(body, 'archive_record_id', errors, true);
    throwIfAny(errors);
    return this.documents.archiveMany(currentUser, ids, recordId as string);
  }

  @Get('outgoing-documents/:id')
  detail(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.documents.view(currentUser, id);
  }

  @Put('outgoing-documents/:id')
  update(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { input, recipients, links } = readDocumentBody(body);
    return this.documents.update(currentUser, id, input, recipients, links);
  }

  @Delete('outgoing-documents/:id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.documents.remove(currentUser, id);
  }

  @Post('outgoing-documents/:id/files')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: OUTGOING_MAXIMUM_FILE_BYTES + 1, files: 1 } }))
  addFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Chọn tệp đính kèm' }]);
    }
    const kind = (body?.kind ?? 'draft') as OutgoingFileKind;
    if (!FILE_KINDS.includes(kind)) {
      throw validationError([{ field: 'kind', message: 'Chọn tệp dự thảo, file phiếu trình hoặc văn bản gửi kèm' }]);
    }
    return this.documents.addFile(currentUser, id, {
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      body: file.buffer,
      kind,
    });
  }

  @Get('outgoing-documents/:id/files/:fileId')
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

  @Delete('outgoing-documents/:id/files/:fileId')
  deleteFile(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.deleteFile(currentUser, id, fileId);
  }

  @Post('outgoing-documents/:id/consult')
  @HttpCode(200)
  consult(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.consult(currentUser, id, parseConsult(body));
  }

  @Post('outgoing-documents/:id/consult/end')
  @HttpCode(200)
  endConsultation(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.endConsultation(currentUser, id);
  }

  // Cho ý kiến; finish = true là kết thúc cho ý kiến
  @Post('outgoing-documents/:id/opinion')
  @HttpCode(200)
  opinion(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const finish = readBoolean(body, 'finish', errors);
    const opinion = readText(body, 'opinion', errors, { maximum: MAXIMUM_LONG_TEXT });
    throwIfAny(errors);
    return this.documents.giveOpinion(currentUser, id, opinion, finish);
  }

  @Post('outgoing-documents/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const signerId = readUuid(body, 'signer_id', errors);
    const note = readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT });
    throwIfAny(errors);
    return this.documents.submit(currentUser, id, signerId, note);
  }

  @Post('outgoing-documents/:id/revoke')
  @HttpCode(200)
  revoke(@Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.documents.revoke(currentUser, id);
  }

  @Post('outgoing-documents/:id/sign')
  @HttpCode(200)
  sign(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.sign(currentUser, id, originOf(request));
  }

  @Post('outgoing-documents/:id/decline')
  @HttpCode(200)
  decline(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.giveBack(currentUser, id, true, readNote(body, true) as string);
  }

  @Post('outgoing-documents/:id/return')
  @HttpCode(200)
  giveBack(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.documents.giveBack(currentUser, id, false, readNote(body, true) as string);
  }

  // Cấp số và phát hành
  @Post('outgoing-documents/:id/issue')
  @HttpCode(200)
  @RequirePermission(ISSUE)
  issue(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = parseIssue(body);
    const errors: FieldError[] = [];
    const recipients = parseRecipients(body, errors);
    throwIfAny(errors);
    return this.documents.issue(currentUser, id, input, recipients);
  }

  // Liên thông tới đơn vị bên ngoài (bản chạy nội bộ): đánh dấu đã gửi hoặc hủy đánh dấu
  @Post('outgoing-documents/:id/send')
  @HttpCode(200)
  @RequirePermission(ISSUE)
  send(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const recipientIds = readUuidList(body, 'recipient_ids', errors, 200);
    if (recipientIds.length === 0 && !errors.some((error) => error.field === 'recipient_ids')) {
      errors.push({ field: 'recipient_ids', message: 'Chọn đơn vị nhận' });
    }
    const sent = readBoolean(body, 'sent', errors, true);
    const reference = readText(body, 'reference', errors, { maximum: 200 });
    throwIfAny(errors);
    return this.documents.markSent(currentUser, id, { recipient_ids: recipientIds, sent, reference });
  }

  @Post('outgoing-documents/:id/publish')
  @HttpCode(200)
  @RequirePermission(ISSUE)
  publish(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const published = readBoolean(body, 'published', errors, true);
    throwIfAny(errors);
    return this.documents.publish(currentUser, id, published);
  }

  @Post('outgoing-documents/:id/freeze')
  @HttpCode(200)
  @RequirePermission(ISSUE)
  freeze(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const frozen = readBoolean(body, 'frozen', errors, true);
    throwIfAny(errors);
    return this.documents.freeze(currentUser, id, frozen);
  }

  @Get('outgoing-documents/:id/slip')
  async slip(
    @Param('id', uuidParameter(DOCUMENT_MESSAGE)) id: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const slip = await this.print.slip(currentUser, id);
    response.setHeader('content-type', 'application/pdf');
    response.setHeader('content-disposition', `attachment; filename="${slip.fileName}"`);
    response.setHeader('cache-control', 'no-store');
    response.send(slip.body);
  }

  // Sổ văn bản đi: xem theo sổ và khoảng ngày ban hành, xuất Excel
  @Get('document-books/:id/outgoing-register')
  bookRegister(
    @Param('id', uuidParameter('Mã sổ không hợp lệ')) id: string,
    @Query() query: Record<string, unknown>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { from, to } = readRange(query);
    return this.print.register(currentUser, id, from, to);
  }

  @Get('document-books/:id/outgoing-register/export')
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

// Trang tra cứu công khai của mã QR in trên bản đã ký: ai có mã thì đối chiếu được số ký hiệu, người ký, mã băm
@Controller('public')
@PublicEndpoint()
export class OutgoingVerificationController {
  constructor(
    private readonly documents: OutgoingDocumentsService,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  @Get('outgoing-documents/verify')
  verify(@Query('code') code: string | undefined, @Req() request: Request) {
    this.limiter.hit('read', request.ip);
    const normalized = code?.trim().toUpperCase() ?? '';
    if (!CODE_PATTERN.test(normalized)) {
      throw validationError([{ field: 'code', message: 'Mã tra cứu gồm 12 chữ cái và chữ số' }]);
    }
    return this.documents.verify(normalized);
  }
}
