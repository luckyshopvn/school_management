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
import { randomUUID } from 'node:crypto';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Sổ điểm THCS (DT-21 phần 21c, YCTD-170), kịch bản CT-21c-7: trường bật THCS; Hiệu trưởng nạp môn mẫu, nhập điểm Toán của
// một học sinh ở 7.14 Sổ điểm (điểm trung bình tính ngay), ghi, tải lại vẫn còn; khoá điểm học kỳ I rồi mở khoá kèm lý do.
// Cuối kịch bản tắt lại THCS để trường trở về chỉ có Mầm non. Dữ liệu giả
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

test('CT-21c-7: nhập điểm Toán, tính trung bình, khoá và mở khoá điểm', async ({ browser }) => {
  test.setTimeout(180_000);
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
  const className = `Lớp 6C ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `6C-${suffix}`,
      name: className,
      grade_level: 'K6',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Sổ Điểm ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '9191',
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

    // 7.14 Sổ điểm: nhập Toán
    await openMenu(page, '/scores');
    await page.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await page.getByLabel('Lớp THCS, THPT').selectOption({ label: className });
    await page.getByLabel('Môn', { exact: true }).selectOption({ label: 'Toán' });
    await page.getByLabel(`Điểm thường xuyên 1 ${childName}`).fill('8');
    await page.getByLabel(`Điểm thường xuyên 2 ${childName}`).fill('9');
    await page.getByLabel(`Giữa kỳ ${childName}`).fill('7');
    await page.getByLabel(`Cuối kỳ ${childName}`).fill('8');
    await expect(page.getByTestId(`average-${child.id}`)).toHaveText('7.9');
    await page.getByRole('button', { name: 'Ghi điểm' }).click();
    await expect(toast(page, 'Đã ghi điểm')).toBeVisible();
    await page.reload();
    await page.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await page.getByLabel('Lớp THCS, THPT').selectOption({ label: className });
    await page.getByLabel('Môn', { exact: true }).selectOption({ label: 'Toán' });
    await expect(page.getByLabel(`Cuối kỳ ${childName}`)).toHaveValue('8');
    await expect(page.getByTestId(`average-${child.id}`)).toHaveText('7.9');

    // Khoá điểm học kỳ I rồi mở khoá kèm lý do
    await page.getByRole('tab', { name: 'Khoá điểm' }).click();
    await page.getByRole('button', { name: 'Khoá điểm mọi lớp' }).click();
    await expect(toast(page, 'Đã khoá điểm')).toBeVisible();
    const locks = page.getByRole('table', { name: 'Trạng thái khoá điểm' });
    await expect(locks.getByRole('row', { name: new RegExp(className) })).toContainText('Đã khoá bởi');
    await page.getByLabel('Lý do mở khoá').fill('Nhập nhầm điểm');
    await locks
      .getByRole('row', { name: new RegExp(className) })
      .getByRole('button', { name: 'Mở khoá' })
      .click();
    await expect(toast(page, 'Đã mở khoá điểm')).toBeVisible();
    await expect(locks.getByRole('row', { name: new RegExp(className) })).toContainText('Chưa khoá');
  } finally {
    await setSecondaryEnabled(page, false);
  }
});
