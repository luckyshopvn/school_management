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

// Sổ đầu bài và điểm danh theo tiết (DT-20 phần 20d, YCTD-162), kịch bản CT-20d-6: trường bật Tiểu học, lớp có thời khoá
// biểu đã ban hành; giáo viên ghi tiết hôm nay, điểm danh từng học sinh và ký sổ trên ứng dụng giáo viên; phụ huynh xem điểm
// danh theo tiết của con; Hiệu trưởng xem sổ tuần, ký sổ tuần và xem chuyên cần theo tiết. Cuối kịch bản gỡ bản thời khoá
// biểu thử và tắt lại Tiểu học. Dữ liệu giả
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

test('CT-20d-6: giáo viên ghi, ký tiết và điểm danh theo tiết; phụ huynh xem; Ban giám hiệu ký sổ tuần, xem chuyên cần', async ({
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
  const parentPhone = `04${String(suffix).padStart(8, '0')}`;
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
  const existingSubject = await schoolYear
    .selectFrom('subjects')
    .select(['id', 'name'])
    .where('code', '=', 'TH-TV')
    .executeTakeFirst();
  const subject =
    existingSubject ??
    (await schoolYear
      .insertInto('subjects')
      .values({ code: 'TH-TV', name: 'Tiếng Việt', school_level: 'TH' })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow());
  const className = `Lớp 1E ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `1E-${suffix}`,
      name: className,
      grade_level: 'K1',
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
      staff_name: `Giáo viên sổ đầu bài ${suffix}`,
      assignment_role: 'subject',
      subject_name: subject.name,
      subject_id: subject.id,
      from_date: '2026-01-01',
    })
    .execute();
  const names = [`Học Sinh Đi Muộn ${suffix}`, `Học Sinh Báo Vắng ${suffix}`];
  const childIds: string[] = [];
  for (const name of names) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: '2020-06-01',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '9191',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childIds.push(child.id);
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
      .execute();
  }
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh sổ đầu bài', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: childIds[0] ?? '', guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();
  await schoolYear
    .insertInto('absence_records')
    .values({
      child_id: childIds[1] ?? '',
      org_unit_id: reference.org_unit_id,
      absence_date: today,
      reason: 'Ốm',
      is_advised: true,
      advised_at: new Date(),
      source: 'parent',
      reported_by: parent.id,
    })
    .execute();
  // Bản thời khoá biểu thử đã ban hành, áp dụng từ hôm nay: tiết 1 Tiếng Việt mọi ngày trong tuần để kịch bản chạy được hôm nào
  const version = await schoolYear
    .insertInto('timetable_versions')
    .values({
      school_level: 'TH',
      name: `TKB sổ đầu bài ${suffix}`,
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
        teacher_name: `Giáo viên sổ đầu bài ${suffix}`,
        room_id: null,
      })),
    )
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(page, true);
  try {
    // Ứng dụng giáo viên: ghi tiết hôm nay, điểm danh, ký sổ
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await teacherPage.getByRole('button', { name: 'Sổ đầu bài' }).click();
    const lessons = teacherPage.getByRole('list', { name: 'Tiết dạy trong ngày' });
    await lessons.getByRole('button', { name: `Tiết 1 ${className} · Tiếng Việt · Chưa ghi` }).click();
    const form = teacherPage.getByRole('region', { name: 'Ghi tiết dạy' });
    await expect(form.getByLabel(`Điểm danh ${names[1]}`, { exact: true })).toHaveValue('absent_excused');
    await expect(form).toContainText('Phụ huynh báo vắng: Ốm');
    await form.getByLabel('Tên bài', { exact: true }).fill(`Bài thử ${suffix}`);
    await form.getByLabel('Nhận xét tiết', { exact: true }).fill('Lớp chú ý');
    await form.getByLabel('Xếp loại tiết', { exact: true }).selectOption('A');
    await form.getByLabel(`Điểm danh ${names[0]}`, { exact: true }).selectOption({ label: 'Đi muộn' });
    await form.getByRole('button', { name: 'Ký sổ' }).click();
    await expect(teacherPage.getByText('Đã ghi và ký sổ tiết dạy')).toBeVisible();
    await expect(lessons).toContainText(`Tiết 1 ${className} · Tiếng Việt · Đã ký`);

    // Ứng dụng phụ huynh: điểm danh theo tiết của con
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: names[0] });
    await expect(card.getByRole('button', { name: 'Báo vắng', exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Điểm danh theo tiết', exact: true }).click();
    const panel = card.getByRole('region', { name: `Điểm danh theo tiết của ${names[0]}` });
    await expect(panel).toContainText('Đi muộn: 1');
    await expect(panel).toContainText('tiết 1 (Tiếng Việt): Đi muộn');

    // 7.5 Sổ đầu bài: Hiệu trưởng xem sổ tuần, ký sổ tuần
    await openMenu(page, '/class-logs');
    await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    const week = page.getByRole('table', { name: 'Các tiết trong tuần' });
    await expect(week.getByRole('row', { name: new RegExp(`Bài thử ${suffix}`) })).toContainText('Đã ký');
    await expect(week.getByRole('row', { name: new RegExp(`Bài thử ${suffix}`) })).toContainText('1 vắng, 1 muộn');
    await page.getByLabel('Nhận xét của Ban giám hiệu', { exact: true }).fill('Ghi sổ đầy đủ');
    await page.getByRole('button', { name: 'Ký sổ tuần' }).click();
    await expect(toast(page, 'Đã ký sổ đầu bài tuần này')).toBeVisible();
    await expect(page.getByText('Ban giám hiệu đã ký sổ tuần')).toContainText('Ghi sổ đầy đủ');

    // 7.6 Chuyên cần theo tiết: đối chiếu với báo vắng theo ngày
    await openMenu(page, '/period-attendance');
    await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await page.getByLabel('Từ ngày', { exact: true }).fill(today);
    await page.getByLabel('Đến ngày', { exact: true }).fill(today);
    const summary = page.getByRole('table', { name: 'Chuyên cần theo học sinh' });
    await expect(summary.getByRole('row', { name: new RegExp(names[0] ?? '') })).toHaveText(
      new RegExp(`${names[0]}\\s*0\\s*1\\s*0\\s*0\\s*0\\s*0\\s*0\\s*0`),
    );
    await expect(summary.getByRole('row', { name: new RegExp(names[1] ?? '') })).toHaveText(
      new RegExp(`${names[1]}\\s*0\\s*0\\s*1\\s*0\\s*1\\s*1\\s*0\\s*0`),
    );
  } finally {
    await schoolYear.deleteFrom('timetable_versions').where('id', '=', version.id).execute();
    await setPrimaryEnabled(page, false);
  }
});
