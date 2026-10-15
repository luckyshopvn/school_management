import { randomUUID } from 'node:crypto';
import { expect, test, type Browser } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// DT-14 phần 14c (YCTD-102): hoàn thành chương trình giáo dục mầm non (quản lý đơn vị ghi cả lớp, phó hiệu trưởng xác
// nhận), nhóm học sinh (lập nhóm, thêm cả lớp), chuẩn nghề nghiệp (mở phiếu, giáo viên tự đánh giá, quản lý chốt phiếu)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
let unitId = '';
let classId = '';
const className = `Lá ${suffix}`;

async function signIn(browser: Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  const reference = await schoolYear
    .selectFrom('classes')
    .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
    .select(['classes.org_unit_id', 'classes.academic_year_id'])
    .where('org_units.unit_type', '!=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  unitId = reference.org_unit_id;
  const gradeCode = `LA${suffix}`;
  await schoolYear
    .insertInto('grade_levels')
    .values({ code: gradeCode, name: `Lá ${suffix}`, age_from_months: 60, age_to_months: 71 })
    .execute();
  classId = (
    await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: unitId,
        academic_year_id: reference.academic_year_id,
        code: `LA-${suffix}`,
        name: className,
        grade_level: gradeCode,
        max_size: 30,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  for (const name of [`Lê Minh An ${suffix}`, `Phạm Thu Bình ${suffix}`]) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: name,
        dob: '2020-05-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '4848',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classId, from_date: '2026-01-01' })
      .execute();
  }
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('Hoàn thành chương trình: quản lý đơn vị ghi cả lớp, phó hiệu trưởng xác nhận danh sách', async ({ browser }) => {
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: unitId }] });
  const vicePrincipal = await createTestUser(identity, { roles: [{ roleCode: 'VT-15', orgUnitId: unitId }] });
  const page = await signIn(browser, manager);
  await openMenu(page, '/program-completion');
  await page.getByRole('button', { name: `Mở lớp ${className}` }).click();
  const panel = page.getByRole('region', { name: `Danh sách lớp ${className}` });
  await panel.getByRole('button', { name: 'Đánh dấu cả lớp hoàn thành' }).click();
  await panel.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText('Đã lưu kết quả hoàn thành chương trình')).toBeVisible();
  await expect(page.getByRole('row', { name: `Lớp ${className}` })).toContainText('100%');

  const approverPage = await signIn(browser, vicePrincipal);
  await openMenu(approverPage, '/program-completion');
  await approverPage.getByRole('button', { name: `Mở lớp ${className}` }).click();
  await approverPage.getByRole('button', { name: 'Xác nhận danh sách' }).click();
  await expect(approverPage.getByText('Đã xác nhận danh sách của lớp')).toBeVisible();
  await expect(approverPage.getByRole('row', { name: `Lớp ${className}` })).toContainText('Đã xác nhận');
});

test('Nhóm học sinh: quản lý đơn vị lập nhóm và thêm cả lớp vào nhóm', async ({ browser }) => {
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: unitId }] });
  const page = await signIn(browser, manager);
  await openMenu(page, '/child-groups');
  const form = page.getByRole('form', { name: 'Lập nhóm học sinh' });
  await form.getByLabel('Tên nhóm').fill(`Năng khiếu vẽ ${suffix}`);
  await form.getByRole('button', { name: 'Lập nhóm' }).click();
  const panel = page.getByRole('region', { name: `Nhóm Năng khiếu vẽ ${suffix}` });
  await panel.getByLabel('Chọn lớp để thêm trẻ').selectOption({ label: className });
  await panel.getByLabel('Chọn cả lớp').check();
  await panel.getByRole('button', { name: 'Thêm vào nhóm' }).click();
  await expect(page.getByText('Đã thêm trẻ vào nhóm')).toBeVisible();
  await expect(panel.getByRole('table', { name: 'Trẻ trong nhóm' }).getByRole('row')).toHaveCount(3);
});

test('Chuẩn nghề nghiệp: giáo viên tự đánh giá, quản lý đơn vị đánh giá và chốt phiếu', async ({ browser }) => {
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: unitId }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
  const teacherName = `Võ Thị Chuẩn ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unitId,
      code: `CN-${suffix}`,
      full_name: teacherName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();

  const managerPage = await signIn(browser, manager);
  await openMenu(managerPage, '/professional-standards');
  const open = managerPage.getByRole('region', { name: 'Mở phiếu đánh giá' });
  await open.getByLabel(teacherName).check();
  await open.getByRole('button', { name: 'Mở phiếu' }).click();
  await expect(managerPage.getByText('Đã mở 1 phiếu')).toBeVisible();

  const teacherPage = await signIn(browser, teacher);
  await openMenu(teacherPage, '/professional-standards');
  const own = teacherPage.getByRole('region', { name: 'Phiếu tự đánh giá của tôi' });
  await own.getByLabel('Mức cho mọi tiêu chí').selectOption({ label: 'Khá' });
  await own.getByRole('button', { name: 'Gửi tự đánh giá' }).click();
  await expect(own).toContainText('Chờ đánh giá');

  await managerPage.reload();
  await managerPage.getByRole('button', { name: `Đánh giá ${teacherName}` }).click();
  const assessment = managerPage.getByRole('region', { name: `Phiếu của ${teacherName}` });
  await assessment.getByLabel('Mức cho mọi tiêu chí').selectOption({ label: 'Tốt' });
  await assessment.getByRole('button', { name: 'Chốt phiếu' }).click();
  await expect(managerPage.getByText('Đã chốt phiếu: Tốt')).toBeVisible();
  await expect(managerPage.getByRole('row', { name: `Phiếu ${teacherName}` })).toContainText('Tốt');
});
