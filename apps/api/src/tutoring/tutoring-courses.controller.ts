import { Controller, Get, Headers, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import {
  AuthenticatedUser,
  PublicEndpoint,
  RequirePermission,
  StudentEndpoint,
} from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { VideoRoomsService } from '../video/video-rooms.js';
import { TutoringCoursesService } from './tutoring-courses.js';

// Điểm cuối khoá học ghi sẵn của chương trình gia sư (DT-27 phần 27d1, YCTD-254): giáo viên dạy, Ban Giám hiệu tạo và xem khoá; cha
// mẹ, học sinh xem bài video; phát video theo đoạn bằng đường dẫn ký ngắn hạn
const TEACH = PERMISSION_CODES.tutoringTeach;
const MANAGE = PERMISSION_CODES.tutoringManage;

@Controller('tutoring')
export class TutoringCoursesController {
  constructor(private readonly courses: TutoringCoursesService) {}

  @Post('programs/:id/course')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  attach(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.courses.attachCourse(currentUser, id, originOf(request, currentUser));
  }

  @Get('programs/:id/course')
  @RequirePermission(TEACH, MANAGE)
  course(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.courses.course(currentUser, id);
  }

  @Post('course-media/:activityId/link')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  link(
    @Param('activityId') activityId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.courses.mediaLink(
      currentUser,
      activityId,
      { childId: null, student: false },
      originOf(request, currentUser),
    );
  }
}

// Phát video bài học bằng đường dẫn ký 5 phút (thẻ video không gửi được mã phiên), theo đoạn (Range), không lưu đệm
@Controller('tutoring/course-media')
@PublicEndpoint()
export class TutoringCourseMediaStreamController {
  constructor(private readonly courses: TutoringCoursesService) {}

  @Get(':activityId/stream')
  async stream(
    @Param('activityId') activityId: string,
    @Query('token') token: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const part = await this.courses.stream(activityId, token, range);
    response.setHeader('accept-ranges', 'bytes');
    response.setHeader('content-type', part.contentType);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'no-store');
    if (part.status === 416) {
      response.status(416).setHeader('content-range', `bytes */${part.total}`);
      response.end();
      return;
    }
    if (part.status === 206) {
      response.status(206).setHeader('content-range', `bytes ${part.start}-${part.end}/${part.total}`);
    }
    response.send(part.contents);
  }
}

// Cha mẹ: khoá học ghi sẵn của chương trình mà con có đơn được duyệt, xem bài video
@Controller('children/:id/tutoring')
export class ChildTutoringCoursesController {
  constructor(private readonly courses: TutoringCoursesService) {}

  @Get('programs/:programId/course')
  course(
    @Param('id') childId: string,
    @Param('programId') programId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.courses.childCourse(currentUser, childId, programId);
  }

  @Post('course-media/:activityId/link')
  @HttpCode(200)
  link(
    @Param('id') childId: string,
    @Param('activityId') activityId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.courses.mediaLink(currentUser, activityId, { childId, student: false }, originOf(request, currentUser));
  }
}

// Học sinh (kênh student): khoá gia sư mình được ghi danh, xem bài video
@Controller('student/tutoring')
@StudentEndpoint()
export class StudentTutoringCoursesController {
  constructor(
    private readonly courses: TutoringCoursesService,
    private readonly video: VideoRoomsService,
  ) {}

  @Get('courses')
  @RequirePermission(PERMISSION_CODES.learningStudy)
  async list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.courses.studentCourses(await this.video.studentChild(currentUser));
  }

  @Post('course-media/:activityId/link')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.learningStudy)
  async link(
    @Param('activityId') activityId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    const childId = await this.video.studentChild(currentUser);
    return this.courses.mediaLink(currentUser, activityId, { childId, student: true }, originOf(request, currentUser));
  }
}
