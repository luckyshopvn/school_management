import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import { sendStoredFile } from '../../activities/content-files.js';
import { AuthenticatedUser, RequirePermission, RequirePlanModule } from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { DiscussionsService } from './discussions.js';

// Tuyến giao tiếp trong lớp và nhóm của nhân sự, phụ huynh (DT-28 phần 28e, YCTD-275), nhóm `/learning`. Tuyến nhân sự cần một
// trong các quyền học tập trực tuyến (thuộc phân hệ nhóm menu 9 của gói); ai xem lớp, nhóm nào kiểm ở dịch vụ. Hàng chờ báo cáo vi
// phạm cần `P02.discussion.moderate`. Tuyến phụ huynh (`children/...`) không gắn quyền, kiểm theo học sinh như lõi
const STAFF = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningView,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.discussionModerate,
];
const SPACE_ID = uuidParameter('Mã lớp học trực tuyến không hợp lệ');
const THREAD_ID = uuidParameter('Mã chủ đề không hợp lệ');
const GROUP_ID = uuidParameter('Mã nhóm không hợp lệ');
const CHILD_ID = uuidParameter('Mã học sinh không hợp lệ');

@RequirePlanModule('online-learning')
@Controller('learning')
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @RequirePermission(...STAFF)
  @Get('spaces/:id/threads')
  threads(
    @Param('id', SPACE_ID) id: string,
    @Query('kind') kind: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.discussions.listThreads(user, id, kind);
  }

  @RequirePermission(...STAFF)
  @Post('spaces/:id/threads')
  create(@Param('id', SPACE_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.createThread(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Put('spaces/:id/discussion-settings')
  settings(@Param('id', SPACE_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.updateSpaceSettings(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Get('spaces/:id/questions/pending')
  pending(@Param('id', SPACE_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.pendingQuestions(user, id);
  }

  @RequirePermission(...STAFF)
  @Get('threads/:id')
  thread(@Param('id', THREAD_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.thread(user, id);
  }

  @RequirePermission(...STAFF)
  @Post('threads/:id/posts')
  reply(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.reply(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Post('threads/:id/accept')
  @HttpCode(200)
  accept(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.accept(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Post('threads/:id/lock')
  @HttpCode(200)
  lock(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.lock(user, id, body?.locked !== false);
  }

  @RequirePermission(...STAFF)
  @Post('threads/:id/hide')
  @HttpCode(200)
  hide(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.hide(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Post('threads/:id/reports')
  report(@Param('id', THREAD_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.staffReport(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Get('groups/:id/workspace')
  workspace(@Param('id', GROUP_ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.groupWorkspace(user, id);
  }

  @RequirePermission(...STAFF)
  @Post('groups/:id/threads')
  groupThread(@Param('id', GROUP_ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.staffGroupThread(user, id, body);
  }

  @RequirePermission(...STAFF)
  @Get('group-files/:id')
  async groupFile(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    const { file, body } = await this.discussions.groupFile(user, id, 'staff');
    sendStoredFile(response, file, body);
  }

  // ---------- Cấu hình thảo luận của trường ----------

  @RequirePermission(...STAFF)
  @Get('discussion-config')
  config(@AuthenticatedUser() user: CurrentUser) {
    return this.discussions.discussionConfig(user);
  }

  @RequirePermission(...STAFF)
  @Put('discussion-config')
  saveConfig(@Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.saveDiscussionConfig(user, body);
  }

  // ---------- Hàng chờ báo cáo vi phạm ----------

  @RequirePermission(PERMISSION_CODES.discussionModerate)
  @Get('discussion-reports')
  reports(@Query('status') status: string | undefined, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.reports(user, status);
  }

  @RequirePermission(PERMISSION_CODES.discussionModerate)
  @Patch('discussion-reports/:id')
  resolve(
    @Param('id', uuidParameter('Mã báo cáo không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.discussions.resolveReport(user, id, body);
  }

  // ---------- Phụ huynh ----------

  @Get('children/:childId/announcements')
  announcements(@Param('childId', CHILD_ID) childId: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.childAnnouncements(user, childId);
  }

  @Get('children/:childId/groups')
  childGroups(@Param('childId', CHILD_ID) childId: string, @AuthenticatedUser() user: CurrentUser) {
    return this.discussions.childGroups(user, childId);
  }

  @Get('children/:childId/calendar')
  calendar(
    @Param('childId', CHILD_ID) childId: string,
    @Query('from') from: string | undefined,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.discussions.childCalendar(user, childId, from);
  }
}
