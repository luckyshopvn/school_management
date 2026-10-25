import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import {
  startTenantTestPlatform,
  type IdentityDatabase,
  type SchoolDatabaseLayoutValue,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import {
  createTestUser,
  startTenantTestApplication,
  TEST_PASSWORD,
  type TenantTestContext,
} from '@school-management/identity/testing';
import type { TenantContext } from '@school-management/server';
import type { ApiConfiguration } from './common/configuration.js';
import { withTenantAccessors } from './common/tenant-configuration.js';
import { createApplication } from './create-application.js';
import { MemoryFileStorage } from './files/file-storage.js';
import { RecordingSmsGateway } from './notifications/sms-gateway.js';

// Hỗ trợ kiểm thử máy chủ API ở chế độ nhiều trường (DT-SaaS phần S1a): nền tảng và các trường giả, dịch vụ định danh và máy chủ API
// chạy thật, nhận diện trường theo tên miền đặt ở tiêu đề Host

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export function sendWithHost(
  origin: string,
  options: { method?: string; path: string; host?: string; token?: string; body?: unknown },
): Promise<Reply> {
  const url = new URL(`${origin}${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method ?? (payload ? 'POST' : 'GET'),
        headers: {
          ...(options.host ? { host: options.host } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: Record<string, unknown>;
          try {
            body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          } catch {
            body = { raw: text.slice(0, 200) };
          }
          resolve({ status: response.statusCode ?? 0, body });
        });
      },
    );
    request.on('error', reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}

export interface MultiTenantApi {
  platform: TenantTestPlatform;
  identityRuntime: TenancyRuntime;
  apiRuntime: TenancyRuntime;
  identity: TenantTestContext;
  api: INestApplication;
  apiOrigin: string;
  identityOrigin: string;
  hosts: Record<string, string>;
  tokens: Record<string, string>;
  tenantOf(name: string): Promise<TenantContext>;
  call(name: string, method: string, path: string, body?: unknown, token?: string): Promise<Reply>;
  close(): Promise<void>;
}

export async function startMultiTenantApi(options: {
  schools?: string[];
  layout?: SchoolDatabaseLayoutValue;
  label?: string;
}): Promise<MultiTenantApi> {
  const schools = options.schools ?? ['alpha', 'beta'];
  const platform = await startTenantTestPlatform({
    schools,
    layout: options.layout ?? 'database',
    label: options.label ?? 'api',
  });
  const hosts: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  let identity: TenantTestContext | undefined;
  let api: INestApplication | undefined;
  try {
    for (const name of schools) {
      hosts[name] = platform.school(name).host;
    }
    const identityRuntime = platform.createRuntime();
    const apiRuntime = platform.createRuntime();
    identity = await startTenantTestApplication(identityRuntime);
    const base: ApiConfiguration = {
      tokenPublicKeyPem: identity.tokenPublicKeyPem,
      identityBaseUrl: identity.origin,
      systemDatabaseUrl: '',
      schoolYearDatabasePrefix: '',
      childDataEncryptionKey: Buffer.alloc(0),
      childDataHashKey: Buffer.alloc(0),
      objectStorage: null,
      paymentGateways: ['development', 'vietqr-static'],
      notificationDispatchIntervalSeconds: 0,
      exportJobIntervalSeconds: 0,
      facebookPublisher: 'development',
      zaloSender: 'development',
    };
    api = await createApplication(withTenantAccessors(base, apiRuntime), {
      fileStorage: new MemoryFileStorage(),
      smsGateway: new RecordingSmsGateway(),
      tenancy: apiRuntime,
    });
    await api.listen(0);
    const apiOrigin = `http://127.0.0.1:${(api.getHttpServer().address() as AddressInfo).port}`;
    identity.configuration.apiBaseUrl = apiOrigin;
    const identityOrigin = identity.origin;

    for (const name of schools) {
      const tenant = await identityRuntime.registry.resolveHost(hosts[name] as string);
      if (!tenant) {
        throw new Error(`Không phân giải được trường ${name}`);
      }
      const database = identityRuntime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
      const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
      const reply = await sendWithHost(identityOrigin, {
        path: '/api/v1/auth/login',
        host: hosts[name],
        body: { login: user.username, password: TEST_PASSWORD, channel: 'portal' },
      });
      if (reply.status !== 200) {
        throw new Error(`Đăng nhập kiểm thử thất bại: ${JSON.stringify(reply.body)}`);
      }
      tokens[name] = reply.body.access_token as string;
    }

    const startedIdentity = identity;
    const startedApi = api;
    return {
      platform,
      identityRuntime,
      apiRuntime,
      identity: startedIdentity,
      api: startedApi,
      apiOrigin,
      identityOrigin,
      hosts,
      tokens,
      async tenantOf(name) {
        const tenant = await apiRuntime.registry.resolveHost(hosts[name] as string);
        if (!tenant) {
          throw new Error(`Không phân giải được trường ${name}`);
        }
        return tenant;
      },
      call(name, method, path, body, token = tokens[name]) {
        return sendWithHost(apiOrigin, {
          method,
          path: `/api/v1${path}`,
          host: hosts[name],
          ...(token ? { token } : {}),
          ...(body !== undefined ? { body } : {}),
        });
      },
      async close() {
        await startedApi.close();
        await startedIdentity.close();
        await platform.close();
      },
    };
  } catch (error) {
    await api?.close().catch(() => undefined);
    await identity?.close().catch(() => undefined);
    await platform.close();
    throw error;
  }
}
