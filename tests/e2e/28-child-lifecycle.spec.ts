import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
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

// Đồng ý hình ảnh trên ứng dụng phụ huynh và thôi học trên cổng quản trị (DT-09 phần 9b, YCTD-67)
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

test('Phụ huynh đồng ý sử dụng hình ảnh; quản lý đơn vị thấy lịch sử và ghi nhận thôi học', async ({ browser }) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `08${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `TH-${suffix}`,
      name: `Lớp thôi học ${suffix}`,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Bé Thôi Học ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2022-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '2222',
      photo_consent: 'pending',
      status: 'active',
      enroll_date: '2026-01-01',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
    .execute();
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh thôi học', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();

  const parentPage = await (await browser.newContext()).newPage();
  await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
  await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
  await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
  const card = parentPage.getByRole('listitem', { name: childName });
  await card.getByRole('button', { name: 'Hình ảnh' }).click();
  const consent = card.getByRole('region', { name: `Đồng ý hình ảnh của ${childName}` });
  await consent.getByRole('button', { name: 'Đồng ý sử dụng hình ảnh' }).click();
  await expect(consent.getByRole('button', { name: 'Rút đồng ý' })).toBeVisible();
  await expect(consent).toContainText('trên ứng dụng');

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(page, '/children');
  await page.getByLabel('Tìm theo họ tên').fill(childName);
  await page.getByRole('row').filter({ hasText: childName }).click();
  const detail = page.getByRole('region', { name: `Hồ sơ ${childName}` });
  await expect(detail.getByRole('region', { name: 'Đồng ý sử dụng hình ảnh' })).toContainText('trên ứng dụng');
  const withdraw = detail.getByRole('region', { name: 'Thôi học' });
  await withdraw.getByLabel('Lý do thôi học').fill('Gia đình chuyển trường');
  await withdraw.getByRole('button', { name: 'Ghi nhận thôi học' }).click();
  await page.getByRole('button', { name: 'Xác nhận thôi học' }).click();
  await expect(detail).toContainText('Thôi học');
  await expect(page.getByText(/Đã ghi nhận thôi học/)).toBeVisible();
});
