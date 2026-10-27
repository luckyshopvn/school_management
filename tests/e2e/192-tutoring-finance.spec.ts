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

// Thu phí và chi trả gia sư trong trường (DT-27 phần 27c, YCTD-253), kịch bản CT-27c-9: biểu mẫu ghi rõ môn học trong trường không thu
// tiền; giáo viên lập câu lạc bộ bổ trợ có thu theo buổi, đơn giá thù lao mỗi tiết; Hiệu trưởng duyệt; cha mẹ thấy mức thu trên ứng dụng
// phụ huynh và gửi đơn; giáo viên duyệt đơn, xác nhận điểm danh buổi đã dạy; kế toán xem thù lao chưa đẩy ở trang Thu chi gia sư và
// đẩy vào bảng lương tháng. Cuối kịch bản tắt lại THCS. Dữ liệu giả
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

test('CT-27c-9: câu lạc bộ bổ trợ có thu theo buổi, cha mẹ thấy mức thu, kế toán đẩy thù lao buổi đã dạy vào bảng lương', async ({
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
  const accountant = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-04', orgUnitId: reference.org_unit_id }],
  });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `07${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K7',
      name: 'Khối 7',
      order_no: 107,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THCS',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, principal);
  await setSecondaryEnabled(page, true);
  const programName = `Câu lạc bộ tiếng Anh ${suffix}`;
  const childName = `Học Sinh Câu Lạc Bộ ${suffix}`;
  let childId = '';
  let guardianId = '';
  let staffId = '';
  try {
    const className = `Lớp 7H ${suffix}`;
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `7H-${suffix}`,
        name: className,
        grade_level: 'K7',
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
        staff_name: 'Cô Tiếng Anh',
        assignment_role: 'subject',
        subject_name: 'Tiếng Anh',
        subject_id: null,
        from_date: addDays(today, -30),
      })
      .execute();
    // Hồ sơ nhân sự của giáo viên để thù lao vào bảng lương
    staffId = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: reference.org_unit_id,
          code: `GS-${suffix}`,
          full_name: 'Cô Tiếng Anh',
          start_date: addDays(today, -400),
          user_id: teacher.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: `CLB-${suffix}`, name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    guardianId = (
      await schoolYear
        .insertInto('guardians')
        .values({ full_name: 'Phụ huynh câu lạc bộ', phone: parentPhone, user_id: parent.id })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: reference.org_unit_id,
          full_name: childName,
          dob: '2013-06-01',
          gender: 'male',
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

    // Giáo viên lập câu lạc bộ bổ trợ có thu theo buổi; biểu mẫu ghi rõ môn học trong trường không thu tiền
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await openMenu(teacherPage, '/tutoring');
    const form = teacherPage.getByRole('form', { name: 'Lập chương trình gia sư' });
    await expect(form).toContainText('không được thu tiền của học sinh');
    await form.getByLabel('Tên chương trình').fill(programName);
    await form.getByRole('radio', { name: /^Bổ trợ ngoài chương trình môn học/ }).check();
    await form.getByLabel(/^Có thu tiền/).check();
    await form.getByLabel('Số tiền (đồng)').fill('50000');
    await form.getByLabel('Thù lao giáo viên mỗi tiết (đồng)').fill('100000');
    await form.getByRole('combobox', { name: /^Nguồn chi thù lao/ }).selectOption('tutoring_fees');
    await form.getByLabel(className).check();
    await form.getByLabel('Đến ngày').fill(addDays(today, 20));
    await form.getByRole('button', { name: 'Lập chương trình' }).click();
    await expect(toast(teacherPage, 'Đã lập chương trình (nháp)')).toBeVisible();
    const detail = teacherPage.getByRole('region', { name: `Chương trình ${programName}` });
    await expect(detail).toContainText('Thu 50.000 đ mỗi buổi');
    await expect(detail).toContainText('100.000 đ mỗi tiết');
    await detail.getByRole('button', { name: 'Nộp duyệt' }).click();
    await expect(detail).toContainText('Chờ duyệt');

    await openMenu(page, '/tutoring');
    await page.getByRole('button', { name: `Xem ${programName}` }).click();
    const principalDetail = page.getByRole('region', { name: `Chương trình ${programName}` });
    await principalDetail.getByRole('button', { name: 'Duyệt chương trình' }).click();
    await expect(principalDetail).toContainText('Đã duyệt, mở đăng ký');

    // Hai buổi mỗi tuần, 17:00 đến 17:45 (một tiết)
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

    // Cha mẹ thấy mức thu rồi gửi đơn
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Gia sư' }).click();
    const panel = parentPage.getByRole('region', { name: `Gia sư của ${childName}` });
    await expect(panel).toContainText('Thu 50.000 đ mỗi buổi học trên hóa đơn học phí của trường');
    await panel.getByRole('button', { name: `Đăng ký ${programName}` }).click();
    const application = panel.getByRole('region', { name: `Đơn đăng ký ${programName}` });
    await application.getByLabel(/Tôi đã đọc và đồng ý nội dung đơn/).check();
    await application.getByRole('button', { name: 'Gửi đơn đăng ký' }).click();
    await expect(panel.getByText('Đã gửi đơn đăng ký, chờ nhà trường duyệt')).toBeVisible();

    // Giáo viên duyệt đơn, xác nhận điểm danh buổi đầu (buổi đã dạy)
    await teacherPage.reload();
    await teacherPage.getByRole('button', { name: `Xem ${programName}` }).click();
    await teacherPage.getByRole('button', { name: `Duyệt đơn ${childName}` }).click();
    await expect(toast(teacherPage, `Đã duyệt đơn của ${childName}`)).toBeVisible();
    await openMenu(teacherPage, '/tutoring/sessions');
    await teacherPage.getByRole('button', { name: `Điểm danh ${first}` }).click();
    await teacherPage.getByLabel(`Điểm danh ${childName}`).selectOption('present');
    await teacherPage.getByRole('button', { name: 'Xác nhận điểm danh' }).click();
    await expect(toast(teacherPage, 'Đã xác nhận điểm danh 1 học sinh, báo vắng 0 cha mẹ')).toBeVisible();

    // Kế toán xem thù lao chưa đẩy, đẩy vào bảng lương tháng đầu tiên từ tháng có buổi đã dạy mà bảng lương còn nháp hoặc chưa lập
    // (kịch bản lương khác có thể đã chốt bảng lương tháng này)
    let payYear = Number(first.slice(0, 4));
    let payMonth = Number(first.slice(5, 7));
    for (;;) {
      const payroll = await schoolYear
        .selectFrom('payrolls')
        .select('status')
        .where('period_year', '=', payYear)
        .where('period_month', '=', payMonth)
        .executeTakeFirst();
      if (!payroll || payroll.status === 'draft') {
        break;
      }
      payYear += payMonth === 12 ? 1 : 0;
      payMonth = payMonth === 12 ? 1 : payMonth + 1;
    }
    const month = `${payYear}-${String(payMonth).padStart(2, '0')}`;
    const accountantPage = await (await browser.newContext()).newPage();
    await signIn(accountantPage, accountant);
    await openMenu(accountantPage, '/tutoring/finance');
    const paySection = accountantPage.getByRole('region', { name: 'Thù lao giáo viên' });
    await paySection.getByLabel('Tháng lương').fill(month);
    const row = paySection.getByRole('row').filter({ hasText: programName });
    await expect(row).toContainText('100.000 đ');
    await paySection.getByRole('button', { name: 'Đẩy thù lao vào bảng lương' }).click();
    await expect(toast(accountantPage, /Đã đẩy thù lao của \d+ giáo viên vào bảng lương tháng/)).toBeVisible();
    await expect(row).toHaveCount(0);
    const report = accountantPage.getByRole('table', { name: 'Thu chi theo chương trình' });
    await accountantPage.getByLabel('Từ tháng').fill(first.slice(0, 7));
    await accountantPage.getByLabel('Đến tháng').fill(first.slice(0, 7));
    await expect(report.getByRole('row').filter({ hasText: programName })).toContainText('100.000 đ (1 tiết)');
  } finally {
    const program = await schoolYear
      .selectFrom('tutoring_programs')
      .select('id')
      .where('name', '=', programName)
      .executeTakeFirst();
    if (program) {
      const bonusIds = (
        await schoolYear
          .selectFrom('tutoring_teacher_pay')
          .select('bonus_deduction_id')
          .where('program_id', '=', program.id)
          .execute()
      ).map((pay) => pay.bonus_deduction_id);
      await schoolYear.deleteFrom('tutoring_teacher_pay').where('program_id', '=', program.id).execute();
      if (bonusIds.length > 0) {
        await schoolYear.deleteFrom('staff_bonus_deductions').where('id', 'in', bonusIds).execute();
      }
    }
    if (childId) {
      await schoolYear.deleteFrom('tutoring_attendance').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('tutoring_registrations').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('child_guardians').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('class_enrollments').where('child_id', '=', childId).execute();
    }
    await schoolYear.deleteFrom('tutoring_programs').where('name', '=', programName).execute();
    if (staffId) {
      await schoolYear.deleteFrom('staff').where('id', '=', staffId).execute();
    }
    if (guardianId) {
      await schoolYear.deleteFrom('guardians').where('id', '=', guardianId).execute();
    }
    await setSecondaryEnabled(page, false);
  }
});
