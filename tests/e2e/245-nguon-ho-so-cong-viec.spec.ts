import { expect, test } from './fixtures.js';
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

// Kho minh chứng, lát L2b (YCTD-396), kịch bản CT-396-13: Hiệu trưởng thêm minh chứng có nguồn là hồ sơ công việc của mình ở
// trang 1.1 (chọn loại dữ liệu, tìm, chọn); chi tiết có phiên bản 1 nguồn hồ sơ công việc. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);

test.afterAll(async () => {
  await identity.destroy();
  await system.destroy();
});

test('CT-396-13: thêm minh chứng có nguồn là hồ sơ công việc', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await system
    .insertInto('work_files')
    .values({
      code: `HS-E2E-${suffix}`,
      title: `Hồ sơ kiểm tra nội bộ e2e ${suffix}`,
      year: new Date().getFullYear(),
      owner_user_id: principal.id,
      owner_name: 'Hiệu trưởng E2E',
      opened_on: new Date().toISOString().slice(0, 10),
    })
    .execute();
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

  await openMenu(page, '/quality/evidences');
  await page.getByRole('button', { name: 'Thêm minh chứng' }).click();
  const form = page.getByRole('form', { name: 'Thêm minh chứng' });
  await form.getByLabel('Dữ liệu trong phần mềm (chụp bản lúc gắn)').check();
  await form.getByLabel('Loại dữ liệu').selectOption({ label: 'Hồ sơ công việc' });
  await form.getByLabel('Tìm dữ liệu nguồn').fill(`${suffix}`);
  await form.getByLabel('Chọn dữ liệu nguồn').selectOption({ index: 1 });
  await form.getByLabel('Tên minh chứng').fill(`Hồ sơ kiểm tra nội bộ e2e ${suffix}`);
  await form.getByLabel('Tiêu chí', { exact: true }).selectOption({ index: 6 });
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã ghi minh chứng \[H\d+-[\d.]+-\d+\]/)).toBeVisible();
  const detail = page.getByLabel(/Chi tiết minh chứng/);
  await expect(detail.getByText('Bản 1', { exact: true })).toBeVisible();
  await expect(detail.getByText(/Hồ sơ công việc: Hồ sơ công việc HS-E2E-/)).toBeVisible();
});
