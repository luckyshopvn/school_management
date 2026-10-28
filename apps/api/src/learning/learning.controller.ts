import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { validationError } from '@school-management/server';
import type { Request } from 'express';
import { PERMISSION_CODES } from '@school-management/shared';
import { AuthenticatedUser, RequirePermission, RequirePlanModule } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { LearningService, parseActivityInput } from './learning.js';

// Tuyến của lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272): nhóm `/learning`. Quyền kiểm ở dịch vụ theo lớp học trực
// tuyến (giáo viên của lớp, Ban Giám hiệu, tổ trưởng), theo học sinh (phụ huynh) và theo vai trò (Hiệu trưởng quyết định
// hình thức, ban hành nội quy)
// Tuyến của nhân sự cần một trong các quyền học tập trực tuyến; quyền này gắn phân hệ của nhóm menu 9 nên trường có gói không
// gồm phân hệ đó nhận MODULE_NOT_IN_PLAN. Tuyến của phụ huynh (`children/...`) không gắn quyền, kiểm ở dịch vụ theo học sinh
const STAFF_PERMISSIONS = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningTemplate,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.learningView,
];

function readUuidList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200 || !value.every(isUuid)) {
    throw validationError([{ field, message: 'Danh sách mã từ 1 đến 200 phần tử hợp lệ' }]);
  }
  return value as string[];
}

@RequirePlanModule('online-learning')
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('config')
  config(@AuthenticatedUser() user: CurrentUser) {
    return this.learning.config(user);
  }

  // ---------- Lớp học trực tuyến ----------

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('spaces')
  spaces(@Query('scope') scope: string | undefined, @AuthenticatedUser() user: CurrentUser) {
    return this.learning.listSpaces(user, scope === 'all' ? 'all' : 'mine');
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/sync')
  @HttpCode(200)
  sync(@AuthenticatedUser() user: CurrentUser) {
    return this.learning.syncAll(user);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces')
  createElective(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.learning.createElective(user, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('spaces/:id')
  space(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.space(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Patch('spaces/:id')
  updateSpace(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.updateSpace(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/:id/teachers')
  @HttpCode(200)
  addTeacher(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    if (!isUuid(body?.user_id)) {
      throw validationError([{ field: 'user_id', message: 'Chọn giáo viên' }]);
    }
    return this.learning.addTeacher(user, id, body.user_id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Delete('spaces/:id/teachers/:userId')
  removeTeacher(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Param('userId', uuidParameter('Mã giáo viên không hợp lệ')) userId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.removeTeacher(user, id, userId);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/:id/enrollments')
  @HttpCode(200)
  enroll(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.enroll(user, id, readUuidList(body?.child_ids, 'child_ids'));
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Delete('spaces/:id/enrollments/:childId')
  unenroll(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.unenroll(user, id, childId);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('spaces/:id/progress')
  progress(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.progress(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('spaces/:id/plan')
  plan(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.plan(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('spaces/:id/events')
  events(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.events(user, id);
  }

  // ---------- Chương, hoạt động ----------

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/:id/sections')
  createSection(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.createSection(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Patch('sections/:id')
  updateSection(
    @Param('id', uuidParameter('Mã chương không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.updateSection(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Delete('sections/:id')
  removeSection(
    @Param('id', uuidParameter('Mã chương không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.removeSection(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('spaces/:id/activities')
  createActivity(
    @Param('id', uuidParameter('Mã lớp học trực tuyến không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.createActivity(user, id, parseActivityInput(body, false));
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Patch('activities/:id')
  updateActivity(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.updateActivity(user, id, parseActivityInput(body, true));
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('activities/:id/publish')
  @HttpCode(200)
  publish(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.publishActivity(user, id, body?.published !== false);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Delete('activities/:id')
  removeActivity(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.removeActivity(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('activities/:id/exceptions')
  @HttpCode(200)
  grantException(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.grantException(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('activities/:id/results')
  @HttpCode(200)
  recordResult(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.recordResult(user, id, body);
  }

  // ---------- Khoá học mẫu ----------

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('templates')
  templates(@AuthenticatedUser() user: CurrentUser) {
    return this.learning.templates(user);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('templates')
  createTemplate(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.learning.createTemplate(user, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('templates/:id')
  template(@Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.learning.template(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Put('templates/:id')
  saveTemplate(
    @Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.saveTemplate(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('templates/:id/submit')
  @HttpCode(200)
  submitTemplate(
    @Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.submitTemplate(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('templates/:id/review')
  @HttpCode(200)
  reviewTemplate(
    @Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.reviewTemplate(user, id, body);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('templates/:id/retire')
  @HttpCode(200)
  retireTemplate(
    @Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.retireTemplate(user, id);
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('templates/:id/apply')
  @HttpCode(200)
  applyTemplate(
    @Param('id', uuidParameter('Mã khoá mẫu không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.applyTemplate(user, id, readUuidList(body?.space_ids, 'space_ids'));
  }

  // ---------- Quyết định hình thức, nội quy (Thông tư 09/2021/TT-BGDĐT) ----------

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('decisions')
  decisions() {
    return this.learning.decisions();
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('decisions')
  createDecision(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.learning.createDecision(user, body, originOf(request, user));
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('decisions/:id/revoke')
  @HttpCode(200)
  revokeDecision(
    @Param('id', uuidParameter('Mã quyết định không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.revokeDecision(user, id, originOf(request, user));
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Get('rules')
  rules() {
    return this.learning.rules();
  }

  @RequirePermission(...STAFF_PERMISSIONS)
  @Post('rules')
  publishRule(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() user: CurrentUser) {
    return this.learning.publishRule(user, body, originOf(request, user));
  }

  // ---------- Phụ huynh ----------

  @Get('children/:childId')
  child(
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.childLearning(user, childId);
  }

  @Post('children/:childId/rules/acknowledge')
  @HttpCode(200)
  acknowledge(
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.learning.acknowledgeRule(user, childId, 'guardian');
  }
}
