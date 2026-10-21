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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Quản trị hệ thống đủ theo Sở (DT-16 phần 16d): 1.1 sửa, ngừng hiệu lực, xóa nhóm; 1.2 phân quyền nhóm theo phần mềm;
// 1.4 Lấy danh sách CBQL/GV, Cấp mật khẩu, Phân nhóm quyền, Xuất Excel, cột Mã nhân sự, Mã Bộ; 1.6 tài khoản đồng bộ của
// Bộ, của Sở. Chạy sau 02-academic-years, 03-org-units. Dữ liệu là dữ liệu giả của riêng kịch bản này
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function loginWith(page: Page, loginIdentifier: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(loginIdentifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

// Hộp thoại xác nhận chung (ConfirmDialog) không có tên truy cập; tìm theo tiêu đề
function dialogTitled(page: Page, title: string) {
  return page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

async function addRole(page: Page, code: string, name: string) {
  const grid = page.getByRole('region', { name: 'Danh sách nhóm người dùng' });
  await grid.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm nhóm người dùng' });
  await form.getByLabel('Mã nhóm').fill(code);
  await form.getByLabel('Tên nhóm').fill(name);
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã thêm nhóm người dùng ${code}` })).toBeVisible();
}

test('CT-16d-11: 1.1 sửa tên, ngừng hiệu lực nhóm; không xóa được nhóm đang có người dùng; xóa nhóm trống', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/roles');
  const grid = page.getByRole('region', { name: 'Danh sách nhóm người dùng' });
  const stamp = Date.now() % 1_000_000;
  const used = `E2E-SD${stamp}`;
  const empty = `E2E-XD${stamp}`;
  await addRole(page, used, 'Nhóm thử sửa');
  await addRole(page, empty, 'Nhóm thử xóa');
  // Nhóm mới có một người dùng
  await createTestUser(identity, { roles: [{ roleCode: used, orgUnitId: null }] });

  const search = grid.getByLabel('Tìm theo mã, tên nhóm');
  await search.fill(used);
  const row = grid.getByRole('row').filter({ hasText: used });
  await row.getByRole('button', { name: `Sửa ${used}` }).click();
  const form = page.getByRole('form', { name: `Sửa nhóm người dùng ${used}` });
  await expect(form.getByLabel('Mã nhóm')).toHaveAttribute('readonly', '');
  await form.getByLabel('Tên nhóm').fill('Nhóm thử đã sửa');
  await form.getByRole('checkbox', { name: /Nhóm đang có hiệu lực/ }).uncheck();
  await expect(form.getByText('mất mọi quyền và phân hệ của nhóm này')).toBeVisible();
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã ghi nhóm người dùng ${used}` })).toBeVisible();
  await expect(row.getByRole('cell')).toHaveText([used, 'Nhóm thử đã sửa', 'Không', '', '', 'SửaPhân quyềnXóa']);

  // Nhóm đang có người dùng: hộp xác nhận xóa, máy chủ báo lỗi quy tắc
  await row.getByRole('button', { name: `Xóa ${used}` }).click();
  let dialog = page.getByRole('dialog', { name: 'Xóa nhóm người dùng' });
  await dialog.getByLabel(/^Tôi đã đọc và đồng ý xóa/).check();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'đang có 1 người dùng' })).toBeVisible();

  // Nhóm hệ thống không có nút Xóa, hiệu lực không tắt được
  await search.fill('VT-07');
  const systemRow = grid.getByRole('row').filter({ hasText: 'Giáo viên chủ nhiệm' });
  await expect(systemRow.getByRole('button', { name: 'Xóa VT-07' })).toHaveCount(0);

  await search.fill(empty);
  await grid
    .getByRole('row')
    .filter({ hasText: empty })
    .getByRole('button', { name: `Xóa ${empty}` })
    .click();
  dialog = page.getByRole('dialog', { name: 'Xóa nhóm người dùng' });
  await dialog.getByLabel(/^Tôi đã đọc và đồng ý xóa/).check();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã xóa nhóm người dùng ${empty}` })).toBeVisible();
  await expect(grid.getByText('Không có nhóm người dùng phù hợp.')).toBeVisible();
});

test('CT-16d-12: 1.2 bỏ phân hệ của nhóm thì người dùng của nhóm không còn thấy phân hệ đó', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const member = await createTestUser(identity, { roles: [{ roleCode: 'VT-19', orgUnitId: null }] });
  // VT-19 thấy Báo cáo; trước khi bỏ phân hệ, ô chọn phân hệ có "Báo cáo"
  const memberPage = await browser.newPage();
  await loginWith(memberPage, member.username, member.password);
  await memberPage.getByRole('button', { name: /^Phân hệ: / }).click();
  await expect(memberPage.getByRole('menuitemradio', { name: 'Báo cáo', exact: true })).toBeVisible();

  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/role-workspaces');
  await expect(page.getByRole('heading', { name: '1.2. Phân quyền nhóm theo phần mềm', exact: true })).toBeVisible();
  await page.getByLabel('Nhóm người dùng').selectOption({ label: 'VT-19 Cán bộ quản lý cấp trên' });
  const section = page.getByRole('region', { name: 'Phân hệ của VT-19' });
  const reports = section.getByRole('checkbox', { name: 'Báo cáo', exact: true });
  await expect(reports).toBeChecked();
  try {
    await reports.uncheck();
    await expect(section.getByText('Đã chọn 16/17 phân hệ')).toBeVisible();
    await section.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã ghi phân hệ của nhóm VT-19' })).toBeVisible();

    await memberPage.reload();
    await memberPage.getByRole('button', { name: /^Phân hệ: / }).click();
    await expect(memberPage.getByRole('menuitemradio', { name: 'Báo cáo', exact: true })).toHaveCount(0);
  } finally {
    // Trả lại phân hệ để các kịch bản khác không bị ảnh hưởng
    await section.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
    await section.getByRole('button', { name: 'Ghi' }).click();
    await expect(section.getByText('Đã chọn 17/17 phân hệ')).toBeVisible();
    await memberPage.close();
  }
});

test('CT-16d-13: 1.4 lấy danh sách CBQL/GV, cột mã nhân sự, mã Bộ, lọc mã định danh, cấp mật khẩu, phân nhóm quyền, xuất Excel', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const stamp = Date.now() % 1_000_000;
  const staffCode = `GV16D${stamp}`;
  const staffName = `Giáo viên thử 16d ${stamp}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unit.id,
      code: staffCode,
      full_name: staffName,
      start_date: '2026-09-01',
      moet_staff_code: `MB16D${stamp}`,
    })
    .execute();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/accounts');
  const grid = page.getByRole('region', { name: 'Danh sách người dùng' });
  const slow = { timeout: 30_000 };

  // Lấy danh sách CBQL/GV: chỉ chọn nhân sự của kịch bản này
  await grid.getByRole('button', { name: 'Lấy danh sách CBQL/GV' }).click();
  let dialog = dialogTitled(page, 'Lấy danh sách CBQL/GV');
  const table = dialog.getByRole('table', { name: 'Nhân sự chưa có tài khoản' });
  await expect(table.getByRole('row').filter({ hasText: staffCode })).toBeVisible(slow);
  for (const box of await table.getByRole('checkbox').all()) {
    const label = (await box.getAttribute('aria-label')) ?? '';
    if (!label.includes(staffCode)) {
      await box.uncheck();
    }
  }
  await dialog.getByLabel('Nhóm quyền').selectOption('VT-07');
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
  dialog = dialogTitled(page, 'Kết quả lấy danh sách CBQL/GV');
  await expect(dialog.getByText('Đã tạo 1/1 tài khoản')).toBeVisible(slow);
  await expect(dialog.getByTestId('bulk-temporary-password')).toHaveText(/^[A-Za-z0-9]{12}$/);
  await dialog.getByRole('button', { name: 'Đã ghi lại' }).click();

  // Lọc theo mã định danh (mã Bộ); dòng có mã nhân sự, mã Bộ
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  const filters = grid.getByRole('region', { name: 'Mở rộng tìm kiếm' });
  await filters.getByLabel('Mã định danh').fill(`mb16d${stamp}`);
  await expect(grid.getByText('Tổng 1 dòng')).toBeVisible(slow);
  const row = grid.getByRole('row').filter({ hasText: staffName });
  await expect(row).toContainText(staffCode);
  await expect(row).toContainText(`MB16D${stamp}`);
  await expect(row).toContainText('Chờ đổi mật khẩu');

  // Cấp mật khẩu cho dòng đã chọn
  await row.getByRole('checkbox').check();
  await grid.getByRole('button', { name: 'Cấp mật khẩu' }).click();
  dialog = dialogTitled(page, 'Cấp mật khẩu cho 1 tài khoản?');
  await dialog.getByRole('button', { name: 'Cấp mật khẩu' }).click();
  dialog = dialogTitled(page, 'Mật khẩu tạm');
  await expect(dialog.getByTestId('bulk-temporary-password')).toHaveText(/^[A-Za-z0-9]{12}$/);
  await dialog.getByRole('button', { name: 'Đã ghi lại' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã cấp mật khẩu cho 1 tài khoản' })).toBeVisible();

  // Phân nhóm quyền: thêm Nhân viên y tế ở đơn vị của nhân sự
  await row.getByRole('checkbox').check();
  await grid.getByRole('button', { name: 'Phân nhóm quyền' }).click();
  dialog = dialogTitled(page, 'Phân nhóm quyền cho 1 tài khoản');
  await dialog.getByLabel('Vai trò').selectOption('VT-09');
  await dialog.getByLabel('Đơn vị').selectOption(unit.id);
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  dialog = dialogTitled(page, 'Kết quả phân nhóm quyền');
  await expect(dialog.getByText('Đã gán nhóm cho 1/1 tài khoản')).toBeVisible(slow);
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(row).toContainText('Nhân viên y tế', slow);

  // Xuất Excel theo bộ lọc và cột đang hiện
  const download = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/^danh-sach-nguoi-dung-.*\.xlsx$/);
});

test('CT-16d-14: 1.6 tài khoản đồng bộ của Bộ, của Sở ghi tên đăng nhập, mật khẩu; mật khẩu không hiện lại', async ({
  page,
}) => {
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/sync-accounts');
  await expect(page.getByRole('heading', { name: '1.6. Tài khoản đồng bộ của Bộ, của Sở', exact: true })).toBeVisible();
  await expect(page.getByText('chưa đồng bộ được vì chưa có giao diện lập trình của Bộ, Sở')).toBeVisible();
  const form = page.getByRole('form', { name: 'Tài khoản đồng bộ của Sở GD&ĐT' });
  await form.getByLabel('Tên đăng nhập').fill('truong.e2e');
  await form.getByLabel('Mật khẩu').fill('Mat-khau-thu-e2e');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã ghi tài khoản đồng bộ của Sở GD&ĐT' })).toBeVisible();
  await page.reload();
  const saved = page.getByRole('form', { name: 'Tài khoản đồng bộ của Sở GD&ĐT' });
  await expect(saved.getByLabel('Tên đăng nhập')).toHaveValue('truong.e2e');
  await expect(saved.getByLabel('Mật khẩu')).toHaveValue('');
  await expect(saved.getByLabel('Mật khẩu')).toHaveAttribute('placeholder', 'Để trống để giữ mật khẩu đã lưu');
  await expect(saved.getByText('Đã lưu', { exact: true })).toBeVisible();
  await expect(page.getByText('Mat-khau-thu-e2e')).toHaveCount(0);

  await saved.getByRole('button', { name: 'Xóa thông tin' }).click();
  const confirm = page.getByRole('dialog', { name: 'Xóa tài khoản đồng bộ' });
  await confirm.getByLabel(/^Tôi đã đọc và đồng ý xóa/).check();
  await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã xóa tài khoản đồng bộ của Sở GD&ĐT' })).toBeVisible();
});
