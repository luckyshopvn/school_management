import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  startTenantTestPlatform,
  type PlatformOperatorRole,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Loại dữ liệu, hồ sơ đồng ý, vùng máy chủ của trường đã tạo ở cổng nền tảng (YCTD-343, CT-1630 đến CT-1634): chuyển sang
// `consented` chỉ khi đủ bốn hồ sơ còn hiệu lực và vùng máy chủ; chính sách môi trường chặn `production`; chỉ quản trị, kỹ thuật
// được thao tác, hỗ trợ và kế toán bị 403. Dữ liệu giả hoàn toàn
const CONSOLE_HOST = 'platform.e2e.localhost';
const HASH = 'a'.repeat(64);

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

function send(context: TenantTestContext, path: string, token?: string, body?: unknown): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${path}`);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: payload ? 'POST' : 'GET',
        headers: {
          host: CONSOLE_HOST,
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: response.statusCode ?? 0, body: text ? JSON.parse(text) : {} });
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

function consent(kind: string, extra: Record<string, unknown> = {}) {
  return {
    kind,
    template_code: 'PL-01',
    template_version: 'v1',
    signer_name: 'Hiệu trưởng giả',
    signer_title: 'Hiệu trưởng',
    signed_on: '2026-01-05',
    valid_from: '2026-01-05',
    valid_until: null,
    data_scope: 'Hồ sơ học sinh (dữ liệu giả)',
    file_sha256: HASH,
    ...extra,
  };
}

const HOSTING = {
  provider: 'Nhà cung cấp giả',
  service: 'Cơ sở dữ liệu',
  region: 'Singapore',
  role: 'subprocessor',
  stores_personal_data: true,
  started_on: '2026-01-05',
};

describe('loại dữ liệu, hồ sơ đồng ý, vùng máy chủ của trường đã tạo', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let code: string;
  const tokens = {} as Record<PlatformOperatorRole, string>;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha'], label: 'dcl' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    context.configuration.platformLifecycle = {
      ingressHost: null,
      domainProvider: 'dns-check',
      deletionGraceDays: 30,
      dataPolicy: 'any',
    };
    code = platform.school('alpha').code;
    for (const role of ['quan_tri', 'ky_thuat', 'ho_tro', 'ke_toan'] as const) {
      const login = `${role.replace('_', '-')}-${Math.random().toString(36).slice(2, 8)}`;
      const operator = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
        login,
        fullName: `Nhân viên ${role} giả`,
        password: OPERATOR_TEST_PASSWORD,
        role,
      });
      const reply = await send(context, '/auth/platform/login', undefined, {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
      });
      assert.equal(reply.status, 200, JSON.stringify(reply.body));
      tokens[role] = reply.body.access_token as string;
    }
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const api = (role: PlatformOperatorRole, path: string, body?: unknown) =>
    send(context, `/auth/platform/schools/${code}${path}`, tokens[role], body);

  it('CT-1630: chi tiết trường trả loại dữ liệu và danh sách còn thiếu để dùng dữ liệu thật', async () => {
    const detail = await api('ho_tro', '');
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data_class, 'synthetic');
    const gaps = detail.body.consent_gaps as string[];
    assert.equal(gaps.length, 5, JSON.stringify(gaps));
    assert.ok(gaps.some((gap) => gap.includes('school_hosting')));
  });

  it('CT-1631: thiếu hồ sơ đồng ý thì không chuyển sang consented; loại không hợp lệ bị từ chối', async () => {
    const missing = await api('quan_tri', '/data-class', { data_class: 'consented' });
    assert.equal(missing.status, 422, JSON.stringify(missing.body));
    const error = missing.body.error as { message: string; details: Array<{ field: string; message: string }> };
    assert.match(error.message, /Chưa đủ hồ sơ đồng ý/);
    assert.ok(error.details.some((detail) => detail.message.includes('dpa')));
    const invalid = await api('quan_tri', '/data-class', { data_class: 'real' });
    assert.equal(invalid.status, 400);
    const badConsent = await api('quan_tri', '/consents', consent('dpa', { file_sha256: 'abc' }));
    assert.equal(badConsent.status, 400);
    const badHosting = await api('ky_thuat', '/hosting', { ...HOSTING, region: '' });
    assert.equal(badHosting.status, 400);
    // Hồ sơ hết hạn không được tính
    await api('quan_tri', '/consents', consent('dpa', { valid_from: '2025-01-01', valid_until: '2025-06-30' }));
    const still = await api('quan_tri', '', undefined);
    assert.ok((still.body.consent_gaps as string[]).some((gap) => gap.includes('dpa')));
    assert.equal((await api('quan_tri', '')).body.data_class, 'synthetic');
  });

  it('CT-1632: hỗ trợ và kế toán bị 403 khi ghi hồ sơ, vùng máy chủ hay đổi loại dữ liệu', async () => {
    for (const role of ['ho_tro', 'ke_toan'] as const) {
      assert.equal((await api(role, '/consents', consent('dpa'))).status, 403, role);
      assert.equal((await api(role, '/hosting', HOSTING)).status, 403, role);
      assert.equal((await api(role, '/data-class', { data_class: 'synthetic' })).status, 403, role);
    }
    const detail = await api('quan_tri', '');
    assert.equal((detail.body.consents as unknown[]).length, 1);
    assert.equal((detail.body.hosting as unknown[]).length, 0);
  });

  it('CT-1633: đủ bốn hồ sơ và vùng máy chủ thì chuyển được sang consented, ghi sự kiện vòng đời', async () => {
    for (const kind of ['dpa', 'consent', 'impact-assessment', 'risk-acceptance']) {
      const reply = await api('quan_tri', '/consents', consent(kind));
      assert.equal(reply.status, 200, JSON.stringify(reply.body));
    }
    const hosted = await api('ky_thuat', '/hosting', HOSTING);
    assert.equal(hosted.status, 200, JSON.stringify(hosted.body));
    assert.deepEqual(hosted.body.consent_gaps, []);
    const changed = await api('ky_thuat', '/data-class', { data_class: 'consented' });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.data_class, 'consented');
    const events = changed.body.events as Array<{ event: string; from_status: string; to_status: string }>;
    assert.ok(
      events.some(
        (event) =>
          event.event === 'data-class-changed' && event.from_status === 'synthetic' && event.to_status === 'consented',
      ),
      JSON.stringify(events),
    );
  });

  it('CT-1634: chính sách môi trường consent-required không nhận loại production', async () => {
    context.configuration.platformLifecycle = {
      ingressHost: null,
      domainProvider: 'dns-check',
      deletionGraceDays: 30,
      dataPolicy: 'consent-required',
    };
    const refused = await api('quan_tri', '/data-class', { data_class: 'production' });
    assert.equal(refused.status, 422, JSON.stringify(refused.body));
    assert.match((refused.body.error as { message: string }).message, /không nhận loại production/);
    assert.equal((await api('quan_tri', '')).body.data_class, 'consented');
    context.configuration.platformLifecycle = {
      ingressHost: null,
      domainProvider: 'dns-check',
      deletionGraceDays: 30,
      dataPolicy: 'any',
    };
    const production = await api('quan_tri', '/data-class', { data_class: 'production' });
    assert.equal(production.status, 200, JSON.stringify(production.body));
    assert.equal(production.body.data_class, 'production');
  });
});
