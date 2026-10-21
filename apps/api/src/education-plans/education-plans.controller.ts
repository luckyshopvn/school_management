import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { EducationPlanStatus } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import {
  EDUCATION_PLAN_STATUS_LABELS,
  KPI_SCHOOL_LEVELS,
  PERMISSION_CODES,
  type KpiSchoolLevelCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { readChoice, readText, throwIfAny } from '../incoming-documents/incoming-fields.js';
import { readCopy, readPlan, readPlanUpdate, readTemplate } from './education-plan-fields.js';
import { EDUCATION_PLAN_PERMISSIONS, EducationPlansService, type PlanFilter } from './education-plans.js';

// Điểm cuối của kế hoạch giáo dục (DT-18 phần 22i, YCTD-147). Bộ bảo vệ chỉ chặn người không có quyền nào của kế hoạch giáo
// dục; người lập, tổ trưởng của tổ, trưởng nhóm, phạm vi đơn vị của từng bước duyệt và người quản lý kiểm tra ở dịch vụ
const MANAGE = PERMISSION_CODES.educationPlanManage;
const PLAN_MESSAGE = 'Mã kế hoạch không hợp lệ';
const TEMPLATE_MESSAGE = 'Mã mẫu không hợp lệ';
const VIEWS = new Set(['mine', 'groups', 'school', 'review', 'all']);
const LEVEL_LABELS = Object.fromEntries(KPI_SCHOOL_LEVELS.map((level) => [level.value, level.label])) as Record<
  KpiSchoolLevelCode,
  string
>;

function readNote(body: RequestBody, required = false): string | null {
  const errors: FieldError[] = [];
  const note = readText(body, 'note', errors, { maximum: 2000, required });
  throwIfAny(errors);
  return note;
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

function readFilter(query: Record<string, unknown>): PlanFilter {
  const view = typeof query.view === 'string' && VIEWS.has(query.view) ? query.view : 'mine';
  const status = typeof query.status === 'string' && query.status in EDUCATION_PLAN_STATUS_LABELS ? query.status : null;
  return {
    view: view as PlanFilter['view'],
    status: status as EducationPlanStatus | null,
    template_id: optionalUuid(query.template_id, 'template_id'),
    q: typeof query.q === 'string' && query.q.trim() !== '' ? query.q.trim().slice(0, 200) : null,
    processed: query.processed === 'true',
  };
}

function sendBuffer(response: Response, file: { fileName: string; contentType: string; buffer: Buffer }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

function withErrors<Value>(read: (errors: FieldError[]) => Value): Value {
  const errors: FieldError[] = [];
  const value = read(errors);
  throwIfAny(errors);
  return value;
}

@Controller()
@RequirePermission(...EDUCATION_PLAN_PERMISSIONS)
export class EducationPlansController {
  constructor(private readonly plans: EducationPlansService) {}

  @Get('education-plans/overview')
  overview(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.overview(currentUser);
  }

  // ---- Thư viện mẫu ----

  @Get('education-plan-templates')
  templates(
    @Query('school_level') level: string | undefined,
    @Query('include_inactive') includeInactive: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const value = level && level in LEVEL_LABELS ? (level as KpiSchoolLevelCode) : null;
    return this.plans.templates(currentUser, value, includeInactive === 'true');
  }

  @Post('education-plan-templates')
  @RequirePermission(MANAGE)
  createTemplate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.createTemplate(
      currentUser,
      withErrors((errors) => readTemplate(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Post('education-plan-templates/defaults')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  defaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const level = withErrors((errors) => {
      if (!body?.school_level) {
        errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp học' });
      }
      return readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors);
    });
    return this.plans.loadDefaults(currentUser, level, originOf(request, currentUser));
  }

  @Put('education-plan-templates/:id')
  @RequirePermission(MANAGE)
  updateTemplate(
    @Param('id', uuidParameter(TEMPLATE_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.updateTemplate(
      currentUser,
      id,
      withErrors((errors) => readTemplate(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Delete('education-plan-templates/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteTemplate(
    @Param('id', uuidParameter(TEMPLATE_MESSAGE)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.plans.deleteTemplate(currentUser, id, originOf(request, currentUser));
  }

  // ---- Bảng tiến độ duyệt, năm trước ----

  @Get('education-plans/progress')
  progress(@Query('template_id') templateId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.progress(currentUser, optionalUuid(templateId, 'template_id'));
  }

  @Get('education-plans/progress/export')
  async progressFile(
    @Query('template_id') templateId: string | undefined,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.plans.progressFile(
      currentUser,
      optionalUuid(templateId, 'template_id'),
      readTableFileFormat(format) ?? 'xlsx',
    );
    sendBuffer(response, file);
  }

  @Get('education-plans/previous-year')
  previous(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.previousPlans(currentUser);
  }

  @Post('education-plans/copy')
  copy(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.copyFromPrevious(
      currentUser,
      withErrors((errors) => readCopy(body, errors)),
      originOf(request, currentUser),
    );
  }

  // ---- Kế hoạch ----

  @Get('education-plans')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.list(currentUser, readFilter(query));
  }

  @Post('education-plans')
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.create(
      currentUser,
      withErrors((errors) => readPlan(body, errors)),
      originOf(request, currentUser),
    );
  }

  @Get('education-plans/:id')
  view(@Param('id', uuidParameter(PLAN_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.view(currentUser, id);
  }

  @Put('education-plans/:id')
  update(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.update(
      currentUser,
      id,
      (sections) => withErrors((errors) => readPlanUpdate(sections, body, errors)),
      originOf(request, currentUser),
    );
  }

  @Delete('education-plans/:id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.plans.remove(currentUser, id, originOf(request, currentUser));
  }

  @Post('education-plans/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.submit(currentUser, id, readNote(body));
  }

  @Post('education-plans/:id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', uuidParameter(PLAN_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.withdraw(currentUser, id);
  }

  @Post('education-plans/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.approve(currentUser, id, readNote(body));
  }

  @Post('education-plans/:id/return')
  @HttpCode(200)
  giveBack(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.giveBack(currentUser, id, readNote(body, true) ?? '');
  }

  @Get('education-plans/:id/diff')
  diff(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!from) {
      throw validationError([{ field: 'from', message: 'Chọn bản để so sánh' }]);
    }
    return this.plans.diff(currentUser, id, from, to || null);
  }

  @Get('education-plans/:id/export')
  async exportDocument(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Query('format') format: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    if (format !== undefined && format !== 'pdf' && format !== 'docx') {
      throw validationError([{ field: 'format', message: 'Định dạng là pdf hoặc docx' }]);
    }
    sendBuffer(response, await this.plans.exportDocument(currentUser, id, format ?? 'docx'));
  }

  @Get('education-plans/:id/signed-file')
  async signedFile(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const { file, body } = await this.plans.signedFile(currentUser, id);
    sendBuffer(response, { fileName: file.file_name, contentType: file.content_type, buffer: body });
  }

  @Post('education-plans/:id/work-plan')
  createWorkPlan(
    @Param('id', uuidParameter(PLAN_MESSAGE)) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.createWorkPlan(currentUser, id, originOf(request, currentUser));
  }
}
