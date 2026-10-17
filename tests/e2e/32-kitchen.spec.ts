import { randomUUID } from 'node:crypto';
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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Thực đơn bữa ăn (DT-10 phần 10c, YCTD-76): bếp lập thực đơn tuần và trình duyệt trên cổng quản trị; phụ huynh chưa thấy
// thực đơn chưa duyệt (CT-065); quản lý đơn vị duyệt và công bố thì phụ huynh thấy trên ứng dụng phụ huynh
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const mondayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
};

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signInPortal(page: import('@playwright/test').Page, user: { username: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(page, '/kitchen');
}

test('Bếp lập thực đơn, quản lý đơn vị duyệt và công bố, phụ huynh thấy thực đơn', async ({ browser }) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  // Tuần trong tương lai riêng cho lần chạy này để không trùng thực đơn đã có
  const week = addDays(mondayOf(vietnamToday()), 7 * (10 + (suffix % 300)));
  const kitchen = await createTestUser(identity, { roles: [{ roleCode: 'VT-10', orgUnitId: reference.org_unit_id }] });
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const dishName = `Cơm gà ${suffix}`;
  await schoolYear.insertInto('dishes').values({ org_unit_id: reference.org_unit_id, name: dishName }).execute();
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `BEP-${suffix}`,
      name: `Lớp bếp ${suffix}`,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Bé Thực Đơn ${suffix}`;
  const parentPhone = `07${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2022-03-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '3333',
      photo_consent: 'pending',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
    .execute();
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh thực đơn', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();

  const kitchenPage = await (await browser.newContext()).newPage();
  await signInPortal(kitchenPage, kitchen);
  const createForm = kitchenPage.getByRole('form', { name: 'Lập thực đơn' });
  await createForm.getByLabel('Tuần bắt đầu (thứ hai)').fill(week);
  await createForm.getByRole('button', { name: 'Lập thực đơn' }).click();
  await expect(kitchenPage.getByText('Đã lập thực đơn nháp')).toBeVisible();
  const addForm = kitchenPage.getByRole('form', { name: 'Thêm món' });
  await addForm.getByRole('combobox', { name: 'Thứ', exact: true }).selectOption({ label: 'Thứ hai' });
  await addForm.getByRole('combobox', { name: 'Bữa', exact: true }).selectOption({ label: 'Bữa trưa' });
  await addForm.getByRole('combobox', { name: 'Món', exact: true }).selectOption({ label: dishName });
  await addForm.getByRole('button', { name: 'Thêm món' }).click();
  const detail = kitchenPage.getByRole('region', { name: 'Chi tiết thực đơn' });
  await expect(kitchenPage.getByText('Đã lưu món của thực đơn')).toBeVisible();
  await expect(detail.getByRole('button', { name: new RegExp(`^Bỏ ${dishName}`) })).toBeVisible();
  await detail.getByRole('button', { name: 'Trình duyệt' }).click();
  await expect(detail).toContainText('Chờ duyệt');

  const parentPage = await (await browser.newContext()).newPage();
  await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
  await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
  await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
  const childCard = parentPage.getByRole('listitem', { name: childName });
  await childCard.getByRole('button', { name: 'Thực đơn' }).click();
  let menuPanel = childCard.getByRole('region', { name: `Thực đơn của ${childName}` });
  await menuPanel.getByLabel('Tuần có ngày').fill(week);
  await expect(menuPanel).toContainText(`Tuần từ ${week}`);
  await expect(menuPanel).toContainText('Chưa có thực đơn đã công bố.');

  const managerPage = await (await browser.newContext()).newPage();
  await signInPortal(managerPage, manager);
  // Danh sách thực đơn tuần là lưới dữ liệu chung có phân trang (DT-16 phần 16b): tìm theo tuần trước khi mở
  const menuGrid = managerPage.getByRole('region', { name: 'Danh sách thực đơn tuần' });
  await menuGrid.getByLabel('Tìm theo tuần, độ tuổi').fill(week);
  await menuGrid.getByRole('button', { name: `Xem thực đơn tuần ${week} all` }).click();
  const managerDetail = managerPage.getByRole('region', { name: 'Chi tiết thực đơn' });
  await expect(managerDetail).toContainText(dishName);
  await managerDetail.getByRole('button', { name: 'Duyệt và công bố' }).click();
  await expect(managerDetail).toContainText('Đã công bố');

  await childCard.getByRole('button', { name: 'Thực đơn' }).click();
  await childCard.getByRole('button', { name: 'Thực đơn' }).click();
  menuPanel = childCard.getByRole('region', { name: `Thực đơn của ${childName}` });
  await menuPanel.getByLabel('Tuần có ngày').fill(week);
  await expect(menuPanel).toContainText(`Trưa: ${dishName}`);
});
