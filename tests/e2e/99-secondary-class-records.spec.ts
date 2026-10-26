import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { openMenu, selectSchoolLevel } from './menu.js';

// Sổ đầu bài, điểm danh theo tiết THPT, sơ đồ chỗ ngồi, thi đua lớp và sao đỏ (DT-21 phần 21d, YCTD-171), kịch bản CT-21d-6:
// trường bật THPT, lớp có thời khoá biểu đã ban hành (tiết 1 cả lớp, tiết 2 nhóm Vật lí); Hiệu trưởng lập sơ đồ chỗ ngồi theo
// tên, đổi chỗ một học sinh, lưu, in; giáo viên Toán ký tiết phải xếp loại, tiết C phải nhận xét, thấy sơ đồ chỗ ngồi; giáo
// viên Vật lí chỉ điểm danh học sinh của nhóm; Hiệu trưởng xem sổ tuần có tiết nhóm, xuất Excel; thêm sao đỏ lớp khác, ghi
// điểm có sao đỏ báo, xếp hạng có điểm tiết. Cuối kịch bản gỡ bản thời khoá biểu thử, trả cấu hình nề nếp, tắt THPT. Dữ liệu
// giả
let identity: ReturnType<typeof createDatabase<IdentityDatabase>>;
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
let system: ReturnType<typeof createDatabase<SystemDatabase>>;

test.beforeAll(async () => {
  identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  system = createDatabase<SystemDatabase>(replaceDatabaseName(systemUrl, E2E_SYSTEM_DATABASE_NAME));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
  await identity.destroy();
});

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function setSecondaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const level = card.getByLabel('Bật cấp THPT', { exact: true });
  if (enabled) {
    await level.check();
  } else {
    await level.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

async function login(page: Page, user: { username: string; password: string }) {
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('CT-21d-6: sơ đồ chỗ ngồi; ký tiết theo quy tắc xếp loại THPT; tiết nhóm; sổ tuần, xuất Excel; sao đỏ, xếp hạng', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const unit = await schoolYear.selectFrom('org_units').select('id').orderBy('created_at').executeTakeFirstOrThrow();
  const openYear = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const [mathTeacher, physicsTeacher] = await Promise.all(
    [1, 2].map(() => createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: unit.id }] })),
  );
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K10',
      name: 'Khối 10',
      order_no: 110,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THPT',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const classNames = { a: `Lớp 10S ${suffix}`, b: `Lớp 10T ${suffix}` };
  const classIds: Record<'a' | 'b', string> = { a: '', b: '' };
  for (const key of ['a', 'b'] as const) {
    classIds[key] = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unit.id,
          academic_year_id: openYear.id,
          code: `10${key.toUpperCase()}-${suffix}`,
          name: classNames[key],
          grade_level: 'K10',
          school_level: 'THPT',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }
  const subject = async (code: string, name: string, optionGroup: 'natural_science' | 'social_science' | null) =>
    (
      await schoolYear
        .insertInto('subjects')
        .values({
          code: `E99-${code}-${suffix}`,
          name,
          school_level: 'THPT',
          assessment: 'score',
          option_group: optionGroup,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  const mathName = `Toán ${suffix}`;
  const physicsName = `Vật lí ${suffix}`;
  const math = await subject('TOAN', mathName, null);
  const physics = await subject('VL', physicsName, 'natural_science');
  const geography = await subject('DL', `Địa lí ${suffix}`, 'social_science');
  for (const [teacher, subjectId, subjectName] of [
    [mathTeacher, math, mathName],
    [physicsTeacher, physics, physicsName],
  ] as const) {
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classIds.a,
        staff_user_id: teacher?.id ?? '',
        staff_name: `Giáo viên ${subjectName}`,
        assignment_role: 'subject',
        subject_name: subjectName,
        subject_id: subjectId,
        from_date: '2026-01-01',
      })
      .execute();
  }
  // Tổ hợp khoa học tự nhiên (Vật lí), khoa học xã hội (Địa lí)
  const combination = async (code: string, subjectId: string) => {
    const row = await schoolYear
      .insertInto('subject_combinations')
      .values({ code: `E99-${code}-${suffix}`, name: `Tổ hợp ${code}`, school_level: 'THPT' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('subject_combination_subjects')
      .values({ combination_id: row.id, subject_id: subjectId })
      .execute();
    return row.id;
  };
  const natural = await combination('TN', physics);
  const social = await combination('XH', geography);
  const names = {
    plain: `Học Sinh Không Tổ Hợp ${suffix}`,
    natural: `Học Sinh Tự Nhiên ${suffix}`,
    social: `Học Sinh Xã Hội ${suffix}`,
    redStar: `Học Sinh Sao Đỏ ${suffix}`,
  };
  const childIds: Record<keyof typeof names, string> = { plain: '', natural: '', social: '', redStar: '' };
  for (const key of Object.keys(names) as Array<keyof typeof names>) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unit.id,
        full_name: names[key],
        dob: '2010-06-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '9999',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childIds[key] = child.id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: key === 'redStar' ? classIds.b : classIds.a, from_date: '2026-01-01' })
      .execute();
  }
  await schoolYear
    .insertInto('child_subject_combinations')
    .values([
      { child_id: childIds.natural, combination_id: natural, status: 'approved' },
      { child_id: childIds.social, combination_id: social, status: 'approved' },
    ])
    .execute();
  // Bản thời khoá biểu thử đã ban hành, áp dụng từ hôm nay: tiết 1 Toán cả lớp, tiết 2 nhóm 1 Vật lí, mọi ngày trong tuần
  const version = await schoolYear
    .insertInto('timetable_versions')
    .values({
      school_level: 'THPT',
      name: `TKB sổ đầu bài THPT ${suffix}`,
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
      [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => [
        {
          version_id: version.id,
          class_id: classIds.a,
          weekday,
          period_no: 1,
          subject_id: math,
          teacher_user_id: mathTeacher?.id ?? '',
          teacher_name: `Giáo viên ${mathName}`,
          room_id: null,
        },
        {
          version_id: version.id,
          class_id: classIds.a,
          weekday,
          period_no: 2,
          group_no: 1,
          subject_id: physics,
          teacher_user_id: physicsTeacher?.id ?? '',
          teacher_name: `Giáo viên ${physicsName}`,
          room_id: null,
        },
      ]),
    )
    .execute();
  const conductBefore = await schoolYear.selectFrom('conduct_settings').selectAll().executeTakeFirst();
  await schoolYear.updateTable('conduct_settings').set({ enabled: true }).execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await login(page, principal);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setSecondaryEnabled(page, true);
  try {
    await selectSchoolLevel(page, 'THPT');

    // 7.16 Sơ đồ chỗ ngồi: lập theo tên (2 dãy, 2 bàn, 2 chỗ), chuyển một học sinh xuống bàn 2 dãy 2, lưu, in
    await openMenu(page, '/seating-charts');
    await page.getByLabel('Lớp', { exact: true }).selectOption({ label: classNames.a });
    const create = page.getByRole('region', { name: 'Lập sơ đồ mới' });
    await create.getByLabel('Số dãy', { exact: true }).fill('2');
    await create.getByLabel('Số bàn mỗi dãy', { exact: true }).fill('2');
    await create.getByLabel('Số chỗ mỗi bàn', { exact: true }).fill('2');
    await create.getByRole('button', { name: 'Lập sơ đồ' }).click();
    await expect(toast(page, 'Đã lập sơ đồ chỗ ngồi')).toBeVisible();
    const grid = page.getByRole('group', { name: 'Sơ đồ chỗ ngồi' });
    await grid.getByRole('button', { name: `Dãy 1 bàn 1 chỗ 1: ${names.plain}` }).click();
    await grid.getByRole('button', { name: 'Dãy 2 bàn 2 chỗ 2: trống' }).click();
    await expect(grid.getByRole('button', { name: `Dãy 2 bàn 2 chỗ 2: ${names.plain}` })).toBeVisible();
    await page.getByRole('button', { name: 'Lưu sơ đồ' }).click();
    await expect(toast(page, 'Đã lưu sơ đồ chỗ ngồi')).toBeVisible();
    const seat = await schoolYear
      .selectFrom('seating_assignments')
      .select(['column_no', 'row_no', 'seat_no'])
      .where('child_id', '=', childIds.plain)
      .executeTakeFirstOrThrow();
    expect([seat.column_no, seat.row_no, seat.seat_no]).toEqual([2, 2, 2]);
    const printed = page.waitForEvent('download');
    await page.getByRole('button', { name: 'In sơ đồ' }).click();
    expect((await printed).suggestedFilename()).toMatch(/\.pdf$/);

    // Ứng dụng giáo viên, Toán: ký tiết phải xếp loại; tiết C phải nhận xét; thấy sơ đồ chỗ ngồi
    const mathPage = await (await browser.newContext()).newPage();
    await mathPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await login(mathPage, mathTeacher as { username: string; password: string });
    await mathPage.getByRole('button', { name: 'Sổ đầu bài' }).click();
    const mathLessons = mathPage.getByRole('list', { name: 'Tiết dạy trong ngày' });
    await mathLessons.getByRole('button', { name: `Tiết 1 ${classNames.a} · ${mathName} · Chưa ghi` }).click();
    const mathForm = mathPage.getByRole('region', { name: 'Ghi tiết dạy' });
    await expect(mathForm.getByText('Sơ đồ chỗ ngồi')).toBeVisible();
    await mathForm.getByLabel('Tên bài', { exact: true }).fill(`Bài Toán ${suffix}`);
    await mathForm.getByRole('button', { name: 'Ký sổ' }).click();
    await expect(mathForm.getByText('Cần xếp loại tiết trước khi ký sổ')).toBeVisible();
    await mathForm.getByLabel('Xếp loại tiết', { exact: true }).selectOption('C');
    await expect(mathForm.getByText('Tiết xếp loại C cần ghi nhận xét tiết.')).toBeVisible();
    await mathForm.getByLabel('Nhận xét tiết', { exact: true }).fill('Lớp mất trật tự');
    await mathForm.getByLabel(`Điểm danh ${names.social}`, { exact: true }).selectOption({ label: 'Vắng không phép' });
    await mathForm.getByRole('button', { name: 'Ký sổ' }).click();
    await expect(mathPage.getByText('Đã ghi và ký sổ tiết dạy')).toBeVisible();

    // Ứng dụng giáo viên, Vật lí: tiết nhóm 1 chỉ có học sinh tổ hợp tự nhiên
    const physicsPage = await (await browser.newContext()).newPage();
    await physicsPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await login(physicsPage, physicsTeacher as { username: string; password: string });
    await physicsPage.getByRole('button', { name: 'Sổ đầu bài' }).click();
    await physicsPage
      .getByRole('list', { name: 'Tiết dạy trong ngày' })
      .getByRole('button', { name: `Tiết 2 ${classNames.a} · ${physicsName} · Nhóm 1 · Chưa ghi` })
      .click();
    const physicsForm = physicsPage.getByRole('region', { name: 'Ghi tiết dạy' });
    const roll = physicsForm.getByRole('list', { name: 'Điểm danh học sinh' });
    await expect(roll).toContainText(names.natural);
    await expect(roll).not.toContainText(names.social);
    await expect(roll).not.toContainText(names.plain);
    await physicsForm.getByLabel('Tên bài', { exact: true }).fill(`Bài Vật lí ${suffix}`);
    await physicsForm.getByRole('button', { name: 'Lưu tiết' }).click();
    await expect(physicsPage.getByText('Đã lưu tiết dạy')).toBeVisible();

    // 7.6 Sổ đầu bài: sổ tuần có tiết nhóm, xuất Excel
    await openMenu(page, '/class-logs');
    await page.getByLabel('Lớp', { exact: true }).selectOption({ label: classNames.a });
    const week = page.getByRole('table', { name: 'Các tiết trong tuần' });
    await expect(week.getByRole('row', { name: new RegExp(`Bài Toán ${suffix}`) })).toContainText('Đã ký');
    await expect(week.getByRole('row', { name: new RegExp(`Bài Vật lí ${suffix}`) })).toContainText('Nhóm 1');
    const exported = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất Excel' }).click();
    expect((await exported).suggestedFilename()).toMatch(/^so-dau-bai-.*\.xlsx$/);

    // 4.9 Nề nếp, thi đua lớp THPT: nạp tiêu chí, thêm sao đỏ lớp 10T, ghi điểm lớp 10S có sao đỏ báo, xếp hạng có điểm tiết
    await openMenu(page, '/conduct');
    await page.getByLabel('Đơn vị', { exact: true }).selectOption(unit.id);
    const levelSelect = page.getByRole('combobox', { name: /^Cấp học/ });
    if (await levelSelect.isVisible()) {
      await levelSelect.selectOption('THPT');
    }
    await page.getByRole('tab', { name: 'Tiêu chí' }).click();
    await page.getByRole('button', { name: 'Nạp bộ tiêu chí mặc định' }).click();
    await expect(toast(page, /^Đã nạp \d+ tiêu chí mặc định/)).toBeVisible();
    await page.getByRole('tab', { name: 'Đội sao đỏ' }).click();
    await page.getByRole('combobox', { name: /^Lớp của học sinh/ }).selectOption({ label: classNames.b });
    await page.getByRole('combobox', { name: /^Học sinh/ }).selectOption({ label: names.redStar });
    await page.getByLabel('Nhiệm vụ', { exact: true }).fill('Theo dõi khối 10');
    await page.getByRole('button', { name: 'Thêm vào đội sao đỏ' }).click();
    await expect(toast(page, 'Đã cập nhật đội sao đỏ')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Đội sao đỏ' })).toContainText(names.redStar);
    await page.getByRole('tab', { name: 'Ghi điểm' }).click();
    await page.getByRole('combobox', { name: /^Lớp/ }).selectOption({ label: classNames.a });
    await page.getByLabel('Ngày', { exact: true }).fill(today);
    await page.getByRole('combobox', { name: /^Tiêu chí/ }).selectOption({ label: 'Đi học muộn (-1)' });
    await page
      .getByRole('combobox', { name: /^Sao đỏ báo/ })
      .selectOption({ label: `${names.redStar} (${classNames.b})` });
    await page.getByRole('button', { name: 'Ghi điểm', exact: true }).click();
    await expect(toast(page, 'Đã ghi điểm nề nếp')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Điểm nề nếp trong tuần' })).toContainText(`Sao đỏ ${names.redStar}`);
    await page.getByRole('tab', { name: 'Xếp hạng' }).click();
    await page.getByLabel('Ngày trong kỳ').fill(today);
    // Tiết C trừ 2 điểm thi đua, đi muộn trừ 1: 100 - 2 - 1 = 97
    const row = page
      .getByRole('table', { name: 'Xếp hạng thi đua lớp' })
      .getByRole('row', { name: new RegExp(classNames.a) });
    await expect(row).toContainText('-2');
    await expect(row).toContainText('97');
  } finally {
    await schoolYear.deleteFrom('timetable_lessons').where('version_id', '=', version.id).execute();
    await schoolYear.deleteFrom('timetable_versions').where('id', '=', version.id).execute();
    if (conductBefore) {
      await schoolYear.updateTable('conduct_settings').set({ enabled: conductBefore.enabled }).execute();
    }
    await setSecondaryEnabled(page, false);
  }
});
