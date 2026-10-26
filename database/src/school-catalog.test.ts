import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import {
  catalogCommunes,
  catalogDepartments,
  catalogStatistics,
  catalogUnitByCode,
  importSchoolCatalog,
  parseCsv,
  prepareCatalog,
  searchCatalogUnits,
  searchText,
} from './school-catalog.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Danh mục đơn vị toàn quốc (DT-24, YCTD-220), kịch bản CT-24-1 đến CT-24-4: đọc CSV, làm sạch có cờ, loại mã trùng khuôn số căn
// cước, nhập lặp lại được, truy vấn phân trang cho ô chọn. Chỉ dùng tệp mẫu giả trong database/platform/catalog-sample
const sample = (name: string) => readFile(new URL(`../../platform/catalog-sample/${name}`, import.meta.url), 'utf8');

describe('danh mục đơn vị: đọc và làm sạch', () => {
  it('CT-24-1: đọc CSV có ngoặc kép, dấu BOM, xuống dòng Windows; bỏ dấu để tìm', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n');
    assert.deepEqual(rows, [
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
    assert.equal(searchText('  Trường THCS Đồng   Xanh '), 'truong thcs dong xanh');
  });

  it('CT-24-2: gắn cờ thay vì bỏ âm thầm; loại mã trùng khuôn số căn cước, không ghi giá trị mã', async () => {
    const prepared = prepareCatalog(await sample('don_vi_mau.csv'), await sample('phuong_xa_mau.csv'));
    assert.equal(prepared.units.size, 12);
    assert.equal(prepared.departments.get('97'), 'Tỉnh Mẫu Bắc');
    const masked = prepared.skipped.filter((row) => row.reason.includes('căn cước'));
    assert.equal(masked.length, 2);
    assert.ok(masked.every((row) => row.code === '[đã che]'));
    assert.ok(!JSON.stringify(prepared.skipped).includes('012345678901'));
    const multi = prepared.units.get('97000301');
    assert.deepEqual([...(multi?.levels ?? [])].sort(), ['TH', 'THCS']);
    assert.equal(prepared.units.get('97000302')?.name, 'Trường THCS Mẫu Ánh Dương, cơ sở 2');
    const nonstandard = prepared.units.get('97000B13');
    assert.ok(nonstandard?.flags.has('code_nonstandard'));
    assert.ok(nonstandard?.flags.has('commune_missing'));
    const unnamed = prepared.units.get('97000102');
    assert.equal(unnamed?.name, 'Đơn vị mã 97000102');
    assert.ok(unnamed?.flags.has('name_missing'));
    // Mã xã có ở dòng trường thì nhận cả tên xã từ dòng đó
    assert.equal(prepared.units.get('98000202')?.communeCode, '99999');
    assert.equal(prepared.units.get('9700000001')?.schoolYear, '2026-2027');
  });

  it('báo lỗi khi thiếu cột bắt buộc', () => {
    assert.throws(() => prepareCatalog('ma_so,ten_so\n97,Tỉnh Mẫu\n', null), /thiếu cột ma_truong, ten_truong/);
  });
});

describe('danh mục đơn vị: nhập và truy vấn', () => {
  let platform: TenantTestPlatform;
  const actor = { type: 'cli' as const, name: 'Kiểm thử' };

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha'], label: 'catalog' });
  });

  after(async () => {
    await platform?.close();
  });

  it('CT-24-3: nhập lặp lại được, báo cáo thêm, sửa, giữ nguyên, bỏ qua; chạy thử không ghi', async () => {
    const db = platform.platform;
    const unitsCsv = await sample('don_vi_mau.csv');
    const communesCsv = await sample('phuong_xa_mau.csv');
    const dry = await importSchoolCatalog(db, { unitsCsv, communesCsv, source: 'mau', dryRun: true, actor });
    assert.equal(dry.totals.units_inserted, 12);
    assert.equal(
      Number(
        (
          await db
            .selectFrom('catalog_units')
            .select((b) => b.fn.countAll<string>().as('n'))
            .executeTakeFirstOrThrow()
        ).n,
      ),
      0,
    );

    const first = await importSchoolCatalog(db, { unitsCsv, communesCsv, source: 'mau', actor });
    assert.equal(first.totals.units_inserted, 12);
    assert.equal(first.totals.units_skipped, 2);
    assert.equal(first.totals.departments_inserted, 2);
    assert.equal(first.totals.communes_inserted, 7);
    assert.ok((first.flags.code_nonstandard ?? 0) >= 1);

    const again = await importSchoolCatalog(db, { unitsCsv, communesCsv, source: 'mau', actor });
    assert.equal(again.totals.units_inserted, 0);
    assert.equal(again.totals.units_updated, 0);
    assert.equal(again.totals.units_unchanged, 12);

    // Đổi tên một trường, bỏ một trường khỏi tệp: một dòng sửa, một dòng thiếu; có cờ thì chuyển ngừng hoạt động
    const changed = unitsCsv
      .replace('Trường Tiểu học Mẫu Gamma', 'Trường Tiểu học Mẫu Gamma Mới')
      .split('\n')
      .filter((line) => !line.includes('98000202'))
      .join('\n');
    const third = await importSchoolCatalog(db, { unitsCsv: changed, source: 'mau', deactivateMissing: true, actor });
    assert.equal(third.totals.units_updated, 1);
    assert.equal(third.totals.units_missing, 1);
    assert.equal(third.totals.units_deactivated, 1);
    const delta = await db
      .selectFrom('catalog_units')
      .select('status')
      .where('moet_code', '=', '98000202')
      .executeTakeFirstOrThrow();
    assert.equal(delta.status, 'inactive');
    const runs = await db.selectFrom('catalog_import_runs').select(['dry_run']).execute();
    assert.equal(runs.length, 4);
  });

  it('CT-24-4: ô chọn: sở, phường xã, trường theo cấp, tìm không dấu, phân trang; tra một mã kèm trường đã khởi tạo', async () => {
    const db = platform.platform;
    const departments = await catalogDepartments(db);
    assert.deepEqual(
      departments.map((row) => row.code),
      ['97', '98'],
    );
    const communes = await catalogCommunes(db, { department: '97', q: 'mau hai' });
    assert.deepEqual(
      communes.items.map((row) => row.code),
      ['99002'],
    );
    const secondary = await searchCatalogUnits(db, { department: '97', level: 'THCS' });
    assert.deepEqual(secondary.items.map((row) => row.moet_code).sort(), ['97000301', '97000302']);
    const byText = await searchCatalogUnits(db, { department: '97', q: 'anh duong' });
    assert.deepEqual(
      byText.items.map((row) => row.moet_code),
      ['97000302'],
    );
    const firstPage = await searchCatalogUnits(db, { department: '97', limit: 3 });
    assert.equal(firstPage.items.length, 3);
    assert.equal(firstPage.has_more, true);
    const capped = await searchCatalogUnits(db, { department: '97', limit: 5000 });
    assert.ok(capped.items.length <= 50);

    await db
      .updateTable('schools')
      .set({ moet_code: '98000301' })
      .where('id', '=', platform.school('alpha').schoolId)
      .execute();
    const linked = await catalogUnitByCode(db, '98000301');
    assert.equal(linked?.department_name, 'Thành phố Mẫu Nam');
    assert.equal(linked?.school?.code, platform.school('alpha').code);
    assert.deepEqual(linked?.levels, ['THCS']);
    const notProvisioned = await catalogUnitByCode(db, '97000201');
    assert.equal(notProvisioned?.school, null);
    const statistics = await catalogStatistics(db);
    assert.equal(statistics.units, 12);
    assert.equal(statistics.linked_schools, 1);
  });
});
