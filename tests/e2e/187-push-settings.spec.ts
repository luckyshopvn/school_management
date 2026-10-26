import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';

// Giao diện thông báo đẩy (DT-26 phần 26b, YCTD-239), kịch bản CT-26b-8 (CT-1121): giáo viên mở "Cài đặt thông báo", thấy các nhóm
// loại thông báo, tắt một nhóm thì tải lại vẫn tắt (máy chủ lưu); e2e một trường không bật đẩy nên máy báo "Hệ thống chưa bật";
// iPhone mở bằng Safari được hướng dẫn cài lên màn hình chính thay cho nút bật; mở trong Zalo báo không nhận được đẩy. Phần nhận
// đẩy của service worker kiểm ở packages/pwa/src/push/service-worker-push.test.ts (Chromium chạy ẩn không hiện thông báo). Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_ZALO =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 Zalo android/12100';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signInTeacher(browser: Browser, userAgent?: string): Promise<Page> {
  const reference = await schoolYear.selectFrom('org_units').select('id').executeTakeFirstOrThrow();
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.id }] });
  const page = await (await browser.newContext(userAgent ? { userAgent } : {})).newPage();
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  return page;
}

test('CT-26b-8: cài đặt thông báo đẩy theo nhóm, hướng dẫn theo máy', async ({ browser }) => {
  test.setTimeout(180_000);

  // Giáo viên: nhóm loại thông báo, tắt một nhóm thì máy chủ lưu
  const teacher = await signInTeacher(browser);
  await teacher.getByRole('button', { name: 'Cài đặt thông báo' }).click();
  const settings = teacher.getByRole('region', { name: 'Cài đặt thông báo' });
  await expect(settings).toContainText('Hệ thống chưa bật thông báo đẩy');
  const fees = settings.getByRole('checkbox', { name: 'Học phí và thanh toán' });
  await expect(fees).toBeChecked();
  await expect(settings.getByRole('checkbox', { name: 'Thông báo chung của trường' })).toBeChecked();
  await fees.uncheck();
  await expect(fees).not.toBeChecked();
  await teacher.reload();
  await expect(teacher.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  await teacher.getByRole('button', { name: 'Cài đặt thông báo' }).click();
  await expect(
    teacher.getByRole('region', { name: 'Cài đặt thông báo' }).getByRole('checkbox', { name: 'Học phí và thanh toán' }),
  ).not.toBeChecked();
  await teacher.context().close();

  // iPhone chưa cài: hướng dẫn cài lên màn hình chính, không có nút bật
  const iphone = await signInTeacher(browser, IPHONE_SAFARI);
  await iphone.getByRole('button', { name: 'Cài đặt thông báo' }).click();
  const iphoneSettings = iphone.getByRole('region', { name: 'Cài đặt thông báo' });
  await expect(iphoneSettings).toContainText('chỉ nhận được khi đã cài ứng dụng lên màn hình chính');
  await expect(iphoneSettings.getByRole('button', { name: 'Bật thông báo trên máy này' })).toHaveCount(0);
  await iphone.context().close();

  // Mở trong Zalo: không nhận được đẩy
  const zalo = await signInTeacher(browser, ANDROID_ZALO);
  await zalo.getByRole('button', { name: 'Cài đặt thông báo' }).click();
  await expect(zalo.getByRole('region', { name: 'Cài đặt thông báo' })).toContainText(
    'Trình duyệt này không nhận được thông báo đẩy',
  );
  await zalo.context().close();
});
