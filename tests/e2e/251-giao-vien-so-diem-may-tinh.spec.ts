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

// YCTD-395 lát L4 (spec 251, CT-2112 đến CT-2114): Sổ điểm (THCS) và Đánh giá học sinh (Tiểu học) của ứng dụng giáo viên là bảng nhập
// theo ô ở khổ máy tính, thẻ như trước ở điện thoại. Lớp, sổ điểm, đánh giá giả lập bằng page.route. Dữ liệu giả
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.use({ serviceWorkers: 'block' });

test.afterAll(async () => {
  await database.destroy();
});

const SECONDARY = { id: '00000000-0000-4000-8000-000000002511', name: 'Lớp 6A thử', school_level: 'THCS' };
const PRIMARY = { id: '00000000-0000-4000-8000-000000002512', name: 'Lớp 2A thử', school_level: 'TH' };
const CLASSES = [SECONDARY, PRIMARY].map((item) => ({ ...item, org_unit_id: null, enrolled_count: 2, staff: [] }));
const STUDENTS = [
  { child_id: 'c-1', full_name: 'Đặng Quốc Anh' },
  { child_id: 'c-2', full_name: 'Phan Lê Minh Châu Trần Khánh Linh' },
];

const fulfillJson = (body: unknown) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function signInTeacher(page: Page) {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await page.route(
    (url) => url.pathname === '/api/v1/classes' && url.searchParams.get('mine') === 'true',
    fulfillJson(CLASSES),
  );
  await page.route(
    (url) => url.pathname === `/api/v1/scores/classes/${SECONDARY.id}`,
    fulfillJson({
      access: { subject_ids: ['toan'] },
      subjects: [{ subject_id: 'toan', subject_name: 'Toán', required_regular: 3 }],
    }),
  );
  await page.route(
    (url) => url.pathname === `/api/v1/scores/classes/${SECONDARY.id}/subjects/toan`,
    (route) =>
      route.request().method() === 'PUT'
        ? fulfillJson({})(route)
        : fulfillJson({
            can_edit: true,
            locked: null,
            subject: { mode: 'score', required_regular: 3 },
            rows: STUDENTS.map((student, index) => ({
              ...student,
              regular: index === 0 ? [8, 7.5] : [],
              mid: index === 0 ? 7.8 : null,
              final: null,
              average: index === 0 ? 7.9 : null,
              result: null,
              comment: null,
            })),
          })(route),
  );
  await page.route(
    (url) => url.pathname === `/api/v1/assessment/classes/${PRIMARY.id}`,
    fulfillJson({
      access: { subject_ids: ['tieng-viet'], competency: false },
      subjects: [{ subject_id: 'tieng-viet', subject_name: 'Tiếng Việt' }],
      periods: [{ id: 'ky-1', name: 'Giữa học kỳ I', locked: null }],
      levels: [
        { scale: 'subject', code: 'T', name: 'Hoàn thành tốt' },
        { scale: 'subject', code: 'H', name: 'Hoàn thành' },
      ],
    }),
  );
  await page.route(
    (url) => url.pathname === `/api/v1/assessment/classes/${PRIMARY.id}/subjects/tieng-viet`,
    (route) =>
      route.request().method() === 'GET'
        ? fulfillJson({
            has_test: true,
            can_edit: true,
            rows: STUDENTS.map((student) => ({ ...student, result: null })),
          })(route)
        : fulfillJson({})(route),
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

test('CT-2112: Sổ điểm khổ 1366 là bảng nhập theo ô, lưu được', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await signInTeacher(page);
  await page.getByRole('button', { name: `Sổ điểm lớp ${SECONDARY.name}` }).click();
  const table = page.getByRole('table', { name: 'Bảng điểm' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'TX3' })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: 'Phan Lê Minh Châu Trần Khánh Linh' })).toBeVisible();
  await expect(page.getByLabel('Điểm thường xuyên 1 của Đặng Quốc Anh')).toHaveValue('8');
  const sheet = await layoutViolations(page);
  expect(sheet, describeViolations(sheet)).toEqual([]);
  // Ô sai giá trị đánh dấu ngay tại ô, nút Lưu khóa
  await page.getByLabel('Điểm thường xuyên 3 của Đặng Quốc Anh').fill('abc');
  await expect(page.getByLabel('Điểm thường xuyên 3 của Đặng Quốc Anh')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Lưu điểm' })).toBeDisabled();
  await page.getByLabel('Điểm thường xuyên 3 của Đặng Quốc Anh').fill('9');
  await page.getByRole('button', { name: 'Lưu điểm' }).click();
  await expect(page.getByText('Đã lưu điểm')).toBeVisible();
});

test('CT-2113: Đánh giá học sinh khổ 1366 là bảng có mức đạt, điểm, nhận xét', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await signInTeacher(page);
  await page.getByRole('button', { name: `Đánh giá lớp ${PRIMARY.name}` }).click();
  const table = page.getByRole('table', { name: 'Đánh giá học sinh' });
  await expect(table).toBeVisible();
  await page.getByLabel('Mức đạt của Đặng Quốc Anh').selectOption({ label: 'Hoàn thành tốt' });
  await page.getByLabel('Điểm của Đặng Quốc Anh').fill('9');
  await page.getByLabel('Nhận xét của Đặng Quốc Anh').fill('Đọc to, rõ ràng');
  const sheet = await layoutViolations(page);
  expect(sheet, describeViolations(sheet)).toEqual([]);
});

test('CT-2114: khổ 390 Sổ điểm, Đánh giá là thẻ như trước', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInTeacher(page);
  await page.getByRole('button', { name: `Sổ điểm lớp ${SECONDARY.name}` }).click();
  await expect(page.getByRole('list', { name: 'Bảng điểm' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Bảng điểm' })).toHaveCount(0);
  const phone = [...(await horizontalOverflowViolations(page)), ...(await touchTargetViolations(page))];
  expect(phone, describeViolations(phone)).toEqual([]);
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await page.getByRole('button', { name: `Đánh giá lớp ${PRIMARY.name}` }).click();
  await expect(page.getByRole('list', { name: 'Đánh giá học sinh' })).toBeVisible();
});
