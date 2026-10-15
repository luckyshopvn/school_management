import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import ExcelJS from 'exceljs';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { expectNoMenuLink, openMenu } from './menu.js';

// 4.1.11. Cập nhật địa danh hành chính (DT-15 phần 15h1, YCTD-116): lưới địa chỉ học sinh còn theo địa danh cũ, đề xuất
// theo bảng đối chiếu, chọn xã mới khi xã cũ chia cho nhiều xã, chuyển hàng loạt; nhập bảng đối chiếu từ Excel
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
const token = `ĐịaDanh${suffix}`;
const fullName = `Võ ${token} Hạnh`;
// Tỉnh, xã thử không có thật để nhập bảng đối chiếu
const testProvince = `Tỉnh Thử ${suffix}`;
const testWard = `Xã Thử ${suffix}`;
let childId = '';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  const reference = await schoolYear.selectFrom('classes').select(['org_unit_id']).executeTakeFirstOrThrow();
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: fullName,
      dob: '2022-03-09',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '4111',
      photo_consent: 'pending',
      status: 'active',
      enroll_date: '2026-01-01',
      birth_certificate_file_id: null,
      moet_profile: JSON.stringify({
        permanent_province: 'Thành phố Hồ Chí Minh',
        permanent_district: 'Quận 1',
        permanent_ward: 'Phường Bến Nghé',
        birthplace_province: 'Tỉnh Bình Dương',
        birthplace_district: 'Thành phố Thủ Dầu Một',
        birthplace_ward: 'Phường Hiệp Thành',
        hometown_province: testProvince,
        hometown_district: 'Huyện Thử',
        hometown_ward: testWard,
        current_province: 'Thành phố Hồ Chí Minh',
        current_ward: 'Phường Sài Gòn',
      }),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  childId = child.id;
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(page: Page, roleCode: string, unit: string | null) {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: unit }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function openAddresses(page: Page) {
  await openMenu(page, '/administrative-units');
  await expect(page.getByRole('heading', { name: '4.1.11. Cập nhật địa danh hành chính', exact: true })).toBeVisible();
  const grid = page.getByRole('region', { name: 'Địa chỉ học sinh theo địa danh cũ' });
  await grid.getByLabel('Tìm theo họ tên').fill(token);
  return grid;
}

test('CT-15h1-9: lưới địa chỉ theo địa danh cũ, chọn xã mới khi có nhiều xã, chuyển hàng loạt sang địa danh mới', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  const grid = await openAddresses(page);
  const rows = grid.getByRole('row').filter({ hasText: token });
  await expect(rows).toHaveCount(3);
  const headers = grid.getByRole('columnheader');
  for (const header of ['Họ tên', 'Loại địa chỉ', 'Quận/Huyện cũ', 'Xã/Phường cũ', 'Xã/Phường mới', 'Tình trạng']) {
    await expect(headers.filter({ hasText: header }).first()).toBeVisible();
  }
  const permanent = rows.filter({ hasText: 'Thường trú' });
  await expect(permanent).toContainText('Phường Bến Nghé');
  await expect(permanent).toContainText('Phường Sài Gòn');
  await expect(permanent).toContainText('Có đề xuất');
  await expect(rows.filter({ hasText: 'Quê quán' })).toContainText('Chưa có đối chiếu');
  const birthplace = rows.filter({ hasText: 'Nơi sinh' });
  await expect(birthplace).toContainText('Nhiều xã/phường mới');
  await birthplace.getByLabel(`Xã/phường mới của ${fullName} – Nơi sinh`).selectOption({ label: 'Phường Phú Lợi' });

  // Mở rộng tìm kiếm theo tình trạng
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await grid.getByRole('combobox', { name: /^Tình trạng/ }).selectOption({ label: 'Chưa có đối chiếu' });
  await expect(rows).toHaveCount(1);
  await grid.getByRole('combobox', { name: /^Tình trạng/ }).selectOption({ label: 'Tất cả' });
  await expect(rows).toHaveCount(3);

  await grid.getByLabel(`Chọn ${fullName} – Thường trú`).check();
  await grid.getByLabel(`Chọn ${fullName} – Nơi sinh`).check();
  await grid.getByRole('button', { name: 'Chuyển địa danh mới' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Chuyển địa danh mới' });
  await expect(dialog).toContainText('Chuyển 2 địa chỉ đã chọn');
  await dialog.getByRole('button', { name: 'Chuyển', exact: true }).click();
  await expect(page.getByText('Đã chuyển 2 địa chỉ của 1 học sinh sang địa danh mới')).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Quê quán');

  const saved = await schoolYear
    .selectFrom('children')
    .select('moet_profile')
    .where('id', '=', childId)
    .executeTakeFirstOrThrow();
  const profile = saved.moet_profile as Record<string, unknown>;
  expect([
    profile.permanent_ward,
    profile.permanent_district,
    profile.birthplace_ward,
    profile.birthplace_province,
  ]).toEqual(['Phường Sài Gòn', undefined, 'Phường Phú Lợi', 'Thành phố Hồ Chí Minh']);
  const log = await schoolYear
    .selectFrom('audit_logs')
    .select('before_data')
    .where('entity_name', '=', 'children')
    .where('entity_id', '=', childId)
    .executeTakeFirstOrThrow();
  expect(JSON.stringify(log.before_data)).toContain('Phường Bến Nghé');
});

test('CT-15h1-10: nhập bảng đối chiếu từ Excel, địa chỉ chưa có đối chiếu có đề xuất; giáo viên không có mục menu', async ({
  page,
  browser,
}) => {
  await signIn(page, 'VT-02', null);
  const grid = await openAddresses(page);
  const hometown = grid.getByRole('row').filter({ hasText: token }).filter({ hasText: 'Quê quán' });
  await expect(hometown).toContainText('Chưa có đối chiếu');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bảng đối chiếu');
  sheet.addRow([
    'Tỉnh/Thành phố cũ',
    'Quận/Huyện cũ',
    'Xã/Phường cũ',
    'Mã xã/phường cũ',
    'Tỉnh/Thành phố mới',
    'Xã/Phường mới',
    'Mã xã/phường mới',
  ]);
  sheet.addRow([testProvince, 'Huyện Thử', testWard, '', testProvince, `Xã Mới ${suffix}`, '']);
  const mappings = page.getByRole('region', { name: 'Bảng đối chiếu địa danh', exact: true });
  await mappings.getByLabel('Tệp bảng đối chiếu').setInputFiles({
    name: 'bang-doi-chieu.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await mappings.getByRole('button', { name: 'Nhập từ Excel' }).click();
  await expect(mappings).toContainText('Đã ghi dữ liệu');
  await expect(mappings).toContainText('thêm 4 đơn vị, 1 dòng đối chiếu');
  await expect(hometown).toContainText('Có đề xuất');
  await expect(hometown).toContainText(`Xã Mới ${suffix}`);
  await mappings.getByLabel('Tìm theo tên xã/phường, quận/huyện').fill(testWard);
  await expect(mappings.getByRole('row').filter({ hasText: `Xã Mới ${suffix}` })).toHaveCount(1);

  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  const reference = await schoolYear.selectFrom('classes').select('org_unit_id').executeTakeFirstOrThrow();
  await signIn(teacher, 'VT-07', reference.org_unit_id);
  await expectNoMenuLink(teacher, '/administrative-units');
  await teacherContext.close();
});
