import { Inject, Injectable } from '@nestjs/common';
import type { ExternalIdentityEventType, IdentityDatabase, SessionChannel } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  ruleViolationError,
  unauthenticatedError,
  validationError,
  type AccessTokenClaims,
} from '@school-management/server';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Selectable } from 'kysely';
import { createHmac, randomBytes } from 'node:crypto';
import { forbidden } from '../accounts/account-authority.js';
import { loadAssignments } from '../accounts/assignments.js';
import { writeIdentityAuditLog } from '../accounts/identity-audit-log.js';
import {
  AuthenticationService,
  type IssuedTokens,
  type RequestOrigin,
} from '../authentication/authentication.service.js';
import { ImpersonationService } from '../authentication/impersonation.service.js';
import { verifyPassword } from '../authentication/password.js';
import { TotpService } from '../authentication/totp.service.js';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import {
  IdentityProvider,
  IdentityProviderError,
  newAuthorizationParameters,
  type AuthorizationParameters,
  type ExternalIdentityResult,
} from './identity-provider.js';
import { OidcIdentityProvider, type OidcClientCredentials } from './oidc-provider.js';
import {
  isLocalHostname,
  PENDING_RAR_DOCUMENTATION,
  type ExternalProviderDefinition,
  type ProviderProfile,
} from './provider-profiles.js';

// Liên kết tài khoản và đăng nhập bằng nhà cung cấp định danh bên ngoài (DT-25, YCTD-225, tài liệu 32 mục 17). Nguyên tắc:
// - Không tự tạo tài khoản: chỉ người đã có tài khoản tự liên kết sau khi xác nhận lại bằng mật khẩu và mã xác thực hai lớp (nếu đã bật).
// - Chỉ lưu mã liên kết (subject) do nhà cung cấp trả, mã hóa bằng khóa của trường (kho khóa S3) cùng băm có khóa để tra; không lưu số định
//   danh, căn cước, họ tên hay claim nào khác.
// - Nhà cung cấp dùng được khi nền tảng đã khai và trường đã bật; nhóm vai trò được dùng do trường chọn (mặc định mọi vai trò trừ học sinh);
//   không cho người dưới 14 tuổi tự đăng nhập (học sinh chỉ khi trường cho vai trò học sinh và nhà cung cấp trả ngày sinh đủ 14 tuổi).
// - Đăng nhập bằng nhà cung cấp ngoài chỉ thay mật khẩu; người đã bật xác thực hai lớp vẫn phải nhập mã, trừ khi trường bật "coi là đạt
//   xác thực hai lớp" và mức đảm bảo nhà cung cấp trả nằm trong danh sách nền tảng khai.
// - Mọi lần liên kết, gỡ, đăng nhập, từ chối đều ghi `external_identity_events`.
// Claude tự chọn chi tiết theo ủy quyền của Eric ngày 2026-10-11
export const EXTERNAL_IDENTITY_RULE_CODE = 'DT-25';
const STUDENT_ROLE_CODE = 'VT-21';
const MINIMUM_SELF_SIGN_IN_AGE = 14;
const STATE_LIFETIME_SECONDS = 10 * 60;
const TICKET_LIFETIME_SECONDS = 5 * 60;
const TICKET_MAXIMUM_ATTEMPTS = 3;
// Địa chỉ quay về phải là trang này của ứng dụng (cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh) trên đúng tên miền của trường
const REDIRECT_PATH_SUFFIX = '/dang-nhap/ben-ngoai';
const SESSION_CHANNELS: SessionChannel[] = ['portal', 'teacher', 'parent'];

// Mỗi hồ sơ cấu hình dùng một bộ nối; thêm giao thức mới là thêm một dòng ở đây, mã nghiệp vụ không đổi
const PROVIDER_FACTORIES: Record<
  ProviderProfile,
  (definition: ExternalProviderDefinition, credentials: OidcClientCredentials) => IdentityProvider
> = {
  oidc: (definition, credentials) => new OidcIdentityProvider(definition, credentials),
  vneid: (definition, credentials) => new OidcIdentityProvider(definition, credentials),
};

type Purpose = 'login' | 'link';

interface PendingAuthorization extends AuthorizationParameters {
  provider: string;
  purpose: Purpose;
  channel: SessionChannel;
  userId: string | null;
  sessionId: string | null;
}

interface PendingTicket {
  provider: string;
  userId: string;
  channel: SessionChannel;
  attempts: number;
}

type SettingsRow = Selectable<IdentityDatabase['external_identity_providers']>;
type UserRow = Selectable<IdentityDatabase['users']>;

export type ExternalCallbackResult =
  | { kind: 'signed_in'; channel: SessionChannel; issued: IssuedTokens }
  | { kind: 'otp_required'; ticket: string; provider: string }
  | { kind: 'linked'; provider: string };

interface Effective {
  definition: ExternalProviderDefinition;
  settings: SettingsRow;
  provider: IdentityProvider;
}

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy nhà cung cấp định danh');
}

function disabledError(name: string): ApplicationError {
  return ruleViolationError(EXTERNAL_IDENTITY_RULE_CODE, `Nhà trường chưa bật đăng nhập bằng ${name}`);
}

@Injectable()
export class ExternalIdentityService {
  constructor(
    private readonly infrastructure: Infrastructure,
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly clock: Clock,
    private readonly authentication: AuthenticationService,
    private readonly totp: TotpService,
    private readonly impersonation: ImpersonationService,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  private definitions(): ExternalProviderDefinition[] {
    return this.configuration.externalIdentityProviders ?? [];
  }

  private definition(code: string): ExternalProviderDefinition {
    const definition = this.definitions().find((item) => item.code === code);
    if (!definition) {
      throw notFound();
    }
    return definition;
  }

  // Khóa mã hóa và khóa băm: của trường (kho khóa S3) ở chế độ nhiều trường; TOTP_ENCRYPTION_KEY và khóa băm dẫn xuất từ nó ở chế độ một
  // trường. Thiếu khóa thì tính năng báo chưa cấu hình, không lưu bản rõ
  private keys(): { encryption: Buffer; hash: Buffer } {
    const tenant = currentTenant();
    if (tenant?.childDataEncryptionKey && tenant.childDataHashKey) {
      return { encryption: tenant.childDataEncryptionKey, hash: tenant.childDataHashKey };
    }
    const key = this.configuration.totpEncryptionKey;
    if (tenant || !key) {
      throw ruleViolationError(
        EXTERNAL_IDENTITY_RULE_CODE,
        'Máy chủ chưa cấu hình khóa mã hóa cho liên kết tài khoản (khóa của trường hoặc TOTP_ENCRYPTION_KEY)',
      );
    }
    return { encryption: key, hash: createHmac('sha256', key).update('external-identity-subject-hash').digest() };
  }

  private subjectHash(subject: string): string {
    return createHmac('sha256', this.keys().hash).update(subject).digest('hex');
  }

  private async settingsRow(code: string): Promise<SettingsRow | undefined> {
    return this.database
      .selectFrom('external_identity_providers')
      .selectAll()
      .where('provider_code', '=', code)
      .executeTakeFirst();
  }

  // Nhà cung cấp đang dùng được ở trường này: nền tảng đã khai, trường đã bật, có mã ứng dụng
  private async effective(code: string): Promise<Effective> {
    const definition = this.definition(code);
    const settings = await this.settingsRow(code);
    if (!settings?.enabled) {
      throw disabledError(definition.displayName);
    }
    const clientId = settings.client_id ?? definition.clientId;
    if (!clientId) {
      throw ruleViolationError(EXTERNAL_IDENTITY_RULE_CODE, `Chưa cấu hình mã ứng dụng của ${definition.displayName}`);
    }
    const clientSecret = settings.client_secret_encrypted
      ? decryptSecret(this.keys().encryption, settings.client_secret_encrypted)
      : settings.client_id
        ? null
        : definition.clientSecret;
    const provider = PROVIDER_FACTORIES[definition.profile](definition, { clientId, clientSecret });
    return { definition, settings, provider };
  }

  // Nút đăng nhập trên màn hình đăng nhập: chỉ nhà cung cấp nền tảng đã khai và trường đã bật
  async loginProviders(): Promise<Array<{ code: string; display_name: string; profile: ProviderProfile }>> {
    const definitions = this.definitions();
    if (definitions.length === 0) {
      return [];
    }
    const enabled = await this.database
      .selectFrom('external_identity_providers')
      .select('provider_code')
      .where('enabled', '=', true)
      .execute();
    const codes = new Set(enabled.map((row) => row.provider_code));
    return definitions
      .filter((definition) => codes.has(definition.code))
      .map((definition) => ({
        code: definition.code,
        display_name: definition.displayName,
        profile: definition.profile,
      }));
  }

  // Địa chỉ quay về: tuyệt đối, đúng tên miền của yêu cầu, đường dẫn kết thúc bằng /dang-nhap/ben-ngoai; http chỉ cho máy cục bộ. Nhà
  // cung cấp còn so với địa chỉ đã đăng ký
  private assertRedirectUri(value: unknown, requestHostname: string): string {
    const invalid = () => validationError([{ field: 'redirect_uri', message: 'Địa chỉ quay về không hợp lệ' }]);
    if (typeof value !== 'string') {
      throw invalid();
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw invalid();
    }
    const secure = url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHostname(url.hostname));
    if (
      !secure ||
      url.hostname !== requestHostname ||
      !url.pathname.endsWith(REDIRECT_PATH_SUFFIX) ||
      url.search !== '' ||
      url.hash !== '' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      throw invalid();
    }
    return url.toString();
  }

  // State của lượt ủy quyền và vé nhập mã hai lớp, theo tiền tố khóa của trường
  private get states() {
    return this.infrastructure.scopedCache('external-auth');
  }

  private get tickets() {
    return this.infrastructure.scopedCache('external-ticket');
  }

  private async beginAuthorization(
    effective: Effective,
    pending: Omit<PendingAuthorization, keyof AuthorizationParameters>,
    redirectUri: string,
  ): Promise<{ authorization_url: string }> {
    const parameters = newAuthorizationParameters(redirectUri);
    let url: string;
    try {
      url = await effective.provider.authorizationUrl(parameters);
    } catch (error) {
      throw this.providerFailure(error);
    }
    const value: PendingAuthorization = { ...pending, ...parameters };
    await this.states.set(parameters.state, JSON.stringify(value), STATE_LIFETIME_SECONDS);
    return { authorization_url: url };
  }

  // Bắt đầu đăng nhập bằng nhà cung cấp ngoài (công khai theo tên miền của trường)
  async startLogin(
    code: string,
    body: Record<string, unknown> | undefined,
    requestHostname: string,
  ): Promise<{ authorization_url: string }> {
    const channel = readChannel(body?.channel);
    const redirectUri = this.assertRedirectUri(body?.redirect_uri, requestHostname);
    const effective = await this.effective(code);
    return this.beginAuthorization(
      effective,
      { provider: code, purpose: 'login', channel, userId: null, sessionId: null },
      redirectUri,
    );
  }

  // Bắt đầu liên kết: người dùng đang đăng nhập xác nhận lại bằng mật khẩu và mã xác thực hai lớp (nếu đã bật)
  async startLink(
    claims: AccessTokenClaims,
    code: string,
    body: Record<string, unknown> | undefined,
    requestHostname: string,
    origin: RequestOrigin,
  ): Promise<{ authorization_url: string }> {
    const redirectUri = this.assertRedirectUri(body?.redirect_uri, requestHostname);
    const effective = await this.effective(code);
    const user = await this.reauthenticate(claims, body, origin, 'liên kết tài khoản');
    await this.assertRolesAllowed(user.id, effective, null);
    return this.beginAuthorization(
      effective,
      { provider: code, purpose: 'link', channel: claims.channel, userId: user.id, sessionId: claims.sessionId },
      redirectUri,
    );
  }

  // Nhà cung cấp chuyển trình duyệt về trang /dang-nhap/ben-ngoai, trang đó gửi state và code lên đây. State dùng một lần
  async callback(
    body: Record<string, unknown> | undefined,
    claims: AccessTokenClaims | null,
    origin: RequestOrigin,
  ): Promise<ExternalCallbackResult> {
    const state = typeof body?.state === 'string' ? body.state : '';
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!state || !code || state.length > 200 || code.length > 2000) {
      throw validationError([{ field: 'state', message: 'Thiếu thông tin quay về từ nhà cung cấp' }]);
    }
    const pending = parseJson<PendingAuthorization>(await this.states.take(state));
    if (!pending) {
      throw unauthenticatedError('Lượt đăng nhập đã hết hạn hoặc đã dùng, vui lòng thử lại');
    }
    const rejectedType: ExternalIdentityEventType = pending.purpose === 'link' ? 'link_rejected' : 'login_rejected';
    let effective: Effective;
    try {
      effective = await this.effective(pending.provider);
    } catch (error) {
      await this.recordEvent(pending.provider, rejectedType, pending.userId, null, 'provider_disabled', origin);
      throw error;
    }
    const now = this.clock.now();
    let result: ExternalIdentityResult;
    try {
      result = await effective.provider.exchange(code, pending, now);
    } catch (error) {
      const reason = error instanceof IdentityProviderError ? error.reason : 'provider_error';
      await this.recordEvent(pending.provider, rejectedType, pending.userId, null, reason, origin);
      throw this.providerFailure(error);
    }
    if (result.ageYears !== null && result.ageYears < MINIMUM_SELF_SIGN_IN_AGE) {
      await this.recordEvent(pending.provider, rejectedType, pending.userId, null, 'under_minimum_age', origin);
      throw ruleViolationError(
        EXTERNAL_IDENTITY_RULE_CODE,
        `Người dưới ${MINIMUM_SELF_SIGN_IN_AGE} tuổi không tự đăng nhập bằng ${effective.definition.displayName}`,
      );
    }
    return pending.purpose === 'link'
      ? this.completeLink(pending, effective, result, claims, origin)
      : this.completeLogin(pending, effective, result, origin, now);
  }

  private async completeLogin(
    pending: PendingAuthorization,
    effective: Effective,
    result: ExternalIdentityResult,
    origin: RequestOrigin,
    now: Date,
  ): Promise<ExternalCallbackResult> {
    const name = effective.definition.displayName;
    const link = await this.database
      .selectFrom('external_identities')
      .select(['id', 'user_id'])
      .where('provider_code', '=', pending.provider)
      .where('subject_hash', '=', this.subjectHash(result.subject))
      .executeTakeFirst();
    if (!link) {
      await this.recordEvent(pending.provider, 'login_rejected', null, null, 'not_linked', origin);
      throw unauthenticatedError(
        `Tài khoản ${name} này chưa liên kết với tài khoản nào của trường. Hãy đăng nhập bằng mật khẩu rồi liên kết ở mục Tài khoản của tôi`,
      );
    }
    const user = await this.database.selectFrom('users').selectAll().where('id', '=', link.user_id).executeTakeFirst();
    if (!user) {
      throw unauthenticatedError();
    }
    try {
      await this.authentication.assertAccountUsable(user, `${pending.provider}:liên kết`, origin, now);
      await this.assertRolesAllowed(user.id, effective, result.ageYears);
    } catch (error) {
      await this.recordEvent(pending.provider, 'login_rejected', user.id, null, rejectionReason(error), origin);
      throw error;
    }
    if (await this.totp.isRequiredFor(user.id)) {
      const values = effective.definition.mfaAssuranceValues;
      const assuranceAccepted = values === null || (result.assurance !== null && values.includes(result.assurance));
      if (!(effective.settings.satisfies_mfa && assuranceAccepted)) {
        const ticket = randomBytes(32).toString('base64url');
        const value: PendingTicket = {
          provider: pending.provider,
          userId: user.id,
          channel: pending.channel,
          attempts: 0,
        };
        await this.tickets.set(ticket, JSON.stringify(value), TICKET_LIFETIME_SECONDS);
        return { kind: 'otp_required', ticket, provider: pending.provider };
      }
    }
    return this.signIn(pending.provider, user, pending.channel, origin, now);
  }

  private async signIn(
    providerCode: string,
    user: UserRow,
    channel: SessionChannel,
    origin: RequestOrigin,
    now: Date,
  ): Promise<ExternalCallbackResult> {
    // Đăng nhập không dùng mật khẩu nên không bắt đổi mật khẩu và không áp hạn mật khẩu ở phiên này (như mã một lần, Q-147)
    const issued = await this.authentication.completeSignIn(user, channel, origin, 'external_provider', false, now);
    await this.database
      .updateTable('external_identities')
      .set({ last_login_at: now })
      .where('provider_code', '=', providerCode)
      .where('user_id', '=', user.id)
      .execute();
    await this.recordEvent(providerCode, 'login', user.id, null, null, origin);
    return { kind: 'signed_in', channel, issued };
  }

  // Người đã bật xác thực hai lớp nhập mã sau khi nhà cung cấp xác nhận; sai quá 3 lần thì phải đăng nhập lại từ đầu
  async completeWithOtp(
    body: Record<string, unknown> | undefined,
    origin: RequestOrigin,
  ): Promise<ExternalCallbackResult> {
    const ticketValue = typeof body?.ticket === 'string' ? body.ticket : '';
    const otp = typeof body?.otp_code === 'string' ? body.otp_code.trim() : '';
    if (!ticketValue || !otp) {
      throw validationError([{ field: 'otp_code', message: 'Bắt buộc nhập' }]);
    }
    const ticket = parseJson<PendingTicket>(await this.tickets.get(ticketValue));
    if (!ticket) {
      throw unauthenticatedError('Lượt đăng nhập đã hết hạn, vui lòng thử lại');
    }
    const now = this.clock.now();
    const user = await this.database.selectFrom('users').selectAll().where('id', '=', ticket.userId).executeTakeFirst();
    if (!user) {
      await this.tickets.delete(ticketValue);
      throw unauthenticatedError();
    }
    await this.authentication.assertAccountUsable(user, `${ticket.provider}:liên kết`, origin, now);
    if (!(await this.totp.verify(user.id, otp))) {
      ticket.attempts += 1;
      await this.authentication.recordSecurityEvent('login_totp_failed', user.id, null, origin.ipAddress);
      if (ticket.attempts >= TICKET_MAXIMUM_ATTEMPTS) {
        await this.tickets.delete(ticketValue);
        await this.recordEvent(ticket.provider, 'login_rejected', user.id, null, 'totp_failed', origin);
      } else {
        await this.tickets.set(ticketValue, JSON.stringify(ticket), TICKET_LIFETIME_SECONDS);
      }
      throw unauthenticatedError('Mã xác thực hai lớp không đúng');
    }
    if (!(await this.tickets.take(ticketValue))) {
      throw unauthenticatedError('Lượt đăng nhập đã hết hạn, vui lòng thử lại');
    }
    return this.signIn(ticket.provider, user, ticket.channel, origin, now);
  }

  private async completeLink(
    pending: PendingAuthorization,
    effective: Effective,
    result: ExternalIdentityResult,
    claims: AccessTokenClaims | null,
    origin: RequestOrigin,
  ): Promise<ExternalCallbackResult> {
    // Lượt liên kết chỉ hoàn tất trong đúng phiên đã bắt đầu (chống gắn định danh của người khác vào tài khoản qua đường dẫn giả)
    if (!claims || claims.userId !== pending.userId || claims.sessionId !== pending.sessionId) {
      await this.recordEvent(pending.provider, 'link_rejected', pending.userId, null, 'session_mismatch', origin);
      throw unauthenticatedError('Lượt liên kết không thuộc phiên đăng nhập này, vui lòng thử lại');
    }
    const userId = claims.userId;
    const name = effective.definition.displayName;
    const hash = this.subjectHash(result.subject);
    const existing = await this.database
      .selectFrom('external_identities')
      .select(['user_id', 'subject_hash'])
      .where('provider_code', '=', pending.provider)
      .where((expression) => expression.or([expression('subject_hash', '=', hash), expression('user_id', '=', userId)]))
      .execute();
    if (existing.some((row) => row.subject_hash === hash && row.user_id !== userId)) {
      await this.recordEvent(pending.provider, 'link_rejected', userId, userId, 'subject_linked_to_other', origin);
      throw new ApplicationError('ERR_CONFLICT', `Tài khoản ${name} này đã liên kết với một tài khoản khác của trường`);
    }
    if (existing.some((row) => row.subject_hash === hash && row.user_id === userId)) {
      return { kind: 'linked', provider: pending.provider };
    }
    if (existing.length > 0) {
      await this.recordEvent(pending.provider, 'link_rejected', userId, userId, 'already_linked', origin);
      throw new ApplicationError(
        'ERR_CONFLICT',
        `Tài khoản đã liên kết với một tài khoản ${name} khác; gỡ liên kết cũ trước`,
      );
    }
    await this.assertRolesAllowed(userId, effective, result.ageYears);
    try {
      await this.database
        .insertInto('external_identities')
        .values({
          provider_code: pending.provider,
          subject_encrypted: encryptSecret(this.keys().encryption, result.subject),
          subject_hash: hash,
          user_id: userId,
        })
        .execute();
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError(
          'ERR_CONFLICT',
          `Tài khoản ${name} này đã liên kết với một tài khoản khác của trường`,
        );
      }
      throw error;
    }
    await this.recordEvent(pending.provider, 'linked', userId, userId, null, origin);
    return { kind: 'linked', provider: pending.provider };
  }

  async unlink(
    claims: AccessTokenClaims,
    code: string,
    body: Record<string, unknown> | undefined,
    origin: RequestOrigin,
  ): Promise<void> {
    this.definition(code);
    const user = await this.reauthenticate(claims, body, origin, 'gỡ liên kết tài khoản');
    const removed = await this.database
      .deleteFrom('external_identities')
      .where('provider_code', '=', code)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (Number(removed.numDeletedRows) === 0) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Tài khoản chưa liên kết với nhà cung cấp này');
    }
    await this.recordEvent(code, 'unlinked', user.id, user.id, null, origin);
  }

  // Trang "Tài khoản của tôi": liên kết hiện có và nhà cung cấp trường đã bật; không trả subject
  async myLinks(claims: AccessTokenClaims) {
    const rows = await this.database
      .selectFrom('external_identities')
      .select(['provider_code', 'linked_at', 'last_login_at'])
      .where('user_id', '=', claims.userId)
      .orderBy('provider_code')
      .execute();
    const available = await this.loginProviders();
    const names = new Map(this.definitions().map((definition) => [definition.code, definition.displayName]));
    return {
      links: rows.map((row) => ({
        provider_code: row.provider_code,
        display_name: names.get(row.provider_code) ?? row.provider_code,
        linked_at: row.linked_at,
        last_login_at: row.last_login_at,
      })),
      available,
    };
  }

  // Nhật ký liên kết của chính người dùng (20 dòng gần nhất)
  async myEvents(claims: AccessTokenClaims) {
    return this.database
      .selectFrom('external_identity_events')
      .select(['provider_code', 'event_type', 'reason', 'ip_address', 'created_at'])
      .where('user_id', '=', claims.userId)
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute();
  }

  // Cấu hình của trường: người quản lý tài khoản xem và sửa; khóa bí mật chỉ trả gợi ý
  async readSettings(claims: AccessTokenClaims) {
    await this.requireAccountManager(claims);
    const rows = await this.database.selectFrom('external_identity_providers').selectAll().execute();
    const counts = await this.database
      .selectFrom('external_identities')
      .select(['provider_code', (builder) => builder.fn.countAll<string>().as('count')])
      .groupBy('provider_code')
      .execute();
    return {
      // Mục "chờ tài liệu RAR" của hồ sơ vneid để màn hình cấu hình ghi rõ
      pending_rar_documentation: PENDING_RAR_DOCUMENTATION,
      providers: this.definitions().map((definition) => {
        const row = rows.find((item) => item.provider_code === definition.code);
        return {
          code: definition.code,
          profile: definition.profile,
          display_name: definition.displayName,
          platform_client_configured: Boolean(definition.clientId),
          enabled: row?.enabled ?? false,
          client_id: row?.client_id ?? null,
          client_secret_set: Boolean(row?.client_secret_encrypted),
          allowed_roles: row?.allowed_roles ?? null,
          satisfies_mfa: row?.satisfies_mfa ?? false,
          linked_accounts: Number(counts.find((item) => item.provider_code === definition.code)?.count ?? 0),
          updated_at: row?.updated_at ?? null,
        };
      }),
    };
  }

  async updateSettings(
    claims: AccessTokenClaims,
    code: string,
    body: Record<string, unknown> | undefined,
    ipAddress: string | null,
  ) {
    await this.requireAccountManager(claims);
    const definition = this.definition(code);
    const before = await this.settingsRow(code);
    const errors: Array<{ field: string; message: string }> = [];
    const readBoolean = (field: string, fallback: boolean): boolean => {
      const value = body?.[field];
      if (value === undefined) {
        return fallback;
      }
      if (typeof value !== 'boolean') {
        errors.push({ field, message: 'Phải là true hoặc false' });
      }
      return value === true;
    };
    const enabled = readBoolean('enabled', before?.enabled ?? false);
    const satisfiesMfa = readBoolean('satisfies_mfa', before?.satisfies_mfa ?? false);
    let clientId = before?.client_id ?? null;
    if (body?.client_id !== undefined) {
      if (body.client_id !== null && (typeof body.client_id !== 'string' || body.client_id.length > 255)) {
        errors.push({ field: 'client_id', message: 'Mã ứng dụng không hợp lệ' });
      } else {
        clientId = typeof body.client_id === 'string' && body.client_id.trim() !== '' ? body.client_id.trim() : null;
      }
    }
    let secretEncrypted = before?.client_secret_encrypted ?? null;
    if (body?.client_secret !== undefined) {
      if (body.client_secret !== null && (typeof body.client_secret !== 'string' || body.client_secret.length > 1000)) {
        errors.push({ field: 'client_secret', message: 'Khóa bí mật không hợp lệ' });
      } else if (typeof body.client_secret === 'string' && body.client_secret.trim() !== '') {
        secretEncrypted = encryptSecret(this.keys().encryption, body.client_secret.trim());
      } else {
        secretEncrypted = null;
      }
    }
    let allowedRoles = before?.allowed_roles ?? null;
    if (body?.allowed_roles !== undefined) {
      if (body.allowed_roles === null) {
        allowedRoles = null;
      } else if (
        !Array.isArray(body.allowed_roles) ||
        body.allowed_roles.length === 0 ||
        body.allowed_roles.some((item) => typeof item !== 'string')
      ) {
        errors.push({ field: 'allowed_roles', message: 'Chọn ít nhất một nhóm vai trò hoặc để trống (mặc định)' });
      } else {
        const wanted = [...new Set(body.allowed_roles as string[])];
        const known = await this.database.selectFrom('roles').select('code').where('code', 'in', wanted).execute();
        if (known.length !== wanted.length) {
          errors.push({ field: 'allowed_roles', message: 'Có mã vai trò không tồn tại' });
        }
        allowedRoles = wanted.sort();
      }
    }
    if (secretEncrypted && !clientId) {
      errors.push({ field: 'client_id', message: 'Có khóa bí mật riêng thì phải nhập mã ứng dụng riêng' });
    }
    if (enabled && !clientId && !definition.clientId) {
      errors.push({
        field: 'client_id',
        message: 'Nền tảng chưa cấp mã ứng dụng dùng chung, nhập mã ứng dụng của trường',
      });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    const values = {
      enabled,
      client_id: clientId,
      client_secret_encrypted: secretEncrypted,
      allowed_roles: allowedRoles,
      satisfies_mfa: satisfiesMfa,
      updated_by: claims.userId,
      updated_at: now,
    };
    const describe = (
      row:
        | {
            enabled: boolean;
            client_id: string | null;
            client_secret_encrypted: string | null;
            allowed_roles: string[] | null;
            satisfies_mfa: boolean;
          }
        | undefined,
    ) =>
      row
        ? {
            enabled: row.enabled,
            client_id: row.client_id,
            client_secret: row.client_secret_encrypted ? 'đã đặt' : null,
            allowed_roles: row.allowed_roles,
            satisfies_mfa: row.satisfies_mfa,
          }
        : null;
    await this.database.transaction().execute(async (transaction) => {
      const saved = await transaction
        .insertInto('external_identity_providers')
        .values({ provider_code: code, ...values })
        .onConflict((conflict) => conflict.column('provider_code').doUpdateSet(values))
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeIdentityAuditLog(transaction, {
        actorUserId: claims.userId,
        entityName: 'external_identity_providers',
        entityId: saved.id,
        action: before ? 'update' : 'create',
        before: describe(before),
        after: describe(values),
        ipAddress,
      });
      await transaction
        .insertInto('external_identity_events')
        .values({
          provider_code: code,
          user_id: null,
          actor_user_id: claims.userId,
          event_type: 'settings_updated',
          reason: enabled ? 'enabled' : 'disabled',
          ip_address: ipAddress,
          created_at: now,
        })
        .execute();
    });
    return (await this.readSettings(claims)).providers.find((provider) => provider.code === code);
  }

  private async requireAccountManager(claims: AccessTokenClaims): Promise<void> {
    const assignments = (await loadAssignments(this.database, [claims.userId])).get(claims.userId) ?? [];
    if (!assignments.some((assignment) => assignment.permissions.includes(PERMISSION_CODES.accountManage))) {
      throw forbidden('Bạn không có quyền cấu hình đăng nhập bằng nhà cung cấp ngoài');
    }
  }

  // Xác nhận lại trước khi liên kết hoặc gỡ: không trong phiên đăng nhập thay hay phiên hỗ trợ, đúng mật khẩu riêng, đúng mã xác thực hai
  // lớp nếu đã bật
  private async reauthenticate(
    claims: AccessTokenClaims,
    body: Record<string, unknown> | undefined,
    origin: RequestOrigin,
    action: string,
  ): Promise<UserRow> {
    if (claims.support) {
      throw forbidden(`Phiên hỗ trợ không ${action} được`);
    }
    await this.impersonation.assertNotImpersonating(claims.sessionId, action);
    const user = await this.database.selectFrom('users').selectAll().where('id', '=', claims.userId).executeTakeFirst();
    if (!user || user.status !== 'active') {
      throw unauthenticatedError();
    }
    if (user.password_hash === null) {
      throw ruleViolationError(EXTERNAL_IDENTITY_RULE_CODE, `Đặt mật khẩu riêng trước khi ${action}`);
    }
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || !(await verifyPassword(user.password_hash, password))) {
      await this.authentication.recordSecurityEvent('external_link_password_failed', user.id, null, origin.ipAddress);
      throw validationError([{ field: 'password', message: 'Mật khẩu không đúng' }]);
    }
    if (await this.totp.isRequiredFor(user.id)) {
      const otp = typeof body?.otp_code === 'string' ? body.otp_code.trim() : '';
      if (!otp || !(await this.totp.verify(user.id, otp))) {
        await this.authentication.recordSecurityEvent('external_link_totp_failed', user.id, null, origin.ipAddress);
        throw validationError([{ field: 'otp_code', message: 'Mã xác thực hai lớp không đúng' }]);
      }
    }
    return user;
  }

  // Nhóm vai trò được dùng: trường chọn, mặc định mọi vai trò trừ học sinh. Học sinh chỉ khi trường cho vai trò học sinh và nhà cung cấp
  // trả ngày sinh đủ 14 tuổi (tuổi không biết thì từ chối)
  private async assertRolesAllowed(userId: string, effective: Effective, ageYears: number | null): Promise<void> {
    const roles = (
      await this.database
        .selectFrom('user_roles')
        .innerJoin('roles', 'roles.id', 'user_roles.role_id')
        .select('roles.code')
        .where('user_roles.user_id', '=', userId)
        .where('roles.is_active', '=', true)
        .execute()
    ).map((row) => row.code);
    const allowed = effective.settings.allowed_roles;
    const permitted = roles.filter((role) => (allowed ? allowed.includes(role) : role !== STUDENT_ROLE_CODE));
    const name = effective.definition.displayName;
    if (permitted.length === 0) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        `Nhóm vai trò của tài khoản không được dùng đăng nhập bằng ${name}`,
        [],
        undefined,
        EXTERNAL_IDENTITY_RULE_CODE,
      );
    }
    if (roles.includes(STUDENT_ROLE_CODE) && (ageYears === null || ageYears < MINIMUM_SELF_SIGN_IN_AGE)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        `Học sinh dưới ${MINIMUM_SELF_SIGN_IN_AGE} tuổi hoặc chưa xác định được tuổi không tự đăng nhập bằng ${name}`,
        [],
        undefined,
        EXTERNAL_IDENTITY_RULE_CODE,
      );
    }
  }

  private providerFailure(error: unknown): ApplicationError {
    if (error instanceof ApplicationError) {
      return error;
    }
    if (error instanceof IdentityProviderError) {
      return unauthenticatedError(error.message);
    }
    return unauthenticatedError('Không đăng nhập được bằng nhà cung cấp định danh, vui lòng thử lại');
  }

  private async recordEvent(
    providerCode: string,
    eventType: ExternalIdentityEventType,
    userId: string | null,
    actorUserId: string | null,
    reason: string | null,
    origin: RequestOrigin,
  ): Promise<void> {
    await this.database
      .insertInto('external_identity_events')
      .values({
        provider_code: providerCode,
        user_id: userId,
        actor_user_id: actorUserId,
        event_type: eventType,
        reason,
        ip_address: origin.ipAddress,
        created_at: this.clock.now(),
      })
      .execute();
  }
}

function readChannel(value: unknown): SessionChannel {
  if (typeof value === 'string' && (SESSION_CHANNELS as string[]).includes(value)) {
    return value as SessionChannel;
  }
  throw validationError([{ field: 'channel', message: 'Kênh đăng nhập phải là portal, teacher hoặc parent' }]);
}

function parseJson<T>(raw: string | null): T | null {
  return raw === null ? null : (JSON.parse(raw) as T);
}

function rejectionReason(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.code === 'ERR_FORBIDDEN' ? 'role_not_allowed' : 'account_unusable';
  }
  return 'error';
}
