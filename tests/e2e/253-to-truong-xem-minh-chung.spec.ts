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

// Kho minh chứng, lát L10 (YCTD-396), kịch bản CT-396-32: giáo viên thêm minh chứng của mình vào bộ chuẩn giáo viên mầm non;
// người đánh giá chuẩn của đơn vị (tổ trưởng) chọn giáo viên đó ở ô Người được đánh giá và thấy minh chứng. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const TEACHER_SET = 'GV-MN-TT26-2018 · Chuẩn nghề nghiệp giáo viên mầm non (Thông tư 26/2018)';

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

test('CT-396-32: tổ trưởng xem minh chứng cá nhân của giáo viên trong đơn vị', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const leader = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: root.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  const teacherName = `Giáo viên trong tổ ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: root.id,
      code: `TO-${suffix}`,
      full_name: teacherName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();
  const head = await signIn(browser, principal);
  await openMenu(head, '/quality/frameworks');
  await head.getByLabel('Cấp học').selectOption('MN');
  await head.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(head.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();

  const title = `Bản tự đánh giá đạo đức nhà giáo ${suffix}`;
  const page = await signIn(browser, teacher);
  await openMenu(page, '/quality/evidences');
  await page.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: TEACHER_SET });
  await page.getByRole('button', { name: 'Thêm minh chứng' }).click();
  const form = page.getByRole('form', { name: 'Thêm minh chứng' });
  await form.getByLabel('Tiêu chí', { exact: true }).selectOption({ index: 1 });
  await form.getByLabel('Tên minh chứng').fill(title);
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã ghi minh chứng \[H1-1-\d+\]/)).toBeVisible();

  const lead = await signIn(browser, leader);
  await openMenu(lead, '/quality/evidences');
  await lead.getByRole('combobox', { name: 'Bộ tiêu chí' }).selectOption({ label: TEACHER_SET });
  await lead
    .getByRole('combobox', { name: 'Người được đánh giá' })
    .selectOption({ label: `${teacherName} (TO-${suffix})` });
  await expect(lead.getByRole('cell', { name: title })).toBeVisible();
});
