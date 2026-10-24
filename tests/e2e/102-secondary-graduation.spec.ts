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

// Xét tốt nghiệp THCS (DT-21 phần 21f, YCTD-174), kịch bản CT-21f-6: trường bật THCS; lớp 9 có học sinh xếp loại cả năm Tốt,
// Tốt; Hiệu trưởng tạo kỳ xét, lập danh sách, xét kết quả, lập biên bản hội đồng, công nhận tốt nghiệp và xuất tệp. Cuối kịch
// bản tắt lại THCS. Dữ liệu giả
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

test('CT-21f-6: xét tốt nghiệp THCS, biên bản hội đồng, công nhận, tệp xuất', async ({ browser }) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  // Kỳ xét là duy nhất theo cấp và năm học: bỏ kỳ còn sót của lần chạy trước hoặc của spec khác
  await schoolYear.deleteFrom('graduation_sessions').where('school_level', '=', 'THCS').execute();
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
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `9G-${suffix}`,
      name: `Lớp 9G ${suffix}`,
      grade_level: 'K9',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Tốt Nghiệp ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2011-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '9393',
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
    .insertInto('term_ratings')
    .values({
      class_id: classRow.id,
      child_id: child.id,
      term_type: 'year',
      learning: 'good',
      conduct: 'good',
      updated_by: principal.id,
      updated_by_name: 'Hiệu trưởng thử',
    })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setSecondaryEnabled(page, true);
  try {
    await openMenu(page, '/graduation');
    await page.getByRole('textbox', { name: 'Tên kỳ' }).fill(`Xét tốt nghiệp THCS ${suffix}`);
    await page.getByRole('button', { name: 'Tạo kỳ' }).click();
    await expect(toast(page, /Đã tạo Xét tốt nghiệp THCS/)).toBeVisible();

    await page.getByRole('button', { name: 'Lập danh sách thí sinh' }).click();
    await expect(toast(page, /Đã lập danh sách/)).toBeVisible();
    const candidates = page.getByRole('table', { name: 'Danh sách thí sinh' });
    await expect(candidates).toContainText(childName);
    await expect(candidates).toContainText('Đủ điều kiện');

    await page.getByRole('tab', { name: 'Kết quả, công nhận' }).click();
    await page.getByRole('button', { name: 'Xét kết quả' }).click();
    await expect(toast(page, /Đã xét kết quả/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Kết quả xét tốt nghiệp' })).toContainText('(đề xuất)');

    // Chưa có biên bản hội đồng thì chưa công nhận được
    await page.getByRole('button', { name: 'Công nhận tốt nghiệp' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /biên bản/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Biên bản, tệp xuất' }).click();
    await page.getByRole('textbox', { name: 'Tiêu đề' }).fill('Biên bản họp hội đồng xét tốt nghiệp');
    await page
      .getByRole('textbox', { name: 'Nội dung biên bản' })
      .fill('Hội đồng thống nhất danh sách đề nghị công nhận.');
    await page.getByRole('button', { name: 'Lập biên bản' }).click();
    await expect(toast(page, 'Đã lập biên bản')).toBeVisible();

    await page.getByRole('tab', { name: 'Kết quả, công nhận' }).click();
    await page.getByRole('button', { name: 'Công nhận tốt nghiệp' }).click();
    await expect(toast(page, /Đã công nhận tốt nghiệp \d+ trên \d+/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Kết quả xét tốt nghiệp' })).toContainText('TN-THCS-');
    await expect(page.getByRole('button', { name: `Giấy chứng nhận ${childName}` })).toBeVisible();

    await page.getByRole('tab', { name: 'Biên bản, tệp xuất' }).click();
    await page
      .getByRole('button', { name: /^Xuất / })
      .first()
      .click();
    await expect(page.getByRole('list', { name: 'Tệp đã xuất' }).getByRole('listitem')).toHaveCount(1);
  } finally {
    await setSecondaryEnabled(page, false);
  }
});
