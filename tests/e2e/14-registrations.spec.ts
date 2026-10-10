import { expect, test } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// Đăng ký dịch vụ theo kỳ (DT-05 phần 5b, YCTD-50). Chạy sau 09-children.spec.ts và 13-fees.spec.ts: trẻ Nguyễn Gia Bảo
// học Phân hiệu A, đã có dịch vụ STEM. Kỳ dùng là tháng hiện tại cộng hai để luôn còn trong thời gian đăng ký
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const CHILD_NAME = 'Nguyễn Gia Bảo';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const PERIOD = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) + 1, 1))
  .toISOString()
  .slice(0, 7);
// Ngày chốt mặc định là ngày 25 của tháng trước kỳ; dùng để chờ bảng của đúng kỳ đã tải xong
const CLOSING_DATE = `${new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 7)}-25`;
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

test('Kế toán đăng ký STEM cho trẻ; phụ huynh thấy và hủy trên ứng dụng phụ huynh; kế toán chốt danh sách kỳ', async ({
  browser,
}) => {
  const child = await schoolYear
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select(['children.org_unit_id', 'org_units.name as unit_name', 'guardians.user_id', 'guardians.phone'])
    .where('children.full_name', '=', CHILD_NAME)
    .where('guardians.user_id', 'is not', null)
    .executeTakeFirstOrThrow();

  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: child.org_unit_id }] });
  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(accountant.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(accountant.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await portal.getByRole('link', { name: 'Đăng ký dịch vụ' }).click();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  await portal.getByRole('combobox', { name: /^Kỳ/ }).selectOption(PERIOD);
  const sheet = portal.getByRole('region', { name: 'Bảng đăng ký dịch vụ' });
  await expect(sheet).toContainText(`Ngày chốt đăng ký: ${CLOSING_DATE}`);
  const row = sheet.getByRole('row', { name: CHILD_NAME });
  await expect(row).toContainText('Bắt buộc');
  await row.getByRole('button', { name: `Đăng ký STEM cho ${CHILD_NAME}` }).click();
  await expect(row).toContainText('Đã đăng ký');

  await identity
    .updateTable('users')
    .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
    .where('id', '=', child.user_id ?? '')
    .execute();
  const parent = await (await browser.newContext()).newPage();
  await parent.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parent.getByLabel('Số điện thoại').fill(child.phone ?? '');
  await parent.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD);
  await parent.getByRole('button', { name: 'Đăng nhập' }).click();
  const card = parent.getByRole('listitem', { name: CHILD_NAME });
  await card.getByRole('button', { name: 'Dịch vụ' }).click();
  const panel = card.getByRole('region', { name: `Dịch vụ của ${CHILD_NAME}` });
  await panel.getByLabel('Tháng').selectOption(PERIOD);
  await expect(panel).toContainText(`Hạn đăng ký: ${CLOSING_DATE}`);
  const stem = panel.getByRole('listitem', { name: 'STEM' });
  await expect(stem).toContainText('Đã đăng ký');
  await expect(panel.getByRole('listitem', { name: /^Bán trú/ })).toContainText('Bắt buộc');
  await stem.getByRole('button', { name: 'Hủy' }).click();
  await expect(panel.getByText('Đã gửi hủy dịch vụ')).toBeVisible();
  await expect(stem.getByRole('button', { name: 'Đăng ký' })).toBeVisible();

  await portal.reload();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  await portal.getByRole('combobox', { name: /^Kỳ/ }).selectOption(PERIOD);
  await expect(sheet).toContainText(`Ngày chốt đăng ký: ${CLOSING_DATE}`);
  await sheet.getByRole('button', { name: 'Chốt danh sách đăng ký' }).click();
  await expect(sheet).toContainText('Đã chốt danh sách');
  await expect(sheet).toContainText('Đăng ký thêm là đăng ký trễ');
});
