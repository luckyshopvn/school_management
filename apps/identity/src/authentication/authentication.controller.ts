import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { validationError, type FieldError } from '../common/application-error.js';
import {
  AccessTokenGuard,
  AllowedWhilePasswordChangeRequired,
  type AuthenticatedRequest,
} from './access-token.guard.js';
import { assertChannel, AuthenticationService, type RequestOrigin } from './authentication.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

type RequestBody = Record<string, unknown> | undefined;

function readText(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = body?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, message: 'Bắt buộc nhập' });
    return '';
  }
  return value;
}

function readOrigin(request: Request): RequestOrigin {
  return { ipAddress: request.ip ?? 'unknown', userAgent: request.header('user-agent') ?? null };
}

// Nhóm điểm cuối xác thực do dịch vụ định danh phục vụ (17_DAC_TA_API.md mục 4)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly loginRateLimiter: LoginRateLimiter,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: RequestBody, @Req() request: Request) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const errors: FieldError[] = [];
    const login = readText(body, 'login', errors).trim();
    const password = readText(body, 'password', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const channel = assertChannel(body?.channel);
    return this.authenticationService.login(login, password, channel, origin);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RequestBody, @Req() request: Request) {
    const errors: FieldError[] = [];
    const refreshToken = readText(body, 'refresh_token', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.authenticationService.refresh(refreshToken, readOrigin(request));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  @AllowedWhilePasswordChangeRequired()
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authenticationService.logout(request.accessTokenClaims);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @AllowedWhilePasswordChangeRequired()
  async changePassword(@Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    const errors: FieldError[] = [];
    const currentPassword = readText(body, 'current_password', errors);
    const newPassword = readText(body, 'new_password', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.authenticationService.changePassword(request.accessTokenClaims, currentPassword, newPassword);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @AllowedWhilePasswordChangeRequired()
  async me(@Req() request: AuthenticatedRequest) {
    return this.authenticationService.describeCurrentUser(request.accessTokenClaims);
  }
}
