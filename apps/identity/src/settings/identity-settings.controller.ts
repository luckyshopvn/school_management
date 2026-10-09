import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { readBearerToken } from '@school-management/server';
import { AccessTokenGuard, type AuthenticatedRequest } from '../authentication/access-token.guard.js';
import { IdentitySettingsService } from './identity-settings.service.js';

// Cấu hình chung của dịch vụ định danh; nằm dưới nhóm auth để cổng vào chuyển sang dịch vụ định danh
@Controller('auth/settings')
@UseGuards(AccessTokenGuard)
export class IdentitySettingsController {
  constructor(private readonly identitySettings: IdentitySettingsService) {}

  private caller(request: AuthenticatedRequest) {
    return {
      claims: request.accessTokenClaims,
      accessToken: readBearerToken(request.header('authorization')),
      ipAddress: request.ip ?? null,
    };
  }

  @Get()
  read(@Req() request: AuthenticatedRequest) {
    return this.identitySettings.read(this.caller(request));
  }

  @Put()
  update(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown> | undefined) {
    return this.identitySettings.update(this.caller(request), body?.account_inactivity_lock_days);
  }
}
