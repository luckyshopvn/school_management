import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { AuthenticatedUser, RequirePermission, StudentEndpoint } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { GROUP_FILE_BYTES } from './discussion-rules.js';
import { DiscussionsService } from './discussions.js';

// Học sinh ở diễn đàn, hỏi đáp, thông báo lớp, không gian học nhóm và lịch học tập (DT-28 phần 28e, YCTD-275): nhóm `/student`,
// chỉ mã phiên kênh student, chỉ lớp em học và nhóm em là thành viên. Không có tuyến nhắn riêng giữa hai học sinh
const SPACE_ID = uuidParameter('Mã lớp học trực tuyến không hợp lệ');
const THREAD_ID = uuidParameter('Mã chủ đề không hợp lệ');
const GROUP_ID = uuidParameter('Mã nhóm không hợp lệ');

@Controller('student')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentDiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Get('discussions/spaces/:id')
  threads(
    @Param('id', SPACE_ID) id: string,
    @Query('kind') kind: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.discussions.studentThreads(user, id, kind);
  }

  @Post('discussions/spaces/:id/threads')
  create(@Param('id', SPACE_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentCreateThread(user, id, body);
  }

  @Get('discussions/threads/:id')
  thread(@Param('id', THREAD_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentThread(user, id);
  }

  @Post('discussions/threads/:id/posts')
  reply(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentReply(user, id, body);
  }

  @Post('discussions/threads/:id/reports')
  report(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentReport(user, id, body);
  }

  @Delete('discussions/posts/:id')
  hide(@Param('id', uuidParameter('Mã trả lời không hợp lệ')) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentHidePost(user, id);
  }

  @Get('groups')
  groups(@AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentGroups(user);
  }

  @Get('groups/:id')
  group(@Param('id', GROUP_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentGroup(user, id);
  }

  @Post('groups/:id/threads')
  groupThread(@Param('id', GROUP_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentGroupThread(user, id, body);
  }

  @Post('groups/:id/tasks')
  addTask(@Param('id', GROUP_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentAddTask(user, id, body);
  }

  @Patch('group-tasks/:id')
  updateTask(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.discussions.studentUpdateTask(user, id, body);
  }

  @Put('groups/:id/note')
  note(@Param('id', GROUP_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentSaveNote(user, id, body);
  }

  @Post('groups/:id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: GROUP_FILE_BYTES, files: 1 } }))
  upload(
    @Param('id', GROUP_ID) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.discussions.studentUploadFile(user, id, file);
  }

  @Get('group-files/:id')
  async file(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const { file, body } = await this.discussions.groupFile(user, id, 'student');
    sendStoredFile(response, file, body);
  }

  @Get('calendar')
  calendar(@Query('from') from: string | undefined, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.studentCalendar(user, from);
  }
}
