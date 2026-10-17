import { randomBytes, randomUUID } from 'node:crypto';
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
import type { PaymentProviderCode } from './finance/payment-gateway.js';
import type { PaymentProviderSettings } from './finance/payment-providers.js';
import { RecordingSmsGateway } from './notifications/sms-gateway.js';
import { MemoryFileStorage } from './files/file-storage.js';

// Môi trường kiểm thử tích hợp: dịch vụ định danh thật, cơ sở dữ liệu hệ thống tạm và tiền tố tên cơ sở dữ liệu năm học riêng
export interface ApiTestEnvironment {
  identity: IdentityTestContext;
  api: INestApplication;
  baseUrl: string;
  system: Kysely<SystemDatabase>;
  systemDatabaseUrl: string;
  schoolYearDatabasePrefix: string;
  // Tin nhắn thông báo đã gửi; đặt failuresLeft để giả lập nhà cung cấp lỗi (YCTD-71)
  smsGateway: RecordingSmsGateway;
  loginAs(roleCode: string, orgUnitId: string | null, mustChangePassword?: boolean): Promise<LoggedInUser>;
  loginWithRoles(roles: Array<{ roleCode: string; orgUnitId: string | null }>): Promise<LoggedInUser>;
  close(): Promise<void>;
}

export interface LoggedInUser {
  userId: string;
  accessToken: string;
}

export async function startApiTestEnvironment(
  options: {
    additionalControllers?: Type[];
    transitionSteps?: AcademicYearTransitionStep[];
    // Cổng thanh toán bật thêm và khóa thử của nhà cung cấp thật (YCTD-92)
    paymentGateways?: PaymentProviderCode[];
    paymentProviders?: PaymentProviderSettings;
    // Số dòng tối đa của một lần xuất trực tiếp, đặt nhỏ để kiểm thử tác vụ xuất nền (DT-16 phần 16a)
    syncExportRowLimit?: number;
  } = {},
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
  const smsGateway = new RecordingSmsGateway();
  const api = await createApplication(
    {
      tokenPublicKeyPem: identity.tokenPublicKeyPem,
      identityBaseUrl: identity.origin,
      systemDatabaseUrl,
      schoolYearDatabasePrefix,
      childDataEncryptionKey: randomBytes(32),
      childDataHashKey: randomBytes(32),
      objectStorage: null,
      paymentGateways: options.paymentGateways ?? ['development', 'vietqr-static'],
      paymentProviders: options.paymentProviders,
      notificationDispatchIntervalSeconds: 0,
      exportJobIntervalSeconds: 0,
      syncExportRowLimit: options.syncExportRowLimit,
      facebookPublisher: 'development',
      zaloSender: 'development',
    },
    { ...options, fileStorage: new MemoryFileStorage(), smsGateway },
  );
  await api.listen(0);
  // Dịch vụ định danh đọc cây đơn vị qua máy chủ API khi quản lý tài khoản (YCTD-39)
  identity.configuration.apiBaseUrl = `http://127.0.0.1:${(api.getHttpServer().address() as AddressInfo).port}`;
  const system = createDatabase<SystemDatabase>(systemDatabaseUrl);

  async function login(
    roles: Array<{ roleCode: string; orgUnitId: string | null }>,
    mustChangePassword: boolean,
  ): Promise<LoggedInUser> {
    const user = await createTestUser(identity.database, { roles, mustChangePassword });
    const response = await postJson(`${identity.baseUrl}/auth/login`, {
      login: user.username,
      password: user.password,
      channel: 'portal',
    });
    if (response.status !== 200) {
      throw new Error(`Đăng nhập kiểm thử thất bại: ${response.status}`);
    }
    return { userId: user.id, accessToken: response.body.access_token as string };
  }

  return {
    identity,
    api,
    baseUrl: `http://127.0.0.1:${(api.getHttpServer().address() as AddressInfo).port}/api/v1`,
    system,
    systemDatabaseUrl,
    schoolYearDatabasePrefix,
    smsGateway,
    loginAs(roleCode, orgUnitId, mustChangePassword = false) {
      return login([{ roleCode, orgUnitId }], mustChangePassword);
    },
    loginWithRoles(roles) {
      return login(roles, false);
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

// Tạo và mở một năm học để các kiểm thử cần năm học đang dùng
export async function openTestAcademicYear(
  environment: ApiTestEnvironment,
  accessToken: string,
  name: string,
  calendar: unknown,
): Promise<string> {
  const created = await sendJson('POST', `${environment.baseUrl}/academic-years`, accessToken, { name });
  if (created.status !== 201) {
    throw new Error(`Tạo năm học thất bại: ${JSON.stringify(created.body)}`);
  }
  const academicYearId = created.body.id as string;
  const saved = await sendJson(
    'PUT',
    `${environment.baseUrl}/academic-years/${academicYearId}/calendar`,
    accessToken,
    calendar,
  );
  if (saved.status !== 200) {
    throw new Error(`Lưu lịch thất bại: ${JSON.stringify(saved.body)}`);
  }
  const opened = await sendJson('POST', `${environment.baseUrl}/academic-years/${academicYearId}/open`, accessToken);
  if (opened.status !== 200) {
    throw new Error(`Mở năm học thất bại: ${JSON.stringify(opened.body)}`);
  }
  return academicYearId;
}
