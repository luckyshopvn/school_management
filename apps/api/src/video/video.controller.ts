import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { TenancyRuntime } from '@school-management/database';
import { runAsSchool, unauthenticatedError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  PublicEndpoint,
  RequirePermission,
  RequirePlanModule,
} from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import type { RequestBody } from '../common/request-fields.js';
import { VIDEO_PROVIDER, VideoWebhookError, type VideoRoomProvider } from './video-provider.js';
import { VideoRoomsService } from './video-rooms.js';

// Điểm cuối của lớp video trực tiếp (DT-27 phần 27a, YCTD-251): nhóm /video cho giáo viên, Ban Giám hiệu (cấu hình của trường, phút
// đã dùng, phòng tức thời); /video/webhook nhận sự kiện của máy chủ video. Từ YCTD-384 lát L2 chương trình gia sư trong trường bị
// bỏ: quyền và gói theo học trực tuyến (lớp video dùng chung với giờ học trực tuyến của DT-28 phần 28g)
const TEACH = PERMISSION_CODES.learningTeach;
const MANAGE = PERMISSION_CODES.learningDecide;

@RequirePlanModule('online-learning')
@Controller('video')
export class VideoController {
  constructor(private readonly video: VideoRoomsService) {}

  @Get('status')
  @RequirePermission(TEACH, MANAGE)
  status() {
    return this.video.status();
  }

  @Get('settings')
  @RequirePermission(TEACH, MANAGE)
  settings() {
    return this.video.settings();
  }

  @Put('settings')
  @RequirePermission(MANAGE)
  saveSettings(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.saveSettings(currentUser, body, originOf(request, currentUser));
  }

  @Get('usage')
  @RequirePermission(TEACH, MANAGE)
  usage() {
    return this.video.usage();
  }

  @Post('rooms')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  openInstantRoom(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.openInstantRoom(currentUser, body?.title, originOf(request, currentUser));
  }

  @Get('rooms/:id')
  @RequirePermission(TEACH, MANAGE)
  room(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.roomDetail(currentUser, id);
  }

  @Post('rooms/:id/join')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  join(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.join(currentUser, id);
  }

  @Patch('rooms/:id/participants/:identity')
  @RequirePermission(TEACH, MANAGE)
  participant(
    @Param('id') id: string,
    @Param('identity') identity: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.video.updateParticipant(currentUser, id, identity, body, originOf(request, currentUser));
  }

  @Post('rooms/:id/end')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  end(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.endRoom(currentUser, id, originOf(request, currentUser));
  }
}

// Sự kiện gọi lại của máy chủ video: một địa chỉ cho mọi trường (không theo tên miền trường), trường lấy từ tên phòng. Video chưa
// bật thì 404; chữ ký sai thì 401 và không ghi gì
@Controller('video/webhook')
@PublicEndpoint()
export class VideoWebhookController {
  private readonly logger = new Logger(VideoWebhookController.name);

  constructor(
    private readonly video: VideoRoomsService,
    @Optional() @Inject(VIDEO_PROVIDER) private readonly provider: VideoRoomProvider | null = null,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() request: Request) {
    if (!this.provider) {
      throw new NotFoundException();
    }
    const body = await readRawBody(request);
    let event;
    try {
      event = await this.provider.receiveWebhook(body, request.headers.authorization);
    } catch (error) {
      if (error instanceof VideoWebhookError) {
        throw unauthenticatedError(error.message);
      }
      throw error;
    }
    if (!event) {
      return { handled: false };
    }
    const school = this.video.schoolOfRoom(event.roomName);
    if (this.tenancy) {
      // Sự kiện ghi xong (Egress) mang tên phòng trong thông tin ghi; không có tên phòng thì bỏ qua
      const tenant = school ? await this.tenancy.registry.contextOf(school).catch(() => null) : null;
      if (!tenant) {
        this.logger.warn(`Sự kiện video của phòng không rõ trường: ${event.roomName}`);
        return { handled: false };
      }
      return runAsSchool(tenant, () => this.video.handleEvent(event));
    }
    return this.video.handleEvent(event);
  }
}

// Thân thô của yêu cầu để kiểm chữ ký: LiveKit gửi `application/webhook+json` nên bộ đọc JSON không đọc trước
async function readRawBody(request: Request): Promise<string> {
  const parsed = typeof request.body === 'object' && request.body !== null && Object.keys(request.body).length > 0;
  if (request.readableEnded || parsed) {
    return JSON.stringify(request.body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}
