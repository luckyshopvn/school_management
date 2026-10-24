import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182), kịch bản CT-22e-7: Hiệu trưởng tạo khoá trường tổ chức có cấp chứng
// nhận; giáo viên đăng ký trên ứng dụng giáo viên; Hiệu trưởng duyệt, ghi kết quả đạt, cấp chứng nhận; trang tra cứu công
// khai đối chiếu mã; giáo viên tự đánh giá năng lực số, thấy gợi ý bồi dưỡng; Hiệu trưởng xem hồ sơ và bản đồ năng lực. Chạy
// sau 02-academic-years và 03-org-units. Dữ liệu giả
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

async function signIn(browser: Browser, user: { username: string; password: string }, url = '/'): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(url);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-22e-7: khoá bồi dưỡng, đăng ký trên ứng dụng, duyệt, kết quả, chứng nhận có mã tra cứu; năng lực số và gợi ý', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: root.id }] });
  const teacherName = `Giáo viên BD ${suffix}`;
  for (const [index, [user, name]] of (
    [
      [principal, `Hiệu trưởng BD ${suffix}`],
      [teacher, teacherName],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `BD-${suffix}-${index}`,
        full_name: name,
        // Bắt đầu từ hôm nay: nhân sự làm từ tháng trước thì bảng lương (spec 22, BR-43) đòi chốt công tháng trước của trường
        start_date: today,
        user_id: user.id,
      })
      .execute();
  }
  const courseName = `Bồi dưỡng E2E ${suffix}`;

  // Hiệu trưởng: 6.2 tạo khoá trường tổ chức, cấp chứng nhận
  const head = await signIn(browser, principal);
  await openMenu(head, '/training/courses');
  const form = head.getByRole('form', { name: 'Tạo khoá bồi dưỡng' });
  await form.getByLabel('Tên khoá', { exact: true }).fill(courseName);
  await form.getByLabel('Từ ngày', { exact: true }).fill(today);
  await form.getByLabel('Đến ngày', { exact: true }).fill(today);
  await form.getByLabel('Số tiết', { exact: true }).fill('8');
  await form.getByLabel('Trường cấp chứng nhận cho người đạt').check();
  await form.getByRole('button', { name: 'Tạo khoá' }).click();
  await expect(head.getByText(`Đã tạo khoá ${courseName}`)).toBeVisible();

  // Ứng dụng giáo viên: đăng ký
  const app = await signIn(browser, teacher, `http://localhost:${E2E_TEACHER_PORT}`);
  await app.getByRole('button', { name: 'Bồi dưỡng của tôi' }).click();
  await app.getByRole('button', { name: `Đăng ký ${courseName}` }).click();
  await expect(app.getByText(`Đã đăng ký khoá ${courseName}`)).toBeVisible();
  await expect(app.getByRole('region', { name: 'Khoá đã đăng ký' })).toContainText(`${courseName}: Chờ duyệt`);

  // Hiệu trưởng: duyệt, ghi kết quả đạt, cấp chứng nhận
  await head.reload();
  const courses = head.getByRole('table', { name: 'Khoá bồi dưỡng' });
  await courses
    .getByRole('row', { name: new RegExp(courseName) })
    .getByRole('button', { name: 'Mở' })
    .click();
  const registrations = head.getByRole('table', { name: 'Đăng ký khoá' });
  const row = registrations.getByRole('row', { name: new RegExp(teacherName) });
  await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(head.getByText('Đã duyệt đăng ký')).toBeVisible();
  await row.getByLabel(`Kết quả của ${teacherName}`).selectOption('passed');
  await head.getByRole('button', { name: 'Ghi kết quả' }).click();
  await expect(head.getByText('Đã ghi kết quả bồi dưỡng')).toBeVisible();
  await head.getByRole('button', { name: 'Cấp chứng nhận' }).click();
  await expect(head.getByText('Đã cấp 1 chứng nhận')).toBeVisible();
  const certificate = await schoolYear
    .selectFrom('staff_certificates')
    .innerJoin('training_courses', 'training_courses.id', 'staff_certificates.course_id')
    .select('staff_certificates.lookup_code')
    .where('training_courses.name', '=', courseName)
    .executeTakeFirstOrThrow();
  await expect(row).toContainText(certificate.lookup_code ?? '');

  // Trang tra cứu công khai, không cần đăng nhập
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/tra-cuu-chung-nhan?ma=${certificate.lookup_code}`);
  const result = visitor.getByRole('region', { name: 'Kết quả tra cứu' });
  await expect(result).toContainText('Chứng nhận còn hiệu lực');
  await expect(result).toContainText(teacherName);
  await expect(result).toContainText(courseName);

  // Giáo viên: 6.1 tự đánh giá năng lực số trên cổng quản trị, thấy gợi ý bồi dưỡng
  const staff = await signIn(browser, teacher);
  await openMenu(staff, '/training/mine');
  await expect(staff.getByText(/đã có 8\/\d+ tiết bồi dưỡng/)).toBeVisible();
  const competency = staff.getByRole('table', { name: 'Tự đánh giá năng lực số' });
  const selects = competency.getByRole('combobox');
  const count = await selects.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await selects.nth(index).selectOption(index === count - 1 ? '1' : '2');
  }
  await staff.getByRole('button', { name: 'Gửi tự đánh giá' }).click();
  await expect(staff.getByText('Đã gửi tự đánh giá năng lực số')).toBeVisible();
  await expect(staff.getByLabel('Gợi ý bồi dưỡng')).toContainText('Năng lực số:');

  // Hiệu trưởng: 6.3 hồ sơ bồi dưỡng, 6.4 bản đồ năng lực số
  await openMenu(head, '/training/records');
  await expect(
    head
      .getByRole('table', { name: 'Hồ sơ bồi dưỡng theo cá nhân' })
      .getByRole('row', { name: new RegExp(teacherName) }),
  ).toContainText('8');
  await openMenu(head, '/training/competency');
  await expect(head.getByRole('table', { name: 'Bản đồ năng lực số' })).toContainText(teacherName);
});
