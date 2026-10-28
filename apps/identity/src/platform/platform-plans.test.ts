import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenancyRuntime, type TenantTestPlatform } from '@school-management/database';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Gói dịch vụ ở cổng vận hành nền tảng (DT-SaaS phần S5a, YCTD-194), kịch bản CT-S5a-7: lập, sửa gói; gán gói cho trường có ngày
// hiệu lực; đặt hạn, chuyển trạng thái theo hạn; chỉ ở tên miền cổng với mã phiên vận hành. Dữ liệu giả
interface Reply {
  status: number;
  body: unknown;
}

const CONSOLE_HOST = 'platform.e2e.localhost';

function send(
  context: TenantTestContext,
  options: { method?: string; path: string; host?: string; body?: unknown; token?: string },
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
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

describe('gói dịch vụ ở cổng vận hành nền tảng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let token = '';
  const login = `goi-${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'plan' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login,
      fullName: 'Người vận hành giả',
      password: OPERATOR_TEST_PASSWORD,
    });
    const reply = await send(context, {
      path: '/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, created.id, created.secret, context.clock.now()),
      },
    });
    token = (reply.body as { access_token: string }).access_token;
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const operator = (method: string, path: string, body?: unknown, host = CONSOLE_HOST, withToken = true) =>
    send(context, {
      method,
      path: `/auth/platform/${path}`,
      host,
      ...(body !== undefined ? { body } : {}),
      ...(withToken ? { token } : {}),
    });

  it('CT-S5a-7: lập, sửa gói; gán gói có ngày hiệu lực; đặt hạn; chạy chuyển trạng thái; ngoài cổng hoặc không mã phiên bị từ chối', async () => {
    assert.equal((await operator('GET', 'plans', undefined, platform.school('alpha').host)).status, 404);
    assert.equal((await operator('GET', 'plans', undefined, CONSOLE_HOST, false)).status, 401);

    const modules = await operator('GET', 'plan-modules');
    assert.equal(modules.status, 200);
    assert.ok((modules.body as Array<{ key: string }>).some((module) => module.key === 'learning-resources'));
    const initial = (await operator('GET', 'plans')).body as Array<{ id: string; code: string; modules: unknown }>;
    // Gói mặc định mọi phân hệ và gói cơ bản miễn phí của trường tự khởi tạo (YCTD-314)
    assert.deepEqual(initial.find((plan) => plan.code === 'full')?.modules, null, 'gói mặc định mọi phân hệ');
    const free = initial.find((plan) => plan.code === 'co-ban-mien-phi')?.modules as string[] | undefined;
    assert.ok(free?.includes('documents') && !free.includes('ai-assistant'), 'gói cơ bản miễn phí');

    const bad = await operator('POST', 'plans', {
      code: 'Sai Ma',
      name: '',
      modules: ['khong-co'],
      max_school_levels: 9,
    });
    assert.equal(bad.status, 400);
    const basic = await operator('POST', 'plans', {
      code: 'co-ban',
      name: 'Cơ bản',
      modules: ['education', 'finance'],
      max_active_students: 300,
      max_storage_mb: 2048,
      max_school_levels: 1,
      trial_days: 30,
      pricing_mode: 'per_student',
      unit_price: 15000,
      minimum_fee: 500000,
    });
    assert.equal(basic.status, 201, JSON.stringify(basic.body));
    const basicPlan = basic.body as { id: string; unit_price: number; modules: string[] };
    assert.equal(basicPlan.unit_price, 15000);
    assert.deepEqual(basicPlan.modules, ['education', 'finance']);
    assert.equal((await operator('POST', 'plans', { code: 'co-ban', name: 'Trùng' })).status, 409);
    const edited = await operator('PUT', `plans/${basicPlan.id}`, {
      code: 'co-ban',
      name: 'Cơ bản',
      modules: ['education', 'finance', 'library'],
      pricing_mode: 'per_module',
      module_prices: { library: 100000 },
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));

    const schools = (await operator('GET', 'plan-schools')).body as Array<{ id: string; code: string; plan: unknown }>;
    const alpha = schools.find((school) => school.code === platform.school('alpha').code);
    assert.ok(alpha);
    assert.equal(alpha.plan, null);
    const assigned = await operator('PUT', `plan-schools/${alpha.id}`, {
      plan_id: basicPlan.id,
      effective_from: '2026-01-01',
      trial_ends_on: '2020-01-01',
      status: 'trial',
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    assert.equal((assigned.body as { plan: { code: string } }).plan.code, 'co-ban');
    const tenant = await runtime.registry.loadSchool(alpha.id);
    assert.equal(tenant?.context.plan?.code, 'co-ban');
    assert.deepEqual(tenant?.context.plan?.modules, ['education', 'finance', 'library']);
    assert.equal(tenant?.context.trialEndsOn, '2020-01-01');
    // Gán gói khác từ ngày sau: bản trước kết thúc ở ngày đó, lịch sử giữ
    await operator('PUT', `plan-schools/${alpha.id}`, {
      plan_id: initial[0]?.id,
      effective_from: '2099-01-01',
    });
    const history = await platform.platform
      .selectFrom('school_plans')
      .select(['effective_from', 'effective_to'])
      .where('school_id', '=', alpha.id)
      .orderBy('effective_from')
      .execute();
    assert.equal(history.length, 2);
    assert.equal(String(history[0]?.effective_to).length > 0, true);
    assert.equal((await operator('PUT', 'plan-schools/khong-phai-ma', {})).status, 404);
    assert.equal((await operator('PUT', `plan-schools/${alpha.id}`, { status: 'xoa' })).status, 400);

    // Hạn dùng thử đã qua lâu: chạy chuyển trạng thái thì tạm ngưng; chạy lại không đổi thêm
    const run = await operator('POST', 'plan-lifecycle');
    assert.equal(run.status, 200, JSON.stringify(run.body));
    const changes = (run.body as { changes: Array<{ code: string; to: string }> }).changes;
    assert.deepEqual(
      changes.map((change) => [change.code, change.to]),
      [[platform.school('alpha').code, 'suspended']],
    );
    assert.deepEqual((await operator('POST', 'plan-lifecycle')).body, { changes: [], reminders: [] });
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('school_id', '=', alpha.id)
      .execute();
    assert.ok(audit.some((row) => row.action === 'school.plan-status'));
    assert.ok(audit.some((row) => row.action === 'school.plan-update'));
  });
});
