import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, writeAudit, type TenantTestPlatform } from '@school-management/database';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Nhật ký truy cập và số liệu tổng quan của cổng vận hành (YCTD-324), kịch bản CT-324-1, CT-324-2. Dữ liệu giả
interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

const CONSOLE_HOST = 'platform.nk.e2e.localhost';

function send(context: TenantTestContext, path: string, token?: string): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${path}`);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { host: CONSOLE_HOST, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end();
  });
}

describe('nhật ký truy cập của cổng vận hành', () => {
  let platform: TenantTestPlatform;
  let context: TenantTestContext;
  const tokens = { admin: '', accountant: '' };
  let adminId = '';

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'nk' });
    context = await startTenantTestApplication(platform.createRuntime());
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    for (const [who, role] of [
      ['admin', 'quan_tri'],
      ['accountant', 'ke_toan'],
    ] as const) {
      const login = `${who}-${platform.suffix}`;
      const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
        login,
        fullName: `Vận hành giả ${who}`,
        password: OPERATOR_TEST_PASSWORD,
        role,
      });
      if (who === 'admin') {
        adminId = created.id;
      }
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
      tokens[who] = (JSON.parse(reply) as { access_token: string }).access_token;
      assert.ok(tokens[who], reply);
    }
    const alpha = platform.school('alpha').schoolId;
    const beta = platform.school('beta').schoolId;
    await writeAudit(platform.platform, {
      actorType: 'operator',
      actorId: adminId,
      action: 'support.platform-admin-entry',
      schoolId: alpha,
      details: { reason: 'Quản trị nền tảng vào trường', scope: 'full', ip: '127.0.0.1' },
    });
    await writeAudit(platform.platform, {
      actorType: 'operator',
      actorId: adminId,
      action: 'school.addon-modules-changed',
      schoolId: beta,
      details: { before: [], after: ['ai-assistant'] },
    });
    await writeAudit(platform.platform, {
      actorType: 'system',
      action: 'school.catalog-provision-requested',
      schoolId: beta,
      details: { code: 'beta', reason: '=1+1' },
    });
    await platform.platform
      .updateTable('schools')
      .set({ addon_modules: JSON.stringify(['ai-assistant']) })
      .where('id', '=', beta)
      .execute();
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  it('CT-324-1: lọc theo nhóm việc, trường; xuất CSV đúng bộ lọc, chặn công thức; vai trò không có quyền thì 403', async () => {
    const all = await send(context, '/auth/platform/audit-log', tokens.admin);
    assert.equal(all.status, 200, all.text);
    const allBody = JSON.parse(all.text) as { items: Array<{ action: string; actor: string; label: string }> };
    assert.ok(allBody.items.length >= 3);
    const entries = JSON.parse((await send(context, '/auth/platform/audit-log?group=entry', tokens.admin)).text) as {
      items: Array<{ action: string; actor: string; school_code: string; ip: string }>;
    };
    assert.deepEqual(
      entries.items.map((item) => item.action),
      ['support.platform-admin-entry'],
    );
    assert.equal(entries.items[0]?.actor, 'Vận hành giả admin');
    assert.equal(entries.items[0]?.school_code, platform.school('alpha').code);
    assert.equal(entries.items[0]?.ip, '127.0.0.1');
    const beta = JSON.parse(
      (await send(context, `/auth/platform/audit-log?school=${platform.school('beta').code}`, tokens.admin)).text,
    ) as { items: Array<{ action: string; actor: string }> };
    assert.deepEqual(beta.items.map((item) => item.action).sort(), [
      'school.addon-modules-changed',
      'school.catalog-provision-requested',
      'school.provision',
    ]);
    assert.ok(beta.items.some((item) => item.actor === 'Hệ thống'));
    assert.equal((await send(context, '/auth/platform/audit-log?group=khong-co', tokens.admin)).status, 400);
    assert.equal((await send(context, '/auth/platform/audit-log?from=29/10/2026', tokens.admin)).status, 400);
    const csv = await send(
      context,
      `/auth/platform/audit-log?school=${platform.school('beta').code}&format=csv`,
      tokens.admin,
    );
    assert.equal(csv.status, 200);
    assert.match(String(csv.headers['content-type']), /text\/csv/);
    assert.equal(csv.text.charCodeAt(0), 0xfeff);
    assert.match(csv.text, /Thời điểm,Việc,Người làm/);
    assert.match(csv.text, /'=1\+1/);
    assert.equal((await send(context, '/auth/platform/audit-log', tokens.accountant)).status, 403);
    assert.equal((await send(context, '/auth/platform/audit-log')).status, 401);
  });

  it('CT-324-2: số liệu tổng quan lấy từ dữ liệu thật', async () => {
    const reply = await send(context, '/auth/platform/overview', tokens.accountant);
    assert.equal(reply.status, 200, reply.text);
    const body = JSON.parse(reply.text) as {
      schools_total: number;
      schools_with_addons: number;
      admin_entries_7d: number;
      recent_schools: Array<{ code: string }>;
    };
    assert.equal(body.schools_total, 2);
    assert.equal(body.schools_with_addons, 1);
    assert.equal(body.admin_entries_7d, 1);
    assert.equal(body.recent_schools.length, 2);
    // Kế toán không xem nhật ký nên không có truy cập gần đây
    assert.deepEqual((body as unknown as { recent_activity: unknown[] }).recent_activity, []);
    const admin = JSON.parse((await send(context, '/auth/platform/overview', tokens.admin)).text) as {
      recent_activity: unknown[];
    };
    assert.ok(admin.recent_activity.length >= 3);
  });
});
