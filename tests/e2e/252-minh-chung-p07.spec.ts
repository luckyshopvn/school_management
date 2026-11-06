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

// Kho minh chứng, lát L6b (YCTD-396), kịch bản CT-396-28: Hiệu trưởng nạp bộ mẫu Mầm non (có bộ giáo viên mầm non chép từ
// danh mục P07-05), mở phiếu đánh giá chuẩn cho giáo viên; giáo viên thấy từng tiêu chí "Chưa có minh chứng ở kho" và liên
// kết thêm minh chứng ở kho; chọn Khá mà chưa có minh chứng thì không gửi được (CT-396-30, lát L9). Dữ liệu giả
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

test('CT-396-28: phiếu tự đánh giá chuẩn nghề nghiệp hiện minh chứng ở kho theo tiêu chí', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  const teacherName = `Giáo viên minh chứng P07 ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: root.id,
      code: `P07-${suffix}`,
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
  await openMenu(head, '/professional-standards');
  const open = head.getByRole('region', { name: 'Mở phiếu đánh giá' });
  await open.getByLabel(teacherName).check();
  await open.getByRole('button', { name: 'Mở phiếu' }).click();
  await expect(head.getByText('Đã mở 1 phiếu')).toBeVisible();

  const page = await signIn(browser, teacher);
  await openMenu(page, '/professional-standards');
  const own = page.getByRole('region', { name: 'Phiếu tự đánh giá của tôi' });
  await expect(own.getByText('Chưa có minh chứng ở kho').first()).toBeVisible();
  await expect(
    own.getByRole('link', { name: 'Thêm minh chứng ở kho (Chuẩn nghề nghiệp giáo viên mầm non (Thông tư 26/2018))' }),
  ).toBeVisible();
  // Lát L9 (CT-396-30): chọn mức Khá cho mọi tiêu chí khi chưa có minh chứng thì không gửi được
  await own.getByLabel('Mức cho mọi tiêu chí').selectOption({ label: 'Khá' });
  await own.getByRole('button', { name: 'Gửi tự đánh giá' }).click();
  await expect(page.getByText(/đã chọn mức từ Đạt trở lên nhưng chưa có minh chứng ở kho/)).toBeVisible();
});
