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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Tuyển dụng (DT-11 phần 11b, YCTD-87): quản lý đơn vị lập đề nghị tuyển dụng, Hiệu trưởng duyệt, nhân sự soạn và công bố
// tin; người ngoài nộp hồ sơ trên trang công khai không cần tài khoản; nhân sự sàng lọc, quản lý đơn vị phỏng vấn và
// quyết định tuyển, nhân sự tạo hồ sơ nhân sự từ ứng viên đã tuyển
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

async function signIn(browser: Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('Đề nghị tuyển dụng được duyệt, tin công bố, ứng viên nộp hồ sơ công khai, phỏng vấn và quyết định tuyển', async ({
  browser,
}) => {
  const reference = await schoolYear.selectFrom('classes').select('org_unit_id').executeTakeFirstOrThrow();
  const unitId = reference.org_unit_id;
  const suffix = Date.now() % 1_000_000;
  const position = `Giáo viên mầm non ${suffix}`;
  const title = `Tuyển giáo viên mầm non ${suffix}`;
  const candidateName = `Ứng Viên ${suffix}`;
  const candidatePhone = `09${String(suffix).padStart(8, '0')}`;
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: unitId }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const hr = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: unitId }] });
  const interviewer = `Người phỏng vấn ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unitId,
      code: `PV-${suffix}`,
      full_name: interviewer,
      start_date: '2020-01-01',
      user_id: manager.id,
    })
    .execute();

  // Quản lý đơn vị lập đề nghị
  const managerPage = await signIn(browser, manager);
  await openMenu(managerPage, '/recruitment');
  await managerPage
    .getByRole('region', { name: 'Đề nghị tuyển dụng' })
    .getByRole('button', { name: 'Thêm mới' })
    .click();
  const requestForm = managerPage.getByRole('form', { name: 'Lập đề nghị tuyển dụng' });
  await requestForm.getByLabel('Vị trí cần tuyển').fill(position);
  await requestForm.getByLabel('Số lượng').fill('1');
  await requestForm.getByLabel('Yêu cầu', { exact: true }).fill('Cao đẳng sư phạm mầm non');
  await requestForm.getByLabel('Lý do tuyển').fill('Mở thêm lớp');
  await requestForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(managerPage.getByText(/Đã gửi đề nghị DNTD-\d{6}/)).toBeVisible();
  await expect(managerPage.getByRole('row').filter({ hasText: position })).toContainText('Chờ duyệt');

  // Hiệu trưởng duyệt
  const principalPage = await signIn(browser, principal);
  await openMenu(principalPage, '/recruitment');
  await principalPage.getByRole('tab', { name: 'Đề nghị chờ duyệt' }).click();
  await principalPage.getByRole('row').filter({ hasText: position }).getByRole('button', { name: 'Duyệt' }).click();
  await expect(principalPage.getByText(/Đã duyệt đề nghị DNTD-\d{6}/)).toBeVisible();

  // Nhân sự soạn và công bố tin
  const hrPage = await signIn(browser, hr);
  await openMenu(hrPage, '/recruitment');
  await hrPage.getByRole('tab', { name: 'Tin tuyển dụng' }).click();
  await hrPage.getByRole('region', { name: 'Tin tuyển dụng' }).getByRole('button', { name: 'Thêm mới' }).click();
  const postingForm = hrPage.getByRole('form', { name: 'Soạn tin tuyển dụng' });
  const requestSelect = postingForm.getByLabel('Đề nghị đã duyệt');
  const requestValue = await requestSelect.locator('option', { hasText: position }).getAttribute('value');
  await requestSelect.selectOption(requestValue ?? '');
  await postingForm.getByLabel('Tiêu đề tin').fill(title);
  await postingForm.getByLabel('Mô tả công việc').fill('Dạy và chăm sóc trẻ lớp mầm');
  await postingForm.getByLabel('Yêu cầu ứng viên').fill('Yêu trẻ, có bằng sư phạm');
  const deadline = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await postingForm.getByLabel('Hạn nộp hồ sơ').fill(deadline);
  await postingForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(hrPage.getByText('Đã lưu tin tuyển dụng ở trạng thái đang soạn')).toBeVisible();
  const postingRow = hrPage.getByRole('row').filter({ hasText: title });
  await postingRow.getByRole('button', { name: 'Công bố' }).click();
  await expect(postingRow).toContainText('đang nhận hồ sơ');

  // Người ngoài nộp hồ sơ không cần tài khoản
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await visitor.getByRole('link', { name: 'Tuyển dụng giáo viên và nhân viên' }).click();
  await visitor.getByRole('button', { name: `Ứng tuyển ${title}` }).click();
  const form = visitor.getByRole('form', { name: `Nộp hồ sơ ${title}` });
  await form.getByLabel('Họ và tên').fill(candidateName);
  await form.getByLabel('Số điện thoại').fill(candidatePhone);
  await form.getByLabel('Thư điện tử').fill(`ungvien${suffix}@example.com`);
  await form.getByLabel(/Hồ sơ xin việc/).setInputFiles({
    name: 'ho-so.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nHồ sơ xin việc\n', 'utf8'),
  });
  await form.getByLabel(/Tôi đồng ý cho nhà trường/).check();
  await form.getByRole('button', { name: 'Gửi hồ sơ' }).click();
  await expect(visitor.getByText(`Nhà trường đã nhận hồ sơ ứng tuyển "${title}"`)).toBeVisible();

  // Nhân sự sàng lọc
  await hrPage.getByRole('tab', { name: 'Ứng viên' }).click();
  await hrPage.getByRole('button', { name: `Xem hồ sơ ${candidateName}` }).click();
  const hrPanel = hrPage.getByRole('region', { name: `Hồ sơ ứng viên ${candidateName}` });
  await expect(hrPanel).toContainText(candidatePhone);
  await hrPanel.getByRole('button', { name: 'Chuyển sàng lọc' }).click();
  await expect(hrPanel).toContainText('Đang sàng lọc');

  // Quản lý đơn vị phỏng vấn và quyết định tuyển
  await managerPage.reload();
  await managerPage.getByRole('tab', { name: 'Ứng viên' }).click();
  await managerPage.getByRole('button', { name: `Xem hồ sơ ${candidateName}` }).click();
  const managerPanel = managerPage.getByRole('region', { name: `Hồ sơ ứng viên ${candidateName}` });
  const tomorrow = new Date(Date.now() + 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);
  await managerPanel.getByLabel('Thời điểm phỏng vấn').fill(`${tomorrow}T09:00`);
  await managerPanel.getByLabel('Địa điểm phỏng vấn').fill('Phòng họp');
  await managerPanel.getByLabel('Người phỏng vấn').selectOption({ label: interviewer });
  await managerPanel.getByRole('button', { name: 'Lên lịch phỏng vấn' }).click();
  await expect(managerPanel).toContainText('Chờ phỏng vấn');
  await managerPanel.getByLabel('Điểm phỏng vấn').fill('8');
  await managerPanel.getByLabel('Đánh giá').fill('Dạy thử tốt');
  await managerPanel.getByRole('button', { name: 'Ghi kết quả đạt' }).click();
  await expect(managerPanel).toContainText('Đạt, 8 điểm');
  await managerPanel.getByRole('button', { name: 'Quyết định tuyển' }).click();
  await expect(managerPanel).toContainText('Đã tuyển');

  // Nhân sự tạo hồ sơ nhân sự từ ứng viên đã tuyển
  await hrPage.reload();
  await hrPage.getByRole('tab', { name: 'Ứng viên' }).click();
  await hrPage.getByRole('button', { name: `Xem hồ sơ ${candidateName}` }).click();
  await hrPanel.getByLabel('Mã nhân sự mới').fill(`GV-${suffix}`);
  await hrPanel.getByRole('button', { name: 'Tạo hồ sơ nhân sự' }).click();
  await expect(hrPanel).toContainText(`GV-${suffix}`);
});
