import { Body, Controller, Get, HttpCode, Param, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import { AuthenticatedUser, RequirePermission, StudentEndpoint } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AiTutorChatService } from './tutor-chat.js';
import { IMAGE_MAX_BYTES, IMAGE_MAX_COUNT } from './tutor-images.js';

// Phần tệp do bộ nhận tệp nhiều phần của Express trả về
interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

// Điểm cuối trò chuyện với gia sư AI (YCTD-383 lát L2). Nhóm /student/ai-tutor: chỉ mã phiên kênh student, chỉ hội thoại của chính em
// (MH-596, MH-597). Cha mẹ: chủ đề và số lượt của con (máy chủ kiểm người giám hộ); giáo viên không có điểm cuối xem hội thoại.
// Lát L4: câu hỏi kèm ảnh gửi dạng nhiều phần, trường `images`; ảnh chỉ tải qua nhóm /student/ai-tutor của chính em
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

  // Bộ nhận tệp nhận thêm một ảnh so với giới hạn để máy chủ trả lời rõ "tối đa 3 ảnh"; ảnh quá cỡ dừng ngay ở bộ nhận tệp
  @Post('messages')
  @UseInterceptors(
    FilesInterceptor('images', IMAGE_MAX_COUNT + 1, {
      limits: { fileSize: IMAGE_MAX_BYTES, files: IMAGE_MAX_COUNT + 1 },
    }),
  )
  send(
    @Body() body: RequestBody,
    @UploadedFiles() files: UploadedPart[] | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.chat.send(
      currentUser,
      body,
      (files ?? []).map((file) => ({ originalName: file.originalname, size: file.size, buffer: file.buffer })),
    );
  }

  @Get('images/:id')
  async image(
    @Param('id', uuidParameter('Mã ảnh không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { contentType, body } = await this.chat.image(currentUser, id);
    response.setHeader('content-type', contentType);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.send(body);
  }

  // Lát L5: gửi lời nhờ cha mẹ khi chưa có gói hoặc hết lượt (MH-596)
  @Post('parent-requests')
  requestParents(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.chat.requestParents(currentUser);
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
