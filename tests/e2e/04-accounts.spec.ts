import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { expectNoMenuLink, openMenu } from './menu.js';

// MH-30 Tài khoản, vai trò và quyền (P01-06, P01-07, PQ-13). Chạy sau 03-org-units.spec.ts, khi đã có cây đơn vị.
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function loginWith(page: Page, loginIdentifier: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(loginIdentifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('Hiệu trưởng tạo tài khoản giáo viên, nhận mật khẩu tạm, khóa và mở khóa; giáo viên đăng nhập phải đổi mật khẩu', async ({
  page,
  browser,
}) => {
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/accounts');
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản' })).toBeVisible();

  const phone = `09${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;
  await page.getByLabel('Họ tên', { exact: true }).fill('Cô Lan Anh');
  await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
  await page.getByLabel('Vai trò', { exact: true }).selectOption({ label: 'VT-07 Giáo viên chủ nhiệm' });
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Điểm trường A1' });
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  const passwordText = page.getByTestId('temporary-password');
  await expect(passwordText).toBeVisible();
  const temporaryPassword = (await passwordText.textContent())?.trim() ?? '';
  expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/);
  await page.getByRole('dialog').getByRole('button', { name: 'Đã ghi lại' }).click();

  await page.getByLabel('Tìm theo tên, số điện thoại, tên đăng nhập').fill(phone);
  await page.getByRole('row').filter({ hasText: 'Cô Lan Anh' }).click();
  const detail = page.getByRole('region', { name: 'Tài khoản Cô Lan Anh' });
  await expect(detail).toContainText('Giáo viên chủ nhiệm — Điểm trường A1');
  await detail.getByRole('button', { name: 'Khóa tài khoản' }).click();
  await expect(detail.getByText('Đã khóa', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Mở khóa' }).click();
  await expect(detail.getByText('Đang hoạt động', { exact: true })).toBeVisible();

  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await loginWith(teacherPage, phone, temporaryPassword);
  await expect(teacherPage.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();
  await teacherContext.close();
});

test('Hiệu trưởng xem ma trận quyền và có nút lưu quyền', async ({ page }) => {
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/roles');
  await page.getByRole('button', { name: 'VT-02 Hiệu trưởng' }).click();
  const matrix = page.getByRole('region', { name: 'Quyền của VT-02' });
  await expect(matrix.getByRole('checkbox', { name: /P01\.account\.manage\)/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Lưu quyền của vai trò' })).toBeVisible();

  // Chọn nhanh cả nhóm chức năng và bỏ chọn tất cả; không lưu để giữ nguyên quyền của vai trò dùng chung
  const group = matrix.getByRole('group', { name: /P16/ });
  await matrix.getByRole('checkbox', { name: 'Chọn cả nhóm P16' }).check();
  for (const checkbox of await group.getByRole('checkbox').all()) {
    await expect(checkbox).toBeChecked();
  }
  await expect(page.getByRole('button', { name: 'Lưu quyền của vai trò' })).toBeEnabled();
  await matrix.getByRole('button', { name: 'Bỏ chọn tất cả' }).click();
  await expect(matrix.getByRole('checkbox', { name: /P01\.account\.manage\)/ })).not.toBeChecked();
  await expect(matrix.getByRole('checkbox', { name: 'Chọn cả nhóm P01' })).not.toBeChecked();
});

test('Giáo viên không thấy mục Tài khoản và Vai trò và quyền', async ({ page }) => {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await loginWith(page, teacher.username, teacher.password);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expectNoMenuLink(page, '/accounts');
  await expectNoMenuLink(page, '/roles');
});

test('CT-15a-12: lưới dữ liệu ở Tài khoản: cấu hình cột, số dòng mỗi trang nhớ theo người dùng, chọn dòng, mở rộng tìm kiếm; gỡ vai trò phải tích đồng ý', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const target = await createTestUser(database, {
    roles: [
      { roleCode: 'VT-07', orgUnitId: null },
      { roleCode: 'VT-08', orgUnitId: null },
    ],
  });
  // Đủ hơn 10 tài khoản để có trang thứ hai
  for (let index = 0; index < 10; index += 1) {
    await createTestUser(database);
  }
  const targetName = `Người kiểm thử ${target.username.replace('kiem_thu_', '')}`;
  await loginWith(page, principal.username, principal.password);
  await openMenu(page, '/accounts');
  const grid = page.getByRole('region', { name: 'Danh sách tài khoản' });
  // Danh sách tài khoản đọc ở dịch vụ định danh, có lúc chậm khi cơ sở dữ liệu nhiều tài khoản
  const slow = { timeout: 30_000 };
  await expect(grid.getByRole('columnheader')).toHaveText(
    ['', 'Họ tên', 'Đăng nhập', 'Vai trò', 'Trạng thái', 'Thao tác'],
    slow,
  );

  // Cấu hình cột hiển thị: ẩn Vai trò, hiện Tên đăng nhập, đưa Trạng thái lên trước
  await grid.getByRole('button', { name: 'Cấu hình cột hiển thị' }).click();
  const columns = page.getByRole('dialog', { name: 'Cấu hình cột hiển thị' });
  await expect(columns.getByRole('checkbox', { name: 'Họ tên' })).toBeDisabled();
  await columns.getByRole('checkbox', { name: 'Vai trò' }).uncheck();
  await columns.getByRole('checkbox', { name: 'Tên đăng nhập' }).check();
  await columns.getByRole('button', { name: 'Đưa cột Trạng thái lên' }).click();
  await columns.getByRole('button', { name: 'Ghi' }).click();
  const expected = ['', 'Họ tên', 'Đăng nhập', 'Trạng thái', 'Tên đăng nhập', 'Thao tác'];
  await expect(grid.getByRole('columnheader')).toHaveText(expected);

  // Số dòng mỗi trang; tải lại vẫn giữ cả cột và số dòng (lưu ở máy chủ)
  await grid.getByLabel('Số dòng mỗi trang').selectOption('10');
  await expect(grid.getByRole('row')).toHaveCount(11, slow);
  await page.reload();
  await expect(grid.getByRole('columnheader')).toHaveText(expected, slow);
  await expect(grid.getByLabel('Số dòng mỗi trang')).toHaveValue('10');

  // Chọn cả trang, bỏ một dòng; sang trang khác thì bỏ lựa chọn (danh sách phân trang ở máy chủ)
  await grid.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await expect(grid.getByText('Đã chọn 10 dòng')).toBeVisible();
  await grid.getByRole('row').nth(1).getByRole('checkbox').uncheck();
  await expect(grid.getByText('Đã chọn 9 dòng')).toBeVisible();
  await expect(grid.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' })).not.toBeChecked();
  await grid.getByRole('button', { name: 'Trang sau' }).click();
  await expect(grid.getByText(/^Trang 2 \/ \d+$/)).toBeVisible(slow);
  await expect(grid.getByText(/^Đã chọn/)).toHaveCount(0);

  // Mở rộng tìm kiếm có bộ lọc trạng thái; tìm tài khoản cần gỡ vai trò
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await grid.getByRole('region', { name: 'Mở rộng tìm kiếm' }).getByLabel('Trạng thái').selectOption('active');
  await grid.getByLabel('Tìm theo tên, số điện thoại, tên đăng nhập').fill(target.username);
  await expect(grid.getByRole('row')).toHaveCount(2, slow);
  await grid.getByRole('button', { name: `Hồ sơ ${targetName}` }).click();

  const detail = page.getByRole('region', { name: `Tài khoản ${targetName}` });
  await expect(detail).toContainText('Giáo viên bộ môn — Toàn trường');
  await detail
    .getByRole('listitem')
    .filter({ hasText: 'Giáo viên bộ môn' })
    .getByRole('button', { name: 'Gỡ' })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Gỡ vai trò' });
  const remove = confirm.getByRole('button', { name: 'Gỡ', exact: true });
  await expect(remove).toBeDisabled();
  await confirm.getByLabel(/^Tôi đã đọc và đồng ý xóa vai trò Giáo viên bộ môn/).check();
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(confirm).toHaveCount(0);
  await expect(detail).not.toContainText('Giáo viên bộ môn');
  await expect(detail).toContainText('Giáo viên chủ nhiệm — Toàn trường');
});
