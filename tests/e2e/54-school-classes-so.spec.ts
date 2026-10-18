import { expect, test, type Locator, type Page } from './fixtures.js';
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
import { expectNoMenuLink, logout, openMenu } from './menu.js';

// Trường học, lớp học theo hệ thống của Sở (DT-15 phần 15b, YCTD-111): 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường,
// 2.1 Hồ sơ lớp học trên lưới với biểu mẫu theo khối, 2.2 Nhập lớp học từ Excel, 3.3 Phân công phụ trách lớp. Chạy sau
// 03-org-units, 06-catalogs và 08-classes (Phân hiệu A, Điểm trường A1, bậc học Mầm, lớp Mầm 1). Dữ liệu là dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const suffix = Date.now() % 1_000_000;
const className = `Chồi Sở ${suffix}`;
const siteName = `Điểm trường Sở ${suffix}`;

test.afterAll(async () => {
  await identity.destroy();
});

async function findUnitId(name: string): Promise<string> {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  const schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  try {
    return (await schoolYear.selectFrom('org_units').select('id').where('name', '=', name).executeTakeFirstOrThrow())
      .id;
  } finally {
    await schoolYear.destroy();
  }
}

async function signIn(page: Page, roleCode: string, unit: string | null) {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: unit }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function headerOf(page: Page, grid: Locator, fileName: RegExp): Promise<string[]> {
  const downloading = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(fileName);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  return Array.from((workbook.worksheets[0]?.getRow(1).values as unknown[]).slice(1), (value) => String(value ?? ''));
}

test('CT-15b-8: 1.2 và 1.3 liệt kê phân hiệu, điểm trường theo cột của Sở; thêm, sửa khoảng cách, diện tích bằng nút Ghi', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  await openMenu(page, 'Quản lý phân hiệu', { exact: true });
  await expect(page.getByRole('heading', { name: '1.2. Quản lý phân hiệu', exact: true })).toBeVisible();
  const branches = page.getByRole('region', { name: 'Danh sách phân hiệu' });
  await expect(branches.getByRole('columnheader')).toContainText([
    'Mã',
    'Tên',
    'Địa chỉ',
    'Khoảng cách đến cơ sở chính (km)',
    'Diện tích (m²)',
    'Điện thoại',
  ]);
  const branch = branches.getByRole('row').filter({ hasText: 'Phân hiệu A' });
  await expect(branch).toBeVisible();
  await expect(branches.getByRole('row').filter({ hasText: 'Điểm trường A1' })).toHaveCount(0);

  await branch.getByRole('button', { name: 'Sửa' }).click();
  const edit = page.getByRole('form', { name: 'Sửa phân hiệu Phân hiệu A' });
  await edit.getByLabel('Khoảng cách đến cơ sở chính (km)').fill('2,5');
  await edit.getByLabel('Diện tích (m²)').fill('1500');
  await edit.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã ghi phân hiệu Phân hiệu A' })).toBeVisible();
  await expect(branch).toContainText('2,5');
  await expect(branch).toContainText('1.500');

  await openMenu(page, '/school-sites');
  await expect(page.getByRole('heading', { name: '1.3. Quản lý điểm trường', exact: true })).toBeVisible();
  const sites = page.getByRole('region', { name: 'Danh sách điểm trường' });
  await expect(sites.getByRole('row').filter({ hasText: 'Điểm trường A1' })).toBeVisible();
  await sites.getByRole('button', { name: 'Thêm mới' }).click();
  const create = page.getByRole('form', { name: 'Thêm mới điểm trường' });
  await create.getByLabel('Mã').fill(`DT-S${suffix}`);
  await create.getByLabel('Tên').fill(siteName);
  await create.getByLabel('Khoảng cách đến cơ sở chính (km)').fill('abc');
  await create.getByRole('button', { name: 'Ghi' }).click();
  await expect(create.getByText('Phải là số từ 0 đến 999999', { exact: true })).toBeVisible();
  await create.getByLabel('Khoảng cách đến cơ sở chính (km)').fill('4');
  await create.getByLabel('Điện thoại').fill('0280000054');
  await create.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã tạo điểm trường ${siteName}` })).toBeVisible();
  await expect(sites.getByRole('row').filter({ hasText: siteName })).toContainText('0280000054');

  // CT-16b-5: Xuất Excel 1.3 và 1.2 theo các cột đang hiện trên lưới (DT-16 phần 16b)
  expect(await headerOf(page, sites, /^danh-sach-diem-truong-.*\.xlsx$/)).toEqual([
    'STT',
    'Mã',
    'Tên',
    'Địa chỉ',
    'Khoảng cách đến cơ sở chính (km)',
    'Diện tích (m²)',
    'Điện thoại',
    'Trạng thái',
  ]);
  await openMenu(page, 'Quản lý phân hiệu', { exact: true });
  expect(await headerOf(page, branches, /^danh-sach-phan-hieu-.*\.xlsx$/)).toContain(
    'Khoảng cách đến cơ sở chính (km)',
  );
});

test('CT-15b-9: 2.1 Hồ sơ lớp học: cột của Sở, thêm lớp theo khối, quy tắc lớp ghép, mở rộng tìm kiếm, xuất Excel', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  const siteId = await findUnitId('Điểm trường A1');
  await openMenu(page, '/classes');
  const grid = page.getByRole('region', { name: 'Danh sách lớp' });
  // Cột hiện, ẩn mặc định và 50 dòng mỗi trang như màn hình 2.1 của Sở (YCTD-117)
  const headers = grid.getByRole('columnheader');
  for (const header of [
    'Mã lớp',
    'Tên lớp',
    'Nhóm lớp',
    'Nhóm trẻ',
    'Nhóm tuổi',
    'Thứ tự',
    'Số học sinh',
    'Học 2 buổi/ngày',
    'Lớp ghép',
    'Ghép vào lớp',
    'Lớp bán trú',
    'Lớp giải thể',
  ]) {
    await expect(headers.filter({ hasText: header }).first()).toBeVisible();
  }
  for (const header of ['Phân hiệu', 'Giáo viên chủ nhiệm', 'Điểm trường', 'Phòng học']) {
    await expect(headers.filter({ hasText: header })).toHaveCount(0);
  }
  await expect(grid.getByLabel('Số dòng mỗi trang')).toHaveValue('50');

  await grid.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm mới lớp học' });
  await expect(form.getByRole('group', { name: 'Thông tin chung' })).toBeVisible();
  await expect(form.getByRole('group', { name: 'Thông tin khác' })).toBeVisible();
  await form.getByLabel('Đơn vị').selectOption(siteId);
  await form.getByLabel('Mã lớp').fill(`CS${suffix}`);
  await form.getByLabel('Tên lớp').fill(className);
  await form.getByLabel('Khối').selectOption({ label: 'Mầm' });
  // Nhóm trẻ không ghép độ tuổi (lỗi quy tắc YCTD-111)
  await form.getByLabel('Nhóm tuổi').selectOption({ label: 'Nhóm trẻ 25–36 tháng' });
  await form.getByLabel('Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi').selectOption({ label: 'Ghép 2 độ tuổi' });
  await form.getByLabel('Sĩ số tối đa').fill('30');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(form.getByRole('alert')).toContainText('Chỉ lớp mẫu giáo mới ghép 2 hoặc 3 độ tuổi');
  await form.getByLabel('Nhóm tuổi').selectOption({ label: 'Mẫu giáo 3–4 tuổi' });
  await form.getByLabel('Thứ tự').fill('1');
  await form.getByLabel('Học 2 buổi/ngày').check();
  await form.getByLabel('Lớp bán trú').check();
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã tạo lớp ${className}` })).toBeVisible();
  const row = grid.getByRole('row', { name: `Lớp ${className}`, exact: true });
  await expect(row).toContainText('Lớp mẫu giáo');
  await expect(row).toContainText('3–4 tuổi');
  await expect(row).toContainText('0/30');

  // Sửa: lớp ghép vào lớp khác của cùng đơn vị không có lựa chọn nên chỉ đánh dấu lớp ghép
  await row.getByRole('button', { name: 'Sửa' }).click();
  const edit = grid.getByRole('form', { name: `Sửa lớp ${className}` });
  await expect(edit.getByLabel('Ghép vào lớp')).toBeDisabled();
  await edit.getByLabel('Lớp ghép').check();
  await expect(edit.getByLabel('Ghép vào lớp')).toBeEnabled();
  await edit.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã ghi lớp ${className}` })).toBeVisible();

  // Mở rộng tìm kiếm: lớp bán trú, lớp ghép
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await grid.getByRole('combobox', { name: /^Lớp bán trú/ }).selectOption({ label: 'Có' });
  await grid.getByRole('combobox', { name: /^Lớp ghép/ }).selectOption({ label: 'Có' });
  await expect(row).toBeVisible();
  await expect(grid.getByRole('row', { name: 'Lớp Mầm 1', exact: true })).toHaveCount(0);

  // Bật cột Điểm trường (ẩn mặc định) rồi xuất Excel đúng các cột đang hiện
  await grid.getByRole('button', { name: 'Cấu hình cột hiển thị' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cấu hình cột hiển thị' });
  await dialog.getByRole('checkbox', { name: 'Điểm trường', exact: true }).check();
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  await expect(row).toContainText('Điểm trường A1');
  const header = await headerOf(page, grid, /^danh-sach-lop-.*\.xlsx$/);
  expect(header.slice(0, 4)).toEqual(['STT', 'Mã lớp', 'Tên lớp', 'Khối']);
  expect(header).not.toContain('Phân hiệu');
  expect(header).toContain('Lớp ghép');
  expect(header).toContain('Điểm trường');
});

test('CT-15b-10: 3.3 Phân công phụ trách lớp: liệt kê, thêm mới, kết thúc phân công, xuất Excel', async ({ page }) => {
  const siteId = await findUnitId('Điểm trường A1');
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: siteId }] });
  const teacherName = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
  await signIn(page, 'VT-02', null);
  await openMenu(page, '/class-assignments');
  await expect(page.getByRole('heading', { name: '3.3. Phân công phụ trách lớp', exact: true })).toBeVisible();
  const grid = page.getByRole('region', { name: 'Danh sách phân công phụ trách lớp' });
  // Giáo viên chủ nhiệm của Mầm 1 phân công ở 08-classes
  await expect(grid.getByRole('row').filter({ hasText: 'Mầm 1' }).first()).toContainText('Chủ nhiệm');

  await grid.getByRole('button', { name: 'Thêm mới' }).click();
  const create = page.getByRole('region', { name: 'Thêm mới phân công' });
  await create.getByLabel('Lớp', { exact: true }).selectOption({ label: `${className} (Điểm trường A1)` });
  const staff = create.getByRole('region', { name: `Giáo viên lớp ${className}` });
  await staff.getByRole('combobox', { name: /^Giáo viên/ }).selectOption({ label: teacherName });
  await staff.getByRole('button', { name: 'Phân công' }).click();
  const assigned = grid.getByRole('row').filter({ hasText: teacherName });
  await expect(assigned).toContainText(className);
  await expect(assigned).toContainText('Điểm trường A1');

  await grid.getByLabel('Tìm theo tên giáo viên').fill(teacherName);
  await expect(grid.getByRole('row').filter({ hasText: 'Mầm 1' })).toHaveCount(0);
  const header = await headerOf(page, grid, /^phan-cong-phu-trach-lop-.*\.xlsx$/);
  expect(header).toEqual(['STT', 'Giáo viên', 'Vai trò trong lớp', 'Môn dạy', 'Lớp', 'Khối', 'Đơn vị', 'Từ ngày']);

  await assigned.getByRole('button', { name: 'Kết thúc phân công' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kết thúc phân công' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã kết thúc phân công' })).toBeVisible();
  // Từ DT-16 phần 16e giáo viên chưa phụ trách lớp nào vẫn có một dòng "Chưa phân công"
  await expect(grid.getByRole('row').filter({ hasText: teacherName })).toHaveCount(1);
  await expect(grid.getByRole('row').filter({ hasText: teacherName })).toContainText('Chưa phân công');
  await expect(grid.getByRole('row').filter({ hasText: teacherName })).not.toContainText(className);
});

test('CT-15b-11: 2.2 Nhập lớp học từ Excel tách riêng; giáo viên không có mục nhập lớp, không phân công được', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  await openMenu(page, 'Nhập lớp học từ Excel', { exact: true });
  await expect(page.getByRole('heading', { name: '2.2. Nhập lớp học từ Excel', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lớp học' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Lớp học' }).getByRole('button', { name: 'Tải file mẫu', exact: true }),
  ).toBeVisible();

  const unitId = await findUnitId('Phân hiệu A');
  await logout(page);
  await signIn(page, 'VT-07', unitId);
  await expectNoMenuLink(page, '/class-imports');
  await openMenu(page, '/class-assignments');
  const grid = page.getByRole('region', { name: 'Danh sách phân công phụ trách lớp' });
  await expect(grid.getByRole('row').filter({ hasText: 'Mầm 1' }).first()).toBeVisible();
  await expect(grid.getByRole('button', { name: 'Thêm mới' })).toHaveCount(0);
  await expect(grid.getByRole('button', { name: 'Kết thúc phân công' })).toHaveCount(0);
});
