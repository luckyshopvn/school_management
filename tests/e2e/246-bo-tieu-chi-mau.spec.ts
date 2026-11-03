import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Kho minh chứng, lát L3 (YCTD-396), kịch bản CT-396-16: Hiệu trưởng nạp bộ mẫu kiểm định Tiểu học theo văn bản sửa đổi 2024,
// mở cây thấy chỉ báo theo mức, tải tệp mẫu chỉ báo, thêm bộ thi đua có mẫu mã riêng. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

test('CT-396-16: nạp bộ mẫu Tiểu học có chỉ báo, tải tệp mẫu chỉ báo, thêm bộ thi đua có mẫu mã riêng', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await openMenu(page, '/quality/frameworks');
  await page.getByLabel('Cấp học').selectOption('TH');
  await page.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(page.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();
  const name = 'Kiểm định chất lượng giáo dục trường tiểu học (Thông tư 17/2018, sửa đổi 2024)';
  await page.getByRole('cell', { name, exact: true }).click();
  const tree = page.getByLabel(`Cây ${name}`);
  await expect(tree.getByText(/Phù hợp mục tiêu giáo dục được quy định tại Luật giáo dục/).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await tree.getByRole('button', { name: 'Tải tệp mẫu chỉ báo' }).click();
  expect((await download).suggestedFilename()).toMatch(/^chi-bao.*\.xlsx$/);

  await page.getByRole('button', { name: 'Thêm bộ tiêu chuẩn' }).click();
  const form = page.getByRole('form', { name: 'Thêm bộ tiêu chuẩn' });
  await form.getByLabel('Mã', { exact: true }).fill(`TD-${suffix}`);
  await form.getByLabel('Tên', { exact: true }).fill(`Thi đua thử ${suffix}`);
  await form.getByLabel('Loại bộ').selectOption({ label: 'Thi đua, khen thưởng' });
  await form.getByLabel(/Mẫu mã minh chứng/).fill('TĐ-{tieu_chi}-{stt}');
  await form.getByLabel('Chu kỳ đánh giá (năm học)').fill('1');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('cell', { name: `Thi đua thử ${suffix}`, exact: true })).toBeVisible();
});
