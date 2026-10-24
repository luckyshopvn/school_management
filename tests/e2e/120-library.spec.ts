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

// Thư viện trường học (DT-22 phần 22a, YCTD-181), kịch bản CT-22a-9: trường bật thêm Tiểu học; thủ thư (Hiệu trưởng) thêm ấn
// phẩm và hai bản sao, đồng bộ thẻ bạn đọc, cho học sinh mượn một bản rồi nhận trả; mở báo cáo, thiết lập; giáo viên thấy
// "Sách tôi đang mượn", phụ huynh con Tiểu học thấy "Sách thư viện". Dữ liệu giả
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
  await expect(page.getByRole('status').filter({ hasText: 'Đã ghi cấp học của trường' })).toBeVisible();
}

test('CT-22a-9: thêm ấn phẩm, bản sao; đồng bộ thẻ; mượn, trả; báo cáo; ứng dụng giáo viên, phụ huynh', async ({
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
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `07${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();

  await schoolYear
    .insertInto('grade_levels')
    .values({ code: 'K1', name: 'Khối 1', age_from_months: null, age_to_months: null, school_level: 'TH' })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `TV-${suffix}`,
      name: `Lớp 1T ${suffix}`,
      grade_level: 'K1',
      school_level: 'TH',
      max_size: 30,
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
    .values({ full_name: 'Phụ huynh thư viện', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học Sinh Thư Viện ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2019-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '7777',
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

  const portal = await (await browser.newContext()).newPage();
  await portal.goto('/');
  await portal.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await portal.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await portal.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(portal.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(portal, true);
  try {
    // Ấn phẩm và hai bản sao
    const titleName = `Sách thử thư viện ${suffix}`;
    await openMenu(portal, '/library/titles');
    await portal.getByRole('button', { name: 'Thêm ấn phẩm' }).first().click();
    await portal.getByLabel('Nhan đề', { exact: true }).fill(titleName);
    await portal.getByRole('button', { name: 'Thêm ấn phẩm' }).last().click();
    await expect(portal.getByRole('status').filter({ hasText: 'Đã thêm ấn phẩm' })).toBeVisible();
    await portal.getByLabel('Số bản thêm').fill('2');
    await portal.getByRole('button', { name: 'Thêm bản sao' }).click();
    await expect(portal.getByRole('status').filter({ hasText: 'Đã thêm 2 bản sao' })).toBeVisible();
    const titleRow = await schoolYear
      .selectFrom('library_titles')
      .select('id')
      .where('title', '=', titleName)
      .executeTakeFirstOrThrow();
    const copyRows = await schoolYear
      .selectFrom('library_copies')
      .select('copy_no')
      .where('title_id', '=', titleRow.id)
      .orderBy('copy_no')
      .execute();
    expect(copyRows).toHaveLength(2);
    const copyNo = copyRows[0]?.copy_no ?? '';

    // Đồng bộ thẻ bạn đọc
    await openMenu(portal, '/library/readers');
    await portal.getByRole('button', { name: 'Đồng bộ thẻ' }).click();
    await expect(portal.getByRole('status').filter({ hasText: 'Đã cấp thẻ cho' })).toBeVisible();
    await expect(portal.getByRole('table', { name: 'Danh sách bạn đọc' })).toContainText(childName);

    // Cho mượn rồi nhận trả
    await openMenu(portal, '/library/circulation');
    await portal.getByLabel('Bạn đọc (quét số thẻ hoặc gõ tên)').fill(childName);
    await portal.getByRole('button', { name: 'Tìm bạn đọc' }).click();
    await expect(portal.getByText(childName).first()).toBeVisible();
    await portal.getByLabel('Quét hoặc nhập mã bản sao rồi nhấn Enter').fill(copyNo);
    await portal.getByLabel('Quét hoặc nhập mã bản sao rồi nhấn Enter').press('Enter');
    await portal.getByRole('button', { name: /^Cho mượn \(1\)/ }).click();
    await expect(portal.getByRole('status').filter({ hasText: 'mượn 1 bản' })).toBeVisible();
    await portal.getByRole('tab', { name: 'Trả' }).click();
    await portal.getByLabel('Quét hoặc nhập mã bản sao rồi nhấn Enter').fill(copyNo);
    await portal.getByLabel('Quét hoặc nhập mã bản sao rồi nhấn Enter').press('Enter');
    await expect(portal.getByRole('status').filter({ hasText: `Đã nhận trả bản ${copyNo}` })).toBeVisible();

    // Báo cáo, thiết lập
    await openMenu(portal, '/library/reports');
    await expect(portal.getByRole('heading', { name: 'Báo cáo thư viện' })).toBeVisible();
    await openMenu(portal, '/library/settings');
    await expect(portal.getByRole('heading', { name: 'Quy định mượn và phân loại' })).toBeVisible();

    // Ứng dụng giáo viên: Sách tôi đang mượn
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await teacherPage.getByRole('button', { name: 'Sách tôi đang mượn' }).click();
    await expect(teacherPage.getByText('Bạn chưa có thẻ thư viện')).toBeVisible();

    // Ứng dụng phụ huynh: con Tiểu học có Sách thư viện
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Sách thư viện' }).click();
    await expect(card.getByRole('region', { name: `Sách thư viện của ${childName}` })).toContainText(
      'Con không đang mượn sách nào',
    );
  } finally {
    await setPrimaryEnabled(portal, false);
  }
});
