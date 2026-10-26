import { Body, Controller, Get, HttpCode, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Clock, unauthenticatedError, validationError, type FieldError } from '@school-management/server';
import {
  AccessTokenGuard,
  AllowedWhilePasswordChangeRequired,
  type AuthenticatedRequest,
} from './access-token.guard.js';
import { assertChannel, AuthenticationService, type RequestOrigin } from './authentication.service.js';
import { CaptchaService, type CaptchaAnswer } from './captcha.service.js';
import { ImpersonationService } from './impersonation.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { isTotpRequiredError, TotpService } from './totp.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
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

function readCaptcha(body: RequestBody): CaptchaAnswer {
  const captchaId = body?.captcha_id;
  const captchaText = body?.captcha_text;
  return {
    captchaId: typeof captchaId === 'string' ? captchaId : undefined,
    captchaText: typeof captchaText === 'string' && captchaText.trim() !== '' ? captchaText : undefined,
  };
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
    private readonly captchaService: CaptchaService,
    private readonly passwordResetService: PasswordResetService,
    private readonly totpService: TotpService,
    private readonly identitySettings: IdentitySettingsService,
    private readonly impersonation: ImpersonationService,
    private readonly clock: Clock,
  ) {}

  // Thông tin công khai của trang đăng nhập cổng quản trị: đường dây nóng, có luôn hiện mã xác nhận (DT-16 phần 16c)
  @Get('login-options')
  loginOptions() {
    return this.identitySettings.loginPageOptions();
  }

  // Ảnh mã xác nhận mới; nút làm mới gọi lại điểm cuối này
  @Post('captcha')
  @HttpCode(200)
  async captcha(@Req() request: Request) {
    await this.loginRateLimiter.check(readOrigin(request).ipAddress);
    return this.captchaService.issue();
  }

  // Quên mật khẩu: luôn cần mã xác nhận; phản hồi như nhau dù tài khoản có hay không
  @Post('password-reset/request')
  @HttpCode(200)
  async requestPasswordReset(@Body() body: RequestBody, @Req() request: Request) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const errors: FieldError[] = [];
    const login = readText(body, 'login', errors).trim();
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.captchaService.assertSolved(readCaptcha(body));
    return this.passwordResetService.request(login, origin);
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  async confirmPasswordReset(@Body() body: RequestBody, @Req() request: Request) {
    const origin = readOrigin(request);
    await this.loginRateLimiter.check(origin.ipAddress);
    const errors: FieldError[] = [];
    const login = readText(body, 'login', errors).trim();
    const code = readText(body, 'code', errors).trim();
    const newPassword = readText(body, 'new_password', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.passwordResetService.confirm(login, code, newPassword, origin);
    await this.captchaService.clearFailures(login);
    return { message: 'Đã đặt lại mật khẩu, vui lòng đăng nhập bằng mật khẩu mới' };
  }

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
    // Mã xác nhận áp dụng cho cổng quản trị (DT-16 phần 16c) và kênh học sinh (DT-23 phần 23a, cùng cơ chế của S8b)
    const portal = channel === 'portal' || channel === 'student';
    if (portal && (await this.captchaService.requiredForLogin(login))) {
      await this.captchaService.assertSolved(readCaptcha(body));
    }
    let issued;
    try {
      const otp = body?.otp_code;
      issued = await this.authenticationService.login(
        login,
        password,
        channel,
        origin,
        typeof otp === 'string' && otp.trim() !== '' ? otp.trim() : undefined,
      );
    } catch (error) {
      // Đúng mật khẩu nhưng chưa nhập mã xác thực hai lớp: chưa phải lần nhập sai
      if (portal && !isTotpRequiredError(error)) {
        await this.captchaService.registerFailure(login);
      }
      throw error;
    }
    if (portal) {
      await this.captchaService.clearFailures(login);
    }
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
    await this.authenticationService.logout(request.accessTokenClaims, readOrigin(request).ipAddress);
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

  // Xác thực hai lớp tuỳ chọn của người dùng trường (DT-SaaS phần S8b, YCTD-201): xem trạng thái, đăng ký, xác nhận, tắt; người quản lý
  // tài khoản đặt lại hộ khi mất điện thoại
  @Get('totp')
  @UseGuards(AccessTokenGuard)
  totpStatus(@Req() request: AuthenticatedRequest) {
    return this.totpService.status(request.accessTokenClaims.userId);
  }

  @Post('totp/setup')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async totpSetup(@Req() request: AuthenticatedRequest) {
    const claims = request.accessTokenClaims;
    return this.totpService.beginSetup(claims.userId, await this.authenticationService.accountLabel(claims.userId));
  }

  @Post('totp/confirm')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  totpConfirm(@Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    const errors: FieldError[] = [];
    const code = readText(body, 'code', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.totpService.confirmSetup(request.accessTokenClaims.userId, code);
  }

  @Post('totp/disable')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async totpDisable(@Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    const errors: FieldError[] = [];
    const code = readText(body, 'code', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.totpService.disable(request.accessTokenClaims.userId, code);
    return this.totpService.status(request.accessTokenClaims.userId);
  }

  @Post('totp/reset')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async totpReset(@Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    const errors: FieldError[] = [];
    const userId = readText(body, 'user_id', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.totpService.resetByManager(request.accessTokenClaims.userId, userId, readOrigin(request).ipAddress);
    return { message: 'Đã đặt lại xác thực hai lớp của tài khoản' };
  }

  // Đăng nhập thay (DT-18 phần 18h): cookie cổng quản trị chuyển sang phiên của tài khoản đích; phiên gốc giữ nguyên
  @Post('impersonation')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async startImpersonation(
    @Body() body: RequestBody,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const started = await this.impersonation.start(request.accessTokenClaims, body, readOrigin(request));
    setRefreshTokenCookie(response, 'portal', started.issued.refreshToken, started.issued.refreshExpiresAt, this.clock);
    return { ...started.issued.response, impersonation_id: started.impersonationId };
  }

  // Thoát đăng nhập thay: quay lại phiên gốc của quản trị; phiên gốc đã hết hạn thì đăng xuất
  @Post('impersonation/exit')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async exitImpersonation(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const issued = await this.impersonation.exit(request.accessTokenClaims, readOrigin(request));
    if (!issued) {
      clearRefreshTokenCookie(response, 'portal');
      return { signed_out: true };
    }
    setRefreshTokenCookie(response, 'portal', issued.refreshToken, issued.refreshExpiresAt, this.clock);
    return { ...issued.response, signed_out: false };
  }

  // Nhật ký đăng nhập thay (DT-18 phần 18h)
  @Get('impersonations')
  @UseGuards(AccessTokenGuard)
  async impersonations(@Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    return this.impersonation.list(request.accessTokenClaims, query);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @AllowedWhilePasswordChangeRequired()
  async me(@Req() request: AuthenticatedRequest) {
    return this.authenticationService.describeCurrentUser(request.accessTokenClaims);
  }

  // Cấp đang làm việc ở thanh đầu trang (DT-19 phần 19c): { school_level: "TH" } hoặc { school_level: null } là "Tất cả"
  @Put('me/working-school-level')
  @UseGuards(AccessTokenGuard)
  async setWorkingSchoolLevel(@Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    return this.authenticationService.setWorkingSchoolLevel(request.accessTokenClaims, body?.school_level ?? null);
  }
}
