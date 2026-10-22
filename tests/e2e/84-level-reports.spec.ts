import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// DT-19 phần 19d (YCTD-154): số liệu theo cấp học. Hiệu trưởng bật cấp Tiểu học; thống kê lớp có ô chọn cấp, chọn Tiểu học thì
// chỉ tính lớp Tiểu học; kế toán tạo biểu phí chọn cấp, bảng giá chỉ có khối của cấp đã chọn. Cuối kịch bản trả lại trường chỉ
// có Mầm non. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);

async function signInAs(browser: Browser, roleCode: string): Promise<Page> {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

test.afterAll(async () => {
  await system.updateTable('school_levels').set({ is_enabled: false }).where('code', '!=', 'MN').execute();
  await system.destroy();
  await identity.destroy();
});

test('Trường bật Tiểu học: thống kê lớp lọc theo cấp, biểu phí chọn cấp', async ({ browser }) => {
  const principal = await signInAs(browser, 'VT-02');
  await openMenu(principal, '/settings');
  const levelsCard = principal.getByRole('region', { name: 'Cấp học của trường' });
  await levelsCard.getByLabel('Bật cấp TH', { exact: true }).check();
  await levelsCard.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(principal.getByRole('status').filter({ hasText: 'Đã ghi cấp học của trường' })).toBeVisible();

  // 5.1 Thống kê lớp học: chọn Tiểu học thì chỉ tính lớp Tiểu học (trường chưa có lớp Tiểu học)
  await openMenu(principal, '/statistics');
  await expect(principal.getByRole('heading', { name: '5.1 Thống kê lớp học' })).toBeVisible();
  await expect(principal.getByText(/Tổng số lớp: [1-9]/)).toBeVisible();
  await principal.getByRole('combobox', { name: /^Cấp học/ }).selectOption({ label: 'Tiểu học' });
  await expect(principal.getByText('Tổng số lớp: 0;')).toBeVisible();

  // Biểu phí: chọn cấp Tiểu học thì bảng giá không còn khối Mầm non
  const accountant = await signInAs(browser, 'VT-04');
  await openMenu(accountant, '/fees');
  const schedules = accountant.getByRole('region', { name: 'Biểu phí' });
  await schedules.getByRole('button', { name: 'Tạo phiên bản biểu phí' }).click();
  const form = schedules.getByRole('group', { name: 'Biểu mẫu biểu phí' });
  await expect(form.getByLabel('Học phí chính khóa (tháng) Mầm')).toBeVisible();
  await form.getByRole('combobox', { name: /^Cấp học/ }).selectOption({ label: 'Tiểu học' });
  await expect(form.getByLabel('Học phí chính khóa (tháng) Mầm')).toHaveCount(0);
  await form.getByRole('button', { name: 'Hủy' }).click();
});
