import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { validationError } from '@school-management/server';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { originOf } from '../../common/audit-log.js';
import { isUuid, type RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { readTableFileFormat, type TableFileFormat } from '../../exports/table-file.js';
import { LearningProgressService, PROGRESS_PERMISSIONS } from './progress.js';

// Tuyến tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274), nhóm `/learning`. Tuyến nhân sự cần một
// trong các quyền học tập trực tuyến (thuộc phân hệ của nhóm menu 9 trong gói); ai xem lớp nào, báo cáo nào kiểm ở dịch vụ. Tuyến
// của phụ huynh (`children/.../summary`) không gắn quyền, kiểm theo học sinh như lõi
const SPACE_ID = uuidParameter('Mã lớp học trực tuyến không hợp lệ');

function formatOf(value: unknown): TableFileFormat {
  const format = readTableFileFormat(value);
  if (!format) {
    throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
  }
  return format;
}

function sendFile(response: Response, file: { buffer: Buffer; contentType: string; fileName: string }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

@Controller('learning')
export class LearningProgressController {
  constructor(private readonly progress: LearningProgressService) {}

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('spaces/:id/progress-grid')
  grid(@Param('id', SPACE_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.progress.grid(user, id);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('spaces/:id/gradebook')
  gradebook(@Param('id', SPACE_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.progress.gradebook(user, id);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('spaces/:id/gradebook/file')
  async gradebookFile(
    @Param('id', SPACE_ID) id: string,
    @Query('format') format: string | undefined,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    sendFile(response, await this.progress.gradebookFile(user, id, formatOf(format)));
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Post('spaces/:id/score-book/preview')
  @HttpCode(200)
  scoreBookPreview(
    @Param('id', SPACE_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.progress.scoreBookPreview(user, id, body);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Post('spaces/:id/score-book')
  @HttpCode(200)
  scoreBook(
    @Param('id', SPACE_ID) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.progress.scoreBookCommit(user, id, body, originOf(request, user));
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Post('spaces/:id/comment-book/preview')
  @HttpCode(200)
  commentBookPreview(
    @Param('id', SPACE_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.progress.commentBookPreview(user, id, body);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Post('spaces/:id/comment-book')
  @HttpCode(200)
  commentBook(
    @Param('id', SPACE_ID) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.progress.commentBookCommit(user, id, body, originOf(request, user));
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('spaces/:id/record')
  async record(
    @Param('id', SPACE_ID) id: string,
    @Query('term_type') term: string | undefined,
    @Query('format') format: string | undefined,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    sendFile(response, await this.progress.teachingRecordFile(user, id, term, formatOf(format)));
  }

  // ---------- Báo cáo theo vai trò ----------

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('reports/homeroom')
  homeroom(@Query('class_id') classId: string | undefined, @AuthenticatedUser() user: CurrentUser) {
    if (!isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Chọn lớp' }]);
    }
    return this.progress.homeroomReport(user, classId);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('reports/department')
  department(@AuthenticatedUser() user: CurrentUser) {
    return this.progress.departmentReport(user);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('reports/school')
  school(@AuthenticatedUser() user: CurrentUser) {
    return this.progress.schoolReport(user);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('reports/teachers')
  teachers(@AuthenticatedUser() user: CurrentUser) {
    return this.progress.teachersReport(user);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('term-reports/:term')
  termReport(@Param('term') term: string, @AuthenticatedUser() user: CurrentUser) {
    return this.progress.termReport(user, term);
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Put('term-reports/:term')
  saveTermReport(
    @Param('term') term: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.progress.saveTermReport(user, term, body, originOf(request, user));
  }

  @RequirePermission(...PROGRESS_PERMISSIONS)
  @Get('term-reports/:term/file')
  async termReportFile(
    @Param('term') term: string,
    @Query('format') format: string | undefined,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    sendFile(response, await this.progress.termReportFile(user, term, formatOf(format)));
  }

  // ---------- Phụ huynh ----------

  @Get('children/:childId/summary')
  childSummary(
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.progress.childSummary(user, childId);
  }
}
