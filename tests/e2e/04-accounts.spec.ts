import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

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
  await page.getByRole('link', { name: 'Tài khoản' }).click();
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
  await page.getByRole('link', { name: 'Vai trò và quyền' }).click();
  await page.getByRole('button', { name: 'VT-02 Hiệu trưởng' }).click();
  const matrix = page.getByRole('region', { name: 'Quyền của VT-02' });
  await expect(matrix.getByRole('checkbox', { name: /P01\.account\.manage\)/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Lưu quyền của vai trò' })).toBeVisible();
});

test('Giáo viên không thấy mục Tài khoản và Vai trò và quyền', async ({ page }) => {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await loginWith(page, teacher.username, teacher.password);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tài khoản' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Vai trò và quyền' })).toHaveCount(0);
});
