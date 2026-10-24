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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Báo cáo, thống kê, EMIS THCS, THPT (DT-21 phần 21g, YCTD-175), kịch bản CT-21g-5: trường bật THPT, một lớp 10 có hai học
// sinh (một học sinh tổ hợp riêng của kịch bản, xếp loại học tập Tốt, Xuất sắc); Hiệu trưởng xem kết quả cuối năm theo lớp,
// xuất Excel; biểu EMIS THPT cuối năm nhập tay một dòng, sửa khung thêm dòng công thức theo tổ hợp. Cuối kịch bản trả khung,
// tắt THPT. Dữ liệu giả
let identity: ReturnType<typeof createDatabase<IdentityDatabase>>;
let system: ReturnType<typeof createDatabase<SystemDatabase>>;
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

test.beforeAll(async () => {
  identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
  const systemUrl = readConnectionString('system');
  system = createDatabase<SystemDatabase>(replaceDatabaseName(systemUrl, E2E_SYSTEM_DATABASE_NAME));
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
  await system.destroy();
});

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

test('CT-21g-5: kết quả cuối năm THPT theo lớp, xuất Excel; biểu EMIS THPT cuối năm nhập tay, sửa khung', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const unit = await schoolYear.selectFrom('org_units').select('id').orderBy('created_at').executeTakeFirstOrThrow();
  const openYear = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
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
  const className = `Lớp 10R ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: unit.id,
      academic_year_id: openYear.id,
      code: `10R-${suffix}`,
      name: className,
      grade_level: 'K10',
      school_level: 'THPT',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const combinationCode = `E103-${suffix}`;
  const combination = await schoolYear
    .insertInto('subject_combinations')
    .values({ code: combinationCode, name: `Tổ hợp ${suffix}`, school_level: 'THPT' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childIds: string[] = [];
  for (const [index, gender] of (['female', 'male'] as const).entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unit.id,
        full_name: `Học Sinh Báo Cáo ${index + 1} ${suffix}`,
        dob: '2010-06-01',
        gender,
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '1031',
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
    await schoolYear
      .insertInto('term_ratings')
      .values({
        class_id: classRow.id,
        child_id: child.id,
        term_type: 'year',
        learning: index === 0 ? 'good' : 'pass',
        conduct: 'good',
        updated_by: principal.id,
        updated_by_name: 'Hiệu trưởng thử',
      })
      .execute();
  }
  await schoolYear
    .insertInto('child_subject_combinations')
    .values({ child_id: childIds[0] ?? '', combination_id: combination.id, status: 'approved' })
    .execute();

  const form = await system
    .selectFrom('report_forms')
    .select('id')
    .where('code', '=', 'emis-thpt-cuoi-nam')
    .executeTakeFirstOrThrow();
  const original = await system.selectFrom('report_form_rows').selectAll().where('form_id', '=', form.id).execute();
  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setSecondaryEnabled(portal, true);
  try {
    await portal.getByTestId('school-level-switcher').selectOption('THPT');
    await openMenu(portal, '/secondary-reports');
    await portal.getByLabel('Đơn vị', { exact: true }).selectOption(unit.id);
    await expect(portal.getByRole('table', { name: 'Sĩ số theo khối' })).toContainText('Khối 10');

    // Kết quả cuối năm theo lớp: hai học sinh, một Tốt, một Đạt
    await portal.getByRole('tab', { name: 'Kết quả cuối năm' }).click();
    await portal.getByRole('combobox', { name: /^Gộp/ }).selectOption('class');
    const results = portal.getByRole('table', { name: 'Kết quả cuối năm' });
    await expect(results.getByRole('row', { name: new RegExp(className) })).toHaveText(
      new RegExp(`${className} \\(Khối 10\\)\\s*2\\s*1\\s*0\\s*1\\s*0\\s*2`),
    );
    const download = portal.waitForEvent('download');
    await portal.getByRole('button', { name: 'Xuất Excel' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

    // EMIS THPT cuối năm: nhập tay dòng 303, thêm dòng công thức theo tổ hợp của kịch bản
    await portal.getByRole('tab', { name: 'EMIS THCS, THPT' }).click();
    await portal.getByRole('combobox', { name: /^Biểu/ }).selectOption('emis-thpt-cuoi-nam');
    const sheet = portal.getByRole('table', { name: 'Biểu EMIS THPT cuối năm (khung)' });
    await expect(sheet.getByRole('row', { name: /^Học sinh Xuất sắc/ })).toBeVisible();
    await portal.getByLabel('Học sinh đạt giải học sinh giỏi cấp tỉnh trở lên Tổng số', { exact: true }).fill('3');
    await portal.getByRole('button', { name: 'Lưu số nhập tay' }).click();
    await expect(toast(portal, 'Đã lưu số nhập tay')).toBeVisible();
    await portal.getByRole('button', { name: 'Sửa khung biểu' }).click();
    await portal.getByRole('button', { name: 'Thêm dòng' }).click();
    const last = original.length + 1;
    await portal.getByLabel(`Mã dòng ${last}`, { exact: true }).fill('901');
    await portal.getByLabel(`Chỉ tiêu dòng ${last}`, { exact: true }).fill(`Học sinh tổ hợp ${suffix}`);
    await portal.getByLabel(`Công thức dòng ${last}`, { exact: true }).fill(`students.combination=${combinationCode}`);
    await portal.getByRole('button', { name: 'Lưu khung biểu' }).click();
    await expect(toast(portal, 'Đã lưu khung biểu')).toBeVisible();
    const added = sheet.getByRole('row', { name: new RegExp(`Học sinh tổ hợp ${suffix}`) });
    // Cột Tổng số, Nữ: học sinh tổ hợp của kịch bản là nữ
    await expect(added.getByRole('cell').nth(3)).toHaveText('1');
    await expect(added.getByRole('cell').nth(4)).toHaveText('1');
  } finally {
    await system.deleteFrom('report_form_rows').where('form_id', '=', form.id).execute();
    if (original.length > 0) {
      await system.insertInto('report_form_rows').values(original).execute();
    }
    await setSecondaryEnabled(portal, false);
  }
});
