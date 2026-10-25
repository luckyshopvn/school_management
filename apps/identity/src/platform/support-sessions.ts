import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Param, Post, Req, Res } from '@nestjs/common';
import {
  activeSupportSession,
  recordSupportAction,
  SUPPORT_DISPLAY_NAME,
  SUPPORT_USERNAME,
  writeAudit,
  type ActiveSupportSession,
  type IdentityDatabase,
  type PlatformDatabase,
  type SupportScope,
  type SystemDatabase,
  type TenancyRuntime,
  type TenantContext,
} from '@school-management/database';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  ApplicationError,
  Clock,
  currentTenant,
  ruleViolationError,
  unauthenticatedError,
  validationError,
} from '@school-management/server';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { writeIdentityAuditLog } from '../accounts/identity-audit-log.js';
import type { IssuedTokens } from '../authentication/authentication.service.js';
import { UNUSABLE_PASSWORD_HASH } from '@school-management/database';
import { setRefreshTokenCookie } from '../authentication/refresh-token-cookie.js';
import { createRefreshToken, TokenService } from '../authentication/token.service.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import { PlatformSchoolsService } from './platform-schools.js';

// Đăng nhập hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4, YCTD-197; tài liệu 32 mục 14.5 "S4"), mở rộng đăng nhập thay của 18h.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - quản trị của trường bật cho phép ở cổng quản trị (bảng support_access_grants ở cơ sở dữ liệu hệ thống của trường): có hạn (mặc
//   định 24 giờ, tối đa 7 ngày), phạm vi chỉ đọc hoặc toàn quyền, ghi lý do; rút được bất kỳ lúc nào, rút thì phiên đang mở kết thúc
//   ngay;
// - nhân viên nền tảng mở phiên ở cổng nền tảng (ghi lý do) khi trường đang cho phép: nhận đường liên kết một lần (5 phút) tới cổng
//   quản trị của trường; đổi đường liên kết lấy phiên đăng nhập của tài khoản hỗ trợ riêng của trường (`ho-tro-nen-tang`, vai trò
//   Hiệu trưởng, không đăng nhập được bằng mật khẩu); phiên hết hạn theo hạn cho phép, tối đa 8 giờ;
// - mã phiên mang claim `spt` (chỉ đọc hoặc toàn quyền): máy chủ API và dịch vụ định danh chặn mọi yêu cầu ghi của phiên chỉ đọc, kiểm
//   phiên hỗ trợ còn hiệu lực ở mỗi yêu cầu, và ghi từng thao tác (phương thức, mẫu đường dẫn, mã trạng thái) vào
//   support_session_actions; bắt đầu, kết thúc ghi cả nhật ký của trường (nhật ký định danh) và platform_audit_log;
// - cổng quản trị hiện biểu ngữ "đang trong phiên hỗ trợ" cho nhân viên nền tảng, và báo phiên đang mở cho người dùng của trường.
export const SUPPORT_RULE_CODE = 'YCTD-197';
const HANDOFF_MINUTES = 5;
const MAX_SESSION_HOURS = 8;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SupportGrantView {
  id: string;
  granted_by_name: string;
  scope: SupportScope;
  reason: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

@Injectable()
export class SupportSessionsService {
  constructor(
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    private readonly infrastructure: Infrastructure,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  private runtime(): TenancyRuntime {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy;
  }

  private get platform(): Kysely<PlatformDatabase> {
    return this.runtime().platform;
  }

  private async contextOf(code: string): Promise<TenantContext> {
    const school = await this.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
    const record = school ? await this.runtime().registry.loadSchool(school.id) : null;
    if (!record) {
      throw notFound();
    }
    return record.context;
  }

  private system(tenant: TenantContext): Kysely<SystemDatabase> {
    return this.runtime().connections.database<SystemDatabase>(tenant, 'system', 'system');
  }

  private identity(tenant: TenantContext): Kysely<IdentityDatabase> {
    return this.runtime().connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  }

  private async activeGrant(tenant: TenantContext, now: Date): Promise<SupportGrantView | undefined> {
    return this.system(tenant)
      .selectFrom('support_access_grants')
      .select(['id', 'granted_by_name', 'scope', 'reason', 'expires_at', 'revoked_at', 'created_at'])
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
  }

  // Cổng nền tảng: cho phép của trường và các phiên hỗ trợ gần đây
  async overview(code: string) {
    const tenant = await this.contextOf(code);
    const grants = await this.system(tenant)
      .selectFrom('support_access_grants')
      .select(['id', 'granted_by_name', 'scope', 'reason', 'expires_at', 'revoked_at', 'created_at'])
      .orderBy('created_at', 'desc')
      .limit(10)
      .execute();
    const sessions = await this.platform
      .selectFrom('support_sessions')
      .select([
        'id',
        'operator_name',
        'scope',
        'reason',
        'created_at',
        'started_at',
        'expires_at',
        'ended_at',
        'end_reason',
      ])
      .where('school_id', '=', tenant.schoolId)
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute();
    const now = this.clock.now();
    return {
      active_grant: grants.find((grant) => !grant.revoked_at && grant.expires_at > now) ?? null,
      grants,
      sessions,
    };
  }

  // Mở phiên hỗ trợ: trường phải đang cho phép; trả đường liên kết một lần tới cổng quản trị của trường
  async start(code: string, reasonInput: unknown, actor: { id: string; name: string }) {
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (reason.length < 5 || reason.length > 500) {
      throw validationError([{ field: 'reason', message: 'Ghi lý do hỗ trợ (5 đến 500 ký tự)' }]);
    }
    const tenant = await this.contextOf(code);
    if (!['trial', 'active', 'read_only'].includes(tenant.status)) {
      throw ruleViolationError(SUPPORT_RULE_CODE, 'Trường không đang phục vụ nên không mở phiên hỗ trợ được');
    }
    const now = this.clock.now();
    const grant = await this.activeGrant(tenant, now);
    if (!grant) {
      throw ruleViolationError(
        SUPPORT_RULE_CODE,
        'Trường chưa cho phép hỗ trợ hoặc cho phép đã hết hạn; đề nghị quản trị của trường bật ở cổng quản trị',
      );
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(grant.expires_at.getTime(), now.getTime() + MAX_SESSION_HOURS * 3_600_000));
    const session = await this.platform
      .insertInto('support_sessions')
      .values({
        school_id: tenant.schoolId,
        operator_id: actor.id,
        operator_name: actor.name,
        grant_id: grant.id,
        scope: grant.scope,
        reason,
        handoff_token_hash: hashToken(token),
        handoff_expires_at: new Date(now.getTime() + HANDOFF_MINUTES * 60_000),
        expires_at: expiresAt,
      })
      .returning(['id', 'scope', 'expires_at'])
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'support.session-requested',
      schoolId: tenant.schoolId,
      details: { support_session_id: session.id, scope: session.scope, reason, grant_id: grant.id },
    });
    const domain = await this.platform
      .selectFrom('school_domains')
      .select('host')
      .where('school_id', '=', tenant.schoolId)
      .where('status', '=', 'active')
      .orderBy('kind', 'desc')
      .orderBy('created_at')
      .executeTakeFirst();
    return {
      session_id: session.id,
      scope: session.scope,
      expires_at: session.expires_at,
      handoff: {
        path: `/support-login?code=${token}`,
        host: domain?.host ?? null,
        expires_in_seconds: HANDOFF_MINUTES * 60,
      },
    };
  }

  // Nhân viên nền tảng hoặc trường kết thúc phiên: thu hồi phiên đăng nhập của trường, ghi hai phía
  async end(id: string, reason: string, actor: { type: 'operator' | 'system'; id?: string | null; name: string }) {
    const session = await this.platform
      .selectFrom('support_sessions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!session) {
      throw notFound();
    }
    if (session.ended_at) {
      return { id, ended_at: session.ended_at };
    }
    const now = this.clock.now();
    await this.platform
      .updateTable('support_sessions')
      .set({ ended_at: now, end_reason: reason.slice(0, 100) })
      .where('id', '=', id)
      .execute();
    if (session.identity_session_id) {
      const record = await this.runtime().registry.loadSchool(session.school_id);
      if (record) {
        const identity = this.identity(record.context);
        const revoked = await identity
          .updateTable('sessions')
          .set({ revoked_at: now })
          .where('id', '=', session.identity_session_id)
          .where('revoked_at', 'is', null)
          .returning('user_id')
          .executeTakeFirst();
        if (revoked) {
          await writeIdentityAuditLog(identity, {
            actorUserId: revoked.user_id,
            entityName: 'users',
            entityId: revoked.user_id,
            action: 'support_end',
            before: null,
            after: { support_session_id: id, operator_name: session.operator_name, reason },
            ipAddress: null,
          });
        }
      }
    }
    await writeAudit(this.platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'support.session-ended',
      schoolId: session.school_id,
      details: { support_session_id: id, reason },
    });
    return { id, ended_at: now };
  }

  // Cổng quản trị của trường: đổi đường liên kết một lần lấy phiên đăng nhập của tài khoản hỗ trợ
  async exchange(
    token: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<IssuedTokens & { scope: SupportScope }> {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant || !token) {
      throw notFound();
    }
    const now = this.clock.now();
    const session = await this.platform
      .selectFrom('support_sessions')
      .selectAll()
      .where('handoff_token_hash', '=', hashToken(token))
      .executeTakeFirst();
    if (
      !session ||
      session.school_id !== tenant.schoolId ||
      session.started_at ||
      session.ended_at ||
      session.handoff_expires_at.getTime() <= now.getTime() ||
      session.expires_at.getTime() <= now.getTime()
    ) {
      throw unauthenticatedError('Đường liên kết hỗ trợ không đúng, đã dùng hoặc đã hết hạn');
    }
    const grant = await this.activeGrant(tenant, now);
    if (!grant || grant.id !== session.grant_id) {
      throw unauthenticatedError('Trường đã rút cho phép hỗ trợ');
    }
    // Đánh dấu đã dùng trước khi cấp phiên: hai yêu cầu cùng lúc chỉ một yêu cầu thành công
    const claimed = await this.platform
      .updateTable('support_sessions')
      .set({ started_at: now, handoff_expires_at: now })
      .where('id', '=', session.id)
      .where('started_at', 'is', null)
      .executeTakeFirst();
    if (Number(claimed.numUpdatedRows) !== 1) {
      throw unauthenticatedError('Đường liên kết hỗ trợ đã dùng');
    }
    const database = this.infrastructure.database;
    const userId = await this.ensureSupportUser(database);
    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(sessionId);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('sessions')
        .values({
          id: sessionId,
          user_id: userId,
          channel: 'portal',
          refresh_token_hash: refreshToken.hash,
          issued_at: now,
          expires_at: session.expires_at,
          ip_address: ipAddress,
          user_agent: userAgent,
        })
        .execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: userId,
        entityName: 'users',
        entityId: userId,
        action: 'support_start',
        before: null,
        after: {
          support_session_id: session.id,
          operator_name: session.operator_name,
          scope: session.scope,
          reason: session.reason,
          grant_id: grant.id,
          expires_at: session.expires_at.toISOString(),
        },
        ipAddress,
      });
    });
    await this.platform
      .updateTable('support_sessions')
      .set({ identity_session_id: sessionId })
      .where('id', '=', session.id)
      .execute();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: session.operator_id,
      action: 'support.session-started',
      schoolId: tenant.schoolId,
      details: { support_session_id: session.id, scope: session.scope, ip: ipAddress },
    });
    return {
      scope: session.scope,
      response: {
        access_token: await this.tokenService.signAccessToken({
          userId,
          sessionId,
          channel: 'portal',
          passwordChangeRequired: false,
          support: session.scope,
        }),
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
        password_change_required: false,
        password_expired: false,
        password_expires_in_days: null,
      },
      refreshToken: refreshToken.token,
      refreshExpiresAt: session.expires_at,
    };
  }

  // Tài khoản hỗ trợ riêng của trường: vai trò Hiệu trưởng, không đăng nhập được bằng mật khẩu
  private async ensureSupportUser(database: Kysely<IdentityDatabase>): Promise<string> {
    const existing = await database
      .selectFrom('users')
      .select(['id', 'status'])
      .where('username', '=', SUPPORT_USERNAME)
      .executeTakeFirst();
    if (existing) {
      if (existing.status !== 'active') {
        await database.updateTable('users').set({ status: 'active' }).where('id', '=', existing.id).execute();
      }
      return existing.id;
    }
    const role = await database.selectFrom('roles').select('id').where('code', '=', 'VT-02').executeTakeFirstOrThrow();
    const user = await database
      .insertInto('users')
      .values({ full_name: SUPPORT_DISPLAY_NAME, username: SUPPORT_USERNAME, password_hash: UNUSABLE_PASSWORD_HASH })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database.insertInto('user_roles').values({ user_id: user.id, role_id: role.id, org_unit_id: null }).execute();
    return user.id;
  }

  // Phiên hỗ trợ còn hiệu lực cho một phiên đăng nhập của trường; đã kết thúc, hết hạn hoặc trường đã rút cho phép thì 401
  async requireActive(identitySessionId: string): Promise<ActiveSupportSession> {
    const active = this.tenancy ? await activeSupportSession(this.platform, identitySessionId, this.clock.now()) : null;
    if (!active) {
      throw unauthenticatedError('Phiên hỗ trợ đã kết thúc');
    }
    return active;
  }

  async describe(identitySessionId: string) {
    const active = await this.requireActive(identitySessionId);
    return { id: active.id, scope: active.scope, operator_name: active.operatorName, expires_at: active.expiresAt };
  }

  // Nhân viên nền tảng đăng xuất: kết thúc phiên hỗ trợ gắn với phiên đăng nhập
  async endForIdentitySession(identitySessionId: string, reason: string): Promise<void> {
    if (!this.tenancy) {
      return;
    }
    const session = await this.platform
      .selectFrom('support_sessions')
      .select('id')
      .where('identity_session_id', '=', identitySessionId)
      .where('ended_at', 'is', null)
      .executeTakeFirst();
    if (session) {
      await this.end(session.id, reason, { type: 'operator', name: SUPPORT_DISPLAY_NAME });
    }
  }

  record(active: ActiveSupportSession, method: string, route: string, status: number): void {
    void recordSupportAction(this.platform, active.id, { service: 'identity', method, route, status }).catch(
      () => undefined,
    );
  }
}

@Controller('auth/platform')
export class PlatformSupportController {
  constructor(
    private readonly support: SupportSessionsService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  @Get('schools/:code/support')
  async overview(@Param('code') code: string, @Req() request: Request) {
    await this.schools.actor(request);
    return this.support.overview(code);
  }

  @Post('schools/:code/support-sessions')
  @HttpCode(200)
  async start(@Param('code') code: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    const actor = await this.schools.actor(request);
    return this.support.start(code, body?.reason, { id: actor.id ?? '', name: actor.name });
  }

  @Post('support-sessions/:id/end')
  @HttpCode(200)
  async end(@Param('id') id: string, @Req() request: Request) {
    const actor = await this.schools.actor(request);
    return this.support.end(id, 'operator', { type: 'operator', id: actor.id ?? null, name: actor.name });
  }
}

@Controller('auth/support')
export class SupportExchangeController {
  constructor(
    private readonly support: SupportSessionsService,
    private readonly clock: Clock,
  ) {}

  @Post('exchange')
  @HttpCode(200)
  async exchange(
    @Body() body: Record<string, unknown> | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code) {
      throw validationError([{ field: 'code', message: 'Bắt buộc nhập' }]);
    }
    const issued = await this.support.exchange(code, request.ip ?? null, request.header('user-agent') ?? null);
    setRefreshTokenCookie(response, 'portal', issued.refreshToken, issued.refreshExpiresAt, this.clock);
    return { ...issued.response, support_scope: issued.scope };
  }
}
