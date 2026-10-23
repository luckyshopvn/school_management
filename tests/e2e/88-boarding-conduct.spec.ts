import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  MEAL_SERVICE_ID,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { menuLink, openMenu } from './menu.js';

// Bán trú Tiểu học; nề nếp, thi đua lớp (DT-20 phần 20b, YCTD-159), kịch bản CT-20b-7: trường bật thêm Tiểu học và bật nề
// nếp ở 1.4 Cấu hình trường; quản lý xem danh sách ăn của lớp 1, báo cắt suất, chốt số suất; nạp tiêu chí mặc định, ghi điểm,
// xem xếp hạng; giáo viên thấy nút Bán trú ở lớp Tiểu học, phụ huynh thấy Cắt suất bán trú ở con Tiểu học. Cuối kịch bản tắt
// lại nề nếp và Tiểu học. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
// Ngày học gần nhất không sau hôm nay
function latestWeekday(): string {
  let date = vietnamToday();
  while ([0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())) {
    date = addDays(date, -1);
  }
  return date;
}

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function setPrimaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const primary = card.getByLabel('Bật cấp TH', { exact: true });
  if (enabled) {
    await primary.check();
  } else {
    await primary.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã ghi cấp học của trường' })).toBeVisible();
}

async function setConductEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Nề nếp, thi đua lớp' });
  const toggle = card.getByLabel('Bật nề nếp, thi đua lớp');
  if (enabled) {
    await toggle.check();
  } else {
    await toggle.uncheck();
  }
  await card.getByRole('button', { name: 'Lưu nề nếp' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình nề nếp, thi đua lớp' })).toBeVisible();
}

test('CT-20b-7: bán trú lớp Tiểu học (cắt suất, chốt số suất); nề nếp, xếp hạng lớp; ứng dụng theo cấp', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const mealDate = latestWeekday();
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `07${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();

  await schoolYear
    .insertInto('grade_levels')
    .values({ code: 'K1', name: 'Khối 1', age_from_months: null, age_to_months: null, school_level: 'TH' })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const className = `Lớp 1C ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `BT-${suffix}`,
      name: className,
      grade_level: 'K1',
      school_level: 'TH',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: 'Giáo viên lớp 1',
      assignment_role: 'homeroom',
      from_date: '2026-01-01',
    })
    .execute();
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh bán trú', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const names = [`Học Sinh Ăn ${suffix}`, `Học Sinh Cắt ${suffix}`];
  for (const name of names) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: '2019-06-01',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '8888',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
      .execute();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
      .execute();
    await schoolYear
      .insertInto('service_registrations')
      .values({
        child_id: child.id,
        org_unit_id: reference.org_unit_id,
        period_year: Number(mealDate.slice(0, 4)),
        period_month: Number(mealDate.slice(5, 7)),
        service_id: MEAL_SERVICE_ID,
        status: 'active',
        source: 'system',
      })
      .execute();
  }

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(portal, true);
  try {
    await setConductEnabled(portal, true);

    // Bán trú: danh sách ăn của lớp, cắt suất một học sinh, chốt số suất
    await openMenu(portal, '/boarding');
    await portal.getByRole('combobox', { name: 'Lớp' }).selectOption({ label: className });
    await portal.getByLabel('Ngày', { exact: true }).fill(mealDate);
    const roster = portal.getByRole('region', { name: 'Danh sách ăn bán trú' });
    await expect(roster).toContainText('2 học sinh đăng ký');
    await portal.getByLabel('Lý do cắt suất').fill('Về quê');
    await roster.getByRole('button', { name: `Cắt suất của ${names[1]}` }).click();
    await expect(portal.getByRole('status').filter({ hasText: 'Đã báo cắt suất' })).toBeVisible();
    await expect(roster).toContainText('1 suất');
    await roster.getByRole('button', { name: 'Chốt số suất' }).click();
    await expect(portal.getByRole('status').filter({ hasText: 'Đã chốt số suất' })).toBeVisible();
    await expect(roster.getByText('Đã chốt', { exact: true })).toBeVisible();
    await expect(roster.getByRole('button', { name: `Cắt suất của ${names[0]}` })).toHaveCount(0);

    // Nề nếp: nạp tiêu chí mặc định, ghi điểm cho lớp, xem xếp hạng tuần
    await openMenu(portal, '/conduct');
    await portal.getByRole('tab', { name: 'Tiêu chí' }).click();
    await portal.getByRole('button', { name: 'Nạp bộ tiêu chí mặc định' }).click();
    await expect(portal.getByRole('table', { name: 'Tiêu chí nề nếp' })).toContainText('Đi học muộn');
    await portal.getByRole('tab', { name: 'Ghi điểm' }).click();
    await portal.getByRole('combobox', { name: 'Lớp' }).selectOption({ label: className });
    await portal.getByLabel('Ngày', { exact: true }).fill(mealDate);
    await portal.getByRole('combobox', { name: 'Tiêu chí' }).selectOption({ label: 'Việc tốt, việc làm hay (+3)' });
    await portal.getByLabel('Người báo (đội cờ đỏ)').fill('Đội cờ đỏ 5A');
    await portal.getByRole('button', { name: 'Ghi điểm', exact: true }).click();
    await expect(portal.getByRole('status').filter({ hasText: 'Đã ghi điểm nề nếp' })).toBeVisible();
    await expect(portal.getByRole('table', { name: 'Điểm nề nếp trong tuần' })).toContainText('Đội cờ đỏ 5A');
    await portal.getByRole('tab', { name: 'Xếp hạng' }).click();
    await portal.getByLabel('Ngày trong kỳ').fill(mealDate);
    const ranking = portal.getByRole('table', { name: 'Xếp hạng thi đua lớp' });
    await expect(ranking.getByRole('row', { name: new RegExp(className) })).toContainText('103');

    // Ứng dụng giáo viên: lớp Tiểu học có Bán trú, không có Báo cơm
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await teacherPage.getByRole('button', { name: `Bán trú lớp ${className}` }).click();
    await teacherPage.getByLabel('Ngày', { exact: true }).fill(mealDate);
    await expect(teacherPage.getByRole('region', { name: 'Danh sách ăn' })).toContainText('1 suất (đã chốt)');
    await expect(teacherPage.getByRole('button', { name: `Báo cơm lớp ${className}` })).toHaveCount(0);

    // Ứng dụng phụ huynh: con Tiểu học có Cắt suất bán trú
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: names[1] });
    await card.getByRole('button', { name: 'Cắt suất bán trú' }).click();
    await expect(card.getByRole('region', { name: `Bán trú của ${names[1]}` })).toBeVisible();
  } finally {
    await setConductEnabled(portal, false);
    await setPrimaryEnabled(portal, false);
    await expect(menuLink(portal, '/boarding')).toHaveCount(0);
  }
});
