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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Gia sư trong trường (DT-27 phần 27b, YCTD-252), kịch bản CT-27b-8: giáo viên lập chương trình phụ đạo môn Toán (dạy thêm môn học,
// không thu tiền), nộp; Hiệu trưởng duyệt; giáo viên xếp buổi lặp theo tuần; cha mẹ đọc đơn và gửi đăng ký trên ứng dụng phụ huynh;
// giáo viên duyệt đơn, điểm danh vắng; cha mẹ thấy điểm danh. Cuối kịch bản tắt lại THCS. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
const weekdayLabel = (weekday: number) => (weekday === 7 ? 'CN' : `T${weekday + 1}`);

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function setSecondaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const secondary = card.getByLabel('Bật cấp THCS', { exact: true });
  if (enabled) {
    await secondary.check();
  } else {
    await secondary.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

async function signIn(page: Page, user: { username: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('CT-27b-8: lập, duyệt chương trình gia sư, xếp buổi, cha mẹ đăng ký, duyệt đơn, điểm danh vắng báo cha mẹ', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `06${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K6',
      name: 'Khối 6',
      order_no: 106,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THCS',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, principal);
  await setSecondaryEnabled(page, true);
  const programName = `Phụ đạo Toán 6 ${suffix}`;
  const childName = `Học Sinh Gia Sư ${suffix}`;
  let childId = '';
  let guardianId = '';
  try {
    if (!(await schoolYear.selectFrom('subjects').select('id').where('code', '=', 'THCS-TOAN').executeTakeFirst())) {
      await openMenu(page, '/subjects');
      await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
      await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();
    }
    const subject = await schoolYear
      .selectFrom('subjects')
      .select('id')
      .where('code', '=', 'THCS-TOAN')
      .executeTakeFirstOrThrow();
    const className = `Lớp 6G ${suffix}`;
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `6G-${suffix}`,
        name: className,
        grade_level: 'K6',
        school_level: 'THCS',
        max_size: 45,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classRow.id,
        staff_user_id: teacher.id,
        staff_name: 'Cô Gia Sư',
        assignment_role: 'subject',
        subject_name: 'Toán',
        subject_id: subject.id,
        from_date: addDays(today, -30),
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: `GS-${suffix}`, name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    guardianId = (
      await schoolYear
        .insertInto('guardians')
        .values({ full_name: 'Phụ huynh gia sư', phone: parentPhone, user_id: parent.id })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: reference.org_unit_id,
          full_name: childName,
          dob: '2014-06-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '2727',
          photo_consent: 'granted',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: childId, class_id: classRow.id, from_date: addDays(today, -30) })
      .execute();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: childId, guardian_id: guardianId, relationship_item_id: relationship.id })
      .execute();

    // Giáo viên lập chương trình: loại nội dung có giải thích ngay trên màn hình, môn học không thu tiền
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await openMenu(teacherPage, '/tutoring');
    const form = teacherPage.getByRole('form', { name: 'Lập chương trình gia sư' });
    await expect(form).toContainText('trong nhà trường không thu tiền');
    await form.getByLabel('Tên chương trình').fill(programName);
    await form.getByRole('combobox', { name: /^Môn học/ }).selectOption({ label: 'Toán' });
    await form.getByLabel(className).check();
    await form.getByLabel('Đến ngày').fill(addDays(today, 20));
    await form.getByRole('button', { name: 'Lập chương trình' }).click();
    await expect(toast(teacherPage, 'Đã lập chương trình (nháp)')).toBeVisible();
    const detail = teacherPage.getByRole('region', { name: `Chương trình ${programName}` });
    await detail.getByRole('button', { name: 'Nộp duyệt' }).click();
    await expect(detail).toContainText('Chờ duyệt');

    // Hiệu trưởng duyệt
    await openMenu(page, '/tutoring');
    await page.getByRole('button', { name: `Xem ${programName}` }).click();
    const principalDetail = page.getByRole('region', { name: `Chương trình ${programName}` });
    await principalDetail.getByRole('button', { name: 'Duyệt chương trình' }).click();
    await expect(principalDetail).toContainText('Đã duyệt, mở đăng ký');

    // Giáo viên xếp buổi lặp theo tuần: hai thứ sau hôm nay, 17:00 đến 17:45 (một tiết)
    await teacherPage.reload();
    await teacherPage.getByRole('button', { name: `Xem ${programName}` }).click();
    const sessions = teacherPage.getByRole('form', { name: 'Xếp buổi học lặp theo tuần' });
    const first = addDays(today, 1);
    for (const day of [weekdayOf(first), weekdayOf(addDays(today, 3))]) {
      await sessions.getByLabel(weekdayLabel(day), { exact: true }).check();
    }
    await sessions.getByLabel('Bắt đầu').fill('17:00');
    await sessions.getByLabel('Kết thúc').fill('17:45');
    await sessions.getByRole('button', { name: 'Xếp buổi' }).click();
    await expect(toast(teacherPage, /Đã xếp \d+ buổi, mỗi buổi 1 tiết/)).toBeVisible();

    // Cha mẹ đọc đơn, xác nhận, gửi đăng ký trên ứng dụng phụ huynh
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Gia sư', exact: true }).click();
    const panel = parentPage.getByRole('region', { name: `Gia sư của ${childName}` });
    await expect(panel).toContainText('Không thu tiền');
    await panel.getByRole('button', { name: `Đăng ký ${programName}` }).click();
    const application = panel.getByRole('region', { name: `Đơn đăng ký ${programName}` });
    await expect(application.getByRole('button', { name: 'Gửi đơn đăng ký' })).toBeDisabled();
    await application.getByLabel(/Tôi đã đọc và đồng ý nội dung đơn/).check();
    await application.getByRole('button', { name: 'Gửi đơn đăng ký' }).click();
    await expect(panel.getByText('Đã gửi đơn đăng ký, chờ nhà trường duyệt')).toBeVisible();

    // Giáo viên duyệt đơn rồi điểm danh: học sinh vắng, máy chủ báo cha mẹ
    await teacherPage.reload();
    await teacherPage.getByRole('button', { name: `Xem ${programName}` }).click();
    await teacherPage.getByRole('button', { name: `Duyệt đơn ${childName}` }).click();
    await expect(toast(teacherPage, `Đã duyệt đơn của ${childName}`)).toBeVisible();
    await openMenu(teacherPage, '/tutoring/sessions');
    await teacherPage.getByRole('button', { name: `Điểm danh ${first}` }).click();
    await teacherPage.getByLabel(`Điểm danh ${childName}`).selectOption('absent');
    await teacherPage.getByRole('button', { name: 'Xác nhận điểm danh' }).click();
    await expect(toast(teacherPage, 'Đã xác nhận điểm danh 1 học sinh, báo vắng 1 cha mẹ')).toBeVisible();

    await card.getByRole('button', { name: 'Gia sư', exact: true }).click();
    await card.getByRole('button', { name: 'Gia sư', exact: true }).click();
    await expect(panel.getByRole('list', { name: 'Lịch học gia sư' })).toContainText(
      `${first} 17:00–17:45 · ${programName}`,
    );
    await expect(panel.getByRole('list', { name: 'Lịch học gia sư' })).toContainText('Vắng');
  } finally {
    if (childId) {
      await schoolYear.deleteFrom('tutoring_attendance').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('tutoring_registrations').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('child_guardians').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('class_enrollments').where('child_id', '=', childId).execute();
    }
    await schoolYear.deleteFrom('tutoring_programs').where('name', '=', programName).execute();
    if (guardianId) {
      await schoolYear.deleteFrom('guardians').where('id', '=', guardianId).execute();
    }
    await setSecondaryEnabled(page, false);
  }
});
