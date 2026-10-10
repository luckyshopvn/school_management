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

// Người được ủy quyền đón trẻ và đón trả (DT-04 phần 4b, YCTD-48). Chạy sau 09-children.spec.ts: trẻ Nguyễn Gia Bảo học
// lớp Mầm 1 của Phân hiệu A, phụ huynh có tài khoản. Bàn giao của giáo viên phụ thuộc hôm nay là ngày học nên kiểm thử ở
// apps/api/src/pickups/pickups.test.ts
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

async function child() {
  return schoolYear
    .selectFrom('children')
    .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select(['children.id', 'children.org_unit_id', 'guardians.user_id', 'guardians.phone'])
    .where('children.full_name', '=', CHILD_NAME)
    .where('guardians.user_id', 'is not', null)
    .executeTakeFirstOrThrow();
}

async function openParentApp(browser: Browser) {
  const guardian = await child();
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
  return page;
}

test('Phụ huynh khai báo người đón trên ứng dụng phụ huynh; quản lý đơn vị thấy trong hồ sơ trẻ; bảo vệ xác nhận tại cổng', async ({
  browser,
}) => {
  const parent = await openParentApp(browser);
  const card = parent.getByRole('listitem', { name: CHILD_NAME });
  await card.getByRole('button', { name: 'Người đón' }).click();
  const panel = card.getByRole('region', { name: `Người đón ${CHILD_NAME}` });
  await panel.getByLabel('Họ tên người đón').fill('Trần Thị Lan');
  await panel.getByLabel('Quan hệ với trẻ').fill('Bà ngoại');
  await panel.getByLabel('Số điện thoại').fill('0912000111');
  await panel.getByRole('button', { name: 'Thêm người đón' }).click();
  await expect(panel.getByText('Đã thêm người đón')).toBeVisible();
  await expect(panel).toContainText('Trần Thị Lan (Bà ngoại)');

  const { org_unit_id: orgUnitId } = await child();
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId }] });
  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await portal.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await portal.getByRole('row').filter({ hasText: CHILD_NAME }).click();
  const section = portal.getByRole('region', { name: `Người được ủy quyền đón ${CHILD_NAME}` });
  await expect(section).toContainText('Trần Thị Lan');
  await expect(section).toContainText('Phụ huynh');

  const guard = await createTestUser(identity, { roles: [{ roleCode: 'VT-18', orgUnitId }] });
  const gate = await (await browser.newContext()).newPage();
  await gate.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await gate.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(guard.username);
  await gate.getByLabel('Mật khẩu', { exact: true }).fill(guard.password);
  await gate.getByRole('button', { name: 'Đăng nhập' }).click();
  await gate.getByRole('button', { name: 'Xác nhận người đón tại cổng' }).click();
  await gate.getByLabel('Tên trẻ').fill('Gia Bảo');
  await gate.getByRole('button', { name: 'Tìm trẻ' }).click();
  const result = gate.getByRole('listitem', { name: CHILD_NAME });
  await result.getByRole('button', { name: 'Xác nhận Trần Thị Lan' }).click();
  await expect(gate.getByText(`Đã xác nhận Trần Thị Lan đón ${CHILD_NAME}`)).toBeVisible();
  await expect(result).toContainText('Đã xác nhận Trần Thị Lan lúc');
});

test('Phụ huynh xác nhận người đón ngoài danh sách trên ứng dụng phụ huynh', async ({ browser }) => {
  const { id: childId } = await child();
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await schoolYear
    .insertInto('pickup_confirmation_requests')
    .values({
      child_id: childId,
      pickup_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
      person_name: 'Phạm Văn Tư',
      relationship: 'Chú',
      phone: '0912000222',
      requested_by: teacher.id,
    })
    .execute();
  const parent = await openParentApp(browser);
  const requests = parent.getByRole('region', { name: 'Yêu cầu xác nhận người đón' });
  await expect(requests).toContainText('Phạm Văn Tư (Chú, 0912000222) đến đón');
  await requests.getByRole('button', { name: 'Xác nhận người đón' }).click();
  await expect(requests.getByText(`Đã xác nhận Phạm Văn Tư đón ${CHILD_NAME}`)).toBeVisible();
  const stored = await schoolYear
    .selectFrom('pickup_confirmation_requests')
    .select('status')
    .where('person_name', '=', 'Phạm Văn Tư')
    .executeTakeFirstOrThrow();
  expect(stored.status).toBe('confirmed');
});
