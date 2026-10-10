import { expect, test } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, TEST_PASSWORD } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// Khai báo quỹ, lập phiếu thu từ màn hình công nợ, phụ huynh thấy hóa đơn đã thu đủ (DT-05 phần 5d-1, YCTD-53).
// Dùng hóa đơn HD-900001 còn phải nộp 2 893 000 sau miễn giảm (15-invoices.spec.ts) và khoản mục thu của 13-fees.spec.ts
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const CHILD_NAME = 'Nguyễn Gia Bảo';
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

test('Kế toán khai báo quỹ, thu đủ hóa đơn từ màn hình công nợ; phụ huynh thấy đã thu đủ và lịch sử đã nộp', async ({
  browser,
}) => {
  const child = await schoolYear
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select(['children.org_unit_id', 'org_units.name as unit_name', 'guardians.phone'])
    .where('children.full_name', '=', CHILD_NAME)
    .where('guardians.user_id', 'is not', null)
    .executeTakeFirstOrThrow();

  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: child.org_unit_id }] });
  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(accountant.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(accountant.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();

  await portal.getByRole('link', { name: 'Quỹ và ngân hàng' }).click();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const accounts = portal.getByRole('region', { name: 'Quỹ và tài khoản của đơn vị' });
  await accounts.getByLabel('Tên quỹ hoặc tài khoản').fill('Quỹ tiền mặt cơ sở');
  await accounts.getByLabel('Số dư đầu').fill('1000000');
  await accounts.getByRole('button', { name: 'Thêm' }).click();
  await expect(accounts.getByRole('row').filter({ hasText: 'Quỹ tiền mặt cơ sở' })).toContainText('1.000.000');

  await portal.getByRole('link', { name: 'Công nợ' }).click();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const row = portal.getByRole('row', { name: `Công nợ ${CHILD_NAME}` });
  await expect(row).toContainText('2.893.000');
  await row.getByRole('button', { name: 'Chi tiết' }).click();
  const panel = portal.getByRole('group', { name: `Công nợ của ${CHILD_NAME}` });
  const form = panel.getByRole('form', { name: `Lập phiếu thu cho ${CHILD_NAME}` });
  await form.getByRole('checkbox', { name: /HD-900001/ }).check();
  await form.getByLabel('Người nộp').fill('Nguyễn Tiến Vinh');
  await form.getByLabel('Số tiền thu').fill('2893000');
  await expect(form).toContainText('Tổng phân bổ 2.893.000');
  await form.getByRole('button', { name: 'Phát hành phiếu thu' }).click();
  await expect(panel).toContainText('Đã thu đủ');
  await expect(panel.getByRole('listitem').filter({ hasText: 'PT-' })).toContainText('2.893.000');

  await portal.getByRole('link', { name: 'Quỹ và ngân hàng' }).click();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  await expect(
    portal.getByRole('region', { name: 'Quỹ và tài khoản của đơn vị' }).getByRole('row').filter({
      hasText: 'Quỹ tiền mặt cơ sở',
    }),
  ).toContainText('3.893.000');

  const parent = await (await browser.newContext()).newPage();
  await parent.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parent.getByLabel('Số điện thoại').fill(child.phone ?? '');
  await parent.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD);
  await parent.getByRole('button', { name: 'Đăng nhập' }).click();
  const card = parent.getByRole('listitem', { name: CHILD_NAME });
  await card.getByRole('button', { name: 'Học phí' }).click();
  await expect(card.getByRole('listitem', { name: 'Hóa đơn HD-900001' })).toContainText('Đã thu đủ');
  await expect(card.getByRole('region', { name: 'Lịch sử đã nộp' })).toContainText('2.893.000');
});
