import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import { sendStoredFile } from '../../activities/content-files.js';
import { AuthenticatedUser, RequirePermission, RequirePlanModule } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { AssignmentsService } from './assignments.js';

// Tuyến bài tập trực tuyến của giáo viên (DT-28 phần 28c, YCTD-273): soạn, phát hành, theo dõi, chấm, trả bài ở hoạt động loại
// bài tập; cần quyền `P02.assignment.manage` và là giáo viên của lớp học trực tuyến (kiểm qua cửa của lõi 28b). Tuyến của phụ
// huynh (`children/...`) không gắn quyền, kiểm ở dịch vụ theo học sinh như lõi
const ACTIVITY_ID = uuidParameter('Mã hoạt động không hợp lệ');
const SUBMISSION_ID = uuidParameter('Mã bài nộp không hợp lệ');

@RequirePlanModule('online-learning')
@Controller('learning')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('activities/:id/assignment')
  editor(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.editor(user, id);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Put('activities/:id/assignment')
  save(@Param('id', ACTIVITY_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.save(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Patch('activities/:id/assignment')
  updateSettings(
    @Param('id', ACTIVITY_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.updateSettings(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('activities/:id/assignment/questions')
  questions(
    @Param('id', ACTIVITY_ID) id: string,
    @Query('search') search: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.questionBank(user, id, search);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('activities/:id/assignment/release')
  @HttpCode(200)
  release(@Param('id', ACTIVITY_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.release(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('activities/:id/assignment/close')
  @HttpCode(200)
  close(@Param('id', ACTIVITY_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.close(user, id, body?.closed !== false);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Patch('activities/:id/assignment/recipients/:childId')
  recipient(
    @Param('id', ACTIVITY_ID) id: string,
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.updateRecipient(user, id, childId, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('activities/:id/assignment/submissions')
  submissions(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.submissions(user, id);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('activities/:id/assignment/return')
  @HttpCode(200)
  returnAll(@Param('id', ACTIVITY_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.returnSubmissions(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('activities/:id/assignment/comment-bank')
  commentBank(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.commentBank(user, id);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('assignment-comments')
  addBankComment(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.addBankComment(user, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Delete('assignment-comments/:id')
  removeBankComment(
    @Param('id', uuidParameter('Mã câu nhận xét không hợp lệ')) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.removeBankComment(user, id);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('submissions/:id')
  submission(@Param('id', SUBMISSION_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.submission(user, id);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('submissions/:id/grade')
  @HttpCode(200)
  grade(@Param('id', SUBMISSION_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.grade(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('submissions/:id/contributions/:childId')
  @HttpCode(200)
  adjust(
    @Param('id', SUBMISSION_ID) id: string,
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.adjustContribution(user, id, childId, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('submissions/:id/ai-feedback')
  @HttpCode(200)
  aiFeedback(
    @Param('id', SUBMISSION_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.suggestFeedback(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Post('submissions/:id/comments')
  comment(@Param('id', SUBMISSION_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.assignments.teacherComment(user, id, body);
  }

  @RequirePermission(PERMISSION_CODES.assignmentManage)
  @Get('submission-files/:id')
  async file(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const { file, body } = await this.assignments.teacherFile(user, id);
    sendStoredFile(response, file, body);
  }

  // ---------- Phụ huynh ----------

  @Get('children/:childId/assignments/:id')
  child(
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Param('id', ACTIVITY_ID) id: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.assignments.childAssignment(user, childId, id);
  }
}
