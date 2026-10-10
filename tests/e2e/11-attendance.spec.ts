import { expect, test, type Browser } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';

// QT-02 điểm danh và báo vắng (DT-04 phần 4a, YCTD-47). Chạy sau 09-children.spec.ts: lớp Mầm 1 của Phân hiệu A
// có trẻ Nguyễn Gia Bảo kèm phụ huynh có tài khoản
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const SCHOOL_DAY = '2026-10-09';
let schoolYear: Kysely;
type Kysely = ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function classOf(name: string) {
  return schoolYear
    .selectFrom('classes')
    .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
    .select(['classes.id', 'classes.org_unit_id'])
    .where('classes.name', '=', name)
    .where('org_units.name', '=', 'Phân hiệu A')
    .executeTakeFirstOrThrow();
}

async function openTeacherApp(browser: Browser) {
  const mam1 = await classOf('Mầm 1');
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: mam1.org_unit_id }] });
  const name = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: mam1.id,
      staff_user_id: teacher.id,
      staff_name: name,
      assignment_role: 'homeroom',
      from_date: '2026-09-05',
    })
    .execute();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  return page;
}

test('Giáo viên chủ nhiệm điểm danh lớp Mầm 1 trên ứng dụng giáo viên rồi chốt ngày; quản lý đơn vị thấy ngày đã chốt', async ({
  browser,
}) => {
  const page = await openTeacherApp(browser);
  await page.getByRole('button', { name: /^Mầm 1/ }).click();
  await page.getByLabel('Ngày').fill(SCHOOL_DAY);
  const list = page.getByRole('list', { name: 'Danh sách điểm danh' });
  await expect(list).toContainText('Nguyễn Gia Bảo');
  await expect(page.getByRole('button', { name: 'Chốt điểm danh ngày' })).toBeDisabled();
  for (const select of await list.getByRole('combobox').all()) {
    await select.selectOption({ label: 'Có mặt' });
  }
  await page.getByRole('button', { name: 'Lưu điểm danh' }).click();
  await expect(page.getByText('Đã lưu điểm danh')).toBeVisible();
  await page.getByRole('button', { name: 'Chốt điểm danh ngày' }).click();
  await expect(page.getByText('Đã chốt điểm danh ngày')).toBeVisible();
  await expect(page.getByText('Đã chốt', { exact: true })).toBeVisible();

  const mam1 = await classOf('Mầm 1');
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: mam1.org_unit_id }] });
  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await portal.getByRole('link', { name: 'Điểm danh' }).click();
  await portal.getByRole('combobox', { name: /^Lớp/ }).selectOption({ label: 'Mầm 1' });
  await portal.getByLabel('Ngày').fill(SCHOOL_DAY);
  const sheet = portal.getByRole('region', { name: 'Bảng điểm danh' });
  await expect(sheet).toContainText('Đã chốt');
  await expect(sheet).toContainText('Nguyễn Gia Bảo');
  await expect(sheet.getByRole('button', { name: 'Mở lại ngày đã chốt' })).toBeVisible();
});

test('Phụ huynh báo vắng cho con trên ứng dụng phụ huynh và xem điểm danh tháng này', async ({ browser }) => {
  const guardian = await schoolYear
    .selectFrom('children')
    .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select(['guardians.user_id', 'guardians.phone'])
    .where('children.full_name', '=', 'Nguyễn Gia Bảo')
    .where('guardians.user_id', 'is not', null)
    .executeTakeFirstOrThrow();
  await identity
    .updateTable('users')
    .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
    .where('id', '=', guardian.user_id ?? '')
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await page.getByLabel('Số điện thoại').fill(guardian.phone ?? '');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const card = page.getByRole('listitem', { name: 'Nguyễn Gia Bảo' });
  await expect(card).toContainText('Mầm 1');
  await card.getByRole('button', { name: 'Báo vắng' }).click();
  const form = card.getByRole('form', { name: 'Báo vắng cho Nguyễn Gia Bảo' });
  await form.getByLabel('Từ ngày').fill('2026-10-12');
  await form.getByLabel('Đến ngày').fill('2026-10-13');
  await form.getByLabel('Lý do').fill('Về quê');
  await form.getByRole('button', { name: 'Gửi báo vắng' }).click();
  await expect(page.getByText(/Báo vắng đã ghi nhận|Đã báo vắng/)).toBeVisible();

  await card.getByRole('button', { name: 'Điểm danh tháng này' }).click();
  await expect(card.getByRole('list', { name: 'Điểm danh của Nguyễn Gia Bảo' })).toContainText(SCHOOL_DAY);
});
