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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272), kịch bản CT-28b-16: lớp học trực tuyến tự có từ phân công giảng dạy;
// giáo viên soạn chương, trang nội dung, liên kết mở sau khi hoàn thành trang, giao cho học sinh, mở lớp; dạy thay thế bị chặn
// đến khi Hiệu trưởng nhập quyết định (Thông tư 09/2021/TT-BGDĐT Điều 5 khoản 4); Hiệu trưởng ban hành nội quy; khoá học mẫu
// qua duyệt rồi đẩy xuống lớp; phụ huynh thấy lớp, hoạt động và lý do hoạt động còn khóa. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;

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

async function signIn(browser: Browser, user: { username: string; password: string }, url = '/'): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(url);
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

test('CT-28b-16: lớp học trực tuyến từ phân công, hoạt động có điều kiện mở, quyết định dạy thay thế, nội quy, khoá mẫu, phụ huynh xem', async ({
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
  const subjectName = `Toán LMS ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-LMS-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const className = `Lớp 7L ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7L-${suffix}`,
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
  const childName = `Học sinh Lan ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `lms-${suffix}`,
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
    .values({ catalog_type: 'parent_relationship', code: `ME-LMS-${suffix}`, name: 'Mẹ' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: `Mẹ Lan ${suffix}`, phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
    .execute();

  const head = await signIn(browser, principal);
  await setSecondaryEnabled(head, true);
  try {
    // 9.1 Lớp học trực tuyến: lớp tự có từ phân công, giáo viên không tạo lớp
    const page = await signIn(browser, teacher);
    await openMenu(page, '/online-classes');
    const spaceTitle = `${subjectName} - ${className}`;
    const row = page.getByRole('row', { name: new RegExp(spaceTitle) });
    await expect(row).toContainText('Đang ẩn');
    await row.getByRole('button', { name: 'Mở' }).click();
    const panel = page.getByRole('region', { name: `Lớp học trực tuyến ${spaceTitle}` });
    await panel.getByLabel('Tên chương').fill('Chương 1. Số hữu tỉ');
    await panel.getByLabel('Tuần').fill('1');
    await panel.getByRole('button', { name: 'Thêm chương' }).click();
    const activityForm = panel.getByRole('form', { name: 'Thêm hoạt động' });
    await activityForm.getByLabel('Tên hoạt động').fill('Đọc: số hữu tỉ là gì');
    await activityForm.getByLabel('Nội dung trang').fill('Số hữu tỉ là số viết được dưới dạng phân số.');
    await activityForm.getByRole('button', { name: 'Thêm hoạt động' }).click();
    await expect(toast(page, 'Đã thêm hoạt động Đọc: số hữu tỉ là gì')).toBeVisible();
    await activityForm.getByLabel('Loại hoạt động').selectOption({ label: 'Liên kết' });
    await activityForm.getByLabel('Tên hoạt động').fill('Luyện tập trên trang của trường');
    await activityForm.getByLabel('Địa chỉ liên kết (https://)').fill('https://hoc.truong-thu.example/bai-1');
    await activityForm.getByLabel(/Chỉ mở khi học sinh hoàn thành/).check();
    await activityForm.getByRole('button', { name: 'Thêm hoạt động' }).click();
    await expect(toast(page, 'Đã thêm hoạt động Luyện tập trên trang của trường')).toBeVisible();
    for (const title of ['Đọc: số hữu tỉ là gì', 'Luyện tập trên trang của trường']) {
      await panel
        .getByRole('listitem')
        .filter({ hasText: title })
        .getByRole('button', { name: 'Giao cho học sinh' })
        .click();
      await expect(toast(page, `Đã giao "${title}" cho học sinh`)).toBeVisible();
    }
    await panel.getByRole('button', { name: 'Mở lớp cho học sinh' }).click();
    await expect(toast(page, 'Đã mở lớp cho học sinh')).toBeVisible();
    // Dạy thay thế chưa có quyết định của Hiệu trưởng thì bị chặn
    const reading = panel.getByRole('listitem').filter({ hasText: 'Đọc: số hữu tỉ là gì' });
    await reading.getByRole('button', { name: 'Đổi sang thay thế' }).click();
    await expect(reading.getByRole('alert')).toContainText('Hiệu trưởng');

    // 9.3 Hiệu trưởng ghi quyết định dạy học trực tuyến thay thế cho lớp, ban hành nội quy
    await openMenu(head, '/online-teaching');
    const decision = head.getByRole('form', { name: 'Ghi quyết định dạy học trực tuyến thay thế' });
    await decision.getByLabel('Số quyết định').fill(`${suffix}/QĐ-THCS`);
    await decision.getByLabel('Ngày quyết định').fill('2026-09-10');
    await decision.getByLabel('Từ ngày').fill('2026-01-01');
    await decision.getByLabel('Đến ngày').fill('2099-12-31');
    await decision.getByLabel('Lý do bất khả kháng').fill('Học sinh không đến trường do bão');
    await decision.getByLabel(className).check();
    await decision.getByRole('button', { name: 'Ghi quyết định' }).click();
    await expect(toast(head, 'Đã ghi quyết định dạy học trực tuyến thay thế')).toBeVisible();
    await head.getByLabel('Nội dung nội quy').fill('Vào lớp đúng giờ, tôn trọng bạn và thầy cô.');
    await head.getByRole('button', { name: 'Ban hành phiên bản mới' }).click();
    await expect(toast(head, 'Đã ban hành nội quy dạy học trực tuyến')).toBeVisible();

    await page.reload();
    await page
      .getByRole('row', { name: new RegExp(spaceTitle) })
      .getByRole('button', { name: 'Mở' })
      .click();
    const readingAgain = page
      .getByRole('region', { name: `Lớp học trực tuyến ${spaceTitle}` })
      .getByRole('listitem')
      .filter({ hasText: 'Đọc: số hữu tỉ là gì' });
    await readingAgain.getByRole('button', { name: 'Đổi sang thay thế' }).click();
    await expect(readingAgain).toContainText('Thay thế dạy trực tiếp');

    // 9.2 Khoá học mẫu: soạn, gửi duyệt, Ban Giám hiệu duyệt hai bước, đẩy xuống lớp
    await openMenu(page, '/course-templates');
    const templateTitle = `Toán 7 mẫu ${suffix}`;
    await page.getByLabel('Tên khoá mẫu').fill(templateTitle);
    await page.getByLabel('Cấp học của khoá mẫu').selectOption('THCS');
    await page.getByRole('button', { name: 'Tạo khoá mẫu' }).click();
    await expect(toast(page, 'Đã tạo khoá mẫu nháp')).toBeVisible();
    const card = page.getByRole('listitem').filter({ hasText: templateTitle });
    await card.getByRole('button', { name: 'Mở' }).click();
    await card.getByLabel('Chương mới của khoá mẫu').fill('Chương mẫu 1');
    await card.getByRole('button', { name: 'Thêm chương vào khoá mẫu' }).click();
    await expect(card).toContainText('Chương mẫu 1');
    await card.getByLabel('Tên trang nội dung').fill('Trang mẫu của tổ');
    await card.getByLabel('Nội dung', { exact: true }).fill('Nội dung do tổ soạn');
    await card.getByRole('button', { name: 'Thêm trang vào khoá mẫu' }).click();
    await expect(card).toContainText('Trang mẫu của tổ');
    await card.getByRole('button', { name: 'Gửi duyệt' }).click();
    await expect(toast(page, 'Đã gửi khoá mẫu cho tổ duyệt')).toBeVisible();

    await openMenu(head, '/course-templates');
    const review = head.getByRole('listitem').filter({ hasText: templateTitle });
    await review.getByRole('button', { name: 'Mở' }).click();
    await review.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(toast(head, 'Khoá mẫu: Chờ Ban Giám hiệu duyệt')).toBeVisible();
    await review.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(toast(head, 'Khoá mẫu: Đã duyệt')).toBeVisible();

    await page.reload();
    const approved = page.getByRole('listitem').filter({ hasText: templateTitle });
    await approved.getByRole('button', { name: 'Mở' }).click();
    await approved.getByLabel(spaceTitle).check();
    await approved.getByRole('button', { name: 'Đẩy khoá mẫu xuống lớp' }).click();
    await expect(toast(page, /Đã đẩy khoá mẫu xuống 1 lớp: thêm 1 hoạt động/)).toBeVisible();

    // Phụ huynh thấy lớp đã mở, hoạt động đã giao, hoạt động khóa nêu lý do, nội quy để xác nhận
    // Ứng dụng phụ huynh đăng nhập bằng số điện thoại
    const home = await (await browser.newContext()).newPage();
    await home.goto(PARENT_URL);
    await home.getByLabel('Số điện thoại').fill(parentPhone);
    await home.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await home.getByRole('button', { name: 'Đăng nhập' }).click();
    const childCard = home.getByRole('listitem', { name: childName });
    await childCard.getByRole('button', { name: 'Học trực tuyến' }).click();
    const learning = home.getByRole('region', { name: `Học trực tuyến của ${childName}` });
    await expect(learning).toContainText(spaceTitle);
    await expect(learning).toContainText('Đọc: số hữu tỉ là gì');
    await expect(learning).toContainText('Hoàn thành "Đọc: số hữu tỉ là gì" để mở');
    await expect(learning).not.toContainText('Trang mẫu của tổ');
    await learning.getByRole('button', { name: 'Đã đọc cùng con' }).click();
    await expect(learning.getByRole('button', { name: 'Đã đọc cùng con' })).toHaveCount(0);
  } finally {
    await setSecondaryEnabled(head, false);
  }
});
