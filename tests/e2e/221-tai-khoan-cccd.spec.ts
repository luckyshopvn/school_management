import { randomInt } from 'node:crypto';
import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_DEFAULT_INITIAL_PASSWORD, E2E_IDENTITY_PORT } from '../e2e-environment.mjs';

// Quy tắc tài khoản trường theo số CCCD (YCTD-311, CT-1520): Hiệu trưởng tạo tài khoản bằng số CCCD; người dùng đăng nhập bằng số CCCD
// và mật khẩu mặc định (giá trị thử của lượt e2e) thì phải đổi mật khẩu ở MH-48 rồi mới vào trang chủ; danh sách tài khoản che số CCCD
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const IDENTITY = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;

test.afterAll(async () => {
  await database.destroy();
});

test('CT-1520: tài khoản theo số CCCD đăng nhập lần đầu bằng mật khẩu mặc định phải đổi mật khẩu', async ({
  page,
  request,
}) => {
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const signedIn = await request.post(`${IDENTITY}/auth/login`, {
    data: { login: principal.username, password: principal.password, channel: 'portal' },
  });
  expect(signedIn.status()).toBe(200);
  const token = ((await signedIn.json()) as { access_token: string }).access_token;
  // Mã tỉnh 001, sinh năm 1985: số CCCD giả hợp lệ về cấu trúc
  const nationalId = `001085${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
  const created = await request.post(`${IDENTITY}/users`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      full_name: 'Nhân viên CCCD e2e',
      national_id: nationalId,
      // Vai trò toàn trường (WHOLE_SCHOOL_ROLE_CODES) không cần đơn vị
      roles: [{ role_code: 'VT-19', org_unit_id: null }],
    },
  });
  expect(created.status()).toBe(201);
  expect(((await created.json()) as { uses_initial_password: boolean }).uses_initial_password).toBe(true);

  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(nationalId);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(E2E_DEFAULT_INITIAL_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();
  await page.getByLabel('Mật khẩu hiện tại').fill(E2E_DEFAULT_INITIAL_PASSWORD);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatKhauRieng2026');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatKhauRieng2026');
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  const row = await database
    .selectFrom('users')
    .select(['must_change_password', 'initial_password_expires_at'])
    .where('username', '=', nationalId)
    .executeTakeFirstOrThrow();
  expect(row).toEqual({ must_change_password: false, initial_password_expires_at: null });

  // Danh sách tài khoản chỉ hiện 4 số cuối
  const list = await request.get(`${IDENTITY}/users?q=${encodeURIComponent('Nhân viên CCCD e2e')}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const items = ((await list.json()) as { items: Array<{ username: string | null }> }).items;
  expect(items.map((item) => item.username)).toContain(`********${nationalId.slice(-4)}`);
  expect(JSON.stringify(items)).not.toContain(nationalId);
});
