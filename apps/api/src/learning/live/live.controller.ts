import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../../authentication/authentication.guard.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { originOf } from '../../common/audit-log.js';
import type { RequestBody } from '../../common/request-fields.js';
import { uuidParameter } from '../../common/uuid-parameter.js';
import { LiveLearningService } from './live.js';

// Tuyến giờ học trực tuyến, phòng nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277). Cán bộ: quyền lớp học trực tuyến hoặc xử lý vi
// phạm, kiểm tiếp theo lớp học trực tuyến, nhóm ở dịch vụ; học sinh ở kênh student
const STAFF_PERMISSIONS = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningTemplate,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.learningView,
  PERMISSION_CODES.discussionModerate,
];
const ID = uuidParameter('Mã không hợp lệ');

@RequirePlanModule('online-learning')
@Controller('learning')
@RequirePermission(...STAFF_PERMISSIONS)
export class LiveLearningController {
  constructor(private readonly live: LiveLearningService) {}

  @Get('activities/:id/live')
  session(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.session(user, id);
  }

  @Post('activities/:id/live/open')
  @HttpCode(200)
  open(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.openSession(user, id);
  }

  @Post('activities/:id/live/attendance')
  @HttpCode(200)
  attendance(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.live.confirmAttendance(user, id, body);
  }

  @Post('live/rooms/:id/join')
  @HttpCode(200)
  join(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.staffJoin(user, id);
  }

  @Post('live/rooms/:id/leave')
  @HttpCode(200)
  leave(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.staffLeave(user, id);
  }

  @Post('live/rooms/:id/end')
  @HttpCode(200)
  end(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.endRoom(user, id);
  }

  @Post('live/rooms/:id/breakouts')
  createBreakouts(
    @Param('id', ID) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.live.createBreakouts(user, id, body, originOf(request, user));
  }

  @Post('live/rooms/:id/breakouts/close')
  @HttpCode(200)
  closeBreakouts(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.closeBreakouts(user, id);
  }

  @Post('live/rooms/:id/notices')
  notice(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.live.sendNotice(user, id, body);
  }

  @Post('live/rooms/:id/move')
  @HttpCode(200)
  move(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.live.moveStudent(user, id, body);
  }

  @Post('live/help/:id/resolve')
  @HttpCode(200)
  resolveHelp(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.resolveHelp(user, id);
  }

  @Get('spaces/:id/live-groups')
  groups(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.spaceGroups(user, id);
  }

  @Put('live/group-sets/:id')
  groupSetting(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.live.saveGroupSetting(user, id, body);
  }

  @Post('live/groups/:id/open')
  @HttpCode(200)
  openGroup(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.staffOpenGroup(user, id);
  }
}

@RequirePlanModule('online-learning')
@Controller('student/live')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentLiveController {
  constructor(private readonly live: LiveLearningService) {}

  @Get()
  overview(@AuthenticatedUser() user: CurrentUser) {
    return this.live.studentOverview(user);
  }

  @Post('activities/:id/join')
  @HttpCode(200)
  joinSession(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentJoinSession(user, id);
  }

  @Post('groups/:id/open')
  @HttpCode(200)
  openGroup(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentOpenGroup(user, id);
  }

  @Get('rooms/:id')
  room(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentRoom(user, id);
  }

  @Post('rooms/:id/join')
  @HttpCode(200)
  join(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentJoinRoom(user, id);
  }

  @Post('rooms/:id/leave')
  @HttpCode(200)
  leave(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentLeave(user, id);
  }

  @Post('rooms/:id/help')
  @HttpCode(200)
  help(@Param('id', ID) id: string, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentHelp(user, id);
  }

  @Post('rooms/:id/report')
  report(@Param('id', ID) id: string, @Body() body: RequestBody, @AuthenticatedUser() user: CurrentUser) {
    return this.live.studentReport(user, id, body);
  }
}
