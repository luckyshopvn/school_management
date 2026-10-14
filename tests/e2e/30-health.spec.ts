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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Y tế học đường (DT-10 phần 10a, YCTD-74): giáo viên chủ nhiệm ghi chăm sóc và sự kiện y tế trên ứng dụng giáo viên;
// phụ huynh xem và xác nhận đã biết trên ứng dụng phụ huynh; y tế thấy trạng thái xác nhận trên cổng quản trị
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

test('Giáo viên ghi chăm sóc và sự kiện y tế; phụ huynh xác nhận đã biết; y tế thấy trạng thái', async ({
  browser,
}) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const nurse = await createTestUser(identity, { roles: [{ roleCode: 'VT-09', orgUnitId: reference.org_unit_id }] });
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `YT-${suffix}`,
      name: `Lớp y tế ${suffix}`,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: 'Giáo viên y tế',
      assignment_role: 'homeroom',
      from_date: '2026-01-01',
    })
    .execute();
  const childName = `Bé Sức Khỏe ${suffix}`;
  const parentPhone = `08${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
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
    .values({ full_name: 'Phụ huynh sức khỏe', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();

  const teacherPage = await (await browser.newContext()).newPage();
  await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherPage.getByRole('button', { name: `Chăm sóc lớp Lớp y tế ${suffix}` }).click();
  const card = teacherPage.getByRole('listitem', { name: `Chăm sóc ${childName}` });
  await card.getByLabel('Nhiệt độ').fill('37,9');
  await card.getByLabel('Tình trạng').fill('Hơi sốt');
  await card.getByRole('button', { name: 'Ghi chăm sóc' }).click();
  await expect(teacherPage.getByText(`Đã ghi chăm sóc cho ${childName}`)).toBeVisible();
  await card.getByRole('button', { name: 'Sự kiện y tế' }).click();
  await card.getByLabel('Triệu chứng').fill('Sốt nhẹ buổi trưa');
  await card.getByLabel('Đã xử lý').fill('Chườm mát');
  await card.getByRole('button', { name: 'Ghi sự kiện và báo phụ huynh' }).click();
  await expect(teacherPage.getByText(`Đã ghi sự kiện y tế của ${childName} và báo phụ huynh`)).toBeVisible();

  const parentPage = await (await browser.newContext()).newPage();
  await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
  await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
  await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
  const childCard = parentPage.getByRole('listitem', { name: childName });
  await childCard.getByRole('button', { name: 'Sức khỏe' }).click();
  const health = childCard.getByRole('region', { name: `Sức khỏe của ${childName}` });
  await expect(health).toContainText('37.9 độ');
  await expect(health).toContainText('Sốt nhẹ buổi trưa');
  await health.getByRole('button', { name: 'Đã biết' }).click();
  await expect(health).toContainText('Đã xác nhận đã biết');

  const nursePage = await (await browser.newContext()).newPage();
  await nursePage.goto('/');
  await nursePage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(nurse.username);
  await nursePage.getByLabel('Mật khẩu', { exact: true }).fill(nurse.password);
  await nursePage.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(nursePage, '/health');
  await nursePage.getByRole('tab', { name: 'Sự kiện y tế' }).click();
  const eventRow = nursePage.getByRole('row').filter({ hasText: childName });
  await expect(eventRow).toContainText('Sốt nhẹ buổi trưa');
  await expect(eventRow).toContainText('Đã biết lúc');
});
