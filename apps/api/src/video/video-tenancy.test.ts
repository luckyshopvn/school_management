import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { SchoolDatabaseLayoutValue } from '@school-management/database';
import { startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';

// Lớp video ở nền tảng nhiều trường (DT-27 phần 27a, YCTD-251), kịch bản CT-27a-7: phòng của trường này không đọc, không vào được từ
// trường kia; sự kiện gọi lại đi qua một địa chỉ chung, trường lấy từ tên phòng và chỉ ghi vào trường đó; giới hạn phút của gói chặn
// mở phòng mới. Bộ giả lập nhà cung cấp, hai bố cục cơ sở dữ liệu
const MOCK_SECRET = 'mock-video-secret';

for (const layout of ['database', 'schema'] as SchoolDatabaseLayoutValue[]) {
  describe(`lớp video ở máy chủ API nhiều trường, bố cục ${layout}`, () => {
    let environment: MultiTenantApi;
    let planId = '';
    const call = (name: string, method: string, path: string, body?: unknown) =>
      environment.call(name, method, path, body);
    const rooms: Record<string, string> = {};

    async function prepareSchool(name: string) {
      const created = await call(name, 'POST', '/academic-years', { name: '2026-2027' });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.id as string;
      const calendar = {
        first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
        second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
      };
      assert.equal((await call(name, 'PUT', `/academic-years/${id}/calendar`, calendar)).status, 200);
      assert.equal((await call(name, 'POST', `/academic-years/${id}/open`)).status, 200);
      const room = await call(name, 'POST', '/video/rooms', { title: `Phòng họp cha mẹ ${name}` });
      assert.equal(room.status, 200, JSON.stringify(room.body));
      assert.equal(room.body.role, 'host');
      rooms[name] = room.body.room_id as string;
    }

    const webhook = async (event: object) => {
      const body = JSON.stringify(event);
      const response = await fetch(`${environment.apiOrigin}/api/v1/video/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/webhook+json',
          authorization: `Mock ${createHmac('sha256', MOCK_SECRET).update(body).digest('base64url')}`,
        },
        body,
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    };

    before(async () => {
      environment = await startMultiTenantApi({
        label: `video_${layout}`,
        layout,
        configuration: {
          video: { provider: 'mock', apiUrl: '', clientUrl: 'mock://video', apiKey: 'mock', apiSecret: MOCK_SECRET },
        },
      });
      const platform = environment.platform.platform;
      const rule = await platform
        .insertInto('price_rules')
        .values({
          code: 'theo-truong-video',
          name: 'Theo trường',
          components: JSON.stringify(['per_school']),
          school_fee: 2_000_000,
          period: 'monthly',
          vat_percent: 0,
          due_days: 10,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      planId = (
        await platform
          .insertInto('plans')
          .values({ code: 'goi-video', name: 'Gói có lớp video', price_rule_id: rule.id })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      for (const name of ['alpha', 'beta']) {
        const tenant = await environment.tenantOf(name);
        await platform
          .insertInto('school_plans')
          .values({ school_id: tenant.schoolId, plan_id: planId, effective_from: '2026-01-01' })
          .execute();
      }
      environment.apiRuntime.registry.invalidate();
      await prepareSchool('alpha');
      await prepareSchool('beta');
    });

    after(async () => {
      await environment?.close();
    });

    it('CT-27a-7: cách ly phòng giữa hai trường, sự kiện gọi lại về đúng trường, giới hạn phút của gói', async () => {
      assert.equal((await call('beta', 'GET', `/video/rooms/${rooms.alpha}`)).status, 404);
      assert.equal((await call('beta', 'POST', `/video/rooms/${rooms.alpha}/join`)).status, 404);
      assert.equal((await call('alpha', 'GET', `/video/rooms/${rooms.alpha}`)).status, 200);

      const alpha = await environment.tenantOf('alpha');
      const joined = await webhook({
        kind: 'join',
        room: `${alpha.schoolId}--${rooms.alpha}`,
        identity: 'o:00000000-0000-4000-8000-000000000001',
        at: new Date(Date.now() - 20 * 60_000).toISOString(),
      });
      assert.equal(joined.status, 200, JSON.stringify(joined.body));
      assert.equal(joined.body.handled, true);
      const unknown = await webhook({
        kind: 'join',
        room: `00000000-0000-4000-8000-0000000000ff--${rooms.alpha}`,
        identity: 'o:00000000-0000-4000-8000-000000000001',
      });
      assert.equal(unknown.body.handled, false, 'trường không có thì bỏ qua');
      const alphaUsage = await call('alpha', 'GET', '/video/usage');
      const betaUsage = await call('beta', 'GET', '/video/usage');
      assert.ok((alphaUsage.body.minutes_used as number) >= 20);
      assert.equal(betaUsage.body.minutes_used, 0);

      await environment.platform.platform
        .updateTable('plans')
        .set({ video_max_minutes: 10 })
        .where('id', '=', planId)
        .execute();
      environment.apiRuntime.registry.invalidate();
      const blocked = await call('alpha', 'POST', '/video/rooms', { title: 'Phòng vượt hạn mức' });
      assert.equal((blocked.body.error as { code: string }).code, 'PLAN_LIMIT_EXCEEDED');
      const usage = await call('alpha', 'GET', '/video/usage');
      assert.equal(usage.body.minutes_limit, 10);
      assert.equal((await call('beta', 'POST', '/video/rooms', { title: 'Phòng của beta' })).status, 200);
    });
  });
}
