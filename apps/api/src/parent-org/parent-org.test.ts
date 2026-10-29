import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  createPlatformOperatorWithTotp,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
  totpCode,
} from '@school-management/identity/testing';
import { runAsSchool } from '@school-management/server';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { ParentOrgExportsService } from './parent-org-exports.js';
import { AggregateSnapshotService } from './parent-org.js';

// Đơn vị cấp trên ở máy chủ API (DT-SaaS phần S6, YCTD-202), kịch bản CT-S6-6 đến CT-S6-8: bản chụp tổng hợp chạy ở cả hai bố cục;
// cấp trên chỉ thấy trường đã đồng ý cho cấp mình, trong cây con; xuất Excel, PDF; trường duyệt, rút đề nghị xem chi tiết. Hai
// trường giả, cây đơn vị giả. CT-367-1, CT-367-2 (YCTD-367): xuất báo cáo chạy nền; cấp trên rút đề nghị
const CONSOLE_HOST = 'platform.e2e.localhost';

let exportOrigin = '';
let exportToken = '';

// Tải tệp xuất ở tên miền cổng nền tảng (fetch không cho đặt tiêu đề Host)
function download(path: string): Promise<{ status: number; type: string }> {
  const url = new URL(`${exportOrigin}${path}`);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: { host: CONSOLE_HOST, authorization: `Bearer ${exportToken}` },
      },
      (response) => {
        response.resume();
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, type: String(response.headers['content-type'] ?? '') }),
        );
      },
    );
    request.on('error', reject);
    request.end();
  });
}

for (const layout of ['database', 'schema'] as const) {
  describe(`đơn vị cấp trên ở máy chủ API, bố cục ${layout}`, () => {
    let environment: MultiTenantApi;
    let operatorToken = '';
    let parentToken = '';
    const units: Record<string, string> = {};

    const identity = (method: string, path: string, body?: unknown, token?: string) =>
      sendWithHost(environment.identityOrigin, {
        method,
        path: `/api/v1${path}`,
        host: CONSOLE_HOST,
        ...(token ? { token } : {}),
        ...(body !== undefined ? { body } : {}),
      });
    const parentOrgApi = (path: string, token = parentToken) =>
      sendWithHost(environment.apiOrigin, { path: `/api/v1/parent-org${path}`, host: CONSOLE_HOST, token });

    before(async () => {
      environment = await startMultiTenantApi({
        label: `porg${layout.slice(0, 1)}`,
        layout,
        configuration: { platformConsoleHost: CONSOLE_HOST, parentOrgExportIntervalSeconds: 0 },
      });
      // Năm học đang dùng của hai trường (bản chụp đọc năm học đang dùng)
      for (const name of ['alpha', 'beta']) {
        const created = await environment.call(name, 'POST', '/academic-years', { name: '2026–2027' });
        const id = created.body.id as string;
        await environment.call(name, 'PUT', `/academic-years/${id}/calendar`, {
          first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
          second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
        });
        const opened = await environment.call(name, 'POST', `/academic-years/${id}/open`);
        assert.equal(opened.status, 200, JSON.stringify(opened.body));
      }
      environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
      const login = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;
      const created = await createPlatformOperatorWithTotp(
        environment.platform.platform,
        environment.platform.masterKey,
        {
          login,
          fullName: 'Người vận hành giả',
          password: OPERATOR_TEST_PASSWORD,
        },
      );
      const reply = await identity('POST', '/auth/platform/login', {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(
          environment.platform.platform,
          created.id,
          created.secret,
          environment.identity.clock.now(),
        ),
      });
      operatorToken = reply.body.access_token as string;
      const unit = async (key: string, level: string, parent?: string) => {
        const result = await identity(
          'POST',
          '/auth/platform/admin-units',
          { level, code: key, name: `Đơn vị ${key}`, ...(parent ? { parent_id: units[parent] } : {}) },
          operatorToken,
        );
        units[key] = result.body.id as string;
      };
      await unit('bo-gia', 'ministry');
      await unit('so-gia', 'department', 'bo-gia');
      await unit('so-khac', 'department', 'bo-gia');
      await unit('phong-a', 'commune', 'so-gia');
      await unit('phong-b', 'commune', 'so-gia');
      for (const [school, key] of [
        ['alpha', 'phong-a'],
        ['beta', 'phong-b'],
      ] as const) {
        await identity(
          'PUT',
          `/auth/platform/schools/${environment.platform.school(school).code}/admin-unit`,
          { admin_unit_id: units[key] },
          operatorToken,
        );
      }
      const user = await identity(
        'POST',
        '/auth/platform/parent-org-users',
        {
          login: `so-gia-${layout}`,
          full_name: 'Chuyên viên Sở giả',
          password: OPERATOR_TEST_PASSWORD,
          admin_unit_id: units['so-gia'],
        },
        operatorToken,
      );
      const secret = (user.body.totp as { secret: string }).secret;
      const loggedIn = await identity('POST', '/auth/parent-org/login', {
        login: `so-gia-${layout}`,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: totpCode(secret, environment.identity.clock.now()),
      });
      parentToken = loggedIn.body.access_token as string;
      exportOrigin = environment.apiOrigin;
      exportToken = parentToken;
    });

    after(async () => {
      await environment?.close();
    });

    it('CT-S6-6: bản chụp tổng hợp sáu nhóm của từng trường, không có dữ liệu cá nhân', async () => {
      for (const name of ['alpha', 'beta']) {
        const tenant = await environment.tenantOf(name);
        const count = await runAsSchool(tenant, () => environment.api.get(AggregateSnapshotService).capture());
        assert.equal(count, 6);
      }
      const rows = await environment.platform.platform
        .selectFrom('aggregate_snapshots')
        .select(['category', 'metrics'])
        .where('school_id', '=', environment.platform.school('alpha').schoolId)
        .execute();
      assert.deepEqual(rows.map((row) => row.category).sort(), [
        'attendance',
        'emis',
        'facilities',
        'learning',
        'scale',
        'staff',
      ]);
      const scale = rows.find((row) => row.category === 'scale')?.metrics as Record<string, unknown>;
      assert.equal(typeof scale.students, 'number');
      assert.doesNotMatch(JSON.stringify(rows), /full_name|national_id|dob/);
    });

    it('CT-S6-7: chỉ trường đã đồng ý cho cấp Sở, trong cây con; nút ngoài phạm vi 403; mã phiên trường 401; xuất tệp', async () => {
      const none = await parentOrgApi('/aggregate?category=scale');
      assert.equal(none.status, 200, JSON.stringify(none.body));
      assert.equal(none.body.schools_count, 0, 'chưa trường nào đồng ý');

      const saved = await environment.call('alpha', 'PUT', '/parent-org-consents', {
        items: [
          { level: 'department', category: 'scale', granted: true },
          { level: 'commune', category: 'staff', granted: true },
        ],
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const view = await parentOrgApi('/aggregate?category=scale');
      assert.equal(view.body.schools_count, 1);
      assert.equal(view.body.total, null, 'một trường dưới ngưỡng năm trường: không hiện tổng');
      const schools = view.body.schools as Array<{ code: string; metrics: Record<string, unknown> | null }>;
      assert.deepEqual(
        schools.map((school) => school.code),
        [environment.platform.school('alpha').code],
      );
      assert.ok(schools[0]?.metrics);
      assert.equal(
        (await parentOrgApi('/aggregate?category=staff')).body.schools_count,
        0,
        'đồng ý cấp Phòng không mở cho Sở',
      );
      assert.equal((await parentOrgApi(`/aggregate?category=scale&unit=${units['phong-b']}`)).body.schools_count, 0);
      assert.equal((await parentOrgApi(`/aggregate?category=scale&unit=${units['so-khac']}`)).status, 403);
      assert.equal((await parentOrgApi('/aggregate?category=khong-co')).status, 400);
      assert.equal((await parentOrgApi('/aggregate?category=scale', environment.tokens.alpha)).status, 401);

      for (const [format, type] of [
        ['xlsx', 'spreadsheetml'],
        ['pdf', 'application/pdf'],
      ] as const) {
        const response = await download(`/api/v1/parent-org/aggregate/export?category=scale&format=${format}`);
        assert.equal(response.status, 200);
        assert.match(response.type, new RegExp(type));
      }

      // Rút đồng ý: trường không còn trong số liệu
      await environment.call('alpha', 'PUT', '/parent-org-consents', {
        items: [{ level: 'department', category: 'scale', granted: false }],
      });
      assert.equal((await parentOrgApi('/aggregate?category=scale')).body.schools_count, 0);
      const history = await environment.call('alpha', 'GET', '/parent-org-consents');
      assert.ok(
        (history.body.history as Array<{ revoked_at: string | null }>).some((row) => row.revoked_at),
        'lịch sử giữ bằng chứng',
      );
      assert.deepEqual(
        (history.body.chain as Array<{ code: string }>).map((unit) => unit.code),
        ['phong-a', 'so-gia', 'bo-gia'],
      );
    });

    it('CT-367-1: xuất báo cáo chạy nền: tạo việc, dựng tệp, danh sách, tải về; ngoài phạm vi 403; hết hạn thì xóa tệp', async () => {
      const post = (body: unknown, token = parentToken) =>
        sendWithHost(environment.apiOrigin, {
          method: 'POST',
          path: '/api/v1/parent-org/exports',
          host: CONSOLE_HOST,
          token,
          body,
        });
      assert.equal((await post({ categories: [], layout: 'x', format: 'doc' })).status, 400);
      assert.equal(
        (await post({ unit_id: units['so-khac'], categories: ['scale'], layout: 'summary', format: 'xlsx' })).status,
        403,
      );
      assert.equal(
        (await post({ categories: ['scale'], layout: 'summary', format: 'xlsx' }, environment.tokens.alpha)).status,
        401,
      );
      const created = await post({ categories: ['scale', 'staff'], layout: 'compare', format: 'xlsx' });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.id as string;
      await environment.api.get(ParentOrgExportsService).runDue();
      const listed = await parentOrgApi('/exports');
      assert.equal(listed.status, 200, JSON.stringify(listed.body));
      assert.equal(listed.body.background_available, true);
      const row = (listed.body.exports as Array<{ id: string; status: string; file_name: string; category_labels: string[] }>).find(
        (item) => item.id === id,
      );
      assert.equal(row?.status, 'done', JSON.stringify(row));
      assert.match(row?.file_name ?? '', /^so-sanh-so-gia-.*\.xlsx$/);
      assert.equal(row?.category_labels.length, 2);
      const file = await download(`/api/v1/parent-org/exports/${id}/file`);
      assert.equal(file.status, 200);
      assert.match(file.type, /spreadsheetml/);
      assert.equal((await download('/api/v1/parent-org/exports/khong-phai-uuid/file')).status, 404);

      // Hết hạn giữ: việc định kỳ xóa tệp, tải về báo 409
      await environment.platform.platform
        .updateTable('parent_org_exports')
        .set({ expires_at: new Date(Date.now() - 1000) })
        .where('id', '=', id)
        .execute();
      await environment.api.get(ParentOrgExportsService).runDue();
      assert.equal((await download(`/api/v1/parent-org/exports/${id}/file`)).status, 409);
    });

    if (layout === 'database') {
      it('CT-S6-8: trường duyệt đề nghị xem chi tiết; cấp trên mở phiên chỉ đọc; trường rút thì phiên kết thúc ngay', async () => {
        const created = await identity(
          'POST',
          '/auth/parent-org/access-requests',
          {
            school_code: environment.platform.school('alpha').code,
            categories: ['scale'],
            reason: 'Đối chiếu sĩ số',
            hours: 2,
          },
          parentToken,
        );
        assert.equal(created.status, 200, JSON.stringify(created.body));
        const id = created.body.id as string;
        const listed = await environment.call('alpha', 'GET', '/parent-org-consents');
        assert.ok(
          (listed.body.requests as Array<{ id: string; status: string }>).some(
            (row) => row.id === id && row.status === 'pending',
          ),
        );
        assert.equal(
          (await environment.call('beta', 'POST', `/parent-org-consents/requests/${id}/approve`, {})).status,
          404,
          'trường khác không duyệt được',
        );
        assert.equal(
          (await environment.call('alpha', 'POST', `/parent-org-consents/requests/${id}/approve`, {})).status,
          200,
        );

        const opened = await identity('POST', `/auth/parent-org/access-requests/${id}/open`, {}, parentToken);
        assert.equal(opened.status, 200, JSON.stringify(opened.body));
        const code = new URL((opened.body.handoff as { path: string }).path, 'http://x').searchParams.get('code');
        const exchanged = await sendWithHost(environment.identityOrigin, {
          path: '/api/v1/auth/support/exchange',
          host: environment.hosts.alpha,
          body: { code },
        });
        assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
        const support = exchanged.body.access_token as string;
        assert.equal((await environment.call('alpha', 'GET', '/school-plan', undefined, support)).status, 200);
        assert.equal(
          (await environment.call('alpha', 'PUT', '/parent-org-consents', { items: [] }, support)).status,
          403,
          'phiên chỉ đọc không ghi',
        );

        const revoked = await environment.call('alpha', 'POST', `/parent-org-consents/requests/${id}/revoke`, {});
        assert.equal(revoked.status, 200);
        assert.equal((await environment.call('alpha', 'GET', '/school-plan', undefined, support)).status, 401);
      });

      it('CT-367-2: cấp trên rút đề nghị chờ duyệt, rút đề nghị đã duyệt thì phiên xem chi tiết kết thúc; trường thấy đã rút', async () => {
        const request = async () => {
          const created = await identity(
            'POST',
            '/auth/parent-org/access-requests',
            {
              school_code: environment.platform.school('alpha').code,
              categories: ['scale'],
              reason: 'Đối chiếu sĩ số',
              hours: 2,
            },
            parentToken,
          );
          assert.equal(created.status, 200, JSON.stringify(created.body));
          return created.body.id as string;
        };
        const pending = await request();
        const withdrawn = await identity('POST', `/auth/parent-org/access-requests/${pending}/withdraw`, {}, parentToken);
        assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
        assert.equal(withdrawn.body.status, 'withdrawn');
        assert.equal(
          (await identity('POST', `/auth/parent-org/access-requests/${pending}/withdraw`, {}, parentToken)).status,
          400,
          'đã rút thì không rút lại',
        );
        assert.equal(
          (await environment.call('alpha', 'POST', `/parent-org-consents/requests/${pending}/approve`, {})).status,
          400,
          'trường không duyệt đề nghị đã rút',
        );
        const school = await environment.call('alpha', 'GET', '/parent-org-consents');
        assert.ok(
          (school.body.requests as Array<{ id: string; status: string }>).some(
            (row) => row.id === pending && row.status === 'withdrawn',
          ),
        );

        const approved = await request();
        await environment.call('alpha', 'POST', `/parent-org-consents/requests/${approved}/approve`, {});
        const opened = await identity('POST', `/auth/parent-org/access-requests/${approved}/open`, {}, parentToken);
        const code = new URL((opened.body.handoff as { path: string }).path, 'http://x').searchParams.get('code');
        const exchanged = await sendWithHost(environment.identityOrigin, {
          path: '/api/v1/auth/support/exchange',
          host: environment.hosts.alpha,
          body: { code },
        });
        const support = exchanged.body.access_token as string;
        assert.equal((await environment.call('alpha', 'GET', '/school-plan', undefined, support)).status, 200);
        assert.equal(
          (await identity('POST', `/auth/parent-org/access-requests/${approved}/withdraw`, {}, parentToken)).status,
          200,
        );
        assert.equal((await environment.call('alpha', 'GET', '/school-plan', undefined, support)).status, 401);
        assert.equal(
          (await identity('POST', `/auth/parent-org/access-requests/${approved}/open`, {}, parentToken)).status >= 400,
          true,
          'đề nghị đã rút không mở phiên được',
        );
      });
    }
  });
}
