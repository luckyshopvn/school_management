import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  textExistsInSchoolDatabase,
  type SchoolDatabaseLayoutValue,
  type SchoolYearDatabase,
} from '@school-management/database';
import { runAsSchool } from '@school-management/server';
import { sql } from 'kysely';
import { ChildDataProtection } from './common/child-data-protection.js';
import { Databases } from './common/databases.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from './tenant-test-support.js';

// Máy chủ API ở chế độ nhiều trường (DT-SaaS phần S1a, tài liệu 47 mục 14.7 lớp 3, 4, 9): hai trường, dịch vụ định danh và máy chủ
// API chạy thật, chạy ở cả hai bố cục cơ sở dữ liệu. Dữ liệu mồi (canary) của từng trường không được xuất hiện ở trường kia
const CALENDAR_2026 = {
  first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
  second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
};
const CALENDAR_2027 = {
  first_term: { start_date: '2027-09-05', end_date: '2028-01-15' },
  second_term: { start_date: '2028-01-18', end_date: '2028-05-25' },
};

for (const layout of ['database', 'schema'] as SchoolDatabaseLayoutValue[]) {
  describe(`máy chủ API nhiều trường, bố cục ${layout}`, () => {
    let environment: MultiTenantApi;

    before(async () => {
      environment = await startMultiTenantApi({ layout });
    });

    after(async () => {
      await environment?.close();
    });

    const call = (name: string, method: string, path: string, body?: unknown, token?: string) =>
      environment.call(name, method, path, body, token);

    it('tên miền lạ trả 404 chung; kiểm tra sức khỏe không cần trường', async () => {
      const { apiOrigin } = environment;
      assert.equal(
        (await sendWithHost(apiOrigin, { path: '/api/v1/org-units', host: 'khong-co.e2e.localhost' })).status,
        404,
      );
      assert.equal((await sendWithHost(apiOrigin, { path: '/api/v1/org-units' })).status, 404);
      assert.equal((await sendWithHost(apiOrigin, { path: '/api/v1/health' })).status, 200);
    });

    it('mã phiên của trường A bị từ chối ở tên miền trường B', async () => {
      assert.equal((await call('alpha', 'GET', '/org-units')).status, 200);
      assert.equal((await call('beta', 'GET', '/org-units', undefined, environment.tokens.alpha)).status, 401);
      assert.equal((await call('alpha', 'GET', '/org-units', undefined, environment.tokens.beta)).status, 401);
    });

    it('mở năm học tạo cơ sở dữ liệu năm học riêng của từng trường theo đúng bố cục', async () => {
      for (const name of ['alpha', 'beta']) {
        const created = await call(name, 'POST', '/academic-years', { name: '2026–2027' });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const id = created.body.id as string;
        assert.equal((await call(name, 'PUT', `/academic-years/${id}/calendar`, CALENDAR_2026)).status, 200);
        const opened = await call(name, 'POST', `/academic-years/${id}/open`);
        assert.equal(opened.status, 200, JSON.stringify(opened.body));
        const tenant = await environment.tenantOf(name);
        const rows = await environment.platform.platform
          .selectFrom('school_databases')
          .select(['name', 'layout'])
          .where('school_id', '=', tenant.schoolId)
          .where('kind', '=', 'school-year')
          .execute();
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.layout, layout);
        assert.equal(rows[0]?.name, `${tenant.yearDatabasePrefix}2026_2027`);
      }
    });

    it('dữ liệu mồi của mỗi trường chỉ thấy ở trường đó (đơn vị, năm học)', async () => {
      for (const name of ['alpha', 'beta']) {
        const created = await call(name, 'POST', '/org-units', {
          code: `CANARY-${name.toUpperCase()}`,
          name: `Trường mồi ${name}`,
          unit_type: 'truong_chinh',
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
      }
      for (const [own, other] of [
        ['alpha', 'beta'],
        ['beta', 'alpha'],
      ] as const) {
        const listed = await call(own, 'GET', '/org-units');
        assert.equal(listed.status, 200);
        const text = JSON.stringify(listed.body);
        assert.ok(text.includes(`CANARY-${own.toUpperCase()}`), text);
        assert.ok(!text.includes(`CANARY-${other.toUpperCase()}`), text);
      }
      // Cơ sở dữ liệu năm học của từng trường chỉ chứa đơn vị của trường đó
      for (const [own, other] of [
        ['alpha', 'beta'],
        ['beta', 'alpha'],
      ] as const) {
        const tenant = await environment.tenantOf(own);
        const yearDatabase = environment.apiRuntime.connections.database<SchoolYearDatabase>(
          tenant,
          'school-year',
          `${tenant.yearDatabasePrefix}2026_2027`,
        );
        const rows = await yearDatabase.selectFrom('org_units').select('code').execute();
        assert.ok(rows.some((row) => row.code === `CANARY-${own.toUpperCase()}`));
        assert.ok(!rows.some((row) => row.code === `CANARY-${other.toUpperCase()}`));
      }
    });

    it('quét mọi bảng của mọi cơ sở dữ liệu của từng trường: chuỗi mồi của trường kia không có ở đâu cả', async () => {
      const { platform } = environment;
      for (const [own, other] of [
        ['alpha', 'beta'],
        ['beta', 'alpha'],
      ] as const) {
        const school = platform.school(own);
        let ownFound = false;
        for (const descriptor of school.descriptors) {
          assert.equal(
            await textExistsInSchoolDatabase(platform.adminUrl, descriptor, `CANARY-${other.toUpperCase()}`),
            false,
          );
          ownFound ||= await textExistsInSchoolDatabase(platform.adminUrl, descriptor, `CANARY-${own.toUpperCase()}`);
        }
        // Cơ sở dữ liệu năm học do máy chủ API tạo sau khi dựng nên chưa có trong mô tả ban đầu: quét thêm bằng mô tả hiện hành
        const tenant = await environment.tenantOf(own);
        const year = environment.apiRuntime.registry.descriptorOf(
          tenant,
          'school-year',
          `${tenant.yearDatabasePrefix}2026_2027`,
        );
        assert.equal(await textExistsInSchoolDatabase(platform.adminUrl, year, `CANARY-${other.toUpperCase()}`), false);
        ownFound ||= await textExistsInSchoolDatabase(platform.adminUrl, year, `CANARY-${own.toUpperCase()}`);
        assert.equal(ownFound, true, 'đối chứng: chuỗi mồi của chính trường phải tìm thấy');
      }
    });

    it('khóa dữ liệu trẻ riêng từng trường: bản mã của trường này không giải được ở trường kia', async () => {
      const protection = environment.api.get(ChildDataProtection);
      const alpha = await environment.tenantOf('alpha');
      const beta = await environment.tenantOf('beta');
      const encrypted = runAsSchool(alpha, () => protection.encrypt('079300000001'));
      assert.equal(
        runAsSchool(alpha, () => protection.decrypt(encrypted)),
        '079300000001',
      );
      assert.throws(() => runAsSchool(beta, () => protection.decrypt(encrypted)));
      assert.notEqual(
        runAsSchool(alpha, () => protection.hash('079300000001')),
        runAsSchool(beta, () => protection.hash('079300000001')),
      );
      // Ngoài ngữ cảnh trường thì đóng chặt, không rơi về khóa nào
      assert.throws(() => protection.encrypt('079300000001'), /ngữ cảnh trường/);
    });

    it('đóng chặt: truy cập cơ sở dữ liệu ngoài ngữ cảnh trường là lỗi', () => {
      const databases = environment.api.get(Databases);
      assert.throws(() => databases.system, /ngữ cảnh trường/);
      assert.throws(() => databases.schoolYear('khong_co'), /ngữ cảnh trường/);
    });

    it('mở năm học kế tiếp: năm cũ được khóa ghi ở mức PostgreSQL theo đúng bố cục, năm mới có cơ sở dữ liệu riêng', async () => {
      const created = await call('alpha', 'POST', '/academic-years', { name: '2027–2028' });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.id as string;
      assert.equal((await call('alpha', 'PUT', `/academic-years/${id}/calendar`, CALENDAR_2027)).status, 200);
      const opened = await call('alpha', 'POST', `/academic-years/${id}/open`);
      assert.equal(opened.status, 200, JSON.stringify(opened.body));
      const tenant = await environment.tenantOf('alpha');
      const rows = await environment.platform.platform
        .selectFrom('school_databases')
        .select(['name', 'status'])
        .where('school_id', '=', tenant.schoolId)
        .where('kind', '=', 'school-year')
        .orderBy('name')
        .execute();
      assert.deepEqual(
        rows.map((row) => [row.name, row.status]),
        [
          [`${tenant.yearDatabasePrefix}2026_2027`, 'read_only'],
          [`${tenant.yearDatabasePrefix}2027_2028`, 'active'],
        ],
      );
      const betaTenant = await environment.tenantOf('beta');
      const betaRows = await environment.platform.platform
        .selectFrom('school_databases')
        .select('status')
        .where('school_id', '=', betaTenant.schoolId)
        .where('kind', '=', 'school-year')
        .execute();
      assert.deepEqual(
        betaRows.map((row) => row.status),
        ['active'],
      );
      // Cơ sở dữ liệu năm học cũ của trường A không còn ghi được
      const oldYear = environment.apiRuntime.connections.database<unknown>(
        tenant,
        'school-year',
        `${tenant.yearDatabasePrefix}2026_2027`,
      );
      await assert.rejects(sql`create table chen_khi_khoa (id int)`.execute(oldYear), /read-only/i);
    });

    it('hủy mở năm học gỡ cơ sở dữ liệu năm vừa tạo và mở lại quyền ghi năm trước', async () => {
      const list = await call('alpha', 'GET', '/academic-years');
      assert.equal(list.status, 200);
      const years = list.body as unknown as Array<{ id: string; name: string; status: string }>;
      const opened = years.find((year) => year.name === '2027–2028');
      assert.ok(opened);
      const cancelled = await call('alpha', 'POST', `/academic-years/${opened.id}/cancel-open`);
      assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
      const tenant = await environment.tenantOf('alpha');
      const rows = await environment.platform.platform
        .selectFrom('school_databases')
        .select(['name', 'status'])
        .where('school_id', '=', tenant.schoolId)
        .where('kind', '=', 'school-year')
        .execute();
      assert.deepEqual(
        rows.map((row) => [row.name, row.status]),
        [[`${tenant.yearDatabasePrefix}2026_2027`, 'active']],
      );
    });

    it('trường bị tạm dừng trả 503 ở máy chủ API', async () => {
      const tenant = await environment.tenantOf('beta');
      await environment.platform.platform
        .updateTable('schools')
        .set({ status: 'suspended' })
        .where('id', '=', tenant.schoolId)
        .execute();
      environment.apiRuntime.registry.invalidate();
      assert.equal((await call('beta', 'GET', '/org-units')).status, 503);
      await environment.platform.platform
        .updateTable('schools')
        .set({ status: 'active' })
        .where('id', '=', tenant.schoolId)
        .execute();
      environment.apiRuntime.registry.invalidate();
      assert.equal((await call('beta', 'GET', '/org-units')).status, 200);
    });
  });
}
