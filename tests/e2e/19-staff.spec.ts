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

// Phòng nhân sự tạo hồ sơ, liên kết tài khoản giáo viên, lập rồi chấm dứt hợp đồng; tài khoản bị khóa (DT-06 phần 6a,
// YCTD-58)
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

test('Phòng nhân sự tạo hồ sơ, liên kết tài khoản, lập và chấm dứt hợp đồng thì tài khoản bị khóa', async ({
  browser,
}) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const personnel = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: unit.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  const code = `GV-${Date.now() % 1_000_000}`;

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(personnel.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(personnel.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Hồ sơ nhân sự' }).click();
  await page.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: unit.name });
  const form = page.getByRole('form', { name: 'Thêm hồ sơ nhân sự' });
  await form.getByLabel('Mã nhân sự').fill(code);
  await form.getByLabel('Họ tên').fill('Đỗ Thị Hạnh');
  await form.getByLabel('Số định danh cá nhân').fill('079190005678');
  await form.getByLabel('Ngày vào làm').fill('2026-08-01');
  await form.getByRole('button', { name: 'Thêm hồ sơ' }).click();
  const row = page.getByRole('row', { name: 'Nhân sự Đỗ Thị Hạnh' });
  await expect(row).toContainText(code);
  await row.getByRole('button', { name: 'Chi tiết' }).click();

  const panel = page.getByRole('group', { name: 'Hồ sơ của Đỗ Thị Hạnh' });
  await expect(panel).toContainText('********5678');
  await panel.getByLabel('Tên đăng nhập hoặc số điện thoại').fill(teacher.username);
  await panel.getByRole('button', { name: 'Liên kết tài khoản' }).click();
  await expect(panel).toContainText('Tài khoản: đã liên kết');

  const contract = panel.getByRole('form', { name: 'Lập hợp đồng' });
  await contract.getByLabel('Số hợp đồng').fill(`HDLD-${code}`);
  await contract.getByLabel('Lương thỏa thuận').fill('12000000');
  await contract.getByLabel('Ngày bắt đầu').fill('2026-08-01');
  await contract.getByLabel('Ngày kết thúc').fill('2027-07-31');
  await contract.getByLabel('Tên phụ cấp').fill('Phụ cấp trách nhiệm');
  await contract.getByLabel('Số tiền phụ cấp').fill('500000');
  await contract.getByRole('button', { name: 'Lập hợp đồng' }).click();
  await expect(panel).toContainText('12.000.000');
  await expect(panel).toContainText('Còn hiệu lực');

  await panel.getByLabel('Lý do chấm dứt').fill('Xin nghỉ việc');
  await panel.getByRole('button', { name: 'Chấm dứt hợp đồng' }).click();
  await expect(panel).toContainText('Đã chấm dứt');
  await expect(row).toContainText('Đã nghỉ');
  const account = await identity
    .selectFrom('users')
    .select('status')
    .where('id', '=', teacher.id)
    .executeTakeFirstOrThrow();
  expect(account.status).toBe('locked');
});
