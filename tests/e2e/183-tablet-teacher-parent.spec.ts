import type { Page, Route } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import {
  accessibilityViolations,
  describeViolations,
  horizontalOverflowViolations,
  inputFontViolations,
  touchTargetViolations,
} from './device-checks.js';
import { expect, test } from './fixtures.js';

// DT-26 phần 26d (YCTD-234, spec 183, CT-26d-2): bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh, chạy ở các dự án thiết bị của 26c
// (E2E_DEVICES=pr hoặc full; ở dự án `chromium` mặc định chạy như ca thường ở khổ máy tính). Việc kiem-thu-thiet-bi không có năm học nên
// danh sách lớp và thời khoá biểu của giáo viên được giả lập bằng page.route; kiểm bố cục, vùng chạm, cỡ chữ ô nhập, không cuộn ngang,
// axe không lỗi nghiêm trọng. Dữ liệu giả
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;

// Yêu cầu do service worker của PWA gửi không qua page.route ở WebKit: chặn service worker để mọi yêu cầu API đi qua bản giả lập
test.use({ serviceWorkers: 'block' });

test.afterAll(async () => {
  await database.destroy();
});

const CLASSES = [
  { id: '00000000-0000-4000-8000-000000000183', name: 'Lớp 6A1 thử', school_level: 'THCS' },
  { id: '00000000-0000-4000-8000-000000000184', name: 'Lớp 7B2 thử', school_level: 'THCS' },
].map((item) => ({ ...item, org_unit_id: null, enrolled_count: 0, staff: [] }));

const fulfillJson = (body: unknown) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function signInTeacher(page: Page) {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  // WebKit chạy không giao diện có thể treo khi vào toàn màn hình thật: giả lập Fullscreen API để chỉ kiểm nội dung trình chiếu
  // (viết dạng chuỗi vì gói kiểm thử không có kiểu DOM)
  await page.addInitScript({
    content: `(() => {
      let current = null;
      const change = () => document.dispatchEvent(new Event('fullscreenchange'));
      Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => current });
      Element.prototype.requestFullscreen = function () { current = this; change(); return Promise.resolve(); };
      Document.prototype.exitFullscreen = () => { current = null; change(); return Promise.resolve(); };
    })();`,
  });
  await page.route(
    (url) => url.pathname === '/api/v1/classes' && url.searchParams.get('mine') === 'true',
    fulfillJson(CLASSES),
  );
  // Lớp 7B2 đang có tiết cả ngày (giờ Việt Nam) để chế độ lớp học chọn sẵn lớp đó
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' }).format(new Date()),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/timetables/mine',
    fulfillJson({
      versions: [{ school_level: 'THCS' }],
      slots: { THCS: [{ period_no: 1, start_time: '00:00', end_time: '23:59' }] },
      lessons: [{ id: 'tiet-1', class_name: 'Lớp 7B2 thử', weekday: weekday + 1, period_no: 1, subject_name: 'Toán' }],
    }),
  );
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
}

async function deviceViolations(page: Page) {
  return [
    ...(await horizontalOverflowViolations(page)),
    ...(await inputFontViolations(page)),
    ...(await touchTargetViolations(page)),
    ...(await accessibilityViolations(page)),
  ];
}

const boxOf = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) {
    throw new Error(`Không thấy ${selector}`);
  }
  return box;
};

test('@thiet-bi @thiet-bi-pr CT-26d-2: trang chủ và chế độ lớp học của giáo viên theo khổ thiết bị', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInTeacher(page);
  const width = page.viewportSize()?.width ?? 1280;
  await expect(page.getByRole('button', { name: 'Sổ điểm lớp Lớp 6A1 thử' })).toBeVisible();
  // Đón trả, dặn thuốc chỉ ở lớp Mầm non, Tiểu học (DT-29, YCTD-325)
  await expect(page.getByRole('button', { name: 'Đón trả lớp Lớp 6A1 thử' })).toHaveCount(0);
  const home = await deviceViolations(page);
  expect(home, describeViolations(home)).toEqual([]);

  // Từ 1024 px: thông báo, chấm công ở khung trái; lớp của tôi ở khung phải
  const left = await boxOf(page, 'main > div:first-child');
  const right = await boxOf(page, 'main > div:nth-child(2)');
  if (width >= 1024) {
    expect(right.x).toBeGreaterThan(left.x + left.width - 1);
  } else {
    expect(right.y).toBeGreaterThan(left.y);
  }

  // Chế độ lớp học: chọn sẵn lớp của tiết đang dạy, hai khung cạnh nhau từ 1024 px
  await page.getByRole('button', { name: 'Chế độ lớp học' }).click();
  await expect(page.getByRole('heading', { name: 'Chế độ lớp học' })).toBeVisible();
  await expect(page.getByText('Đang dạy: tiết 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lớp 7B2 thử' })).toHaveAttribute('aria-pressed', 'true');
  const tabs = page.getByRole('tablist', { name: 'Việc trên lớp' });
  await expect(tabs.getByRole('tab', { name: 'Sổ đầu bài' })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Hộp công cụ giảng dạy' }).click();
  await expect(tabs.getByRole('tab', { name: 'Hộp công cụ giảng dạy' })).toHaveAttribute('aria-selected', 'true');
  const nav = await boxOf(page, 'nav[aria-label="Lớp của tiết"]');
  const section = await boxOf(page, 'section[aria-label="Lớp Lớp 7B2 thử"]');
  if (width >= 1024) {
    expect(section.x).toBeGreaterThan(nav.x + nav.width - 1);
  } else {
    expect(section.y).toBeGreaterThan(nav.y);
  }
  const classroom = [...(await horizontalOverflowViolations(page)), ...(await touchTargetViolations(page))];
  expect(classroom, describeViolations(classroom)).toEqual([]);

  // Trình chiếu: chỉ công cụ lớp học, ẩn danh sách lớp và các thẻ có thông tin riêng
  await page.getByRole('button', { name: 'Trình chiếu' }).click();
  await expect(page.getByRole('button', { name: 'Thoát trình chiếu' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Lớp của tiết' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sổ đầu bài' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thoát trình chiếu' }).click();
  await expect(page.getByRole('navigation', { name: 'Lớp của tiết' })).toBeVisible();
});

test('@thiet-bi @thiet-bi-pr CT-26d-3: trang chủ phụ huynh hai cột từ 768 px', async ({ page }) => {
  const parent = await createTestUser(database, { roles: [{ roleCode: 'VT-14', orgUnitId: null }] });
  const phone = `07${String(Date.now() % 100_000_000).padStart(8, '0')}`;
  await database.updateTable('users').set({ phone }).where('id', '=', parent.id).execute();
  await page.goto(PARENT_URL);
  await page.getByLabel('Số điện thoại').fill(phone);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  const width = page.viewportSize()?.width ?? 1280;
  const left = await boxOf(page, 'main > div:first-child');
  const right = await boxOf(page, 'main > div:nth-child(2)');
  if (width >= 768) {
    expect(right.x).toBeGreaterThan(left.x + left.width - 1);
  } else {
    expect(right.y).toBeGreaterThan(left.y);
  }
  const violations = await deviceViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);
});
