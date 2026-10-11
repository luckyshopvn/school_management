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

// Bảng quyết toán khi nghỉ việc (DT-06 phần 6c-2, YCTD-61): hợp đồng của nhân sự đã chấm dứt ở kiểm thử 19; kế toán lập
// và trình bảng quyết toán, Hiệu trưởng duyệt
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

test('Kế toán lập và trình bảng quyết toán của nhân sự đã nghỉ việc; Hiệu trưởng duyệt', async ({ browser }) => {
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: root.id }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });

  const page = await signIn(browser, accountant);
  await page.getByRole('link', { name: 'Quyết toán và điều chỉnh lương' }).click();
  const row = page.getByRole('row', { name: 'Quyết toán của Đỗ Thị Hạnh' });
  await row.getByRole('button', { name: 'Lập bảng quyết toán' }).click();
  const detail = page.getByRole('region', { name: 'Bảng quyết toán của Đỗ Thị Hạnh' });
  await expect(detail).toContainText('Trạng thái: Nháp');
  await expect(detail).toContainText('Lương được hưởng');
  await detail.getByRole('button', { name: 'Trình duyệt quyết toán' }).click();
  await expect(detail).toContainText('Trạng thái: Chờ duyệt');

  const principalPage = await signIn(browser, principal);
  await principalPage.getByRole('link', { name: 'Quyết toán và điều chỉnh lương' }).click();
  await principalPage
    .getByRole('row', { name: 'Quyết toán của Đỗ Thị Hạnh' })
    .getByRole('button', { name: 'Chi tiết' })
    .click();
  const principalDetail = principalPage.getByRole('region', { name: 'Bảng quyết toán của Đỗ Thị Hạnh' });
  await principalDetail.getByRole('button', { name: 'Duyệt quyết toán' }).click();
  await expect(principalDetail).toContainText('Trạng thái: Đã duyệt');
});
