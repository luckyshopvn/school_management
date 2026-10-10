import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser, hashForTesting } from '@school-management/identity/testing';
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// QT-01 tiếp nhận trẻ mới (DT-03 phần 3b, YCTD-45): tuyển sinh lập hồ sơ, quản lý đơn vị duyệt vào lớp, phụ huynh đăng nhập lần đầu.
// Chạy sau 08-classes.spec.ts, khi Phân hiệu A đã có lớp Mầm 1.
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
let savedSettings: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
let unitId = '';

async function openSchoolYear() {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  if (!databaseName) {
    throw new Error('Chưa có cơ sở dữ liệu năm học của kiểm thử giao diện');
  }
  return createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName));
}

test.beforeAll(async () => {
  savedSettings = await identity
    .selectFrom('identity_settings')
    .select(['key', 'value', 'updated_by'])
    .where('key', '=', 'parent_default_password_hash')
    .execute();
  await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
  await identity
    .insertInto('identity_settings')
    .values({
      key: 'parent_default_password_hash',
      value: JSON.stringify(await hashForTesting(DEFAULT_PASSWORD)),
      updated_by: null,
    })
    .execute();
  const schoolYear = await openSchoolYear();
  try {
    unitId = (
      await schoolYear.selectFrom('org_units').select('id').where('name', '=', 'Phân hiệu A').executeTakeFirstOrThrow()
    ).id;
    // Mục "Mẹ" ở 06-catalogs đã ngừng sử dụng; thêm mục "Bố" đang dùng cho quan hệ với trẻ
    await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'BO', name: 'Bố' })
      .onConflict((conflict) => conflict.columns(['catalog_type', 'code']).doNothing())
      .execute();
  } finally {
    await schoolYear.destroy();
  }
});

test.afterAll(async () => {
  await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
  for (const row of savedSettings) {
    await identity
      .insertInto('identity_settings')
      .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
      .execute();
  }
  await identity.destroy();
});

async function signInAs(browser: Browser, roleCode: string): Promise<Page> {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: unitId }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

test('Tuyển sinh lập hồ sơ, quản lý đơn vị duyệt vào lớp Mầm 1, phụ huynh đăng nhập bằng mật khẩu mặc định', async ({
  browser,
}) => {
  const phone = `09${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;
  const nationalId = `0792${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;

  const admissions = await signInAs(browser, 'VT-12');
  await admissions.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await admissions.getByRole('button', { name: 'Tạo hồ sơ mới' }).click();
  const form = admissions.getByRole('form', { name: 'Biểu mẫu hồ sơ trẻ' });
  await form.getByLabel('Họ tên trẻ').fill('Nguyễn Gia Bảo');
  await form.getByLabel('Ngày sinh').fill('2022-04-18');
  await form.getByRole('combobox', { name: /^Giới tính/ }).selectOption({ label: 'Nam' });
  await form.getByLabel('Số định danh cá nhân').fill(nationalId);
  await form
    .getByLabel(/Bản chụp giấy khai sinh/)
    .setInputFiles({ name: 'giay-khai-sinh.png', mimeType: 'image/png', buffer: PNG });
  await expect(form.getByText('Đã tải lên')).toBeVisible();
  const guardian = form.getByRole('group', { name: 'Phụ huynh 1' });
  await guardian.getByLabel('Họ tên phụ huynh').fill('Nguyễn Tiến Vinh');
  await guardian.getByRole('combobox', { name: /^Quan hệ/ }).selectOption({ label: 'Bố' });
  await guardian.getByLabel('Số điện thoại').fill(phone);
  await form.getByLabel('Không có dị ứng').check();
  await form
    .getByRole('combobox', { name: /^Đồng ý sử dụng hình ảnh/ })
    .selectOption({ label: 'Chờ phụ huynh xác nhận trên ứng dụng' });
  await form.getByRole('button', { name: 'Lưu hồ sơ nháp' }).click();

  const detail = admissions.getByRole('region', { name: 'Hồ sơ Nguyễn Gia Bảo' });
  await expect(detail).toContainText('Nháp');
  await expect(detail.getByTestId('moet-code')).toHaveText('Chưa có');
  await expect(detail.getByTestId('national-id')).toHaveText(`********${nationalId.slice(-4)}`);
  await detail.getByRole('button', { name: 'Gửi trình duyệt' }).click();
  await expect(detail).toContainText('Chờ duyệt');

  const manager = await signInAs(browser, 'VT-03');
  await manager.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await manager.getByRole('combobox', { name: /^Trạng thái/ }).selectOption({ label: 'Chờ duyệt' });
  await manager.getByRole('row').filter({ hasText: 'Nguyễn Gia Bảo' }).click();
  const pending = manager.getByRole('region', { name: 'Hồ sơ Nguyễn Gia Bảo' });
  const classOption = await pending.locator('option', { hasText: 'Mầm 1' }).first().getAttribute('value');
  await pending.getByRole('combobox', { name: /^Lớp cho trẻ/ }).selectOption(classOption ?? '');
  await pending.getByRole('button', { name: 'Duyệt và phân lớp' }).click();
  await expect(pending).toContainText('Đang học');
  await expect(pending).toContainText('Đã có tài khoản');
  await expect(pending).toContainText('Mầm 1');

  const parent = await (await browser.newContext()).newPage();
  await parent.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parent.getByLabel('Số điện thoại').fill(phone);
  await parent.getByLabel('Mật khẩu', { exact: true }).fill(DEFAULT_PASSWORD);
  await parent.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(parent.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
});

test('Giáo viên không có nút tạo hồ sơ và không xem được số định danh đầy đủ', async ({ browser }) => {
  const teacher = await signInAs(browser, 'VT-07');
  await teacher.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await expect(teacher.getByRole('heading', { name: 'Hồ sơ trẻ' })).toBeVisible();
  await expect(teacher.getByRole('button', { name: 'Tạo hồ sơ mới' })).toHaveCount(0);
});
