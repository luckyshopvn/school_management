import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Clock, type AccessTokenClaims } from '@school-management/server';
import type { Request, Response } from 'express';
import { AccessTokenGuard, type AuthenticatedRequest } from '../authentication/access-token.guard.js';
import type { RequestOrigin } from '../authentication/authentication.service.js';
import { LoginRateLimiter } from '../authentication/login-rate-limiter.js';
import { setRefreshTokenCookie } from '../authentication/refresh-token-cookie.js';
import { TokenService } from '../authentication/token.service.js';
import { ExternalIdentityService, type ExternalCallbackResult } from './external-identity.service.js';

type RequestBody = Record<string, unknown> | undefined;

function readOrigin(request: Request): RequestOrigin {
  return { ipAddress: request.ip ?? 'unknown', userAgent: request.header('user-agent') ?? null };
}

// Đăng nhập và liên kết tài khoản bằng nhà cung cấp định danh bên ngoài (DT-25, YCTD-225; 17_DAC_TA_API.md mục 4). Các tuyến công khai
// khai ở tenancy-route-policy.ts; có giới hạn tần suất như đăng nhập
@Controller('auth/external')
export class ExternalIdentityController {
  constructor(
    private readonly service: ExternalIdentityService,
    private readonly loginRateLimiter: LoginRateLimiter,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  // Nút đăng nhập bằng nhà cung cấp ngoài trên màn hình đăng nhập: chỉ nhà cung cấp trường đã bật
  @Get('providers')
  async providers() {
    return { providers: await this.service.loginProviders() };
  }

  @Post(':provider/start')
  @HttpCode(200)
  async start(@Param('provider') provider: string, @Body() body: RequestBody, @Req() request: Request) {
    await this.loginRateLimiter.check(readOrigin(request).ipAddress);
    return this.service.startLogin(provider, body, request.hostname);
  }

  // Trang /dang-nhap/ben-ngoai gửi state và code; lượt liên kết gửi kèm mã phiên của người đang đăng nhập
  @Post('callback')
  @HttpCode(200)
  async callback(@Body() body: RequestBody, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const claims = await this.optionalClaims(request);
    return this.respond(await this.service.callback(body, claims, origin), response);
  }

  // Người đã bật xác thực hai lớp nhập mã sau khi nhà cung cấp xác nhận
  @Post('complete')
  @HttpCode(200)
  async complete(@Body() body: RequestBody, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    return this.respond(await this.service.completeWithOtp(body, origin), response);
  }

  @Get('links')
  @UseGuards(AccessTokenGuard)
  links(@Req() request: AuthenticatedRequest) {
    return this.service.myLinks(request.accessTokenClaims);
  }

  @Get('events')
  @UseGuards(AccessTokenGuard)
  async events(@Req() request: AuthenticatedRequest) {
    return { events: await this.service.myEvents(request.accessTokenClaims) };
  }

  @Post(':provider/link')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async link(@Param('provider') provider: string, @Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    return this.service.startLink(request.accessTokenClaims, provider, body, request.hostname, origin);
  }

  @Post(':provider/unlink')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async unlink(@Param('provider') provider: string, @Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    await this.service.unlink(request.accessTokenClaims, provider, body, origin);
    return this.service.myLinks(request.accessTokenClaims);
  }

  // Cấu hình của trường (người quản lý tài khoản)
  @Get('settings')
  @UseGuards(AccessTokenGuard)
  settings(@Req() request: AuthenticatedRequest) {
    return this.service.readSettings(request.accessTokenClaims);
  }

  @Put('settings/:provider')
  @UseGuards(AccessTokenGuard)
  updateSettings(@Param('provider') provider: string, @Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    return this.service.updateSettings(request.accessTokenClaims, provider, body, request.ip ?? null);
  }

  // Mã phiên chỉ cần cho lượt liên kết; mã không hợp lệ (hết hạn, của trường khác) coi như không có, lượt liên kết khi đó bị từ chối
  private async optionalClaims(request: Request): Promise<AccessTokenClaims | null> {
    const [scheme, token] = (request.header('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }
    try {
      return await this.tokenService.verifyAccessToken(token);
    } catch {
      return null;
    }
  }

  private respond(result: ExternalCallbackResult, response: Response) {
    if (result.kind === 'signed_in') {
      setRefreshTokenCookie(
        response,
        result.channel,
        result.issued.refreshToken,
        result.issued.refreshExpiresAt,
        this.clock,
      );
      return { status: 'signed_in', channel: result.channel, ...result.issued.response };
    }
    if (result.kind === 'otp_required') {
      return { status: 'otp_required', ticket: result.ticket, provider: result.provider };
    }
    return { status: 'linked', provider: result.provider };
  }
}
