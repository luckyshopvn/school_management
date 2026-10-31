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

// Kho minh chứng dùng chung (YCTD-396 lát L1), kịch bản CT-396-7: Hiệu trưởng thêm minh chứng có tệp vào bộ kiểm định đã nạp
// (nạp nếu chưa có), xem chi tiết, thêm phiên bản thứ hai, lọc theo hiệu lực. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

test.afterAll(async () => {
  await identity.destroy();
  await system.destroy();
});

test('CT-396-7: thêm minh chứng có tệp vào kho, xem chi tiết, thêm phiên bản 2, lọc theo hiệu lực', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const title = `Biên bản kiểm tra phòng cháy thử ${Date.now() % 1_000_000}`;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Bộ mẫu Mầm non: nạp nếu chưa có (spec 80 chạy sau theo thứ tự tên tệp)
  await openMenu(page, '/quality/frameworks');
  await page.getByLabel('Cấp học').selectOption('MN');
  await page.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(page.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  await openMenu(page, '/quality/evidences');
  await expect(page.getByRole('heading', { name: '1.1. Danh sách minh chứng' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm minh chứng' }).click();
  const form = page.getByRole('form', { name: 'Thêm minh chứng' });
  await form.getByLabel('Tải tệp lên').check();
  await form
    .getByLabel('Tệp (PDF, ảnh, Word, Excel, tối đa 20 MB)')
    .setInputFiles({ name: 'bien-ban.pdf', mimeType: 'application/pdf', buffer: PDF });
  await form.getByLabel('Tên minh chứng').fill(title);
  await form.getByLabel('Hiệu lực đến (trống: không thời hạn)').fill('2020-01-01');
  await form.getByLabel('Tiêu chí', { exact: true }).selectOption({ index: 3 });
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã ghi minh chứng \[H\d+-[\d.]+-\d+\]/)).toBeVisible();

  const detail = page.getByLabel(/Chi tiết minh chứng/);
  await expect(detail.getByText('Bản 1', { exact: true })).toBeVisible();
  await expect(detail.getByText('Hết hiệu lực').first()).toBeVisible();
  await detail
    .getByLabel('Tải tệp phiên bản mới')
    .setInputFiles({ name: 'bien-ban-2.pdf', mimeType: 'application/pdf', buffer: PDF });
  await expect(page.getByText('Đã thêm phiên bản 2')).toBeVisible();
  await expect(detail.getByText('Bản 2', { exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Hiệu lực', exact: true }).selectOption({ label: 'Hết hiệu lực' });
  await expect(page.getByRole('cell', { name: title })).toBeVisible();
  await page.getByRole('combobox', { name: 'Hiệu lực', exact: true }).selectOption({ label: 'Còn hiệu lực' });
  await expect(page.getByRole('cell', { name: title })).toHaveCount(0);

  const saved = await system
    .selectFrom('evidence_items')
    .innerJoin('evidence_versions', 'evidence_versions.evidence_id', 'evidence_items.id')
    .select(['evidence_versions.version_no', 'evidence_versions.source_kind'])
    .where('evidence_items.title', '=', title)
    .orderBy('evidence_versions.version_no')
    .execute();
  expect(saved).toEqual([
    { version_no: 1, source_kind: 'upload' },
    { version_no: 2, source_kind: 'upload' },
  ]);
});
