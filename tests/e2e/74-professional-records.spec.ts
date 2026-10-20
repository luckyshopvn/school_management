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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e, YCTD-142), kịch bản CT-18e-10: Hiệu trưởng nạp danh mục thư mục mặc định
// Mầm non, mở đợt nộp có hạn; giáo viên thấy đợt ở Việc của tôi, nộp hồ sơ theo đợt; tổ trưởng thấy số việc trên menu, duyệt
// cấp tổ; Phó Hiệu trưởng duyệt cấp trường; Hiệu trưởng xem thống kê nộp đúng hạn. Chạy sau 02-academic-years và
// 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
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

test('CT-18e-10: nạp thư mục mặc định, mở đợt nộp; giáo viên nộp từ Việc của tôi; tổ trưởng, Ban Giám hiệu duyệt; thống kê', async ({
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
  const department = await schoolYear
    .insertInto('departments')
    .values({ org_unit_id: root.id, name: `Tổ chuyên môn E2E ${suffix}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const vice = await createTestUser(identity, { roles: [{ roleCode: 'VT-15', orgUnitId: root.id }] });
  const leader = await createTestUser(identity, { roles: [{ roleCode: 'VT-17', orgUnitId: root.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  const names = {
    principal: `Hiệu trưởng HSCM ${suffix}`,
    vice: `Phó hiệu trưởng HSCM ${suffix}`,
    leader: `Tổ trưởng HSCM ${suffix}`,
    teacher: `Giáo viên HSCM ${suffix}`,
  };
  for (const [index, [user, name, inDepartment]] of (
    [
      [principal, names.principal, false],
      [vice, names.vice, false],
      [leader, names.leader, true],
      [teacher, names.teacher, true],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `HSCM-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
        department_id: inDepartment ? department.id : null,
      })
      .execute();
  }
  const roundTitle = `Nộp hồ sơ bồi dưỡng E2E ${suffix}`;

  // Hiệu trưởng: 4.1 nạp danh mục mặc định Mầm non; 3.1 thêm đợt nộp theo cá nhân, hạn sau 7 ngày, đơn vị Trường chính
  const head = await signIn(browser, principal);
  await openMenu(head, '/professional-folders');
  await expect(head.getByRole('heading', { name: '4.1. Thư mục và luồng duyệt' })).toBeVisible();
  await head.getByLabel('Cấp học').selectOption('MN');
  await head.getByRole('button', { name: 'Nạp danh mục mặc định' }).click();
  await expect(head.getByText(/Đã thêm \d+ thư mục/)).toBeVisible();
  await expect(head.getByRole('cell', { name: 'Hồ sơ bồi dưỡng thường xuyên' })).toBeVisible();
  await openMenu(head, '/professional-rounds');
  await head.getByRole('button', { name: 'Thêm đợt nộp' }).click();
  const form = head.getByRole('form', { name: 'Thêm đợt nộp' });
  await form.getByLabel('Tên đợt').fill(roundTitle);
  await form.getByLabel('Thư mục').selectOption({ label: 'Hồ sơ bồi dưỡng thường xuyên' });
  await form.getByLabel('Đơn vị').selectOption(root.id);
  const due = VIETNAM_DATE.format(new Date(Date.now() + 7 * 86_400_000));
  await form.getByLabel('Hạn nộp').fill(`${due}T17:00`);
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(head.getByText(`Đã ghi đợt ${roundTitle}`)).toBeVisible();

  // Giáo viên: Việc của tôi ở đầu trang có đợt chưa nộp; mở đợt, tạo hồ sơ, tải tệp, nộp
  const staff = await signIn(browser, teacher);
  await staff.getByRole('link', { name: /^Việc của tôi/ }).click();
  await expect(staff.getByRole('heading', { name: '1. Việc của tôi' })).toBeVisible();
  await expect(staff.getByRole('cell', { name: roundTitle })).toBeVisible();
  await staff.getByRole('combobox', { name: /^Phân hệ/ }).selectOption('professional');
  await expect(staff.getByRole('cell', { name: 'Nộp hồ sơ theo đợt' }).first()).toBeVisible();
  await openMenu(staff, '/professional-rounds');
  await staff.getByRole('cell', { name: roundTitle }).click();
  await staff.getByRole('button', { name: 'Nộp hồ sơ cho đợt này' }).click();
  await expect(staff.getByText('Đã tạo hồ sơ của đợt; tải tệp rồi nộp')).toBeVisible();
  await staff.getByLabel(/^Tệp hồ sơ/).setInputFiles({ name: 'bdtx.pdf', mimeType: 'application/pdf', buffer: PDF });
  await staff.getByRole('button', { name: 'Tải phiên bản mới' }).click();
  await expect(staff.getByText('Đã tải phiên bản 1')).toBeVisible();
  await staff.getByRole('button', { name: 'Nộp hồ sơ' }).click();
  await expect(staff.getByText('Đã nộp hồ sơ')).toBeVisible();

  // Tổ trưởng: số việc trên nút Việc của tôi; 3.2 Duyệt hồ sơ, tổ trưởng duyệt
  const reviewer = await signIn(browser, leader);
  await expect(reviewer.getByRole('link', { name: /^Việc của tôi, \d+ việc đang chờ/ })).toBeVisible();
  await openMenu(reviewer, '/professional-records/review');
  await reviewer.getByRole('cell', { name: roundTitle }).first().click();
  await reviewer.getByRole('button', { name: 'Tổ trưởng duyệt' }).click();
  await reviewer.getByLabel('Ý kiến').fill('Đạt yêu cầu');
  await reviewer.getByRole('button', { name: 'Ghi' }).click();
  await expect(reviewer.getByText('Tổ trưởng đã duyệt')).toBeVisible();

  // Phó Hiệu trưởng: duyệt cấp trường
  const approver = await signIn(browser, vice);
  await openMenu(approver, '/professional-records/review');
  await approver.getByRole('cell', { name: roundTitle }).first().click();
  await approver.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await approver.getByRole('button', { name: 'Ghi' }).click();
  await expect(approver.getByText('Đã duyệt hồ sơ')).toBeVisible();

  // Hiệu trưởng: thống kê có đợt, giáo viên nộp đúng hạn
  await openMenu(head, '/professional-records/statistics');
  const statistics = head.getByRole('region', { name: 'Thống kê theo đợt nộp' });
  await expect(statistics.getByRole('row', { name: new RegExp(roundTitle) })).toBeVisible();
  await expect(head.getByTestId('professional-totals')).toContainText('đúng hạn');
  const saved = await schoolYear
    .selectFrom('professional_documents')
    .select(['status', 'submitted_late'])
    .where('title', '=', roundTitle)
    .executeTakeFirstOrThrow();
  expect(saved).toEqual({ status: 'approved', submitted_late: false });
});
