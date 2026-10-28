import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import ExcelJS from 'exceljs';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Nhân sự đủ tính năng theo hệ thống của Sở (DT-16 phần 16f): 3.1.1 Thay đổi, Xóa, Xuất tệp theo mẫu Bộ; 3.1.2 Nhân sự phân
// hiệu; 3.1.3 Nhập nhân sự từ Excel (mẫu 75 cột, tra cứu danh mục); 3.1.5 Đánh dấu đã xác thực số định danh (bản chạy nội
// bộ); 3.5 Biến động nhân sự; 5.2 Thống kê nhân sự; 5.6 Tiến độ xác thực số định danh
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
const token = `NV${suffix}`;
const names = { delete: `Xóa ${token} Nhầm`, verify: `Võ ${token} Lan`, move: `Đỗ ${token} Mai` };
let orgUnitId = '';
let unitName = '';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  orgUnitId = unit.id;
  unitName = unit.name;
  for (const [index, fullName] of Object.values(names).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: orgUnitId,
        code: `${token}-${index}`,
        full_name: fullName,
        gender: 'female',
        dob: '1990-03-15',
        start_date: '2025-08-01',
        id_number_last4: null,
      })
      .execute();
  }
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(page: Page) {
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('CT-16f-11: 3.1.1 Thay đổi mở hồ sơ dòng đã chọn, Xóa có hộp xác nhận, Xuất tệp theo mẫu Bộ 75 cột kèm kiểm tra dữ liệu', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/staff');
  await page.getByLabel('Tìm theo tên hoặc mã').fill(token);
  const grid = page.getByRole('region', { name: 'Danh sách nhân sự' });
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(3);
  const change = grid.getByRole('button', { name: 'Thay đổi', exact: true });
  await expect(change).toBeDisabled();
  await grid.getByRole('checkbox', { name: `Chọn ${names.verify}` }).check();
  await change.click();
  // Hồ sơ mở ở trang riêng chia thẻ (YCTD-309); ô Dân tộc ở thẻ Hồ sơ CSDL Bộ
  const profile = page.getByRole('group', { name: `Hồ sơ của ${names.verify}` });
  await expect(profile).toBeVisible();
  await profile.getByRole('tab', { name: 'Hồ sơ CSDL Bộ' }).click();
  await expect(profile.getByLabel('Dân tộc').first()).toHaveJSProperty('tagName', 'SELECT');
  await page.getByRole('link', { name: /^Quay lại/ }).click();
  await page.getByLabel('Tìm theo tên hoặc mã').fill(token);
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(3);

  // Xóa hồ sơ nhập nhầm
  await grid.getByRole('checkbox', { name: `Chọn ${names.delete}` }).check();
  await grid.getByRole('button', { name: 'Xóa', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Xác nhận xóa' }) });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText('Đã xóa 1 hồ sơ')).toBeVisible();
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(2);

  // Tệp theo mẫu Bộ: không gửi đi, chỉ tải tệp
  const downloading = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất tệp theo mẫu Bộ' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^ho-so-can-bo-theo-mau-bo-.*\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  expect(workbook.getWorksheet('Hồ sơ')?.getRow(1).cellCount).toBe(75);
  expect(workbook.getWorksheet('Kiểm tra dữ liệu')).toBeTruthy();
  await expect(grid.getByRole('button', { name: 'Xuất file lỗi' })).toBeVisible();
});

test('CT-16f-12: 3.1.5 đánh dấu đã xác thực, sai thông tin cần ghi chú; 5.6 tiến độ xác thực theo đơn vị', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/staff-identity');
  await expect(
    page.getByRole('heading', { name: '3.1.5. Xác thực số định danh nhân sự với CSDLQG về dân cư', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Chưa kết nối CSDLQG về dân cư')).toBeVisible();
  await page.getByLabel('Tìm theo tên hoặc mã').fill(token);
  const grid = page.getByRole('region', { name: 'Danh sách xác thực số định danh' });
  await grid.getByRole('checkbox', { name: `Chọn ${names.verify}` }).check();
  await expect(grid.getByRole('button', { name: 'Đánh dấu sai thông tin' })).toBeDisabled();
  await grid.getByRole('button', { name: 'Đánh dấu đã xác thực' }).click();
  // Hồ sơ chưa có số định danh 12 chữ số thì không đánh dấu được
  await expect(page.getByRole('list', { name: 'Hồ sơ không cập nhật được' })).toContainText('12 chữ số');
  await grid.getByLabel('Ghi chú').fill('Sai ngày sinh');
  await grid.getByRole('button', { name: 'Đánh dấu sai thông tin' }).click();
  await expect(grid.getByRole('row').filter({ hasText: names.verify })).toContainText('Sai thông tin');

  await openMenu(page, '/staff-identity-progress');
  const progress = page.getByRole('table', { name: 'Bảng tiến độ xác thực' });
  await expect(progress.getByRole('row').filter({ hasText: unitName })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Danh sách trùng số định danh' })).toBeVisible();
});

test('CT-16f-13: 3.5 lập phiếu chuyển đi, duyệt, xuất PDF; 3.1.2 gán phân hiệu', async ({ page }) => {
  await signIn(page);
  await openMenu(page, '/staff-movements');
  await page.getByRole('tab', { name: 'Duyệt chuyển đi' }).click();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm duyệt chuyển đi' });
  await form.getByLabel('Nhân sự').selectOption({ label: `${token}-2 – ${names.move}` });
  await form.getByLabel('Chuyển đến trường').fill('Trường Mầm non Mẫu');
  await form.getByLabel('Ngày chuyển').fill('2026-10-01');
  await form.getByRole('button', { name: 'Ghi' }).click();
  const grid = page.getByRole('region', { name: 'Duyệt chuyển đi' });
  const row = grid.getByRole('row').filter({ hasText: names.move });
  await expect(row).toContainText('Chờ duyệt');
  await row.getByRole('button', { name: 'Hồ sơ' }).click();
  const actions = page.getByRole('region', { name: `Biến động ${names.move}` });
  await actions.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(row).toContainText('Đã duyệt');
  const downloading = page.waitForEvent('download');
  await actions.getByRole('button', { name: 'Xem và in PDF' }).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(actions.getByRole('button', { name: 'Đánh dấu trường đến đã tiếp nhận' })).toBeVisible();

  await openMenu(page, '/staff-branches');
  await page.getByLabel('Tìm theo tên hoặc mã').fill(token);
  const branches = page.getByRole('region', { name: 'Danh sách nhân sự phân hiệu' });
  await expect(branches.getByRole('row').filter({ hasText: names.verify })).toContainText('Chưa gán');
  await expect(branches.getByRole('button', { name: 'Lấy theo phân hiệu giảng dạy' })).toBeVisible();
});

test('CT-16f-14: 3.1.3 mẫu 75 cột, tra cứu danh mục của Bộ; 5.2 thống kê theo danh mục và chuẩn nghề nghiệp', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/staff-imports');
  await expect(page.getByRole('heading', { name: '3.1.3. Nhập nhân sự từ Excel', exact: true })).toBeVisible();
  const section = page.getByRole('region', { name: 'Nhân sự từ CSDL ngành' });
  const downloading = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Tải file mẫu', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('mau-nhap-nhan-su-75-cot.xlsx');
  await section.getByRole('button', { name: 'Tra cứu danh mục' }).click();
  const lookup = section.getByRole('region', { name: 'Tra cứu danh mục' });
  await lookup.getByRole('combobox', { name: 'Danh mục' }).selectOption({ label: 'Vị trí việc làm' });
  await expect(lookup.getByRole('list')).toContainText('Bảo mẫu');
  await expect(page.getByRole('region', { name: 'Nhân sự', exact: true })).toBeVisible();

  await openMenu(page, '/staff-statistics');
  await expect(page.getByRole('heading', { name: '5.2. Thống kê nhân sự', exact: true })).toBeVisible();
  const positions = page.getByRole('table', { name: 'Bảng theo vị trí việc làm' });
  await expect(positions.getByRole('row').filter({ hasText: 'Thủ quỹ' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Theo chuẩn nghề nghiệp giáo viên' })).toBeVisible();
});
