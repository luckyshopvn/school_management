import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Clock, unauthenticatedError, validationError, type FieldError } from '@school-management/server';
import {
  AccessTokenGuard,
  AllowedWhilePasswordChangeRequired,
  type AuthenticatedRequest,
} from './access-token.guard.js';
import { assertChannel, AuthenticationService, type RequestOrigin } from './authentication.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { OneTimeCodeService } from './one-time-code.service.js';
import { clearRefreshTokenCookie, readRefreshTokenCookie, setRefreshTokenCookie } from './refresh-token-cookie.js';

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
    private readonly oneTimeCodeService: OneTimeCodeService,
    private readonly clock: Clock,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: RequestBody, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const errors: FieldError[] = [];
    const login = readText(body, 'login', errors).trim();
    const password = readText(body, 'password', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const channel = assertChannel(body?.channel);
    const issued = await this.authenticationService.login(login, password, channel, origin);
    setRefreshTokenCookie(response, channel, issued.refreshToken, issued.refreshExpiresAt, this.clock);
    return issued.response;
  }

  // Phụ huynh yêu cầu mã một lần; phản hồi như nhau dù số điện thoại có hay không (BM-61)
  @Post('otp/request')
  @HttpCode(200)
  async requestOneTimeCode(@Body() body: RequestBody, @Req() request: Request) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const errors: FieldError[] = [];
    const phone = readText(body, 'phone', errors).trim();
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.oneTimeCodeService.request(phone, origin);
  }

  @Post('otp/login')
  @HttpCode(200)
  async loginWithOneTimeCode(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const errors: FieldError[] = [];
    const phone = readText(body, 'phone', errors).trim();
    const code = readText(body, 'code', errors).trim();
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const issued = await this.oneTimeCodeService.login(phone, code, origin);
    setRefreshTokenCookie(response, 'parent', issued.refreshToken, issued.refreshExpiresAt, this.clock);
    return issued.response;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RequestBody, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    // Kênh mặc định là cổng quản trị để giữ tương thích với bản trước (YCTD-43)
    const channel = body?.channel === undefined ? 'portal' : assertChannel(body.channel);
    const refreshToken = readRefreshTokenCookie(request, channel);
    if (!refreshToken) {
      throw unauthenticatedError();
    }
    try {
      const issued = await this.authenticationService.refresh(refreshToken, channel, readOrigin(request));
      setRefreshTokenCookie(response, channel, issued.refreshToken, issued.refreshExpiresAt, this.clock);
      return issued.response;
    } catch (error) {
      clearRefreshTokenCookie(response, channel);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  @AllowedWhilePasswordChangeRequired()
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authenticationService.logout(request.accessTokenClaims);
    clearRefreshTokenCookie(response, request.accessTokenClaims.channel);
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
