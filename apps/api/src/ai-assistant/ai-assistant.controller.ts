import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Req,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { isMultiTenantMode, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { JobScheduler } from '../common/job-scheduler.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AI_PROVIDERS, AiAssistantService, parseAiSettings } from './ai-assistant.js';
import type { AiProviderRegistry } from './ai-provider.js';

// Điểm cuối trợ lý AI (DT-23 phần 23d, YCTD-214): trạng thái cho nút "Soạn nháp bằng AI", soạn câu hỏi nháp (quyền soạn câu hỏi),
// soạn kế hoạch bài dạy nháp (quyền dùng kho học liệu), màn hình quản trị AI của trường (quyền quản lý kết nối ngoài: bật tắt, mô hình,
// hạn mức mỗi người, kiểm tra kết nối, nhật ký). Khóa nhập qua `/school-settings/integrations/ai` (S3), không qua đây
const AUTHOR = PERMISSION_CODES.questionAuthor;
const USE = PERMISSION_CODES.learningResourceUse;
const MANAGE = PERMISSION_CODES.integrationManage;
const AI_JOB_SECONDS = 900;

@Controller('ai')
export class AiAssistantController {
  constructor(
    private readonly assistant: AiAssistantService,
    @Inject(AI_PROVIDERS) private readonly providers: AiProviderRegistry,
  ) {}

  @Get('status')
  @RequirePermission(AUTHOR, USE, MANAGE)
  status(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.assistant.status(currentUser, currentUser.hasPermission(MANAGE));
  }

  @Put('settings')
  @RequirePermission(MANAGE)
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assistant.saveSettings(
      parseAiSettings(body, this.providers.codes()),
      currentUser,
      originOf(request, currentUser),
    );
  }

  @Post('check')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  check(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.assistant.check(currentUser);
  }

  @Get('requests')
  @RequirePermission(MANAGE)
  requests(@Query() query: Record<string, string | undefined>) {
    const limit = query.limit === undefined ? 100 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw validationError([{ field: 'limit', message: 'Số dòng từ 1 đến 500' }]);
    }
    if (query.status && !['success', 'failed', 'rejected', 'blocked'].includes(query.status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là success, failed, rejected hoặc blocked' }]);
    }
    return this.assistant.requests({ limit, status: query.status });
  }

  @Get('requests/:id')
  @RequirePermission(MANAGE)
  request(@Param('id', uuidParameter('Mã yêu cầu AI không hợp lệ')) id: string) {
    return this.assistant.requestById(id);
  }

  @Post('question-drafts')
  @HttpCode(201)
  @RequirePermission(AUTHOR)
  draftQuestions(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assistant.draftQuestions(currentUser, body, originOf(request, currentUser));
  }

  @Post('lesson-plan-drafts')
  @HttpCode(201)
  @RequirePermission(USE)
  draftLessonPlan(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assistant.draftLessonPlan(currentUser, body);
  }
}

// Việc nền theo trường (chỉ nhiều trường): tổng hợp token lên nền tảng để tính phí, xóa nhật ký quá hạn giữ
@Injectable()
export class AiUsageJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiUsageJob.name);

  constructor(
    private readonly assistant: AiAssistantService,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    if (isMultiTenantMode()) {
      this.scheduler?.register({ name: 'ai-usage-sync', intervalSeconds: AI_JOB_SECONDS, run: () => this.run() });
    }
  }

  async run(): Promise<void> {
    const synced = await this.assistant.syncUsage();
    const purged = await this.assistant.purgeExpired();
    if (purged > 0) {
      this.logger.log(`Đã xóa ${purged} dòng nhật ký AI quá hạn giữ (đã tổng hợp ${synced} nhóm token)`);
    }
  }
}
