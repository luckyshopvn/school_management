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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Máy xếp thời khoá biểu (DT-20 phần 22c2, YCTD-164), kịch bản CT-22c2-14: trường bật Tiểu học; Hiệu trưởng đặt ràng buộc,
// tiết giáo viên báo bận, chạy máy xếp ở tiến trình chạy nền, xem phương án, tạo bản nháp, chỉnh tay có kiểm tra ngay; ghi dạy
// thay, đổi tiết trên bản đang áp dụng; xem báo cáo tiết dạy; tạo mã QR và mở trang tra cứu không cần đăng nhập. Cuối kịch
// bản tắt lại Tiểu học. Dữ liệu giả
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

const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

test('CT-22c2-14: máy xếp chạy nền, phương án thành bản nháp, kiểm tra ngay; dạy thay, đổi tiết; báo cáo; mã QR tra cứu', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  let schoolDay = today;
  while (isoWeekday(schoolDay) > 5) {
    schoolDay = plusDays(schoolDay, 1);
  }
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacherA = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const teacherB = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const nameA = `Cô Tiếng Việt ${suffix}`;
  const nameB = `Thầy Toán ${suffix}`;
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
  const className = `Lớp 1G ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `1G-${suffix}`,
      name: className,
      grade_level: 'K1',
      school_level: 'TH',
      max_size: 35,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(page, true);
  try {
    // Môn mẫu (20a), phân công Tiếng Việt cho cô A, Toán cho thầy B; khung giờ mẫu (22c1)
    await openMenu(page, '/subjects');
    await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
    await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();
    const subjects = await schoolYear
      .selectFrom('subjects')
      .select(['id', 'code', 'name'])
      .where('code', 'in', ['TH-TV', 'TH-TOAN'])
      .execute();
    const vietnamese = subjects.find((subject) => subject.code === 'TH-TV');
    const math = subjects.find((subject) => subject.code === 'TH-TOAN');
    for (const [teacher, name, subject] of [
      [teacherA, nameA, vietnamese],
      [teacherB, nameB, math],
    ] as const) {
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classRow.id,
          staff_user_id: teacher.id,
          staff_name: name,
          assignment_role: 'subject',
          subject_name: subject?.name ?? '',
          subject_id: subject?.id ?? null,
          from_date: '2026-01-01',
        })
        .execute();
    }
    await openMenu(page, '/period-slots');
    await page.getByRole('button', { name: 'Điền khung mẫu Tiểu học' }).click();
    await page.getByRole('button', { name: 'Ghi khung giờ' }).click();
    await expect(toast(page, 'Đã ghi khung giờ tiết học')).toBeVisible();

    // 7.5 Xếp tự động: ràng buộc, tiết bận, chạy máy xếp, xem phương án, tạo bản nháp
    await openMenu(page, '/timetable-generator');
    const weights = page.getByRole('region', { name: 'Ràng buộc' });
    await weights.getByLabel('Giới hạn thời gian (giây)').fill('5');
    await weights.getByLabel('Số phương án').selectOption('1');
    await weights.getByRole('button', { name: 'Lưu ràng buộc' }).click();
    await expect(toast(page, 'Đã lưu mức quan trọng của ràng buộc')).toBeVisible();
    const busy = page.getByRole('region', { name: 'Giáo viên báo bận' });
    await busy.getByLabel('Giáo viên báo bận').selectOption({ label: nameA });
    await busy.getByLabel('Bận Thứ Hai tiết 1').check();
    await busy.getByRole('button', { name: 'Lưu tiết bận' }).click();
    await expect(toast(page, 'Đã lưu tiết giáo viên báo bận')).toBeVisible();

    const generator = page.getByRole('region', { name: 'Xếp tự động' });
    await generator.getByRole('button', { name: 'Xếp thời khoá biểu' }).click();
    const run = generator.getByRole('region', { name: 'Lần xếp' });
    await expect(run.getByText('Đã xong')).toBeVisible({ timeout: 90_000 });
    await run.getByRole('table', { name: 'Các phương án' }).getByRole('button', { name: 'Xem' }).first().click();
    const preview = run.getByRole('region', { name: 'Xem phương án 1' });
    await preview.getByLabel('Lớp xem trước').selectOption({ label: className });
    const grid = preview.getByRole('table', { name: 'Lưới thời khoá biểu' });
    await expect(grid).toContainText('Tiếng Việt');
    await expect(grid).toContainText(nameA);
    await preview.getByLabel('Tên bản nháp phương án 1').fill(`TKB máy xếp ${suffix}`);
    await preview.getByLabel('Áp dụng từ phương án 1').fill(plusDays(today, 60));
    await preview.getByRole('button', { name: 'Tạo bản nháp từ phương án 1' }).click();
    await expect(toast(page, `Đã tạo bản nháp TKB máy xếp ${suffix}`)).toBeVisible();

    // 7.4: bản nháp do máy xếp tạo; chỉnh tay có kiểm tra ngay (cô A đã báo bận thứ Hai tiết 1)
    await openMenu(page, '/timetables');
    const row = page
      .getByRole('table', { name: 'Bản thời khoá biểu' })
      .getByRole('row', { name: new RegExp(`TKB máy xếp ${suffix}`) });
    await expect(row).toContainText('Máy xếp');
    await row.getByRole('button', { name: 'Mở' }).click();
    await page.getByLabel('Chọn lớp', { exact: true }).selectOption({ label: className });
    await page.getByLabel('Thứ Hai tiết 1', { exact: true }).selectOption({ label: 'Tiếng Việt' });
    await expect(page.getByRole('region', { name: 'Kiểm tra ngay' })).toContainText(
      `Cảnh báo: ${className}: Thứ 2 tiết 1 giáo viên ${nameA} đã báo bận`,
    );

    // Bản đang áp dụng của lớp (dữ liệu dựng sẵn): tiết 1, 3 Tiếng Việt của cô A, tiết 2 Toán của thầy B
    const version = await schoolYear
      .insertInto('timetable_versions')
      .values({
        school_level: 'TH',
        name: `TKB áp dụng ${suffix}`,
        effective_from: today,
        status: 'published',
        published_at: new Date(),
        published_by_name: 'Kiểm thử',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('timetable_lessons')
      .values(
        [
          [1, vietnamese, teacherA, nameA],
          [2, math, teacherB, nameB],
          [3, vietnamese, teacherA, nameA],
        ].map(([period, subject, teacher, name]) => ({
          version_id: version.id,
          class_id: classRow.id,
          weekday: isoWeekday(schoolDay),
          period_no: period as number,
          subject_id: (subject as { id: string }).id,
          teacher_user_id: (teacher as { id: string }).id,
          teacher_name: name as string,
        })),
      )
      .execute();

    // 7.6 Dạy thay, đổi tiết
    await openMenu(page, '/timetable-changes');
    const form = page.getByRole('region', { name: 'Ghi thay đổi' });
    await form.getByLabel('Ngày', { exact: true }).fill(schoolDay);
    await form.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await form.getByLabel('Tiết', { exact: true }).selectOption({ label: `Tiết 1: Tiếng Việt (${nameA})` });
    await form.getByLabel('Giáo viên dạy thay').selectOption({ label: nameB });
    await form.getByLabel('Lý do').fill('Cô A đi tập huấn');
    await form.getByRole('button', { name: 'Ghi thay đổi' }).click();
    await expect(toast(page, 'Đã ghi dạy thay')).toBeVisible();
    await form.getByLabel('Loại thay đổi').selectOption('swap');
    await form.getByLabel('Tiết', { exact: true }).selectOption({ label: `Tiết 2: Toán (${nameB})` });
    await form.getByLabel('Đổi với ngày').fill(schoolDay);
    await form.getByLabel('Đổi với tiết').selectOption({ label: `Tiết 3: Tiếng Việt (${nameA})` });
    await form.getByRole('button', { name: 'Ghi thay đổi' }).click();
    await expect(toast(page, 'Đã ghi đổi tiết')).toBeVisible();
    const changes = page.getByRole('table', { name: 'Danh sách thay đổi' });
    await expect(changes.getByRole('row', { name: new RegExp(className) })).toHaveCount(3);
    await expect(changes).toContainText(`Tiếng Việt · ${nameA}`);

    // 7.7 Báo cáo tiết dạy; mã QR tra cứu của lớp
    await openMenu(page, '/timetable-reports');
    await page.getByLabel('Từ ngày').fill(schoolDay);
    await page.getByLabel('Đến ngày').fill(schoolDay);
    const report = page.getByRole('table', { name: 'Báo cáo tiết dạy' });
    // Cô A: 2 tiết theo thời khoá biểu, 1 tiết được dạy thay, 1 tiết đổi chỗ, thực dạy 1
    await expect(report.getByRole('row', { name: new RegExp(nameA) })).toHaveText(
      new RegExp(`${nameA}\\s*2\\s*0\\s*1\\s*1\\s*1`),
    );
    await page.getByRole('tab', { name: 'Mã QR tra cứu' }).click();
    await page.getByLabel('Lớp của mã').selectOption({ label: className });
    await page.getByRole('button', { name: 'Tạo mã QR' }).click();
    await expect(toast(page, 'Đã tạo mã QR tra cứu')).toBeVisible();
    await expect(page.getByRole('img', { name: `Mã QR tra cứu thời khoá biểu ${className}` })).toBeVisible();
    const link = await page.getByRole('listitem').filter({ hasText: className }).getByRole('link').getAttribute('href');
    expect(link).toMatch(/\/tra-cuu-thoi-khoa-bieu\?ma=[A-Za-z0-9_-]{12}$/);

    // Trang tra cứu mở được khi chưa đăng nhập
    const publicPage = await (await browser.newContext()).newPage();
    await publicPage.goto(link ?? '');
    await expect(publicPage.getByRole('heading', { name: `Thời khoá biểu lớp ${className}` })).toBeVisible();
    await expect(publicPage.getByRole('table', { name: 'Thời khoá biểu tra cứu' })).toContainText('Tiếng Việt');
    await expect(publicPage.getByRole('region', { name: 'Thay đổi 7 ngày tới' })).toContainText(
      `tiết 1: dạy thay — Tiếng Việt (${nameB})`,
    );
  } finally {
    await setPrimaryEnabled(page, false);
  }
});
