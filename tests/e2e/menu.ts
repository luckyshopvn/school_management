import { expect, type Locator, type Page } from '@playwright/test';
import { listPortalMenuEntries, portalMenuText, type PortalMenuEntry } from '@school-management/shared';

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

// Chọn phân hệ ở ô Phân hệ trên thanh đầu trang nếu đang chọn phân hệ khác
export async function selectWorkspace(page: Page, label: string) {
  const switcher = page.getByRole('button', { name: /^Phân hệ: / });
  await expect(switcher).toBeVisible();
  if ((await switcher.getAttribute('aria-label')) !== `Phân hệ: ${label}`) {
    await switcher.click();
    await page.getByRole('menuitemradio', { name: label, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: `Phân hệ: ${label}`, exact: true })).toBeVisible();
}

// Thanh menu đang hiện của một phân hệ
export function menubar(page: Page, workspaceLabel: string): Locator {
  return page.getByRole('menubar', { name: workspaceLabel, exact: true });
}

export async function openMenu(page: Page, target: string, options: { exact?: boolean } = {}) {
  const entry = findMenuEntry(target, options);
  await selectWorkspace(page, entry.workspace.label);
  const bar = menubar(page, entry.workspace.label);
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
