import { expect, test, type Browser } from '@playwright/test';
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

// Kho, tài sản và mua hàng (DT-10 phần 10d, YCTD-77): nhân sự lập đề nghị mua hàng, Hiệu trưởng duyệt, thủ kho lập phiếu
// mua hàng từ đề nghị đã duyệt và nhận hàng vào kho
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

test('Nhân sự lập đề nghị mua hàng; Hiệu trưởng duyệt; thủ kho lập phiếu mua và nhận hàng vào kho', async ({
  browser,
}) => {
  const reference = await schoolYear.selectFrom('classes').select('org_unit_id').executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const reason = `Mua bút màu ${suffix}`;
  const itemCode = `BUT-${suffix}`;
  const itemName = `Bút màu ${suffix}`;
  const supplierName = `Văn phòng phẩm ${suffix}`;
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const storekeeper = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-11', orgUnitId: reference.org_unit_id }],
  });

  const teacherPage = await signIn(browser, teacher);
  await openMenu(teacherPage, '/purchase-requests');
  await teacherPage.getByLabel('Lý do').fill(reason);
  await teacherPage.getByLabel('Tên mặt hàng').fill('Bút màu sáp');
  await teacherPage.getByLabel('Số lượng').fill('5');
  await teacherPage.getByLabel('Đơn vị tính').fill('hộp');
  await teacherPage.getByLabel('Đơn giá dự kiến').fill('20000');
  await teacherPage.getByRole('button', { name: 'Gửi đề nghị' }).click();
  await expect(teacherPage.getByText(/Đã gửi đề nghị DNMH-\d{6}/)).toBeVisible();
  await expect(teacherPage.getByRole('row').filter({ hasText: reason })).toContainText('Chờ duyệt');

  const principalPage = await signIn(browser, principal);
  await openMenu(principalPage, '/purchase-requests');
  await principalPage.getByRole('tab', { name: 'Chờ duyệt' }).click();
  const pendingRow = principalPage.getByRole('row').filter({ hasText: reason });
  await expect(pendingRow).toContainText('100.000 đồng');
  await pendingRow.getByRole('button', { name: 'Duyệt' }).click();
  await expect(principalPage.getByText(/Đã duyệt đề nghị DNMH-\d{6}/)).toBeVisible();

  const storePage = await signIn(browser, storekeeper);
  await openMenu(storePage, '/inventory');
  await storePage.getByLabel('Mã mặt hàng').fill(itemCode);
  await storePage.getByLabel('Tên mặt hàng').fill(itemName);
  await storePage.getByLabel('Đơn vị tính').fill('hộp');
  await storePage.getByRole('button', { name: 'Thêm mặt hàng' }).click();
  await expect(storePage.getByText(`Đã thêm mặt hàng ${itemCode}`)).toBeVisible();

  await storePage.getByRole('tab', { name: 'Nhà cung cấp' }).click();
  await storePage.getByLabel('Tên nhà cung cấp').fill(supplierName);
  await storePage.getByRole('button', { name: 'Thêm nhà cung cấp' }).click();
  await expect(storePage.getByText(`Đã thêm nhà cung cấp ${supplierName}`)).toBeVisible();

  await storePage.getByRole('tab', { name: 'Phiếu mua hàng' }).click();
  const requestSelect = storePage.getByLabel('Đề nghị đã duyệt');
  const requestValue = await requestSelect.locator('option', { hasText: reason }).getAttribute('value');
  await requestSelect.selectOption(requestValue ?? '');
  await storePage.getByLabel('Nhà cung cấp').selectOption({ label: supplierName });
  await storePage.getByLabel('Nhập vào mặt hàng kho').selectOption({ label: `${itemCode} ${itemName}` });
  await storePage.getByLabel('Đơn giá mua').fill('18000');
  await storePage.getByRole('button', { name: 'Lập phiếu mua hàng' }).click();
  await expect(storePage.getByText(/Đã lập phiếu mua hàng PMH-\d{6}/)).toBeVisible();
  const orderRow = storePage.getByRole('row').filter({ hasText: supplierName });
  await expect(orderRow).toContainText('90.000 đồng');
  await expect(orderRow).toContainText('Chờ nhận hàng');
  await orderRow.getByRole('button', { name: 'Nhận hàng' }).click();
  await expect(storePage.getByText(/Đã nhận hàng của phiếu PMH-\d{6} vào kho/)).toBeVisible();
  await expect(orderRow).toContainText('Chờ thanh toán');

  await storePage.getByRole('tab', { name: 'Mặt hàng và tồn kho' }).click();
  await expect(
    storePage.getByRole('table', { name: 'Tồn kho' }).getByRole('row').filter({ hasText: itemCode }),
  ).toContainText('5 hộp');
});
