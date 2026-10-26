import { expect, type Locator, type Page } from '@playwright/test';
import {
  listPortalMenuEntries,
  portalMenuText,
  type PortalMenuEntry,
  type PortalWorkspace,
} from '@school-management/shared';

// Trợ giúp mở trang của cổng quản trị qua menu ngang đánh số (DT-15 phần 15a): tìm mục theo đường dẫn ("/children") hoặc
// theo tên mục ("Quản lý hồ sơ học sinh"; mặc định khớp một phần, exact để khớp đúng), chọn phân hệ chứa mục ở ô Phân hệ,
// rồi bấm lần lượt mục cấp một, các mục cha và mục cần mở. Cây menu lấy từ @school-management/shared nên đổi menu không
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

// Thanh menu đang hiện của một phân hệ
export function menubar(page: Page, workspaceLabel: string): Locator {
  return page.getByRole('menubar', { name: workspaceLabel, exact: true });
}

// Chọn cấp đang làm việc ở thanh đầu trang rồi chờ ô ngữ cảnh hiện đúng cấp. Đổi cấp lưu lên máy chủ rồi mới đổi tên phân hệ theo
// cấp ("Quản lý giáo dục" thành "Quản lý giáo dục Trung học phổ thông"); mở menu ngay sau khi chọn thì có thể bắt tên cũ
export async function selectSchoolLevel(page: Page, code: string) {
  await page.getByTestId('school-level-switcher').selectOption(code);
  await expect(page.getByTestId('academic-year-context')).toContainText(`Cấp ${code} · `);
}

export async function openMenu(page: Page, target: string, options: { exact?: boolean } = {}) {
  const entry = findMenuEntry(target, options);
  const name = workspaceName(entry.workspace);
  await selectWorkspace(page, name);
  // Tìm thanh menu theo tên gốc của phân hệ (có hoặc không có tên cấp), không theo tên đọc được lúc chọn: tên đổi khi cấp đang
  // làm việc vừa đổi thì bộ chọn khớp đúng tên cũ không còn phần tử nào và lệnh bấm chờ tới hết thời gian (lỗi chập chờn của 103)
  const bar = typeof name === 'string' ? menubar(page, name) : page.getByRole('menubar', { name });
  let scope: Locator = bar;
  for (const node of entry.trail) {
    const item = scope.getByRole('menuitem', { name: portalMenuText(node), exact: true });
    if (node.children) {
      if ((await item.getAttribute('aria-expanded')) !== 'true') {
        await item.click();
      }
      await expect(item).toHaveAttribute('aria-expanded', 'true');
      scope = bar.getByRole('menu', { name: node.label, exact: true });
    } else {
      await item.click();
    }
  }
  await page.waitForURL((url) => url.pathname === entry.node.path);
}

// Mục menu dẫn tới một trang, kể cả khi menu đang đóng hoặc thuộc phân hệ khác; dùng để kiểm tra người dùng không có
// quyền thì không có mục (toHaveCount(0))
export function menuLink(page: Page, path: string): Locator {
  return page.locator(`[role="menubar"] [data-menu-path="${path}"]`);
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
  await expect(page.getByRole('menubar').first()).toBeVisible();
  await expect(menuLink(page, path)).toHaveCount(0);
}
