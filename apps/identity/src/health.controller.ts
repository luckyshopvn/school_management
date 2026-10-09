import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAMES, type HealthResponse } from '@school-management/shared';

// Điểm cuối kiểm tra sức khỏe, không cần mã phiên
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', service: SERVICE_NAMES.identity };
  }
}
