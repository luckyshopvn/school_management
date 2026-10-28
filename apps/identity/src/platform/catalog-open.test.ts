import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  dropSchool,
  importSchoolCatalog,
  startTenantTestPlatform,
  type IdentityDatabase,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import { OrganizationDirectory } from '../accounts/organization-directory.js';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { CatalogProvisioningService } from './catalog-provisioning.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Mở mọi trường trong danh mục, quản trị nền tảng vào thẳng, tính năng trả phí bật riêng (YCTD-314), kịch bản CT-314-4 đến
// CT-314-7. Danh mục lấy từ tệp mẫu giả (mã 98000201, 98000202 riêng cho tệp này: tên cơ sở dữ liệu suy ra từ mã Bộ); dữ liệu giả
interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const ROOT = 'mo.e2e.localhost';
const CONSOLE_HOST = 'platform.mo.e2e.localhost';
const DEFAULT_PASSWORD = 'MacDinhGia2026';

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

describe('mở mọi trường trong danh mục và quản trị nền tảng vào thẳng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let provisioning: CatalogProvisioningService;
  const tokens = { admin: '', engineer: '', accountant: '' };

  const operator = (who: keyof typeof tokens, method: string, path: string, body?: unknown) =>
    send(context, {
      method,
      path: `/auth/platform/${path}`,
      host: CONSOLE_HOST,
      token: tokens[who],
      ...(body !== undefined ? { body } : {}),
    });

  before(async () => {
    platform = await startTenantTestPlatform({ schools: [], label: 'mo' });
    runtime = platform.createRuntime({ PLATFORM_ROOT_DOMAIN: ROOT });
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    context.configuration.defaultInitialPassword = DEFAULT_PASSWORD;
    provisioning = context.application.get(CatalogProvisioningService);
    // Cây đơn vị do máy chủ API trả; kiểm thử này không chạy máy chủ API, trường mới chưa có đơn vị con
    context.application.get(OrganizationDirectory).listUnits = () => Promise.resolve([]);
    const sample = (name: string) =>
      readFile(new URL(`../../../../database/platform/catalog-sample/${name}`, import.meta.url), 'utf8');
    await importSchoolCatalog(platform.platform, {
      unitsCsv: await sample('don_vi_mau.csv'),
      communesCsv: await sample('phuong_xa_mau.csv'),
      source: 'mau',
      actor: { type: 'cli', name: 'Kiểm thử' },
    });
    for (const [who, role] of [
      ['admin', 'quan_tri'],
      ['engineer', 'ky_thuat'],
      ['accountant', 'ke_toan'],
    ] as const) {
      const login = `${who}-${platform.suffix}`;
      const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
        login,
        fullName: `Vận hành giả ${who}`,
        password: OPERATOR_TEST_PASSWORD,
        role,
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
      tokens[who] = reply.body.access_token as string;
      assert.ok(tokens[who], JSON.stringify(reply.body));
    }
  });

  after(async () => {
    await provisioning?.settle();
    await context?.close();
    if (platform) {
      const schools = await platform.platform.selectFrom('schools').select('id').execute();
      for (const school of schools) {
        await dropSchool({
          platform: platform.platform,
          masterKey: platform.masterKey,
          layout: platform.layout,
          schoolId: school.id,
        }).catch(() => undefined);
      }
      await platform.close();
    }
  });

  it('CT-314-4: trang đăng nhập: đơn vị chưa có trường khởi tạo ở lần chọn đầu tiên (hai lần cùng lúc chỉ một trường), rồi đăng nhập được', async () => {
    const before = await send(context, { path: '/auth/directory/unit?code=98000201', host: ROOT });
    assert.equal(before.body.state, 'not_provisioned');
    assert.equal(before.body.message, null);
    // Ngoài tên miền chung: 404; mã không có trong danh mục: 404
    assert.equal(
      (await send(context, { path: '/auth/directory/prepare', host: CONSOLE_HOST, body: { unit: '98000201' } })).status,
      404,
    );
    assert.equal(
      (await send(context, { path: '/auth/directory/prepare', host: ROOT, body: { unit: '00000000' } })).status,
      404,
    );
    const [first, second] = await Promise.all([
      send(context, { path: '/auth/directory/prepare', host: ROOT, body: { unit: '98000201' } }),
      send(context, { path: '/auth/directory/prepare', host: ROOT, body: { unit: '98000201' } }),
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(first.body.state, 'provisioning');
    // Đang khởi tạo: đăng nhập báo chờ, không báo "chưa sử dụng"
    const early = await send(context, {
      path: '/auth/directory/login',
      host: ROOT,
      body: { unit: '98000201', login: 'ai-do', password: 'SaiMatKhau1' },
    });
    if (early.status === 422) {
      assert.doesNotMatch(JSON.stringify(early.body), /chưa sử dụng/);
    }
    await provisioning.settle();
    const schools = await platform.platform
      .selectFrom('schools')
      .select('code')
      .where('moet_code', '=', '98000201')
      .execute();
    assert.deepEqual(schools, [{ code: 'dv-98000201' }]);
    const ready = await send(context, { path: '/auth/directory/unit?code=98000201', host: ROOT });
    assert.equal(ready.body.state, 'ready');
    assert.equal(ready.body.available, true);
    assert.equal(ready.body.login_host, `dv-98000201.${ROOT}`);
    const captcha = await send(context, { path: '/auth/directory/captcha', host: ROOT, body: { unit: '98000201' } });
    assert.equal(captcha.status, 200, JSON.stringify(captcha.body));
    // Trường mới chưa có tài khoản nào: đăng nhập sai như mọi tài khoản không có
    const wrong = await send(context, {
      path: '/auth/directory/login',
      host: ROOT,
      body: { unit: '98000201', login: 'khong-co', password: 'SaiMatKhau1', captcha_id: captcha.body.captcha_id },
    });
    assert.ok([400, 401].includes(wrong.status), JSON.stringify(wrong.body));
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select(['action', 'actor_type'])
      .where('action', '=', 'school.catalog-provision-requested')
      .execute();
    assert.deepEqual(audit, [{ action: 'school.catalog-provision-requested', actor_type: 'system' }]);
  });

  it('CT-314-5: Admin mở đơn vị mới ở cổng vận hành: khởi tạo rồi vào thẳng, không hỏi mục đích, mã hai lớp, số giờ; nhật ký hai phía', async () => {
    const opening = await operator('admin', 'POST', 'catalog/units/98000202/open', {});
    assert.equal(opening.status, 200, JSON.stringify(opening.body));
    assert.equal(opening.body.state, 'provisioning');
    assert.equal(opening.body.session, null);
    // Vai trò khác không dùng điểm cuối vào thẳng
    assert.equal((await operator('engineer', 'POST', 'catalog/units/98000202/open', {})).status, 403);
    await provisioning.settle();
    const opened = await operator('admin', 'POST', 'catalog/units/98000202/open', {});
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.state, 'ready');
    assert.equal(opened.body.school_code, 'dv-98000202');
    const session = opened.body.session as {
      session_id: string;
      scope: string;
      access_basis: string;
      expires_at: string;
      handoff: { host: string; path: string };
    };
    assert.equal(session.scope, 'full');
    assert.equal(session.access_basis, 'platform_policy');
    assert.equal(session.handoff.host, `dv-98000202.${ROOT}`);
    // Không giới hạn theo giờ (hạn kỹ thuật 30 ngày), không còn trần 8 giờ
    const days = (new Date(session.expires_at).getTime() - context.clock.now().getTime()) / 86_400_000;
    assert.ok(days > 29.9 && days <= 30.01, String(days));

    // Ở trang chi tiết trường: một nút, không cần lý do, mã hai lớp
    const overview = await operator('admin', 'GET', 'schools/dv-98000202/support');
    assert.equal(overview.body.direct_entry, true);
    const again = await operator('admin', 'POST', 'schools/dv-98000202/support-sessions', {});
    assert.equal(again.status, 200, JSON.stringify(again.body));
    // Nhân viên kỹ thuật vẫn phải nhập lại mã hai lớp
    assert.equal((await operator('engineer', 'GET', 'schools/dv-98000202/support')).body.direct_entry, false);
    const engineer = await operator('engineer', 'POST', 'schools/dv-98000202/support-sessions', { reason: 'Kiểm tra' });
    assert.equal(engineer.status, 422);

    const code = new URL(session.handoff.path, 'http://x').searchParams.get('code');
    const host = session.handoff.host;
    const exchanged = await send(context, { path: '/auth/support/exchange', host, body: { code } });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    assert.equal(exchanged.body.support_scope, 'full');

    const platformLog = await platform.platform
      .selectFrom('platform_audit_log')
      .innerJoin('schools', 'schools.id', 'platform_audit_log.school_id')
      .select(['platform_audit_log.action', 'platform_audit_log.actor_id', 'platform_audit_log.details'])
      .where('schools.code', '=', 'dv-98000202')
      .where('platform_audit_log.action', 'in', ['support.platform-admin-entry', 'support.session-started'])
      .execute();
    const entries = platformLog.filter((row) => row.action === 'support.platform-admin-entry');
    assert.equal(entries.length, 2);
    assert.ok(entries.every((row) => (row.details as { direct_entry?: boolean }).direct_entry === true));
    assert.ok(platformLog.some((row) => row.action === 'support.session-started'));
    const tenant = await runtime.registry.resolveHost(host);
    assert.ok(tenant);
    const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    const schoolLog = await identity
      .selectFrom('identity_audit_logs')
      .select('after_data')
      .where('action', '=', 'support_start')
      .execute();
    assert.equal(schoolLog.length, 1);
    assert.match(JSON.stringify(schoolLog[0]?.after_data), /platform_policy/);
    assert.match(JSON.stringify(schoolLog[0]?.after_data), /Quản trị nền tảng vào trường/);

    // Admin tạo tài khoản quản trị đầu tiên của trường theo quy tắc YCTD-311 (tên đăng nhập là số CCCD, mật khẩu mặc định, bắt đổi)
    const nationalId = `001085${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
    // Tài khoản quản trị trường luôn đủ số CCCD, họ tên, số điện thoại
    const missing = await send(context, {
      path: '/users',
      host,
      token: exchanged.body.access_token as string,
      body: {
        username: 'hieu-truong',
        full_name: 'Hiệu trưởng giả',
        roles: [{ role_code: 'VT-02', org_unit_id: null }],
      },
    });
    assert.equal(missing.status, 400, JSON.stringify(missing.body));
    const fields = ((missing.body.error as { details: Array<{ field: string }> }).details ?? []).map(
      (item) => item.field,
    );
    assert.ok(fields.includes('national_id') && fields.includes('phone'), JSON.stringify(fields));
    const created = await send(context, {
      path: '/users',
      host,
      token: exchanged.body.access_token as string,
      body: {
        full_name: 'Hiệu trưởng giả',
        national_id: nationalId,
        phone: '0900000314',
        roles: [{ role_code: 'VT-02', org_unit_id: null }],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((created.body.account as { username: string }).username, nationalId);
    const firstLogin = await send(context, {
      path: '/auth/login',
      host,
      body: { login: nationalId, password: DEFAULT_PASSWORD, channel: 'portal' },
    });
    assert.equal(firstLogin.status, 200, JSON.stringify(firstLogin.body));
    assert.equal(firstLogin.body.password_change_required, true);
  });

  it('CT-314-6: tính năng trả phí bật riêng cho trường: quản trị, kế toán bật được, vai trò khác không; mã sai bị từ chối', async () => {
    const detail = await operator('admin', 'GET', 'schools/dv-98000201');
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal((detail.body.plan as { code: string }).code, 'co-ban-mien-phi');
    assert.deepEqual(detail.body.addon_modules, []);
    assert.ok((detail.body.paid_modules as Array<{ key: string }>).some((module) => module.key === 'ai-assistant'));
    assert.equal(
      (await operator('engineer', 'PUT', 'schools/dv-98000201/addon-modules', { modules: ['ai-assistant'] })).status,
      403,
    );
    assert.equal(
      (await operator('admin', 'PUT', 'schools/dv-98000201/addon-modules', { modules: ['khong-co'] })).status,
      400,
    );
    const saved = await operator('accountant', 'PUT', 'schools/dv-98000201/addon-modules', {
      modules: ['online-exam', 'ai-assistant'],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.addon_modules, ['ai-assistant', 'online-exam']);
    const tenant = await runtime.registry.resolveHost(`dv-98000201.${ROOT}`);
    assert.ok(tenant?.plan?.modules?.includes('ai-assistant'));
    assert.ok(!tenant?.plan?.modules?.includes('tutoring'));
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select('details')
      .where('action', '=', 'school.addon-modules-changed')
      .execute();
    assert.equal(audit.length, 1);
  });
});
