import { expect, type Locator } from '@playwright/test';

// Thao tác phụ của lưới dữ liệu nằm trong menu "Thêm" (YCTD-333): Xuất PDF, Cấu hình cột hiển thị và thao tác phụ của màn
// hình (xuất tệp…). Trả mục menu sau khi mở menu để kịch bản bấm hoặc kiểm tra
export async function gridMoreItem(grid: Locator, name: string): Promise<Locator> {
  const more = grid.getByRole('button', { name: 'Thêm', exact: true });
  if ((await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
  const item = grid.getByRole('menuitem', { name, exact: true });
  await expect(item).toBeVisible();
  return item;
}

export async function clickGridMoreItem(grid: Locator, name: string) {
  await (await gridMoreItem(grid, name)).click();
}
