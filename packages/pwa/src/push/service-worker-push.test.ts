import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

// Phần thông báo đẩy của service worker dùng chung (DT-26 phần 26b, YCTD-239): chạy tệp mẫu `service-worker.js` trong môi trường giả
// lập của Node (self, clients, registration) rồi phát sự kiện push, notificationclick, pushsubscriptionchange. Chromium chạy ẩn của
// e2e không hiện thông báo hệ thống nên phần này kiểm ở đây
const SOURCE = readFileSync(new URL('../../service-worker.js', import.meta.url), 'utf8');
const SCOPE = 'https://alpha.truong.test/phu-huynh/';

interface Shown {
  title: string;
  options: { body: string; tag?: string; icon: string; data: { notification_id: string | null } };
}

function loadWorker(windows: Array<{ url: string }> = []) {
  const listeners = new Map<string, (event: unknown) => void>();
  const shown: Shown[] = [];
  const opened: string[] = [];
  const focused: string[] = [];
  const posted: Array<{ url: string; message: unknown }> = [];
  const clientList = windows.map((window) => ({
    url: window.url,
    focus: async () => {
      focused.push(window.url);
    },
    // Đối tượng tạo trong vm thuộc realm khác: chép lại để so sánh sâu được
    postMessage: (message: unknown) => posted.push({ url: window.url, message: JSON.parse(JSON.stringify(message)) }),
  }));
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    registration: {
      scope: SCOPE,
      active: null,
      showNotification: async (title: string, options: Shown['options']) => {
        shown.push({ title, options });
      },
    },
    location: { origin: 'https://alpha.truong.test' },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
  };
  const clients = {
    matchAll: async () => clientList,
    openWindow: async (url: string) => {
      opened.push(url);
    },
  };
  runInNewContext(SOURCE, { self, clients, caches: {}, fetch: async () => undefined, URL, console });
  // Phát một sự kiện và chờ phần việc trong waitUntil xong
  const dispatch = async (type: string, event: Record<string, unknown>) => {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ ...event, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
  };
  return { dispatch, shown, opened, focused, posted };
}

const pushData = (value: unknown) => ({ json: () => (typeof value === 'string' ? JSON.parse(value) : value) });

describe('service worker nhận thông báo đẩy (26b)', () => {
  it('hiện thông báo với tiêu đề, nội dung, nhóm của máy chủ; chỉ giữ mã thông báo', async () => {
    const worker = loadWorker();
    await worker.dispatch('push', {
      data: pushData({
        title: 'Học phí · Trường Alpha',
        body: 'Có thông báo mới về học phí và thanh toán. Mở ứng dụng để xem.',
        tag: 'nhom-fees',
        data: { notification_id: 'tb-1', group: 'fees', url: 'https://lua-dao.example/' },
      }),
    });
    assert.equal(worker.shown.length, 1);
    const [notification] = worker.shown;
    assert.equal(notification?.title, 'Học phí · Trường Alpha');
    assert.equal(notification?.options.tag, 'nhom-fees');
    assert.equal(notification?.options.icon, `${SCOPE}icon-192.png`);
    // Không giữ địa chỉ do nội dung đẩy gửi tới
    assert.deepEqual({ ...notification?.options.data }, { notification_id: 'tb-1' });
  });

  it('tin rỗng hoặc hỏng vẫn hiện câu chung', async () => {
    const worker = loadWorker();
    await worker.dispatch('push', { data: null });
    await worker.dispatch('push', { data: pushData('không phải JSON') });
    await worker.dispatch('push', { data: pushData(null) });
    assert.deepEqual(
      worker.shown.map((item) => item.title),
      ['Thông báo mới', 'Thông báo mới', 'Thông báo mới'],
    );
    assert.equal(worker.shown[0]?.options.body, 'Mở ứng dụng để xem.');
  });

  it('chạm thông báo: đưa cửa sổ đang mở trong phạm vi lên trước và báo mã thông báo, không có thì mở trang đầu', async () => {
    const open = loadWorker([{ url: 'https://alpha.truong.test/giao-vien/' }, { url: `${SCOPE}#hoc-sinh` }]);
    let closed = false;
    await open.dispatch('notificationclick', {
      notification: { data: { notification_id: 'tb-2' }, close: () => (closed = true) },
    });
    assert.equal(closed, true);
    assert.deepEqual(open.focused, [`${SCOPE}#hoc-sinh`]);
    assert.deepEqual(open.posted, [
      { url: `${SCOPE}#hoc-sinh`, message: { type: 'PUSH_OPENED', notification_id: 'tb-2' } },
    ]);
    assert.deepEqual(open.opened, []);

    const none = loadWorker([{ url: 'https://alpha.truong.test/giao-vien/' }]);
    await none.dispatch('notificationclick', { notification: { data: {}, close: () => undefined } });
    assert.deepEqual(none.opened, [SCOPE]);
  });

  it('trình duyệt đổi đăng ký: báo các trang đang mở đăng ký lại', async () => {
    const worker = loadWorker([{ url: SCOPE }]);
    await worker.dispatch('pushsubscriptionchange', {});
    assert.deepEqual(worker.posted, [{ url: SCOPE, message: { type: 'PUSH_SUBSCRIPTION_CHANGED' } }]);
  });
});
