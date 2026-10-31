import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Kho minh chứng, lát L2 (YCTD-396), kịch bản CT-396-10: Hiệu trưởng dùng báo cáo cơ sở vật chất làm minh chứng từ chính trang
// báo cáo (MH-686): chọn bộ, tiêu chí, gắn; trang báo cáo hiện mã minh chứng; kho có minh chứng nguồn báo cáo cơ sở vật chất.
// Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

test('CT-396-10: dùng báo cáo cơ sở vật chất làm minh chứng từ trang báo cáo', async ({ browser }) => {
  test.setTimeout(180_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Bộ mẫu Mầm non: nạp nếu chưa có
  await openMenu(page, '/quality/frameworks');
  await page.getByLabel('Cấp học').selectOption('MN');
  await page.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(page.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  await openMenu(page, '/facility-report');
  await page.getByRole('button', { name: 'Dùng làm minh chứng' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByLabel('Bộ tiêu chí').selectOption({ index: 1 });
  await dialog.getByLabel('Tiêu chí chính').selectOption({ index: 14 });
  await dialog.getByRole('button', { name: 'Gắn minh chứng' }).click();
  await expect(page.getByText(/Đã gắn làm minh chứng \[H\d+-[\d.]+-\d+\]/)).toBeVisible();
  await expect(page.getByText(/^Minh chứng \[H\d+-[\d.]+-\d+\]/)).toBeVisible();

  await openMenu(page, '/quality/evidences');
  await expect(page.getByRole('cell', { name: 'Báo cáo cơ sở vật chất', exact: true }).first()).toBeVisible();
});
