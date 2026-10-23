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

// Đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c, YCTD-161), kịch bản CT-20c-7: trường bật Tiểu học, nạp môn mẫu và
// cấu hình đánh giá mặc định; giáo viên chủ nhiệm nhập mức đạt, điểm kiểm tra giữa học kỳ I môn Tiếng Việt ở ứng dụng giáo
// viên; Hiệu trưởng xem tổng hợp cuối kỳ, khoá số liệu; phụ huynh xem kết quả đã khoá. Cuối kịch bản tắt lại Tiểu học.
// Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

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
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-20c-7: cấu hình mặc định, giáo viên nhập ở ứng dụng, Hiệu trưởng tổng hợp và khoá, phụ huynh xem', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `05${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values(
      [1, 2, 3, 4, 5].map((grade) => ({
        code: `K${grade}`,
        name: `Khối ${grade}`,
        order_no: 100 + grade,
        age_from_months: null,
        age_to_months: null,
        school_level: 'TH' as const,
      })),
    )
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const className = `Lớp 4D ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `4D-${suffix}`,
      name: className,
      grade_level: 'K4',
      school_level: 'TH',
      max_size: 35,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: 'Giáo viên lớp 4D',
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
    .values({ full_name: 'Phụ huynh lớp 4D', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Đánh Giá ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2016-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '9090',
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

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(portal, true);
  try {
    await openMenu(portal, '/subjects');
    await portal.getByRole('button', { name: 'Nạp môn mẫu' }).click();
    await expect(toast(portal, /Đã nạp \d+ môn mẫu/)).toBeVisible();

    // 7.3 Đánh giá học sinh: nạp cấu hình mặc định của Thông tư
    await openMenu(portal, '/student-assessments');
    await portal.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await portal.getByRole('combobox', { name: 'Lớp' }).selectOption({ label: className });
    await portal.getByRole('tab', { name: 'Cấu hình' }).click();
    await portal.getByRole('button', { name: 'Nạp cấu hình mặc định (Thông tư 27/2020)' }).click();
    await expect(toast(portal, 'Đã nạp cấu hình đánh giá theo Thông tư 27/2020')).toBeVisible();
    const periods = portal.getByRole('table', { name: 'Kỳ đánh giá' });
    await expect(periods.getByRole('row', { name: /^Giữa học kỳ I / })).toContainText('Tiếng Việt');

    // Ứng dụng giáo viên: chủ nhiệm nhập Tiếng Việt giữa học kỳ I
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await teacherPage.getByRole('button', { name: `Đánh giá lớp ${className}` }).click();
    await teacherPage.getByLabel('Kỳ đánh giá').selectOption({ label: 'Giữa học kỳ I' });
    await teacherPage.getByLabel('Môn học').selectOption({ label: 'Tiếng Việt' });
    await teacherPage.getByLabel(`Mức đạt của ${childName}`).selectOption({ label: 'Hoàn thành tốt' });
    await teacherPage.getByLabel(`Điểm của ${childName}`).fill('9');
    await teacherPage.getByLabel(`Nhận xét của ${childName}`).fill('Đọc to, rõ ràng');
    await teacherPage.getByRole('button', { name: 'Lưu đánh giá' }).click();
    await expect(teacherPage.getByText('Đã lưu đánh giá')).toBeVisible();

    // Cổng quản trị: tổng hợp cuối kỳ, khoá số liệu
    await portal.reload();
    await portal.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await portal.getByRole('combobox', { name: 'Lớp' }).selectOption({ label: className });
    await portal.getByRole('combobox', { name: 'Kỳ đánh giá' }).selectOption({ label: 'Giữa học kỳ I' });
    await portal.getByRole('tab', { name: 'Tổng hợp cuối kỳ' }).click();
    const summary = portal.getByRole('table', { name: 'Tổng hợp môn học' });
    await expect(summary.getByRole('row', { name: /Tiếng Việt/ })).toContainText('1 / 0 / 0 / 0');
    await portal.getByRole('tab', { name: 'Khoá số liệu' }).click();
    await portal.getByRole('button', { name: 'Khoá số liệu mọi lớp' }).click();
    await expect(toast(portal, /Đã khoá số liệu \d+ lớp/)).toBeVisible();
    await expect(
      portal.getByRole('table', { name: 'Khoá số liệu theo lớp' }).getByRole('row', { name: new RegExp(className) }),
    ).toContainText('Đã khoá');

    // Ứng dụng phụ huynh: kết quả đã khoá
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Kết quả đánh giá' }).click();
    const result = card.getByRole('region', { name: `Kết quả đánh giá của ${childName}` });
    await expect(result).toContainText('Giữa học kỳ I');
    await expect(result).toContainText('Tiếng Việt: Hoàn thành tốt · điểm 9 · Đọc to, rõ ràng');
  } finally {
    await setPrimaryEnabled(portal, false);
  }
});
