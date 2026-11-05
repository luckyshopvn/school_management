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

// YCTD-395 lát L3 (spec 250, CT-2109 đến CT-2111): Ca trực, Ghi nhận vi phạm, khen của ứng dụng giáo viên ở khổ máy tính; điện thoại
// giữ như trước. Phạm vi, ghi nhận, mục nội quy, học sinh giả lập bằng page.route; quyền ghi nhận thêm vào /auth/me thật. Dữ liệu giả
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.use({ serviceWorkers: 'block' });

test.afterAll(async () => {
  await database.destroy();
});

const CLASS = {
  id: '00000000-0000-4000-8000-000000002501',
  name: 'Lớp 6A thử',
  org_unit_id: 'u-250',
  school_level: 'THCS',
};
const RECORDS = [
  {
    id: 'r-1',
    full_name: 'Nguyễn Hoàng Bảo Ngọc',
    class_name: 'Lớp 6A thử',
    rule_name: 'Đi học muộn sau hồi trống thứ hai',
    kind: 'violation',
    occurred_at: '2026-11-03T00:12:00.000Z',
    zone_name: 'Cổng chính',
    status: 'active',
    revoked_reason: null,
  },
  {
    id: 'r-2',
    full_name: 'Trần Thị Minh Khuê',
    class_name: 'Lớp 6A thử',
    rule_name: 'Nhặt được của rơi trả lại người mất',
    kind: 'commendation',
    occurred_at: '2026-11-03T02:35:00.000Z',
    zone_name: null,
    status: 'revoked',
    revoked_reason: 'Ghi nhầm',
  },
];
const STUDENTS = [
  {
    child_id: 'c-1',
    full_name: 'Lê Văn Phúc',
    class_id: CLASS.id,
    class_name: CLASS.name,
    org_unit_id: 'u-250',
    school_level: 'THCS',
  },
];
const RULES = [
  {
    id: 'q-1',
    name: 'Đi học muộn',
    kind: 'violation',
    school_level: 'THCS',
    status: 'active',
    class_criterion_name: null,
  },
];

const fulfillJson = (body: unknown) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function openSupervision(page: Page) {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await page.route(
    (url) => url.pathname === '/api/v1/classes' && url.searchParams.get('mine') === 'true',
    fulfillJson([]),
  );
  await page.route((url) => url.pathname === '/api/v1/supervision/my-scope', fulfillJson({ classes: [CLASS] }));
  await page.route(
    (url) => url.pathname === '/api/v1/supervision/records',
    (route) =>
      route.request().method() === 'POST'
        ? fulfillJson({ record_ids: ['r-3'], class_points_added: false })(route)
        : fulfillJson(RECORDS)(route),
  );
  await page.route((url) => url.pathname.startsWith('/api/v1/supervision/records/'), fulfillJson({}));
  await page.route((url) => url.pathname === '/api/v1/supervision/rule-items', fulfillJson(RULES));
  await page.route((url) => url.pathname === '/api/v1/supervision/zones', fulfillJson([]));
  await page.route((url) => url.pathname === '/api/v1/supervision/students', fulfillJson(STUDENTS));
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
  await page.getByRole('button', { name: 'Ghi nhận rèn luyện' }).click();
  await expect(page.getByRole('heading', { name: 'Ca trực hôm nay' })).toBeVisible();
}

async function layoutViolations(page: Page) {
  return [
    ...(await horizontalOverflowViolations(page)),
    ...(await touchTargetViolations(page)),
    ...(await accessibilityViolations(page)),
  ];
}

test('CT-2109: Ca trực khổ 1366 là bảng, thu hồi mở dòng lý do dưới dòng', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openSupervision(page);
  const table = page.getByRole('table', { name: 'Ghi nhận hôm nay' });
  await expect(table).toBeVisible();
  await expect(page.getByRole('list', { name: 'Ghi nhận hôm nay' })).toBeHidden();
  await expect(table.getByRole('columnheader', { name: 'Mục nội quy' })).toBeVisible();
  await expect(table.getByRole('row', { name: /Trần Thị Minh Khuê.*Đã thu hồi/ })).toBeVisible();
  const duty = await layoutViolations(page);
  expect(duty, describeViolations(duty)).toEqual([]);
  await table.getByRole('button', { name: 'Thu hồi ghi nhận của Nguyễn Hoàng Bảo Ngọc' }).click();
  await table.getByLabel('Lý do thu hồi').fill('Ghi nhầm học sinh');
  await table.getByRole('button', { name: 'Xác nhận thu hồi' }).click();
  await expect(page.getByText('Đã thu hồi ghi nhận')).toBeVisible();
});

test('CT-2110: Ghi nhận khổ 1366 hai cột, thanh lưu dính đáy, lưu được', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openSupervision(page);
  await page.getByRole('button', { name: 'Ghi nhận mới' }).click();
  await expect(page.getByRole('heading', { name: 'Ghi nhận vi phạm, khen' })).toBeVisible();
  const students = await page.getByRole('region', { name: 'Học sinh' }).boundingBox();
  const content = await page.getByRole('region', { name: 'Nội dung' }).boundingBox();
  expect(students && content && content.x > students.x + students.width - 1).toBe(true);
  await page.getByLabel('Hoặc chọn lớp').selectOption(CLASS.id);
  await page.getByRole('button', { name: 'Tìm học sinh' }).click();
  await page.getByLabel('Lê Văn Phúc · Lớp 6A thử').check();
  await page.getByRole('button', { name: 'Đi học muộn' }).click();
  const record = await layoutViolations(page);
  expect(record, describeViolations(record)).toEqual([]);
  await page.getByRole('button', { name: 'Lưu ghi nhận' }).click();
  await expect(page.getByText('Đã ghi cho 1 học sinh')).toBeVisible();
});

test('CT-2111: khổ 390 Ca trực là danh sách thẻ như trước', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSupervision(page);
  await expect(page.getByRole('list', { name: 'Ghi nhận hôm nay' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Ghi nhận hôm nay' })).toBeHidden();
  const duty = [...(await horizontalOverflowViolations(page)), ...(await touchTargetViolations(page))];
  expect(duty, describeViolations(duty)).toEqual([]);
});
