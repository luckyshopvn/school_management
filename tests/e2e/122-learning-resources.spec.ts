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

// Kho học liệu số (DT-22 phần 22h1, YCTD-183), kịch bản CT-22h1-7: giáo viên thêm học liệu có giấy phép, tải tệp, gửi duyệt;
// tổ trưởng cùng tổ duyệt thì công bố; giáo viên khác tìm thấy, đưa vào bộ sưu tập, báo lỗi; Hiệu trưởng (thủ kho) xử lý báo
// lỗi, xem thống kê. Chạy sau 02-academic-years và 03-org-units. Nhân sự thử bắt đầu từ hôm nay để không ảnh hưởng chốt công
// tháng trước của bảng lương (spec 22). Dữ liệu giả
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

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-22h1-7: thêm học liệu có giấy phép, tải tệp, tổ trưởng duyệt, tìm, bộ sưu tập, báo lỗi, thủ kho xử lý, thống kê', async ({
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
  const department = await schoolYear
    .insertInto('departments')
    .values({ org_unit_id: root.id, name: `Tổ học liệu ${suffix}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const leader = await createTestUser(identity, { roles: [{ roleCode: 'VT-17', orgUnitId: root.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  const colleague = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  for (const [index, [user, name, inDepartment]] of (
    [
      [principal, `Hiệu trưởng HL ${suffix}`, false],
      [leader, `Tổ trưởng HL ${suffix}`, true],
      [teacher, `Giáo viên HL ${suffix}`, true],
      [colleague, `Đồng nghiệp HL ${suffix}`, false],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `HL-${suffix}-${index}`,
        full_name: name,
        start_date: today,
        department_id: inDepartment ? department.id : null,
        user_id: user.id,
      })
      .execute();
  }
  const title = `Phiếu học tập E2E ${suffix}`;

  // Giáo viên: 2. Học liệu của tôi: thêm học liệu, tải tệp, gửi duyệt
  const own = await signIn(browser, teacher);
  await openMenu(own, '/learning-resources/mine');
  const form = own.getByRole('form', { name: 'Thêm học liệu' });
  await form.getByLabel('Tiêu đề', { exact: true }).fill(title);
  await form.getByLabel('Loại học liệu', { exact: true }).selectOption({ label: 'Phiếu học tập' });
  await form.getByLabel('Phạm vi xem', { exact: true }).selectOption({ label: 'Toàn trường' });
  await form.getByLabel('Từ khoá (cách nhau dấu phẩy)').fill('phân số, toán');
  await form.getByLabel('Giấy phép', { exact: true }).selectOption({ label: 'Tự biên soạn, dùng nội bộ' });
  await form.getByRole('button', { name: 'Tạo học liệu' }).click();
  await expect(own.getByText(`Đã tạo học liệu ${title}`)).toBeVisible();
  const panel = own.getByRole('region', { name: `Học liệu ${title}` });
  await panel.getByLabel('Tệp học liệu').setInputFiles({
    name: 'phieu-hoc-tap.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% phieu hoc tap thu\n%%EOF\n'),
  });
  await panel.getByRole('button', { name: 'Tải tệp lên' }).click();
  await expect(own.getByText('Đã tải tệp lên, thành phiên bản mới')).toBeVisible();
  await expect(panel.getByRole('table', { name: 'Phiên bản' })).toContainText('phieu-hoc-tap.pdf');
  await panel.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(own.getByText('Đã gửi duyệt học liệu')).toBeVisible();

  // Tổ trưởng cùng tổ: 3. Duyệt học liệu
  const head = await signIn(browser, leader);
  await openMenu(head, '/learning-resources/review');
  await head
    .getByRole('table', { name: 'Học liệu chờ duyệt' })
    .getByRole('row', { name: new RegExp(title) })
    .getByRole('button', { name: 'Mở' })
    .click();
  await head
    .getByRole('region', { name: `Học liệu ${title}` })
    .getByRole('button', { name: 'Duyệt', exact: true })
    .click();
  await expect(head.getByText('Đã duyệt học liệu')).toBeVisible();

  // Đồng nghiệp tổ khác: 1. Tìm học liệu, báo lỗi; 4. Bộ sưu tập
  const other = await signIn(browser, colleague);
  await openMenu(other, '/learning-resources');
  await other.getByRole('form', { name: 'Tìm học liệu' }).getByLabel('Từ khoá').fill(`E2E ${suffix}`);
  await other.getByRole('button', { name: 'Tìm', exact: true }).click();
  const results = other.getByRole('table', { name: 'Kết quả tìm học liệu' });
  await expect(results.getByRole('row', { name: new RegExp(title) })).toContainText('Đã công bố');
  await results
    .getByRole('row', { name: new RegExp(title) })
    .getByRole('button', { name: 'Mở' })
    .click();
  const report = other.getByRole('form', { name: 'Báo lỗi học liệu' });
  await report.getByLabel('Loại lỗi').selectOption({ label: 'Sai nội dung' });
  await report.getByLabel('Mô tả lỗi').fill('Câu 3 sai đáp số');
  await report.getByRole('button', { name: 'Gửi báo lỗi' }).click();
  await expect(other.getByText('Đã gửi báo lỗi tới thủ kho')).toBeVisible();

  await openMenu(other, '/learning-resources/collections');
  const collectionName = `Bộ phân số ${suffix}`;
  const create = other.getByRole('form', { name: 'Lập bộ sưu tập' });
  await create.getByLabel('Tên bộ sưu tập').fill(collectionName);
  await create.getByRole('button', { name: 'Lập bộ sưu tập' }).click();
  await expect(other.getByText(`Đã lập bộ sưu tập ${collectionName}`)).toBeVisible();
  const collection = other.getByRole('region', { name: `Bộ sưu tập ${collectionName}` });
  await collection.getByLabel('Thêm học liệu').selectOption({ label: title });
  await collection.getByRole('button', { name: 'Thêm vào bộ sưu tập' }).click();
  await expect(collection.getByRole('list', { name: 'Học liệu trong bộ sưu tập' })).toContainText(title);

  // Hiệu trưởng (thủ kho): 5. Báo lỗi học liệu, 6. Thống kê kho
  const manager = await signIn(browser, principal);
  await openMenu(manager, '/learning-resources/reports');
  const reports = manager.getByRole('table', { name: 'Báo lỗi học liệu' });
  await reports
    .getByRole('row', { name: new RegExp(title) })
    .getByRole('button', { name: 'Xử lý' })
    .click();
  await manager.getByLabel('Trả lời người báo').fill('Đã báo tác giả sửa câu 3');
  await manager.getByRole('button', { name: 'Đã xử lý', exact: true }).click();
  await expect(manager.getByText('Đã xử lý báo lỗi')).toBeVisible();
  await expect(reports.getByRole('row', { name: new RegExp(title) })).toContainText('Đã báo tác giả sửa câu 3');
  await openMenu(manager, '/learning-resources/statistics');
  await expect(manager.getByLabel('Tổng quan kho')).toContainText('đã công bố');
  await expect(manager.getByRole('table', { name: 'Lượt xem, tải' })).toContainText(title);
});
