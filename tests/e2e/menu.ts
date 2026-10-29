import { expect, type Locator, type Page } from '@playwright/test';
import {
  listPortalMenuEntries,
  portalMenuText,
  type PortalMenuEntry,
  type PortalWorkspace,
} from '@school-management/shared';

// Trợ giúp mở trang của cổng quản trị qua cây menu đánh số ở thanh bên (YCTD-330; trước là menu ngang của DT-15 phần 15a):
// tìm mục theo đường dẫn ("/children") hoặc theo tên mục ("Quản lý hồ sơ học sinh"; mặc định khớp một phần, exact để khớp
// đúng), chọn phân hệ chứa mục ở ô Phân hệ, rồi mở lần lượt các nhóm cha và bấm mục cần mở. Cây menu lấy từ @school-management/shared nên đổi menu không
// phải sửa kiểm thử
export function findMenuEntry(target: string, options: { exact?: boolean } = {}): PortalMenuEntry {
  const entries = listPortalMenuEntries();
  let matches: PortalMenuEntry[];
  if (target.startsWith('/')) {
    matches = entries.filter((entry) => entry.node.path === target);
  } else {
    const exact = entries.filter((entry) => entry.node.label === target);
    matches = options.exact || exact.length > 0 ? exact : entries.filter((entry) => entry.node.label.includes(target));
  }
  if (matches.length !== 1) {
    throw new Error(
      `Mục menu "${target}" ${matches.length === 0 ? 'không có' : `khớp nhiều mục: ${matches.map((entry) => entry.node.label).join(', ')}`}`,
    );
  }
  return matches[0] as PortalMenuEntry;
}

// Tên phân hệ đặt theo cấp (DT-19 phần 19c): phân hệ có levelTitle hiện là "<levelTitle>" hoặc "<levelTitle> <tên cấp>"
// tùy cấp đang làm việc (trường mầm non: "Quản lý giáo dục Mầm non"), nên khớp theo tên gốc
function workspaceName(workspace: PortalWorkspace): string | RegExp {
  if (!workspace.levelTitle) {
    return workspace.label;
  }
  const title = workspace.levelTitle.replace(/[.*+?^${}()|[\]\\]/g, (character) => `\\${character}`);
  return new RegExp(`^${title}( .+)?$`);
}

// Chọn phân hệ ở ô Phân hệ trên thanh đầu trang nếu đang chọn phân hệ khác; trả tên phân hệ đang hiện
export async function selectWorkspace(page: Page, label: string | RegExp): Promise<string> {
  const switcher = page.getByRole('button', { name: /^Phân hệ: / });
  // Dưới 1280 px ô chọn phân hệ nằm trong ngăn kéo thanh bên (YCTD-330): mở ngăn kéo trước
  const toggle = page.getByRole('button', { name: 'Menu chức năng' });
  // Chờ khung trang dựng xong (một trong hai nút hiện) rồi mới quyết định, vì isVisible không chờ
  await expect(switcher.or(toggle).first()).toBeVisible();
  if (!(await switcher.isVisible()) && (await toggle.isVisible())) {
    await toggle.click();
  }
  await expect(switcher).toBeVisible();
  const shownName = async () => ((await switcher.getAttribute('aria-label')) ?? '').replace(/^Phân hệ: /, '');
  const matches = (name: string) => (typeof label === 'string' ? name === label : label.test(name));
  if (!matches(await shownName())) {
    await switcher.click();
    await page.getByRole('menuitemradio', { name: label, exact: typeof label === 'string' }).click();
  }
  await expect.poll(async () => matches(await shownName())).toBe(true);
  return shownName();
}

// Thanh bên chứa cây menu (YCTD-330, thay menu ngang của DT-15 phần 15a)
export function sideMenu(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Menu chức năng' });
}

// Cây menu đang hiện của một phân hệ ở thanh bên
export function workspaceMenu(page: Page, workspaceLabel: string | RegExp): Locator {
  return sideMenu(page).getByRole('group', {
    name: workspaceLabel,
    exact: typeof workspaceLabel === 'string' ? true : undefined,
  });
}

// Mở một nhóm của cây menu nếu đang gập
export async function openGroup(tree: Locator, name: string) {
  const group = tree.getByRole('button', { name, exact: true });
  if ((await group.getAttribute('aria-expanded')) !== 'true') {
    await group.click();
  }
  await expect(group).toHaveAttribute('aria-expanded', 'true');
}

// Mở hộp ngữ cảnh "cấp · năm học · học kỳ" ở thanh đầu trang nếu đang đóng; bộ chọn cấp nằm trong hộp này (YCTD-331)
export async function openWorkingContext(page: Page) {
  const context = page.getByTestId('academic-year-context');
  await expect(context).toBeVisible();
  if ((await context.getAttribute('aria-expanded')) !== 'true') {
    await context.click();
  }
  await expect(page.getByRole('dialog', { name: 'Năm học và học kỳ' })).toBeVisible();
}

// Chọn cấp đang làm việc ở thanh đầu trang rồi chờ ô ngữ cảnh hiện đúng cấp. Đổi cấp lưu lên máy chủ rồi mới đổi tên phân hệ theo
// cấp ("Quản lý giáo dục" thành "Quản lý giáo dục Trung học phổ thông"); mở menu ngay sau khi chọn thì có thể bắt tên cũ
export async function selectSchoolLevel(page: Page, code: string) {
  await openWorkingContext(page);
  await page.getByTestId('school-level-switcher').selectOption(code);
  await expect(page.getByTestId('academic-year-context')).toContainText(`Cấp ${code} · `);
}

export async function openMenu(page: Page, target: string, options: { exact?: boolean } = {}) {
  const entry = findMenuEntry(target, options);
  const name = workspaceName(entry.workspace);
  await selectWorkspace(page, name);
  // Tìm cây menu theo tên gốc của phân hệ (có hoặc không có tên cấp), không theo tên đọc được lúc chọn: tên đổi khi cấp đang
  // làm việc vừa đổi thì bộ chọn khớp đúng tên cũ không còn phần tử nào và lệnh bấm chờ tới hết thời gian (lỗi chập chờn của 103)
  const tree = workspaceMenu(page, name);
  for (const node of entry.trail) {
    if (node.children) {
      // Nút gập của mục cha; mở nếu đang gập (nhóm chứa trang đang mở đã mở sẵn)
      await openGroup(tree, portalMenuText(node));
    } else {
      await tree.locator(`[data-menu-path="${node.path}"]`).click();
    }
  }
  await page.waitForURL((url) => url.pathname === entry.node.path);
}

// Mục menu dẫn tới một trang, kể cả khi nhóm đang gập hoặc thuộc phân hệ khác; dùng để kiểm tra người dùng không có
// quyền thì không có mục (toHaveCount(0))
export function menuLink(page: Page, path: string): Locator {
  return page.locator(`#menu-gon [data-menu-path="${path}"]`);
}

// Menu người dùng ở thanh đầu trang (bấm tên người dùng)
export async function openUserMenu(page: Page): Promise<Locator> {
  await page.locator('button[aria-controls="menu-nguoi-dung"]').click();
  const menu = page.getByRole('menu', { name: 'Menu người dùng' });
  await expect(menu).toBeVisible();
  return menu;
}

export async function logout(page: Page) {
  const menu = await openUserMenu(page);
  await menu.getByRole('menuitem', { name: 'Thoát' }).click();
}

// Người dùng không có mục menu dẫn tới trang: chờ menu dựng xong theo quyền rồi mới kiểm tra
export async function expectNoMenuLink(page: Page, path: string) {
  await expect(sideMenu(page)).toBeVisible();
  await expect(menuLink(page, path)).toHaveCount(0);
}
