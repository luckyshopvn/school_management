import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Kho minh chứng, lát L5 (YCTD-396), kịch bản CT-396-20: Hiệu trưởng mở 3.4 Xuất danh mục và báo cáo, xuất danh mục minh chứng
// Word và Excel của bộ kiểm định Mầm non, tạo gói hồ sơ minh chứng (tác vụ nền). Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const MN = 'MN-KDCL-2024 · Kiểm định chất lượng giáo dục trường mầm non (Thông tư 19/2018, sửa đổi 2024)';

test.afterAll(async () => {
  await identity.destroy();
});

test('CT-396-20: xuất danh mục minh chứng Word, Excel; tạo gói hồ sơ minh chứng', async ({ browser }) => {
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

  await openMenu(page, '/quality/evidence-exports');
  await expect(page.getByRole('heading', { name: '3.4. Xuất danh mục và báo cáo' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: MN });
  const catalog = page.getByRole('region', { name: 'Danh mục minh chứng' });
  for (const [button, pattern] of [
    ['Xuất danh mục Word', /^danh-muc-minh-chung.*\.docx$/],
    ['Xuất danh mục Excel', /^danh-muc-minh-chung.*\.xlsx$/],
  ] as const) {
    const download = page.waitForEvent('download');
    await catalog.getByRole('button', { name: button }).click();
    expect((await download).suggestedFilename()).toMatch(pattern);
  }
  await page
    .getByRole('region', { name: 'Gói hồ sơ minh chứng' })
    .getByRole('button', { name: 'Tạo gói hồ sơ minh chứng' })
    .click();
  await expect(page.getByText('Đang tạo gói hồ sơ minh chứng; tải tệp ở Tệp đã tạo khi xong')).toBeVisible();
});
