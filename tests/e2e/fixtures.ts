import { test as base, type BrowserContext } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Browser, Locator, Page } from '@playwright/test';

// Hộp thông báo bật lên khi vào cổng quản trị (DT-16 phần 16c) che trang ở mọi ca đăng nhập bằng Hiệu trưởng khi hồ sơ
// trường chưa có mã định danh tổ chức. Mặc định đánh dấu đã hiện hộp ở mọi phiên trình duyệt để các ca khác không phải
// đóng hộp; ca kiểm thử hộp thông báo đặt test.use({ startupNotices: true })
const STARTUP_NOTICES_KEY = 'portal.startup-notices-shown';

async function suppressStartupNotices(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    try {
      window.sessionStorage.setItem(key, '1');
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
