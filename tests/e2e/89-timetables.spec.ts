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

// Thời khoá biểu phần khung (DT-20 phần 22c1, YCTD-160), kịch bản CT-22c1-6: trường bật Tiểu học; Hiệu trưởng khai báo khung
// giờ tiết, tạo bản nháp, xếp tiết cho một lớp, kiểm tra xung đột, ban hành; giáo viên thấy lịch dạy, phụ huynh thấy thời khoá
// biểu của con. Cuối kịch bản tắt lại Tiểu học. Dữ liệu giả
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

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

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

test('CT-22c1-6: khung giờ tiết, xếp tiết, kiểm tra xung đột, ban hành; lịch dạy của giáo viên, thời khoá biểu của con', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `05${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K1',
      name: 'Khối 1',
      order_no: 101,
      age_from_months: null,
      age_to_months: null,
      school_level: 'TH',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const className = `Lớp 1D ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `1D-${suffix}`,
      name: className,
      grade_level: 'K1',
      school_level: 'TH',
      max_size: 35,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Thời Khoá Biểu ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2020-06-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '8989',
      photo_consent: 'granted',
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
    .values({ full_name: 'Phụ huynh thời khoá biểu', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(page, true);
  try {
    // Môn mẫu (20a) và phân công giáo viên Tiếng Việt của lớp
    await openMenu(page, '/subjects');
    await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
    await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();
    const vietnamese = await schoolYear
      .selectFrom('subjects')
      .select(['id', 'name'])
      .where('code', '=', 'TH-TV')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classRow.id,
        staff_user_id: teacher.id,
        staff_name: `Giáo viên ${suffix}`,
        assignment_role: 'subject',
        subject_name: vietnamese.name,
        subject_id: vietnamese.id,
        from_date: '2026-01-01',
      })
      .execute();

    // 7.3 Khung giờ tiết học
    await openMenu(page, '/period-slots');
    await page.getByRole('button', { name: 'Điền khung mẫu Tiểu học' }).click();
    await page.getByRole('button', { name: 'Ghi khung giờ' }).click();
    await expect(toast(page, 'Đã ghi khung giờ tiết học')).toBeVisible();

    // 7.4 Thời khoá biểu: tạo bản nháp, xếp tiết cho lớp, kiểm tra xung đột, ban hành
    await openMenu(page, '/timetables');
    const form = page.getByRole('form', { name: 'Tạo bản thời khoá biểu' });
    await form.getByLabel('Tên bản', { exact: true }).fill(`TKB thử ${suffix}`);
    await form.getByLabel('Áp dụng từ ngày', { exact: true }).fill(today);
    await form.getByRole('button', { name: 'Tạo bản nháp' }).click();
    await expect(toast(page, `Đã tạo bản nháp TKB thử ${suffix}`)).toBeVisible();
    await page.getByLabel('Chọn lớp', { exact: true }).selectOption({ label: className });
    await page.getByLabel('Thứ Hai tiết 1', { exact: true }).selectOption({ label: 'Tiếng Việt' });
    await page.getByLabel('Thứ Ba tiết 1', { exact: true }).selectOption({ label: 'Tiếng Việt' });
    await page.getByRole('button', { name: 'Ghi thời khoá biểu của lớp' }).click();
    await expect(toast(page, 'Đã ghi thời khoá biểu của lớp')).toBeVisible();
    await page.getByRole('button', { name: 'Kiểm tra xung đột' }).click();
    const conflicts = page.getByRole('region', { name: 'Xung đột' });
    await expect(conflicts).toContainText(`Cảnh báo: ${className}: môn Tiếng Việt có 2 tiết/tuần`);
    await page.getByRole('button', { name: 'Ban hành' }).click();
    await expect(toast(page, 'Đã ban hành thời khoá biểu')).toBeVisible();
    await expect(
      page
        .getByRole('table', { name: 'Bản thời khoá biểu' })
        .getByRole('row', { name: new RegExp(`TKB thử ${suffix}`) }),
    ).toContainText('Đang áp dụng');

    // Ứng dụng giáo viên: lịch dạy của tôi
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await teacherPage.getByRole('button', { name: 'Lịch dạy của tôi' }).click();
    const monday = teacherPage.getByRole('region', { name: 'Thứ Hai' });
    await expect(monday).toContainText(`Tiết 1 (07:15–07:50) ${className} · Tiếng Việt`);

    // Ứng dụng phụ huynh: thời khoá biểu của con
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Thời khoá biểu', exact: true }).click();
    await expect(card.getByRole('region', { name: `Thời khoá biểu của ${childName}` })).toContainText(
      'Tiết 1 (07:15): Tiếng Việt',
    );
  } finally {
    await setPrimaryEnabled(page, false);
  }
});
