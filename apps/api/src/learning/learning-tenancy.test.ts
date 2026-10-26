import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { SchoolDatabaseLayoutValue } from '@school-management/database';
import { startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';

// Lõi hệ thống quản lý học tập ở nền tảng nhiều trường (DT-28 phần 28b, YCTD-272), kịch bản CT-28b-15: lớp học trực tuyến, khoá
// học mẫu (cơ sở dữ liệu hệ thống), quyết định hình thức, nội quy (năm học) của trường này không đọc, không sửa được từ trường
// kia, ở cả hai bố cục cơ sở dữ liệu
for (const layout of ['database', 'schema'] as SchoolDatabaseLayoutValue[]) {
  describe(`lõi hệ thống quản lý học tập ở máy chủ API nhiều trường, bố cục ${layout}`, () => {
    let environment: MultiTenantApi;
    const call = (name: string, method: string, path: string, body?: unknown) =>
      environment.call(name, method, path, body);
    const ids: Record<string, { space: string; template: string; decision: string }> = {};

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
      await call(name, 'POST', '/org-units', { code: 'TRUONG', name: `Trường ${name}`, unit_type: 'truong_chinh' });
      const space = await call(name, 'POST', '/learning/spaces', {
        title: `Câu lạc bộ Toán ${name}`,
        school_level: 'THCS',
        enrollment_mode: 'teacher',
      });
      assert.equal(space.status, 201, JSON.stringify(space.body));
      const template = await call(name, 'POST', '/learning/templates', {
        title: `Khoá mẫu ${name}`,
        school_level: 'THCS',
      });
      assert.equal(template.status, 201, JSON.stringify(template.body));
      const decision = await call(name, 'POST', '/learning/decisions', {
        decision_no: `01/${name}`,
        decision_date: '2026-09-10',
        reason: 'Lý do bất khả kháng',
        starts_on: '2026-09-10',
        ends_on: '2026-09-20',
      });
      assert.equal(decision.status, 201, JSON.stringify(decision.body));
      ids[name] = {
        space: space.body.id as string,
        template: template.body.id as string,
        decision: decision.body.id as string,
      };
    }

    before(async () => {
      environment = await startMultiTenantApi({ label: `learning_${layout}`, layout });
      await prepareSchool('alpha');
      await prepareSchool('beta');
    });

    after(async () => {
      await environment?.close();
    });

    it('CT-28b-15: lớp học trực tuyến, khoá mẫu, quyết định của trường này không lộ, không sửa được từ trường kia', async () => {
      const alpha = ids.alpha;
      assert.ok(alpha);
      const betaSpaces = await call('beta', 'GET', '/learning/spaces?scope=all');
      assert.equal(betaSpaces.status, 200);
      assert.deepEqual(
        (betaSpaces.body as unknown as Array<Record<string, unknown>>).map((space) => space.title),
        ['Câu lạc bộ Toán beta'],
      );
      assert.equal((await call('beta', 'GET', `/learning/spaces/${alpha.space}`)).status, 404);
      assert.equal((await call('beta', 'PATCH', `/learning/spaces/${alpha.space}`, { title: 'Đổi tên' })).status, 404);
      assert.equal(
        (await call('beta', 'POST', `/learning/spaces/${alpha.space}/sections`, { title: 'Chen' })).status,
        404,
      );
      const betaTemplates = await call('beta', 'GET', '/learning/templates');
      assert.deepEqual(
        (betaTemplates.body as unknown as Array<Record<string, unknown>>).map((template) => template.title),
        ['Khoá mẫu beta'],
      );
      assert.equal((await call('beta', 'GET', `/learning/templates/${alpha.template}`)).status, 404);
      assert.equal((await call('beta', 'PUT', `/learning/templates/${alpha.template}`, { title: 'Chen' })).status, 404);
      assert.equal((await call('beta', 'POST', `/learning/decisions/${alpha.decision}/revoke`)).status, 404);
      const betaDecisions = await call('beta', 'GET', '/learning/decisions');
      assert.deepEqual(
        (betaDecisions.body as unknown as Array<Record<string, unknown>>).map((decision) => decision.decision_no),
        ['01/beta'],
      );
      const alphaSpace = await call('alpha', 'GET', `/learning/spaces/${alpha.space}`);
      assert.equal(alphaSpace.status, 200, 'trường alpha vẫn đọc được của mình');
      assert.equal((alphaSpace.body.space as Record<string, unknown>).title, 'Câu lạc bộ Toán alpha');
    });
  });
}
