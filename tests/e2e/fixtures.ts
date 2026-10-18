import { test as base, type BrowserContext } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Browser, Locator } from '@playwright/test';
import type { Page } from '@playwright/test';
export type { Page };

// Hộp thông báo bật lên khi vào cổng quản trị (DT-16 phần 16c) che trang ở mọi ca đăng nhập bằng Hiệu trưởng khi hồ sơ
// trường chưa có mã định danh tổ chức. Mặc định đánh dấu đã hiện hộp ở mọi phiên trình duyệt để các ca khác không phải
// đóng hộp; ca kiểm thử hộp thông báo đặt test.use({ startupNotices: true })
const STARTUP_NOTICES_KEY = 'portal.startup-notices-shown';

async function suppressStartupNotices(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    try {
      // Tệp kiểm thử không nạp kiểu của trình duyệt; đoạn này chạy trong trang
      (
        globalThis as unknown as { sessionStorage: { setItem(name: string, value: string): void } }
      ).sessionStorage.setItem(key, '1');
    } catch {
      // Trang không có bộ nhớ phiên (ví dụ about:blank) thì bỏ qua
    }
  }, STARTUP_NOTICES_KEY);
}

// Nhiều ca mở thêm phiên trình duyệt bằng browser.newContext() cho từng vai trò mà không đóng; cả lượt chạy dùng chung
// một trình duyệt nên các phiên dồn lại tới khi Chrome báo ERR_INSUFFICIENT_RESOURCES và các ca chạy sau hỏng ngẫu nhiên.
// Sau mỗi ca đóng mọi phiên mở thêm trong ca đó
export const test = base.extend<{ startupNotices: boolean; closeExtraContexts: void }>({
  startupNotices: [false, { option: true }],
  context: async ({ context, startupNotices }, use) => {
    if (!startupNotices) {
      await suppressStartupNotices(context);
    }
    await use(context);
  },
  closeExtraContexts: [
    async ({ browser, startupNotices }, use) => {
      const before = new Set(browser.contexts());
      const originalNewContext = browser.newContext.bind(browser);
      if (!startupNotices) {
        browser.newContext = async (...parameters: Parameters<typeof originalNewContext>) => {
          const created = await originalNewContext(...parameters);
          await suppressStartupNotices(created);
          return created;
        };
      }
      try {
        await use();
      } finally {
        browser.newContext = originalNewContext;
      }
      await Promise.all(
        browser
          .contexts()
          .filter((context) => !before.has(context))
          .map((context) => context.close()),
      );
    },
    { auto: true },
  ],
});

// Bấm Đăng nhập ở cổng quản trị. Dịch vụ định danh giới hạn số lần đăng nhập mỗi phút trên một địa chỉ (BM-26); cả lượt
// chạy đăng nhập từ cùng một máy nên lúc chạy nhanh có thể vượt giới hạn và màn hình báo "Bạn thao tác quá nhanh". Khi đó
// chờ đúng số giây được báo (nới thời gian của ca tương ứng) rồi bấm lại
export async function submitSignIn(page: Page) {
  const button = page.getByRole('button', { name: 'Đăng nhập' });
  const limited = page.getByRole('alert').filter({ hasText: 'Bạn thao tác quá nhanh' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await button.click();
    // Không thấy câu báo nào trong 10 giây thì coi như đã qua bước đăng nhập; ca tự kiểm tra trang tiếp theo
    const outcome = await Promise.race([
      limited
        .waitFor({ timeout: 10_000 })
        .then(() => 'limited' as const)
        .catch(() => 'signed-in' as const),
      button
        .waitFor({ state: 'detached', timeout: 10_000 })
        .then(() => 'signed-in' as const)
        .catch(() => 'signed-in' as const),
    ]);
    if (outcome === 'signed-in') {
      return;
    }
    const seconds = Number(/sau (\d+) giây/.exec(await limited.innerText())?.[1] ?? '1');
    test.info().setTimeout(test.info().timeout + (seconds + 5) * 1000);
    await page.waitForTimeout((seconds + 1) * 1000);
  }
}
