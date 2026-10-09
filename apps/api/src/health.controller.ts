import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAMES, type HealthResponse } from '@school-management/shared';
import { PublicEndpoint } from './authentication/authentication.guard.js';

// Điểm cuối kiểm tra sức khỏe, không cần mã phiên
@Controller('health')
@PublicEndpoint()
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', service: SERVICE_NAMES.api };
  }
}
