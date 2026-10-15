import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures.js';
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

// Hoạt động của lớp (DT-10 phần 10e, YCTD-78; CT-069, CT-070): giáo viên tạo hoạt động gửi duyệt trên ứng dụng giáo viên;
// quản lý đơn vị duyệt trên cổng quản trị; phụ huynh của lớp thấy hoạt động đã công bố trên ứng dụng phụ huynh
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

test('Giáo viên tạo hoạt động; quản lý đơn vị duyệt; phụ huynh của lớp thấy hoạt động đã công bố', async ({
  browser,
}) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }] });
  await schoolYear
    .insertInto('activity_categories')
    .values({ org_unit_id: reference.org_unit_id, name: `Hoạt động sáng tạo ${suffix}`, created_by: manager.id })
    .execute();
  const className = `Lớp hoạt động ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `HD-${suffix}`,
      name: className,
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
      staff_name: 'Giáo viên hoạt động',
      assignment_role: 'homeroom',
      from_date: '2026-01-01',
    })
    .execute();
  const childName = `Bé Hoạt Động ${suffix}`;
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
      national_id_last4: '3434',
      photo_consent: 'granted',
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
    .values({ full_name: 'Phụ huynh hoạt động', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();
  const title = `Bé tập làm bánh ${suffix}`;

  const teacherPage = await (await browser.newContext()).newPage();
  await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherPage.getByRole('button', { name: `Hoạt động lớp ${className}` }).click();
  const form = teacherPage.getByRole('region', { name: 'Tạo hoạt động' });
  await form.getByLabel('Tiêu đề hoạt động').fill(title);
  await form.getByLabel('Nội dung hoạt động').fill('Các bé nhào bột và tạo hình bánh quy');
  await form.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(teacherPage.getByText('Đã gửi hoạt động chờ duyệt')).toBeVisible();
  await expect(teacherPage.getByRole('list', { name: 'Hoạt động của lớp' })).toContainText('Chờ duyệt');

  const parentPage = await (await browser.newContext()).newPage();
  await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
  await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
  await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
  const childCard = parentPage.getByRole('listitem', { name: childName });
  await childCard.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  const panel = childCard.getByRole('region', { name: `Hoạt động của ${childName}` });
  // CT-069: chưa duyệt thì phụ huynh chưa thấy
  await expect(panel).toContainText('Lớp chưa có hoạt động đã công bố');

  const managerPage = await (await browser.newContext()).newPage();
  await managerPage.goto('/');
  await managerPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
  await managerPage.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
  await managerPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(managerPage, '/activities');
  const article = managerPage.getByRole('article', { name: title });
  await expect(article).toContainText(className);
  await article.getByRole('button', { name: 'Duyệt và công bố' }).click();
  await expect(managerPage.getByText(`${title}: Đã công bố`)).toBeVisible();

  // CT-070: phụ huynh của lớp thấy hoạt động đã công bố
  await childCard.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await childCard.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await expect(panel.getByRole('listitem', { name: title })).toContainText('Các bé nhào bột');
});
