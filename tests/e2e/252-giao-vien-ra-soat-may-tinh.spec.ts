import type { Page, Route } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { describeViolations, horizontalOverflowViolations, touchTargetViolations } from './device-checks.js';
import { expect, test } from './fixtures.js';

// YCTD-395 lát L5 (spec 252, CT-2115, CT-2116): rà mọi màn của ứng dụng giáo viên ở khổ 1366 qua thanh bên; mỗi màn không cuộn ngang,
// mọi phần tử bấm được cao từ 44 px, tiêu đề màn hiện. Lớp THCS và Mầm non giả lập để mở chức năng của hai cấp; dữ liệu của màn là dữ
// liệu thật rỗng của giáo viên mới (màn hiện trạng thái rỗng hoặc lỗi lớp không tồn tại). Dữ liệu giả
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.use({ serviceWorkers: 'block' });

test.afterAll(async () => {
  await database.destroy();
});

const CLASSES = [
  { id: '00000000-0000-4000-8000-000000002521', name: 'Lớp 6A thử', school_level: 'THCS' },
  { id: '00000000-0000-4000-8000-000000002522', name: 'Lá 1 thử', school_level: 'MN' },
].map((item) => ({ ...item, org_unit_id: null, enrolled_count: 0, staff: [] }));

const PERMISSIONS = [
  'P04.pickup.gate-confirm',
  'P04.gate-pass.record',
  'P13.equipment.stocktake',
  'P09.training.use',
  'P02.learning.teach',
  'P02.supervision.record',
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
    (url) => url.pathname === '/api/v1/auth/me',
    async (route) => {
      const response = await route.fetch();
      const user = (await response.json()) as { assignments: unknown[] };
      user.assignments.push({ role_code: 'VT-07', org_unit_id: 'u-252', permissions: PERMISSIONS });
      await route.fulfill({ response, json: user });
    },
  );
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  return page.getByRole('navigation', { name: 'Điều hướng chính' });
}

// Mở từng mục, chờ màn vẽ xong (mục được đánh dấu, mạng rảnh), gom vi phạm theo tên mục
async function auditLinks(page: Page, labels: string[]) {
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  const violations: string[] = [];
  for (const label of labels) {
    const link = navigation.getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'page');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    const found = [...(await horizontalOverflowViolations(page)), ...(await touchTargetViolations(page))];
    if (found.length > 0) {
      violations.push(`${label}: ${describeViolations(found)}`);
    }
  }
  return violations;
}

test('CT-2115: khổ 1366 mọi màn chung mở từ thanh bên đạt bố cục', async ({ page }) => {
  test.setTimeout(180_000);
  await signInTeacher(page);
  const violations = await auditLinks(page, [
    'Lịch dạy của tôi',
    'Sổ đầu bài',
    'Hộp công cụ',
    'Chế độ lớp học',
    'Lớp trực tuyến',
    'Ghi nhận rèn luyện',
    'Chấm công, nghỉ phép',
    'Phiếu lương',
    'Công việc',
    'Bồi dưỡng',
    'Sách đang mượn',
    'Xác nhận người đón',
    'Quét thẻ ra vào',
    'Kiểm kê thiết bị',
  ]);
  expect(violations, violations.join('\n')).toEqual([]);
});

test('CT-2116: khổ 1366 mọi chức năng lớp THCS, Mầm non mở từ thanh bên đạt bố cục', async ({ page }) => {
  test.setTimeout(180_000);
  const navigation = await signInTeacher(page);
  // Trường nhiều cấp xếp lớp Mầm non lên đầu nên lớp đó đang chọn
  const preschool = await auditLinks(page, [
    'Điểm danh',
    'Đón trả',
    'Nhật ký',
    'Chăm sóc và y tế',
    'Trao đổi',
    'Hoạt động',
    'Báo cơm',
    'Dặn thuốc',
    'Giảng dạy',
  ]);
  await navigation.getByRole('link', { name: 'Lớp 6A thử' }).click();
  const secondary = await auditLinks(page, ['Điểm danh', 'Sổ điểm', 'Trao đổi', 'Giảng dạy']);
  expect([...preschool, ...secondary], [...preschool, ...secondary].join('\n')).toEqual([]);
});
