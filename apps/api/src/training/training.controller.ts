import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { CompetencyTerm } from '@school-management/database';
import { validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { COMPETENCY_TERMS, parseTrainingCourse, parseTrainingResults, TrainingService } from './training.js';

// Điểm cuối hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182)
const TRAINING_PERMISSIONS = [
  PERMISSION_CODES.trainingUse,
  PERMISSION_CODES.trainingReview,
  PERMISSION_CODES.trainingManage,
];
const ID = 'Mã không hợp lệ';
const CODE_PATTERN = /^[A-Z0-9]{12}$/;

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

function readTerm(value: unknown): CompetencyTerm {
  if (!COMPETENCY_TERMS.includes(value as CompetencyTerm)) {
    throw validationError([{ field: 'term', message: 'Kỳ là term_1, term_2 hoặc year' }]);
  }
  return value as CompetencyTerm;
}

function optionalNote(body: RequestBody, field: string): string | null {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.length > 1000) {
    throw validationError([{ field, message: 'Ghi chú tối đa 1000 ký tự' }]);
  }
  return value.trim() === '' ? null : value.trim();
}

@Controller('training')
@RequirePermission(...TRAINING_PERMISSIONS)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  // ---- Danh mục ----

  @Get('catalog')
  catalog() {
    return this.training.catalog();
  }

  @Put('settings')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  settings(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.updateSettings(currentUser, body);
  }

  @Post('topics')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  createTopic(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.saveTopic(currentUser, null, body);
  }

  @Patch('topics/:id')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  updateTopic(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.saveTopic(currentUser, id, body);
  }

  @Post('competency-domains')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  createDomain(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.saveDomain(currentUser, null, body);
  }

  @Patch('competency-domains/:id')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  updateDomain(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.saveDomain(currentUser, id, body);
  }

  // ---- Khoá, đăng ký ----

  @Get('courses')
  courses(@Query('status') status: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.courses(currentUser, status ?? null);
  }

  @Post('courses')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  createCourse(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.createCourse(currentUser, parseTrainingCourse(body), originOf(request, currentUser));
  }

  @Get('courses/:id')
  course(@Param('id', uuidParameter(ID)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.course(currentUser, id);
  }

  @Patch('courses/:id')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  updateCourse(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.updateCourse(currentUser, id, body, originOf(request, currentUser));
  }

  @Post('courses/:id/registrations')
  register(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.register(currentUser, id, optionalNote(body, 'note'), originOf(request, currentUser));
  }

  @Post('registrations/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.cancel(currentUser, id, originOf(request, currentUser));
  }

  @Post('registrations/:id/review')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.trainingReview, PERMISSION_CODES.trainingManage)
  review(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const decision = body?.decision;
    if (decision !== 'approve' && decision !== 'reject') {
      throw validationError([{ field: 'decision', message: 'Quyết định là approve hoặc reject' }]);
    }
    return this.training.review(currentUser, id, decision, optionalNote(body, 'note'), originOf(request, currentUser));
  }

  @Put('courses/:id/results')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  results(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.saveResults(currentUser, id, parseTrainingResults(body), originOf(request, currentUser));
  }

  @Post('courses/:id/certificates')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  issue(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.issueCertificates(currentUser, id, originOf(request, currentUser));
  }

  @Get('courses/:id/certificates.pdf')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  async courseCertificates(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.training.courseCertificatesPdf(currentUser, id, requestOrigin(request)));
  }

  // ---- Chứng chỉ ----

  @Post('certificates')
  addCertificate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.addCertificate(currentUser, body, originOf(request, currentUser));
  }

  @Delete('certificates/:id')
  @HttpCode(204)
  async deleteCertificate(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.training.deleteCertificate(currentUser, id, originOf(request, currentUser));
  }

  @Post('certificates/:id/revoke')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.trainingManage)
  revoke(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const reason = optionalNote(body, 'reason');
    if (!reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do thu hồi' }]);
    }
    return this.training.revoke(currentUser, id, reason, originOf(request, currentUser));
  }

  @Post('certificates/:id/reissue')
  @RequirePermission(PERMISSION_CODES.trainingManage)
  reissue(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.reissue(currentUser, id, originOf(request, currentUser));
  }

  @Get('certificates/:id/pdf')
  async certificatePdf(
    @Param('id', uuidParameter(ID)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.training.certificatePdf(currentUser, id, requestOrigin(request)));
  }

  // ---- Hồ sơ ----

  @Get('mine')
  mine(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.mine(currentUser);
  }

  @Get('records')
  @RequirePermission(PERMISSION_CODES.trainingReview, PERMISSION_CODES.trainingManage)
  records(@Query('department_id') departmentId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (departmentId !== undefined && departmentId !== '' && !isUuid(departmentId)) {
      throw validationError([{ field: 'department_id', message: 'Tổ không hợp lệ' }]);
    }
    return this.training.records(currentUser, departmentId || null);
  }

  // ---- Năng lực số ----

  @Get('competency/mine')
  myAssessment(@Query('term') term: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.myAssessment(currentUser, readTerm(term ?? 'year'));
  }

  @Put('competency/mine')
  submitAssessment(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.submitAssessment(currentUser, readTerm(body?.term), body, originOf(request, currentUser));
  }

  @Get('competency')
  @RequirePermission(PERMISSION_CODES.trainingReview, PERMISSION_CODES.trainingManage)
  assessments(@Query('term') term: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.training.assessments(currentUser, readTerm(term ?? 'year'));
  }

  @Post('competency/:id/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.trainingReview, PERMISSION_CODES.trainingManage)
  confirm(
    @Param('id', uuidParameter(ID)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.training.confirmAssessment(currentUser, id, body, originOf(request, currentUser));
  }
}

// Trang tra cứu công khai của mã in trên chứng nhận bồi dưỡng: chỉ tra theo mã, có giới hạn tần suất như giấy khen
@Controller('public')
@PublicEndpoint()
export class TrainingVerificationController {
  constructor(
    private readonly training: TrainingService,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  @Get('training-certificates/verify')
  verify(@Query('code') code: string | undefined, @Req() request: Request) {
    this.limiter.hit('read', request.ip);
    const normalized = code?.trim().toUpperCase() ?? '';
    if (!CODE_PATTERN.test(normalized)) {
      throw validationError([{ field: 'code', message: 'Mã tra cứu gồm 12 chữ cái và chữ số' }]);
    }
    return this.training.verify(normalized);
  }
}
