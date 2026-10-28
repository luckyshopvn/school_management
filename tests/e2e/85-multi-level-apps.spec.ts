import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Cổng phụ huynh, ứng dụng giáo viên và tin tức theo cấp học (DT-19 phần 19e, YCTD-155), kịch bản CT-19e-5: trường bật thêm
// Tiểu học; phụ huynh có một con Mầm non, một con Tiểu học thấy cả hai con kèm tên cấp, con Tiểu học không có chức năng chỉ
// của Mầm non; giáo viên dạy hai lớp ở hai cấp thấy tên cấp, lớp Tiểu học không có nhật ký, báo cơm; soạn tin tức có ô cấp
// nhận và số người nhận. Cuối kịch bản tắt lại Tiểu học. Dữ liệu giả
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

test('CT-19e-5: phụ huynh có con ở hai cấp, giáo viên dạy hai cấp thấy chức năng theo cấp; tin tức có cấp nhận', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `06${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();

  await schoolYear
    .insertInto('grade_levels')
    .values({ code: 'K1', name: 'Khối 1', age_from_months: null, age_to_months: null, school_level: 'TH' })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const preschoolClass = `Lớp chồi ${suffix}`;
  const primaryClass = `Lớp 1B ${suffix}`;
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh hai cấp', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childNames: Record<string, string> = {};
  for (const [level, className, grade, childName] of [
    ['MN', preschoolClass, 'MAM', `Bé Mầm Non ${suffix}`],
    ['TH', primaryClass, 'K1', `Học Sinh Tiểu Học ${suffix}`],
  ] as const) {
    childNames[level] = childName;
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `${level}-${suffix}`,
        name: className,
        grade_level: grade,
        school_level: level,
        max_size: 30,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classRow.id,
        staff_user_id: teacher.id,
        staff_name: 'Giáo viên hai cấp',
        assignment_role: 'homeroom',
        from_date: '2026-01-01',
      })
      .execute();
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: childName,
        dob: level === 'MN' ? '2022-06-01' : '2019-06-01',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '8585',
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
  }

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(portal, true);
  try {
    // Ứng dụng phụ huynh: hai con, mỗi con có tên cấp; con Tiểu học không có chức năng chỉ của Mầm non
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const preschoolCard = parentPage.getByRole('listitem', { name: childNames.MN });
    const primaryCard = parentPage.getByRole('listitem', { name: childNames.TH });
    await expect(preschoolCard).toContainText(`Mầm non · ${preschoolClass}`);
    await expect(primaryCard).toContainText(`Tiểu học · ${primaryClass}`);
    // Báo vắng, điểm danh tháng theo ngày hiện ở mọi cấp (DT-20 phần 20d; cấp khác Mầm non điểm danh đầu ngày từ YCTD-350)
    for (const label of ['Báo vắng', 'Điểm danh tháng này']) {
      await expect(preschoolCard.getByRole('button', { name: label, exact: true })).toBeVisible();
      await expect(primaryCard.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    for (const label of ['Nhật ký', 'Hồ sơ cuối cấp']) {
      await expect(preschoolCard.getByRole('button', { name: label, exact: true })).toBeVisible();
      await expect(primaryCard.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
    await expect(primaryCard.getByRole('button', { name: 'Học phí', exact: true })).toBeVisible();
    await primaryCard.getByRole('button', { name: 'Sức khỏe', exact: true }).click();
    const health = primaryCard.getByRole('region', { name: `Sức khỏe của ${childNames.TH}` });
    await expect(health.getByRole('heading', { name: 'Sự kiện y tế' })).toBeVisible();
    await expect(health.getByRole('heading', { name: 'Chăm sóc hằng ngày' })).toHaveCount(0);

    // Ứng dụng giáo viên: hai lớp ở hai cấp; lớp Tiểu học không có nhật ký, chăm sóc, báo cơm
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(teacherPage.getByRole('button', { name: `Đón trả lớp ${primaryClass}` })).toBeVisible();
    await expect(teacherPage.getByText('Tiểu học', { exact: true })).toBeVisible();
    await expect(teacherPage.getByText('1 học sinh', { exact: true })).toBeVisible();
    for (const action of ['Nhật ký', 'Chăm sóc', 'Báo cơm']) {
      await expect(teacherPage.getByRole('button', { name: `${action} lớp ${preschoolClass}` })).toBeVisible();
      await expect(teacherPage.getByRole('button', { name: `${action} lớp ${primaryClass}` })).toHaveCount(0);
    }

    // Soạn tin tức: ô cấp nhận và số tài khoản phụ huynh nhận tin trước khi công bố
    // Người soạn tin là quản lý đơn vị (P14.content.manage)
    const manager = await createTestUser(identity, {
      roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }],
    });
    const managerPage = await (await browser.newContext()).newPage();
    await managerPage.goto('/');
    await managerPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
    await managerPage.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
    await managerPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(managerPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
    await openMenu(managerPage, '/activities');
    await managerPage.getByRole('tab', { name: 'Tin tức' }).click();
    await managerPage.getByRole('button', { name: 'Thêm mới' }).click();
    const form = managerPage.getByRole('form', { name: 'Thêm tin tức' });
    await expect(form.getByLabel('Tiểu học', { exact: true })).toBeVisible();
    const count = form.getByTestId('news-recipient-count');
    await expect(count).toContainText('Khi công bố, tin gửi tới');
    await form.getByLabel('Tiểu học', { exact: true }).check();
    await expect(count).toContainText(/tin gửi tới [1-9]\d* tài khoản phụ huynh/);
  } finally {
    await setPrimaryEnabled(portal, false);
  }
});
