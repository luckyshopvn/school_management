import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { TenancyRuntime } from '@school-management/database';
import { isMultiTenantMode, runAsSchool, unauthenticatedError } from '@school-management/server';
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
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { JobScheduler } from '../common/job-scheduler.js';
import type { RequestBody } from '../common/request-fields.js';
import { MARKET_ROOM_PREFIX, MarketRoomsService } from '../market/market-rooms.js';
import { VIDEO_PROVIDER, VideoWebhookError, type VideoRoomProvider } from './video-provider.js';
import { VideoRoomsService } from './video-rooms.js';

// Điểm cuối của lớp video trực tiếp (DT-27 phần 27a, YCTD-251): nhóm /video cho giáo viên, Ban Giám hiệu (cổng quản trị, ứng dụng giáo
// viên); /children/{id}/video cho cha mẹ; /student/video cho học sinh (kênh student); /video/webhook nhận sự kiện của máy chủ video
const TEACH = PERMISSION_CODES.tutoringTeach;
const MANAGE = PERMISSION_CODES.tutoringManage;

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

  @Post('sessions/:id/room')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  openSessionRoom(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.openSessionRoom(currentUser, id, originOf(request, currentUser));
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
    return this.video.join(currentUser, id, null);
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

  @Post('rooms/:id/recording/start')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  startRecording(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.startRecording(currentUser, id, originOf(request, currentUser));
  }

  @Post('rooms/:id/recording/stop')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  stopRecording(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.stopRecording(currentUser, id, originOf(request, currentUser));
  }

  @Get('sessions/:id/recordings')
  @RequirePermission(TEACH, MANAGE)
  recordings(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.sessionRecordings(currentUser, id, null);
  }

  @Post('recordings/:id/view-link')
  @HttpCode(200)
  @RequirePermission(TEACH, MANAGE)
  viewLink(@Param('id') id: string, @AuthenticatedUser() currentUser: CurrentUser, @Req() request: Request) {
    return this.video.viewLink(currentUser, id, null, originOf(request, currentUser));
  }

  @Post('recordings/:id/hold')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  hold(
    @Param('id') id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.video.holdRecording(currentUser, id, body?.reason, originOf(request, currentUser));
  }
}

// Xem bản ghi bằng đường dẫn ký ngắn hạn (thẻ video của trình duyệt không gửi được mã phiên): phát trực tiếp, không cho lưu đệm
@Controller('video/recordings')
@PublicEndpoint()
export class VideoRecordingStreamController {
  constructor(private readonly video: VideoRoomsService) {}

  @Get(':id/stream')
  async stream(@Param('id') id: string, @Query('token') token: string, @Res() response: Response) {
    const contents = await this.video.streamRecording(id, token);
    response.setHeader('content-type', 'video/mp4');
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'no-store');
    response.send(contents);
  }
}

// Cha mẹ: phòng đang mở của buổi của con, vào xem; bản ghi của buổi; đồng ý ghi hình theo chương trình
@Controller('children/:id/video')
export class ChildVideoController {
  constructor(private readonly video: VideoRoomsService) {}

  @Get('rooms')
  rooms(@Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.consents(currentUser, childId).then(() => this.video.openRoomsOfChild(childId));
  }

  @Post('rooms/:roomId/join')
  @HttpCode(200)
  join(@Param('id') childId: string, @Param('roomId') roomId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.join(currentUser, roomId, childId);
  }

  @Get('sessions/:sessionId/recordings')
  recordings(
    @Param('id') childId: string,
    @Param('sessionId') sessionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.video.sessionRecordings(currentUser, sessionId, childId);
  }

  @Post('recordings/:recordingId/view-link')
  @HttpCode(200)
  viewLink(
    @Param('id') childId: string,
    @Param('recordingId') recordingId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.video.viewLink(currentUser, recordingId, childId, originOf(request, currentUser));
  }

  @Get('consents')
  consents(@Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.consents(currentUser, childId);
  }

  @Put('consents/:programId')
  setConsent(
    @Param('id') childId: string,
    @Param('programId') programId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.video.setConsent(currentUser, childId, programId, body?.agree === true, originOf(request, currentUser));
  }
}

// Học sinh (kênh student của 23a): phòng đang mở của buổi mình đăng ký, vào phòng
@Controller('student/video')
@StudentEndpoint()
export class StudentVideoController {
  constructor(private readonly video: VideoRoomsService) {}

  @Get('rooms')
  @RequirePermission(PERMISSION_CODES.learningStudy)
  async rooms(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.openRoomsOfChild(await this.video.studentChild(currentUser));
  }

  @Post('rooms/:roomId/join')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.learningStudy)
  async join(@Param('roomId') roomId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.video.join(currentUser, roomId, await this.video.studentChild(currentUser));
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
    private readonly modules: ModuleRef,
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
    // Phòng học của chợ gia sư (YCTD-362): không thuộc trường nào, ghi vào ra cho điểm danh ở cơ sở dữ liệu của chợ
    if (event.roomName.startsWith(MARKET_ROOM_PREFIX)) {
      const rooms = this.modules.get(MarketRoomsService, { strict: false });
      return rooms.handleEvent(event);
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

// Việc nền: xóa bản ghi video hết hạn mỗi giờ (một trường: hẹn giờ trong tiến trình; nhiều trường: bộ lập lịch theo từng trường)
@Injectable()
export class VideoJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('VideoJobs');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly video: VideoRoomsService,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    const run = async () => {
      try {
        await this.video.purgeExpired();
      } catch (error) {
        this.logger.warn(`Không dọn được bản ghi video: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    if (isMultiTenantMode()) {
      this.scheduler?.register({ name: 'video-recordings-cleanup', intervalSeconds: 3600, run });
      return;
    }
    this.timer = setInterval(() => void run(), 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
