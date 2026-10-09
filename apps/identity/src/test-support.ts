import { randomInt, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { hashPassword } from './authentication/password.js';
import { Clock } from './common/clock.js';
import type { IdentityConfiguration } from './common/configuration.js';
import { generateTokenKeyPair } from './common/token-keys.js';
import { createApplication } from './create-application.js';

// Hỗ trợ kiểm thử tích hợp trên cơ sở dữ liệu định danh và Redis thật

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
  close(): Promise<void>;
}

export async function startTestApplication(loginRequestsPerMinutePerAddress = 1000): Promise<TestContext> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Thiếu biến môi trường REDIS_URL');
  }
  const keys = await generateTokenKeyPair();
  const configuration: IdentityConfiguration = {
    databaseUrl: readConnectionString('identity'),
    redisUrl,
    redisKeyPrefix: `identity-test-${randomUUID()}`,
    tokenPrivateKeyPem: keys.privateKeyPem,
    tokenPublicKeyPem: keys.publicKeyPem,
    loginRequestsPerMinutePerAddress,
  };
  const clock = new AdjustableClock();
  const application = await createApplication(configuration, clock);
  await application.listen(0);
  const address = application.getHttpServer().address() as AddressInfo;
  const database = createDatabase<IdentityDatabase>(configuration.databaseUrl);
  return {
    application,
    clock,
    database,
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
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
  } = {},
): Promise<TestUser> {
  sharedPasswordHash ??= hashPassword(TEST_PASSWORD);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const phone = `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
  const username = `kiem_thu_${suffix}`;
  const user = await database
    .insertInto('users')
    .values({
      full_name: `Người kiểm thử ${suffix}`,
      phone,
      username,
      password_hash: options.passwordHash ?? (await sharedPasswordHash),
      must_change_password: options.mustChangePassword ?? false,
      valid_until: options.validUntil ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const role of options.roles ?? []) {
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
  return { id: user.id, phone, username, password: TEST_PASSWORD };
}

export async function postJson(
  url: string,
  body: unknown,
  accessToken?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
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
