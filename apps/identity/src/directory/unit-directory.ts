import { createHash, randomBytes } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Post, Query, Req, Res } from '@nestjs/common';
import {
  CATALOG_LEVELS,
  catalogCommunes,
  catalogDepartments,
  catalogLevels,
  catalogUnitByCode,
  searchCatalogUnits,
  type PlatformDatabase,
  type TenancyRuntime,
  type TenantContext,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  extractTenantHost,
  ruleViolationError,
  runAsSchool,
  unauthenticatedError,
  validationError,
  type FieldError,
} from '@school-management/server';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticationService } from '../authentication/authentication.service.js';
import { CaptchaService } from '../authentication/captcha.service.js';
import { isTotpRequiredError } from '../authentication/totp.service.js';
import { LoginRateLimiter } from '../authentication/login-rate-limiter.js';
import { setRefreshTokenCookie } from '../authentication/refresh-token-cookie.js';
import { readSessionIdFromRefreshToken } from '../authentication/token.service.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';

// Đăng nhập theo đơn vị (DT-24, YCTD-220; tài liệu 32 mục 16). Học bố cục và luồng chọn đơn vị của trang đăng nhập hệ thống ngành,
// không dùng tên, biểu trưng của cơ quan nhà nước; tiêu đề lấy từ cấu hình của nền tảng (platform_settings.login_page).
// - Trên tên miền chung của nền tảng (PLATFORM_ROOT_DOMAIN): trang đăng nhập có ô chọn Sở → Cấp học, Phường/Xã → Trường đọc danh
//   mục ở cơ sở dữ liệu nền tảng (phân trang, tìm kiếm, giới hạn tần suất; không trả cả danh mục một lượt). Đăng nhập chạy trong
//   ngữ cảnh của đúng trường (cùng tài khoản, khóa tạm, chính sách mật khẩu, xác thực hai lớp, mã xác nhận của trường); đúng thì
//   phiên mở ở trường đó và trình duyệt nhận mã chuyển phiên một lần (chỉ lưu mã băm, hạn 2 phút) để sang tên miền của trường.
// - Danh sách không đánh dấu đơn vị nào đã dùng nền tảng (không lộ danh sách khách hàng); chỉ khi chọn một đơn vị mới tra đơn vị
//   đó có dùng hay không, như trang chọn trường của S1b.
// - Tên miền riêng hoặc tên miền con của trường: trang ẩn phần chọn đơn vị và khóa vào trường đó (điểm cuối context); chế độ một
//   trường giữ nguyên trang đăng nhập cũ.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: luôn hỏi mã xác nhận ở tên miền chung; giới hạn 120 yêu cầu đọc và 20 lần
// đăng nhập mỗi phút trên một địa chỉ mạng (bộ đếm trong bộ nhớ của tiến trình, cộng thêm giới hạn đăng nhập theo trường).
export const DIRECTORY_RULE_CODE = 'YCTD-220';
export const DIRECTORY_PATH_PREFIX = '/api/v1/auth/directory/';
const HANDOFF_SECONDS = 120;
const SERVING_STATUSES = new Set(['trial', 'active', 'read_only']);
const DEFAULT_LOGIN_PAGE = {
  title: 'Hệ thống quản lý trường học',
  subtitle: 'Đăng nhập hệ thống',
  support_lines: [] as string[],
};

const LIMITS = {
  read: { limit: 120, windowMs: 60_000 },
  login: { limit: 20, windowMs: 60_000 },
} as const;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function text(value: unknown, maximum = 100): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function integer(value: unknown): number | undefined {
  const number = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

// Bộ đếm theo địa chỉ mạng cho tên miền chung (không thuộc trường nào nên không dùng bộ đếm Redis theo trường)
@Injectable()
export class DirectoryRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly clock: Clock) {}

  hit(kind: keyof typeof LIMITS, ip: string | undefined): void {
    const rule = LIMITS[kind];
    const key = `${kind}:${ip ?? 'unknown'}`;
    const now = this.clock.now().getTime();
    const window = this.windows.get(key);
    if (!window || now - window.start >= rule.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      if (this.windows.size > 10_000) {
        for (const [entry, value] of this.windows) {
          if (now - value.start >= 60_000) {
            this.windows.delete(entry);
          }
        }
      }
      return;
    }
    window.count += 1;
    if (window.count > rule.limit) {
      const retryAfterSeconds = Math.ceil((window.start + rule.windowMs - now) / 1000);
      throw new ApplicationError(
        'ERR_RATE_LIMIT',
        `Bạn thao tác quá nhanh, vui lòng thử lại sau ${retryAfterSeconds} giây`,
        [],
        retryAfterSeconds,
      );
    }
  }
}

export interface LoginPageSettings {
  title: string;
  subtitle: string;
  support_lines: string[];
}

export async function readLoginPageSettings(platform: Kysely<PlatformDatabase>): Promise<LoginPageSettings> {
  const row = await platform
    .selectFrom('platform_settings')
    .select('value')
    .where('key', '=', 'login_page')
    .executeTakeFirst();
  const value = (row?.value ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(value.support_lines)
    ? value.support_lines.filter((line): line is string => typeof line === 'string' && line.trim() !== '').slice(0, 6)
    : DEFAULT_LOGIN_PAGE.support_lines;
  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : DEFAULT_LOGIN_PAGE.title,
    subtitle:
      typeof value.subtitle === 'string' && value.subtitle.trim() ? value.subtitle.trim() : DEFAULT_LOGIN_PAGE.subtitle,
    support_lines: lines,
  };
}

@Injectable()
export class UnitDirectoryService {
  constructor(
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    private readonly infrastructure: Infrastructure,
    private readonly authentication: AuthenticationService,
    private readonly captcha: CaptchaService,
    private readonly loginRateLimiter: LoginRateLimiter,
    private readonly limiter: DirectoryRateLimiter,
    private readonly clock: Clock,
  ) {}

  private runtime(): TenancyRuntime {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy;
  }

  private hostOf(request: Request): string | undefined {
    const configuration = this.runtime().configuration;
    return extractTenantHost(request.headers, configuration.hostSource, configuration.edgeSecret ?? undefined);
  }

  // Ô chọn đơn vị chỉ phục vụ ở tên miền chung; tên miền khác 404
  private assertDirectoryHost(request: Request): Kysely<PlatformDatabase> {
    const runtime = this.runtime();
    const root = runtime.configuration.rootDomain;
    if (!root || this.hostOf(request) !== root) {
      throw notFound();
    }
    return runtime.platform;
  }

  // Trang đăng nhập hỏi chế độ: một trường, tên miền của trường (khóa đơn vị), tên miền chung (ô chọn đơn vị)
  async context(request: Request) {
    if (!this.tenancy) {
      return { mode: 'single' as const };
    }
    const host = this.hostOf(request);
    if (host && host === this.tenancy.configuration.rootDomain) {
      this.limiter.hit('read', request.ip);
      return { mode: 'directory' as const, page: await readLoginPageSettings(this.tenancy.platform) };
    }
    const tenant = host ? await this.tenancy.registry.resolveHost(host) : null;
    // Tên miền lạ: 404 như mọi tuyến khác (ma trận cách ly)
    if (!tenant) {
      throw notFound();
    }
    const school = await this.tenancy.platform
      .selectFrom('schools')
      .select(['name', 'moet_code'])
      .where('id', '=', tenant.schoolId)
      .executeTakeFirst();
    const unit = school?.moet_code ? await catalogUnitByCode(this.tenancy.platform, school.moet_code) : null;
    return {
      mode: 'school' as const,
      unit: {
        name: school?.name ?? tenant.code,
        moet_code: school?.moet_code ?? null,
        department_name: unit?.department_name ?? null,
        commune_name: unit?.commune_name ?? null,
        levels: unit?.levels ?? [],
      },
    };
  }

  async departments(request: Request) {
    const platform = this.assertDirectoryHost(request);
    this.limiter.hit('read', request.ip);
    return { items: await catalogDepartments(platform) };
  }

  async levels(request: Request) {
    const platform = this.assertDirectoryHost(request);
    this.limiter.hit('read', request.ip);
    return { items: await catalogLevels(platform) };
  }

  private department(value: unknown): string {
    const department = text(value, 2);
    if (!/^\d{2}$/.test(department)) {
      throw validationError([{ field: 'department', message: 'Chọn Sở GD&ĐT' }]);
    }
    return department;
  }

  async communes(request: Request, query: Record<string, unknown>) {
    const platform = this.assertDirectoryHost(request);
    this.limiter.hit('read', request.ip);
    return catalogCommunes(platform, {
      department: this.department(query.department),
      q: text(query.q),
      ...(integer(query.limit) !== undefined ? { limit: integer(query.limit) as number } : {}),
      ...(integer(query.offset) !== undefined ? { offset: integer(query.offset) as number } : {}),
    });
  }

  async units(request: Request, query: Record<string, unknown>) {
    const platform = this.assertDirectoryHost(request);
    this.limiter.hit('read', request.ip);
    const level = text(query.level, 10);
    if (level && !CATALOG_LEVELS.some((item) => item.code === level)) {
      throw validationError([{ field: 'level', message: 'Cấp học không có trong danh mục' }]);
    }
    const commune = text(query.commune, 5);
    if (commune && !/^\d{5}$/.test(commune)) {
      throw validationError([{ field: 'commune', message: 'Mã phường, xã gồm 5 chữ số' }]);
    }
    const page = await searchCatalogUnits(platform, {
      department: this.department(query.department),
      level: level || null,
      commune: commune || null,
      q: text(query.q),
      ...(integer(query.limit) !== undefined ? { limit: integer(query.limit) as number } : {}),
      ...(integer(query.offset) !== undefined ? { offset: integer(query.offset) as number } : {}),
    });
    return {
      items: page.items.map((item) => ({
        moet_code: item.moet_code,
        name: item.name,
        commune_name: item.commune_name,
        levels: item.levels,
      })),
      has_more: page.has_more,
    };
  }

  private async servingSchool(code: string) {
    const platform = this.runtime().platform;
    const school = await platform
      .selectFrom('schools')
      .select(['id', 'status'])
      .where('moet_code', '=', code)
      .where('status', '!=', 'deleted')
      .executeTakeFirst();
    return school && SERVING_STATUSES.has(school.status) ? school : null;
  }

  private async loginHost(schoolId: string): Promise<string | null> {
    const domain = await this.runtime()
      .platform.selectFrom('school_domains')
      .select('host')
      .where('school_id', '=', schoolId)
      .where('status', '=', 'active')
      .orderBy('kind', 'asc')
      .orderBy('created_at')
      .executeTakeFirst();
    return domain?.host ?? null;
  }

  // Tra một đơn vị khi người dùng chọn: có dùng nền tảng không, tên miền đăng nhập (cho "Quên mật khẩu?")
  async unit(request: Request, codeInput: unknown) {
    const platform = this.assertDirectoryHost(request);
    this.limiter.hit('read', request.ip);
    const code = text(codeInput, 40);
    const unit = code ? await catalogUnitByCode(platform, code) : null;
    if (!unit) {
      throw notFound();
    }
    const school = await this.servingSchool(code);
    return {
      moet_code: unit.moet_code,
      name: unit.name,
      department_name: unit.department_name,
      commune_name: unit.commune_name,
      levels: unit.levels,
      available: Boolean(school),
      login_host: school ? await this.loginHost(school.id) : null,
      message: school
        ? null
        : 'Đơn vị này chưa sử dụng hệ thống trên nền tảng. Liên hệ nhà trường hoặc bộ phận hỗ trợ ở cuối trang.',
    };
  }

  private async tenantFor(codeInput: unknown): Promise<{ tenant: TenantContext; host: string | null }> {
    const code = text(codeInput, 40);
    if (!code) {
      throw validationError([{ field: 'unit', message: 'Chọn trường' }]);
    }
    const school = await this.servingSchool(code);
    const record = school ? await this.runtime().registry.loadSchool(school.id) : null;
    if (!school || !record) {
      throw ruleViolationError(
        DIRECTORY_RULE_CODE,
        'Đơn vị này chưa sử dụng hệ thống trên nền tảng nên chưa đăng nhập được',
      );
    }
    return { tenant: record.context, host: await this.loginHost(school.id) };
  }

  async issueCaptcha(request: Request, unitCode: unknown) {
    this.assertDirectoryHost(request);
    this.limiter.hit('login', request.ip);
    const { tenant } = await this.tenantFor(unitCode);
    return runAsSchool(tenant, async () => {
      await this.loginRateLimiter.check(request.ip ?? 'unknown');
      return this.captcha.issue();
    });
  }

  // Đăng nhập trong ngữ cảnh của đúng trường; trả mã chuyển phiên một lần thay cho mã phiên
  async login(request: Request, body: Record<string, unknown> | undefined) {
    this.assertDirectoryHost(request);
    this.limiter.hit('login', request.ip);
    const errors: FieldError[] = [];
    const login = text(body?.login, 200);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!body?.unit) {
      errors.push({ field: 'unit', message: 'Chọn trường' });
    }
    if (!login) {
      errors.push({ field: 'login', message: 'Bắt buộc nhập' });
    }
    if (!password) {
      errors.push({ field: 'password', message: 'Bắt buộc nhập' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const { tenant, host } = await this.tenantFor(body?.unit);
    const origin = { ipAddress: request.ip ?? 'unknown', userAgent: request.header('user-agent') ?? null };
    return runAsSchool(tenant, async () => {
      await this.loginRateLimiter.check(origin.ipAddress);
      await this.captcha.assertSolved({
        captchaId: typeof body?.captcha_id === 'string' ? body.captcha_id : undefined,
        captchaText: typeof body?.captcha_text === 'string' && body.captcha_text.trim() ? body.captcha_text : undefined,
      });
      let issued;
      try {
        const otp = text(body?.otp_code, 40);
        issued = await this.authentication.login(login, password, 'portal', origin, otp || undefined);
      } catch (error) {
        if (!isTotpRequiredError(error)) {
          await this.captcha.registerFailure(login);
        }
        throw error;
      }
      await this.captcha.clearFailures(login);
      const sessionId = readSessionIdFromRefreshToken(issued.refreshToken);
      if (!sessionId) {
        throw unauthenticatedError();
      }
      const token = randomBytes(32).toString('base64url');
      const now = this.clock.now();
      const database = this.infrastructure.database;
      await database
        .deleteFrom('login_handoffs')
        .where('expires_at', '<', new Date(now.getTime() - 86_400_000))
        .execute();
      const session = await database
        .selectFrom('sessions')
        .select('user_id')
        .where('id', '=', sessionId)
        .executeTakeFirstOrThrow();
      await database
        .insertInto('login_handoffs')
        .values({
          token_hash: hashToken(token),
          session_id: sessionId,
          user_id: session.user_id,
          ip_address: origin.ipAddress,
          expires_at: new Date(now.getTime() + HANDOFF_SECONDS * 1000),
        })
        .execute();
      return {
        handoff: { host, path: `/sign-in-handoff#code=${token}`, expires_in_seconds: HANDOFF_SECONDS },
      };
    });
  }

  // Tên miền của trường: đổi mã chuyển phiên lấy cookie phiên; mã sai trường, đã dùng hoặc hết hạn thì 401
  async exchange(request: Request, codeInput: unknown) {
    const tenant = currentTenant();
    const code = text(codeInput, 200);
    if (!this.tenancy || !tenant) {
      throw notFound();
    }
    if (!code) {
      throw validationError([{ field: 'code', message: 'Bắt buộc nhập' }]);
    }
    await this.loginRateLimiter.check(request.ip ?? 'unknown');
    const database = this.infrastructure.database;
    const now = this.clock.now();
    const claimed = await database
      .updateTable('login_handoffs')
      .set({ used_at: now })
      .where('token_hash', '=', hashToken(code))
      .where('used_at', 'is', null)
      .where('expires_at', '>', now)
      .returning(['session_id'])
      .executeTakeFirst();
    if (!claimed) {
      throw unauthenticatedError('Mã chuyển phiên không đúng, đã dùng hoặc đã hết hạn; vui lòng đăng nhập lại');
    }
    return this.authentication.reissueForSession(claimed.session_id, {
      ipAddress: request.ip ?? 'unknown',
      userAgent: request.header('user-agent') ?? null,
    });
  }
}

@Controller('auth/directory')
export class UnitDirectoryController {
  constructor(private readonly directory: UnitDirectoryService) {}

  @Get('context')
  context(@Req() request: Request) {
    return this.directory.context(request);
  }

  @Get('departments')
  departments(@Req() request: Request) {
    return this.directory.departments(request);
  }

  @Get('levels')
  levels(@Req() request: Request) {
    return this.directory.levels(request);
  }

  @Get('communes')
  communes(@Query() query: Record<string, unknown>, @Req() request: Request) {
    return this.directory.communes(request, query);
  }

  @Get('units')
  units(@Query() query: Record<string, unknown>, @Req() request: Request) {
    return this.directory.units(request, query);
  }

  @Get('unit')
  unit(@Query('code') code: unknown, @Req() request: Request) {
    return this.directory.unit(request, code);
  }

  @Post('captcha')
  @HttpCode(200)
  captcha(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.directory.issueCaptcha(request, body?.unit);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.directory.login(request, body);
  }
}

@Controller('auth/handoff')
export class LoginHandoffController {
  constructor(
    private readonly directory: UnitDirectoryService,
    private readonly clock: Clock,
  ) {}

  @Post('exchange')
  @HttpCode(200)
  async exchange(
    @Body() body: Record<string, unknown> | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issued = await this.directory.exchange(request, body?.code);
    setRefreshTokenCookie(response, 'portal', issued.refreshToken, issued.refreshExpiresAt, this.clock);
    return issued.response;
  }
}
