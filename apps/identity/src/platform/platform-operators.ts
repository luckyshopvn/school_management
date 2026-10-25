import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Post, Req } from '@nestjs/common';
import { writeAudit, type PlatformDatabase, type TenancyRuntime } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  extractTenantHost,
  normalizeHost,
  readBearerToken,
  unauthenticatedError,
  validationError,
  type FieldError,
} from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import {
  checkPasswordPolicy,
  hashPassword,
  placeholderPasswordHash,
  verifyPassword,
} from '../authentication/password.js';
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
}

@Controller('auth/platform')
export class PlatformAuthController {
  constructor(private readonly operators: PlatformOperatorsService) {}

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
    const result = await this.operators.login(login, password, request.ip ?? null);
    return { access_token: result.token, token_type: 'Bearer', operator: result.operator };
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
  const policyErrors = checkPasswordPolicy('password', input.password);
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
