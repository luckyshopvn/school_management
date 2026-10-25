import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  aggregateForUnit,
  consentedSchools,
  defaultAdminUnits,
  importAdminUnits,
  recordAggregateSnapshot,
  subtreeUnitIds,
  sumMetrics,
  suppressSmallCells,
} from './parent-org.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Đơn vị cấp trên (DT-SaaS phần S6, YCTD-202), kịch bản CT-S6-1, CT-S6-2: cây con, đồng ý theo cấp và nhóm, cộng dồn, ẩn nhóm nhỏ,
// nạp bộ nút mặc định. Ba trường giả, cây giả
describe('đơn vị cấp trên: hàm dùng chung', () => {
  let platform: TenantTestPlatform;
  const ids: Record<string, string> = {};

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta', 'gamma'], label: 'porg' });
    const db = platform.platform;
    await importAdminUnits(db, [
      { level: 'ministry', code: 'bo-gia', name: 'Bộ giả', parent_code: null },
      { level: 'department', code: 'so-gia', name: 'Sở giả', parent_code: 'bo-gia' },
      { level: 'commune', code: 'phong-a', name: 'Phòng A giả', parent_code: 'so-gia' },
      { level: 'commune', code: 'phong-b', name: 'Phòng B giả', parent_code: 'so-gia' },
    ]);
    for (const row of await db.selectFrom('admin_units').select(['id', 'code']).execute()) {
      ids[row.code] = row.id;
    }
    const assign = async (school: string, unit: string) =>
      db
        .updateTable('schools')
        .set({ admin_unit_id: ids[unit] as string })
        .where('id', '=', platform.school(school).schoolId)
        .execute();
    await assign('alpha', 'phong-a');
    await assign('beta', 'phong-a');
    await assign('gamma', 'phong-b');
    const consent = (school: string, level: 'ministry' | 'department' | 'commune') =>
      db
        .insertInto('school_aggregate_consents')
        .values({
          school_id: platform.school(school).schoolId,
          level,
          category: 'scale',
          granted_by_user_id: '00000000-0000-4000-8000-000000000001',
          granted_by_name: 'Quản trị giả',
        })
        .execute();
    await consent('alpha', 'department');
    await consent('beta', 'department');
    await consent('gamma', 'commune');
    const snapshot = (school: string, students: number, male: number) =>
      recordAggregateSnapshot(db, platform.school(school).schoolId, 'scale', '2026-2027', {
        classes: 4,
        students,
        students_male: male,
        students_female: students - male,
        students_by_grade: { '1': students - 3, '2': 3 },
      });
    await snapshot('alpha', 120, 60);
    await snapshot('beta', 80, 2);
    await snapshot('gamma', 50, 25);
  });

  after(async () => {
    await platform?.close();
  });

  it('cây con theo nút; nạp lại không tạo trùng; cấp không hợp với nút cha bị từ chối', async () => {
    const tree = await subtreeUnitIds(platform.platform, ids['so-gia'] as string);
    assert.equal(tree.length, 3);
    assert.deepEqual(
      await importAdminUnits(platform.platform, [{ level: 'ministry', code: 'bo-gia', name: 'x', parent_code: null }]),
      {
        created: 0,
        skipped: 1,
      },
    );
    await assert.rejects(
      importAdminUnits(platform.platform, [{ level: 'commune', code: 'sai-cap', name: 'Sai', parent_code: 'bo-gia' }]),
      /không hợp/,
    );
  });

  it('CT-S6-1: chỉ trường trong cây con và đã đồng ý cho đúng cấp, đúng nhóm; rút đồng ý thì không còn', async () => {
    const department = await consentedSchools(platform.platform, ids['so-gia'] as string, 'department', 'scale');
    assert.deepEqual(
      department.map((school) => school.code).sort(),
      [platform.school('alpha').code, platform.school('beta').code].sort(),
    );
    assert.equal(
      (await consentedSchools(platform.platform, ids['so-gia'] as string, 'department', 'staff')).length,
      0,
      'nhóm khác',
    );
    const commune = await consentedSchools(platform.platform, ids['phong-a'] as string, 'commune', 'scale');
    assert.equal(commune.length, 0, 'alpha, beta chưa đồng ý cho cấp Phòng');
    assert.equal((await consentedSchools(platform.platform, ids['phong-b'] as string, 'commune', 'scale')).length, 1);
    await platform.platform
      .updateTable('school_aggregate_consents')
      .set({ revoked_at: new Date(), revoked_by_name: 'Quản trị giả' })
      .where('school_id', '=', platform.school('beta').schoolId)
      .execute();
    assert.equal((await consentedSchools(platform.platform, ids['so-gia'] as string, 'department', 'scale')).length, 1);
    await platform.platform
      .insertInto('school_aggregate_consents')
      .values({
        school_id: platform.school('beta').schoolId,
        level: 'department',
        category: 'scale',
        granted_by_user_id: '00000000-0000-4000-8000-000000000001',
        granted_by_name: 'Quản trị giả',
      })
      .execute();
  });

  it('CT-S6-2: cộng dồn, tỉ lệ tính lại; ẩn ô ít người; tổng của nút ít trường hơn ngưỡng không hiện', async () => {
    const total = sumMetrics([
      { records: 10, present: 9, rate: 90, by: { a: 1 } },
      { records: 30, present: 15, rate: 50, by: { a: 2, b: 4 } },
    ]);
    assert.deepEqual(total, { records: 40, present: 24, by: { a: 3, b: 4 }, rate: 60 });
    const hidden = suppressSmallCells({ students: 3, rooms: 2, area_m2: 1, students_by_grade: { '1': 4, '2': 7 } }, 5);
    assert.deepEqual(hidden.metrics, {
      students: null,
      rooms: 2,
      area_m2: 1,
      students_by_grade: { '1': null, '2': 7 },
    });
    assert.deepEqual(hidden.hidden.sort(), ['students', 'students_by_grade.1']);

    const strict = await aggregateForUnit(platform.platform, ids['so-gia'] as string, 'department', 'scale', 5);
    assert.equal(strict.schools_count, 2);
    assert.equal(strict.total, null, 'hai trường dưới ngưỡng năm trường');
    assert.ok(strict.total_hidden_reason);
    const beta = strict.schools.find((school) => school.code === platform.school('beta').code);
    assert.equal((beta?.metrics as Record<string, unknown>).students_male, null, 'hai học sinh nam bị ẩn');

    const loose = await aggregateForUnit(platform.platform, ids['so-gia'] as string, 'department', 'scale', 2);
    assert.equal((loose.total as Record<string, unknown>).students, 200);
    assert.equal(loose.children.length, 2);
    assert.equal(loose.children.find((child) => child.code === 'phong-a')?.schools_count, 2);
    assert.equal(loose.children.find((child) => child.code === 'phong-b')?.total, null, 'gamma chưa đồng ý cho cấp Sở');
  });

  it('bộ nút mặc định: Bộ, Sở TP.HCM và 168 Phòng của xã, phường mới; mã hợp lệ, không trùng', () => {
    const units = defaultAdminUnits();
    assert.equal(units.filter((unit) => unit.level === 'ministry').length, 1);
    assert.equal(units.filter((unit) => unit.level === 'department').length, 1);
    assert.equal(units.filter((unit) => unit.level === 'commune').length, 168);
    assert.equal(new Set(units.map((unit) => unit.code)).size, units.length);
    assert.ok(units.every((unit) => /^[a-z0-9][a-z0-9-]{0,62}$/.test(unit.code)));
  });
});
