import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Trường liên cấp (DT-19 phần 19f, YCTD-156), kịch bản CT-19f-5: Hiệu trưởng bật Tiểu học, nạp khối Tiểu học, thêm cấp cho
// Phân hiệu A, mở lớp khối 1; chọn cấp đang làm việc ở thanh đầu trang; phụ huynh của Nguyễn Gia Bảo (Mầm non, kịch bản 09) có
// thêm con học lớp khối 1 thấy cả hai con. Cuối kịch bản tắt Tiểu học, xóa dữ liệu Tiểu học để trường trở lại chỉ có Mầm non.
// Chạy sau 09-children. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
const SIBLING_NAME = `Nguyễn Gia Huy ${suffix}`;
const CLASS_NAME = `Lớp 1B ${suffix}`;
const TEMPLATE_CODES = ['K1', 'K2', 'K3', 'K4', 'K5'];

async function signIn(browser: Browser): Promise<Page> {
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập', { exact: true }).fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

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

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  const sibling = await schoolYear.selectFrom('children').select('id').where('full_name', '=', SIBLING_NAME).execute();
  const siblingIds = sibling.map((row) => row.id);
  if (siblingIds.length > 0) {
    await schoolYear.deleteFrom('class_enrollments').where('child_id', 'in', siblingIds).execute();
    await schoolYear.deleteFrom('child_guardians').where('child_id', 'in', siblingIds).execute();
    await schoolYear.deleteFrom('children').where('id', 'in', siblingIds).execute();
  }
  await schoolYear.deleteFrom('classes').where('name', '=', CLASS_NAME).execute();
  await schoolYear.deleteFrom('grade_levels').where('code', 'in', TEMPLATE_CODES).execute();
  await schoolYear.deleteFrom('org_unit_levels').where('school_level', '!=', 'MN').execute();
  await schoolYear.destroy();
  await identity.destroy();
});

test('CT-19f-5: trường liên cấp: bật Tiểu học, mở lớp khối 1, chọn cấp đang làm việc, phụ huynh thấy hai con ở hai cấp', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const page = await signIn(browser);
  await setPrimaryEnabled(page, true);
  try {
    // Khối Tiểu học và cấp của Phân hiệu A
    await openMenu(page, '/rooms');
    await page.getByRole('tab', { name: 'Bậc học' }).click();
    const loader = page.getByRole('group', { name: 'Nạp khối mẫu theo cấp' });
    await loader.getByLabel('Cấp học của khối mẫu').selectOption({ label: 'Tiểu học' });
    await loader.getByRole('button', { name: 'Nạp khối mẫu' }).click();
    await expect(toast(page, 'khối mẫu Tiểu học')).toBeVisible();
    await openMenu(page, '/org-units');
    const levels = page.getByRole('region', { name: 'Cấp học của đơn vị' });
    const branch = levels.getByRole('row', { name: 'Cấp học của Phân hiệu A' });
    await branch.getByRole('checkbox', { name: 'Phân hiệu A: Tiểu học' }).check();
    await branch.getByRole('button', { name: 'Ghi' }).click();
    await expect(toast(page, 'Đã lưu cấp học của Phân hiệu A')).toBeVisible();

    // Lớp khối 1 của Phân hiệu A
    const branchId = (
      await schoolYear.selectFrom('org_units').select('id').where('name', '=', 'Phân hiệu A').executeTakeFirstOrThrow()
    ).id;
    await openMenu(page, '/classes');
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    const form = page.getByRole('form', { name: 'Thêm mới lớp học' });
    await form.getByLabel('Đơn vị').selectOption(branchId);
    await form.getByLabel('Mã lớp').fill(`1B${suffix}`);
    await form.getByLabel('Tên lớp').fill(CLASS_NAME);
    await form.getByLabel('Khối', { exact: true }).selectOption({ label: 'Khối 1' });
    await form.getByLabel('Sĩ số tối đa').fill('35');
    await form.getByRole('button', { name: 'Ghi' }).click();
    await expect(toast(page, `Đã tạo lớp ${CLASS_NAME}`)).toBeVisible();

    // Cấp đang làm việc: chọn Tiểu học thì ô ngữ cảnh chỉ còn Cấp TH
    const switcher = page.getByTestId('school-level-switcher');
    await switcher.selectOption('TH');
    await expect(page.getByTestId('academic-year-context')).toContainText('Cấp TH · ');
    await switcher.selectOption('all');

    // Phụ huynh của Nguyễn Gia Bảo có thêm con học lớp khối 1 (ghi thẳng hồ sơ đã duyệt như các kịch bản khác)
    const link = await schoolYear
      .selectFrom('children')
      .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select([
        'children.org_unit_id',
        'guardians.id as guardian_id',
        'guardians.user_id',
        'guardians.phone',
        'child_guardians.relationship_item_id',
      ])
      .where('children.full_name', '=', 'Nguyễn Gia Bảo')
      .where('guardians.user_id', 'is not', null)
      .executeTakeFirstOrThrow();
    const classId = (
      await schoolYear.selectFrom('classes').select('id').where('name', '=', CLASS_NAME).executeTakeFirstOrThrow()
    ).id;
    const sibling = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: branchId,
        full_name: SIBLING_NAME,
        dob: '2020-03-15',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '1986',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: sibling.id,
        guardian_id: link.guardian_id,
        relationship_item_id: link.relationship_item_id,
        is_primary: true,
      })
      .execute();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: sibling.id, class_id: classId, from_date: '2026-09-07' })
      .execute();
    const created = await schoolYear
      .selectFrom('classes')
      .select('school_level')
      .where('id', '=', classId)
      .executeTakeFirstOrThrow();
    expect(created.school_level).toBe('TH');

    await identity
      .updateTable('users')
      .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
      .where('id', '=', link.user_id ?? '')
      .execute();
    const parent = await (await browser.newContext()).newPage();
    await parent.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parent.getByLabel('Số điện thoại').fill(link.phone ?? '');
    await parent.getByLabel('Mật khẩu', { exact: true }).fill(TEST_PASSWORD);
    await parent.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(parent.getByRole('listitem', { name: 'Nguyễn Gia Bảo' })).toBeVisible();
    await expect(parent.getByRole('listitem', { name: SIBLING_NAME })).toBeVisible();
  } finally {
    await setPrimaryEnabled(page, false);
  }
});
