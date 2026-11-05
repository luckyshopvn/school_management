import { expect, test, type Browser } from './fixtures.js';
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

// Kho minh chứng, lát L4 (YCTD-396), kịch bản CT-396-18: Hiệu trưởng phân công giáo viên phụ trách tiêu chí 1.1 của bộ kiểm
// định Mầm non có hạn, xem độ phủ theo tiêu chí; giáo viên thấy tiêu chí mình phụ trách ở Tổng quan. Dữ liệu giả
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

async function signIn(browser: Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-396-18: phân công phụ trách tiêu chí có hạn, xem độ phủ; giáo viên thấy tiêu chí mình phụ trách ở Tổng quan', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  const teacherName = `Giáo viên phụ trách ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: root.id,
      code: `PC-${suffix}`,
      full_name: teacherName,
      start_date: today,
      user_id: teacher.id,
    })
    .execute();

  const head = await signIn(browser, principal);
  // Bộ mẫu Mầm non: nạp nếu chưa có
  await openMenu(head, '/quality/frameworks');
  await head.getByLabel('Cấp học').selectOption('MN');
  await head.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(head.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  await openMenu(head, '/quality/evidence-assignments');
  await head.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: MN });
  const row = head.getByRole('row').filter({ has: head.getByRole('cell', { name: '1.1', exact: true }) });
  await row.getByRole('button', { name: 'Phân công' }).click();
  const form = head.getByRole('form', { name: 'Phân công phụ trách' });
  await form.getByLabel('Người phụ trách').selectOption({ label: `${teacherName} (PC-${suffix})` });
  await form.getByLabel('Hạn hoàn thành').fill('2099-12-31');
  await form.getByRole('button', { name: 'Ghi phân công' }).click();
  await expect(head.getByText('Đã phân công 1 tiêu chí')).toBeVisible();
  await expect(row.getByRole('cell', { name: teacherName })).toBeVisible();

  await openMenu(head, '/quality/evidence-coverage');
  await head.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: MN });
  await expect(head.getByText(/Đủ minh chứng: \d+\/22 tiêu chí/)).toBeVisible();
  const coverageRow = head.getByRole('row').filter({ has: head.getByRole('cell', { name: '1.1', exact: true }) });
  await expect(coverageRow.getByRole('cell', { name: teacherName })).toBeVisible();

  const page = await signIn(browser, teacher);
  await openMenu(page, '/quality/evidence-overview');
  const mine = page.getByRole('region', { name: 'Tiêu chí tôi phụ trách' });
  await expect(mine.getByRole('link', { name: /^1\.1 / })).toBeVisible();
});
