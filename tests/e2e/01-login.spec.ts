import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { logout, menuLink, openMenu, openUserMenu, selectWorkspace, sideMenu, workspaceMenu } from './menu.js';

// MH-47 Đăng nhập, MH-48 Đổi mật khẩu trên cổng quản trị (YCTD-36); khung trang theo Sở: menu ngang đánh số, menu người
// dùng, màn hình hẹp (DT-15 phần 15a, CT-15a-7 đến CT-15a-11)
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function fillLogin(page: import('@playwright/test').Page, loginIdentifier: string, password: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(loginIdentifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('Đăng nhập đúng thì vào trang chủ thấy tên, không còn khối vai trò; tải lại trang vẫn giữ phiên; đăng xuất về màn hình đăng nhập', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);

  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vai trò của bạn' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  await logout(page);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('CT-310-6: Ghi nhớ giữ phiên lâu bằng cookie bền; không tích thì cookie hết khi đóng trình duyệt; mật khẩu không lưu ở trang', async ({
  page,
  context,
}) => {
  const refreshCookie = async () =>
    (await context.cookies()).find((cookie) => cookie.name.startsWith('__Secure-refresh_token'));
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  // Cookie phiên: không có hạn (Playwright báo -1)
  expect((await refreshCookie())?.expires).toBe(-1);
  await logout(page);

  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByLabel('Ghi nhớ tài khoản').check();
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  expect((await refreshCookie())?.expires ?? -1).toBeGreaterThan(Date.now() / 1000 + 29 * 24 * 3600);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(user.password);
});

test('Sai mật khẩu thì hiện thông báo của máy chủ, không vào được trang chủ', async ({ page }) => {
  const user = await createTestUser(database);
  await fillLogin(page, user.phone, 'SaiMatKhau1');
  await expect(page.getByRole('alert')).toContainText('mật khẩu không đúng');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('Tài khoản bắt buộc đổi mật khẩu được chuyển tới MH-48; đổi xong vào trang chủ', async ({ page }) => {
  const user = await createTestUser(database, {
    roles: [{ roleCode: 'VT-06', orgUnitId: null }],
    mustChangePassword: true,
  });
  await fillLogin(page, user.username, user.password);

  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();

  await page.getByLabel('Mật khẩu hiện tại').fill(user.password);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('ngan1');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('ngan1');
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeVisible();

  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatKhauMoi2026');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatKhauMoi2026');
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
});

const EDUCATION = 'Quản lý giáo dục Mầm non';
const SYSTEM = 'Quản trị hệ thống';
const DOCUMENTS = 'Quản lý văn bản và điều hành';

test('CT-15a-7 (YCTD-330): thanh bên bằng chuột: nhóm đánh số gập, mở; mở trang thì tô sáng mục và nhóm chứa trang mở sẵn', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, EDUCATION);
  const tree = workspaceMenu(page, EDUCATION);
  await expect(tree.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page');

  // Giữ số thứ bậc theo hệ thống của Sở (GD-171)
  const students = tree.getByRole('button', { name: '4. Học sinh', exact: true });
  await expect(students).toHaveAttribute('aria-expanded', 'false');
  await students.click();
  await expect(students).toHaveAttribute('aria-expanded', 'true');
  const profiles = tree.getByRole('button', { name: '4.1. Hồ sơ học sinh', exact: true });
  await expect(profiles).toBeVisible();
  // Bấm lại thì gập
  await students.click();
  await expect(profiles).toBeHidden();

  await students.click();
  await profiles.click();
  await tree.getByRole('link', { name: '4.1.1. Quản lý hồ sơ học sinh', exact: true }).click();
  await expect(page).toHaveURL(/\/children$/);
  await expect(menuLink(page, '/children')).toHaveAttribute('aria-current', 'page');
  // Mở thẳng trang khác bằng đường dẫn thì nhóm chứa trang tự mở
  await page.goto('/staff');
  await expect(tree.getByRole('button', { name: '3. Nhân sự', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(menuLink(page, '/staff')).toHaveAttribute('aria-current', 'page');

  // Trợ giúp mở theo tên mục (khớp một phần) và theo đường dẫn
  // "Danh sách người dùng" có ở cả Quản trị hệ thống và Tuyển sinh đầu cấp (DT-17 phần 17c) nên dùng tên mục khác
  await openMenu(page, 'Phân quyền nhóm theo phần mềm');
  await expect(page.getByRole('heading', { name: '1.2. Phân quyền nhóm theo phần mềm', exact: true })).toBeVisible();
  await openMenu(page, '/classes');
  await expect(page.getByRole('button', { name: `Phân hệ: ${EDUCATION}` })).toBeVisible();
});

test('CT-15a-8 (YCTD-330): thanh bên bằng bàn phím: Tab qua các mục, Enter, Space mở và gập nhóm, Enter mở trang', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, EDUCATION);
  const tree = workspaceMenu(page, EDUCATION);
  const group = (name: string) => tree.getByRole('button', { name, exact: true });

  await tree.getByRole('link', { name: 'Trang chủ' }).focus();
  await page.keyboard.press('Tab');
  await expect(group('1. Trường học')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(group('2. Lớp học')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(group('4. Học sinh')).toBeFocused();

  // Enter mở nhóm, Tab vào mục con đầu; Space mở nhóm con
  await page.keyboard.press('Enter');
  await expect(group('4. Học sinh')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(group('4.1. Hồ sơ học sinh')).toBeFocused();
  await page.keyboard.press(' ');
  await expect(group('4.1. Hồ sơ học sinh')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(tree.getByRole('link', { name: '4.1.1. Quản lý hồ sơ học sinh', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/children$/);
});

test('CT-15a-9: chọn phân hệ đổi bộ menu, tải lại vẫn giữ; mở trang phân hệ khác bằng đường dẫn thì menu tự chuyển', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, SYSTEM);
  await expect(workspaceMenu(page, SYSTEM).getByRole('button', { name: '2. Thiết lập', exact: true })).toBeVisible();
  await expect(workspaceMenu(page, EDUCATION)).toBeHidden();
  // Chọn phân hệ thì về trang chủ, bảng điều khiển đổi theo phân hệ (YCTD-307)
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('region', { name: `Tổng quan phân hệ ${SYSTEM}` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: `Phân hệ: ${SYSTEM}` })).toBeVisible();
  await expect(page.getByRole('region', { name: `Tổng quan phân hệ ${SYSTEM}` })).toBeVisible();

  await page.goto('/children');
  await expect(page.getByRole('button', { name: `Phân hệ: ${EDUCATION}` })).toBeVisible();
  await expect(workspaceMenu(page, EDUCATION)).toBeVisible();
  await expect(menuLink(page, '/children')).toHaveAttribute('aria-current', 'page');

  // Đang ở trang của phân hệ khác, chọn Quản lý văn bản và điều hành thì về trang chủ, tự hiện công văn đến, đi của tôi;
  // tài khoản mới chưa có văn bản nào nên mỗi khối ghi "Trống"
  await selectWorkspace(page, DOCUMENTS);
  await expect(page).toHaveURL(/\/$/);
  const documents = page.getByRole('region', { name: `Tổng quan phân hệ ${DOCUMENTS}` });
  await expect(documents.getByRole('region', { name: 'Công văn đến của tôi' })).toContainText('Trống');
  await expect(documents.getByRole('region', { name: 'Công văn đi của tôi' })).toContainText('Trống');

  // Giáo viên chỉ thấy phân hệ có mục được mở; không có mục Danh sách người dùng
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await logout(page);
  await fillLogin(page, teacher.username, teacher.password);
  await expect(sideMenu(page)).toBeVisible();
  await page.getByRole('button', { name: /^Phân hệ: / }).click();
  await expect(page.getByRole('menuitemradio', { name: SYSTEM })).toBeVisible();
  await expect(menuLink(page, '/accounts')).toHaveCount(0);
});

test('CT-332-1: tìm chức năng ở thanh đầu trang (gõ không dấu, bàn phím) và trang Tất cả chức năng có ô lọc', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, EDUCATION);

  // Gõ không dấu vẫn khớp; mũi tên xuống, Enter mở trang; trang thuộc phân hệ khác thì thanh bên tự chuyển phân hệ
  const search = page.getByRole('combobox', { name: 'Tìm chức năng' });
  await search.fill('phan quyen nhom theo phan mem');
  const results = page.getByRole('listbox', { name: 'Chức năng tìm thấy' });
  await expect(results.getByRole('option', { name: /1\.2\. Phân quyền nhóm theo phần mềm/ })).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(/\/role-workspaces$/);
  await expect(page.getByRole('button', { name: `Phân hệ: ${SYSTEM}` })).toBeVisible();
  await search.fill('khong co chuc nang nay');
  await expect(results.getByRole('option', { name: 'Không có chức năng phù hợp' })).toBeVisible();
  await search.press('Escape');
  await expect(results).toBeHidden();

  // Tất cả chức năng: mọi phân hệ, phân hệ đang chọn đứng đầu; lọc theo số thứ bậc
  await page.getByRole('complementary', { name: 'Thanh bên' }).getByRole('link', { name: 'Tất cả chức năng' }).click();
  await expect(page).toHaveURL(/\/all-functions$/);
  await expect(page.getByRole('heading', { name: 'Tất cả chức năng', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: EDUCATION, exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Lọc chức năng' }).fill('4.1.1');
  await page.getByRole('link', { name: '4.1.1. Quản lý hồ sơ học sinh', exact: true }).click();
  await expect(page).toHaveURL(/\/children$/);
});

test('CT-15a-10: màn hình hẹp dùng nút menu mở cây menu gập', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  // Ô chọn phân hệ nằm trong ngăn kéo: trợ giúp mở ngăn kéo rồi chọn phân hệ
  await selectWorkspace(page, EDUCATION);
  const toggle = page.getByRole('button', { name: 'Menu chức năng' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const tree = page.getByRole('navigation', { name: 'Menu chức năng' });
  const students = tree.getByRole('button', { name: '4. Học sinh' });
  await expect(students).toHaveAttribute('aria-expanded', 'false');
  await students.click();
  await tree.getByRole('button', { name: '4.1. Hồ sơ học sinh' }).click();
  await tree.getByRole('link', { name: '4.1.1. Quản lý hồ sơ học sinh' }).click();
  await expect(page).toHaveURL(/\/children$/);
  await expect(tree).toHaveCount(0);
  // Mở lại thì nhánh của trang đang mở đã mở sẵn
  await toggle.click();
  await expect(tree.getByRole('link', { name: '4.1.1. Quản lý hồ sơ học sinh' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('CT-15a-11: menu người dùng có Thông báo, Hồ sơ nhân sự cá nhân (16c), Đổi mật khẩu, Cấu hình hiển thị lưới, Danh sách ý kiến đã gửi (15g), Hướng dẫn (16c), Thoát; số dòng mặc định lưu theo tài khoản', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  let menu = await openUserMenu(page);
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Thông báo',
    'Hồ sơ nhân sự cá nhân',
    'Đổi mật khẩu',
    'Cấu hình hiển thị lưới',
    'Gửi phản hồi',
    'Danh sách ý kiến đã gửi',
    'Hướng dẫn',
    'Thoát',
  ]);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Cấu hình hiển thị lưới' }).click();
  let dialog = page.getByRole('dialog', { name: 'Cấu hình hiển thị lưới' });
  await expect(dialog.getByLabel('Số dòng mỗi trang mặc định')).toHaveValue('20');
  await dialog.getByLabel('Số dòng mỗi trang mặc định').selectOption('50');
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Cấu hình hiển thị lưới' }).click();
  dialog = page.getByRole('dialog', { name: 'Cấu hình hiển thị lưới' });
  await expect(dialog.getByLabel('Số dòng mỗi trang mặc định')).toHaveValue('50');
  await dialog.getByRole('button', { name: 'Hủy' }).click();

  // Lưới chưa cấu hình riêng dùng số dòng mặc định
  await openMenu(page, '/accounts');
  await expect(page.getByLabel('Số dòng mỗi trang', { exact: true })).toHaveValue('50');

  menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Thông báo' }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  // Trang Đổi mật khẩu không có khung trang nên mở sau cùng
  menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Đổi mật khẩu' }).click();
  await expect(page).toHaveURL(/\/change-password$/);
});
