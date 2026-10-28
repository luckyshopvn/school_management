import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Post, Req } from '@nestjs/common';
import { writeAudit, type PlatformDatabase, type TenancyRuntime } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  extractTenantHost,
  normalizeHost,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  readBearerToken,
  totpUri,
  unauthenticatedError,
  validationError,
  verifyTotp,
  type FieldError,
} from '@school-management/server';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import {
  checkPasswordPolicy,
  hashPassword,
  placeholderPasswordHash,
  verifyPassword,
} from '../authentication/password.js';
import { isTotpRequiredError, OTP_REQUIRED_MESSAGE } from '../authentication/totp.service.js';
import { CaptchaService } from '../authentication/captcha.service.js';
import { TokenService } from '../authentication/token.service.js';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from '../common/configuration.js';

// Tài khoản vận hành nền tảng (DT-SaaS phần S1a, tài liệu 32 mục 14.4, 14.5): đăng nhập riêng của cổng nền tảng, nằm ở cơ sở dữ
// liệu nền tảng, không thuộc trường nào. Chỉ phục vụ ở tên miền của cổng nền tảng (PLATFORM_CONSOLE_HOST); mã phiên có đối tượng
// riêng nên máy chủ API và dịch vụ định danh của trường không nhận, và mã phiên của trường không dùng được ở cổng nền tảng
export const PLATFORM_OPERATOR_LOGIN_PATH = '/api/v1/auth/platform/';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function readText(body: Record<string, unknown> | undefined, field: string, errors: FieldError[]): string {
  const value = body?.[field];
  if (typeof value !== 'string' || value.length === 0) {
    errors.push({ field, message: 'Bắt buộc nhập' });
    return '';
  }
  return value;
}

export interface PlatformOperatorSummary {
  id: string;
  login: string;
  full_name: string;
}

@Injectable()
export class PlatformOperatorsService {
  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  private platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy.platform;
  }

  // Cơ sở dữ liệu nền tảng cho các trang khác của cổng (S5a gói dịch vụ); chế độ một trường thì 404
  platformDatabase(): Kysely<PlatformDatabase> {
    return this.platform();
  }

  // Cổng nền tảng chỉ phục vụ ở tên miền riêng của nó; tên miền khác (kể cả tên miền của một trường) không thấy cổng này
  assertConsoleHost(request: Request): void {
    const consoleHost = normalizeHost(this.configuration.platformConsoleHost ?? undefined);
    if (!this.tenancy || !consoleHost) {
      throw notFound();
    }
    const host = extractTenantHost(
      request.headers,
      this.tenancy.configuration.hostSource,
      this.tenancy.configuration.edgeSecret ?? undefined,
    );
    if (host !== consoleHost) {
      throw notFound();
    }
  }

  async login(
    login: string,
    password: string,
    otpCode: string | undefined,
    ipAddress: string | null,
  ): Promise<{ token: string; operator: PlatformOperatorSummary }> {
    const platform = this.platform();
    const row = await platform
      .selectFrom('platform_operators')
      .selectAll()
      .where('login', '=', login.trim().toLowerCase())
      .executeTakeFirst();
    const now = this.clock.now();
    if (!row) {
      // Thời gian phản hồi như nhau khi không có tài khoản
      await verifyPassword(await placeholderPasswordHash(), password);
      throw unauthenticatedError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (row.status === 'locked' || (row.locked_until && row.locked_until.getTime() > now.getTime())) {
      await verifyPassword(await placeholderPasswordHash(), password);
      throw unauthenticatedError('Tài khoản tạm khóa, vui lòng thử lại sau');
    }
    if (!(await verifyPassword(row.password_hash, password))) {
      const failures = row.failed_login_count + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await platform
        .updateTable('platform_operators')
        .set({
          failed_login_count: lock ? 0 : failures,
          locked_until: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
          updated_at: now,
        })
        .where('id', '=', row.id)
        .execute();
      await writeAudit(platform, {
        actorType: 'operator',
        actorId: row.id,
        action: lock ? 'operator.login-locked' : 'operator.login-failed',
        details: { ip: ipAddress },
      });
      throw unauthenticatedError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    // Xác thực hai lớp bắt buộc (DT-SaaS phần S8b, GD-97): thiếu hoặc sai mã thì không vào được; sai mã tính như nhập sai mật khẩu
    await this.assertSecondFactor(row.id, otpCode, ipAddress, now);
    await platform
      .updateTable('platform_operators')
      .set({ failed_login_count: 0, locked_until: null, last_login_at: now, updated_at: now })
      .where('id', '=', row.id)
      .execute();
    await writeAudit(platform, {
      actorType: 'operator',
      actorId: row.id,
      action: 'operator.login',
      details: { ip: ipAddress },
    });
    return {
      token: await this.tokenService.signOperatorToken(row.id),
      operator: { id: row.id, login: row.login, full_name: row.full_name },
    };
  }

  // Cũng dùng làm bước xác thực lại ngay lúc thao tác nhạy cảm (DT-24: quản trị nền tảng vào trường không cần trường cho phép)
  async assertSecondFactor(
    operatorId: string,
    otpCode: string | undefined,
    ipAddress: string | null,
    now: Date,
  ): Promise<void> {
    const platform = this.platform();
    const totp = await platform
      .selectFrom('platform_operator_totp')
      .selectAll()
      .where('operator_id', '=', operatorId)
      .executeTakeFirst();
    if (!totp) {
      throw unauthenticatedError(
        'Tài khoản chưa đăng ký xác thực hai lớp (bắt buộc); chạy lệnh reset-operator-totp để cấp khóa mới',
      );
    }
    if (!otpCode) {
      throw new ApplicationError('ERR_UNAUTHENTICATED', 'Cần mã xác thực hai lớp', [
        { field: 'otp_code', message: OTP_REQUIRED_MESSAGE },
      ]);
    }
    const masterKey = this.tenancy?.configuration.masterKey as Buffer;
    const lastStep = totp.last_step === null ? null : Number(totp.last_step);
    const step = verifyTotp(decryptSecret(masterKey, totp.secret_encrypted), otpCode, now, { lastUsedStep: lastStep });
    let accepted = false;
    if (step !== null) {
      // Cập nhật có điều kiện để hai yêu cầu cùng lúc không cùng dùng được một mã
      const updated = await platform
        .updateTable('platform_operator_totp')
        .set({ last_step: String(step) })
        .where('operator_id', '=', operatorId)
        .where((expression) =>
          expression.or([expression('last_step', 'is', null), expression('last_step', '<', String(step))]),
        )
        .executeTakeFirst();
      accepted = Number(updated.numUpdatedRows) > 0;
    } else if (!/^\d{6}$/.test(otpCode.trim())) {
      const consumed = await platform
        .updateTable('platform_operator_recovery_codes')
        .set({ used_at: now })
        .where('operator_id', '=', operatorId)
        .where('code_hash', '=', hashRecoveryCode(otpCode))
        .where('used_at', 'is', null)
        .executeTakeFirst();
      accepted = Number(consumed.numUpdatedRows) > 0;
    }
    if (!accepted) {
      const row = await platform
        .selectFrom('platform_operators')
        .select('failed_login_count')
        .where('id', '=', operatorId)
        .executeTakeFirstOrThrow();
      const failures = row.failed_login_count + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await platform
        .updateTable('platform_operators')
        .set({
          failed_login_count: lock ? 0 : failures,
          locked_until: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
          updated_at: now,
        })
        .where('id', '=', operatorId)
        .execute();
      await writeAudit(platform, {
        actorType: 'operator',
        actorId: operatorId,
        action: lock ? 'operator.login-locked' : 'operator.totp-failed',
        details: { ip: ipAddress },
      });
      throw unauthenticatedError('Mã xác thực hai lớp không đúng');
    }
  }

  async me(accessToken: string): Promise<PlatformOperatorSummary & { school_count: number }> {
    const platform = this.platform();
    const operatorId = await this.tokenService.verifyOperatorToken(accessToken);
    const row = await platform
      .selectFrom('platform_operators')
      .select(['id', 'login', 'full_name', 'status'])
      .where('id', '=', operatorId)
      .executeTakeFirst();
    if (!row || row.status !== 'active') {
      throw unauthenticatedError();
    }
    const count = await platform
      .selectFrom('schools')
      .select((builder) => builder.fn.countAll<string>().as('count'))
      .where('status', '!=', 'deleted')
      .executeTakeFirstOrThrow();
    return { id: row.id, login: row.login, full_name: row.full_name, school_count: Number(count.count) };
  }
}

interface LoginBody {
  login?: unknown;
  password?: unknown;
  otp_code?: unknown;
  captcha_id?: unknown;
  captcha_text?: unknown;
}

@Controller('auth/platform')
export class PlatformAuthController {
  constructor(
    private readonly operators: PlatformOperatorsService,
    private readonly captcha: CaptchaService,
  ) {}

  // Ảnh mã xác nhận của trang đăng nhập cổng vận hành (YCTD-313); nút làm mới gọi lại điểm cuối này
  @Post('captcha')
  @HttpCode(200)
  async issueCaptcha(@Req() request: Request) {
    this.operators.assertConsoleHost(request);
    return this.captcha.issuePlatform(request.ip ?? 'unknown');
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginBody | undefined, @Req() request: Request) {
    this.operators.assertConsoleHost(request);
    const errors: FieldError[] = [];
    const login = readText(body as Record<string, unknown> | undefined, 'login', errors);
    const password = readText(body as Record<string, unknown> | undefined, 'password', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    // Mã xác nhận kiểm trước mật khẩu (YCTD-313); quy tắc khi nào bắt buộc ở CaptchaService.assertPlatformSolved
    const captchaId = typeof body?.captcha_id === 'string' ? body.captcha_id : undefined;
    const captchaText =
      typeof body?.captcha_text === 'string' && body.captcha_text.trim() !== '' ? body.captcha_text : undefined;
    await this.captcha.assertPlatformSolved({ captchaId, captchaText }, login);
    const otp = body?.otp_code;
    try {
      const result = await this.operators.login(
        login,
        password,
        typeof otp === 'string' && otp.trim() !== '' ? otp.trim() : undefined,
        request.ip ?? null,
      );
      await this.captcha.clearPlatformFailures(login);
      return { access_token: result.token, token_type: 'Bearer', operator: result.operator };
    } catch (error) {
      if (isTotpRequiredError(error)) {
        // Đúng mật khẩu, chỉ còn thiếu mã hai lớp: không tính là nhập sai; bước nhập mã dùng lượt đã qua thay cho ảnh mới
        if (captchaId) {
          await this.captcha.grantPlatformPass(captchaId, login);
        }
      } else {
        await this.captcha.registerPlatformFailure(login);
      }
      throw error;
    }
  }

  @Get('me')
  async me(@Req() request: Request) {
    this.operators.assertConsoleHost(request);
    return this.operators.me(readBearerToken(request.header('authorization')));
  }
}

// Tạo tài khoản vận hành nền tảng (lệnh dòng lệnh và kiểm thử); mật khẩu theo chính sách của hệ thống (BM-03)
export async function createPlatformOperator(
  platform: Kysely<PlatformDatabase>,
  input: { login: string; fullName: string; password: string },
): Promise<string> {
  const login = input.login.trim().toLowerCase();
  if (login.length < 3 || login.length > 64) {
    throw new Error('Tên đăng nhập có từ 3 đến 64 ký tự');
  }
  const policyErrors = checkPasswordPolicy('password', input.password, OPERATOR_MINIMUM_PASSWORD_LENGTH);
  if (policyErrors.length > 0) {
    throw new Error(policyErrors.map((error) => error.message).join('; '));
  }
  const existing = await platform
    .selectFrom('platform_operators')
    .select('id')
    .where('login', '=', login)
    .executeTakeFirst();
  if (existing) {
    throw new Error('Tên đăng nhập đã tồn tại');
  }
  const created = await platform
    .insertInto('platform_operators')
    .values({ login, full_name: input.fullName, password_hash: await hashPassword(input.password) })
    .returning('id')
    .executeTakeFirstOrThrow();
  await writeAudit(platform, { actorType: 'cli', action: 'operator.create', details: { login } });
  return created.id;
}

// Đăng ký xác thực hai lớp cho tài khoản vận hành (hoặc cấp lại khóa mới khi mất điện thoại): sinh khóa TOTP, mã hóa bằng khóa gốc của nền tảng,
// cấp mã khôi phục dùng một lần. Khóa và mã khôi phục chỉ trả ở đây một lần để người vận hành lưu lại
export async function enrollOperatorTotp(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  operatorId: string,
  account: string,
): Promise<{ secret: string; otpauthUri: string; recoveryCodes: string[] }> {
  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  await platform.transaction().execute(async (transaction) => {
    await transaction.deleteFrom('platform_operator_recovery_codes').where('operator_id', '=', operatorId).execute();
    await transaction.deleteFrom('platform_operator_totp').where('operator_id', '=', operatorId).execute();
    await transaction
      .insertInto('platform_operator_totp')
      .values({ operator_id: operatorId, secret_encrypted: encryptSecret(masterKey, secret) })
      .execute();
    await transaction
      .insertInto('platform_operator_recovery_codes')
      .values(recoveryCodes.map((code) => ({ operator_id: operatorId, code_hash: hashRecoveryCode(code) })))
      .execute();
  });
  await writeAudit(platform, { actorType: 'cli', actorId: operatorId, action: 'operator.totp-enroll' });
  return { secret, otpauthUri: totpUri(secret, account, 'School Management (nền tảng)'), recoveryCodes };
}

// Tạo tài khoản vận hành kèm xác thực hai lớp (lệnh dòng lệnh và kiểm thử). Mật khẩu của tài khoản vận hành theo mặc định nền tảng chặt hơn
// của trường: tối thiểu 12 ký tự (DT-SaaS phần S8b, tài liệu 32 mục 14.5)
export const OPERATOR_MINIMUM_PASSWORD_LENGTH = 12;

export async function createPlatformOperatorWithTotp(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  input: { login: string; fullName: string; password: string },
): Promise<{ id: string; secret: string; otpauthUri: string; recoveryCodes: string[] }> {
  const id = await createPlatformOperator(platform, input);
  return { id, ...(await enrollOperatorTotp(platform, masterKey, id, input.login.trim().toLowerCase())) };
}
