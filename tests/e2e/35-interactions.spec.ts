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

// Tương tác và đồ bị mất (DT-10 phần 10f, YCTD-79): phụ huynh báo mất đồ và nhắn giáo viên trên ứng dụng phụ huynh;
// giáo viên chủ nhiệm thấy phiếu và tin của lớp trên ứng dụng giáo viên, đánh dấu đã tìm thấy và trả lời; phụ huynh thấy
// kết quả và câu trả lời khi tải lại
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

test('Phụ huynh báo mất đồ và nhắn giáo viên; giáo viên thấy, đánh dấu tìm thấy và trả lời', async ({ browser }) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const className = `Lớp trao đổi ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `TD-${suffix}`,
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
      staff_name: 'Giáo viên trao đổi',
      assignment_role: 'homeroom',
      from_date: '2026-01-01',
    })
    .execute();
  const childName = `Bé Trao Đổi ${suffix}`;
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
    .values({ full_name: 'Phụ huynh trao đổi', phone: parentPhone, user_id: parent.id })
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
  await childCard.getByRole('button', { name: 'Trao đổi', exact: true }).click();
  const lost = childCard.getByRole('region', { name: 'Báo mất đồ' });
  await lost.getByLabel('Mô tả đồ bị mất').fill('Áo khoác xanh có thêu tên');
  await lost.getByRole('button', { name: 'Báo mất đồ' }).click();
  await expect(childCard.getByText('Đã báo mất đồ, giáo viên chủ nhiệm đã nhận thông báo')).toBeVisible();
  await expect(lost).toContainText('Áo khoác xanh có thêu tên · Đã báo');
  const chat = childCard.getByRole('region', { name: 'Nhắn giáo viên' });
  await chat.getByLabel('Tin nhắn cho giáo viên').fill('Cô ơi bé có mang áo khoác về không ạ?');
  await chat.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(chat).toContainText('Cô ơi bé có mang áo khoác về không ạ?');

  const teacherPage = await (await browser.newContext()).newPage();
  await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherPage.getByRole('button', { name: `Trao đổi lớp ${className}` }).click();
  const classItems = teacherPage.getByRole('region', { name: 'Đồ bị mất của lớp' });
  const item = classItems.getByRole('listitem').filter({ hasText: 'Áo khoác xanh có thêu tên' });
  await expect(item).toContainText(childName);
  await item.getByRole('button', { name: 'Đã tìm thấy', exact: true }).click();
  await expect(teacherPage.getByText('Đã đánh dấu tìm thấy')).toBeVisible();
  await teacherPage.getByRole('button', { name: new RegExp(`${childName}.*1 chưa đọc`) }).click();
  const messages = teacherPage.getByRole('region', { name: 'Tin nhắn' });
  await expect(messages).toContainText('Cô ơi bé có mang áo khoác về không ạ?');
  await messages.getByLabel('Trả lời').fill('Cô tìm thấy áo ở góc đồ chơi, chiều trả bé ạ');
  await messages.getByRole('button', { name: 'Gửi trả lời' }).click();
  await expect(messages).toContainText('Cô tìm thấy áo ở góc đồ chơi, chiều trả bé ạ');

  await chat.getByRole('button', { name: 'Tải lại' }).click();
  await expect(chat).toContainText('Cô tìm thấy áo ở góc đồ chơi, chiều trả bé ạ');
  await expect(lost).toContainText('Áo khoác xanh có thêu tên · Đã tìm thấy');
});
