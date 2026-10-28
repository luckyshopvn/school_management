import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_STUDENT_PORT, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import {
  accessibilityViolations,
  describeViolations,
  horizontalOverflowViolations,
  inputFontViolations,
  newViolations,
  touchTargetViolations,
} from './device-checks.js';
import { expect, test } from './fixtures.js';

// DT-26 phần 26c (YCTD-233, spec 180): khung kiểm thử theo khổ thiết bị. Spec gắn nhãn @thiet-bi (chạy ở bốn dự án thiết bị khi chạy đủ) và
// @thiet-bi-pr (tập con chạy ở yêu cầu kéo). Chạy bằng E2E_DEVICES=pr hoặc E2E_DEVICES=full; ở dự án `chromium` mặc định các ca này vẫn chạy như
// ca thường nên không thay đổi cách chạy hiện có. Đo ở các trang đăng nhập của bốn ứng dụng và trang chủ cổng quản trị (dữ liệu giả)
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

const LOGIN_PAGES = [
  { name: 'cổng quản trị', url: '/', heading: 'Đăng nhập' },
  { name: 'ứng dụng giáo viên', url: `http://localhost:${E2E_TEACHER_PORT}/`, heading: 'Đăng nhập' },
  { name: 'ứng dụng phụ huynh', url: `http://localhost:${E2E_PARENT_PORT}/`, heading: 'Đăng nhập' },
  // Ứng dụng học sinh tách riêng (YCTD-300)
  { name: 'ứng dụng học sinh', url: `http://localhost:${E2E_STUDENT_PORT}/`, heading: 'Đăng nhập học sinh' },
];

for (const target of LOGIN_PAGES) {
  test(`@thiet-bi @thiet-bi-pr Trang đăng nhập ${target.name}: không cuộn ngang, ô nhập từ 16 px, vùng chạm từ 44 px, axe không lỗi nghiêm trọng`, async ({
    page,
  }) => {
    await page.goto(target.url);
    await expect(page.getByRole('heading', { name: target.heading })).toBeVisible();
    const violations = [
      ...(await horizontalOverflowViolations(page)),
      ...(await inputFontViolations(page)),
      ...(await touchTargetViolations(page)),
      ...(await accessibilityViolations(page)),
    ];
    if (process.env.E2E_PRINT_BASELINE === '1') {
      // In khóa các vi phạm hiện có để cập nhật device-baseline.json (không hỏng ca)
      console.log(
        `BASELINE ${target.name} ${JSON.stringify([...new Set(violations.map((violation) => violation.key))])}`,
      );
      return;
    }
    const added = newViolations(target.name, violations);
    expect(added, describeViolations(added)).toEqual([]);
  });
}

test('@thiet-bi Trang chủ cổng quản trị sau đăng nhập: không cuộn ngang cả trang, ô nhập từ 16 px', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  const violations = [...(await horizontalOverflowViolations(page)), ...(await inputFontViolations(page))];
  expect(violations, describeViolations(violations)).toEqual([]);
});

// Ảnh chụp tham chiếu chỉ so ở Linux của CI (kết xuất chữ khác nhau giữa hệ điều hành): bật bằng E2E_SCREENSHOTS=1; tạo ảnh gốc bằng
// `playwright test --update-snapshots` ở CI rồi đưa vào kho
test('@thiet-bi Ảnh chụp tham chiếu trang đăng nhập cổng quản trị', async ({ page }) => {
  test.skip(
    process.platform !== 'linux' || process.env.E2E_SCREENSHOTS !== '1',
    'Ảnh tham chiếu chỉ so ở Linux khi bật E2E_SCREENSHOTS=1',
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page).toHaveScreenshot('dang-nhap-cong-quan-tri.png', { maxDiffPixelRatio: 0.02 });
});
