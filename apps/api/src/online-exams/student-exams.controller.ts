import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readCameraState, readEvents, StudentExamsService } from './student-exams.js';

// Điểm cuối của học sinh (DT-23 phần 23a, YCTD-211): nhóm /student/*, chỉ mã phiên kênh student gọi được, chỉ trả dữ liệu của
// chính học sinh đang đăng nhập; đáp án đúng không đi qua nhóm này trước khi nộp
const idPipe = () => uuidParameter('Mã không hợp lệ');

// Hồ sơ hiện ở trang đầu ứng dụng học sinh: không thuộc thi trực tuyến nên không chặn theo gói (YCTD-315b; gói cơ bản miễn phí không
// có thi trực tuyến nhưng ứng dụng học sinh vẫn mở được)
@Controller('student')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.examTake)
export class StudentProfileController {
  constructor(private readonly service: StudentExamsService) {}

  @Get('profile')
  profile(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.profile(currentUser);
  }
}

@RequirePlanModule('online-exam')
@Controller('student')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.examTake)
export class StudentExamsController {
  constructor(private readonly service: StudentExamsService) {}

  @Get('exams')
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.list(currentUser);
  }

  @Post('exams/:id/start')
  @HttpCode(200)
  start(
    @Param('id', idPipe()) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.start(
      currentUser,
      id,
      {
        camera_state: readCameraState(body?.camera_state),
        room_code: typeof body?.room_code === 'string' ? body.room_code : null,
        proctor_notice: body?.proctor_notice === true,
      },
      originOf(request, currentUser),
      request.ip,
    );
  }

  @Get('attempts/:id')
  attempt(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.getAttempt(currentUser, id);
  }

  @Put('attempts/:id/answers')
  saveAnswers(
    @Param('id', idPipe()) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.saveAnswers(currentUser, id, body?.answers);
  }

  @Post('attempts/:id/events')
  @HttpCode(200)
  events(@Param('id', idPipe()) id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.recordEvents(currentUser, id, readEvents(body?.events));
  }

  @Post('attempts/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', idPipe()) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.submit(currentUser, id, body?.answers, originOf(request, currentUser));
  }

  @Get('attempts/:id/result')
  result(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.result(currentUser, id);
  }
}
