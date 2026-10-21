import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { readBearerToken } from '@school-management/server';
import { AccessTokenGuard, type AuthenticatedRequest } from '../authentication/access-token.guard.js';
import { IdentitySettingsService } from './identity-settings.service.js';
import { ImpersonationService } from '../authentication/impersonation.service.js';

// Cấu hình chung của dịch vụ định danh; nằm dưới nhóm auth để cổng vào chuyển sang dịch vụ định danh
@Controller('auth/settings')
@UseGuards(AccessTokenGuard)
export class IdentitySettingsController {
  constructor(
    private readonly identitySettings: IdentitySettingsService,
    private readonly impersonation: ImpersonationService,
  ) {}

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
  async update(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown> | undefined) {
    // Cấu hình có mật khẩu mặc định của phụ huynh: không sửa khi đang đăng nhập thay (DT-18 phần 18h)
    await this.impersonation.assertNotImpersonating(request.accessTokenClaims.sessionId, 'sửa cấu hình đăng nhập');
    return this.identitySettings.update(this.caller(request), body);
  }

  // Chính sách hạn mật khẩu (YCTD-110); người có quyền quản lý mọi tài khoản đọc và sửa
  @Get('password-policy')
  readPasswordPolicy(@Req() request: AuthenticatedRequest) {
    return this.identitySettings.readPasswordPolicy(this.caller(request));
  }

  @Put('password-policy')
  async updatePasswordPolicy(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown> | undefined) {
    await this.impersonation.assertNotImpersonating(request.accessTokenClaims.sessionId, 'sửa chính sách mật khẩu');
    return this.identitySettings.updatePasswordPolicy(this.caller(request), body);
  }
}
