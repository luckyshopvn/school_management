import { expect, test } from './fixtures.js';
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

// Kho minh chứng, lát L7 (YCTD-396), kịch bản CT-396-24: Hiệu trưởng thêm minh chứng có nguồn là biên bản kiểm kê thiết bị
// đã chốt (bản chụp PDF lúc gắn). Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const MN = 'MN-KDCL-2024 · Kiểm định chất lượng giáo dục trường mầm non (Thông tư 19/2018, sửa đổi 2024)';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('CT-396-24: thêm minh chứng có nguồn là biên bản kiểm kê thiết bị đã chốt', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('equipment_stocktakes')
    .values({
      code: `KK-${suffix}`,
      name: `Kiểm kê thiết bị e2e ${suffix}`,
      org_unit_id: root.id,
      started_on: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
      // Đã chốt để không chặn đợt kiểm kê mới của đơn vị ở spec 73
      status: 'closed',
      created_by: principal.id,
    })
    .execute();
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await openMenu(page, '/quality/frameworks');
  await page.getByLabel('Cấp học').selectOption('MN');
  await page.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(page.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  await openMenu(page, '/quality/evidences');
  await page.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: MN });
  await page.getByRole('button', { name: 'Thêm minh chứng' }).click();
  const form = page.getByRole('form', { name: 'Thêm minh chứng' });
  await form.getByLabel('Dữ liệu trong phần mềm (chụp bản lúc gắn)').check();
  await form.getByLabel('Loại dữ liệu').selectOption({ label: 'Biên bản kiểm kê thiết bị' });
  await form.getByLabel('Tìm dữ liệu nguồn').fill(`KK-${suffix}`);
  await form
    .getByLabel('Chọn dữ liệu nguồn')
    .selectOption({ label: `Biên bản kiểm kê thiết bị KK-${suffix} Kiểm kê thiết bị e2e ${suffix}` });
  await form.getByLabel('Tên minh chứng').fill(`Biên bản kiểm kê e2e ${suffix}`);
  await form.getByLabel('Tiêu chí', { exact: true }).selectOption({ index: 8 });
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã ghi minh chứng \[H\d+-[\d.]+-\d+\]/)).toBeVisible();
  const detail = page.getByLabel(/Chi tiết minh chứng/);
  await expect(detail.getByText('Bản 1', { exact: true })).toBeVisible();
});
