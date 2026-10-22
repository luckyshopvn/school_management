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
import {
  PERMISSION_CODES,
  QUALITY_EVIDENCE_SOURCE_LABELS,
  QUALITY_EVIDENCE_STATUS_LABELS,
  QUALITY_MAXIMUM_FILE_BYTES,
  QUALITY_MAXIMUM_LEVEL,
  type QualityEvidenceSourceCode,
  type QualityEvidenceStatusCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { readChoice, readInteger, readText, readUuid, throwIfAny } from '../incoming-documents/incoming-fields.js';
import { QUALITY_PERMISSIONS, QualityAssuranceService } from './quality-assurance.js';
import {
  LEVEL_LABELS,
  readAssessment,
  readCouncil,
  readCriterion,
  readEvidence,
  readFramework,
  readGroups,
  readIndicator,
  readRecognition,
  readReport,
  readStandard,
} from './quality-fields.js';

// Điểm cuối của bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149). Bộ bảo vệ chỉ chặn người không có quyền nào của
// phân hệ; người quản lý (phạm vi toàn trường), thành viên hội đồng, nhóm công tác kiểm tra ở dịch vụ
const MANAGE = PERMISSION_CODES.qualityManage;
const FRAMEWORK = 'Mã bộ tiêu chuẩn không hợp lệ';
const ASSESSMENT = 'Mã đợt tự đánh giá không hợp lệ';
const REPORT = 'Mã phiếu không hợp lệ';
const EVIDENCE = 'Mã minh chứng không hợp lệ';

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function withErrors<Value>(read: (errors: FieldError[]) => Value): Value {
  const errors: FieldError[] = [];
  const value = read(errors);
  throwIfAny(errors);
  return value;
}

function requiredUuid(value: unknown, field: string): string {
  if (!isUuid(value)) {
    throw validationError([{ field, message: 'Mã không hợp lệ' }]);
  }
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  return value === undefined || value === '' ? null : requiredUuid(value, field);
}

function sendBuffer(response: Response, file: { fileName: string; contentType: string; buffer: Buffer }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

@Controller('quality')
@RequirePermission(...QUALITY_PERMISSIONS)
export class QualityAssuranceController {
  constructor(private readonly quality: QualityAssuranceService) {}

  @Get('overview')
  overview(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.quality.overview(currentUser);
  }

  // ---- Bộ tiêu chuẩn ----

  @Get('frameworks')
  frameworks(@Query('include_inactive') includeInactive: string | undefined, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.frameworks(user, includeInactive === 'true');
  }

  @Post('frameworks')
  @RequirePermission(MANAGE)
  createFramework(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.createFramework(
      user,
      withErrors((errors) => readFramework(body, errors)),
      originOf(request, user),
    );
  }

  @Post('frameworks/defaults')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  defaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    const level = withErrors((errors) => {
      if (!body?.school_level) {
        errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp học' });
      }
      return readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors);
    });
    return this.quality.loadDefaults(user, level, originOf(request, user));
  }

  @Get('frameworks/:id')
  framework(@Param('id', uuidParameter(FRAMEWORK)) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.framework(user, id);
  }

  @Put('frameworks/:id')
  @RequirePermission(MANAGE)
  updateFramework(
    @Param('id', uuidParameter(FRAMEWORK)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateFramework(
      user,
      id,
      withErrors((errors) => readFramework(body, errors)),
      originOf(request, user),
    );
  }

  @Delete('frameworks/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteFramework(
    @Param('id', uuidParameter(FRAMEWORK)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    await this.quality.deleteFramework(user, id, originOf(request, user));
  }

  @Post('frameworks/:id/standards')
  @RequirePermission(MANAGE)
  createStandard(
    @Param('id', uuidParameter(FRAMEWORK)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.createStandard(
      user,
      id,
      withErrors((errors) => readStandard(body, errors)),
      originOf(request, user),
    );
  }

  @Put('standards/:id')
  @RequirePermission(MANAGE)
  updateStandard(
    @Param('id', uuidParameter('Mã tiêu chuẩn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateStandard(
      user,
      id,
      withErrors((errors) => readStandard(body, errors)),
      originOf(request, user),
    );
  }

  @Delete('standards/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteStandard(
    @Param('id', uuidParameter('Mã tiêu chuẩn không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    await this.quality.deleteStandard(user, id, originOf(request, user));
  }

  @Post('standards/:id/criteria')
  @RequirePermission(MANAGE)
  createCriterion(
    @Param('id', uuidParameter('Mã tiêu chuẩn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.createCriterion(
      user,
      id,
      withErrors((errors) => readCriterion(body, errors)),
      originOf(request, user),
    );
  }

  @Put('criteria/:id')
  @RequirePermission(MANAGE)
  updateCriterion(
    @Param('id', uuidParameter('Mã tiêu chí không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateCriterion(
      user,
      id,
      withErrors((errors) => readCriterion(body, errors)),
      originOf(request, user),
    );
  }

  @Delete('criteria/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteCriterion(
    @Param('id', uuidParameter('Mã tiêu chí không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    await this.quality.deleteCriterion(user, id, originOf(request, user));
  }

  @Post('criteria/:id/indicators')
  @RequirePermission(MANAGE)
  createIndicator(
    @Param('id', uuidParameter('Mã tiêu chí không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.createIndicator(
      user,
      id,
      withErrors((errors) => readIndicator(body, errors)),
      originOf(request, user),
    );
  }

  @Put('indicators/:id')
  @RequirePermission(MANAGE)
  updateIndicator(
    @Param('id', uuidParameter('Mã chỉ báo không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateIndicator(
      user,
      id,
      withErrors((errors) => readIndicator(body, errors)),
      originOf(request, user),
    );
  }

  @Delete('indicators/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteIndicator(
    @Param('id', uuidParameter('Mã chỉ báo không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    await this.quality.deleteIndicator(user, id, originOf(request, user));
  }

  // ---- Công nhận ----

  @Get('recognition')
  recognition(@AuthenticatedUser() user: CurrentUser) {
    return this.quality.recognition(user);
  }

  // ---- Đợt tự đánh giá ----

  @Get('assessments')
  assessments(@AuthenticatedUser() user: CurrentUser) {
    return this.quality.assessments(user);
  }

  @Post('assessments')
  @RequirePermission(MANAGE)
  createAssessment(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.createAssessment(
      user,
      withErrors((errors) => readAssessment(body, errors)),
      originOf(request, user),
    );
  }

  @Get('assessments/:id')
  assessment(@Param('id', uuidParameter(ASSESSMENT)) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.assessment(user, id);
  }

  @Put('assessments/:id')
  @RequirePermission(MANAGE)
  updateAssessment(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateAssessment(
      user,
      id,
      withErrors((errors) => readAssessment(body, errors)),
      originOf(request, user),
    );
  }

  @Delete('assessments/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteAssessment(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    await this.quality.deleteAssessment(user, id, originOf(request, user));
  }

  @Put('assessments/:id/council')
  @RequirePermission(MANAGE)
  council(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.setCouncil(
      user,
      id,
      withErrors((errors) => readCouncil(body, errors)),
      originOf(request, user),
    );
  }

  @Put('assessments/:id/groups')
  @RequirePermission(MANAGE)
  groups(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.setGroups(
      user,
      id,
      withErrors((errors) => readGroups(body, errors)),
      originOf(request, user),
    );
  }

  @Post('assessments/:id/start')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  start(@Param('id', uuidParameter(ASSESSMENT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.start(user, id, originOf(request, user));
  }

  @Post('assessments/:id/complete')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  complete(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const level = withErrors((errors) => {
      const value = readInteger(body, 'self_level', errors, { min: 0, max: QUALITY_MAXIMUM_LEVEL });
      if (value === null && !errors.length) {
        errors.push({ field: 'self_level', message: 'Bắt buộc chọn mức của trường' });
      }
      return value ?? 0;
    });
    return this.quality.complete(user, id, level, originOf(request, user));
  }

  @Post('assessments/:id/reopen')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  reopen(@Param('id', uuidParameter(ASSESSMENT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.reopen(user, id, originOf(request, user));
  }

  @Put('assessments/:id/recognition')
  @RequirePermission(MANAGE)
  saveRecognition(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.saveRecognition(
      user,
      id,
      withErrors((errors) => readRecognition(body, errors)),
      originOf(request, user),
    );
  }

  @Post('assessments/:id/recognition/apply')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  apply(@Param('id', uuidParameter(ASSESSMENT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.applyToReview(user, id, originOf(request, user));
  }

  @Post('assessments/:id/inherit-evidences')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  inherit(@Param('id', uuidParameter(ASSESSMENT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.inheritEvidences(user, id, originOf(request, user));
  }

  @Post('assessments/:id/work-plan')
  @RequirePermission(MANAGE)
  workPlan(@Param('id', uuidParameter(ASSESSMENT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.createWorkPlan(user, id, originOf(request, user));
  }

  @Get('assessments/:id/report')
  async report(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
    @Res() response: Response,
  ) {
    if (format !== undefined && format !== 'pdf' && format !== 'docx') {
      throw validationError([{ field: 'format', message: 'Định dạng là pdf hoặc docx' }]);
    }
    sendBuffer(response, await this.quality.exportReport(user, id, format ?? 'docx'));
  }

  @Get('assessments/:id/evidences/export')
  async evidenceList(
    @Param('id', uuidParameter(ASSESSMENT)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
    @Res() response: Response,
  ) {
    sendBuffer(response, await this.quality.evidenceListFile(user, id, readTableFileFormat(format) ?? 'xlsx'));
  }

  // ---- Phiếu đánh giá tiêu chí ----

  @Get('reports')
  reports(
    @Query('assessment_id') assessmentId: string | undefined,
    @Query('mine') mine: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.reports(user, optionalUuid(assessmentId, 'assessment_id'), mine === 'true');
  }

  @Get('reports/:id')
  readReport(@Param('id', uuidParameter(REPORT)) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.report(user, id);
  }

  @Put('reports/:id')
  updateReport(
    @Param('id', uuidParameter(REPORT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateReport(
      user,
      id,
      withErrors((errors) => readReport(body, errors)),
      originOf(request, user),
    );
  }

  @Post('reports/:id/submit')
  @HttpCode(200)
  submit(@Param('id', uuidParameter(REPORT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.submitReport(user, id, originOf(request, user));
  }

  @Post('reports/:id/approve')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  approve(@Param('id', uuidParameter(REPORT)) id: string, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.quality.reviewReport(user, id, 'approve', null, originOf(request, user));
  }

  @Post('reports/:id/return')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  giveBack(
    @Param('id', uuidParameter(REPORT)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const note = withErrors((errors) => readText(body, 'note', errors, { required: true, maximum: 2000 }));
    return this.quality.reviewReport(user, id, 'return', note, originOf(request, user));
  }

  @Post('reports/:id/reopen')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  reopenReport(
    @Param('id', uuidParameter(REPORT)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.reopenReport(user, id, originOf(request, user));
  }

  // ---- Minh chứng ----

  @Get('evidence-sources')
  sources(
    @Query('source_type') sourceType: string | undefined,
    @Query('q') q: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const type = sourceType && sourceType in QUALITY_EVIDENCE_SOURCE_LABELS ? sourceType : 'none';
    return this.quality.evidenceSources(
      user,
      type as QualityEvidenceSourceCode,
      q && q.trim() !== '' ? q.trim().slice(0, 200) : null,
    );
  }

  @Get('evidences')
  evidences(@Query() query: Record<string, unknown>, @AuthenticatedUser() user: CurrentUser) {
    const status =
      typeof query.status === 'string' && query.status in QUALITY_EVIDENCE_STATUS_LABELS ? query.status : null;
    return this.quality.evidences(user, {
      assessment_id: requiredUuid(query.assessment_id, 'assessment_id'),
      criterion_id: optionalUuid(query.criterion_id, 'criterion_id'),
      status: status as QualityEvidenceStatusCode | null,
      q: typeof query.q === 'string' && query.q.trim() !== '' ? query.q.trim().slice(0, 200) : null,
    });
  }

  @Post('evidences')
  createEvidence(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    const { assessmentId, criterionId, box, input } = withErrors((errors) => ({
      assessmentId: readUuid(body, 'assessment_id', errors, true) ?? '',
      criterionId: readUuid(body, 'criterion_id', errors, true) ?? '',
      box: readInteger(body, 'box', errors, { min: 1, max: 99 }),
      input: readEvidence(body, errors),
    }));
    return this.quality.createEvidence(user, assessmentId, criterionId, box, input, originOf(request, user));
  }

  @Put('evidences/:id')
  updateEvidence(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.quality.updateEvidence(
      user,
      id,
      withErrors((errors) => readEvidence(body, errors)),
      originOf(request, user),
    );
  }

  @Delete('evidences/:id')
  @HttpCode(204)
  async deleteEvidence(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    await this.quality.deleteEvidence(user, id, originOf(request, user));
  }

  @Post('evidences/:id/file')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: QUALITY_MAXIMUM_FILE_BYTES, files: 1 } }))
  upload(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.quality.uploadEvidenceFile(
      user,
      id,
      { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      originOf(request, user),
    );
  }

  @Get('evidences/:id/file')
  async file(
    @Param('id', uuidParameter(EVIDENCE)) id: string,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const { file, body } = await this.quality.evidenceFile(user, id);
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }
}
