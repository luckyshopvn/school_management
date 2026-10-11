import { expect, test } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// Khóa API cho đối tác (DT-07 phần 7b, YCTD-63): Hiệu trưởng cấp khóa, thấy khóa một lần, thu hồi khóa. Kiểm thử xóa
// khóa đã tạo để trả lại dữ liệu dùng chung của cơ sở dữ liệu định danh
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const partnerName = `Phòng Giáo dục kiểm thử ${Date.now() % 1_000_000}`;
const validUntil = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

test.afterAll(async () => {
  const rows = await identity.selectFrom('api_clients').select('id').where('name', '=', partnerName).execute();
  if (rows.length > 0) {
    const ids = rows.map((row) => row.id);
    await identity.deleteFrom('identity_audit_logs').where('entity_id', 'in', ids).execute();
    await identity.deleteFrom('api_clients').where('id', 'in', ids).execute();
  }
  await identity.destroy();
});

test('Hiệu trưởng cấp khóa API cho đối tác, thấy khóa một lần rồi thu hồi', async ({ browser }) => {
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Khóa API cho đối tác' }).click();
  const form = page.getByRole('form', { name: 'Cấp khóa API' });
  await form.getByLabel('Tên đối tác').fill(partnerName);
  await form.getByLabel('Loại đối tác').fill('Cơ quan quản lý');
  await form.getByLabel('Ngày hết hạn').fill(validUntil);
  await form.getByLabel('Địa chỉ mạng cho phép').fill('10.0.0.5');
  await form.getByLabel('Báo cáo tổng hợp').check();
  await form.getByRole('button', { name: 'Cấp khóa' }).click();
  await expect(page.getByLabel('Khóa mới')).toContainText('sm_');
  const row = page.getByRole('row', { name: `Khóa của ${partnerName}` });
  await expect(row).toContainText('Đang dùng');
  await row.getByRole('button', { name: 'Thu hồi' }).click();
  await expect(row).toContainText('Đã thu hồi');
});
