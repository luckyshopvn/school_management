import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  accessibilityViolations,
  describeViolations,
  horizontalOverflowViolations,
  inputFontViolations,
  touchTargetViolations,
} from './device-checks.js';
import { expect, test } from './fixtures.js';

// DT-26 phần 26f (YCTD-236, spec 185, bản demo): trang khởi động của vỏ ứng dụng cài đặt (`apps/mobile/www/index.html`) chạy như trong
// WebView: thêm trường bằng địa chỉ, thêm máy chủ phát triển, mở ứng dụng giáo viên hoặc phụ huynh của trường (đường dẫn /giao-vien/,
// /phu-huynh/), báo lỗi địa chỉ sai, xóa trường; đạt bộ kiểm theo khổ thiết bị của 26c. Bản dựng Android, iOS chưa chạy được ở CI (cần
// Android SDK, Xcode). Dữ liệu giả, tên miền ví dụ
const LAUNCHER = pathToFileURL(fileURLToPath(new URL('../../apps/mobile/www/index.html', import.meta.url))).href;

test('@thiet-bi @thiet-bi-pr CT-26f-1: trang khởi động của vỏ ứng dụng: thêm trường, mở ứng dụng theo vai trò, báo lỗi địa chỉ', async ({
  page,
}) => {
  await page.goto(LAUNCHER);
  await expect(page.getByRole('heading', { name: 'School Management' })).toBeVisible();
  await expect(page.getByText('Chưa có trường nào.')).toBeVisible();
  const violations = [
    ...(await horizontalOverflowViolations(page)),
    ...(await inputFontViolations(page)),
    ...(await touchTargetViolations(page)),
    ...(await accessibilityViolations(page)),
  ];
  expect(violations, describeViolations(violations)).toEqual([]);

  // Địa chỉ sai thì báo lỗi, không thêm
  await page.getByLabel('Địa chỉ trường').fill('khong-phai-dia-chi');
  await page.getByRole('button', { name: 'Thêm trường' }).click();
  await expect(page.getByRole('alert')).toHaveText('Địa chỉ trường chưa đúng');
  await page.getByLabel('Địa chỉ trường').fill('ftp://truong-thu.example.vn');
  await page.getByRole('button', { name: 'Thêm trường' }).click();
  await expect(page.getByRole('alert')).toHaveText('Địa chỉ phải bắt đầu bằng https://');

  // Thêm trường và máy chủ phát triển; danh sách giữ sau khi tải lại
  await page.getByLabel('Địa chỉ trường').fill('https://truong-thu.example.vn/bat-ky');
  await page.getByRole('button', { name: 'Thêm trường' }).click();
  await page.getByRole('button', { name: 'Máy chủ phát triển trên máy này' }).click();
  await page.reload();
  const schools = page.getByRole('list', { name: 'Trường đã thêm' });
  await expect(schools.getByRole('listitem')).toHaveCount(2);
  await expect(schools.getByRole('listitem').first()).toContainText('truong-thu.example.vn');
  const listed = [...(await touchTargetViolations(page)), ...(await accessibilityViolations(page))];
  expect(listed, describeViolations(listed)).toEqual([]);

  // Vai trò mở đúng đường dẫn của trường; máy chủ phát triển mở cổng của từng ứng dụng
  await page.route('https://truong-thu.example.vn/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Ứng dụng của trường</h1>' }),
  );
  await schools.getByRole('listitem').first().getByRole('button', { name: 'Phụ huynh' }).click();
  await expect(page).toHaveURL('https://truong-thu.example.vn/phu-huynh/');
  await page.goto(LAUNCHER);
  await schools.getByRole('listitem').first().getByRole('button', { name: 'Giáo viên' }).click();
  await expect(page).toHaveURL('https://truong-thu.example.vn/giao-vien/');
  await page.goto(LAUNCHER);
  await page.route('http://localhost:5174/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Ứng dụng giáo viên</h1>' }),
  );
  await schools.getByRole('listitem').nth(1).getByRole('button', { name: 'Giáo viên' }).click();
  await expect(page).toHaveURL('http://localhost:5174/');

  // Xóa trường
  await page.goto(LAUNCHER);
  await schools.getByRole('listitem').first().getByRole('button', { name: 'Xóa trường' }).click();
  await expect(schools.getByRole('listitem')).toHaveCount(1);
  await expect(schools.getByRole('listitem')).toContainText('Máy chủ phát triển');
});
