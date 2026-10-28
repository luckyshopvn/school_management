import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, runAsSchool } from '@school-management/server';
import {
  isModuleInPlan,
  isPermissionInPlan,
  PLAN_MODULES,
  permissionPlanModules,
  FREE_PLAN_CODE,
} from '@school-management/shared';
import { assertStudentCapacity } from '../common/plan-limits.js';
import { startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';

// Gói dịch vụ và giới hạn ở máy chủ API (DT-SaaS phần S5a, YCTD-194), kịch bản CT-S5a-3 đến CT-S5a-6: hai trường giả; trường alpha
// gán gói giới hạn, trường beta không gán gói (không giới hạn) rồi chuyển chỉ đọc. Dữ liệu giả
describe('ánh xạ quyền vào phân hệ của gói', () => {
  it('CT-S5a-3: quyền thuộc phân hệ theo menu; phân hệ quản trị hệ thống luôn bật; quyền không gắn menu luôn dùng được', () => {
    assert.ok(PLAN_MODULES.some((module) => module.key === 'finance'));
    assert.equal(PLAN_MODULES.find((module) => module.key === 'system')?.core, true);
    const map = permissionPlanModules();
    assert.ok(map.size > 50, 'mọi quyền dùng ở menu đều được gắn phân hệ');
    assert.deepEqual([...(map.get('P09.learning-resource.manage') ?? [])], ['learning-resources']);
    assert.equal(isPermissionInPlan('P09.learning-resource.manage', ['finance']), false);
    assert.equal(isPermissionInPlan('P09.learning-resource.manage', ['learning-resources']), true);
    assert.equal(isPermissionInPlan('P09.learning-resource.manage', null), true, 'không giới hạn');
    assert.equal(isPermissionInPlan('KHONG.CO.trong-menu', []), true);
    assert.equal(isModuleInPlan('system', []), true);
    assert.equal(isModuleInPlan('library', []), false);
  });
});

describe('gói dịch vụ ở máy chủ API nhiều trường', () => {
  let environment: MultiTenantApi;
  let planId = '';

  before(async () => {
    environment = await startMultiTenantApi({ label: 'plan' });
  });

  after(async () => {
    await environment?.close();
  });

  const call = (name: string, method: string, path: string, body?: unknown) =>
    environment.call(name, method, path, body);

  // Đổi gói, trạng thái ở cơ sở dữ liệu nền tảng rồi nạp lại ngữ cảnh trường của máy chủ API
  async function setPlan(
    name: string,
    plan: {
      modules: string[] | null;
      maxStudents?: number | null;
      maxStorageMb?: number | null;
      maxLevels?: number | null;
    },
  ) {
    const tenant = await environment.tenantOf(name);
    const platform = environment.platform.platform;
    const created = await platform
      .insertInto('plans')
      .values({
        code: `goi-${randomUUID().slice(0, 8)}`,
        name: 'Gói thử',
        modules: plan.modules === null ? null : JSON.stringify(plan.modules),
        max_active_students: plan.maxStudents ?? null,
        max_storage_mb: plan.maxStorageMb ?? null,
        max_school_levels: plan.maxLevels ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    planId = created.id;
    await platform.deleteFrom('school_plans').where('school_id', '=', tenant.schoolId).execute();
    await platform
      .insertInto('school_plans')
      .values({ school_id: tenant.schoolId, plan_id: created.id, effective_from: '2020-01-01' })
      .execute();
    environment.apiRuntime.registry.invalidate();
  }

  it('CT-S5a-4: phân hệ ngoài gói trả 403 MODULE_NOT_IN_PLAN, trường khác không ảnh hưởng; gói của trường đọc được', async () => {
    assert.equal((await call('alpha', 'GET', '/learning-resources/catalog')).status, 200);
    await setPlan('alpha', { modules: ['education', 'finance'], maxLevels: 1 });
    const blocked = await call('alpha', 'GET', '/learning-resources/catalog');
    assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
    assert.equal((blocked.body.error as Record<string, unknown>).code, 'MODULE_NOT_IN_PLAN');
    assert.equal((await call('beta', 'GET', '/learning-resources/catalog')).status, 200, 'trường beta không gán gói');
    // Phân hệ quản trị hệ thống luôn bật
    assert.equal((await call('alpha', 'GET', '/org-units')).status, 200);
    const view = await call('alpha', 'GET', '/school-plan');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.restricted, true);
    assert.deepEqual(view.body.modules, ['education', 'finance']);
    assert.equal((view.body.limits as Record<string, unknown>).max_school_levels, 1);
    const beta = await call('beta', 'GET', '/school-plan');
    assert.equal(beta.body.restricted, false);
    // Mọi phân hệ (modules null) thì mở lại
    await setPlan('alpha', { modules: null });
    assert.equal((await call('alpha', 'GET', '/learning-resources/catalog')).status, 200);
    assert.ok(planId);
  });

  it('CT-314-7: gói cơ bản miễn phí: tính năng trả phí trả 403 MODULE_NOT_IN_PLAN kèm lời báo; bật riêng cho trường thì dùng được', async () => {
    const tenant = await environment.tenantOf('alpha');
    const platform = environment.platform.platform;
    const free = await platform
      .selectFrom('plans')
      .select('id')
      .where('code', '=', FREE_PLAN_CODE)
      .executeTakeFirstOrThrow();
    await platform.deleteFrom('school_plans').where('school_id', '=', tenant.schoolId).execute();
    await platform
      .insertInto('school_plans')
      .values({ school_id: tenant.schoolId, plan_id: free.id, effective_from: '2020-01-01' })
      .execute();
    environment.apiRuntime.registry.invalidate();
    for (const [path, module] of [
      ['/ai/status', 'ai-assistant'],
      ['/learning/config', 'online-learning'],
    ] as const) {
      const refused = await call('alpha', 'GET', path);
      assert.equal(refused.status, 403, `${path} ${JSON.stringify(refused.body)}`);
      const error = refused.body.error as {
        code: string;
        message: string;
        details: Array<{ field: string; message: string }>;
      };
      assert.equal(error.code, 'MODULE_NOT_IN_PLAN');
      assert.match(error.message, /tính năng trả phí.*Liên hệ bộ phận hỗ trợ/);
      assert.ok(error.details.some((detail) => detail.field === 'module' && detail.message === module));
    }
    // Phân hệ miễn phí (văn bản đi) dùng bình thường; trường beta không gán gói không bị ảnh hưởng
    assert.equal((await call('alpha', 'GET', '/outgoing-documents')).status, 200);
    assert.notEqual((await call('beta', 'GET', '/ai/status')).status, 403);
    // Nền tảng bật riêng trợ lý AI cho trường alpha: hết chặn theo gói, học trực tuyến vẫn chặn
    await platform
      .updateTable('schools')
      .set({ addon_modules: JSON.stringify(['ai-assistant']) })
      .where('id', '=', tenant.schoolId)
      .execute();
    environment.apiRuntime.registry.invalidate();
    const allowed = await call('alpha', 'GET', '/ai/status');
    assert.notEqual(
      (allowed.body.error as { code?: string } | undefined)?.code,
      'MODULE_NOT_IN_PLAN',
      JSON.stringify(allowed.body),
    );
    assert.equal((await call('alpha', 'GET', '/learning/config')).status, 403);
    await platform.updateTable('schools').set({ addon_modules: '[]' }).where('id', '=', tenant.schoolId).execute();
    await platform.deleteFrom('school_plans').where('school_id', '=', tenant.schoolId).execute();
    environment.apiRuntime.registry.invalidate();
  });

  it('CT-S5a-5: vượt giới hạn cấp học, dung lượng tệp, học sinh đang học thì chặn thêm mới, không chặn xem', async () => {
    await setPlan('alpha', { modules: null, maxLevels: 1, maxStorageMb: 0 });
    const levels = await call('alpha', 'GET', '/school-levels');
    assert.equal(levels.status, 200);
    const twoLevels = (levels.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'TH',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    const tooMany = await call('alpha', 'PUT', '/school-levels', { levels: twoLevels });
    assert.equal(tooMany.status, 422, JSON.stringify(tooMany.body));
    assert.equal((tooMany.body.error as Record<string, unknown>).code, 'PLAN_LIMIT_EXCEEDED');

    // Tải tệp khi gói cho 0 MB: yêu cầu nhiều phần bị chặn trước khi tới bộ điều khiển
    const boundary = 'ranh-gioi-s5a';
    const payload = Buffer.from(
      [
        `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nbirth_certificate\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="giay.pdf"\r\n`,
        `Content-Type: application/pdf\r\n\r\n%PDF-1.4\r\n`,
        `--${boundary}--\r\n`,
      ].join(''),
    );
    const upload = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const url = new URL(environment.apiOrigin);
      const request = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: '/api/v1/files',
          method: 'POST',
          headers: {
            host: environment.hosts.alpha,
            authorization: `Bearer ${environment.tokens.alpha}`,
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': payload.length,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
          );
        },
      );
      request.on('error', reject);
      request.end(payload);
    });
    assert.equal(upload.status, 422, upload.body);
    assert.match(upload.body, /PLAN_LIMIT_EXCEEDED/);

    // Học sinh đang học: mở năm học, thêm 2 trẻ đang học vào cơ sở dữ liệu năm học
    const year = await call('alpha', 'POST', '/academic-years', { name: '2026–2027' });
    assert.equal(year.status, 201, JSON.stringify(year.body));
    const yearId = year.body.id as string;
    await call('alpha', 'PUT', `/academic-years/${yearId}/calendar`, {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    assert.equal((await call('alpha', 'POST', `/academic-years/${yearId}/open`)).status, 200);
    const unit = await call('alpha', 'POST', '/org-units', {
      code: 'S5A',
      name: 'Trường giả S5a',
      unit_type: 'truong_chinh',
    });
    const context = await environment.tenantOf('alpha');
    const database = environment.apiRuntime.connections.database<SchoolYearDatabase>(
      context,
      'school-year',
      `${context.yearDatabasePrefix}2026_2027`,
    );
    for (const key of ['An', 'Binh']) {
      await database
        .insertInto('children')
        .values({
          org_unit_id: unit.body.id as string,
          full_name: `Học sinh ${key}`,
          dob: '2022-03-01',
          gender: 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .execute();
    }
    const withPlan = (max: number) => ({
      ...context,
      plan: {
        code: 'thu',
        name: 'Thử',
        modules: null,
        maxActiveStudents: max,
        maxStorageMb: null,
        maxSchoolLevels: null,
      },
    });
    await runAsSchool(withPlan(3), () => assertStudentCapacity(database, 1));
    await assert.rejects(
      runAsSchool(withPlan(2), () => assertStudentCapacity(database, 1)),
      (error: unknown) => error instanceof ApplicationError && error.code === 'PLAN_LIMIT_EXCEEDED',
    );
    // Xem vẫn được khi vượt giới hạn
    await setPlan('alpha', { modules: null, maxStudents: 1 });
    assert.equal((await call('alpha', 'GET', '/org-units')).status, 200);
    const view = await call('alpha', 'GET', '/school-plan');
    assert.equal((view.body.usage as Record<string, unknown>).active_students, 2);
  });

  it('CT-S5a-6: trường chỉ đọc bị chặn ghi (403 SCHOOL_READ_ONLY), vẫn xem, xuất được; trường khác ghi bình thường', async () => {
    const tenant = await environment.tenantOf('beta');
    await environment.platform.platform
      .updateTable('schools')
      .set({ status: 'read_only', paid_until: '2026-01-01' })
      .where('id', '=', tenant.schoolId)
      .execute();
    environment.apiRuntime.registry.invalidate();
    const write = await call('beta', 'POST', '/org-units', { code: 'RO', name: 'Chỉ đọc', unit_type: 'truong_chinh' });
    assert.equal(write.status, 403, JSON.stringify(write.body));
    assert.equal((write.body.error as Record<string, unknown>).code, 'SCHOOL_READ_ONLY');
    assert.equal((await call('beta', 'GET', '/org-units')).status, 200);
    assert.notEqual((await call('beta', 'POST', '/org-units/export', { format: 'xlsx' })).status, 403);
    const view = await call('beta', 'GET', '/school-plan');
    assert.equal(view.body.read_only, true);
    assert.equal(view.body.due_on, '2026-01-01');
    const alpha = await call('alpha', 'POST', '/academic-years', { name: '2027–2028' });
    assert.equal(alpha.status, 201, JSON.stringify(alpha.body));
    await environment.platform.platform
      .updateTable('schools')
      .set({ status: 'active' })
      .where('id', '=', tenant.schoolId)
      .execute();
    environment.apiRuntime.registry.invalidate();
  });
});
