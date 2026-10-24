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

// Học bạ, khen thưởng, lên lớp (DT-20 phần 20e, YCTD-163), kịch bản CT-20e-7: lớp 5 có học sinh đã xác nhận Hoàn thành xuất
// sắc ở kỳ cuối năm đã khoá; Hiệu trưởng nạp danh hiệu mặc định, đề nghị và duyệt "Học sinh Xuất sắc" (giấy khen có mã tra
// cứu), ghi hoàn thành chương trình tiểu học, lập học bạ; phụ huynh thấy khen thưởng và kết quả. Cuối kịch bản tắt lại Tiểu
// học. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

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

test('CT-20e-7: khen thưởng có giấy khen, hoàn thành chương trình tiểu học, lập học bạ; phụ huynh xem', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `04${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values(
      [1, 2, 3, 4, 5].map((grade) => ({
        code: `K${grade}`,
        name: `Khối ${grade}`,
        order_no: 100 + grade,
        age_from_months: null,
        age_to_months: null,
        school_level: 'TH' as const,
      })),
    )
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  // Kỳ cuối năm của Tiểu học (cấu hình đánh giá 20c), khoá số liệu và kết quả cuối năm đã xác nhận nạp sẵn
  await schoolYear
    .insertInto('assessment_periods')
    .values({
      school_level: 'TH',
      code: 'CN',
      name: 'Cuối năm học',
      term_type: 'second_term',
      kind: 'end',
      is_year_end: true,
      order_no: 4,
    })
    .onConflict((conflict) => conflict.columns(['school_level', 'code']).doNothing())
    .execute();
  const period = await schoolYear
    .selectFrom('assessment_periods')
    .select('id')
    .where('school_level', '=', 'TH')
    .where('is_year_end', '=', true)
    .orderBy('order_no', 'desc')
    .executeTakeFirstOrThrow();
  const className = `Lớp 5E ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `5E-${suffix}`,
      name: className,
      grade_level: 'K5',
      school_level: 'TH',
      max_size: 35,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh lớp 5E', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Xuất Sắc ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2015-06-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '5555',
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
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();
  await schoolYear
    .insertInto('year_results')
    .values({
      class_id: classRow.id,
      child_id: child.id,
      suggested: 'excellent',
      result: 'excellent',
      confirmed_by: principal.id,
      confirmed_by_name: 'Giáo viên chủ nhiệm',
    })
    .execute();
  await schoolYear
    .insertInto('assessment_locks')
    .values({ period_id: period.id, class_id: classRow.id, locked_by: principal.id, locked_by_name: 'Hiệu trưởng' })
    .execute();

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(portal, true);
  try {
    await openMenu(portal, '/learning-records');
    await portal.getByRole('tab', { name: 'Danh hiệu' }).click();
    await portal.getByRole('button', { name: 'Nạp danh hiệu mặc định (Thông tư 27/2020)' }).click();
    await expect(toast(portal, /Đã nạp \d+ danh hiệu mặc định/)).toBeVisible();
    await expect(portal.getByRole('list', { name: 'Danh hiệu khen thưởng' })).toContainText('Học sinh Xuất sắc');

    // Khen thưởng: gợi ý Học sinh Xuất sắc, đề nghị rồi duyệt; giấy khen có mã tra cứu
    await portal.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await portal.getByRole('combobox', { name: 'Lớp' }).selectOption({ label: className });
    await portal.getByRole('tab', { name: 'Khen thưởng' }).click();
    await expect(portal.getByLabel(`Danh hiệu cho ${childName}`)).toHaveValue(/.+/);
    await portal.getByRole('button', { name: `Đề nghị khen thưởng ${childName}` }).click();
    await expect(toast(portal, 'Đã đề nghị khen thưởng')).toBeVisible();
    await portal.getByRole('button', { name: `Duyệt Học sinh Xuất sắc của ${childName}` }).click();
    await expect(toast(portal, 'Đã duyệt khen thưởng')).toBeVisible();
    await expect(portal.getByRole('button', { name: `Giấy khen Học sinh Xuất sắc của ${childName}` })).toBeVisible();

    // Hoàn thành chương trình tiểu học (khối cuối cấp)
    await portal.getByRole('tab', { name: 'Hoàn thành chương trình' }).click();
    await portal.getByRole('button', { name: 'Ghi kết quả hoàn thành chương trình' }).click();
    await expect(toast(portal, 'Đã ghi kết quả hoàn thành chương trình')).toBeVisible();
    await expect(portal.getByRole('region', { name: 'Hoàn thành chương trình' })).toContainText(
      'Hoàn thành chương trình cấp học',
    );

    // Học bạ: lập từ kết quả đã khoá
    await portal.getByRole('tab', { name: 'Học bạ' }).click();
    await portal.getByRole('button', { name: 'Lập học bạ' }).click();
    await expect(toast(portal, 'Đã lập 1 học bạ')).toBeVisible();
    await expect(portal.getByRole('region', { name: 'Học bạ của lớp' })).toContainText('Nháp');

    // Ứng dụng phụ huynh: khen thưởng đã duyệt, kết quả hoàn thành; học bạ chỉ hiện khi đã kí
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Học bạ', exact: true }).click();
    const panel = card.getByRole('region', { name: `Học bạ của ${childName}` });
    await expect(panel).toContainText('Hoàn thành chương trình cấp học');
    await expect(panel).toContainText('Chưa có học bạ đã được Hiệu trưởng kí');
    await expect(panel.getByRole('list', { name: `Khen thưởng của ${childName}` })).toContainText('Học sinh Xuất sắc');
  } finally {
    await setPrimaryEnabled(portal, false);
  }
});
