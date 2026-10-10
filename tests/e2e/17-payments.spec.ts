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

// Lập phiếu chi kèm chứng từ, Hiệu trưởng duyệt, xem sổ quỹ (DT-05 phần 5e-1, YCTD-55). Dùng quỹ "Quỹ tiền mặt cơ sở"
// còn 1 000 000 sau khi thu rồi đảo phiếu thu ở 16-receipts.spec.ts; Hiệu trưởng duyệt được mọi mức
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const CHILD_NAME = 'Nguyễn Gia Bảo';
const PAYEE = 'Cửa hàng rau sạch';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
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

test('Kế toán lập phiếu chi kèm chứng từ và trình duyệt; Hiệu trưởng duyệt; sổ quỹ ghi phiếu chi', async ({
  browser,
}) => {
  const child = await schoolYear
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .select(['children.org_unit_id', 'org_units.name as unit_name'])
    .where('children.full_name', '=', CHILD_NAME)
    .executeTakeFirstOrThrow();
  const signIn = async (roleCode: string, orgUnitId: string | null) => {
    const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId }] });
    const page = await (await browser.newContext()).newPage();
    await page.goto('/');
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    return { page, user };
  };

  const { page: accountant, user: accountantUser } = await signIn('VT-04', child.org_unit_id);
  await schoolYear
    .insertInto('cashflow_categories')
    .values({
      code: 'MUA_RAU',
      name: 'Mua rau',
      group_name: 'Chi bếp ăn',
      flow_type: 'expense',
      created_by: accountantUser.id,
    })
    .execute();
  await accountant.getByRole('link', { name: 'Phiếu chi' }).click();
  await accountant.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const form = accountant.getByRole('form', { name: 'Lập phiếu chi' });
  await expect(form.getByRole('combobox', { name: /^Nguồn chi/ })).toContainText('Quỹ tiền mặt cơ sở');
  await form.getByLabel('Người nhận').fill(PAYEE);
  await form.getByLabel('Số tiền chi').fill('200000');
  await form.getByLabel('Nội dung chi').fill('Mua rau cho bữa trưa');
  await form.getByLabel('Chứng từ kèm theo (ảnh hoặc PDF)').setInputFiles({
    name: 'hoa-don.pdf',
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  await form.getByRole('button', { name: 'Lưu và trình duyệt' }).click();
  await expect(accountant.getByRole('row', { name: `Phiếu chi ${PAYEE}` })).toContainText('Chờ duyệt');

  const { page: principal } = await signIn('VT-02', null);
  await principal.getByRole('link', { name: 'Phiếu chi' }).click();
  await principal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const request = principal.getByRole('group', { name: `Phiếu chi cho ${PAYEE}` });
  await expect(request).toContainText('Mua rau cho bữa trưa');
  await request.getByRole('button', { name: 'Duyệt' }).click();
  await expect(principal.getByText('Không có phiếu chi chờ duyệt.')).toBeVisible();
  await expect(principal.getByRole('row', { name: `Phiếu chi ${PAYEE}` })).toContainText('Đã phát hành');

  await accountant.getByRole('link', { name: 'Sổ quỹ' }).click();
  await accountant.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const book = accountant.getByRole('region', { name: 'Sổ quỹ theo ngày' });
  await expect(book.getByRole('row').filter({ hasText: PAYEE })).toContainText('PC-');
  await expect(book).toContainText('Số dư cuối kỳ 800.000');
});

test('Kế toán lập phiếu đảo phiếu chi; Hiệu trưởng duyệt thì phiếu chi đã đảo và quỹ được hoàn lại', async ({
  browser,
}) => {
  const child = await schoolYear
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .select(['children.org_unit_id', 'org_units.name as unit_name'])
    .where('children.full_name', '=', CHILD_NAME)
    .executeTakeFirstOrThrow();
  const signIn = async (roleCode: string, orgUnitId: string | null) => {
    const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId }] });
    const page = await (await browser.newContext()).newPage();
    await page.goto('/');
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    return page;
  };

  const accountant = await signIn('VT-04', child.org_unit_id);
  await accountant.getByRole('link', { name: 'Phiếu chi' }).click();
  await accountant.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const row = accountant.getByRole('row', { name: `Phiếu chi ${PAYEE}` });
  await row.getByRole('button', { name: 'Lập phiếu đảo' }).click();
  await row.getByLabel(/^Lý do đảo/).fill('Cửa hàng trả lại tiền');
  await row.getByRole('button', { name: 'Gửi duyệt phiếu đảo' }).click();
  await expect(row).toContainText('Chờ duyệt đảo');

  const principal = await signIn('VT-02', null);
  await principal.getByRole('link', { name: 'Phiếu chi' }).click();
  await principal.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const request = principal.getByRole('region', { name: 'Phiếu đảo phiếu chi chờ duyệt' }).getByRole('group');
  await expect(request).toContainText('Cửa hàng trả lại tiền');
  await request.getByRole('button', { name: 'Duyệt' }).click();
  await expect(principal.getByText('Không có phiếu đảo phiếu chi chờ duyệt.')).toBeVisible();
  await expect(principal.getByRole('row', { name: `Phiếu chi ${PAYEE}` })).toContainText('Đã đảo');

  await accountant.getByRole('link', { name: 'Sổ quỹ' }).click();
  await accountant.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: child.unit_name });
  const book = accountant.getByRole('region', { name: 'Sổ quỹ theo ngày' });
  await expect(book.getByRole('row').filter({ hasText: 'DPC-' })).toContainText('200.000');
  await expect(book).toContainText('Số dư cuối kỳ 1.000.000');
});
