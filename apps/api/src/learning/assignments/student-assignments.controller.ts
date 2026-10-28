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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import { sendStoredFile, type UploadedPart } from '../../activities/content-files.js';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { AssignmentsService } from './assignments.js';

// Học sinh làm, nộp bài tập trực tuyến (DT-28 phần 28c, YCTD-273): nhóm /student/assignments, chỉ mã phiên kênh student, chỉ
// bài của chính học sinh (hoặc nhóm của em). Tệp tối đa 25 MB một lần gửi ở tầng nhận; giới hạn của bài nộp kiểm ở dịch vụ
const ACTIVITY_ID = uuidParameter('Mã hoạt động không hợp lệ');
const MAXIMUM_PART_BYTES = 25 * 1024 * 1024;

@RequirePlanModule('online-learning')
@Controller('student/assignments')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentAssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get(':id')
  view(@Param('id', ACTIVITY_ID) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assignments.studentAssignment(currentUser, id);
  }

  @Put(':id/draft')
  draft(
    @Param('id', ACTIVITY_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assignments.studentSaveDraft(currentUser, id, body);
  }

  @Post(':id/items/:itemId/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_PART_BYTES, files: 1 } }))
  upload(
    @Param('id', ACTIVITY_ID) id: string,
    @Param('itemId', uuidParameter('Mã câu không hợp lệ')) itemId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Query('client_key') clientKey: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assignments.studentUpload(currentUser, id, itemId, file, clientKey);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @Param('id', ACTIVITY_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assignments.studentSubmit(currentUser, id, body);
  }

  @Post(':id/contribution')
  @HttpCode(200)
  contribution(
    @Param('id', ACTIVITY_ID) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assignments.studentContribution(currentUser, id, body);
  }

  @Post(':id/submissions/:submissionId/comments')
  comment(
    @Param('id', ACTIVITY_ID) id: string,
    @Param('submissionId', uuidParameter('Mã bài nộp không hợp lệ')) submissionId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assignments.studentComment(currentUser, id, submissionId, body);
  }

  @Get('files/:fileId')
  async file(
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.assignments.studentFile(currentUser, fileId);
    sendStoredFile(response, file, body);
  }

  @Delete('files/:fileId')
  removeFile(
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assignments.studentRemoveFile(currentUser, fileId);
  }
}
