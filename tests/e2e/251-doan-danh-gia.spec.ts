import { expect, test, type Browser } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Kho minh chứng, lát L8 (YCTD-396), kịch bản CT-396-26: Hiệu trưởng giao bộ kiểm định Mầm non cho tài khoản đoàn đánh giá
// ngoài (VT-23) đến hết ngày giao; đoàn đăng nhập chỉ thấy bộ được giao ở danh sách minh chứng, không có nút thêm. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const MN = 'MN-KDCL-2024 · Kiểm định chất lượng giáo dục trường mầm non (Thông tư 19/2018, sửa đổi 2024)';

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

test('CT-396-26: giao bộ cho đoàn đánh giá ngoài; đoàn chỉ thấy bộ được giao, không thêm được minh chứng', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const reviewer = await createTestUser(identity, { roles: [{ roleCode: 'VT-23', orgUnitId: null }] });
  const head = await signIn(browser, principal);
  await openMenu(head, '/quality/frameworks');
  await head.getByLabel('Cấp học').selectOption('MN');
  await head.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(head.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  await openMenu(head, '/quality/evidence-reviewers');
  const form = head.getByRole('form', { name: 'Giao bộ tiêu chí cho đoàn đánh giá' });
  await form.getByLabel('Tài khoản đoàn').selectOption(reviewer.id);
  await form.getByLabel('Bộ tiêu chí').selectOption({ label: MN });
  await form.getByLabel('Hết hạn giao').fill('2099-12-31');
  await form.getByRole('button', { name: 'Giao bộ' }).click();
  await expect(head.getByText('Đã giao bộ tiêu chí cho đoàn đánh giá')).toBeVisible();

  const page = await signIn(browser, reviewer);
  await openMenu(page, '/quality/evidences');
  const choice = page.getByRole('combobox', { name: 'Bộ tiêu chí' });
  await expect(choice.locator('option')).toHaveText([MN]);
  await expect(page.getByRole('button', { name: 'Thêm minh chứng' })).toHaveCount(0);
});
