import { expect, test, type Page } from './fixtures.js';
import type { Response } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import {
  createTestUser,
  hashForTesting,
  readCaptchaAnswerForTesting,
  type TestUser,
} from '@school-management/identity/testing';
import { randomUUID } from 'node:crypto';
import { logout, openMenu, openUserMenu } from './menu.js';

// Thanh đầu trang, menu người dùng, thông báo bật lên, đăng nhập và quên mật khẩu theo Sở (DT-16 phần 16c; CT-16c-16 đến
// CT-16c-21)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const HOTLINE = '1900 0000 (số thử nghiệm)';
const suffix = randomUUID().slice(0, 8);

test.afterAll(async () => {
  await identity.deleteFrom('identity_settings').where('key', '=', 'login_hotline').execute();
  await identity.destroy();
});

async function fillLogin(page: Page, loginIdentifier: string, password: string) {
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(loginIdentifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

async function loginWith(page: Page, user: TestUser) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await fillLogin(page, user.username, user.password);
}

// Bấm nút rồi đọc đáp án của ảnh mã xác nhận đang hiện. Khi phát triển, React gọi lấy ảnh hai lần lúc dựng trang; trang chỉ
// hiện ảnh của lần lấy cuối nên đọc đáp án của phản hồi cuối cùng
async function captchaAnswerAfter(page: Page, action: () => Promise<unknown>): Promise<string> {
  const issued: Array<Promise<{ captcha_id: string }>> = [];
  const listener = (response: Response) => {
    if (response.url().endsWith('/api/v1/auth/captcha') && response.request().method() === 'POST') {
      issued.push(response.json() as Promise<{ captcha_id: string }>);
    }
  };
  page.on('response', listener);
  try {
    await action();
    await expect.poll(() => issued.length).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');
  } finally {
    page.off('response', listener);
  }
  const last = await issued[issued.length - 1];
  const answer = await readCaptchaAnswerForTesting(last?.captcha_id ?? '');
  expect(answer).toBeTruthy();
  return answer ?? '';
}

test('CT-16c-16: trang đăng nhập có đường dây nóng; nhập sai thì hiện mã xác nhận có nút làm mới; ghi nhớ tài khoản', async ({
  page,
}) => {
  await identity
    .insertInto('identity_settings')
    .values({ key: 'login_hotline', value: JSON.stringify(HOTLINE), updated_at: new Date(), updated_by: null })
    .onConflict((conflict) => conflict.column('key').doUpdateSet({ value: JSON.stringify(HOTLINE) }))
    .execute();
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
  await page.goto('/');
  await expect(page.getByTestId('login-hotline')).toHaveText(`Đường dây nóng hỗ trợ: ${HOTLINE}`);
  await expect(page.getByAltText('Ảnh mã xác nhận')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Quên mật khẩu?' })).toBeVisible();

  await captchaAnswerAfter(page, () => fillLogin(page, user.username, 'SaiMatKhau1'));
  await expect(page.getByRole('alert')).toContainText('mật khẩu không đúng');
  const image = page.getByAltText('Ảnh mã xác nhận');
  await expect(image).toBeVisible();
  const firstSource = await image.getAttribute('src');
  const answer = await captchaAnswerAfter(page, () => page.getByRole('button', { name: 'Làm mới mã' }).click());
  await expect(image).not.toHaveAttribute('src', firstSource ?? '');

  await page.getByLabel('Mã xác nhận').fill(answer);
  await page.getByLabel('Ghi nhớ tài khoản').check();
  await fillLogin(page, user.username, user.password);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  // Đăng xuất thì trang đăng nhập điền sẵn tên đăng nhập đã ghi nhớ, không điền mật khẩu
  await logout(page);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByLabel('Số điện thoại hoặc tên đăng nhập')).toHaveValue(user.username);
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Ghi nhớ tài khoản')).toBeChecked();
});

test('CT-16c-17: quên mật khẩu: nhận mã qua tin nhắn, không dùng lại mật khẩu cũ, đặt mật khẩu mới rồi đăng nhập', async ({
  page,
}) => {
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
  await page.goto('/');
  const answer = await captchaAnswerAfter(page, () => page.getByRole('link', { name: 'Quên mật khẩu?' }).click());
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.phone);
  await page.getByLabel('Mã xác nhận').fill(answer);
  await page.getByRole('button', { name: 'Gửi mã' }).click();
  await expect(page.getByText(/mã đặt lại mật khẩu sẽ được gửi qua tin nhắn/)).toBeVisible();

  // Kiểm thử giao diện không đọc được tin nhắn thật: gán mã đã biết cho mã vừa gửi
  const updated = await identity
    .updateTable('one_time_codes')
    .set({ code_hash: await hashForTesting('246810') })
    .where('user_id', '=', user.id)
    .where('purpose', '=', 'password_reset')
    .where('used_at', 'is', null)
    .executeTakeFirst();
  expect(Number(updated.numUpdatedRows)).toBe(1);

  await page.getByLabel('Mã trong tin nhắn').fill('246810');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(user.password);
  await page.getByLabel('Nhập lại mật khẩu mới').fill(user.password);
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
  await expect(page.getByText(/Mật khẩu mới phải khác mật khẩu hiện tại/)).toBeVisible();

  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatKhauMoi2026');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatKhauMoi2026');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
  await expect(page.getByText('Đã đặt lại mật khẩu, vui lòng đăng nhập bằng mật khẩu mới')).toBeVisible();
  await page.getByRole('link', { name: 'Quay lại đăng nhập' }).click();
  await fillLogin(page, user.username, 'MatKhauMoi2026');
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
});

test('CT-16c-18: thanh đầu trang có tên trường, ô "Cấp MN · năm học · học kỳ"; menu người dùng mở Hồ sơ nhân sự cá nhân, Hướng dẫn', async ({
  page,
  request,
}) => {
  const info = (await (await request.get('/api/v1/public/login-info')).json()) as {
    school_name: string | null;
    academic_year: string | null;
  };
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await page.goto('/');
  if (info.school_name) {
    await expect(page.getByTestId('login-school')).toContainText(info.school_name);
  }
  await fillLogin(page, user.username, user.password);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByTestId('school-name')).toHaveText(info.school_name ?? 'School Management');
  await expect(page.getByTestId('school-name')).toHaveClass(/text-header-accent/);
  if (info.academic_year) {
    await expect(page.getByTestId('academic-year-context')).toContainText(`Cấp MN · ${info.academic_year} · `);
  }

  let menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Hồ sơ nhân sự cá nhân' }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ nhân sự cá nhân' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Tài khoản' })).toContainText(user.username);
  if (info.academic_year) {
    await expect(page.getByText('Tài khoản chưa gắn với hồ sơ nhân sự.', { exact: false })).toBeVisible();
  }
  menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Hướng dẫn' }).click();
  await expect(page.getByRole('heading', { name: 'Hướng dẫn', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Đăng nhập' })).toBeVisible();
});

test.describe.serial('Thông báo bật lên khi vào trang', () => {
  test.use({ startupNotices: true });
  const title = `Bảo trì hệ thống ${suffix}`;
  const appName = `Ứng dụng giáo viên ${suffix}`;
  let administrator: TestUser;

  test('CT-16c-19: quản trị soạn thông báo hệ thống và ứng dụng liên kết; lần đăng nhập sau thông báo bật lên một lần', async ({
    page,
  }) => {
    // Quản trị nền tảng không cập nhật hồ sơ trường nên không có lời nhắc mã định danh tổ chức
    administrator = await createTestUser(identity, { roles: [{ roleCode: 'VT-01', orgUnitId: null }] });
    await loginWith(page, administrator);
    await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

    await openMenu(page, '/system-announcements');
    await expect(page.getByRole('heading', { name: '3.6. Thông báo hệ thống' })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    const form = page.getByRole('form', { name: 'Biểu mẫu thông báo' });
    await form.getByRole('button', { name: 'Ghi' }).click();
    await expect(form.getByText('Bắt buộc nhập')).toHaveCount(2);
    await form.getByLabel('Tiêu đề').fill(title);
    await form.getByLabel('Nội dung').fill('Hệ thống tạm dừng từ 22 giờ đến 23 giờ tối thứ Bảy.');
    await form.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByText('Đã ghi thông báo')).toBeVisible();
    const grid = page.getByRole('region', { name: 'Danh sách thông báo hệ thống' });
    await expect(grid.getByRole('row', { name: `Thông báo ${title}` })).toContainText('Đang hiển thị');

    await openMenu(page, '/app-links');
    await expect(page.getByRole('heading', { name: '3.7. Ứng dụng liên kết' })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm ứng dụng' }).click();
    await page.getByLabel('Tên ứng dụng dòng 1').fill(appName);
    await page.getByLabel('Đường dẫn dòng 1').fill('ftp://sai.vi-du.test');
    await page.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByText('Đường dẫn phải bắt đầu bằng http:// hoặc https://')).toBeVisible();
    await page.getByLabel('Đường dẫn dòng 1').fill('https://giao-vien.vi-du.test');
    await page.getByLabel('Mô tả dòng 1').fill('Điểm danh, nhật ký lớp');
    await page.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByText('Đã ghi danh sách ứng dụng liên kết')).toBeVisible();

    // Lưới ứng dụng liên kết ở thanh đầu trang
    await page.getByRole('button', { name: 'Ứng dụng liên kết' }).click();
    const launcher = page.getByRole('dialog', { name: 'Ứng dụng liên kết' });
    const link = launcher.getByRole('link', { name: new RegExp(appName) });
    await expect(link).toHaveAttribute('href', 'https://giao-vien.vi-du.test');
    await expect(link).toHaveAttribute('target', '_blank');
    await page.keyboard.press('Escape');

    // Đăng nhập lại thì hộp Thông báo hiện thông báo; đóng rồi tải lại trang thì không hiện nữa
    await logout(page);
    await fillLogin(page, administrator.username, administrator.password);
    const notices = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(notices).toBeVisible();
    await expect(notices.getByRole('heading', { name: title })).toBeVisible();
    await expect(notices).toContainText('Hệ thống tạm dừng từ 22 giờ');
    await notices.getByRole('button', { name: 'Đóng' }).click();
    await expect(notices).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
    await expect(notices).toHaveCount(0);
  });

  test('CT-16c-20: xóa thông báo cần tích đồng ý; bỏ ứng dụng liên kết thì nút lưới ứng dụng ẩn', async ({ page }) => {
    await loginWith(page, administrator);
    await page.getByRole('dialog', { name: 'Thông báo' }).getByRole('button', { name: 'Đóng' }).click();
    await openMenu(page, '/system-announcements');
    const grid = page.getByRole('region', { name: 'Danh sách thông báo hệ thống' });
    await grid
      .getByRole('row', { name: `Thông báo ${title}` })
      .getByRole('button', { name: 'Xóa' })
      .click();
    const confirm = page.getByRole('dialog', { name: 'Xác nhận xóa' });
    await expect(confirm.getByRole('button', { name: 'Xóa' })).toBeDisabled();
    await confirm.getByRole('checkbox').check();
    await confirm.getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xóa thông báo')).toBeVisible();
    await expect(grid.getByRole('row', { name: `Thông báo ${title}` })).toHaveCount(0);

    await openMenu(page, '/app-links');
    await page.getByRole('button', { name: 'Bỏ' }).first().click();
    await page.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByText('Đã ghi danh sách ứng dụng liên kết')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ứng dụng liên kết' })).toHaveCount(0);
  });

  test('CT-16c-21: Hiệu trưởng được nhắc cập nhật mã định danh tổ chức theo NĐ 69 (12 chữ số) tới khi hồ sơ trường có mã đúng', async ({
    page,
    request,
  }) => {
    const info = (await (await request.get('/api/v1/public/login-info')).json()) as { school_name: string | null };
    test.skip(!info.school_name, 'Chưa có Trường chính trong cây đơn vị của năm học đang dùng');
    const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    await loginWith(page, principal);
    const notices = page.getByRole('dialog', { name: 'Thông báo' });
    await expect(notices.getByRole('heading', { name: 'Cập nhật mã định danh điện tử của tổ chức' })).toBeVisible();
    await notices.getByRole('link', { name: 'Cập nhật hồ sơ trường' }).click();
    await expect(notices).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '1.1. Hồ sơ trường' })).toBeVisible();

    const field = page.getByLabel('Mã định danh điện tử (NĐ 69, 12 chữ số)');
    await field.fill('12345');
    await page.getByRole('button', { name: 'Ghi', exact: true }).click();
    await expect(page.getByText('Mã định danh điện tử của tổ chức gồm đúng 12 chữ số')).toBeVisible();
    await field.fill('079123456789');
    await page.getByRole('button', { name: 'Ghi', exact: true }).click();
    await expect(page.getByText('Đã ghi hồ sơ trường')).toBeVisible();

    // Đăng nhập lại: không còn lời nhắc (không có thông báo nào khác thì không hiện hộp)
    await logout(page);
    const context = page.waitForResponse((response) => response.url().endsWith('/api/v1/portal-context'));
    const active = page.waitForResponse((response) => response.url().endsWith('/api/v1/system-announcements/active'));
    await fillLogin(page, principal.username, principal.password);
    await Promise.all([context, active]);
    await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
    await expect(notices).toHaveCount(0);
  });
});
