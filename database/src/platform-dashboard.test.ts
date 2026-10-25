import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  ErrorCountBuffer,
  latestMigrationName,
  maintenanceNoticesFor,
  normalizeRoute,
  recordSchoolMetrics,
} from './platform-dashboard.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Hàm dùng chung của bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197), kịch bản CT-S4-5: mẫu đường dẫn không mang tham số, gom
// lỗi cộng dồn theo giờ, phiên bản cấu trúc dữ liệu, thông báo bảo trì theo trường. Dữ liệu giả
describe('bảng điều khiển nền tảng: hàm dùng chung', () => {
  let platform: TenantTestPlatform;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'dash' });
  });

  after(async () => {
    await platform?.close();
  });

  it('mẫu đường dẫn thay mã định danh, số, mã băm bằng :id và bỏ chuỗi truy vấn', () => {
    assert.equal(
      normalizeRoute('/api/v1/children/0b5a3c1e-9d1f-4c7e-8a2b-1234567890ab/files/42?ten=Nguyen'),
      '/api/v1/children/:id/files/:id',
    );
    assert.equal(normalizeRoute('/api/v1/files/abcdef0123456789abcdef'), '/api/v1/files/:id');
    assert.equal(normalizeRoute('/api/v1/health'), '/api/v1/health');
  });

  it('CT-S4-5: gom lỗi cộng dồn theo trường và giờ; lỗi không thuộc trường nào gom riêng', async () => {
    const alpha = platform.school('alpha');
    const at = new Date();
    const first = new ErrorCountBuffer();
    first.add({
      schoolId: alpha.schoolId,
      service: 'api',
      route: '/api/v1/children/1',
      status: 500,
      code: 'ERR_INTERNAL',
      at,
    });
    first.add({
      schoolId: alpha.schoolId,
      service: 'api',
      route: '/api/v1/children/2',
      status: 500,
      code: 'ERR_INTERNAL',
      at,
    });
    first.add({
      schoolId: null,
      service: 'identity',
      route: '/api/v1/auth/login',
      status: 503,
      code: 'ERR_UNAVAILABLE',
      at,
    });
    assert.equal(first.size, 2);
    assert.equal(await first.flush(platform.platform), 2);
    const second = new ErrorCountBuffer();
    second.add({
      schoolId: alpha.schoolId,
      service: 'api',
      route: '/api/v1/children/3',
      status: 500,
      code: 'ERR_INTERNAL',
      at,
    });
    second.add({ schoolId: null, service: 'identity', route: '/api/v1/auth/login', status: 503, code: null, at });
    await second.flush(platform.platform);
    const rows = await platform.platform
      .selectFrom('school_error_counts')
      .select(['school_id', 'route', 'count'])
      .orderBy('route')
      .execute();
    assert.deepEqual(
      rows.map((row) => [row.school_id, row.route, row.count]),
      [
        [null, '/api/v1/auth/login', 2],
        [alpha.schoolId, '/api/v1/children/:id', 3],
      ],
    );
  });

  it('phiên bản cấu trúc dữ liệu khớp mã đang chạy thì schema_current đúng; thiếu một cơ sở dữ liệu thì sai', async () => {
    const alpha = platform.school('alpha');
    const current = {
      identity: latestMigrationName('identity'),
      system: latestMigrationName('system'),
      'school-year:nam_hoc': latestMigrationName('school-year'),
    };
    const base = { usersTotal: 3, usersActive: 2, activeStudents: 10, storageMb: 1, databaseMb: 2, lastLoginAt: null };
    await recordSchoolMetrics(platform.platform, alpha.schoolId, { ...base, schemaVersions: current });
    await recordSchoolMetrics(platform.platform, alpha.schoolId, {
      ...base,
      schemaVersions: { ...current, 'school-year:nam_cu': '0001_cu' },
    });
    const rows = await platform.platform
      .selectFrom('school_metrics')
      .select('schema_current')
      .where('school_id', '=', alpha.schoolId)
      .orderBy('captured_at')
      .execute();
    assert.deepEqual(
      rows.map((row) => row.schema_current),
      [true, false],
    );
  });

  it('thông báo bảo trì: mọi trường hoặc trường được chọn; đã hủy, đã kết thúc hoặc còn xa hơn 72 giờ thì không hiện', async () => {
    const alpha = platform.school('alpha');
    const beta = platform.school('beta');
    const now = new Date();
    const hours = (value: number) => new Date(now.getTime() + value * 3_600_000);
    const notice = (title: string, values: Record<string, unknown>) =>
      platform.platform
        .insertInto('maintenance_notices')
        .values({
          title,
          body: 'Nội dung giả',
          starts_at: hours(1),
          ends_at: hours(2),
          created_by_name: 'Người vận hành giả',
          ...values,
        })
        .execute();
    await notice('Mọi trường', {});
    await notice('Chỉ alpha', { audience: 'schools', school_codes: JSON.stringify([alpha.code]) });
    await notice('Đã hủy', { cancelled_at: now });
    await notice('Đã kết thúc', { starts_at: hours(-3), ends_at: hours(-1) });
    await notice('Còn xa', { starts_at: hours(100), ends_at: hours(101) });
    assert.deepEqual(
      (await maintenanceNoticesFor(platform.platform, alpha.code, now)).map((item) => item.title).sort(),
      ['Chỉ alpha', 'Mọi trường'],
    );
    assert.deepEqual(
      (await maintenanceNoticesFor(platform.platform, beta.code, now)).map((item) => item.title),
      ['Mọi trường'],
    );
  });
});
