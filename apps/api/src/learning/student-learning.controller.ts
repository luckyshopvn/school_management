import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  AuthenticatedUser,
  RequirePermission,
  StudentEndpoint,
  RequirePlanModule,
} from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { LearningService } from './learning.js';

// Học sinh tự học ở lớp học trực tuyến (DT-28 phần 28b, sau khi 23a gộp kênh student): nhóm /student/learning, chỉ mã phiên kênh
// student gọi được, chỉ dữ liệu của chính học sinh đang đăng nhập
@RequirePlanModule('online-learning')
@Controller('student/learning')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentLearningController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.learning.studentLearning(currentUser);
  }

  @Post('activities/:id/open')
  @HttpCode(200)
  open(
    @Param('id', uuidParameter('Mã hoạt động không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.learning.studentOpenActivity(currentUser, id);
  }

  @Post('rules/acknowledge')
  @HttpCode(200)
  acknowledge(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.learning.studentAcknowledgeRule(currentUser);
  }
}
