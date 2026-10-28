import { expect, type Page } from '@playwright/test';
import { readPlatformCaptchaAnswerForTesting } from '@school-management/identity/testing';

// Đăng nhập cổng vận hành nền tảng theo hai bước (YCTD-312): tên đăng nhập, mật khẩu, mã xác nhận (YCTD-313); máy chủ đòi mã
// xác thực hai lớp thì nhập mã TOTP hoặc mã khôi phục rồi Xác nhận. Bấm Làm mới mã để biết chắc mã ảnh đang hiện, đáp án đọc ở
// Redis của dịch vụ định danh (kiểm thử dùng máy chủ giả lập thì truyền captcha). Mã hai lớp lấy ngay trước khi nhập
export async function signInConsole(
  page: Page,
  login: string,
  password: string,
  otp: () => Promise<string> | string,
  options: { captcha?: (captchaId: string) => Promise<string | null> | string | null } = {},
): Promise<void> {
  await page.getByLabel('Tên đăng nhập').fill(login);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  const [issued] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/v1/auth/platform/captcha') && response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Làm mới mã' }).click(),
  ]);
  const { captcha_id: captchaId } = (await issued.json()) as { captcha_id: string };
  const answer = await (options.captcha ?? readPlatformCaptchaAnswerForTesting)(captchaId);
  if (!answer) {
    throw new Error('Không đọc được đáp án mã xác nhận của cổng vận hành');
  }
  await expect(page.getByRole('img', { name: 'Ảnh mã xác nhận' })).toBeVisible();
  await page.getByLabel('Mã xác nhận', { exact: true }).fill(answer);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const code = page.getByLabel('Mã xác thực hai lớp');
  await expect(code).toBeVisible();
  await code.fill(await otp());
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
}
