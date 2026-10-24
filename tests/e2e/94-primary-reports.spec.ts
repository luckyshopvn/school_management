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

// Báo cáo, thống kê, EMIS Tiểu học (DT-20 phần 20f, YCTD-165), kịch bản CT-20f-7: trường bật Tiểu học có một lớp khối 2 với
// hai học sinh (một nữ dân tộc thiểu số); Hiệu trưởng xem sĩ số theo khối, xuất Excel; biểu EMIS Tiểu học đầu năm tính số
// học sinh từ dữ liệu, nhập tay một dòng, sửa khung thêm một dòng công thức. Cuối kịch bản trả khung, tắt lại Tiểu học. Dữ
// liệu giả
// Kết nối tạo trong beforeAll để lần chạy lại (retry) trong cùng tiến trình không dùng kết nối đã đóng
let identity: ReturnType<typeof createDatabase<IdentityDatabase>>;
let system: ReturnType<typeof createDatabase<SystemDatabase>>;
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

test.beforeAll(async () => {
  identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
  system = createDatabase<SystemDatabase>(
    replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
  );
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
  await system.destroy();
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

test('CT-20f-7: sĩ số Tiểu học theo khối, xuất Excel; biểu EMIS Tiểu học tính từ dữ liệu, nhập tay, sửa khung', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  // Chỉ cần năm học đang mở (kịch bản 02) và Trường chính (kịch bản 03) để chạy riêng được
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const year = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  const reference = { org_unit_id: unit.id, academic_year_id: year.id };
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
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
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `2B-${suffix}`,
      name: `Lớp 2B ${suffix}`,
      grade_level: 'K2',
      school_level: 'TH',
      max_size: 35,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const [name, gender, profile] of [
    [`Học Sinh Một ${suffix}`, 'female', { ethnicity: 'Mường' }],
    [`Học Sinh Hai ${suffix}`, 'male', null],
  ] as const) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: '2018-06-01',
        gender,
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '2020',
        photo_consent: 'granted',
        status: 'active',
        moet_profile: profile ? JSON.stringify(profile) : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
      .execute();
  }
  // Số học sinh Tiểu học hiện có (các kịch bản trước có thể đã thêm lớp Tiểu học): toàn trường cho EMIS, của đơn vị cho sĩ số
  const countStudents = (orgUnitId: string | null) =>
    schoolYear
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('classes.school_level', '=', 'TH')
      .where('classes.status', '=', 'active')
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .$if(orgUnitId !== null, (query) => query.where('classes.org_unit_id', '=', orgUnitId ?? ''))
      .executeTakeFirstOrThrow();
  const primaryStudents = await countStudents(null);
  const unitStudents = await countStudents(reference.org_unit_id);

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(portal, true);
  const form = await system
    .selectFrom('report_forms')
    .select('id')
    .where('code', '=', 'emis-th-dau-nam')
    .executeTakeFirstOrThrow();
  const original = await system.selectFrom('report_form_rows').selectAll().where('form_id', '=', form.id).execute();
  try {
    await openMenu(portal, '/primary-reports');
    await portal.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    const enrollment = portal.getByRole('table', { name: 'Sĩ số theo khối' });
    await expect(enrollment.getByRole('row', { name: /^Khối 2/ })).toBeVisible();
    await expect(enrollment.getByRole('row', { name: /^Toàn trường/ })).toContainText(String(unitStudents.count));
    const download = portal.waitForEvent('download');
    await portal.getByRole('button', { name: 'Xuất Excel' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

    // EMIS Tiểu học đầu năm: dòng 201 tính từ dữ liệu, dòng 209 nhập tay
    await portal.getByRole('tab', { name: 'EMIS Tiểu học' }).click();
    await portal.getByRole('combobox', { name: /^Biểu/ }).selectOption('emis-th-dau-nam');
    const sheet = portal.getByRole('table', { name: 'Biểu EMIS Tiểu học đầu năm (khung)' });
    await expect(sheet.getByRole('row', { name: /^Tổng số học sinh/ })).toContainText(String(primaryStudents.count));
    await portal.getByLabel('Học sinh học tiếng dân tộc thiểu số Tổng số', { exact: true }).fill('1');
    await portal.getByRole('button', { name: 'Lưu số nhập tay' }).click();
    await expect(toast(portal, 'Đã lưu số nhập tay')).toBeVisible();

    // Sửa khung: thêm dòng công thức
    await portal.getByRole('button', { name: 'Sửa khung biểu' }).click();
    await portal.getByRole('button', { name: 'Thêm dòng' }).click();
    const last = original.length + 1;
    await portal.getByLabel(`Mã dòng ${last}`, { exact: true }).fill('299');
    await portal.getByLabel(`Chỉ tiêu dòng ${last}`, { exact: true }).fill(`Học sinh khối 2 (${suffix})`);
    await portal.getByLabel(`Công thức dòng ${last}`, { exact: true }).fill('students.grade=K2');
    await portal.getByRole('button', { name: 'Lưu khung biểu' }).click();
    await expect(toast(portal, 'Đã lưu khung biểu')).toBeVisible();
    await expect(sheet.getByRole('row', { name: new RegExp(`Học sinh khối 2 \\(${suffix}\\)`) })).toBeVisible();
  } finally {
    // Trả khung biểu như cũ cho các lần chạy sau
    await system.deleteFrom('report_form_rows').where('form_id', '=', form.id).execute();
    if (original.length > 0) {
      await system.insertInto('report_form_rows').values(original).execute();
    }
    await setPrimaryEnabled(portal, false);
  }
});
