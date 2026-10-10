import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser, hashForTesting } from '@school-management/identity/testing';
import { E2E_PARENT_PORT } from '../e2e-environment.mjs';

// DT-02: mật khẩu mặc định của phụ huynh, kích hoạt tài khoản, đăng nhập bằng mã một lần (PQ-06, XT-09, YCTD-43).
// Chạy sau 03-org-units.spec.ts, khi đã có cây đơn vị.
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const PARENT_APP = `http://localhost:${E2E_PARENT_PORT}`;
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const PARENT_SETTING_KEYS = ['parent_default_password_hash'];
// Cơ sở dữ liệu định danh dùng chung khi phát triển nên trả lại cấu hình cũ sau kiểm thử
let savedSettings: Array<{ key: string; value: unknown; updated_by: string | null }> = [];

test.beforeAll(async () => {
  savedSettings = await database
    .selectFrom('identity_settings')
    .select(['key', 'value', 'updated_by'])
    .where('key', 'in', PARENT_SETTING_KEYS)
    .execute();
});

test.afterAll(async () => {
  await database.deleteFrom('identity_settings').where('key', 'in', PARENT_SETTING_KEYS).execute();
  for (const row of savedSettings) {
    await database
      .insertInto('identity_settings')
      .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
      .execute();
  }
  await database.destroy();
});

async function loginToPortal(page: Page) {
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('Hiệu trưởng đặt mật khẩu mặc định và tạo tài khoản phụ huynh; phụ huynh đăng nhập lần đầu và đặt mật khẩu mới', async ({
  page,
}) => {
  await loginToPortal(page);
  await page.getByRole('link', { name: 'Cấu hình' }).click();
  const accountSettings = page.getByRole('region', { name: 'Cấu hình tài khoản' });
  await accountSettings.getByLabel('Mật khẩu mặc định mới').fill(DEFAULT_PASSWORD);
  await accountSettings.getByRole('button', { name: 'Đặt mật khẩu mặc định' }).click();
  await expect(accountSettings).toContainText('Đã đặt.');
  await expect(accountSettings.getByLabel('Số phút mã một lần còn hiệu lực')).toHaveValue('5');

  await page.getByRole('link', { name: 'Tài khoản' }).click();
  const phone = `09${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;
  await page.getByLabel('Họ tên', { exact: true }).fill('Chị Mai Hoa');
  await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
  await page.getByLabel('Vai trò', { exact: true }).selectOption({ label: 'VT-14 Phụ huynh' });
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByText('dùng mật khẩu mặc định của phụ huynh')).toBeVisible();
  await expect(page.getByTestId('temporary-password')).toHaveCount(0);

  await page.goto(PARENT_APP);
  await page.getByLabel('Số điện thoại').fill(phone);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MaiHoa2026');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MaiHoa2026');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: 'Xin chào, Chị Mai Hoa' })).toBeVisible();

  // Tải lại vẫn giữ phiên; đăng xuất rồi đăng nhập bằng mật khẩu mới
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Xin chào, Chị Mai Hoa' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.getByLabel('Số điện thoại').fill(phone);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Số điện thoại, tên đăng nhập hoặc mật khẩu không đúng')).toBeVisible();
  await page.getByLabel('Mật khẩu', { exact: true }).fill('MaiHoa2026');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Xin chào, Chị Mai Hoa' })).toBeVisible();
});

test('Phụ huynh đăng nhập bằng mã một lần gửi qua tin nhắn', async ({ page }) => {
  const parent = await createTestUser(database, { roles: [{ roleCode: 'VT-14', orgUnitId: null }] });
  await page.goto(PARENT_APP);
  await page.getByRole('tab', { name: 'Mã qua tin nhắn' }).click();
  await page.getByLabel('Số điện thoại').fill(parent.phone);
  await page.getByRole('button', { name: 'Gửi mã' }).click();
  await expect(page.getByText('mã đăng nhập sẽ được gửi qua tin nhắn')).toBeVisible();

  // Chưa có nhà cung cấp tin nhắn nên gán mã đã biết cho mã vừa sinh
  await database
    .updateTable('one_time_codes')
    .set({ code_hash: await hashForTesting('246810') })
    .where('user_id', '=', parent.id)
    .where('used_at', 'is', null)
    .execute();
  await page.getByLabel('Mã đăng nhập').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Mã không đúng hoặc đã hết hạn')).toBeVisible();
  await page.getByLabel('Mã đăng nhập').fill('246810');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
});
