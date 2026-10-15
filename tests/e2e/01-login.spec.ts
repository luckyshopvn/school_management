import { expect, test } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { logout, menuLink, menubar, openMenu, openUserMenu, selectWorkspace } from './menu.js';

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

test('Đăng nhập đúng thì vào trang chủ thấy tên và vai trò; tải lại trang vẫn giữ phiên; đăng xuất về màn hình đăng nhập', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);

  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByTestId('role-list')).toContainText('Hiệu trưởng');
  await expect(page.getByTestId('role-list')).toContainText('Toàn trường');

  await page.reload();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  await logout(page);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
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

test('CT-15a-7: menu ngang bằng chuột: mở menu sổ xuống, menu cấp hai bật sang phải, mở trang thì tô sáng mục; bấm ra ngoài thì đóng', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, EDUCATION);
  const bar = menubar(page, EDUCATION);
  await expect(bar.getByRole('menuitem', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page');

  const students = bar.getByRole('menuitem', { name: '4. Học sinh', exact: true });
  await students.click();
  await expect(students).toHaveAttribute('aria-expanded', 'true');
  const studentMenu = bar.getByRole('menu', { name: 'Học sinh', exact: true });
  await expect(studentMenu).toBeVisible();
  // Bấm ra ngoài thì đóng
  await page.mouse.click(10, 600);
  await expect(studentMenu).toBeHidden();

  await students.click();
  await studentMenu.getByRole('menuitem', { name: '4.1. Hồ sơ học sinh', exact: true }).hover();
  const profiles = bar.getByRole('menu', { name: 'Hồ sơ học sinh', exact: true });
  await expect(profiles).toBeVisible();
  await profiles.getByRole('menuitem', { name: '4.1.1. Quản lý hồ sơ học sinh', exact: true }).click();
  await expect(page).toHaveURL(/\/children$/);
  await expect(studentMenu).toBeHidden();
  await expect(menuLink(page, '/children')).toHaveAttribute('aria-current', 'page');
  await expect(students).toHaveClass(/border-brand/);

  // Trợ giúp mở theo tên mục (khớp một phần) và theo đường dẫn
  await openMenu(page, 'Danh sách người dùng');
  await expect(page.getByRole('heading', { name: '1.4. Danh sách người dùng', exact: true })).toBeVisible();
  await openMenu(page, '/classes');
  await expect(page.getByRole('button', { name: `Phân hệ: ${EDUCATION}` })).toBeVisible();
});

test('CT-15a-8: menu ngang bằng bàn phím: mũi tên, Enter, Space, Esc theo mẫu menubar', async ({ page }) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, EDUCATION);
  const bar = menubar(page, EDUCATION);
  const item = (name: string) => bar.getByRole('menuitem', { name, exact: true });

  await item('Trang chủ').focus();
  await page.keyboard.press('ArrowRight');
  await expect(item('1. Trường học')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(item('5. Công cụ hỗ trợ')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(item('4. Học sinh')).toBeFocused();

  // Enter mở menu và đưa con trỏ tới mục đầu; mũi tên phải mở menu cấp hai
  await page.keyboard.press('Enter');
  await expect(item('4.1. Hồ sơ học sinh')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(item('4.1.1. Quản lý hồ sơ học sinh')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(item('4.1.2. Nhập dữ liệu từ Excel')).toBeFocused();
  // Esc đóng từng cấp, con trỏ về mục cha
  await page.keyboard.press('Escape');
  await expect(bar.getByRole('menu', { name: 'Hồ sơ học sinh', exact: true })).toBeHidden();
  await expect(item('4.1. Hồ sơ học sinh')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(bar.getByRole('menu', { name: 'Học sinh', exact: true })).toBeHidden();
  await expect(item('4. Học sinh')).toBeFocused();

  // Mũi tên lên mở menu ở mục cuối; mũi tên trái ở menu cấp một sang menu bên trái; Space chọn mục
  await page.keyboard.press('ArrowUp');
  await expect(item('4.7. Điểm danh')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(item('4.1. Hồ sơ học sinh')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(item('3.1. Hồ sơ nhân sự')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(item('3.1.1. Hồ sơ cán bộ, giáo viên')).toBeFocused();
  await page.keyboard.press(' ');
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole('heading', { name: 'Hồ sơ nhân sự', exact: true })).toBeVisible();
});

test('CT-15a-9: chọn phân hệ đổi bộ menu, tải lại vẫn giữ; mở trang phân hệ khác bằng đường dẫn thì menu tự chuyển', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, SYSTEM);
  await expect(menubar(page, SYSTEM).getByRole('menuitem', { name: '2. Thiết lập', exact: true })).toBeVisible();
  await expect(menubar(page, EDUCATION)).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: `Phân hệ: ${SYSTEM}` })).toBeVisible();

  await page.goto('/children');
  await expect(page.getByRole('button', { name: `Phân hệ: ${EDUCATION}` })).toBeVisible();
  await expect(menubar(page, EDUCATION)).toBeVisible();
  await expect(menuLink(page, '/children')).toHaveAttribute('aria-current', 'page');

  // Giáo viên chỉ thấy phân hệ có mục được mở; không có mục Danh sách người dùng
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await logout(page);
  await fillLogin(page, teacher.username, teacher.password);
  await expect(page.getByRole('menubar').first()).toBeVisible();
  await page.getByRole('button', { name: /^Phân hệ: / }).click();
  await expect(page.getByRole('menuitemradio', { name: SYSTEM })).toBeVisible();
  await expect(menuLink(page, '/accounts')).toHaveCount(0);
});

test('CT-15a-10: màn hình hẹp dùng nút menu mở cây menu gập', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  await selectWorkspace(page, EDUCATION);
  await expect(page.getByRole('menubar')).toHaveCount(0);
  const toggle = page.getByRole('button', { name: 'Menu chức năng' });
  await toggle.click();
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

test('CT-15a-11: menu người dùng có Thông báo, Đổi mật khẩu, Cấu hình hiển thị lưới, Danh sách ý kiến đã gửi (15g), Thoát; số dòng mặc định lưu theo tài khoản', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);
  let menu = await openUserMenu(page);
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Thông báo',
    'Đổi mật khẩu',
    'Cấu hình hiển thị lưới',
    'Danh sách ý kiến đã gửi',
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
