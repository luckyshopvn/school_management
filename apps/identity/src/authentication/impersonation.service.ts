import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ImpersonationEndReason } from '@school-management/database';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  ApplicationError,
  Clock,
  ruleViolationError,
  unauthenticatedError,
  validationError,
  type AccessTokenClaims,
  type FieldError,
} from '@school-management/server';
import { Infrastructure } from '../common/infrastructure.js';
import { writeIdentityAuditLog } from '../accounts/identity-audit-log.js';
import type { IssuedTokens, RequestOrigin } from './authentication.service.js';
import { createRefreshToken, TokenService } from './token.service.js';

// Đăng nhập thay (DT-18 phần 18h, YCTD-145): quản trị trường có quyền P01.account.impersonate vào tài khoản của người khác
// để hỗ trợ. Quy tắc do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - chỉ ở cổng quản trị, phải ghi lý do; không đăng nhập thay lồng nhau;
// - không vào tài khoản có quyền cao hơn: vai trò cao nhất của tài khoản đích phải thấp hơn vai trò cao nhất của người đăng
//   nhập thay (ROLE_RANKS), tài khoản đích không có quyền quản trị (ADMIN_PERMISSIONS) mà người đăng nhập thay không có,
//   không có quyền đăng nhập thay, không phải Quản trị nền tảng (VT-01), không phải chính mình, đang hoạt động, có vai
//   trò nhân sự (không chỉ là phụ huynh); quyền đăng nhập thay chỉ theo đơn vị thì mọi vai trò của tài khoản đích phải ở các
//   đơn vị đó;
// - phiên đăng nhập thay dài tối đa 60 phút, không gia hạn; phiên gốc của quản trị giữ nguyên để quay lại khi thoát;
// - trong phiên đăng nhập thay không đổi được mật khẩu, không đặt lại mật khẩu, không sửa chính sách mật khẩu (dịch vụ định
//   danh) và không thao tác chứng thư số, kí số (máy chủ API).
export const IMPERSONATION_RULE_CODE = 'YCTD-145';
export const IMPERSONATE_PERMISSION = 'P01.account.impersonate';
import { IMPERSONATION_LIFETIME_MINUTES } from '@school-management/shared';
const PLATFORM_ADMIN_ROLE_CODE = 'VT-01';
const PARENT_ROLE_CODE = 'VT-14';
const LIST_PAGE_SIZE = 50;
// Thứ bậc vai trò để so "quyền cao hơn": Quản trị nền tảng, Hiệu trưởng, Phó Hiệu trưởng, Cán bộ quản lý cấp trên và Kiểm
// toán viên (xem toàn trường), còn lại; nhóm tự tạo xếp như vai trò thường
const ROLE_RANKS: Record<string, number> = { 'VT-01': 100, 'VT-02': 90, 'VT-15': 70, 'VT-19': 60, 'VT-20': 60 };
const DEFAULT_ROLE_RANK = 50;
// Quyền quản trị: tài khoản đích có quyền nào trong nhóm này mà người đăng nhập thay không có thì là quyền cao hơn
const ADMIN_PERMISSIONS = new Set([
  'P01.account.manage',
  'P01.account.impersonate',
  'P01.data.export-all',
  'P01.api-client.manage',
  'P01.integration.manage',
  'P01.announcement.manage',
  'P01.signing.certificate',
]);

export interface ImpersonationDescription {
  id: string;
  impersonator_id: string;
  impersonator_name: string;
  started_at: Date;
  expires_at: Date;
}

export type ImpersonationStatus = 'active' | ImpersonationEndReason;

export interface ImpersonationView {
  id: string;
  impersonator_user_id: string;
  impersonator_name: string;
  target_user_id: string;
  target_name: string;
  reason: string;
  started_at: Date;
  expires_at: Date;
  ended_at: Date | null;
  status: ImpersonationStatus;
  ip_address: string | null;
}

interface Assignment {
  role_code: string;
  org_unit_id: string | null;
  permission_code: string | null;
}

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  // Bắt đầu đăng nhập thay: mở phiên mới của tài khoản đích; trả mã phiên để bộ điều khiển đặt cookie cổng quản trị
  async start(claims: AccessTokenClaims, body: Record<string, unknown> | undefined, origin: RequestOrigin) {
    const now = this.clock.now();
    const targetUserId = typeof body?.user_id === 'string' ? body.user_id : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const errors: FieldError[] = [];
    if (!/^[0-9a-f-]{36}$/.test(targetUserId)) {
      errors.push({ field: 'user_id', message: 'Chọn tài khoản cần đăng nhập thay' });
    }
    if (reason.length < 5 || reason.length > 500) {
      errors.push({ field: 'reason', message: 'Nhập lý do đăng nhập thay, từ 5 đến 500 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (claims.channel !== 'portal') {
      throw ruleViolationError(IMPERSONATION_RULE_CODE, 'Chỉ đăng nhập thay ở cổng quản trị');
    }
    const session = await this.activeSession(claims.sessionId, now);
    if (session.impersonation_id !== null) {
      throw ruleViolationError(IMPERSONATION_RULE_CODE, 'Đang đăng nhập thay, hãy thoát trước khi đăng nhập thay tài khoản khác');
    }
    const actor = await this.activeUser(claims.userId, now);
    const actorAssignments = await this.assignments(actor.id);
    const scope = actorAssignments.filter((row) => row.permission_code === IMPERSONATE_PERMISSION);
    if (scope.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền đăng nhập thay');
    }
    if (targetUserId === actor.id) {
      throw ruleViolationError(IMPERSONATION_RULE_CODE, 'Không đăng nhập thay chính mình');
    }
    const target = await this.database
      .selectFrom('users')
      .select(['id', 'full_name', 'status', 'valid_until'])
      .where('id', '=', targetUserId)
      .executeTakeFirst();
    if (!target) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy tài khoản');
    }
    if (target.status !== 'active' || (target.valid_until !== null && target.valid_until < toDateText(now))) {
      throw ruleViolationError(IMPERSONATION_RULE_CODE, 'Tài khoản đang khóa hoặc hết hiệu lực, không đăng nhập thay được');
    }
    assertNotHigher(actorAssignments, scope, await this.assignments(target.id));

    const expiresAt = new Date(now.getTime() + IMPERSONATION_LIFETIME_MINUTES * 60_000);
    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(sessionId);
    const impersonationId = await this.database.transaction().execute(async (transaction) => {
      const impersonation = await transaction
        .insertInto('impersonations')
        .values({
          impersonator_user_id: actor.id,
          impersonator_name: actor.full_name,
          target_user_id: target.id,
          target_name: target.full_name,
          original_session_id: session.id,
          reason,
          started_at: now,
          expires_at: expiresAt,
          ip_address: origin.ipAddress,
          user_agent: origin.userAgent,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('sessions')
        .values({
          id: sessionId,
          user_id: target.id,
          channel: 'portal',
          refresh_token_hash: refreshToken.hash,
          issued_at: now,
          expires_at: expiresAt,
          ip_address: origin.ipAddress,
          user_agent: origin.userAgent,
          login_method: 'impersonation',
          impersonation_id: impersonation.id,
        })
        .execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: actor.id,
        entityName: 'users',
        entityId: target.id,
        action: 'impersonate_start',
        before: null,
        after: { impersonation_id: impersonation.id, reason, expires_at: expiresAt.toISOString() },
        ipAddress: origin.ipAddress,
      });
      return impersonation.id;
    });
    await this.securityEvent('impersonation_started', actor.id, origin.ipAddress);
    return {
      impersonationId,
      issued: await this.issue(
        { userId: target.id, sessionId, channel: 'portal', passwordChangeRequired: false },
        refreshToken.token,
        expiresAt,
      ),
    };
  }

  // Thoát đăng nhập thay: đóng phiên của tài khoản đích, cấp lại mã cho phiên gốc của quản trị nếu phiên đó còn hiệu lực
  async exit(claims: AccessTokenClaims, origin: RequestOrigin): Promise<IssuedTokens | null> {
    const now = this.clock.now();
    const session = await this.activeSession(claims.sessionId, now);
    if (session.impersonation_id === null) {
      throw ruleViolationError(IMPERSONATION_RULE_CODE, 'Phiên này không phải phiên đăng nhập thay');
    }
    const impersonation = await this.end(session.impersonation_id, session.id, 'exit', now, origin.ipAddress);
    const original = await this.database
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', impersonation.original_session_id)
      .executeTakeFirst();
    if (!original || original.revoked_at !== null || original.expires_at <= now) {
      return null;
    }
    const refreshToken = createRefreshToken(original.id);
    await this.database
      .updateTable('sessions')
      .set({ refresh_token_hash: refreshToken.hash })
      .where('id', '=', original.id)
      .execute();
    return this.issue(
      { userId: original.user_id, sessionId: original.id, channel: original.channel, passwordChangeRequired: false },
      refreshToken.token,
      original.expires_at,
    );
  }

  // Đăng xuất khi đang đăng nhập thay: kết thúc đăng nhập thay và đăng xuất luôn phiên gốc của quản trị
  async endOnLogout(sessionId: string, ipAddress: string | null): Promise<void> {
    const now = this.clock.now();
    const session = await this.database
      .selectFrom('sessions')
      .select(['id', 'impersonation_id'])
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session?.impersonation_id) {
      return;
    }
    const impersonation = await this.end(session.impersonation_id, session.id, 'logout', now, ipAddress);
    await this.database
      .updateTable('sessions')
      .set({ revoked_at: now })
      .where('id', '=', impersonation.original_session_id)
      .where('revoked_at', 'is', null)
      .execute();
  }

  // Thông tin đăng nhập thay của phiên cho /auth/me; phiên thường trả null
  async describe(sessionId: string): Promise<ImpersonationDescription | null> {
    const row = await this.database
      .selectFrom('sessions')
      .innerJoin('impersonations', 'impersonations.id', 'sessions.impersonation_id')
      .select([
        'impersonations.id',
        'impersonations.impersonator_user_id as impersonator_id',
        'impersonations.impersonator_name',
        'impersonations.started_at',
        'impersonations.expires_at',
      ])
      .where('sessions.id', '=', sessionId)
      .executeTakeFirst();
    return row ?? null;
  }

  // Phiên đang đăng nhập thay không được thao tác trên mật khẩu (DT-18 phần 18h)
  async assertNotImpersonating(sessionId: string, action: string): Promise<void> {
    const session = await this.database
      .selectFrom('sessions')
      .select('impersonation_id')
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (session?.impersonation_id) {
      throw new ApplicationError('ERR_FORBIDDEN', `Đang đăng nhập thay, không ${action} được`, [], undefined, IMPERSONATION_RULE_CODE);
    }
  }

  // Nhật ký đăng nhập thay: người có quyền đăng nhập thay xem toàn bộ, mới nhất trước
  async list(claims: AccessTokenClaims, query: Record<string, unknown>) {
    const now = this.clock.now();
    await this.activeSession(claims.sessionId, now);
    const actorAssignments = await this.assignments(claims.userId);
    if (!actorAssignments.some((row) => row.permission_code === IMPERSONATE_PERMISSION)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem nhật ký đăng nhập thay');
    }
    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
    const keyword = typeof query.q === 'string' ? query.q.trim() : '';
    let base = this.database.selectFrom('impersonations');
    if (keyword) {
      const pattern = `%${keyword.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      base = base.where((expression) =>
        expression.or([
          expression('impersonator_name', 'ilike', pattern),
          expression('target_name', 'ilike', pattern),
          expression('reason', 'ilike', pattern),
        ]),
      );
    }
    const total = Number(
      (await base.select((expression) => expression.fn.countAll().as('count')).executeTakeFirstOrThrow()).count,
    );
    const rows = await base
      .select([
        'id',
        'impersonator_user_id',
        'impersonator_name',
        'target_user_id',
        'target_name',
        'reason',
        'started_at',
        'expires_at',
        'ended_at',
        'end_reason',
        'ip_address',
      ])
      .orderBy('started_at', 'desc')
      .limit(LIST_PAGE_SIZE)
      .offset((page - 1) * LIST_PAGE_SIZE)
      .execute();
    const items: ImpersonationView[] = rows.map(({ end_reason, ...row }) => ({
      ...row,
      status: end_reason ?? (row.expires_at <= now ? 'expired' : 'active'),
    }));
    return { items, page, page_size: LIST_PAGE_SIZE, total, total_pages: Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)) };
  }

  private async end(
    impersonationId: string,
    sessionId: string,
    reason: ImpersonationEndReason,
    now: Date,
    ipAddress: string | null,
  ) {
    const impersonation = await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('sessions')
        .set({ revoked_at: now })
        .where('id', '=', sessionId)
        .where('revoked_at', 'is', null)
        .execute();
      const row = await transaction
        .updateTable('impersonations')
        .set({ ended_at: now, end_reason: reason })
        .where('id', '=', impersonationId)
        .where('ended_at', 'is', null)
        .returning(['impersonator_user_id', 'target_user_id', 'original_session_id'])
        .executeTakeFirst();
      if (row) {
        await writeIdentityAuditLog(transaction, {
          actorUserId: row.impersonator_user_id,
          entityName: 'users',
          entityId: row.target_user_id,
          action: 'impersonate_end',
          before: null,
          after: { impersonation_id: impersonationId, end_reason: reason },
          ipAddress,
        });
      }
      return (
        row ??
        (await transaction
          .selectFrom('impersonations')
          .select(['impersonator_user_id', 'target_user_id', 'original_session_id'])
          .where('id', '=', impersonationId)
          .executeTakeFirstOrThrow())
      );
    });
    await this.securityEvent('impersonation_ended', impersonation.impersonator_user_id, ipAddress);
    return impersonation;
  }

  private async issue(claims: AccessTokenClaims, refreshToken: string, refreshExpiresAt: Date): Promise<IssuedTokens> {
    return {
      response: {
        access_token: await this.tokenService.signAccessToken(claims),
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
        password_change_required: false,
        password_expired: false,
        password_expires_in_days: null,
      },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private async assignments(userId: string): Promise<Assignment[]> {
    return this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select(['roles.code as role_code', 'user_roles.org_unit_id', 'permissions.code as permission_code'])
      .where('user_roles.user_id', '=', userId)
      .where('roles.is_active', '=', true)
      .execute();
  }

  private async activeSession(sessionId: string, now: Date) {
    const session = await this.database
      .selectFrom('sessions')
      .select(['id', 'impersonation_id', 'revoked_at', 'expires_at'])
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session || session.revoked_at !== null || session.expires_at <= now) {
      throw unauthenticatedError();
    }
    return session;
  }

  private async activeUser(userId: string, now: Date) {
    const user = await this.database
      .selectFrom('users')
      .select(['id', 'full_name', 'status', 'valid_until'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user || user.status !== 'active' || (user.valid_until !== null && user.valid_until < toDateText(now))) {
      throw unauthenticatedError();
    }
    return user;
  }

  private async securityEvent(eventType: string, userId: string, ipAddress: string | null): Promise<void> {
    await this.database
      .insertInto('security_events')
      .values({ event_type: eventType, user_id: userId, login_identifier: null, ip_address: ipAddress, created_at: this.clock.now() })
      .execute();
  }
}

// Tài khoản đích không được có quyền cao hơn người đăng nhập thay (xem quy tắc ở đầu tệp)
export function assertNotHigher(actor: Assignment[], scope: Assignment[], target: Assignment[]): void {
  const denied = (message: string) => ruleViolationError(IMPERSONATION_RULE_CODE, message);
  const targetRoles = new Set(target.map((row) => row.role_code));
  if (targetRoles.size === 0 || [...targetRoles].every((code) => code === PARENT_ROLE_CODE)) {
    throw denied('Chỉ đăng nhập thay tài khoản nhân sự dùng cổng quản trị');
  }
  if (targetRoles.has(PLATFORM_ADMIN_ROLE_CODE)) {
    throw denied('Không đăng nhập thay tài khoản Quản trị nền tảng');
  }
  if (target.some((row) => row.permission_code === IMPERSONATE_PERMISSION)) {
    throw denied('Không đăng nhập thay tài khoản quản trị có quyền đăng nhập thay');
  }
  const rank = (rows: Assignment[]) => Math.max(...rows.map((row) => ROLE_RANKS[row.role_code] ?? DEFAULT_ROLE_RANK));
  if (rank(target) >= rank(actor)) {
    throw denied('Không đăng nhập thay tài khoản có vai trò ngang hoặc cao hơn bạn');
  }
  const actorPermissions = new Set(actor.map((row) => row.permission_code));
  const higher = [
    ...new Set(
      target
        .map((row) => row.permission_code)
        .filter((code): code is string => code !== null && ADMIN_PERMISSIONS.has(code) && !actorPermissions.has(code)),
    ),
  ];
  if (higher.length > 0) {
    throw denied(`Không đăng nhập thay tài khoản có quyền quản trị cao hơn bạn (${higher.join(', ')})`);
  }
  if (!scope.some((row) => row.org_unit_id === null)) {
    const units = new Set(scope.map((row) => row.org_unit_id));
    if (target.some((row) => row.org_unit_id === null || !units.has(row.org_unit_id))) {
      throw denied('Tài khoản có vai trò ngoài đơn vị bạn được đăng nhập thay');
    }
  }
}

function toDateText(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(moment);
}
