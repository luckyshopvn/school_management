import { Injectable } from '@nestjs/common';
import type { SessionChannel } from '@school-management/database';
import { randomUUID } from 'node:crypto';
import { unauthenticatedError, validationError } from '../common/application-error.js';
import { Clock } from '../common/clock.js';
import { Infrastructure } from '../common/infrastructure.js';
import { checkPasswordPolicy, hashPassword, placeholderPasswordHash, verifyPassword } from './password.js';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  readSessionIdFromRefreshToken,
  TokenService,
  type AccessTokenClaims,
} from './token.service.js';

// Sai mật khẩu 5 lần liên tiếp thì tạm khóa 15 phút rồi tự mở (BM-04, XT-05)
export const MAXIMUM_FAILED_LOGIN_COUNT = 5;
export const TEMPORARY_LOCK_MINUTES = 15;

// Hạn của mã làm mới tính từ lúc đăng nhập (XT-02)
const REFRESH_LIFETIME_MILLISECONDS: Record<SessionChannel, number> = {
  portal: 8 * 60 * 60 * 1000,
  teacher: 30 * 24 * 60 * 60 * 1000,
  parent: 30 * 24 * 60 * 60 * 1000,
};

export const SESSION_CHANNELS: SessionChannel[] = ['portal', 'teacher', 'parent'];

export interface RequestOrigin {
  ipAddress: string;
  userAgent: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  password_change_required: boolean;
}

export interface CurrentUserResponse {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  must_change_password: boolean;
  assignments: Array<{ role_code: string; role_name: string; org_unit_id: string | null; permissions: string[] }>;
}

const INVALID_CREDENTIALS_MESSAGE = 'Số điện thoại, tên đăng nhập hoặc mật khẩu không đúng';
const LOCKED_ACCOUNT_MESSAGE = 'Tài khoản đã bị khóa, vui lòng liên hệ nhà trường';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async login(
    loginIdentifier: string,
    password: string,
    channel: SessionChannel,
    origin: RequestOrigin,
  ): Promise<TokenResponse> {
    const now = this.clock.now();
    const user = await this.database
      .selectFrom('users')
      .selectAll()
      .where((expression) =>
        expression.or([expression('phone', '=', loginIdentifier), expression('username', '=', loginIdentifier)]),
      )
      .executeTakeFirst();

    if (!user) {
      await verifyPassword(await placeholderPasswordHash(), password);
      await this.recordSecurityEvent('login_failed', null, loginIdentifier, origin.ipAddress);
      throw unauthenticatedError(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.valid_until !== null && user.valid_until < toDateText(now)) {
      await this.database
        .updateTable('users')
        .set({ status: 'locked', updated_at: now })
        .where('id', '=', user.id)
        .execute();
      await this.recordSecurityEvent('login_rejected_expired', user.id, loginIdentifier, origin.ipAddress);
      throw unauthenticatedError(LOCKED_ACCOUNT_MESSAGE);
    }
    if (user.status !== 'active') {
      await this.recordSecurityEvent('login_rejected_locked', user.id, loginIdentifier, origin.ipAddress);
      throw unauthenticatedError(LOCKED_ACCOUNT_MESSAGE);
    }
    if (user.locked_until !== null && user.locked_until > now) {
      await this.recordSecurityEvent('login_rejected_temporarily_locked', user.id, loginIdentifier, origin.ipAddress);
      throw unauthenticatedError(temporaryLockMessage(user.locked_until, now));
    }

    if (!(await verifyPassword(user.password_hash, password))) {
      await this.registerFailedLogin(user.id, user.failed_login_count, now);
      await this.recordSecurityEvent('login_failed', user.id, loginIdentifier, origin.ipAddress);
      throw unauthenticatedError(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.database
      .updateTable('users')
      .set({ failed_login_count: 0, locked_until: null, last_login_at: now, updated_at: now })
      .where('id', '=', user.id)
      .execute();

    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(sessionId);
    await this.database
      .insertInto('sessions')
      .values({
        id: sessionId,
        user_id: user.id,
        channel,
        refresh_token_hash: refreshToken.hash,
        issued_at: now,
        expires_at: new Date(now.getTime() + REFRESH_LIFETIME_MILLISECONDS[channel]),
        ip_address: origin.ipAddress,
        user_agent: origin.userAgent,
      })
      .execute();

    return this.buildTokenResponse(
      { userId: user.id, sessionId, channel, passwordChangeRequired: user.must_change_password },
      refreshToken.token,
    );
  }

  // Mỗi lần làm mới cấp mã làm mới mới; dùng lại mã cũ thì thu hồi cả phiên
  async refresh(refreshTokenValue: string, origin: RequestOrigin): Promise<TokenResponse> {
    const now = this.clock.now();
    const sessionId = readSessionIdFromRefreshToken(refreshTokenValue);
    if (!sessionId) {
      throw unauthenticatedError();
    }
    const session = await this.database
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session || session.revoked_at !== null || session.expires_at <= now) {
      throw unauthenticatedError();
    }
    if (session.refresh_token_hash !== hashRefreshToken(refreshTokenValue)) {
      await this.revokeSession(session.id, now);
      await this.recordSecurityEvent('refresh_token_reused', session.user_id, null, origin.ipAddress);
      throw unauthenticatedError();
    }
    const user = await this.findActiveUser(session.user_id, now);

    const refreshToken = createRefreshToken(session.id);
    await this.database
      .updateTable('sessions')
      .set({ refresh_token_hash: refreshToken.hash })
      .where('id', '=', session.id)
      .execute();

    return this.buildTokenResponse(
      {
        userId: user.id,
        sessionId: session.id,
        channel: session.channel,
        passwordChangeRequired: user.must_change_password,
      },
      refreshToken.token,
    );
  }

  async logout(claims: AccessTokenClaims): Promise<void> {
    await this.revokeSession(claims.sessionId, this.clock.now());
  }

  // Đổi mật khẩu xong thì thu hồi các phiên khác và cấp lại mã cho phiên hiện tại
  async changePassword(
    claims: AccessTokenClaims,
    currentPassword: string,
    newPassword: string,
  ): Promise<Omit<TokenResponse, 'refresh_token'>> {
    const now = this.clock.now();
    await this.findActiveSession(claims.sessionId, now);
    const user = await this.findActiveUser(claims.userId, now);

    if (!(await verifyPassword(user.password_hash, currentPassword))) {
      throw validationError([{ field: 'current_password', message: 'Mật khẩu hiện tại không đúng' }]);
    }
    const policyErrors = checkPasswordPolicy('new_password', newPassword);
    if (policyErrors.length > 0) {
      throw validationError(policyErrors);
    }
    if (newPassword === currentPassword) {
      throw validationError([{ field: 'new_password', message: 'Mật khẩu mới phải khác mật khẩu hiện tại' }]);
    }

    await this.database
      .updateTable('users')
      .set({ password_hash: await hashPassword(newPassword), must_change_password: false, updated_at: now })
      .where('id', '=', user.id)
      .execute();
    await this.database
      .updateTable('sessions')
      .set({ revoked_at: now })
      .where('user_id', '=', user.id)
      .where('id', '!=', claims.sessionId)
      .where('revoked_at', 'is', null)
      .execute();

    const accessToken = await this.tokenService.signAccessToken({ ...claims, passwordChangeRequired: false });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      password_change_required: false,
    };
  }

  // Mỗi lần gọi đều kiểm tra lại phiên và tài khoản để thu hồi có hiệu lực ngay (PQ-04, QĐ-20)
  async describeCurrentUser(claims: AccessTokenClaims): Promise<CurrentUserResponse> {
    const now = this.clock.now();
    await this.findActiveSession(claims.sessionId, now);
    const user = await this.findActiveUser(claims.userId, now);

    const rows = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select([
        'user_roles.id as assignment_id',
        'roles.code as role_code',
        'roles.name as role_name',
        'user_roles.org_unit_id',
        'permissions.code as permission_code',
      ])
      .where('user_roles.user_id', '=', user.id)
      .orderBy('roles.code')
      .orderBy('permissions.code')
      .execute();

    const assignments = new Map<string, CurrentUserResponse['assignments'][number]>();
    for (const row of rows) {
      let assignment = assignments.get(row.assignment_id);
      if (!assignment) {
        assignment = {
          role_code: row.role_code,
          role_name: row.role_name,
          org_unit_id: row.org_unit_id,
          permissions: [],
        };
        assignments.set(row.assignment_id, assignment);
      }
      if (row.permission_code) {
        assignment.permissions.push(row.permission_code);
      }
    }

    return {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      username: user.username,
      must_change_password: user.must_change_password,
      assignments: [...assignments.values()],
    };
  }

  private async buildTokenResponse(claims: AccessTokenClaims, refreshToken: string): Promise<TokenResponse> {
    return {
      access_token: await this.tokenService.signAccessToken(claims),
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      password_change_required: claims.passwordChangeRequired,
    };
  }

  private async findActiveSession(sessionId: string, now: Date) {
    const session = await this.database
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session || session.revoked_at !== null || session.expires_at <= now) {
      throw unauthenticatedError();
    }
    return session;
  }

  private async findActiveUser(userId: string, now: Date) {
    const user = await this.database.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user || user.status !== 'active' || (user.valid_until !== null && user.valid_until < toDateText(now))) {
      throw unauthenticatedError(LOCKED_ACCOUNT_MESSAGE);
    }
    return user;
  }

  private async registerFailedLogin(userId: string, previousFailedCount: number, now: Date): Promise<void> {
    const failedCount = previousFailedCount + 1;
    if (failedCount >= MAXIMUM_FAILED_LOGIN_COUNT) {
      await this.database
        .updateTable('users')
        .set({
          failed_login_count: 0,
          locked_until: new Date(now.getTime() + TEMPORARY_LOCK_MINUTES * 60 * 1000),
          updated_at: now,
        })
        .where('id', '=', userId)
        .execute();
      await this.recordSecurityEvent('account_temporarily_locked', userId, null, null);
      return;
    }
    await this.database
      .updateTable('users')
      .set({ failed_login_count: failedCount, updated_at: now })
      .where('id', '=', userId)
      .execute();
  }

  private async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.database
      .updateTable('sessions')
      .set({ revoked_at: now })
      .where('id', '=', sessionId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  private async recordSecurityEvent(
    eventType: string,
    userId: string | null,
    loginIdentifier: string | null,
    ipAddress: string | null,
  ): Promise<void> {
    await this.database
      .insertInto('security_events')
      .values({
        event_type: eventType,
        user_id: userId,
        login_identifier: loginIdentifier,
        ip_address: ipAddress,
        created_at: this.clock.now(),
      })
      .execute();
  }
}

function toDateText(moment: Date): string {
  // Ngày theo giờ Việt Nam để so với cột kiểu ngày
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(moment);
}

function temporaryLockMessage(lockedUntil: Date, now: Date): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
  return `Tài khoản tạm khóa do nhập sai mật khẩu nhiều lần, vui lòng thử lại sau ${minutes} phút`;
}

export function assertChannel(value: unknown): SessionChannel {
  if (typeof value === 'string' && (SESSION_CHANNELS as string[]).includes(value)) {
    return value as SessionChannel;
  }
  throw validationError([{ field: 'channel', message: 'Kênh đăng nhập phải là portal, teacher hoặc parent' }]);
}
