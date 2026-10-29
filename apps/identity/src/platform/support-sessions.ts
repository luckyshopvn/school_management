import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  activeSupportSession,
  recordSupportAction,
  SUPPORT_DISPLAY_NAME,
  SUPPORT_USERNAME,
  writeAudit,
  type ActiveSupportSession,
  type IdentityDatabase,
  type PlatformDatabase,
  type PlatformOperatorRole,
  type SupportAccessBasis,
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
import { PlatformOperatorsService } from './platform-operators.js';
import { PlatformSchoolsService } from './platform-schools.js';
import { operatorRolesFor } from '@school-management/shared';

// Đăng nhập hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4, YCTD-197; tài liệu 47 mục 14.5 "S4"), mở rộng đăng nhập thay của 18h.
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
// Quyền vào mọi trường của quản trị nền tảng (DT-24, YCTD-220; tài liệu 47 mục 16; Eric quyết định ngày 2026-10-26): chính sách ở mức
// nền tảng (platform_settings.support_access_policy), mặc định `any_school`: tài khoản vận hành vào được mọi trường đã khởi tạo mà
// không cần trường đồng ý, nhưng bắt buộc nhập lại mã xác thực hai lớp ngay lúc mở, ghi lý do, chọn phạm vi và số giờ (mặc định 2,
// tối đa 8), ghi nhật ký hai phía như phiên hỗ trợ, trường xem được ở trang Cho phép hỗ trợ, cổng quản trị hiện biểu ngữ "đang truy
// cập với quyền quản trị nền tảng". Đổi sang `school_grant` (khi hợp đồng xử lý dữ liệu đòi trường đồng ý) thì chỉ còn luồng cho
// phép của S4 và các phiên đang mở theo chính sách nền tảng kết thúc ngay.
export type SupportAccessPolicyMode = 'any_school' | 'school_grant';
export interface SupportAccessPolicy {
  mode: SupportAccessPolicyMode;
  default_hours: number;
  max_hours: number;
}
export const DEFAULT_SUPPORT_ACCESS_POLICY: SupportAccessPolicy = {
  mode: 'any_school',
  default_hours: 2,
  max_hours: 8,
};
const PLATFORM_ACCESS_RULE_CODE = 'YCTD-220';
const MAX_POLICY_HOURS = 8;
// Quản trị nền tảng vào thẳng mọi trường (YCTD-314, Eric yêu cầu ngày 2026-10-28, sửa GD-110): tài khoản vận hành vai trò
// `quan_tri` (tài khoản Admin) khi chính sách là `any_school` mở phiên bằng một lần bấm: không hỏi mục đích, không hỏi lại mã xác thực
// hai lớp (đã bắt buộc lúc đăng nhập cổng vận hành), mặc định toàn quyền, không giới hạn theo giờ (phiên có hạn kỹ thuật 30 ngày,
// kết thúc khi Admin bấm Kết thúc, đăng xuất ở trường hoặc chính sách đổi sang `school_grant`). Vẫn ghi nhật ký hai phía: nền tảng
// (`support.platform-admin-entry`, ai, trường nào, lúc nào, địa chỉ mạng) và trường (nhật ký định danh `support_start`), trường
// xem ở trang Cho phép hỗ trợ, cổng quản trị hiện biểu ngữ. Vai trò hỗ trợ, kỹ thuật giữ luồng cũ (mã hai lớp, lý do, có hạn giờ)
export const DIRECT_ENTRY_ROLE: PlatformOperatorRole = 'quan_tri';
const DIRECT_ENTRY_DAYS = 30;
const DIRECT_ENTRY_REASON = 'Quản trị nền tảng vào trường';

function validHours(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_POLICY_HOURS;
}

export async function readSupportAccessPolicy(platform: Kysely<PlatformDatabase>): Promise<SupportAccessPolicy> {
  const row = await platform
    .selectFrom('platform_settings')
    .select('value')
    .where('key', '=', 'support_access_policy')
    .executeTakeFirst();
  const value = (row?.value ?? {}) as Record<string, unknown>;
  const max = validHours(value.max_hours) ? value.max_hours : DEFAULT_SUPPORT_ACCESS_POLICY.max_hours;
  const fallbackDefault = validHours(value.default_hours)
    ? value.default_hours
    : DEFAULT_SUPPORT_ACCESS_POLICY.default_hours;
  return {
    mode: value.mode === 'school_grant' ? 'school_grant' : DEFAULT_SUPPORT_ACCESS_POLICY.mode,
    default_hours: Math.min(max, fallbackDefault),
    max_hours: max,
  };
}
const HANDOFF_MINUTES = 5;
const MAX_SESSION_HOURS = 8;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const SUPPORT_CHANNELS = ['portal', 'teacher', 'parent', 'student'] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];
// Ứng dụng phụ huynh, học sinh (YCTD-315b): chế độ xem của nhân viên hỗ trợ, luôn chỉ đọc dù phiên toàn quyền
export function supportScopeForChannel(scope: SupportScope, channel: string): SupportScope {
  return channel === 'parent' || channel === 'student' ? 'read' : scope;
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
    private readonly operators: PlatformOperatorsService,
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
  async overview(code: string, role: PlatformOperatorRole | null = null) {
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
        'access_basis',
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
    const policy = await readSupportAccessPolicy(this.platform);
    return {
      active_grant: grants.find((grant) => !grant.revoked_at && grant.expires_at > now) ?? null,
      grants,
      sessions,
      policy,
      direct_entry: role === DIRECT_ENTRY_ROLE && policy.mode === 'any_school',
    };
  }

  // Mở phiên hỗ trợ: trường đang cho phép (S4), hoặc chính sách nền tảng cho vào mọi trường (DT-24) kèm mã xác thực hai lớp nhập lại
  // ngay lúc mở; trả đường liên kết một lần tới cổng quản trị của trường
  async start(
    code: string,
    body: Record<string, unknown> | undefined,
    actor: { id: string; name: string; role?: PlatformOperatorRole },
    ipAddress: string | null = null,
  ) {
    const reasonInput = body?.reason;
    const typedReason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    const direct =
      actor.role === DIRECT_ENTRY_ROLE && (await readSupportAccessPolicy(this.platform)).mode === 'any_school';
    const reason = direct && typedReason === '' ? DIRECT_ENTRY_REASON : typedReason;
    if (reason.length < 5 || reason.length > 500) {
      throw validationError([{ field: 'reason', message: 'Ghi lý do hỗ trợ (5 đến 500 ký tự)' }]);
    }
    const tenant = await this.contextOf(code);
    if (!['trial', 'active', 'read_only'].includes(tenant.status)) {
      throw ruleViolationError(SUPPORT_RULE_CODE, 'Trường không đang phục vụ nên không mở phiên hỗ trợ được');
    }
    const now = this.clock.now();
    const grant = direct ? undefined : await this.activeGrant(tenant, now);
    let basis: SupportAccessBasis = 'school_grant';
    let scope: SupportScope;
    let expiresAt: Date;
    if (direct) {
      if (body?.scope !== undefined && body.scope !== 'read' && body.scope !== 'full') {
        throw validationError([{ field: 'scope', message: 'Phạm vi là chỉ đọc hoặc toàn quyền' }]);
      }
      basis = 'platform_policy';
      scope = body?.scope === 'read' ? 'read' : 'full';
      expiresAt = new Date(now.getTime() + DIRECT_ENTRY_DAYS * 86_400_000);
    } else if (grant) {
      scope = grant.scope;
      expiresAt = new Date(Math.min(grant.expires_at.getTime(), now.getTime() + MAX_SESSION_HOURS * 3_600_000));
    } else {
      const policy = await readSupportAccessPolicy(this.platform);
      const otp = typeof body?.otp_code === 'string' ? body.otp_code.trim() : '';
      if (policy.mode !== 'any_school' || !otp) {
        throw ruleViolationError(
          policy.mode === 'any_school' ? PLATFORM_ACCESS_RULE_CODE : SUPPORT_RULE_CODE,
          policy.mode === 'any_school'
            ? 'Trường chưa cho phép hỗ trợ; để truy cập với quyền quản trị nền tảng, nhập lại mã xác thực hai lớp'
            : 'Trường chưa cho phép hỗ trợ hoặc cho phép đã hết hạn; đề nghị quản trị của trường bật ở cổng quản trị',
        );
      }
      const requestedHours = body?.hours === undefined ? policy.default_hours : body.hours;
      if (!validHours(requestedHours) || requestedHours > policy.max_hours) {
        throw validationError([{ field: 'hours', message: `Số giờ từ 1 đến ${policy.max_hours}` }]);
      }
      if (body?.scope !== undefined && body.scope !== 'read' && body.scope !== 'full') {
        throw validationError([{ field: 'scope', message: 'Phạm vi là chỉ đọc hoặc toàn quyền' }]);
      }
      await this.operators.assertSecondFactor(actor.id, otp, ipAddress, now);
      basis = 'platform_policy';
      scope = body?.scope === 'full' ? 'full' : 'read';
      expiresAt = new Date(now.getTime() + requestedHours * 3_600_000);
    }
    const token = randomBytes(32).toString('base64url');
    const session = await this.platform
      .insertInto('support_sessions')
      .values({
        school_id: tenant.schoolId,
        operator_id: actor.id,
        operator_name: actor.name,
        grant_id: grant?.id ?? null,
        scope,
        reason,
        access_basis: basis,
        handoff_token_hash: hashToken(token),
        handoff_expires_at: new Date(now.getTime() + HANDOFF_MINUTES * 60_000),
        expires_at: expiresAt,
      })
      .returning(['id', 'scope', 'expires_at'])
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: direct
        ? 'support.platform-admin-entry'
        : basis === 'platform_policy'
          ? 'support.platform-access-requested'
          : 'support.session-requested',
      schoolId: tenant.schoolId,
      details: {
        support_session_id: session.id,
        scope: session.scope,
        reason,
        grant_id: grant?.id ?? null,
        access_basis: basis,
        expires_at: session.expires_at,
        ...(direct
          ? { second_factor: 'totp-console-login', direct_entry: true, ip: ipAddress }
          : basis === 'platform_policy'
            ? { second_factor: 'totp-step-up', ip: ipAddress }
            : {}),
      },
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
      access_basis: basis,
      expires_at: session.expires_at,
      handoff: {
        path: `/support-login?code=${token}`,
        host: domain?.host ?? null,
        expires_in_seconds: HANDOFF_MINUTES * 60,
      },
    };
  }

  // Đề nghị xem chi tiết của cấp trên còn hiệu lực (đã duyệt, chưa rút, chưa hết hạn)
  private async approvedAccessRequest(id: string | null, now: Date) {
    if (!id) {
      return undefined;
    }
    return this.platform
      .selectFrom('parent_org_access_requests')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'approved')
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .executeTakeFirst();
  }

  // Cấp trên mở phiên xem chi tiết (DT-SaaS phần S6): chỉ khi trường đã duyệt đề nghị; luôn chỉ đọc; hết hạn theo đề nghị, tối đa
  // 8 giờ; nhận đường liên kết một lần như phiên hỗ trợ của S4
  async startForParentOrg(requestId: string, user: { id: string; name: string; unitName: string }) {
    const now = this.clock.now();
    const request = await this.approvedAccessRequest(requestId, now);
    if (!request || request.user_id !== user.id) {
      throw ruleViolationError(
        SUPPORT_RULE_CODE,
        'Đề nghị xem chi tiết chưa được trường duyệt, đã bị rút hoặc đã hết hạn',
      );
    }
    const record = await this.runtime().registry.loadSchool(request.school_id);
    if (!record || !['trial', 'active', 'read_only'].includes(record.context.status)) {
      throw ruleViolationError(SUPPORT_RULE_CODE, 'Trường không đang phục vụ');
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Math.min((request.expires_at as Date).getTime(), now.getTime() + MAX_SESSION_HOURS * 3_600_000),
    );
    const session = await this.platform
      .insertInto('support_sessions')
      .values({
        school_id: request.school_id,
        operator_id: user.id,
        operator_name: `${user.name} (${user.unitName})`,
        grant_id: null,
        requester_kind: 'parent_org',
        access_basis: 'access_request',
        access_request_id: request.id,
        scope: 'read',
        reason: request.reason,
        handoff_token_hash: hashToken(token),
        handoff_expires_at: new Date(now.getTime() + HANDOFF_MINUTES * 60_000),
        expires_at: expiresAt,
      })
      .returning(['id', 'scope', 'expires_at'])
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'system',
      action: 'parent-org.detail-session-requested',
      schoolId: request.school_id,
      details: { support_session_id: session.id, access_request_id: request.id, parent_org_user_id: user.id },
    });
    const domain = await this.platform
      .selectFrom('school_domains')
      .select('host')
      .where('school_id', '=', request.school_id)
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

  // Ứng dụng của trường: đổi đường liên kết một lần lấy phiên đăng nhập của tài khoản hỗ trợ ở kênh của ứng dụng đó (cổng quản trị,
  // ứng dụng giáo viên, phụ huynh, học sinh; YCTD-315, 315b). Ở ứng dụng phụ huynh, học sinh phiên chỉ đọc, Admin chọn lớp rồi học sinh
  // để xem; không đăng nhập thành một phụ huynh, học sinh cụ thể
  async exchange(
    token: string,
    ipAddress: string | null,
    userAgent: string | null,
    channel: SupportChannel = 'portal',
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
    // Phiên của nhân viên nền tảng theo cho phép hỗ trợ (S4); phiên xem chi tiết của cấp trên theo đề nghị trường đã duyệt (S6)
    const grant =
      session.requester_kind === 'operator' && session.access_basis === 'school_grant'
        ? await this.activeGrant(tenant, now)
        : undefined;
    if (session.access_basis === 'school_grant' && (!grant || grant.id !== session.grant_id)) {
      throw unauthenticatedError('Trường đã rút cho phép hỗ trợ');
    }
    if (
      session.access_basis === 'platform_policy' &&
      (await readSupportAccessPolicy(this.platform)).mode !== 'any_school'
    ) {
      throw unauthenticatedError('Chính sách nền tảng không còn cho truy cập khi trường chưa cho phép');
    }
    if (
      session.requester_kind === 'parent_org' &&
      !(await this.approvedAccessRequest(session.access_request_id, now))
    ) {
      throw unauthenticatedError('Trường đã rút hoặc chưa duyệt đề nghị xem chi tiết');
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
          channel,
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
          requester_kind: session.requester_kind,
          access_basis: session.access_basis,
          grant_id: grant?.id ?? null,
          access_request_id: session.access_request_id,
          expires_at: session.expires_at.toISOString(),
          channel,
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
      details: {
        support_session_id: session.id,
        scope: session.scope,
        access_basis: session.access_basis,
        channel,
        ip: ipAddress,
      },
    });
    return {
      scope: supportScopeForChannel(session.scope, channel),
      response: {
        access_token: await this.tokenService.signAccessToken({
          userId,
          sessionId,
          channel,
          passwordChangeRequired: false,
          support: supportScopeForChannel(session.scope, channel),
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

  policy(): Promise<SupportAccessPolicy> {
    return readSupportAccessPolicy(this.platform);
  }

  // Đổi chính sách vào trường của quản trị nền tảng: bắt buộc nhập lại mã xác thực hai lớp; chuyển sang `school_grant` thì các phiên
  // đang mở theo chính sách nền tảng kết thúc ngay
  async updatePolicy(
    body: Record<string, unknown> | undefined,
    actor: { id: string; name: string },
    ipAddress: string | null,
  ): Promise<SupportAccessPolicy> {
    const mode = body?.mode;
    const defaultHours = body?.default_hours;
    const maxHours = body?.max_hours;
    if (mode !== 'any_school' && mode !== 'school_grant') {
      throw validationError([{ field: 'mode', message: 'Chọn vào mọi trường hoặc chỉ khi trường cho phép' }]);
    }
    if (!validHours(maxHours) || !validHours(defaultHours) || defaultHours > maxHours) {
      throw validationError([
        { field: 'default_hours', message: 'Số giờ mặc định và tối đa từ 1 đến 8, mặc định không quá tối đa' },
      ]);
    }
    const otp = typeof body?.otp_code === 'string' ? body.otp_code.trim() : '';
    await this.operators.assertSecondFactor(actor.id, otp || undefined, ipAddress, this.clock.now());
    const before = await readSupportAccessPolicy(this.platform);
    const value = JSON.stringify({ mode, default_hours: defaultHours, max_hours: maxHours });
    await this.platform
      .insertInto('platform_settings')
      .values({ key: 'support_access_policy', value, updated_at: this.clock.now() })
      .onConflict((conflict) => conflict.column('key').doUpdateSet({ value, updated_at: this.clock.now() }))
      .execute();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'support.policy-changed',
      details: { before, after: { mode, default_hours: defaultHours, max_hours: maxHours }, ip: ipAddress },
    });
    if (mode === 'school_grant') {
      const open = await this.platform
        .selectFrom('support_sessions')
        .select('id')
        .where('access_basis', '=', 'platform_policy')
        .where('ended_at', 'is', null)
        .execute();
      for (const session of open) {
        await this.end(session.id, 'policy-changed', { type: 'operator', id: actor.id, name: actor.name });
      }
    }
    return readSupportAccessPolicy(this.platform);
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
    const actor = await this.schools.actor(request, operatorRolesFor('support.view'));
    return this.support.overview(code, actor.role);
  }

  @Post('schools/:code/support-sessions')
  @HttpCode(200)
  async start(@Param('code') code: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    // Kế toán không mở phiên hỗ trợ vào dữ liệu trường (YCTD-311)
    const actor = await this.schools.actor(request, operatorRolesFor('support.open'));
    return this.support.start(
      code,
      body,
      { id: actor.id ?? '', name: actor.name, role: actor.role },
      request.ip ?? null,
    );
  }

  @Get('support-policy')
  async policy(@Req() request: Request) {
    await this.schools.actor(request, operatorRolesFor('support.view'));
    return this.support.policy();
  }

  @Put('support-policy')
  async updatePolicy(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('support.policy'));
    return this.support.updatePolicy(body, { id: actor.id ?? '', name: actor.name }, request.ip ?? null);
  }

  @Post('support-sessions/:id/end')
  @HttpCode(200)
  async end(@Param('id') id: string, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('support.open'));
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
    const channel = body?.channel === undefined ? 'portal' : body.channel;
    if (!SUPPORT_CHANNELS.includes(channel as SupportChannel)) {
      throw validationError([{ field: 'channel', message: 'Kênh là portal, teacher, parent hoặc student' }]);
    }
    const issued = await this.support.exchange(
      code,
      request.ip ?? null,
      request.header('user-agent') ?? null,
      channel as SupportChannel,
    );
    setRefreshTokenCookie(
      response,
      channel as SupportChannel,
      issued.refreshToken,
      issued.refreshExpiresAt,
      this.clock,
    );
    return { ...issued.response, support_scope: issued.scope };
  }
}
