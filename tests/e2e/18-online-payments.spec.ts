import { expect, test } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, TEST_PASSWORD } from '@school-management/identity/testing';
import {
  E2E_API_PORT,
  E2E_IDENTITY_PORT,
  E2E_PARENT_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
} from '../e2e-environment.mjs';

// Kế toán toàn trường chọn tài khoản nhận thanh toán trực tuyến; phụ huynh mở mã QR của HD-900001 (còn 2 893 000 sau khi
// đảo phiếu thu ở 16-receipts.spec.ts); giả lập tiền vào qua bộ giả lập nhà cung cấp thì hóa đơn đã thu đủ (DT-05 phần 5f,
// YCTD-57)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const CHILD_NAME = 'Nguyễn Gia Bảo';
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('Phụ huynh thanh toán hóa đơn bằng mã QR; tiền vào khớp thì tự lập phiếu thu và hóa đơn đã thu đủ', async ({
  browser,
}) => {
  const root = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const child = await schoolYear
    .selectFrom('children')
    .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select(['guardians.phone'])
    .where('children.full_name', '=', CHILD_NAME)
    .where('guardians.user_id', 'is not', null)
    .executeTakeFirstOrThrow();
  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: root.id }] });
  await schoolYear
    .insertInto('cash_accounts')
    .values({
      org_unit_id: root.id,
      account_type: 'bank',
      name: 'Tài khoản thu học phí',
      bank_name: 'Ngân hàng Thử',
      account_number: '1900888999',
      opening_balance: 0,
      current_balance: 0,
      created_by: accountant.id,
    })
    .execute();

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(accountant.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(accountant.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await portal.getByRole('link', { name: 'Quỹ và ngân hàng' }).click();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: root.name });
  const settings = portal.getByRole('region', { name: 'Tài khoản nhận thanh toán trực tuyến' });
  await expect(settings.getByRole('combobox', { name: /^Tài khoản ngân hàng/ })).toContainText('Tài khoản thu học phí');
  await settings.getByRole('button', { name: 'Lưu tài khoản nhận' }).click();
  await expect(settings).toContainText('Đang nhận vào Tài khoản thu học phí');

  const parent = await (await browser.newContext()).newPage();
  await parent.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parent.getByLabel('Số điện thoại').fill(child.phone ?? '');
  await parent.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD);
  await parent.getByRole('button', { name: 'Đăng nhập' }).click();
  const card = parent.getByRole('listitem', { name: CHILD_NAME });
  await card.getByRole('button', { name: 'Học phí' }).click();
  const item = card.getByRole('listitem', { name: 'Hóa đơn HD-900001' });
  await item.getByRole('button', { name: 'Thanh toán bằng mã QR' }).click();
  const qr = item.getByRole('group', { name: 'Mã QR thanh toán HD-900001' });
  await expect(qr.getByRole('img')).toBeVisible();
  await expect(qr).toContainText('2.893.000');
  await expect(qr).toContainText('HD900001');
  const virtualAccount = (await qr.locator('dd').nth(1).textContent()) ?? '';
  expect(virtualAccount).toMatch(/^\d{12}$/);

  // Bộ giả lập nhà cung cấp nhận thông báo tiền vào; kế toán gọi bằng mã phiên của mình
  const login = await fetch(`http://localhost:${E2E_IDENTITY_PORT}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: accountant.username, password: accountant.password, channel: 'portal' }),
  });
  const { access_token: accessToken } = (await login.json()) as { access_token: string };
  const webhook = await fetch(`http://localhost:${E2E_API_PORT}/api/v1/payment-webhooks/development`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      provider_transaction_ref: `E2E-${Date.now()}`,
      virtual_account_number: virtualAccount,
      amount: 2_893_000,
      transfer_content: 'HD900001',
    }),
  });
  expect(((await webhook.json()) as { match_status: string }).match_status).toBe('matched');

  const again = await (await browser.newContext()).newPage();
  await again.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await again.getByLabel('Số điện thoại').fill(child.phone ?? '');
  await again.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD);
  await again.getByRole('button', { name: 'Đăng nhập' }).click();
  const refreshed = again.getByRole('listitem', { name: CHILD_NAME });
  await refreshed.getByRole('button', { name: 'Học phí' }).click();
  await expect(refreshed.getByRole('listitem', { name: 'Hóa đơn HD-900001' })).toContainText('Đã thu đủ');
  await expect(refreshed.getByRole('region', { name: 'Lịch sử đã nộp' })).toContainText('2.893.000');
});
