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

// Nhật ký của bé (DT-08 phần 8b, YCTD-65): giáo viên chủ nhiệm ghi và công bố trên ứng dụng giáo viên; phụ huynh xem
// trên ứng dụng phụ huynh
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('Giáo viên ghi và công bố nhật ký; phụ huynh xem nhật ký của con', async ({ browser }) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `NK-${suffix}`,
      name: `Lớp nhật ký ${suffix}`,
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
      staff_name: 'Giáo viên nhật ký',
      assignment_role: 'homeroom',
      from_date: '2026-01-01',
    })
    .execute();
  const childName = `Bé Nhật Ký ${suffix}`;
  const parentPhone = `09${String(suffix).padStart(8, '0')}`;
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
      national_id_last4: '1111',
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
    .values({ full_name: 'Phụ huynh nhật ký', phone: parentPhone, user_id: parent.id })
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
  await teacherPage.getByRole('button', { name: `Nhật ký lớp Lớp nhật ký ${suffix}` }).click();
  const section = teacherPage.getByRole('region', { name: `Nhật ký của ${childName}` });
  await section.getByLabel('Ăn').fill('Ăn hết suất cơm');
  await section.getByRole('button', { name: 'Lưu nhật ký' }).click();
  await expect(teacherPage.getByRole('region', { name: `Nhật ký của ${childName}` })).toContainText('Nháp');
  await teacherPage.getByRole('button', { name: 'Công bố nhật ký' }).click();
  await expect(teacherPage.getByText('Đã công bố nhật ký cho phụ huynh')).toBeVisible();

  const parentPage = await (await browser.newContext()).newPage();
  await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
  await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
  await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
  const card = parentPage.getByRole('listitem', { name: childName });
  await card.getByRole('button', { name: 'Nhật ký' }).click();
  await expect(card.getByRole('region', { name: `Nhật ký của ${childName}` })).toContainText('Ăn hết suất cơm');
  await expect(parentPage.getByRole('region', { name: 'Thông báo' })).toContainText('Nhật ký của bé');
  expect(vietnamToday).toMatch(/^\d{4}-/);
});
