import type { Page, Route } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import {
  accessibilityViolations,
  describeViolations,
  horizontalOverflowViolations,
  touchTargetViolations,
} from './device-checks.js';
import { expect, test } from './fixtures.js';

// YCTD-395 lát L1 (spec 242, CT-2105, CT-2106): ứng dụng giáo viên có thanh bên từ 1024 px, dưới 1024 px giữ như trước. Danh sách lớp,
// cờ Gia sư AI, ca trực giả lập bằng page.route; quyền ghi nhận rèn luyện thêm vào phản hồi /auth/me thật. Dữ liệu giả
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.use({ serviceWorkers: 'block' });

test.afterAll(async () => {
  await database.destroy();
});

const CLASSES = [
  { id: '00000000-0000-4000-8000-000000002421', name: 'Lớp 6A1 thử', school_level: 'THCS' },
  { id: '00000000-0000-4000-8000-000000002422', name: 'Lá 1 thử', school_level: 'MN' },
].map((item) => ({ ...item, org_unit_id: null, enrolled_count: 0, staff: [] }));

const fulfillJson = (body: unknown) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function signInTeacher(page: Page) {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await page.route(
    (url) => url.pathname === '/api/v1/classes' && url.searchParams.get('mine') === 'true',
    fulfillJson(CLASSES),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/ai-tutor/safety-flags',
    fulfillJson({ pending_count: 2, flags: [{}] }),
  );
  await page.route((url) => url.pathname === '/api/v1/supervision/my-scope', fulfillJson({ classes: [] }));
  await page.route((url) => url.pathname === '/api/v1/supervision/records', fulfillJson([]));
  await page.route(
    (url) => url.pathname === '/api/v1/auth/me',
    async (route) => {
      const response = await route.fetch();
      const user = (await response.json()) as { assignments: unknown[] };
      user.assignments.push({ role_code: 'VT-07', org_unit_id: null, permissions: ['P02.supervision.record'] });
      await route.fulfill({ response, json: user });
    },
  );
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
}

async function layoutViolations(page: Page) {
  return [
    ...(await horizontalOverflowViolations(page)),
    ...(await touchTargetViolations(page)),
    ...(await accessibilityViolations(page)),
  ];
}

test('CT-2105: khổ 1366 có thanh bên, mở màn từ thanh bên, đổi lớp', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await signInTeacher(page);
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page');
  // Thanh tiêu đề của màn ẩn, thanh đầu của khung có tên màn
  await expect(page.locator('[data-application-header]')).toBeHidden();
  const home = await layoutViolations(page);
  expect(home, describeViolations(home)).toEqual([]);

  // Mục theo quyền: có Ghi nhận rèn luyện, Cờ Gia sư AI kèm số; không có quyền cổng trường
  await expect(navigation.getByRole('link', { name: 'Cờ Gia sư AI' })).toBeVisible();
  await expect(navigation.getByLabel('2 cờ cần xử lý')).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Quét thẻ ra vào' })).toHaveCount(0);

  // Trường nhiều cấp xếp lớp Mầm non lên đầu nên lớp đó đang chọn; chọn lớp THCS thì chức năng đổi theo cấp
  await expect(navigation.getByRole('link', { name: 'Lá 1 thử' })).toHaveAttribute('aria-current', 'true');
  await expect(navigation.getByRole('link', { name: 'Đón trả' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Sổ điểm' })).toHaveCount(0);
  await navigation.getByRole('link', { name: 'Lớp 6A1 thử' }).click();
  await expect(navigation.getByRole('link', { name: 'Lớp 6A1 thử' })).toHaveAttribute('aria-current', 'true');
  await expect(navigation.getByRole('link', { name: 'Sổ điểm' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Đón trả' })).toHaveCount(0);

  // Mở Ca trực từ thanh bên, nút Quay lại của màn vẫn về trang chủ
  await navigation.getByRole('link', { name: 'Ghi nhận rèn luyện' }).click();
  await expect(page.getByRole('heading', { name: 'Ca trực hôm nay' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Ghi nhận rèn luyện' })).toHaveAttribute('aria-current', 'page');
  const duty = await layoutViolations(page);
  expect(duty, describeViolations(duty)).toEqual([]);
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
});

test('CT-2106: khổ 390 không có thanh bên, trang chủ như trước', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInTeacher(page);
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeHidden();
  await expect(page.locator('[data-application-header]')).toBeVisible();
  await page.getByRole('button', { name: 'Ghi nhận rèn luyện' }).click();
  await expect(page.getByRole('heading', { name: 'Ca trực hôm nay' })).toBeVisible();
  const duty = [...(await horizontalOverflowViolations(page)), ...(await touchTargetViolations(page))];
  expect(duty, describeViolations(duty)).toEqual([]);
});
