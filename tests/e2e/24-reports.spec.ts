import { expect, test } from '@playwright/test';
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

// Bảng điều khiển và báo cáo cơ bản (DT-07 phần 7a, YCTD-62): Hiệu trưởng thấy bảng điều khiển trên trang chủ; kế toán
// xem báo cáo học phí và thu chi
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

async function signIn(browser: import('@playwright/test').Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('Hiệu trưởng xem bảng điều khiển; kế toán xem báo cáo học phí và thu chi', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: unit.id }] });

  const principalPage = await signIn(browser, principal);
  const dashboard = principalPage.getByRole('region', { name: 'Bảng điều khiển' });
  await expect(dashboard).toContainText('Trẻ đang học');
  await expect(dashboard).toContainText('Công nợ còn phải thu');

  const page = await signIn(browser, accountant);
  await page.getByRole('link', { name: 'Báo cáo' }).click();
  await page.getByRole('tab', { name: 'Học phí' }).click();
  await page.getByRole('button', { name: 'Xem báo cáo' }).click();
  await expect(page.getByRole('region', { name: 'Theo lớp' })).toBeVisible();
  await expect(page.getByLabel('Tổng cộng')).toContainText('Còn phải thu');
  await page.getByRole('tab', { name: 'Thu chi' }).click();
  await page.getByRole('button', { name: 'Xem báo cáo' }).click();
  await expect(page.getByRole('region', { name: 'Theo khoản mục' })).toBeVisible();
  await expect(page.getByLabel('Tổng cộng')).toContainText('Chênh lệch');
});
