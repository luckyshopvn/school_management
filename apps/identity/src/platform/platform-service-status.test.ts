import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenantTestPlatform } from '@school-management/database';
import { API_STATUS_KEY, WORKER_HEARTBEAT_KEY, type ApiStatusRecord } from '@school-management/server/service-status';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';
import { collectServiceStatus, type ServiceStatusProbes, type ServiceStatusReply } from './platform-service-status.js';

// Khối "Tình trạng dịch vụ" của trang Bảo trì (YCTD-376), kịch bản CT-376-4 đến CT-376-6. Dữ liệu giả
const NOW = new Date('2030-01-02T03:04:05.000Z');

function probes(values: Record<string, string>, overrides: Partial<ServiceStatusProbes> = {}): ServiceStatusProbes {
  return {
    now: NOW,
    checkDatabase: async () => undefined,
    checkApiHealth: async () => undefined,
    store: {
      get: async (key) => values[key] ?? null,
      ping: async () => 'PONG',
      llen: async () => 2,
    },
    ...overrides,
  };
}

function item(reply: ServiceStatusReply, key: string) {
  const found = reply.items.find((entry) => entry.key === key);
  assert.ok(found, key);
  return found;
}

const record: ApiStatusRecord = {
  checked_at: '2030-01-02T03:03:30.000Z',
  database: { ok: true, milliseconds: 12 },
  storage: { ok: true, milliseconds: 1500 },
};

describe('tình trạng dịch vụ: thu thập', () => {
  it('CT-376-4: đủ tín hiệu thì Hoạt động; lưu trữ quá 1 giây là Chậm; tiến trình nền quá 90 giây là Lỗi', async () => {
    const healthy = await collectServiceStatus(
      probes({ [WORKER_HEARTBEAT_KEY]: '2030-01-02T03:03:50.000Z', [API_STATUS_KEY]: JSON.stringify(record) }),
    );
    assert.deepEqual(
      healthy.items.map((entry) => [entry.key, entry.state]),
      [
        ['identity', 'ok'],
        ['api', 'ok'],
        ['worker', 'ok'],
        ['storage', 'slow'],
        ['queue', 'ok'],
      ],
    );
    assert.match(item(healthy, 'queue').detail, /^2 việc/);
    assert.equal(healthy.slow_milliseconds, 1000);

    const stale = await collectServiceStatus(probes({ [WORKER_HEARTBEAT_KEY]: '2030-01-02T03:02:00.000Z' }));
    assert.equal(item(stale, 'worker').state, 'error');
    assert.equal(item(stale, 'worker').observed_at, '2030-01-02T03:02:00.000Z');
    assert.equal(item(stale, 'storage').state, 'unknown');
  });

  it('CT-376-5: Redis không phản hồi, máy chủ API không phản hồi, cơ sở dữ liệu lỗi: không ném lỗi, không lộ nội dung lỗi', async () => {
    const reply = await collectServiceStatus(
      probes(
        {},
        {
          checkDatabase: async () => {
            throw new Error('password authentication failed');
          },
          checkApiHealth: async () => {
            throw new Error('The operation was aborted due to timeout');
          },
          store: {
            get: async () => null,
            ping: async () => {
              throw new Error('connect ECONNREFUSED 10.0.0.5:6379');
            },
            llen: async () => 0,
          },
        },
      ),
    );
    assert.equal(item(reply, 'identity').state, 'error');
    assert.equal(item(reply, 'api').state, 'error');
    assert.match(item(reply, 'api').detail, /Không phản hồi trong 3 giây/);
    for (const key of ['worker', 'storage', 'queue']) {
      assert.equal(item(reply, key).state, 'unknown', key);
    }
    const text = JSON.stringify(reply);
    assert.ok(!text.includes('password') && !text.includes('ECONNREFUSED') && !text.includes('10.0.0.5'), text);
  });
});

describe('tình trạng dịch vụ: quyền', () => {
  let platform: TenantTestPlatform;
  let context: TenantTestContext;
  const CONSOLE_HOST = 'platform.ttdv.e2e.localhost';
  const tokens: Record<string, string> = {};

  function get(path: string, token?: string): Promise<{ status: number; text: string }> {
    const url = new URL(`${context.origin}/api/v1${path}`);
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'GET',
          headers: { host: CONSOLE_HOST, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }),
          );
        },
      );
      request.on('error', reject);
      request.end();
    });
  }

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha'], label: 'ttdv' });
    context = await startTenantTestApplication(platform.createRuntime());
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    for (const role of ['quan_tri', 'ho_tro', 'ky_thuat', 'ke_toan'] as const) {
      const login = `${role}-${platform.suffix}`;
      const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
        login,
        fullName: `Vận hành giả ${role}`,
        password: OPERATOR_TEST_PASSWORD,
        role,
      });
      const body = JSON.stringify({
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, created.id, created.secret, context.clock.now()),
      });
      const reply = await new Promise<string>((resolve, reject) => {
        const url = new URL(`${context.origin}/api/v1/auth/platform/login`);
        const request = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: { host: CONSOLE_HOST, 'content-type': 'application/json' },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          },
        );
        request.on('error', reject);
        request.end(body);
      });
      tokens[role] = (JSON.parse(reply) as { access_token: string }).access_token;
      assert.ok(tokens[role], reply);
    }
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  it('CT-376-6: bốn vai trò có maintenance.view đọc được năm mục; không có mã phiên thì 401', async () => {
    for (const role of ['quan_tri', 'ho_tro', 'ky_thuat', 'ke_toan']) {
      const reply = await get('/auth/platform/service-status', tokens[role]);
      assert.equal(reply.status, 200, `${role}: ${reply.text}`);
      const body = JSON.parse(reply.text) as ServiceStatusReply;
      assert.deepEqual(
        body.items.map((entry) => entry.key),
        ['identity', 'api', 'worker', 'storage', 'queue'],
      );
    }
    assert.equal((await get('/auth/platform/service-status')).status, 401);
  });
});
