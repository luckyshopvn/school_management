import { Injectable } from '@nestjs/common';
import {
  SUPPORT_USERNAME,
  type IdentityDatabase,
  type LoginMethod,
  type SessionChannel,
  type SupportScope,
} from '@school-management/database';
import type { Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  ApplicationError,
  Clock,
  unauthenticatedError,
  validationError,
  type AccessTokenClaims,
} from '@school-management/server';
import { isSchoolLevelCode, PORTAL_WORKSPACES } from '@school-management/shared';
import { Infrastructure } from '../common/infrastructure.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import { OTP_REQUIRED_MESSAGE, TotpService } from './totp.service.js';
import { checkPasswordPolicy, hashPassword, placeholderPasswordHash, verifyPassword } from './password.js';
import { assertPasswordNotReused, recordPasswordHistory } from './password-history.js';
import { ImpersonationService, type ImpersonationDescription } from './impersonation.service.js';
import { createRefreshToken, hashRefreshToken, readSessionIdFromRefreshToken, TokenService } from './token.service.js';
import { SupportSessionsService } from '../platform/support-sessions.js';

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
  token_type: 'Bearer';
  expires_in: number;
  password_change_required: boolean;
  // Mật khẩu của tài khoản nhân sự đã quá số ngày tối đa (YCTD-110); khi đó password_change_required cũng là true
  password_expired: boolean;
  // Số ngày còn lại khi đã vào khoảng báo trước hết hạn; ngoài khoảng đó hoặc không áp dụng thì null
  password_expires_in_days: number | null;
}

// Hạn mật khẩu của tài khoản tại lúc đăng nhập hoặc làm mới phiên
export interface PasswordExpiry {
  expired: boolean;
  expiresInDays: number | null;
}

const NO_PASSWORD_EXPIRY: PasswordExpiry = { expired: false, expiresInDays: null };
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
// Vai trò Phụ huynh không áp hạn mật khẩu; tài khoản có thêm vai trò khác là tài khoản nhân sự
const PARENT_ROLE_CODE = 'VT-14';

// Mã làm mới không trả trong nội dung phản hồi; bộ điều khiển đặt vào cookie httpOnly (BM-71)
export interface IssuedTokens {
  response: TokenResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface CurrentUserResponse {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  must_change_password: boolean;
  assignments: Array<{ role_code: string; role_name: string; org_unit_id: string | null; permissions: string[] }>;
  // Phân hệ của cổng quản trị tài khoản được dùng (1.2 Phân quyền nhóm theo phần mềm, DT-16 phần 16d)
  workspaces: string[];
  // Phiên đăng nhập thay (DT-18 phần 18h): ai đang đăng nhập thay tài khoản này; phiên thường là null
  impersonation: ImpersonationDescription | null;
  // Phạm vi cấp học của tài khoản (DT-19 phần 19a): mảng trống là mọi cấp
  school_levels: string[];
  // Cấp đang làm việc người dùng chọn ở thanh đầu trang (DT-19 phần 19c): null là "Tất cả"
  working_school_level: string | null;
  // Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): phạm vi, tên nhân viên, hạn; phiên thường là null
  support: { id: string; scope: SupportScope; operator_name: string; expires_at: Date } | null;
}

const INVALID_CREDENTIALS_MESSAGE = 'Số điện thoại, tên đăng nhập hoặc mật khẩu không đúng';
const LOCKED_ACCOUNT_MESSAGE = 'Tài khoản đã bị khóa, vui lòng liên hệ nhà trường';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
    private readonly identitySettings: IdentitySettingsService,
    private readonly impersonation: ImpersonationService,
    private readonly support: SupportSessionsService,
    private readonly totp: TotpService,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async login(
    loginIdentifier: string,
    password: string,
    channel: SessionChannel,
    origin: RequestOrigin,
    otpCode?: string,
  ): Promise<IssuedTokens> {
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
    await this.assertAccountUsable(user, loginIdentifier, origin, now);

    if (!(await this.verifyAccountPassword(user.password_hash, password))) {
      await this.registerFailedLogin(user.id, user.failed_login_count, now);
      await this.recordSecurityEvent(
        user.password_hash === null ? 'login_failed_default_password' : 'login_failed',
        user.id,
        loginIdentifier,
        origin.ipAddress,
      );
      throw unauthenticatedError(INVALID_CREDENTIALS_MESSAGE);
    }

    // Xác thực hai lớp tuỳ chọn theo trường (DT-SaaS phần S8b): người đã đăng ký phải nhập thêm mã; mã sai tính như nhập sai mật khẩu
    if (await this.totp.isRequiredFor(user.id)) {
      if (!otpCode) {
        throw new ApplicationError('ERR_UNAUTHENTICATED', 'Cần mã xác thực hai lớp', [
          { field: 'otp_code', message: OTP_REQUIRED_MESSAGE },
        ]);
      }
      if (!(await this.totp.verify(user.id, otpCode))) {
        await this.registerFailedLogin(user.id, user.failed_login_count, now);
        await this.recordSecurityEvent('login_totp_failed', user.id, loginIdentifier, origin.ipAddress);
        throw unauthenticatedError('Mã xác thực hai lớp không đúng');
      }
    }

    // Đăng nhập bằng mật khẩu mặc định, mật khẩu tạm hoặc mật khẩu đã hết hạn chỉ dùng được điểm cuối đổi mật khẩu (BM-07,
    // BM-69, YCTD-110)
    const expiry = await this.passwordExpiry(user, now);
    if (expiry.expired) {
      await this.recordSecurityEvent('login_password_expired', user.id, loginIdentifier, origin.ipAddress);
    }
    return this.completeSignIn(
      user,
      channel,
      origin,
      'password',
      requiresPasswordChange(user) || expiry.expired,
      now,
      expiry,
    );
  }

  // Tài khoản còn hiệu lực, đang hoạt động và không bị tạm khóa do nhập sai
  async assertAccountUsable(
    user: Selectable<IdentityDatabase['users']>,
    loginIdentifier: string,
    origin: RequestOrigin,
    now: Date,
  ): Promise<void> {
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
  }

  // Sau khi xác thực đúng: kiểm tra tự khóa do lâu không đăng nhập, ghi lần đăng nhập, mở phiên
  async completeSignIn(
    user: Selectable<IdentityDatabase['users']>,
    channel: SessionChannel,
    origin: RequestOrigin,
    loginMethod: LoginMethod,
    passwordChangeRequired: boolean,
    now: Date,
    expiry: PasswordExpiry = NO_PASSWORD_EXPIRY,
  ): Promise<IssuedTokens> {
    // Không đăng nhập quá số ngày cấu hình thì tạm khóa, phải được mở khóa lại (PQ-07, BM-09)
    const lockDays = await this.identitySettings.accountInactivityLockDays();
    const lastActivity = user.last_login_at ?? user.created_at;
    if (now.getTime() - lastActivity.getTime() > lockDays * 24 * 60 * 60 * 1000) {
      await this.database
        .updateTable('users')
        .set({ status: 'locked', updated_at: now })
        .where('id', '=', user.id)
        .execute();
      await this.recordSecurityEvent('login_rejected_inactive', user.id, user.phone ?? user.username, origin.ipAddress);
      throw unauthenticatedError(
        `Tài khoản bị tạm khóa vì không đăng nhập quá ${lockDays} ngày, vui lòng liên hệ nhà trường`,
      );
    }

    await this.database
      .updateTable('users')
      .set({ failed_login_count: 0, locked_until: null, last_login_at: now, updated_at: now })
      .where('id', '=', user.id)
      .execute();

    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(sessionId);
    const expiresAt = new Date(now.getTime() + REFRESH_LIFETIME_MILLISECONDS[channel]);
    await this.database
      .insertInto('sessions')
      .values({
        id: sessionId,
        user_id: user.id,
        channel,
        refresh_token_hash: refreshToken.hash,
        issued_at: now,
        expires_at: expiresAt,
        ip_address: origin.ipAddress,
        user_agent: origin.userAgent,
        login_method: loginMethod,
      })
      .execute();

    return this.buildTokenResponse(
      { userId: user.id, sessionId, channel, passwordChangeRequired },
      refreshToken.token,
      expiresAt,
      expiry,
    );
  }

  // Tài khoản còn dùng mật khẩu mặc định thì so với mật khẩu mặc định chung (PQ-06, YCTD-43)
  private async verifyAccountPassword(passwordHash: string | null, password: string): Promise<boolean> {
    const effectiveHash = passwordHash ?? (await this.identitySettings.parentDefaultPasswordHash());
    if (!effectiveHash) {
      await verifyPassword(await placeholderPasswordHash(), password);
      return false;
    }
    return verifyPassword(effectiveHash, password);
  }

  // Đăng nhập theo đơn vị ở tên miền chung (DT-24): phiên đã mở ở đúng trường lúc đăng nhập; khi trình duyệt sang tên miền của
  // trường thì cấp mã làm mới mới cho phiên đó (mã cũ chưa từng gửi ra ngoài) rồi đi qua đúng luồng làm mới
  async reissueForSession(sessionId: string, origin: RequestOrigin): Promise<IssuedTokens> {
    const refreshToken = createRefreshToken(sessionId);
    const updated = await this.database
      .updateTable('sessions')
      .set({ refresh_token_hash: refreshToken.hash })
      .where('id', '=', sessionId)
      .where('channel', '=', 'portal')
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) !== 1) {
      throw unauthenticatedError();
    }
    return this.refresh(refreshToken.token, 'portal', origin);
  }

  // Mỗi lần làm mới cấp mã làm mới mới; dùng lại mã cũ thì thu hồi cả phiên
  async refresh(refreshTokenValue: string, channel: SessionChannel, origin: RequestOrigin): Promise<IssuedTokens> {
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
    if (!session || session.revoked_at !== null || session.expires_at <= now || session.channel !== channel) {
      throw unauthenticatedError();
    }
    if (session.refresh_token_hash !== hashRefreshToken(refreshTokenValue)) {
      await this.revokeSession(session.id, now);
      await this.recordSecurityEvent('refresh_token_reused', session.user_id, null, origin.ipAddress);
      throw unauthenticatedError();
    }
    const user = await this.findActiveUser(session.user_id, now);
    // Phiên đăng nhập bằng mã một lần luôn là phiên đầy đủ (Q-147)
    const oneTimeCodeSession = session.login_method === 'one_time_code';
    const expiry = oneTimeCodeSession ? NO_PASSWORD_EXPIRY : await this.passwordExpiry(user, now);
    // Phiên hỗ trợ (DT-SaaS phần S4): chỉ làm mới khi phiên hỗ trợ còn hiệu lực và trường chưa rút cho phép
    let support: SupportScope | undefined;
    if (user.username === SUPPORT_USERNAME) {
      try {
        support = (await this.support.requireActive(session.id)).scope;
      } catch (error) {
        await this.revokeSession(session.id, now);
        throw error;
      }
    }

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
        passwordChangeRequired: support
          ? false
          : oneTimeCodeSession
            ? false
            : requiresPasswordChange(user) || expiry.expired,
        ...(support ? { support } : {}),
      },
      refreshToken.token,
      session.expires_at,
      expiry,
    );
  }

  async logout(claims: AccessTokenClaims, ipAddress: string | null = null): Promise<void> {
    await this.impersonation.endOnLogout(claims.sessionId, ipAddress);
    if (claims.support) {
      await this.support.endForIdentitySession(claims.sessionId, 'logout');
    }
    await this.revokeSession(claims.sessionId, this.clock.now());
  }

  // Đổi mật khẩu xong thì thu hồi các phiên khác và cấp lại mã cho phiên hiện tại
  async changePassword(
    claims: AccessTokenClaims,
    currentPassword: string,
    newPassword: string,
  ): Promise<TokenResponse> {
    const now = this.clock.now();
    await this.findActiveSession(claims.sessionId, now);
    await this.impersonation.assertNotImpersonating(claims.sessionId, 'đổi mật khẩu');
    const user = await this.findActiveUser(claims.userId, now);

    if (!(await this.verifyAccountPassword(user.password_hash, currentPassword))) {
      throw validationError([{ field: 'current_password', message: 'Mật khẩu hiện tại không đúng' }]);
    }
    const policyErrors = checkPasswordPolicy(
      'new_password',
      newPassword,
      (await this.identitySettings.passwordPolicy()).password_min_length,
    );
    if (policyErrors.length > 0) {
      throw validationError(policyErrors);
    }
    if (newPassword === currentPassword) {
      throw validationError([{ field: 'new_password', message: 'Mật khẩu mới phải khác mật khẩu hiện tại' }]);
    }
    // Không cho dùng lại mật khẩu gần đây (DT-16 phần 16c)
    await assertPasswordNotReused(this.database, user, newPassword, await this.identitySettings.passwordHistoryCount());

    const newHash = await hashPassword(newPassword);
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('users')
        .set({ password_hash: newHash, password_changed_at: now, must_change_password: false, updated_at: now })
        .where('id', '=', user.id)
        .execute();
      await recordPasswordHistory(transaction, user.id, newHash, now);
      await transaction
        .updateTable('sessions')
        .set({ revoked_at: now })
        .where('user_id', '=', user.id)
        .where('id', '!=', claims.sessionId)
        .where('revoked_at', 'is', null)
        .execute();
    });

    const accessToken = await this.tokenService.signAccessToken({ ...claims, passwordChangeRequired: false });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      password_change_required: false,
      password_expired: false,
      password_expires_in_days: null,
    };
  }

  // Hạn mật khẩu theo chính sách (YCTD-110): chỉ tài khoản nhân sự có mật khẩu riêng; tài khoản chỉ có vai trò Phụ huynh
  // và tài khoản còn dùng mật khẩu mặc định chung không áp dụng. Số ngày tối đa bằng 0 là không giới hạn
  async passwordExpiry(
    user: Pick<Selectable<IdentityDatabase['users']>, 'id' | 'password_hash' | 'password_changed_at'>,
    now: Date,
  ): Promise<PasswordExpiry> {
    if (user.password_hash === null) {
      return NO_PASSWORD_EXPIRY;
    }
    const policy = await this.identitySettings.passwordPolicy();
    if (policy.password_max_age_days === 0) {
      return NO_PASSWORD_EXPIRY;
    }
    const staffRole = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('roles.code')
      .where('user_roles.user_id', '=', user.id)
      .where('roles.code', '!=', PARENT_ROLE_CODE)
      .executeTakeFirst();
    if (!staffRole) {
      return NO_PASSWORD_EXPIRY;
    }
    const expiresAt = user.password_changed_at.getTime() + policy.password_max_age_days * DAY_MILLISECONDS;
    if (now.getTime() >= expiresAt) {
      return { expired: true, expiresInDays: 0 };
    }
    const daysLeft = Math.ceil((expiresAt - now.getTime()) / DAY_MILLISECONDS);
    return { expired: false, expiresInDays: daysLeft <= policy.password_expiry_warning_days ? daysLeft : null };
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
      // Nhóm hết hiệu lực không cấp quyền, phân hệ (DT-16 phần 16d)
      .where('roles.is_active', '=', true)
      .orderBy('roles.code')
      .orderBy('permissions.code')
      .execute();

    // Phân hệ của cổng quản trị: phân hệ hiện khi có ít nhất một nhóm còn hiệu lực của tài khoản không bỏ phân hệ đó (1.2)
    const roleCodes = [...new Set(rows.map((row) => row.role_code))];
    const exclusions = roleCodes.length
      ? await this.database
          .selectFrom('role_workspace_exclusions')
          .innerJoin('roles', 'roles.id', 'role_workspace_exclusions.role_id')
          .select(['roles.code', 'role_workspace_exclusions.workspace_key'])
          .where('roles.code', 'in', roleCodes)
          .execute()
      : [];
    const workspaces = PORTAL_WORKSPACES.map((workspace) => workspace.key).filter((key) =>
      roleCodes.some((code) => !exclusions.some((item) => item.code === code && item.workspace_key === key)),
    );

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
      workspaces,
      impersonation: await this.impersonation.describe(claims.sessionId),
      school_levels: (
        await this.database
          .selectFrom('user_school_levels')
          .select('school_level')
          .where('user_id', '=', user.id)
          .orderBy('school_level')
          .execute()
      ).map((row) => row.school_level),
      working_school_level: await this.readWorkingSchoolLevel(user.id),
      support: claims.support ? await this.support.describe(claims.sessionId) : null,
    };
  }

  private async readWorkingSchoolLevel(userId: string): Promise<string | null> {
    const row = await this.database
      .selectFrom('user_preferences')
      .select('working_school_level')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row?.working_school_level ?? null;
  }

  // Lưu cấp đang làm việc của chính người dùng (DT-19 phần 19c): mã một trong bốn cấp, hoặc null là "Tất cả". Cấp ngoài
  // phạm vi cấp của tài khoản bị từ chối; cấp đã tắt ở trường thì cổng quản trị tự coi là "Tất cả" khi đọc (dịch vụ định
  // danh không đọc cơ sở dữ liệu hệ thống). Chỉ là lựa chọn hiển thị, không cấp thêm quyền nên không ghi nhật ký thao tác
  async setWorkingSchoolLevel(
    claims: AccessTokenClaims,
    value: unknown,
  ): Promise<{ working_school_level: string | null }> {
    const now = this.clock.now();
    await this.findActiveSession(claims.sessionId, now);
    const user = await this.findActiveUser(claims.userId, now);
    if (value !== null && !isSchoolLevelCode(value)) {
      throw validationError([{ field: 'school_level', message: 'Mã cấp là MN, TH, THCS, THPT hoặc để trống' }]);
    }
    if (value !== null) {
      const scope = await this.database
        .selectFrom('user_school_levels')
        .select('school_level')
        .where('user_id', '=', user.id)
        .execute();
      if (scope.length > 0 && !scope.some((row) => row.school_level === value)) {
        throw validationError([{ field: 'school_level', message: 'Cấp học nằm ngoài phạm vi cấp học của tài khoản' }]);
      }
    }
    await this.database
      .insertInto('user_preferences')
      .values({ user_id: user.id, working_school_level: value, updated_at: now })
      .onConflict((conflict) =>
        conflict.column('user_id').doUpdateSet({ working_school_level: value, updated_at: now }),
      )
      .execute();
    return { working_school_level: value };
  }

  private async buildTokenResponse(
    claims: AccessTokenClaims,
    refreshToken: string,
    refreshExpiresAt: Date,
    expiry: PasswordExpiry,
  ): Promise<IssuedTokens> {
    return {
      response: {
        access_token: await this.tokenService.signAccessToken(claims),
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
        password_change_required: claims.passwordChangeRequired,
        password_expired: expiry.expired,
        password_expires_in_days: expiry.expiresInDays,
      },
      refreshToken,
      refreshExpiresAt,
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

  // Nhãn tài khoản hiện trong ứng dụng xác thực: tên đăng nhập, không có thì số điện thoại
  async accountLabel(userId: string): Promise<string> {
    const user = await this.database
      .selectFrom('users')
      .select(['username', 'phone', 'full_name'])
      .where('id', '=', userId)
      .executeTakeFirst();
    return user?.username ?? user?.phone ?? user?.full_name ?? userId;
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
    // Ngưỡng và thời gian khóa riêng từng trường (DT-SaaS phần S8b)
    const policy = await this.identitySettings.passwordPolicy();
    if (failedCount >= policy.login_max_failed_attempts) {
      await this.database
        .updateTable('users')
        .set({
          failed_login_count: 0,
          locked_until: new Date(now.getTime() + policy.login_lock_minutes * 60 * 1000),
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

  async recordSecurityEvent(
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

function requiresPasswordChange(user: { must_change_password: boolean; password_hash: string | null }): boolean {
  return user.must_change_password || user.password_hash === null;
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
