import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import { linkDemoCatalogUnit, readEnvironmentValue, updateEnvironmentText } from './local-multi-school.js';
import { catalogLevels, catalogUnitByCode, importSchoolCatalog, searchCatalogUnits } from './school-catalog.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Bản nhiều trường trên máy (YCTD-310), kịch bản CT-310-1 đến CT-310-3: ghi tệp môi trường riêng giữ nguyên dòng khác; cấp học lọc theo
// sở, phường; gắn trường demo vào danh mục ở sở, phường chỉ định. Chỉ dùng tệp mẫu giả trong database/platform/catalog-sample
const sample = (name: string) => readFile(new URL(`../../platform/catalog-sample/${name}`, import.meta.url), 'utf8');

describe('bản nhiều trường trên máy: tệp môi trường', () => {
  it('CT-310-1: thay giá trị biến đã có, thêm biến mới ở cuối, bỏ biến đặt null, giữ chú thích và biến khác', () => {
    const text = '# chú thích\r\nAPI_PORT=3000\r\nOTHER="giữ"\r\n';
    const updated = updateEnvironmentText(text, { API_PORT: '3100', PLATFORM_ROOT_DOMAIN: 'truong.localhost' });
    assert.equal(updated, '# chú thích\nAPI_PORT=3100\nOTHER="giữ"\nPLATFORM_ROOT_DOMAIN=truong.localhost\n');
    assert.equal(readEnvironmentValue(updated, 'OTHER'), 'giữ');
    assert.equal(readEnvironmentValue(updated, 'API_PORT'), '3100');
    assert.equal(readEnvironmentValue(updated, 'MISSING'), undefined);
    assert.equal(updateEnvironmentText('', { A: '1' }), 'A=1\n');
    // null: bỏ biến (bật lại việc nền thì bỏ SCHEDULER_MODE)
    assert.equal(updateEnvironmentText('A=1\nB=2\n', { A: null, C: null }), 'B=2\n');
  });
});

describe('bản nhiều trường trên máy: danh mục và trường demo', () => {
  let platform: TenantTestPlatform;
  const actor = { type: 'cli' as const, name: 'Kiểm thử' };

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'local' });
    await importSchoolCatalog(platform.platform, {
      unitsCsv: await sample('don_vi_mau.csv'),
      communesCsv: await sample('phuong_xa_mau.csv'),
      source: 'mau',
      actor,
    });
  });

  after(async () => {
    await platform?.close();
  });

  it('CT-310-2: cấp học chỉ gồm cấp có trường đang hoạt động trong sở, phường đã chọn', async () => {
    const codes = async (scope: { department?: string; commune?: string }) =>
      (await catalogLevels(platform.platform, scope)).map((level) => level.code);
    assert.deepEqual(await codes({}), ['MN', 'TH', 'THCS', 'THPT', 'GDTX']);
    assert.deepEqual(await codes({ department: '98' }), ['TH', 'THCS', 'THPT']);
    assert.deepEqual(await codes({ department: '97', commune: '99003' }), ['THPT', 'GDTX']);
    assert.deepEqual(await codes({ department: '98', commune: '99003' }), []);
  });

  it('CT-310-3: gắn trường demo vào danh mục ở phường chỉ định, chạy lặp được; phường phải thuộc sở', async () => {
    const db = platform.platform;
    const alpha = platform.school('alpha');
    const beta = platform.school('beta');
    const options = {
      schoolCode: alpha.code,
      moetCode: 'DEMO-TC',
      name: 'Trường Mầm non Trình Diễn',
      departmentCode: '98',
      communeCode: '99102',
      levels: ['MN'],
    };
    await assert.rejects(
      linkDemoCatalogUnit(db, { ...options, communeCode: '99001' }),
      /không có trong danh mục của sở 98/,
    );
    await assert.rejects(linkDemoCatalogUnit(db, { ...options, levels: ['MG'] }), /sai: MG/);
    await assert.rejects(linkDemoCatalogUnit(db, { ...options, departmentCode: '96' }), /chưa có sở mã 96/);

    const linked = await linkDemoCatalogUnit(db, options);
    assert.equal(linked.communeName, 'Xã Mẫu Nam Hai');
    const unit = await catalogUnitByCode(db, 'DEMO-TC');
    assert.equal(unit?.school?.code, alpha.code);
    assert.deepEqual(unit?.levels, ['MN']);
    const found = await searchCatalogUnits(db, { department: '98', commune: '99102', level: 'MN' });
    assert.deepEqual(
      found.items.map((item) => item.moet_code),
      ['DEMO-TC'],
    );

    // Chạy lại cho trường khác: mã chuyển sang trường mới, trường cũ được gỡ; cấp học thay theo lần sau
    await linkDemoCatalogUnit(db, { ...options, schoolCode: beta.code, levels: ['MN', 'TH'] });
    const moved = await catalogUnitByCode(db, 'DEMO-TC');
    assert.equal(moved?.school?.code, beta.code);
    assert.deepEqual(moved?.levels, ['MN', 'TH']);
    const alphaRow = await db
      .selectFrom('schools')
      .select('moet_code')
      .where('id', '=', alpha.schoolId)
      .executeTakeFirst();
    assert.equal(alphaRow?.moet_code, null);
  });
});
