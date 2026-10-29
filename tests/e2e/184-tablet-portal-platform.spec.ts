import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import {
  accessibilityViolations,
  describeViolations,
  horizontalOverflowViolations,
  inputFontViolations,
  touchTargetViolations,
} from './device-checks.js';
import { expect, test } from './fixtures.js';
import { signInConsole } from './platform-console.js';
import { clickGridMoreItem } from './grid.js';

// DT-26 phần 26e (YCTD-235, spec 184): bố cục máy tính bảng của cổng quản trị và cổng nền tảng, chạy ở các dự án thiết bị của 26c
// (E2E_DEVICES=pr hoặc full; ở dự án `chromium` mặc định chạy như ca thường ở khổ máy tính 1280 px). Cổng quản trị: dưới 1280 px menu là
// ngăn kéo, lưới dữ liệu là bảng cuộn ngang có cột đầu cố định từ 768 px và dạng thẻ dưới 768 px, hộp thoại phủ kín màn hình dưới 768 px.
// Cổng nền tảng không chạy trong môi trường e2e một trường nên spec tự chạy máy chủ Vite của cổng ở cổng riêng và giả lập API đăng nhập
// bằng page.route. Kiểm không cuộn ngang cả trang, cỡ chữ ô nhập, vùng chạm, axe không lỗi nghiêm trọng. Dữ liệu giả
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const PLATFORM_PORT = 5377;
const PLATFORM_URL = `http://localhost:${PLATFORM_PORT}`;
let platformServer: ChildProcess | undefined;

test.afterAll(async () => {
  platformServer?.kill();
  await database.destroy();
});

// Vùng chạm 44 px, chữ ô nhập 16 px chỉ áp dưới 1280 px; từ 1280 px giữ bố cục máy tính nên chỉ kiểm cuộn ngang và axe
async function deviceViolations(page: Page) {
  const touchLayout = (page.viewportSize()?.width ?? 1280) < 1280;
  return [
    ...(await horizontalOverflowViolations(page)),
    ...(touchLayout ? await inputFontViolations(page) : []),
    ...(touchLayout ? await touchTargetViolations(page) : []),
    ...(await accessibilityViolations(page)),
  ];
}

async function signInPortal(page: Page) {
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('@thiet-bi @thiet-bi-pr CT-26e-1: cổng quản trị: thanh bên từ 1280 px, ngăn kéo dưới 1280 px; trang chủ đạt yêu cầu truy cập', async ({
  page,
}) => {
  await signInPortal(page);
  const width = page.viewportSize()?.width ?? 1280;
  const toggle = page.getByRole('button', { name: 'Menu chức năng' });
  const menu = page.getByRole('navigation', { name: 'Menu chức năng' });
  if (width >= 1280) {
    // Thanh bên luôn hiện từ 1280 px (YCTD-330)
    await expect(menu).toBeVisible();
    await expect(toggle).toBeHidden();
  } else {
    await expect(menu).toHaveCount(0);
    await expect(toggle).toBeVisible();
    const home = await deviceViolations(page);
    expect(home, describeViolations(home)).toEqual([]);

    // Ngăn kéo bên trái, phủ trên nội dung; Esc đóng, nút Đóng menu đóng
    await toggle.click();
    const drawer = page.getByRole('complementary', { name: 'Thanh bên' });
    await expect(menu).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width ?? 0).toBeLessThanOrEqual(Math.min(320, width * 0.85) + 1);
    await expect(page.getByRole('button', { name: 'Đóng menu' })).toBeFocused();
    const opened = [...(await touchTargetViolations(page)), ...(await accessibilityViolations(page))];
    expect(opened, describeViolations(opened)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await toggle.click();
    await page.getByRole('button', { name: 'Đóng menu' }).click();
    await expect(drawer).toHaveCount(0);
  }
});

test('@thiet-bi @thiet-bi-pr CT-26e-2: lưới dữ liệu cuộn ngang có cột đầu cố định từ 768 px, dạng thẻ dưới 768 px; hộp thoại phủ kín màn hình hẹp', async ({
  page,
}) => {
  await signInPortal(page);
  const width = page.viewportSize()?.width ?? 1280;
  // Chuyển trang trong ứng dụng (tải lại trang thì WebKit mất phiên vì mã phiên chỉ ở bộ nhớ)
  await page.evaluate("history.pushState({}, '', '/accounts'); dispatchEvent(new PopStateEvent('popstate'))");
  const grid = page.getByRole('region', { name: 'Danh sách người dùng' });
  await expect(grid).toBeVisible();
  if (width >= 768) {
    await expect(grid.getByRole('table')).toBeVisible();
    const firstHeader = grid.getByRole('columnheader', { name: 'Tên đăng nhập' });
    await expect(firstHeader).toHaveCSS('position', 'sticky');
    await expect(grid.getByRole('list', { name: 'Danh sách người dùng' })).toHaveCount(0);
  } else {
    await expect(grid.getByRole('table')).toHaveCount(0);
    const cards = grid.getByRole('list', { name: 'Danh sách người dùng' });
    await expect(cards.getByRole('listitem').first()).toBeVisible();
  }
  const violations = await deviceViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);

  // Hộp thoại: dưới 768 px rộng bằng màn hình, từ 768 px là hộp giữa màn hình
  await clickGridMoreItem(grid, 'Cấu hình cột hiển thị');
  const dialog = page.getByRole('dialog', { name: 'Cấu hình cột hiển thị' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  if (width < 768) {
    expect(Math.round(box?.width ?? 0)).toBe(width);
  } else {
    expect(box?.width ?? width).toBeLessThan(width);
  }
  await dialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(dialog).toBeHidden();
});

test.describe('cổng nền tảng', () => {
  test.beforeAll(async () => {
    // Máy chủ Vite của cổng nền tảng chỉ cho spec này; API được giả lập ở từng trang nên không cần dịch vụ định danh
    const root = fileURLToPath(new URL('../../apps/platform/', import.meta.url));
    platformServer = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', String(PLATFORM_PORT), '--strictPort'],
      {
        cwd: root,
        stdio: 'ignore',
      },
    );
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await fetch(PLATFORM_URL)
        .then((response) => response.ok)
        .catch(() => false);
      if (ready) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('Máy chủ Vite của cổng nền tảng không chạy');
  });

  test('@thiet-bi @thiet-bi-pr CT-26e-3: cổng nền tảng: thanh bên đầy đủ từ 1280 px, biểu tượng ở 768 đến 1279 px, ngăn kéo dưới 768 px', async ({
    page,
  }) => {
    // Ảnh mã xác nhận giả (YCTD-313): ảnh PNG 1×1, đáp án cố định
    const captchaImage =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.route('**/api/v1/auth/platform/captcha', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          captcha_id: '00000000-0000-4000-8000-000000000000',
          image: captchaImage,
          expires_in_seconds: 300,
        }),
      }),
    );
    // Như máy chủ thật: bước 1 gửi kèm mã ảnh; chưa gửi mã xác thực hai lớp thì trả lỗi đòi mã, cổng sang bước nhập mã (YCTD-312)
    await page.route('**/api/v1/auth/platform/login', (route) => {
      const body = route.request().postDataJSON() as { otp_code?: string; captcha_id?: string; captcha_text?: string };
      if (!body.otp_code && body.captcha_text !== 'ABCDE') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'ERR_VALIDATION', message: 'Mã xác nhận không đúng', details: [] } }),
        });
      }
      return route.fulfill(
        body.otp_code && body.captcha_id
          ? {
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                access_token: 'ma-thu-e2e',
                operator: { id: 'van-hanh-thu', login: 'van-hanh-thu', full_name: 'Người vận hành thử' },
              }),
            }
          : {
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({
                error: {
                  code: 'ERR_UNAUTHENTICATED',
                  message: 'Cần mã xác thực hai lớp',
                  details: [{ field: 'otp_code', message: 'Nhập mã xác thực hai lớp hoặc mã khôi phục' }],
                },
              }),
            },
      );
    });
    await page.route('**/api/v1/auth/platform/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'van-hanh-thu',
          login: 'van-hanh-thu',
          full_name: 'Người vận hành thử',
          // Menu lọc theo vai trò (YCTD-323): máy chủ thật luôn trả vai trò và cờ mật khẩu tạm
          role: 'quan_tri',
          must_change_password: false,
          school_count: 3,
        }),
      }),
    );
    await page.goto(PLATFORM_URL);
    await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
    await expect(page.getByText('Cổng vận hành nền tảng')).toBeVisible();
    const login = await deviceViolations(page);
    expect(login, describeViolations(login)).toEqual([]);
    // Ghi nhớ chỉ giữ tên đăng nhập; Quên Mật Khẩu? mở lời dặn liên hệ quản trị viên nền tảng
    await page.getByRole('button', { name: 'Quên Mật Khẩu?' }).click();
    await expect(page.getByText('Liên hệ quản trị viên nền tảng')).toBeVisible();
    await page.getByLabel('Ghi nhớ').check();
    await signInConsole(page, 'van-hanh-thu', 'mat-khau-thu', () => '123456', { captcha: () => 'ABCDE' });
    // Trang Tổng quan theo thiết kế cổng vận hành (YCTD-324): ô Đã khởi tạo lấy số trường của tài khoản khi chưa có số liệu tổng quan
    await expect(page.getByRole('heading', { name: 'Tổng quan nền tảng' })).toBeVisible();
    await expect(page.getByTestId('tile-schools')).toHaveText('3');
    expect(await page.evaluate(() => localStorage.getItem('platform.login.remembered'))).toBe('van-hanh-thu');

    const width = page.viewportSize()?.width ?? 1280;
    const menu = page.getByRole('navigation', { name: 'Menu' });
    const schools = menu.getByRole('button', { name: 'Trường' });
    if (width >= 1280) {
      expect((await menu.boundingBox())?.width ?? 0).toBeGreaterThan(200);
      await expect(schools.locator('.menu-label')).toBeVisible();
    } else if (width >= 768) {
      expect((await menu.boundingBox())?.width ?? 999).toBeLessThan(100);
      await expect(schools.locator('.menu-label')).toBeHidden();
      await schools.hover();
      await expect(schools.locator('.menu-label')).toBeVisible();
    } else {
      await expect(menu).toBeHidden();
      const toggle = page.getByRole('button', { name: 'Menu', exact: true });
      await toggle.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await toggle.click();
      await menu.getByRole('button', { name: 'Tổng quan' }).click();
      await expect(menu).toBeHidden();
    }
    const shell = await deviceViolations(page);
    expect(shell, describeViolations(shell)).toEqual([]);
  });
});
