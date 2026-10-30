import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AiTutorSafetyFlagService } from './safety-flags.js';

// Cờ cảnh báo của gia sư AI cho giáo viên chủ nhiệm (YCTD-383 lát L3). Không gắn quyền riêng: máy chủ chỉ trả cờ của em đang học lớp
// người xem chủ nhiệm, hoặc của lớp chưa có giáo viên chủ nhiệm khi người xem là Ban Giám hiệu; tài khoản khác nhận danh sách trống
@Controller('ai-tutor/safety-flags')
export class AiTutorSafetyFlagsController {
  constructor(private readonly flags: AiTutorSafetyFlagService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.flags.list(currentUser);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @Param('id', uuidParameter('Mã cờ không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.flags.resolve(currentUser, id, originOf(request, currentUser));
  }
}
