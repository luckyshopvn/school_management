import { expect, test, type Browser, type Page } from './fixtures.js';
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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147), kịch bản CT-22i-10: Hiệu trưởng nạp thư viện mẫu Mầm non; giáo viên lập kế
// hoạch tháng của nhóm lớp, nhập nội dung theo mục, trình duyệt; tổ trưởng thấy việc ở Việc của tôi, duyệt; Hiệu trưởng xem
// bảng tiến độ duyệt. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(readConnectionString('system'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-22i-10: nạp thư viện mẫu; giáo viên lập, nhập nội dung, trình kế hoạch tháng; tổ trưởng duyệt từ Việc của tôi; tiến độ duyệt', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const year = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  const department = await schoolYear
    .insertInto('departments')
    .values({ org_unit_id: root.id, name: `Tổ kế hoạch E2E ${suffix}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const className = `Lá KH ${suffix}`;
  const schoolClass = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: root.id,
      academic_year_id: year.id,
      code: `KH-${suffix}`,
      name: className,
      grade_level: 'LA',
      max_size: 25,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const leader = await createTestUser(identity, { roles: [{ roleCode: 'VT-17', orgUnitId: root.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  for (const [index, [user, name, inDepartment]] of (
    [
      [principal, `Hiệu trưởng KHGD ${suffix}`, false],
      [leader, `Tổ trưởng KHGD ${suffix}`, true],
      [teacher, `Giáo viên KHGD ${suffix}`, true],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `KHGD-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
        department_id: inDepartment ? department.id : null,
      })
      .execute();
  }
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: schoolClass.id,
      staff_user_id: teacher.id,
      staff_name: `Giáo viên KHGD ${suffix}`,
      assignment_role: 'homeroom',
      from_date: '2025-08-01',
    })
    .execute();
  const title = `Kế hoạch tháng E2E ${suffix}`;

  // Hiệu trưởng: 5.6 nạp mẫu mặc định Mầm non
  const head = await signIn(browser, principal);
  await openMenu(head, '/education-plan-templates');
  await expect(head.getByRole('heading', { name: '5.6. Thư viện mẫu kế hoạch' })).toBeVisible();
  await head.getByLabel('Cấp học').selectOption('MN');
  await head.getByRole('button', { name: 'Nạp mẫu mặc định' }).click();
  await expect(head.getByText(/Đã thêm \d+ mẫu/)).toBeVisible();
  await expect(head.getByRole('cell', { name: 'Kế hoạch giáo dục tuần của nhóm, lớp' })).toBeVisible();

  // Giáo viên: 5.1 lập kế hoạch tháng cho nhóm lớp, nhập nội dung, trình duyệt
  const staff = await signIn(browser, teacher);
  await openMenu(staff, '/education-plans');
  await staff.getByRole('button', { name: 'Lập kế hoạch' }).click();
  const form = staff.getByRole('form', { name: 'Lập kế hoạch giáo dục' });
  await form.getByLabel('Mẫu kế hoạch').selectOption({ label: 'Kế hoạch giáo dục tháng (chủ đề) của nhóm, lớp' });
  await form.getByLabel('Nhóm, lớp').selectOption({ label: className });
  await form.getByLabel('Tên kế hoạch').fill(title);
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(staff.getByText(`Đã tạo kế hoạch ${title}; nhập nội dung rồi trình duyệt`)).toBeVisible();
  const editor = staff.getByRole('form', { name: 'Nội dung kế hoạch' });
  await editor.getByLabel('I. Chủ đề, thời gian thực hiện').fill('Chủ đề Gia đình, 4 tuần');
  await editor.getByRole('button', { name: 'Thêm dòng vào II. Mục tiêu, nội dung, hoạt động' }).click();
  await editor.getByLabel('II. Mục tiêu, nội dung, hoạt động, dòng 1, Lĩnh vực').fill('Phát triển ngôn ngữ');
  await editor.getByLabel('II. Mục tiêu, nội dung, hoạt động, dòng 1, Mục tiêu').fill('Trẻ kể về gia đình');
  await editor.getByRole('button', { name: 'Ghi nội dung' }).click();
  await expect(staff.getByText('Đã ghi nội dung kế hoạch')).toBeVisible();
  await staff.getByRole('button', { name: 'Trình duyệt' }).click();
  await staff.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(staff.getByText('Đã trình duyệt kế hoạch')).toBeVisible();

  // Tổ trưởng: Việc của tôi có kế hoạch chờ duyệt; 5.4 Duyệt kế hoạch
  const reviewer = await signIn(browser, leader);
  await reviewer.getByRole('link', { name: /^Việc của tôi/ }).click();
  await expect(reviewer.getByRole('cell', { name: title })).toBeVisible();
  await openMenu(reviewer, '/education-plans/review');
  await reviewer.getByRole('cell', { name: title }).first().click();
  await expect(reviewer.getByText('Trẻ kể về gia đình')).toBeVisible();
  await reviewer.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await reviewer.getByLabel('Ý kiến').fill('Đạt yêu cầu');
  await reviewer.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(reviewer.getByText('Đã duyệt xong kế hoạch')).toBeVisible();

  // Hiệu trưởng: 5.5 tiến độ duyệt có kế hoạch đã duyệt
  await openMenu(head, '/education-plans/progress');
  await expect(head.getByTestId('education-plan-totals')).toContainText('đã duyệt');
  await expect(
    head
      .getByRole('region', { name: 'Tiến độ theo mẫu kế hoạch' })
      .getByRole('row', { name: /Kế hoạch giáo dục tháng \(chủ đề\) của nhóm, lớp/ }),
  ).toBeVisible();
  const saved = await schoolYear
    .selectFrom('education_plans')
    .select(['status', 'version_no'])
    .where('title', '=', title)
    .executeTakeFirstOrThrow();
  expect(saved).toEqual({ status: 'approved', version_no: 1 });
});
