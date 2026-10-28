import { expect, type Page } from '@playwright/test';

// Đăng nhập cổng vận hành nền tảng theo hai bước (YCTD-312): tên đăng nhập, mật khẩu; máy chủ đòi mã xác thực hai lớp thì nhập
// mã TOTP hoặc mã khôi phục rồi Xác nhận. Mã lấy ngay trước khi nhập để còn trong khoảng thời gian hợp lệ
export async function signInConsole(
  page: Page,
  login: string,
  password: string,
  otp: () => Promise<string> | string,
): Promise<void> {
  await page.getByLabel('Tên đăng nhập').fill(login);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const code = page.getByLabel('Mã xác thực hai lớp');
  await expect(code).toBeVisible();
  await code.fill(await otp());
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
}
