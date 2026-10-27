import { expect, test, type Browser, type Page } from './fixtures.js';
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

// Bài về nhà và phụ huynh (DT-28 phần 28f, YCTD-276), kịch bản CT-28f-10: giáo viên ghi tiết ở sổ đầu bài, giao bài về nhà từ
// tiết, xem lịch khối lượng 7 ngày, phát hành; Ban Giám hiệu đặt quy tắc ở mục 9.6, xem khối lượng của lớp; phụ huynh của em chưa
// có tài khoản học bấm "Đã xem cùng con", nộp thay ảnh vở và chữ. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

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

async function signInPortal(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

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

test('CT-28f-10: giao bài về nhà từ sổ đầu bài, quy tắc và khối lượng ở mục 9.6, phụ huynh đã xem cùng con và nộp thay', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const today = todayInVietnam();
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `0907${String(suffix).padStart(6, '0')}`;
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
  const subjectName = `Toán BVN ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-BVN-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const className = `Lớp 7E ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7E-${suffix}`,
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
      staff_name: `Cô Toán ${suffix}`,
      assignment_role: 'subject',
      subject_name: subjectName,
      subject_id: subject.id,
      from_date: '2026-01-01',
    })
    .execute();
  const childName = `Học sinh Mai ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `bvn-${suffix}`,
      national_id_last4: '0000',
      photo_consent: 'granted',
      status: 'active',
      enroll_date: '2026-09-05',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-09-05', order_number: 1 })
    .execute();
  const relationship = await schoolYear
    .insertInto('catalog_items')
    .values({ catalog_type: 'parent_relationship', code: `ME-BVN-${suffix}`, name: 'Mẹ' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: `Mẹ Mai ${suffix}`, phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
    .execute();
  // Bản thời khoá biểu thử THCS áp dụng từ hôm nay: tiết 1 Toán mọi ngày; trả về bản nháp khi xong để không ảnh hưởng kịch bản khác
  const version = await schoolYear
    .insertInto('timetable_versions')
    .values({
      school_level: 'THCS',
      name: `TKB bài về nhà ${suffix}`,
      effective_from: today,
      status: 'published',
      source: 'manual',
      note: null,
      published_at: new Date(),
      published_by: principal.id,
      published_by_name: 'Hiệu trưởng thử',
      created_by: principal.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('timetable_lessons')
    .values(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        version_id: version.id,
        class_id: classRow.id,
        weekday,
        period_no: 1,
        subject_id: subject.id,
        teacher_user_id: teacher.id,
        teacher_name: `Cô Toán ${suffix}`,
        room_id: null,
      })),
    )
    .execute();

  const head = await signInPortal(browser, principal);
  await setSecondaryEnabled(head, true);
  try {
    const spaceTitle = `${subjectName} - ${className}`;
    const homeworkTitle = `Bài về nhà trang 20 ${suffix}`;

    // Giáo viên: mở lớp học trực tuyến cho học sinh
    const page = await (await browser.newContext()).newPage();
    await page.goto(TEACHER_URL);
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await page.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await page.getByRole('button', { name: new RegExp(spaceTitle) }).click();
    await page.getByRole('button', { name: 'Mở lớp cho học sinh' }).click();
    await expect(page.getByRole('button', { name: 'Ẩn lớp với học sinh' })).toBeVisible();

    // Sổ đầu bài: ghi tiết, giao bài về nhà từ tiết
    await page.goto(TEACHER_URL);
    await page.getByRole('button', { name: 'Sổ đầu bài' }).click();
    const lessons = page.getByRole('list', { name: 'Tiết dạy trong ngày' });
    await lessons.getByRole('button', { name: `Tiết 1 ${className} · ${subjectName} · Chưa ghi` }).click();
    const form = page.getByRole('region', { name: 'Ghi tiết dạy' });
    await form.getByLabel('Tên bài', { exact: true }).fill(`Phép nhân số hữu tỉ ${suffix}`);
    await form.getByRole('button', { name: 'Lưu tiết' }).click();
    await expect(page.getByText('Đã lưu tiết dạy')).toBeVisible();
    await lessons.getByRole('button', { name: `Tiết 1 ${className} · ${subjectName} · Đã ghi` }).click();
    const lessonHomework = page.getByRole('region', { name: 'Bài về nhà của tiết' });
    await lessonHomework.getByLabel('Tên bài về nhà').fill(homeworkTitle);
    await lessonHomework.getByRole('button', { name: 'Giao bài về nhà' }).click();
    await expect(page.getByRole('heading', { name: homeworkTitle })).toBeVisible();
    const composer = page.getByRole('region', { name: 'Soạn bài tập' });
    await expect(composer.getByLabel('Làm ở đâu')).toHaveValue('homework');
    await composer.getByLabel('Số phút dự kiến').fill('20');
    await composer.getByLabel('Loại yêu cầu').selectOption('essay');
    await composer.getByLabel('Yêu cầu', { exact: true }).fill('Viết lời giải bài 3');
    await composer.getByRole('button', { name: 'Thêm yêu cầu' }).click();
    await composer.getByLabel('Loại yêu cầu').selectOption('upload');
    await composer.getByLabel('Yêu cầu', { exact: true }).fill('Chụp ảnh vở bài làm');
    await composer.getByRole('button', { name: 'Thêm yêu cầu' }).click();
    await composer.getByRole('button', { name: 'Lưu bài tập' }).click();
    await expect(page.getByText('Đã lưu bài tập')).toBeVisible();
    const workload = page.getByRole('region', { name: 'Khối lượng bài về nhà của lớp' });
    await expect(workload.getByText('Trường chưa đặt quy tắc khối lượng bài về nhà.')).toBeVisible();
    await workload.getByRole('button', { name: 'Giao bài cho học sinh' }).click();
    await expect(page.getByText('Đã giao bài về nhà cho học sinh')).toBeVisible();
    await page.getByRole('button', { name: 'Quay lại' }).last().click();
    await expect(lessonHomework.getByText('Đã giao')).toBeVisible();

    // Ban Giám hiệu: đặt quy tắc ở mục 9.6, xem khối lượng của lớp
    await head.goto('/online-homework');
    const policies = head.getByRole('region', { name: 'Quy tắc bài về nhà của trường' });
    await policies.getByLabel('Cấp', { exact: true }).selectOption('THCS');
    await policies.getByLabel('Khối', { exact: true }).fill('7');
    await policies.getByLabel('Số bài tối đa mỗi ngày').fill('1');
    await policies.getByLabel('Căn cứ').fill(`Quy định thử của trường ${suffix}`);
    await policies.getByRole('button', { name: 'Lưu quy tắc' }).click();
    await expect(toast(head, 'Đã lưu quy tắc bài về nhà')).toBeVisible();
    await expect(policies.getByRole('list', { name: 'Các quy tắc' })).toContainText('tối đa 1 bài mỗi ngày');
    const byClass = head.getByRole('region', { name: 'Khối lượng theo lớp' });
    await byClass.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await expect(byClass.getByRole('table', { name: `Khối lượng ${className}` })).toContainText(homeworkTitle);

    // Phụ huynh: bài của con, đã xem cùng con, nộp thay (con chưa có tài khoản học)
    const home = await (await browser.newContext()).newPage();
    await home.goto(PARENT_URL);
    await home.getByLabel('Số điện thoại').fill(parentPhone);
    await home.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await home.getByRole('button', { name: 'Đăng nhập' }).click();
    const childCard = home.getByRole('listitem', { name: childName });
    await childCard.getByRole('button', { name: 'Học trực tuyến' }).click();
    const panel = home.getByRole('region', { name: 'Bài tập của con' });
    const item = panel.getByRole('listitem', { name: `Bài về nhà ${homeworkTitle}` });
    await expect(item).toContainText('Chưa nộp');
    await item.getByRole('button', { name: 'Đã xem cùng con' }).click();
    await expect(panel.getByText(`Đã ghi nhận xem cùng con bài ${homeworkTitle}`)).toBeVisible();
    await item.getByRole('button', { name: 'Nộp thay' }).click();
    const proxy = item.getByRole('group', { name: `Nộp thay ${homeworkTitle}` });
    await proxy.getByLabel('Trả lời: Viết lời giải bài 3').fill('Con nhân tử với tử, mẫu với mẫu');
    await proxy.getByLabel('Chụp vở: Chụp ảnh vở bài làm').setInputFiles({
      name: 'vo-bai-lam.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]),
    });
    await expect(proxy.getByText('Đã tải: vo-bai-lam.png')).toBeVisible();
    await proxy.getByRole('button', { name: 'Nộp thay con' }).click();
    await expect(panel.getByText(`Đã nộp thay bài ${homeworkTitle}`)).toBeVisible();
    await expect(item).toContainText('Đã nộp, chờ chấm');
    await expect(item).toContainText('phụ huynh nộp thay');
    const stored = await schoolYear
      .selectFrom('assignment_submissions')
      .innerJoin('assignments', 'assignments.id', 'assignment_submissions.assignment_id')
      .select(['assignment_submissions.submitted_by_kind', 'assignments.context', 'assignments.class_log_id'])
      .where('assignment_submissions.child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect(stored.submitted_by_kind).toBe('guardian');
    expect(stored.context).toBe('homework');
    expect(stored.class_log_id).not.toBeNull();
  } finally {
    await schoolYear.updateTable('timetable_versions').set({ status: 'draft' }).where('id', '=', version.id).execute();
    await schoolYear
      .deleteFrom('homework_policies')
      .where('school_level', '=', 'THCS')
      .where('grade', '=', 7)
      .execute();
    await setSecondaryEnabled(head, false);
  }
});
