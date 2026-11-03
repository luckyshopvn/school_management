import { expect, test, type Browser } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Kho minh chứng, lát L6 (YCTD-396), kịch bản CT-396-22: Hiệu trưởng nạp bộ mẫu Tiểu học (có bộ chuẩn giáo viên theo hạng của
// Thông tư 30/2026); giáo viên thêm minh chứng của mình cho yêu cầu 3.k của hạng II, thấy hồ sơ minh chứng của mình ở Tổng
// quan. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const RANK = 'GV-TH-H2-2026 · Chuẩn nghề nghiệp giáo viên tiểu học hạng II (Thông tư 30/2026)';

test.afterAll(async () => {
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-396-22: giáo viên thêm minh chứng của mình vào bộ chuẩn theo hạng, xem hồ sơ của mình ở Tổng quan', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  const head = await signIn(browser, principal);
  await openMenu(head, '/quality/frameworks');
  await head.getByLabel('Cấp học').selectOption('TH');
  await head.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(head.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  const page = await signIn(browser, teacher);
  await openMenu(page, '/quality/evidences');
  await page.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: RANK });
  await page.getByRole('button', { name: 'Thêm minh chứng' }).click();
  const form = page.getByRole('form', { name: 'Thêm minh chứng' });
  const criterion = form.getByLabel('Tiêu chí', { exact: true });
  const option = (await criterion.locator('option', { hasText: /^3\.k / }).getAttribute('value')) ?? '';
  await criterion.selectOption(option);
  await form.getByLabel('Tên minh chứng').fill('Giấy khen cấp xã thử');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã ghi minh chứng [H3-3.k-01]')).toBeVisible();

  await openMenu(page, '/quality/evidence-overview');
  const mine = page.getByRole('region', { name: 'Hồ sơ minh chứng của tôi' });
  await expect(
    mine.getByRole('link', { name: 'Chuẩn nghề nghiệp giáo viên tiểu học hạng II (Thông tư 30/2026)' }),
  ).toBeVisible();
});
