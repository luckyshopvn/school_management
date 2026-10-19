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
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import {
  ADMISSION_DECISIONS,
  ADMISSION_DOCUMENTS,
  ADMISSION_PROGRAM_TYPES,
  ADVANCED_REVIEW_STATUSES,
  FINAL_YEAR_FILE_KINDS,
  PERMISSION_CODES,
  type AdmissionDecision,
  type AdmissionDocument,
  type AdmissionProgramType,
  type AdmissionRecordType,
  type AdvancedReviewStatus,
  type FinalYearFileKind,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { Databases } from '../common/databases.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import { MAXIMUM_IMPORT_BYTES } from '../imports/excel.js';
import { EntryIntakeNoticesService, readNoticeContent } from './entry-intake-notices.js';
import { EntryIntakeTransferService } from './entry-intake-transfer.js';
import { EntryIntakeService, INTAKE_VIEW, readIntakeFilter, readIntakeInput, type IntakeScreen } from './entry-intake.js';

// Điểm cuối của 1.3 đến 1.7 phân hệ Tuyển sinh đầu cấp và 5.11 phân hệ Mầm non (DT-17 phần 17d)
const MANAGE = PERMISSION_CODES.entryIntakeManage;
const TRANSFER = PERMISSION_CODES.entryIntakeTransfer;
const MAXIMUM_SELECTED = 1000;
const SCREENS: IntakeScreen[] = ['intake', 'advanced', 'notices', 'transfer', 'transferred'];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

function readIds(body: RequestBody, errors: FieldError[], field = 'ids', allowEmpty = false): string[] {
  const value = body?.[field];
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > MAXIMUM_SELECTED ||
    value.some((id) => !isUuid(id))
  ) {
    errors.push({ field, message: `Chọn từ 1 đến ${MAXIMUM_SELECTED} hồ sơ` });
    return [];
  }
  return [...new Set(value as string[])];
}

function readCampaignId(value: unknown, errors: FieldError[]): string {
  if (!isUuid(value)) {
    errors.push({ field: 'campaign_id', message: 'Chọn đợt tuyển sinh' });
    return '';
  }
  return value as string;
}

function sendFile(response: Response, file: { buffer: Buffer; fileName: string; contentType: string; logId: string }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('x-export-log-id', file.logId);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

function sendImportResult(response: Response, result: object, errorName: string) {
  if ('errorWorkbook' in result) {
    response.setHeader('content-type', XLSX);
    response.setHeader('content-disposition', `attachment; filename="${errorName}"`);
    response.setHeader('cache-control', 'no-store');
    response.send((result as { errorWorkbook: Buffer }).errorWorkbook);
    return;
  }
  response.json(result);
}

function sendTemplate(response: Response, body: Buffer, fileName: string) {
  response.setHeader('content-type', XLSX);
  response.setHeader('content-disposition', `attachment; filename="${fileName}"`);
  response.setHeader('cache-control', 'no-store');
  response.send(body);
}

function requireFile(file: UploadedPart | undefined): UploadedPart {
  if (!file || file.size === 0) {
    throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp Excel' }]);
  }
  return file;
}

@Controller('entry-intake')
export class EntryIntakeController {
  constructor(
    private readonly intake: EntryIntakeService,
    private readonly notices: EntryIntakeNoticesService,
    private readonly transfers: EntryIntakeTransferService,
    private readonly databases: Databases,
  ) {}

  @Get('campaigns')
  @RequirePermission(...INTAKE_VIEW)
  campaigns(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.intake.campaigns(currentUser);
  }

  // Loại hình và năm học nhận trẻ của đợt tuyển sinh
  @Put('campaigns/:id')
  @RequirePermission(MANAGE)
  updateCampaign(
    @Param('id', uuidParameter('Mã đợt tuyển sinh không hợp lệ')) campaignId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const programType = body?.program_type as AdmissionProgramType;
    if (!ADMISSION_PROGRAM_TYPES.some((item) => item.value === programType)) {
      errors.push({ field: 'program_type', message: 'Loại hình là general, advanced hoặc survey' });
    }
    const year = body?.target_academic_year_id;
    if (year !== null && year !== undefined && year !== '' && !isUuid(year)) {
      errors.push({ field: 'target_academic_year_id', message: 'Năm học không hợp lệ' });
    }
    check(errors);
    return this.intake.updateCampaign(
      currentUser,
      campaignId,
      { program_type: programType, target_academic_year_id: typeof year === 'string' && year !== '' ? year : null },
      originOf(request, currentUser),
    );
  }

  // Danh mục cho các ô chọn: năm học, điểm trường, lớp đang dùng, quan hệ với học sinh
  @Get('options')
  @RequirePermission(...INTAKE_VIEW)
  async options() {
    const database = await this.intake.database();
    const [years, units, classes, relationships] = await Promise.all([
      this.databases.system
        .selectFrom('academic_years')
        .select(['id', 'name', 'status'])
        .orderBy('name', 'desc')
        .execute(),
      database
        .selectFrom('org_units')
        .select(['id', 'name', 'unit_type'])
        .where('status', '=', 'active')
        .orderBy('name')
        .execute(),
      database
        .selectFrom('classes')
        .select(['id', 'name', 'org_unit_id'])
        .where('status', '=', 'active')
        .orderBy('name')
        .execute(),
      database
        .selectFrom('catalog_items')
        .select(['id', 'name'])
        .where('catalog_type', '=', 'parent_relationship')
        .where('status', '=', 'active')
        .orderBy('name')
        .execute(),
    ]);
    return { academic_years: years, org_units: units, classes, relationships };
  }

  @Get('applications')
  @RequirePermission(...INTAKE_VIEW)
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const screen = (query.screen ?? 'intake') as IntakeScreen;
    if (!SCREENS.includes(screen)) {
      errors.push({ field: 'screen', message: `Màn hình là ${SCREENS.join(', ')}` });
    }
    const filter = readIntakeFilter(query, errors);
    check(errors);
    return this.intake.list(currentUser, screen, filter);
  }

  @Put('applications/:id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) applicationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readIntakeInput((body ?? {}) as Record<string, unknown>, errors);
    check(errors);
    return this.intake.update(currentUser, applicationId, input, originOf(request, currentUser));
  }

  // "Lưu dữ liệu" của 1.4
  @Post('save')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const items = body?.items;
    const documents = ADMISSION_DOCUMENTS.map((item) => item.value);
    const decisions = ADMISSION_DECISIONS.map((item) => item.value);
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > MAXIMUM_SELECTED ||
      items.some((item) => {
        const value = item as Record<string, unknown> | null;
        return (
          typeof value !== 'object' ||
          value === null ||
          !isUuid(value.id) ||
          !Array.isArray(value.submitted_documents) ||
          value.submitted_documents.some((document) => !documents.includes(document as AdmissionDocument)) ||
          !decisions.includes(value.admission_decision as AdmissionDecision)
        );
      })
    ) {
      throw validationError([
        { field: 'items', message: 'Danh sách gồm id, submitted_documents (giấy tờ đã nộp) và admission_decision' },
      ]);
    }
    return this.intake.save(
      currentUser,
      items as Array<{ id: string; submitted_documents: AdmissionDocument[]; admission_decision: AdmissionDecision }>,
      originOf(request, currentUser),
    );
  }

  // 1.3 Xác nhận hồ sơ (admitted), Không đồng ý (not_admitted), Chưa xác nhận (pending)
  @Post('review')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  review(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const review = body?.review as AdvancedReviewStatus;
    if (!ADVANCED_REVIEW_STATUSES.some((item) => item.value === review)) {
      errors.push({ field: 'review', message: 'Trạng thái là admitted, not_admitted hoặc pending' });
    }
    const ids = readIds(body, errors);
    check(errors);
    return this.intake.review(currentUser, ids, review, originOf(request, currentUser));
  }

  @Post('remove')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  remove(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    check(errors);
    return this.intake.remove(currentUser, ids, originOf(request, currentUser));
  }

  // "Hủy nhập học" của 1.4 (hồ sơ chưa chuyển)
  @Post('cancel')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  cancel(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    check(errors);
    return this.intake.cancelPending(currentUser, ids, originOf(request, currentUser));
  }

  @Get('import-template')
  @RequirePermission(MANAGE)
  async importTemplate(@Res() response: Response) {
    sendTemplate(response, await this.intake.importTemplate(), 'mau-danh-sach-phan-tuyen.xlsx');
  }

  // "Nhập từ Excel" danh sách phân tuyến; error_file=true trả tệp kèm cột nội dung lỗi
  @Post('import')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  async import(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Query('error_file') errorFile: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const campaignId = readCampaignId(body?.campaign_id, errors);
    check(errors);
    const result = await this.intake.importRouting(
      currentUser,
      campaignId,
      requireFile(file).buffer,
      originOf(request, currentUser),
      errorFile === 'true',
    );
    sendImportResult(response, result, 'danh-sach-loi-phan-tuyen.xlsx');
  }

  @Post('applications/:id/files')
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  attach(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) applicationId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const kind = body?.kind as FinalYearFileKind;
    const errors: FieldError[] = [];
    if (!FINAL_YEAR_FILE_KINDS.some((item) => item.value === kind)) {
      errors.push({ field: 'kind', message: 'Loại giấy tờ là birth_certificate, residence hoặc evidence' });
    }
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn tệp' });
    }
    check(errors);
    return this.intake.attach(
      currentUser,
      applicationId,
      { kind, fileName: Buffer.from(file!.originalname, 'latin1').toString('utf8'), body: file!.buffer },
      originOf(request, currentUser),
    );
  }

  @Get('files/:fileId')
  @RequirePermission(...INTAKE_VIEW)
  async download(
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.intake.download(currentUser, fileId);
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Delete('files/:fileId')
  @RequirePermission(MANAGE)
  removeFile(
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.intake.removeFile(currentUser, fileId, originOf(request, currentUser));
  }

  // 1.3 "Tải minh chứng"
  @Post('evidence')
  @HttpCode(200)
  @RequirePermission(...INTAKE_VIEW)
  async evidence(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    check(errors);
    sendFile(response, await this.intake.evidenceZip(currentUser, ids, request.ip ?? null));
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(...INTAKE_VIEW)
  async export(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const screen = body?.screen as IntakeScreen;
    if (!SCREENS.includes(screen)) {
      errors.push({ field: 'screen', message: `Màn hình là ${SCREENS.join(', ')}` });
    }
    const filter = readIntakeFilter((body?.filter as Record<string, unknown>) ?? {}, errors);
    check(errors);
    sendWorkbook(response, await this.intake.exportWorkbook(currentUser, screen, filter, request.ip ?? null));
  }

  // "Tải phiếu thông tin" (information), "In phiếu đăng ký", "In phiếu" (registration)
  @Post('forms')
  @HttpCode(200)
  @RequirePermission(...INTAKE_VIEW)
  async forms(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const kind = body?.kind;
    if (kind !== 'information' && kind !== 'registration') {
      errors.push({ field: 'kind', message: 'Loại phiếu là information hoặc registration' });
    }
    const ids = readIds(body, errors);
    check(errors);
    sendFile(
      response,
      await this.intake.forms(currentUser, ids, kind as 'information' | 'registration', request.ip ?? null),
    );
  }

  // 1.5 Gửi thông báo tuyển sinh đầu cấp
  @Get('notices/recipients')
  @RequirePermission(...INTAKE_VIEW)
  recipients(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readIntakeFilter(query, errors);
    check(errors);
    return this.notices.recipients(currentUser, filter);
  }

  @Post('notices/copy')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  copy(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const campaignId = readCampaignId(body?.campaign_id, errors);
    const content = readNoticeContent(body?.content, errors);
    const applicationIds = readIds(body, errors, 'application_ids', true);
    const contactIds = readIds(body, errors, 'contact_ids', true);
    if (applicationIds.length + contactIds.length === 0) {
      errors.push({ field: 'application_ids', message: 'Chọn người nhận' });
    }
    check(errors);
    return this.notices.copy(
      currentUser,
      campaignId,
      content,
      { application_ids: applicationIds, contact_ids: contactIds },
      originOf(request, currentUser),
    );
  }

  @Post('notices/send')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  send(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const campaignId = readCampaignId(body?.campaign_id, errors);
    const content =
      typeof body?.content === 'string' && body.content.trim() !== '' ? readNoticeContent(body.content, errors) : null;
    const applicationIds = readIds(body, errors, 'application_ids', true);
    const contactIds = readIds(body, errors, 'contact_ids', true);
    if (applicationIds.length + contactIds.length === 0) {
      errors.push({ field: 'application_ids', message: 'Chọn người nhận' });
    }
    check(errors);
    return this.notices.send(
      currentUser,
      campaignId,
      content,
      { application_ids: applicationIds, contact_ids: contactIds },
      originOf(request, currentUser),
    );
  }

  @Get('notices/template')
  @RequirePermission(MANAGE)
  async noticeTemplate(@Query('kind') kind: string | undefined, @Res() response: Response) {
    const external = kind === 'external';
    sendTemplate(
      response,
      await this.notices.template(external ? 'external' : 'content'),
      external ? 'mau-hoc-sinh-ngoai-he-thong.xlsx' : 'mau-noi-dung-gui.xlsx',
    );
  }

  // kind=content: nội dung gửi của hồ sơ trong đợt; kind=external: học sinh ngoài hệ thống
  @Post('notices/import')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  async importNotices(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Query('error_file') errorFile: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const campaignId = readCampaignId(body?.campaign_id, errors);
    check(errors);
    const buffer = requireFile(file).buffer;
    const origin = originOf(request, currentUser);
    const result =
      body?.kind === 'external'
        ? await this.notices.importExternal(currentUser, campaignId, buffer, origin, errorFile === 'true')
        : await this.notices.importContent(currentUser, campaignId, buffer, origin, errorFile === 'true');
    sendImportResult(response, result, 'danh-sach-loi-thong-bao.xlsx');
  }

  // 1.6 "Cập nhật": điểm trường, loại hồ sơ
  @Put('transfers')
  @RequirePermission(TRANSFER)
  updateTransfers(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const items = body?.items;
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > MAXIMUM_SELECTED ||
      items.some((item) => {
        const value = item as Record<string, unknown> | null;
        return (
          typeof value !== 'object' ||
          value === null ||
          !isUuid(value.id) ||
          (value.target_org_unit_id !== null && !isUuid(value.target_org_unit_id)) ||
          (value.record_type !== 'account' && value.record_type !== 'free')
        );
      })
    ) {
      throw validationError([
        { field: 'items', message: 'Danh sách gồm id, target_org_unit_id (hoặc null) và record_type (account, free)' },
      ]);
    }
    return this.transfers.updateRows(
      currentUser,
      items as Array<{ id: string; target_org_unit_id: string | null; record_type: AdmissionRecordType }>,
      originOf(request, currentUser),
    );
  }

  // 5.11 bước 1: xếp lớp (class_id null là bỏ xếp lớp)
  @Post('transfers/arrange')
  @HttpCode(200)
  @RequirePermission(TRANSFER)
  arrange(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    const classId = body?.class_id ?? null;
    if (classId !== null && !isUuid(classId)) {
      errors.push({ field: 'class_id', message: 'Lớp không hợp lệ' });
    }
    check(errors);
    return this.transfers.arrange(currentUser, ids, classId as string | null, originOf(request, currentUser));
  }

  // "Chuyển hồ sơ sang CSDL" (1.6) và 5.11 bước 2
  @Post('transfers/run')
  @HttpCode(200)
  @RequirePermission(TRANSFER)
  run(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    check(errors);
    return this.transfers.run(
      currentUser,
      readBearerToken(request.header('authorization')),
      ids,
      { clearClasses: body?.clear_classes === true, confirmDuplicates: body?.confirm_duplicates === true },
      originOf(request, currentUser),
    );
  }

  @Get('transfers/results')
  @RequirePermission(...INTAKE_VIEW)
  results(
    @Query('kind') kind: string | undefined,
    @Query('package_code') packageCode: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (kind !== undefined && kind !== 'transfer' && kind !== 'cancel') {
      throw validationError([{ field: 'kind', message: 'Loại kết quả là transfer hoặc cancel' }]);
    }
    return this.transfers.results(
      currentUser,
      kind === 'cancel' ? 'cancel' : 'transfer',
      packageCode && packageCode.length <= 50 ? packageCode : null,
    );
  }

  // "Hủy nhập học" của 1.7 (hồ sơ đã chuyển, chưa phát sinh dữ liệu)
  @Post('transfers/cancel')
  @HttpCode(200)
  @RequirePermission(TRANSFER)
  cancelTransferred(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, errors);
    check(errors);
    return this.transfers.cancel(currentUser, ids, originOf(request, currentUser));
  }
}
