import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication, Type } from '@nestjs/common';
import {
  createDatabase,
  createEmptyDatabase,
  dropDatabaseIfExists,
  listDatabasesWithPrefix,
  migrateToLatest,
  readConnectionString,
  replaceDatabaseName,
  type SystemDatabase,
} from '@school-management/database';
import {
  createTestUser,
  postJson,
  startTestApplication,
  type TestContext as IdentityTestContext,
} from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from './academic-years/academic-year-transition.js';
import { createApplication } from './create-application.js';

// Môi trường kiểm thử tích hợp: dịch vụ định danh thật, cơ sở dữ liệu hệ thống tạm và tiền tố tên cơ sở dữ liệu năm học riêng
export interface ApiTestEnvironment {
  identity: IdentityTestContext;
  api: INestApplication;
  baseUrl: string;
  system: Kysely<SystemDatabase>;
  systemDatabaseUrl: string;
  schoolYearDatabasePrefix: string;
  loginAs(roleCode: string, orgUnitId: string | null, mustChangePassword?: boolean): Promise<LoggedInUser>;
  close(): Promise<void>;
}

export interface LoggedInUser {
  userId: string;
  accessToken: string;
}

export async function startApiTestEnvironment(
  options: { additionalControllers?: Type[]; transitionSteps?: AcademicYearTransitionStep[] } = {},
): Promise<ApiTestEnvironment> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const baseSystemUrl = readConnectionString('system');
  const systemDatabaseName = `school_system_test_${suffix}`;
  const schoolYearDatabasePrefix = `school_year_test_${suffix}_`;
  await createEmptyDatabase(baseSystemUrl, systemDatabaseName);
  const systemDatabaseUrl = replaceDatabaseName(baseSystemUrl, systemDatabaseName);
  const migration = await migrateToLatest('system', systemDatabaseUrl);
  if (migration.error) {
    throw migration.error;
  }

  const identity = await startTestApplication();
  const api = await createApplication(
    {
      tokenPublicKeyPem: identity.tokenPublicKeyPem,
      identityBaseUrl: identity.origin,
      systemDatabaseUrl,
      schoolYearDatabasePrefix,
    },
    options,
  );
  await api.listen(0);
  const system = createDatabase<SystemDatabase>(systemDatabaseUrl);

  return {
    identity,
    api,
    baseUrl: `http://127.0.0.1:${(api.getHttpServer().address() as AddressInfo).port}/api/v1`,
    system,
    systemDatabaseUrl,
    schoolYearDatabasePrefix,
    async loginAs(roleCode, orgUnitId, mustChangePassword = false) {
      const user = await createTestUser(identity.database, { roles: [{ roleCode, orgUnitId }], mustChangePassword });
      const response = await postJson(`${identity.baseUrl}/auth/login`, {
        login: user.username,
        password: user.password,
        channel: 'portal',
      });
      if (response.status !== 200) {
        throw new Error(`Đăng nhập kiểm thử thất bại: ${response.status}`);
      }
      return { userId: user.id, accessToken: response.body.access_token as string };
    },
    async close() {
      await api.close();
      await system.destroy();
      await identity.close();
      for (const databaseName of await listDatabasesWithPrefix(baseSystemUrl, schoolYearDatabasePrefix)) {
        await dropDatabaseIfExists(baseSystemUrl, databaseName);
      }
      await dropDatabaseIfExists(baseSystemUrl, systemDatabaseName);
    },
  };
}

export async function sendJson(
  method: string,
  url: string,
  accessToken: string | undefined,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> & { error?: Record<string, unknown> } }> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}
