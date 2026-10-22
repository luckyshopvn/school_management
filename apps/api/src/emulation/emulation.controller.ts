import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { EmulationNominationStatus } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { EMULATION_NOMINATION_STATUS_LABELS, PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import {
  isDate,
  readBoolean,
  readInteger,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from '../incoming-documents/incoming-fields.js';
import { EmulationCouncilService } from './emulation-council.js';
import {
  readAppeal,
  readCampaign,
  readDecision,
  readManualAward,
  readMeeting,
  readMembers,
  readNominationUpdate,
  readRegistration,
  readSubject,
  readTitle,
  readVotes,
} from './emulation-fields.js';
import { EMULATION_PERMISSIONS, EmulationService } from './emulation.js';

// Điểm cuối của thi đua, khen thưởng (DT-18 phần 22d, YCTD-148). Bộ bảo vệ chỉ chặn người không có quyền nào của phân hệ;
// người lập, người được đề nghị, tổ trưởng, thành viên hội đồng, người quản lý, người ban hành kiểm tra ở dịch vụ
const MANAGE = PERMISSION_CODES.emulationManage;
const DECIDE = PERMISSION_CODES.emulationDecide;
const ID = 'Mã không hợp lệ';
const CODE_PATTERN = /^[A-Z0-9]{12}$/;

function withErrors<Value>(read: (errors: FieldError[]) => Value): Value {
  const errors: FieldError[] = [];
  const value = read(errors);
  throwIfAny(errors);
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    throw validationError([{ field, message: 'Mã không hợp lệ' }]);
  }
  return value;
}

const documentFormat = (value: string | undefined) => (value === 'docx' ? 'docx' : 'pdf');

function sendBuffer(response: Response, file: { fileName: string; contentType: string; buffer: Buffer }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

function requestOrigin(request: Request): string | null {
  const origin = request.headers.origin;
  return typeof origin === 'string' ? origin : null;
}

function historyFilter(query: Record<string, unknown>) {
  const target = query.target === 'individual' || query.target === 'collective' ? query.target : null;
  return {
    q: typeof query.q === 'string' && query.q.trim() !== '' ? query.q.trim().slice(0, 200) : null,
    target: target as 'individual' | 'collective' | null,
    title_code: typeof query.title_code === 'string' && query.title_code !== '' ? query.title_code.slice(0, 50) : null,
    staff_id: optionalUuid(query.staff_id, 'staff_id'),
  };
}

@Controller()
@RequirePermission(...EMULATION_PERMISSIONS)
export class EmulationController {
  constructor(
    private readonly emulation: EmulationService,
    private readonly council: EmulationCouncilService,
  ) {}

  @Get('emulation/overview')
  overview(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.overview(currentUser);
  }

  // ---- Danh mục ----

  @Get('emulation/titles')
  titles(
    @Query('include_inactive') includeInactive: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.emulation.titles(currentUser, includeInactive === 'true');
  }

  @Post('emulation/titles')
  @RequirePermission(MANAGE)
  createTitle(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.createTitle(
      currentUser,
      withErrors((errors) => readTitle(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Post('emulation/titles/defaults')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  defaults(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.loadDefaults(currentUser, originOf(request, currentUser));
  }

  @Put('emulation/titles/:id')
  @RequirePermission(MANAGE)
  updateTitle(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.emulation.updateTitle(
      currentUser,
      id,
      withErrors((errors) => readTitle(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Delete('emulation/titles/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteTitle(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.emulation.deleteTitle(currentUser, id, originOf(request, currentUser));
  }

  // ---- Đợt thi đua ----

  @Get('emulation/campaigns')
  campaigns(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.campaigns(currentUser);
  }

  @Post('emulation/campaigns')
  @RequirePermission(MANAGE)
  createCampaign(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.createCampaign(
      currentUser,
      withErrors((errors) => readCampaign(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Put('emulation/campaigns/:id')
  @RequirePermission(MANAGE)
  updateCampaign(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.emulation.updateCampaign(
      currentUser,
      id,
      withErrors((errors) => readCampaign(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Delete('emulation/campaigns/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteCampaign(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.emulation.deleteCampaign(currentUser, id, originOf(request, currentUser));
  }

  @Post('emulation/campaigns/:id/launch')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  launch(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.launch(currentUser, id);
  }

  @Post('emulation/campaigns/:id/publish')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  publish(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.publish(currentUser, id);
  }

  @Post('emulation/campaigns/:id/close')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  close(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.closeCampaign(currentUser, id);
  }

  @Get('emulation/campaigns/:id/launch-document')
  async launchDocument(
    @Param('id', uuidParameter(ID)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.emulation.launchDocument(currentUser, id, documentFormat(format)));
  }

  @Get('emulation/campaigns/:id/council')
  councilOf(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.council(currentUser, id);
  }

  @Put('emulation/campaigns/:id/council')
  @RequirePermission(MANAGE)
  saveCouncil(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.council.saveCouncil(
      currentUser,
      id,
      withErrors((errors) => readMembers(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Post('emulation/campaigns/:id/meetings')
  @RequirePermission(MANAGE)
  openMeeting(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.council.openMeeting(
      currentUser,
      id,
      withErrors((errors) => readMeeting(body, errors)),
    );
  }

  @Get('emulation/campaigns/:id/report')
  report(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.report(currentUser, id);
  }

  @Get('emulation/campaigns/:id/report/export')
  async reportFile(
    @Param('id', uuidParameter(ID)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.council.reportFile(currentUser, id, readTableFileFormat(format) ?? 'xlsx'));
  }

  // ---- Đăng ký thi đua ----

  @Get('emulation/registrations')
  registrations(
    @Query('campaign_id') campaignId: string | undefined,
    @Query('view') view: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.emulation.registrations(
      currentUser,
      optionalUuid(campaignId, 'campaign_id'),
      view === 'all' ? 'all' : 'mine',
    );
  }

  @Post('emulation/registrations')
  register(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.register(
      currentUser,
      withErrors((errors) => readRegistration(body, errors)),
    );
  }

  @Post('emulation/registrations/review')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  reviewRegistrations(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const input = withErrors((errors) => {
      const ids = readUuidList(body, 'ids', errors);
      if (ids.length === 0 && !errors.some((error) => error.field === 'ids')) {
        errors.push({ field: 'ids', message: 'Chọn ít nhất một đăng ký' });
      }
      return {
        ids,
        accept: readBoolean(body, 'accept', errors, true),
        note: readText(body, 'note', errors, { maximum: 2000 }),
      };
    });
    return this.emulation.reviewRegistrations(currentUser, input.ids, input.accept, input.note);
  }

  @Put('emulation/registrations/:id')
  updateRegistration(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const commitment = withErrors((errors) => readText(body, 'commitment', errors, { maximum: 4000 }));
    return this.emulation.updateRegistration(currentUser, id, commitment);
  }

  @Delete('emulation/registrations/:id')
  @HttpCode(204)
  async deleteRegistration(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.emulation.deleteRegistration(currentUser, id);
  }

  // ---- Hồ sơ đề nghị ----

  @Get('emulation/nominations')
  nominations(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const status =
      typeof query.status === 'string' && query.status in EMULATION_NOMINATION_STATUS_LABELS ? query.status : null;
    return this.emulation.nominations(currentUser, {
      view: query.view === 'review' ? 'review' : 'mine',
      campaign_id: optionalUuid(query.campaign_id, 'campaign_id'),
      status: status as EmulationNominationStatus | null,
    });
  }

  @Post('emulation/nominations')
  createNomination(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.createNomination(
      currentUser,
      withErrors((errors) => readSubject(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Get('emulation/nominations/:id')
  viewNomination(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.viewNomination(currentUser, id);
  }

  @Put('emulation/nominations/:id')
  updateNomination(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.emulation.updateNomination(
      currentUser,
      id,
      withErrors((errors) => readNominationUpdate(body, errors)),
    );
  }

  @Delete('emulation/nominations/:id')
  @HttpCode(204)
  async deleteNomination(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.emulation.deleteNomination(currentUser, id, originOf(request, currentUser));
  }

  @Post('emulation/nominations/:id/submit')
  @HttpCode(200)
  submit(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.submitNomination(currentUser, id);
  }

  @Post('emulation/nominations/:id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.withdrawNomination(currentUser, id);
  }

  @Post('emulation/nominations/:id/accept')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  accept(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.acceptNomination(currentUser, id);
  }

  @Post('emulation/nominations/:id/return')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  giveBack(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const note = withErrors((errors) => readText(body, 'note', errors, { required: true, maximum: 2000 })) ?? '';
    return this.emulation.returnNomination(currentUser, id, note);
  }

  @Get('emulation/nominations/:id/evidence-options')
  evidenceOptions(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.emulation.evidenceOptions(currentUser, id);
  }

  @Post('emulation/nominations/:id/evidence')
  addEvidence(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = withErrors((errors) => ({
      document_id: readUuid(body, 'document_id', errors, true) ?? '',
      note: readText(body, 'note', errors, { maximum: 500 }),
    }));
    return this.emulation.addEvidence(currentUser, id, input.document_id, input.note);
  }

  @Delete('emulation/nominations/:id/evidence/:evidenceId')
  removeEvidence(
    @Param('id', uuidParameter(ID)) id: string,
    @Param('evidenceId', uuidParameter(ID)) evidenceId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.emulation.removeEvidence(currentUser, id, evidenceId);
  }

  @Get('emulation/nominations/:id/evidence/:evidenceId/file')
  async evidenceFile(
    @Param('id', uuidParameter(ID)) id: string,
    @Param('evidenceId', uuidParameter(ID)) evidenceId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const { file, body } = await this.emulation.evidenceFile(currentUser, id, evidenceId);
    sendBuffer(response, { fileName: file.file_name, contentType: file.content_type, buffer: body });
  }

  @Get('emulation/nominations/:id/report')
  async nominationReport(
    @Param('id', uuidParameter(ID)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.emulation.nominationReport(currentUser, id, documentFormat(format)));
  }

  // ---- Phiên họp, bỏ phiếu ----

  @Get('emulation/voting')
  voting(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.voting(currentUser);
  }

  @Get('emulation/meetings/:id')
  meeting(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.meeting(currentUser, id);
  }

  @Put('emulation/meetings/:id/votes')
  vote(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.council.vote(
      currentUser,
      id,
      withErrors((errors) => readVotes(body, errors)),
    );
  }

  @Post('emulation/meetings/:id/close')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  closeMeeting(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = withErrors((errors) => ({
      attendee_count: readInteger(body, 'attendee_count', errors, { min: 0, max: 100 }),
      conclusion: readText(body, 'conclusion', errors, { maximum: 10_000 }),
    }));
    return this.council.closeMeeting(currentUser, id, input);
  }

  @Get('emulation/meetings/:id/minutes')
  async minutes(
    @Param('id', uuidParameter(ID)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const { file, body } = await this.council.minutesFile(currentUser, id);
    sendBuffer(response, { fileName: file.file_name, contentType: file.content_type, buffer: body });
  }

  // ---- Phúc khảo, khiếu nại ----

  @Get('emulation/appeals')
  appeals(
    @Query('view') view: string | undefined,
    @Query('campaign_id') campaignId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.council.appeals(currentUser, view === 'all' ? 'all' : 'mine', optionalUuid(campaignId, 'campaign_id'));
  }

  @Post('emulation/appeals')
  submitAppeal(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.submitAppeal(
      currentUser,
      withErrors((errors) => readAppeal(body, errors)),
    );
  }

  @Post('emulation/appeals/:id/resolve')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  resolveAppeal(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = withErrors((errors) => ({
      accept: readBoolean(body, 'accept', errors, false),
      response: readText(body, 'response', errors, { required: true, maximum: 4000 }) ?? '',
    }));
    return this.council.resolveAppeal(currentUser, id, input.accept, input.response);
  }

  // ---- Quyết định ----

  @Get('emulation/decisions')
  decisions(@Query('campaign_id') campaignId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.decisions(currentUser, optionalUuid(campaignId, 'campaign_id'));
  }

  @Post('emulation/decisions')
  @RequirePermission(MANAGE)
  createDecision(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.createDecision(
      currentUser,
      withErrors((errors) => readDecision(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Get('emulation/decisions/:id')
  viewDecision(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.viewDecision(currentUser, id);
  }

  @Put('emulation/decisions/:id')
  @RequirePermission(MANAGE)
  updateDecision(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.council.updateDecision(
      currentUser,
      id,
      withErrors((errors) => readDecision(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Delete('emulation/decisions/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteDecision(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.council.deleteDecision(currentUser, id, originOf(request, currentUser));
  }

  @Get('emulation/decisions/:id/document')
  async decisionDocument(
    @Param('id', uuidParameter(ID)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.council.decisionDocument(currentUser, id, documentFormat(format)));
  }

  @Post('emulation/decisions/:id/outgoing')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  createOutgoing(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.createOutgoing(currentUser, id);
  }

  @Post('emulation/decisions/:id/issue')
  @HttpCode(200)
  @RequirePermission(DECIDE)
  issue(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = withErrors((errors) => {
      const date = body?.issue_date;
      if (date !== undefined && date !== null && date !== '' && !isDate(date)) {
        errors.push({ field: 'issue_date', message: 'Ngày dạng YYYY-MM-DD' });
      }
      return {
        number: readText(body, 'number', errors, { maximum: 100 }),
        issue_date: isDate(date) ? date : null,
      };
    });
    return this.council.issueDecision(currentUser, id, input, originOf(request, currentUser));
  }

  @Post('emulation/decisions/:id/upper-result')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  upperResult(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const input = withErrors((errors) => {
      const date = body?.date;
      if (!isDate(date)) {
        errors.push({ field: 'date', message: 'Ngày dạng YYYY-MM-DD' });
      }
      return {
        number: readText(body, 'number', errors, { required: true, maximum: 100 }) ?? '',
        date: isDate(date) ? date : '',
        issuer: readText(body, 'issuer', errors, { required: true, maximum: 300 }) ?? '',
        awarded_ids: readUuidList(body, 'awarded_ids', errors, 500),
      };
    });
    return this.council.upperResult(currentUser, id, input);
  }

  // ---- Giấy khen, sổ theo dõi ----

  @Get('emulation/awards/:id/certificate')
  async certificate(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.council.certificate(currentUser, id, requestOrigin(request)));
  }

  @Get('emulation/history')
  history(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.history(currentUser, historyFilter(query));
  }

  @Get('emulation/history/export')
  async historyFile(
    @Query() query: Record<string, unknown>,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const format = readTableFileFormat(typeof query.format === 'string' ? query.format : undefined) ?? 'xlsx';
    sendBuffer(response, await this.council.historyFile(currentUser, historyFilter(query), format));
  }

  @Post('emulation/history')
  @RequirePermission(MANAGE)
  addManualAward(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.council.addManualAward(
      currentUser,
      withErrors((errors) => readManualAward(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Delete('emulation/history/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteManualAward(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.council.deleteManualAward(currentUser, id, originOf(request, currentUser));
  }
}

// Trang tra cứu công khai của mã in trên giấy khen: ai có mã thì đối chiếu được người, tổ được khen, danh hiệu, quyết định
@Controller('public')
@PublicEndpoint()
export class EmulationVerificationController {
  constructor(
    private readonly council: EmulationCouncilService,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  @Get('emulation-awards/verify')
  verify(@Query('code') code: string | undefined, @Req() request: Request) {
    this.limiter.hit('read', request.ip);
    const normalized = code?.trim().toUpperCase() ?? '';
    if (!CODE_PATTERN.test(normalized)) {
      throw validationError([{ field: 'code', message: 'Mã tra cứu gồm 12 chữ cái và chữ số' }]);
    }
    return this.council.verify(normalized);
  }
}
