import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import {
  createDatabase,
  readConnectionString,
  type IdentityDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import { hashPassword } from './authentication/password.js';
import { Clock } from '@school-management/server';
import type { IdentityConfiguration } from './common/configuration.js';
import { generateTokenKeyPair } from './common/token-keys.js';
import { createApplication } from './create-application.js';
import type { OrganizationDirectory } from './accounts/organization-directory.js';
import { RecordingSmsSender } from './messaging/sms-sender.js';
import { Infrastructure } from './common/infrastructure.js';
import { Redis } from 'ioredis';
import type { ExternalProviderDefinition } from './external-identity/provider-profiles.js';

// Hỗ trợ kiểm thử tích hợp trên cơ sở dữ liệu định danh và Redis thật
// Tạo tài khoản vận hành nền tảng cho kiểm thử giao diện cổng nền tảng (DT-SaaS phần S2, spec 132)
export {
  createPlatformOperator,
  createPlatformOperatorWithTotp,
  enrollOperatorTotp,
} from './platform/platform-operators.js';
export { OPERATOR_TEST_PASSWORD, operatorOtp, totpCode } from './platform/operator-test-helpers.js';
// Nhà cung cấp OIDC giả lập cho kiểm thử đăng nhập bằng nhà cung cấp ngoài (DT-25, spec 165)
export { MockOidcServer, type MockIdentity, type MockTamper } from './external-identity/mock-oidc-server.js';
export { clearOidcCaches } from './external-identity/oidc-provider.js';
export { parseProviderDefinition, type ExternalProviderDefinition } from './external-identity/provider-profiles.js';

export class AdjustableClock extends Clock {
  private offsetMilliseconds = 0;
  private frozenAt: number | undefined;

  now(): Date {
    return new Date((this.frozenAt ?? Date.now()) + this.offsetMilliseconds);
  }

  freeze(): void {
    this.frozenAt = Date.now();
  }

  advanceMinutes(minutes: number): void {
    this.offsetMilliseconds += minutes * 60 * 1000;
  }
}

export interface TestContext {
  application: INestApplication;
  clock: AdjustableClock;
  database: Kysely<IdentityDatabase>;
  baseUrl: string;
  origin: string;
  tokenPublicKeyPem: string;
  configuration: IdentityConfiguration;
  smsSender: RecordingSmsSender;
  close(): Promise<void>;
}

export async function startTestApplication(
  options: {
    loginRequestsPerMinutePerAddress?: number;
    organizationDirectory?: OrganizationDirectory;
    externalIdentityProviders?: ExternalProviderDefinition[];
    // Cơ sở dữ liệu định danh riêng của bộ kiểm thử (máy chủ API chạy song song nhiều tệp); trống là IDENTITY_DATABASE_URL
    databaseUrl?: string;
  } = {},
): Promise<TestContext> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Thiếu biến môi trường REDIS_URL');
  }
  const keys = await generateTokenKeyPair();
  const configuration: IdentityConfiguration = {
    databaseUrl: options.databaseUrl ?? readConnectionString('identity'),
    redisUrl,
    redisKeyPrefix: `identity-test-${randomUUID()}`,
    tokenPrivateKeyPem: keys.privateKeyPem,
    tokenPublicKeyPem: keys.publicKeyPem,
    loginRequestsPerMinutePerAddress: options.loginRequestsPerMinutePerAddress ?? 1000,
    // Môi trường kiểm thử của máy chủ API gán lại sau khi máy chủ API chạy
    apiBaseUrl: 'http://127.0.0.1:9',
    smsProvider: { provider: 'log' },
    totpEncryptionKey: randomBytes(32),
    externalIdentityProviders: options.externalIdentityProviders ?? [],
  };
  const clock = new AdjustableClock();
  const smsSender = new RecordingSmsSender();
  const application = await createApplication(configuration, clock, options.organizationDirectory, smsSender);
  await application.listen(0);
  const address = application.getHttpServer().address() as AddressInfo;
  const database = createDatabase<IdentityDatabase>(configuration.databaseUrl);
  return {
    application,
    clock,
    database,
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    origin: `http://127.0.0.1:${address.port}`,
    tokenPublicKeyPem: keys.publicKeyPem,
    configuration,
    smsSender,
    async close() {
      await application.close();
      await database.destroy();
    },
  };
}

export interface TestUser {
  id: string;
  phone: string;
  username: string;
  password: string;
}

let sharedPasswordHash: Promise<string> | undefined;
export const TEST_PASSWORD = 'MatKhau2026';

// Tạo tài khoản kiểm thử với số điện thoại và tên đăng nhập ngẫu nhiên để các lần chạy không đụng nhau
export async function createTestUser(
  database: Kysely<IdentityDatabase>,
  options: {
    roles?: Array<{ roleCode: string; orgUnitId: string | null }>;
    mustChangePassword?: boolean;
    validUntil?: string;
    passwordHash?: string;
    // Tài khoản phụ huynh còn dùng mật khẩu mặc định chung (PQ-06)
    usesDefaultPassword?: boolean;
  } = {},
): Promise<TestUser> {
  sharedPasswordHash ??= hashPassword(TEST_PASSWORD);
  const passwordHash = options.usesDefaultPassword ? null : (options.passwordHash ?? (await sharedPasswordHash));
  // Số điện thoại ngẫu nhiên đôi khi trùng tài khoản đã có (khoá duy nhất users_phone_key) thì sinh số khác, thử tối đa năm lần
  for (let attempt = 1; ; attempt += 1) {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const phone = `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
    const username = `kiem_thu_${suffix}`;
    let user: { id: string };
    try {
      user = await database
        .insertInto('users')
        .values({
          full_name: `Người kiểm thử ${suffix}`,
          phone,
          username,
          password_hash: passwordHash,
          must_change_password: options.mustChangePassword ?? options.usesDefaultPassword ?? false,
          valid_until: options.validUntil ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    } catch (error) {
      const duplicate = (error as { code?: string }).code === '23505';
      if (!duplicate || attempt >= 5) {
        throw error;
      }
      continue;
    }
    return assignTestRoles(database, { id: user.id, phone, username, password: TEST_PASSWORD }, options.roles ?? []);
  }
}

async function assignTestRoles(
  database: Kysely<IdentityDatabase>,
  user: TestUser,
  roles: Array<{ roleCode: string; orgUnitId: string | null }>,
): Promise<TestUser> {
  for (const role of roles) {
    const roleRow = await database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', role.roleCode)
      .executeTakeFirstOrThrow();
    await database
      .insertInto('user_roles')
      .values({ user_id: user.id, role_id: roleRow.id, org_unit_id: role.orgUnitId })
      .execute();
  }
  return user;
}

// Kiểm thử giao diện không đọc được tin nhắn thật; dùng để gán mã một lần đã biết cho tài khoản kiểm thử
export function hashForTesting(value: string): Promise<string> {
  return hashPassword(value);
}

// Lấy ảnh mã xác nhận mới và đọc đáp án ở Redis để kiểm thử gửi kèm yêu cầu đăng nhập, quên mật khẩu (DT-16 phần 16c)
export async function solvedCaptcha(context: TestContext): Promise<{ captcha_id: string; captcha_text: string }> {
  const issued = await postJson(`${context.baseUrl}/auth/captcha`, {});
  const captchaId = issued.body.captcha_id as string;
  const redis = context.application.get(Infrastructure).redis;
  const text = await redis.get(`${context.configuration.redisKeyPrefix}:captcha:${captchaId}`);
  if (!text) {
    throw new Error('Không đọc được đáp án mã xác nhận');
  }
  return { captcha_id: captchaId, captcha_text: text };
}

// Kiểm thử giao diện chạy dịch vụ định danh thật (tiền tố khóa Redis "identity"); đọc đáp án mã xác nhận theo mã ảnh. Ở chế độ
// nhiều trường, khóa có thêm tiền tố của trường (DT-24: đăng nhập theo đơn vị ở tên miền chung)
export async function readCaptchaAnswerForTesting(captchaId: string, tenantKeyPrefix?: string): Promise<string | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Thiếu biến môi trường REDIS_URL');
  }
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  try {
    return await redis.get(`identity${tenantKeyPrefix ? `:t:${tenantKeyPrefix}` : ''}:captcha:${captchaId}`);
  } finally {
    redis.disconnect();
  }
}

export interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
  setCookie: string | undefined;
  refreshToken: string | undefined;
}

// Gửi yêu cầu POST; mã làm mới gửi và nhận qua cookie như trình duyệt (BM-71)
export async function postJson(
  url: string,
  body: unknown,
  accessToken?: string,
  refreshToken?: string,
): Promise<JsonResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      // Gửi cùng giá trị dưới tên cookie của cả bốn kênh; máy chủ đọc cookie đúng kênh (BM-71)
      ...(refreshToken
        ? {
            cookie: [
              '__Secure-refresh_token',
              '__Secure-refresh_token_teacher',
              '__Secure-refresh_token_parent',
              '__Secure-refresh_token_student',
            ]
              .map((name) => `${name}=${encodeURIComponent(refreshToken)}`)
              .join('; '),
          }
        : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith('__Secure-refresh_token'));
  const firstPart = setCookie?.split(';')[0] ?? '';
  const cookieValue = firstPart.slice(firstPart.indexOf('=') + 1);
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    setCookie,
    refreshToken: cookieValue ? decodeURIComponent(cookieValue) : undefined,
  };
}

export async function getJson(
  url: string,
  accessToken?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(url, { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

export function errorCode(body: Record<string, unknown>): unknown {
  return (body.error as Record<string, unknown> | undefined)?.code;
}

export interface TenantTestContext {
  application: INestApplication;
  clock: AdjustableClock;
  baseUrl: string;
  origin: string;
  tokenPublicKeyPem: string;
  configuration: IdentityConfiguration;
  smsSender: RecordingSmsSender;
  close(): Promise<void>;
}

// Dịch vụ định danh chạy ở chế độ nhiều trường (DT-SaaS phần S1a): cơ sở dữ liệu định danh theo trường của nền tảng đã dựng,
// nhận diện trường theo tên miền; Redis thật với tiền tố khóa riêng của lần chạy
export async function startTenantTestApplication(
  tenancy: TenancyRuntime,
  options: { loginRequestsPerMinutePerAddress?: number; externalIdentityProviders?: ExternalProviderDefinition[] } = {},
): Promise<TenantTestContext> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Thiếu biến môi trường REDIS_URL');
  }
  const keys = await generateTokenKeyPair();
  const configuration: IdentityConfiguration = {
    databaseUrl: '',
    redisUrl,
    redisKeyPrefix: `identity-test-${randomUUID()}`,
    tokenPrivateKeyPem: keys.privateKeyPem,
    tokenPublicKeyPem: keys.publicKeyPem,
    loginRequestsPerMinutePerAddress: options.loginRequestsPerMinutePerAddress ?? 1000,
    apiBaseUrl: 'http://127.0.0.1:9',
    smsProvider: { provider: 'log' },
    externalIdentityProviders: options.externalIdentityProviders ?? [],
  };
  const clock = new AdjustableClock();
  const smsSender = new RecordingSmsSender();
  const application = await createApplication(configuration, clock, undefined, smsSender, tenancy);
  await application.listen(0);
  const address = application.getHttpServer().address() as AddressInfo;
  return {
    application,
    clock,
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    origin: `http://127.0.0.1:${address.port}`,
    tokenPublicKeyPem: keys.publicKeyPem,
    configuration,
    smsSender,
    async close() {
      await application.close();
    },
  };
}
