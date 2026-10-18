import { expect, test, type Browser } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Tương tác với phụ huynh, Hoạt động và tin tức theo lưới và biểu mẫu chung (DT-15 phần 15f3, YCTD-115): quản lý đơn vị
// lập bình chọn và tin tức bằng nút Thêm mới của lưới, biểu mẫu theo khối, nút Ghi; dòng mới hiện trong lưới
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-15f3-3, CT-15f3-4: lập bình chọn và tin tức từ lưới, biểu mẫu theo khối, nút Ghi', async ({ browser }) => {
  const reference = await schoolYear.selectFrom('classes').select('org_unit_id').executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const pollTitle = `Chọn ngày dã ngoại ${suffix}`;
  const newsTitle = `Thông báo họp phụ huynh ${suffix}`;
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }] });
  const page = await signIn(browser, manager);

  // Tương tác với phụ huynh: lưới Bình chọn và khảo sát
  await openMenu(page, '/interactions');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tương tác với phụ huynh');
  const polls = page.getByRole('region', { name: 'Bình chọn và khảo sát' });
  await polls.getByRole('button', { name: 'Thêm mới' }).click();
  const pollForm = page.getByRole('form', { name: 'Lập bình chọn' });
  await pollForm.getByLabel('Tiêu đề').fill(pollTitle);
  await pollForm.getByLabel('Phương án (mỗi dòng một phương án)').fill('Thứ bảy\nChủ nhật');
  await pollForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(pollForm).toHaveCount(0);
  const pollRow = polls.getByRole('row').filter({ hasText: pollTitle });
  await expect(pollRow).toContainText('Nháp');
  await pollRow.getByRole('button', { name: 'Mở', exact: true }).click();
  await expect(pollRow).toContainText('Đang mở');

  // Hoạt động và tin tức: lưới Danh sách tin tức
  await openMenu(page, '/activities');
  await page.getByRole('tab', { name: 'Tin tức' }).click();
  const news = page.getByRole('region', { name: 'Danh sách tin tức' });
  await news.getByRole('button', { name: 'Thêm mới' }).click();
  const newsForm = page.getByRole('form', { name: 'Thêm tin tức' });
  await newsForm.getByLabel('Tiêu đề tin').fill(newsTitle);
  await newsForm.getByLabel('Nội dung tin').fill('Họp phụ huynh đầu năm vào sáng thứ bảy.');
  await newsForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(newsForm).toHaveCount(0);
  const newsRow = news.getByRole('row').filter({ hasText: newsTitle });
  await expect(newsRow).toBeVisible();
  await newsRow.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('group', { name: `Tin ${newsTitle}` })).toBeVisible();
});
