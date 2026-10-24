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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Học bạ, khen thưởng, lên lớp THCS (DT-21 phần 21e, YCTD-172), kịch bản CT-21e-6: trường bật THCS; điểm lớp 9 đã khoá, xếp
// loại cả năm đã xác nhận; Hiệu trưởng nạp danh hiệu (Thông tư 22/2021), đề nghị và duyệt học sinh Xuất sắc, ghi kết quả hoàn
// thành chương trình cấp học, lập học bạ. Cuối kịch bản tắt lại THCS. Dữ liệu giả
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

async function setSecondaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const level = card.getByLabel('Bật cấp THCS', { exact: true });
  if (enabled) {
    await level.check();
  } else {
    await level.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-21e-6: khen thưởng, hoàn thành chương trình cấp học, lập học bạ THCS', async ({ browser }) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await schoolYear
    .insertInto('grade_levels')
    .values(
      [6, 7, 8, 9].map((grade) => ({
        code: `K${grade}`,
        name: `Khối ${grade}`,
        order_no: 100 + grade,
        age_from_months: null,
        age_to_months: null,
        school_level: 'THCS' as const,
      })),
    )
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const className = `Lớp 9C ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `9C-${suffix}`,
      name: className,
      grade_level: 'K9',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Học Bạ ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2011-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '9292',
      photo_consent: 'granted',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setSecondaryEnabled(page, true);
  try {
    await openMenu(page, '/subjects');
    await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
    await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();

    // Điểm đã nhập và khoá: mọi môn của khối 9 có điểm 9,5 (môn nhận xét Đạt), xếp loại cả năm Tốt, Tốt
    const rows = await schoolYear
      .selectFrom('curriculum_subjects')
      .innerJoin('subjects', 'subjects.id', 'curriculum_subjects.subject_id')
      .select(['subjects.id', 'subjects.assessment'])
      .where('curriculum_subjects.grade_level_code', '=', 'K9')
      .where('curriculum_subjects.is_elective', '=', false)
      .where('subjects.school_level', '=', 'THCS')
      .execute();
    expect(rows.length).toBeGreaterThan(6);
    const author = { updated_by: principal.id, updated_by_name: 'Hiệu trưởng thử' };
    const common = { class_id: classRow.id, child_id: child.id };
    for (const term of ['first_term', 'second_term'] as const) {
      await schoolYear
        .insertInto('score_entries')
        .values(
          rows
            .filter((row) => row.assessment === 'score')
            .flatMap((row) =>
              (['regular', 'mid', 'final'] as const).map((kind) => ({
                ...common,
                subject_id: row.id,
                term_type: term,
                kind,
                seq: 1,
                score: 9.5,
                ...author,
              })),
            ),
        )
        .execute();
      await schoolYear
        .insertInto('subject_term_results')
        .values(
          rows
            .filter((row) => row.assessment === 'comment')
            .map((row) => ({ ...common, subject_id: row.id, term_type: term, result: 'pass' as const, ...author })),
        )
        .execute();
    }
    await schoolYear
      .insertInto('term_ratings')
      .values({ ...common, term_type: 'year', learning: 'good', conduct: 'good', ...author })
      .execute();
    await schoolYear
      .insertInto('score_locks')
      .values({
        class_id: classRow.id,
        term_type: 'second_term',
        locked_by: principal.id,
        locked_by_name: 'Hiệu trưởng thử',
      })
      .execute();

    await openMenu(page, '/learning-records');
    await page.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await page.getByRole('combobox', { name: 'Lớp' }).selectOption({ label: className });
    await page.getByRole('tab', { name: 'Danh hiệu' }).click();
    await page.getByRole('button', { name: 'Nạp danh hiệu mặc định (Thông tư 22/2021)' }).click();
    await expect(toast(page, /Đã nạp \d+ danh hiệu mặc định/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Danh hiệu khen thưởng' })).toContainText('Học sinh Giỏi');

    // Khen thưởng: gợi ý Học sinh Xuất sắc, đề nghị rồi duyệt
    await page.getByRole('tab', { name: 'Khen thưởng' }).click();
    await expect(page.getByLabel(`Danh hiệu cho ${childName}`)).toHaveValue(/.+/);
    await page.getByRole('button', { name: `Đề nghị khen thưởng ${childName}` }).click();
    await expect(toast(page, 'Đã đề nghị khen thưởng')).toBeVisible();
    await page.getByRole('button', { name: `Duyệt Học sinh Xuất sắc của ${childName}` }).click();
    await expect(toast(page, 'Đã duyệt khen thưởng')).toBeVisible();

    // Hoàn thành chương trình cấp học (khối cuối cấp THCS)
    await page.getByRole('tab', { name: 'Hoàn thành chương trình' }).click();
    await expect(page.getByRole('region', { name: 'Hoàn thành chương trình' })).toContainText(
      'Học tập: Tốt; rèn luyện: Tốt',
    );
    await page.getByRole('button', { name: 'Ghi kết quả hoàn thành chương trình' }).click();
    await expect(toast(page, 'Đã ghi kết quả hoàn thành chương trình')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Hoàn thành chương trình' })).toContainText(
      'Hoàn thành chương trình cấp học',
    );

    // Học bạ: lập từ sổ điểm đã khoá
    await page.getByRole('tab', { name: 'Học bạ' }).click();
    await page.getByRole('button', { name: 'Lập học bạ' }).click();
    await expect(toast(page, 'Đã lập 1 học bạ')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Học bạ của lớp' })).toContainText('Nháp');
  } finally {
    await setSecondaryEnabled(page, false);
  }
});
