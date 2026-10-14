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

// Dặn thuốc (DT-10 phần 10b, YCTD-75): phụ huynh gửi yêu cầu dặn thuốc kèm ảnh thuốc trên ứng dụng phụ huynh; y tế nhận
// thuốc và ghi liều trên cổng quản trị; phụ huynh thấy liều đã cho uống
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('Phụ huynh gửi dặn thuốc kèm ảnh; y tế nhận thuốc và ghi liều; phụ huynh thấy liều đã cho uống', async ({
  browser,
}) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const nurse = await createTestUser(identity, { roles: [{ roleCode: 'VT-09', orgUnitId: reference.org_unit_id }] });
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `DT-${suffix}`,
      name: `Lớp dặn thuốc ${suffix}`,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Bé Dặn Thuốc ${suffix}`;
  const medicineName = `Siro ho ${suffix}`;
  const parentPhone = `07${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2022-06-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '3333',
      photo_consent: 'pending',
      status: 'active',
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
    .values({ full_name: 'Phụ huynh dặn thuốc', phone: parentPhone, user_id: parent.id })
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
  const childCard = parentPage.getByRole('listitem', { name: childName });
  await childCard.getByRole('button', { name: 'Dặn thuốc', exact: true }).click();
  const panel = childCard.getByRole('region', { name: `Dặn thuốc cho ${childName}` });
  await panel.getByLabel('Tên thuốc').fill(medicineName);
  await panel.getByLabel('Liều lượng').fill('5 ml');
  await panel.getByLabel('Giờ cho uống').fill('08:00');
  await panel.getByLabel('Tình trạng dị ứng').fill('Không dị ứng');
  await panel.getByLabel('Ảnh thuốc', { exact: true }).setInputFiles({
    name: 'anh-thuoc.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await panel.getByRole('button', { name: 'Gửi dặn thuốc' }).click();
  await expect(panel.getByText('Đã gửi yêu cầu dặn thuốc, chờ nhà trường nhận thuốc')).toBeVisible();
  await expect(panel.getByRole('article', { name: `Thuốc ${medicineName}` })).toContainText('Chờ nhận thuốc');

  const nursePage = await (await browser.newContext()).newPage();
  await nursePage.goto('/');
  await nursePage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(nurse.username);
  await nursePage.getByLabel('Mật khẩu', { exact: true }).fill(nurse.password);
  await nursePage.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(nursePage, '/medicines');
  const requestRow = nursePage.getByRole('row').filter({ hasText: medicineName });
  await expect(requestRow).toContainText(childName);
  await requestRow.getByRole('button', { name: 'Nhận thuốc' }).click();
  await expect(nursePage.getByText('Đã nhận thuốc, thuốc vào danh sách cần cho uống')).toBeVisible();
  await nursePage.getByRole('tab', { name: 'Cho uống hôm nay' }).click();
  const doseRow = nursePage.getByRole('row').filter({ hasText: medicineName });
  await doseRow.getByRole('button', { name: 'Đã cho uống' }).click();
  await expect(doseRow).toContainText('Đã cho uống lúc');

  await childCard.getByRole('button', { name: 'Dặn thuốc', exact: true }).click();
  await childCard.getByRole('button', { name: 'Dặn thuốc', exact: true }).click();
  const request = panel.getByRole('article', { name: `Thuốc ${medicineName}` });
  // Một liều duy nhất trong lịch đã ghi nên yêu cầu tự hoàn thành
  await expect(request).toContainText('Hoàn thành');
  await expect(request).toContainText('08:00: Đã cho uống lúc');
});
