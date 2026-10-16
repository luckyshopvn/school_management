import { expect, test, type Locator, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { portalMenuText } from '@school-management/shared';
import ExcelJS from 'exceljs';
import { findMenuEntry, openMenu } from './menu.js';

// Phân hệ Quản trị hệ thống theo Sở (DT-15 phần 15e, YCTD-109): 1.1 Nhóm người dùng, 1.3 Phân quyền nhóm theo menu,
// 1.4 Danh sách người dùng, tiêu đề có số menu của các màn hình quản trị khác. Chạy sau 02-academic-years và
// 03-org-units. Dữ liệu là dữ liệu giả của riêng kịch bản này
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function loginWith(page: Page, loginIdentifier: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(loginIdentifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

const titleOf = (path: string) => portalMenuText(findMenuEntry(path).node);

// Bấm Xuất Excel trên lưới, đọc mọi dòng của bảng tính đầu tiên (DT-16 phần 16b)
async function exportedRows(page: Page, grid: Locator, fileName: RegExp): Promise<string[][]> {
  const downloading = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(fileName);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  const rows: string[][] = [];
  workbook.worksheets[0]?.eachRow((row) => {
    rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
  });
  return rows;
}

test('CT-15e-10, CT-15e-11: thêm nhóm người dùng, tích mục menu để chọn quyền của mục, ghi; người dùng của nhóm thấy mục đó', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);

  // 1.1 Nhóm người dùng: lưới với cột theo Sở
  await openMenu(page, '/roles');
  await expect(page.getByRole('heading', { name: '1.1. Nhóm người dùng', exact: true })).toBeVisible();
  const grid = page.getByRole('region', { name: 'Danh sách nhóm người dùng' });
  await expect(grid.getByRole('columnheader')).toHaveText([
    'Mã nhóm',
    'Tên nhóm',
    'Hiệu lực',
    'Là nhóm quản trị',
    'Là nhóm hệ thống',
    'Thao tác',
  ]);
  await grid.getByLabel('Tìm theo mã, tên nhóm').fill('VT-02');
  const principalRow = grid.getByRole('row').filter({ hasText: 'Hiệu trưởng' });
  await expect(principalRow.getByRole('cell')).toHaveText(['VT-02', 'Hiệu trưởng', 'Có', 'Có', 'Có', 'Phân quyền']);

  // Thêm nhóm: biểu mẫu nhãn bên trái, nút Ghi
  const code = `E2E-${Date.now() % 1_000_000}`;
  await grid.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm nhóm người dùng' });
  await form.getByLabel('Mã nhóm').fill(code);
  await form.getByLabel('Tên nhóm').fill('Nhóm thử phân quyền theo menu');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã thêm nhóm người dùng ${code}` })).toBeVisible();
  await grid.getByLabel('Tìm theo mã, tên nhóm').fill(code);
  const row = grid.getByRole('row').filter({ hasText: code });
  await expect(row.getByRole('cell')).toHaveText([code, 'Nhóm thử phân quyền theo menu', 'Có', '', '', 'Phân quyền']);

  // 1.3 mở sẵn nhóm vừa thêm; tích mục 1.4 là chọn cả hai quyền của mục, bỏ một quyền thì mục lưng chừng
  await row.getByRole('button', { name: `Phân quyền ${code}` }).click();
  await expect(page).toHaveURL(/\/role-permissions\?role=/);
  await expect(page.getByRole('heading', { name: '1.3. Phân quyền nhóm theo menu', exact: true })).toBeVisible();
  const matrix = page.getByRole('region', { name: `Quyền của ${code}` });
  await expect(matrix.getByText('Đã chọn 0/')).toBeVisible();
  const item = matrix.getByRole('listitem', { name: 'Mục 1.4. Danh sách người dùng' });
  const itemBox = item.getByRole('checkbox', { name: 'Chọn mục 1.4. Danh sách người dùng' });
  await itemBox.check();
  await expect(item.getByRole('checkbox', { name: /\(P01\.account\.manage\)/ })).toBeChecked();
  await expect(item.getByRole('checkbox', { name: /\(P01\.account\.manage-in-unit\)/ })).toBeChecked();
  // Cùng quyền ở mục khác (1.1 Nhóm người dùng) cũng được chọn theo
  const rolesItem = matrix.getByRole('listitem', { name: 'Mục 1.1. Nhóm người dùng' });
  await expect(rolesItem.getByRole('checkbox', { name: 'Chọn mục 1.1. Nhóm người dùng' })).toBeChecked();
  await item.getByRole('checkbox', { name: /\(P01\.account\.manage-in-unit\)/ }).uncheck();
  await expect(itemBox).not.toBeChecked();
  expect(await itemBox.evaluate((element) => (element as { indeterminate?: boolean }).indeterminate)).toBe(true);
  await expect(matrix.getByText('Đã chọn 1/')).toBeVisible();
  // Quyền không gắn mục menu nào nằm ở Quyền khác
  await expect(matrix.getByRole('region', { name: 'Quyền khác' })).toBeVisible();
  await matrix.getByRole('button', { name: 'Ghi', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: `Đã ghi quyền của ${code}` })).toBeVisible();

  // Tải lại vẫn thấy quyền đã ghi
  await page.reload();
  const reloaded = page.getByRole('region', { name: `Quyền của ${code}` });
  await expect(reloaded.getByText('Đã chọn 1/')).toBeVisible();
  await expect(
    reloaded
      .getByRole('listitem', { name: 'Mục 1.4. Danh sách người dùng' })
      .getByRole('checkbox', { name: /\(P01\.account\.manage\)/ }),
  ).toBeChecked();

  // Người dùng của nhóm mới thấy và mở được 1.4 Danh sách người dùng
  const member = await createTestUser(database, { roles: [{ roleCode: code, orgUnitId: null }] });
  const memberPage = await (await browser.newContext()).newPage();
  await loginWith(memberPage, member.username, member.password);
  await openMenu(memberPage, '/accounts');
  await expect(memberPage.getByRole('heading', { name: '1.4. Danh sách người dùng', exact: true })).toBeVisible();
  await memberPage.context().close();
});

test('CT-15e-12: 1.4 Danh sách người dùng lọc theo nhóm quyền, trạng thái đổi mật khẩu, tên đăng nhập, tên nhân sự', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const tag = `Loc15e${Date.now() % 1_000_000}`;
  const keys = ['GV1', 'GV2', 'NV1'];
  const ids: Record<string, string> = {};
  for (const key of keys) {
    const user = await createTestUser(database, {
      roles: [{ roleCode: key.startsWith('GV') ? 'VT-07' : 'VT-08', orgUnitId: null }],
      mustChangePassword: key === 'GV2',
    });
    await database
      .updateTable('users')
      .set({ full_name: `${tag} ${key}`, username: `${tag.toLowerCase()}_${key.toLowerCase()}` })
      .where('id', '=', user.id)
      .execute();
    ids[key] = user.id;
  }
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/accounts');
  await expect(page.getByRole('heading', { name: '1.4. Danh sách người dùng', exact: true })).toBeVisible();
  const grid = page.getByRole('region', { name: 'Danh sách người dùng' });
  const slow = { timeout: 30_000 };
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  const filters = grid.getByRole('region', { name: 'Mở rộng tìm kiếm' });
  await filters.getByLabel('Tên nhân sự').fill(tag);
  await expect(grid.getByText('Tổng 3 dòng')).toBeVisible(slow);
  const first = grid.getByRole('row').filter({ hasText: `${tag} GV1` });
  await expect(first.getByRole('cell').nth(1)).toHaveText(`${tag.toLowerCase()}_gv1`);
  await expect(first).toContainText('Giáo viên chủ nhiệm');
  await expect(first).toContainText('Cán bộ, nhân viên');
  await expect(first).toContainText('Đã đổi');

  await filters.getByLabel('Nhóm quyền').selectOption({ label: 'VT-07 Giáo viên chủ nhiệm' });
  await expect(grid.getByText('Tổng 2 dòng')).toBeVisible(slow);
  await filters.getByLabel('Trạng thái đổi mật khẩu').selectOption('true');
  await expect(grid.getByText('Tổng 1 dòng')).toBeVisible(slow);
  await expect(grid.getByRole('row').filter({ hasText: `${tag} GV2` })).toContainText('Chờ đổi mật khẩu');

  await filters.getByLabel('Nhóm quyền').selectOption('');
  await filters.getByLabel('Trạng thái đổi mật khẩu').selectOption('');
  await filters.getByLabel('Tên đăng nhập').fill(`${tag.toLowerCase()}_nv`);
  await expect(grid.getByText('Tổng 1 dòng')).toBeVisible(slow);
  await expect(grid.getByRole('row').filter({ hasText: `${tag} NV1` })).toBeVisible();

  // CT-16b-6: Xuất Excel 1.4 theo bộ lọc đang chọn và 1.1 theo từ khóa (DT-16 phần 16b)
  const accountRows = await exportedRows(page, grid, /^danh-sach-nguoi-dung-.*\.xlsx$/);
  expect(accountRows[0]).toEqual([
    'STT',
    'Tên đăng nhập',
    'Tên hiển thị',
    'Nhóm quyền',
    'Loại tài khoản',
    'Trạng thái',
    'Trạng thái đổi mật khẩu',
  ]);
  expect(accountRows.slice(1).map((row) => row[2])).toEqual([`${tag} NV1`]);
  await openMenu(page, '/roles');
  const roles = page.getByRole('region', { name: 'Danh sách nhóm người dùng' });
  await roles.getByLabel('Tìm theo mã, tên nhóm').fill('VT-07');
  const roleRows = await exportedRows(page, roles, /^nhom-nguoi-dung-.*\.xlsx$/);
  expect(roleRows[0]).toEqual(['STT', 'Mã nhóm', 'Tên nhóm', 'Hiệu lực', 'Là nhóm quản trị', 'Là nhóm hệ thống']);
  expect(roleRows.slice(1).map((row) => row[1])).toEqual(['VT-07']);
});

test('CT-15e-13: quản lý theo đơn vị xem được 1.3 nhưng không sửa được quyền', async ({ page }) => {
  const manager = await createTestUser(database, { roles: [{ roleCode: 'VT-03', orgUnitId: null }] });
  await loginWith(page, manager.username, manager.password);
  await openMenu(page, '/role-permissions');
  await expect(page.getByText('Chỉ Hiệu trưởng và quản trị nền tảng sửa được quyền')).toBeVisible();
  const matrix = page.getByRole('region', { name: /^Quyền của / });
  await expect(matrix.getByRole('button', { name: 'Ghi', exact: true })).toHaveCount(0);
  await expect(matrix.getByRole('checkbox').first()).toBeDisabled();
});

test('CT-15e-14: các màn hình quản trị có tiêu đề kèm số menu; Khóa API và Nhật ký thao tác trên lưới dữ liệu', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);
  for (const path of [
    '/academic-years',
    '/org-units',
    '/departments',
    '/catalogs',
    '/rooms',
    '/approval-thresholds',
    '/api-clients',
    '/integrations',
    '/audit-logs',
  ]) {
    await openMenu(page, path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titleOf(path));
  }
  expect(titleOf('/audit-logs')).toBe('3.3. Nhật ký thao tác');

  // Nhật ký thao tác: lưới phân trang ở máy chủ, lọc khoảng ngày ở Mở rộng tìm kiếm
  const logs = page.getByRole('region', { name: 'Nhật ký nghiệp vụ' });
  await expect(logs.getByRole('columnheader')).toHaveText([
    'Thời điểm',
    'Người thực hiện',
    'Đối tượng',
    'Thao tác',
    'Nội dung thay đổi',
  ]);
  await logs.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await logs.getByLabel('Từ ngày').fill('2100-01-01');
  await expect(logs.getByText('Tổng 0 dòng')).toBeVisible();
  await logs.getByLabel('Từ ngày').fill('');
  await expect(logs.getByText(/^Tổng [1-9]\d* dòng$/)).toBeVisible();
  await page.getByRole('tab', { name: 'Tài khoản và quyền' }).click();
  await expect(page.getByRole('region', { name: 'Nhật ký tài khoản và quyền' })).toBeVisible();

  await openMenu(page, '/api-clients');
  await expect(page.getByRole('region', { name: 'Danh sách khóa API' }).getByRole('columnheader')).toHaveText([
    'Đối tác',
    'Phạm vi',
    'Khóa',
    'Hết hạn',
    'Trạng thái',
    'Thao tác',
  ]);
});
