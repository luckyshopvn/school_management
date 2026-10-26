import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  importSchoolCatalog,
  startTenantTestPlatform,
  type IdentityDatabase,
  type TenancyRuntime,
  type TenantContext,
  type TenantTestPlatform,
} from '@school-management/database';
import { Infrastructure } from '../common/infrastructure.js';
import { createTestUser, startTenantTestApplication, TEST_PASSWORD, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from '../platform/operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from '../platform/platform-operators.js';

// Đăng nhập theo đơn vị ở tên miền chung và quyền vào mọi trường của quản trị nền tảng (DT-24, YCTD-220), kịch bản CT-24-5 đến
// CT-24-8. Danh mục lấy từ tệp mẫu giả; trường, tài khoản là dữ liệu giả
interface Reply {
  status: number;
  body: Record<string, unknown>;
  cookies: string[];
}

const ROOT = 'e2e.localhost';
const CONSOLE_HOST = 'platform.e2e.localhost';

function send(
  context: TenantTestContext,
  options: { method?: string; path: string; host: string; body?: unknown; token?: string },
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method ?? (payload ? 'POST' : 'GET'),
        headers: {
          host: options.host,
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: response.statusCode ?? 0,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
            cookies: response.headers['set-cookie'] ?? [],
          });
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

describe('đăng nhập theo đơn vị và quyền quản trị nền tảng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let alpha: TenantContext;
  let staff: { username: string };
  let operatorToken = '';
  let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'dir' });
    runtime = platform.createRuntime({ PLATFORM_ROOT_DOMAIN: ROOT });
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    const sample = (name: string) =>
      readFile(new URL(`../../../../database/platform/catalog-sample/${name}`, import.meta.url), 'utf8');
    await importSchoolCatalog(platform.platform, {
      unitsCsv: await sample('don_vi_mau.csv'),
      communesCsv: await sample('phuong_xa_mau.csv'),
      source: 'mau',
      actor: { type: 'cli', name: 'Kiểm thử' },
    });
    await platform.platform
      .updateTable('schools')
      .set({ moet_code: '98000301' })
      .where('id', '=', platform.school('alpha').schoolId)
      .execute();
    const resolved = await runtime.registry.resolveHost(platform.school('alpha').host);
    assert.ok(resolved);
    alpha = resolved;
    const identity = runtime.connections.database<IdentityDatabase>(alpha, 'identity', 'identity');
    staff = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    operator = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login: `vh-${platform.suffix}`,
      fullName: 'Quản trị nền tảng giả',
      password: OPERATOR_TEST_PASSWORD,
    });
    const login = await send(context, {
      path: '/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login: `vh-${platform.suffix}`,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
      },
    });
    operatorToken = login.body.access_token as string;
    assert.ok(operatorToken);
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const captchaFor = async (unit: string) => {
    const issued = await send(context, { path: '/auth/directory/captcha', host: ROOT, body: { unit } });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    const id = issued.body.captcha_id as string;
    const redis = context.application.get(Infrastructure).redis;
    const text = await redis.get(`${context.configuration.redisKeyPrefix}:t:${alpha.keyPrefix}:captcha:${id}`);
    assert.ok(text);
    return { captcha_id: id, captcha_text: text };
  };

  it('CT-24-5: chế độ trang đăng nhập theo tên miền; ô chọn chỉ ở tên miền chung, có phân trang và kiểm tra tham số', async () => {
    const directory = await send(context, { path: '/auth/directory/context', host: ROOT });
    assert.equal(directory.body.mode, 'directory');
    assert.equal((directory.body.page as { title: string }).title, 'Hệ thống quản lý trường học');
    const school = await send(context, { path: '/auth/directory/context', host: platform.school('alpha').host });
    assert.equal(school.body.mode, 'school');
    assert.equal((school.body.unit as { department_name: string }).department_name, 'Thành phố Mẫu Nam');
    assert.equal((await send(context, { path: '/auth/directory/context', host: 'la.example.test' })).status, 404);

    assert.equal(
      (await send(context, { path: '/auth/directory/departments', host: platform.school('alpha').host })).status,
      404,
    );
    const departments = await send(context, { path: '/auth/directory/departments', host: ROOT });
    assert.deepEqual(
      (departments.body.items as Array<{ code: string }>).map((item) => item.code),
      ['97', '98'],
    );
    assert.equal((await send(context, { path: '/auth/directory/units', host: ROOT })).status, 400);
    const units = await send(context, { path: '/auth/directory/units?department=97&level=THCS', host: ROOT });
    assert.equal((units.body.items as unknown[]).length, 2);
    assert.ok(!('quality_flags' in ((units.body.items as object[])[0] as object)));
    const paged = await send(context, { path: '/auth/directory/units?department=97&limit=100000', host: ROOT });
    assert.ok((paged.body.items as unknown[]).length <= 50);
    const communes = await send(context, { path: '/auth/directory/communes?department=98&q=nam%20hai', host: ROOT });
    assert.deepEqual(
      (communes.body.items as Array<{ code: string }>).map((item) => item.code),
      ['99102'],
    );
  });

  it('CT-24-6: đơn vị chưa dùng nền tảng báo rõ; đăng nhập đúng trường, chuyển phiên một lần ở tên miền của trường', async () => {
    const unknown = await send(context, { path: '/auth/directory/unit?code=97000201', host: ROOT });
    assert.equal(unknown.body.available, false);
    assert.match(String(unknown.body.message), /chưa sử dụng/);
    const known = await send(context, { path: '/auth/directory/unit?code=98000301', host: ROOT });
    assert.equal(known.body.available, true);
    assert.equal(known.body.login_host, platform.school('alpha').host);

    const notOnPlatform = await send(context, {
      path: '/auth/directory/login',
      host: ROOT,
      body: { unit: '97000201', login: staff.username, password: TEST_PASSWORD },
    });
    assert.equal(notOnPlatform.status, 422);
    const noCaptcha = await send(context, {
      path: '/auth/directory/login',
      host: ROOT,
      body: { unit: '98000301', login: staff.username, password: TEST_PASSWORD },
    });
    assert.equal(noCaptcha.status, 400);
    const wrong = await send(context, {
      path: '/auth/directory/login',
      host: ROOT,
      body: { unit: '98000301', login: staff.username, password: 'SaiMatKhau1', ...(await captchaFor('98000301')) },
    });
    assert.equal(wrong.status, 401);
    const signedIn = await send(context, {
      path: '/auth/directory/login',
      host: ROOT,
      body: { unit: '98000301', login: staff.username, password: TEST_PASSWORD, ...(await captchaFor('98000301')) },
    });
    assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
    assert.equal(signedIn.cookies.length, 0, 'tên miền chung không nhận cookie phiên');
    assert.ok(!('access_token' in signedIn.body));
    const handoff = signedIn.body.handoff as { host: string; path: string };
    assert.equal(handoff.host, platform.school('alpha').host);
    const code = handoff.path.split('#code=')[1] ?? '';
    assert.ok(code.length > 20);

    const otherSchool = await send(context, {
      path: '/auth/handoff/exchange',
      host: platform.school('beta').host,
      body: { code },
    });
    assert.equal(otherSchool.status, 401);
    const exchanged = await send(context, {
      path: '/auth/handoff/exchange',
      host: platform.school('alpha').host,
      body: { code },
    });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    assert.ok(exchanged.body.access_token);
    assert.ok(exchanged.cookies.some((cookie) => cookie.includes('HttpOnly')));
    const me = await send(context, {
      path: '/auth/me',
      host: platform.school('alpha').host,
      token: exchanged.body.access_token as string,
    });
    assert.equal(me.body.username, staff.username);
    const reused = await send(context, {
      path: '/auth/handoff/exchange',
      host: platform.school('alpha').host,
      body: { code },
    });
    assert.equal(reused.status, 401);
  });

  it('CT-24-7: quản trị nền tảng vào trường chưa cho phép: bắt buộc mã xác thực hai lớp, lý do, có hạn, ghi nhật ký', async () => {
    const operatorCall = (method: string, path: string, body?: unknown) =>
      send(context, {
        method,
        path: `/auth/platform/${path}`,
        host: CONSOLE_HOST,
        token: operatorToken,
        ...(body !== undefined ? { body } : {}),
      });
    const policy = await operatorCall('GET', 'support-policy');
    assert.deepEqual(policy.body, { mode: 'any_school', default_hours: 2, max_hours: 8 });
    const withoutOtp = await operatorCall('POST', `schools/${alpha.code}/support-sessions`, {
      reason: 'Kiểm tra số liệu',
    });
    assert.equal(withoutOtp.status, 422);
    const wrongOtp = await operatorCall('POST', `schools/${alpha.code}/support-sessions`, {
      reason: 'Kiểm tra số liệu',
      otp_code: '000000',
    });
    assert.equal(wrongOtp.status, 401);
    const tooLong = await operatorCall('POST', `schools/${alpha.code}/support-sessions`, {
      reason: 'Kiểm tra số liệu',
      hours: 24,
      otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
    });
    assert.equal(tooLong.status, 400);
    const started = await operatorCall('POST', `schools/${alpha.code}/support-sessions`, {
      reason: 'Kiểm tra số liệu',
      scope: 'read',
      otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
    });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    assert.equal(started.body.access_basis, 'platform_policy');
    const hours = (new Date(started.body.expires_at as string).getTime() - context.clock.now().getTime()) / 3_600_000;
    assert.ok(hours > 1.9 && hours <= 2.01);
    const supportCode = new URL((started.body.handoff as { path: string }).path, 'http://x').searchParams.get('code');
    const exchanged = await send(context, {
      path: '/auth/support/exchange',
      host: platform.school('alpha').host,
      body: { code: supportCode },
    });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('school_id', '=', alpha.schoolId)
      .where('action', '=', 'support.platform-access-requested')
      .execute();
    assert.equal(audit.length, 1);
    const identity = runtime.connections.database<IdentityDatabase>(alpha, 'identity', 'identity');
    const schoolLog = await identity
      .selectFrom('identity_audit_logs')
      .select('after_data')
      .where('action', '=', 'support_start')
      .execute();
    assert.ok(schoolLog.some((row) => JSON.stringify(row.after_data).includes('platform_policy')));

    // Bật lại yêu cầu trường đồng ý: phiên đang mở theo chính sách nền tảng kết thúc, mở mới bị từ chối
    const tightened = await operatorCall('PUT', 'support-policy', {
      mode: 'school_grant',
      default_hours: 2,
      max_hours: 8,
      otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
    });
    assert.equal(tightened.status, 200, JSON.stringify(tightened.body));
    const session = await platform.platform
      .selectFrom('support_sessions')
      .select(['ended_at', 'end_reason'])
      .where('id', '=', started.body.session_id as string)
      .executeTakeFirstOrThrow();
    assert.ok(session.ended_at);
    assert.equal(session.end_reason, 'policy-changed');
    const refused = await operatorCall('POST', `schools/${alpha.code}/support-sessions`, {
      reason: 'Kiểm tra số liệu',
      otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
    });
    assert.equal(refused.status, 422);
    await operatorCall('PUT', 'support-policy', {
      mode: 'any_school',
      default_hours: 2,
      max_hours: 8,
      otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
    });
  });

  it('CT-24-8: gắn trường với đơn vị trong danh mục và cấu hình chân trang trang đăng nhập ở cổng nền tảng', async () => {
    const operatorCall = (method: string, path: string, body?: unknown) =>
      send(context, {
        method,
        path: `/auth/platform/${path}`,
        host: CONSOLE_HOST,
        token: operatorToken,
        ...(body !== undefined ? { body } : {}),
      });
    const taken = await operatorCall('PUT', `schools/${platform.school('beta').code}/catalog-unit`, {
      moet_code: '98000301',
    });
    assert.equal(taken.status, 400);
    const linked = await operatorCall('PUT', `schools/${platform.school('beta').code}/catalog-unit`, {
      moet_code: '98000302',
    });
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    const overview = await operatorCall('GET', 'catalog');
    assert.equal(overview.body.units, 12);
    assert.equal(overview.body.linked_schools, 2);
    const search = await operatorCall('GET', 'catalog/units?department=98');
    assert.ok(
      (search.body.items as Array<{ school_code: string | null }>).some(
        (item) => item.school_code === platform.school('beta').code,
      ),
    );
    const page = await operatorCall('PUT', 'login-page', {
      title: 'Nền tảng thử nghiệm',
      subtitle: 'Đăng nhập hệ thống',
      support_lines: ['Hỗ trợ: 1900 0000 (số giả)'],
    });
    assert.equal(page.status, 200);
    const context2 = await send(context, { path: '/auth/directory/context', host: ROOT });
    assert.deepEqual((context2.body.page as { support_lines: string[] }).support_lines, ['Hỗ trợ: 1900 0000 (số giả)']);
    assert.equal(
      (await send(context, { method: 'GET', path: '/auth/platform/catalog', host: ROOT, token: operatorToken })).status,
      404,
    );
  });
});
