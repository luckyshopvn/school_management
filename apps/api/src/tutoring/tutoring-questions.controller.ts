import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import type { RequestBody } from '../common/request-fields.js';
import { VideoRoomsService } from '../video/video-rooms.js';
import { TutoringQuestionsService } from './tutoring-questions.js';

// Điểm cuối hỏi đáp bài tập của chương trình gia sư (DT-27 phần 27e, YCTD-255): hàng chờ, gợi ý AI nháp, gửi câu trả lời cho giáo viên
// dạy, Ban Giám hiệu; câu hỏi của em, đánh dấu đã hiểu cho học sinh; câu hỏi của con, bật tắt AI cho cha mẹ. Học sinh hỏi, hỏi thêm
// qua điểm cuối hỏi đáp của 28e ở khoá học ghi sẵn của chương trình
const TEACH = PERMISSION_CODES.tutoringTeach;
const MANAGE = PERMISSION_CODES.tutoringManage;

@RequirePlanModule('tutoring')
@Controller('tutoring')
export class TutoringQuestionsController {
  constructor(private readonly questions: TutoringQuestionsService) {}

  @Get('questions')
  @RequirePermission(TEACH, MANAGE)
  queue(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.queue(currentUser);
  }

  @Get('questions/:id')
  @RequirePermission(TEACH, MANAGE)
  question(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.question(currentUser, id);
  }

  @Post('questions/:id/ai-draft')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  draft(@Param('id') id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.draft(currentUser, id, body);
  }

  @Post('questions/:id/answer')
  @RequirePermission(TEACH, MANAGE)
  answer(@Param('id') id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.answer(currentUser, id, body);
  }

  @Put('programs/:id/answer-hours')
  @RequirePermission(TEACH, MANAGE)
  answerHours(@Param('id') id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.setAnswerHours(currentUser, id, body);
  }
}

// Cha mẹ: câu hỏi của con ở các chương trình gia sư, bật tắt trợ lý AI cho câu hỏi của con
@RequirePlanModule('tutoring')
@Controller('children/:id/tutoring')
export class ChildTutoringQuestionsController {
  constructor(private readonly questions: TutoringQuestionsService) {}

  @Get('questions')
  list(@Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.childQuestions(currentUser, childId);
  }

  @Put('ai-consent')
  consent(@Param('id') childId: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.setConsent(currentUser, childId, body);
  }
}

// Học sinh (kênh student): câu hỏi của em ở các khoá gia sư, đánh dấu đã hiểu hoặc chưa hiểu
@RequirePlanModule('tutoring')
@Controller('student/tutoring')
@StudentEndpoint()
export class StudentTutoringQuestionsController {
  constructor(
    private readonly questions: TutoringQuestionsService,
    private readonly video: VideoRoomsService,
  ) {}

  @Get('questions')
  @RequirePermission(PERMISSION_CODES.learningStudy)
  async list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.studentQuestions(await this.video.studentChild(currentUser));
  }

  @Post('questions/:id/understood')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.learningStudy)
  async mark(@Param('id') id: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.questions.mark(await this.video.studentChild(currentUser), id, body);
  }
}
