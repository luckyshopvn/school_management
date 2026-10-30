import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import { AuthenticatedUser, RequirePermission, StudentEndpoint } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AiTutorChatService } from './tutor-chat.js';

// Điểm cuối trò chuyện với gia sư AI (YCTD-383 lát L2). Nhóm /student/ai-tutor: chỉ mã phiên kênh student, chỉ hội thoại của chính em
// (MH-596, MH-597). Cha mẹ: chủ đề và số lượt của con (máy chủ kiểm người giám hộ); giáo viên không có điểm cuối xem hội thoại
@Controller('student/ai-tutor')
@StudentEndpoint()
@RequirePermission(PERMISSION_CODES.learningStudy)
export class StudentAiTutorController {
  constructor(private readonly chat: AiTutorChatService) {}

  @Get()
  overview(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.chat.overview(currentUser);
  }

  @Get('conversations/:id')
  conversation(
    @Param('id', uuidParameter('Mã hội thoại không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.chat.conversation(currentUser, id);
  }

  @Post('messages')
  send(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.chat.send(currentUser, body);
  }

  @Post('messages/:id/report')
  @HttpCode(200)
  report(
    @Param('id', uuidParameter('Mã tin nhắn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.chat.report(currentUser, id, body);
  }
}

@Controller('children/:id/ai-tutor/topics')
export class ChildAiTutorTopicsController {
  constructor(private readonly chat: AiTutorChatService) {}

  @Get()
  topics(@Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.chat.parentTopics(currentUser, childId);
  }
}
