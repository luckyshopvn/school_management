import { expect, test } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  MEAL_SERVICE_ID,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// Xem hóa đơn trên cổng quản trị và ứng dụng phụ huynh (DT-05 phần 5c-1, YCTD-51). Tính học phí cần một tháng đã qua
// chốt đủ điểm danh nên đã kiểm thử ở apps/api/src/fees/fee-calculation.test.ts; ở đây ghi sẵn một hóa đơn đã phát hành
// cho trẻ Nguyễn Gia Bảo (09-children.spec.ts) để kiểm tra màn hình
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const CHILD_NAME = 'Nguyễn Gia Bảo';
const PERIOD = '2026-10';
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

test('Kế toán xem bảng học phí kỳ có hóa đơn đã phát hành; phụ huynh xem học phí và chi tiết của con', async ({
  browser,
}) => {
  const child = await schoolYear
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select([
      'children.id',
      'children.org_unit_id',
      'org_units.name as unit_name',
      'guardians.user_id',
      'guardians.phone',
    ])
    .where('children.full_name', '=', CHILD_NAME)
    .where('guardians.user_id', 'is not', null)
    .executeTakeFirstOrThrow();
  const invoice = await schoolYear
    .insertInto('invoices')
    .values({
      code: 'HD-900001',
      child_id: child.id,
      org_unit_id: child.org_unit_id,
      period_year: 2026,
      period_month: 10,
      invoice_kind: 'main',
      status: 'issued',
      total_amount: 2_970_000,
      basis: JSON.stringify({ school_days: 22, enrolled_days: 22, present_days: 22 }),
      review_flags: JSON.stringify([]),
      due_date: '2026-11-15',
      issued_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('invoice_items')
    .values([
      {
        invoice_id: invoice.id,
        item_type: 'tuition',
        description: 'Học phí chính khóa',
        quantity: 1,
        unit_price: 2_200_000,
        amount: 2_200_000,
      },
      {
        invoice_id: invoice.id,
        item_type: 'service',
        service_id: MEAL_SERVICE_ID,
        description: 'Bán trú',
        quantity: 22,
        unit_price: 35_000,
        amount: 770_000,
        basis_note: '22 ngày ăn',
      },
    ])
    .execute();

  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: child.org_unit_id }] });
  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(accountant.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(accountant.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await portal.getByRole('link', { name: 'Học phí' }).click();
  await portal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  await portal.getByRole('combobox', { name: /^Kỳ/ }).selectOption(PERIOD);
  const sheet = portal.getByRole('region', { name: 'Bảng tính học phí' });
  const row = sheet.getByRole('row', { name: `Hóa đơn ${CHILD_NAME}` });
  await expect(row).toContainText('HD-900001');
  await expect(row).toContainText('2.970.000');
  await row.getByRole('button', { name: 'Chi tiết' }).click();
  await expect(sheet.getByRole('table', { name: `Chi tiết hóa đơn của ${CHILD_NAME}` })).toContainText('22 ngày ăn');

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
  await card.getByRole('button', { name: 'Học phí' }).click();
  const item = card.getByRole('listitem', { name: 'Hóa đơn HD-900001' });
  await expect(item).toContainText('Tháng 10/2026');
  await expect(item).toContainText('2.970.000');
  await item.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(item).toContainText('Bán trú (22 ngày ăn)');
});
