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

// Báo cáo giai đoạn 2 (DT-10 phần 10j, YCTD-83): quản lý đơn vị xem báo cáo hoạt động; cán bộ quản lý cấp trên xem báo
// cáo hợp nhất, không thấy báo cáo có dữ liệu cá nhân; Hiệu trưởng xuất báo cáo hợp nhất ra Excel và thấy nhật ký xuất
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
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('Báo cáo hoạt động, báo cáo hợp nhất và xuất dữ liệu có nhật ký', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: unit.id }] });
  const upper = await createTestUser(identity, { roles: [{ roleCode: 'VT-19', orgUnitId: null }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });

  const managerPage = await signIn(browser, manager);
  await managerPage.getByRole('link', { name: 'Báo cáo' }).click();
  await managerPage.getByRole('tab', { name: 'Hoạt động và công việc' }).click();
  await managerPage.getByRole('button', { name: 'Xem báo cáo' }).click();
  await expect(managerPage.getByRole('region', { name: 'Sổ liên lạc hằng ngày' })).toBeVisible();
  await expect(managerPage.getByRole('region', { name: 'Dặn thuốc' })).toBeVisible();
  await expect(managerPage.getByRole('tab', { name: 'Hợp nhất đơn vị' })).toHaveCount(0);

  const upperPage = await signIn(browser, upper);
  await upperPage.getByRole('link', { name: 'Báo cáo' }).click();
  await expect(upperPage.getByRole('tab', { name: 'Công nợ' })).toHaveCount(0);
  await upperPage.getByRole('tab', { name: 'Hợp nhất đơn vị' }).click();
  await upperPage.getByRole('button', { name: 'Xem báo cáo' }).click();
  const comparison = upperPage.getByRole('region', { name: 'So sánh theo đơn vị' });
  await expect(comparison).toContainText('Tổng các đơn vị đã chọn');
  await expect(upperPage.getByRole('button', { name: 'Xuất Excel' })).toHaveCount(0);

  const page = await signIn(browser, principal);
  await page.getByRole('link', { name: 'Báo cáo' }).click();
  await page.getByRole('tab', { name: 'Hợp nhất đơn vị' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^bao-cao-consolidated-.*\.xlsx$/);
  await page.getByRole('tab', { name: 'Nhật ký xuất' }).click();
  await expect(page.getByRole('region', { name: 'Các lần xuất dữ liệu' })).toContainText('Hợp nhất đơn vị');
});
