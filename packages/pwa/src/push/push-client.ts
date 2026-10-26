import { isIos } from '../install-state.js';
import { decodeBase64Url, detectPushState, deviceLabel, type PushState } from './push-state.js';

// Đăng ký, hủy, đồng bộ thông báo đẩy trên trình duyệt (DT-26 phần 26b, YCTD-232), gọi các điểm cuối của phần máy chủ 26b:
// `GET /api/v1/public/push/vapid-public-key`, `POST /api/v1/push/subscriptions`, `POST /api/v1/push/subscriptions/unsubscribe`.
// Mỗi ứng dụng truyền hàm gọi máy chủ có mã phiên của mình (giáo viên, phụ huynh, học sinh) nên gói không giữ mã phiên.
// Một trình duyệt chỉ có một đăng ký đẩy cho mỗi service worker: ứng dụng phụ huynh và màn hình học sinh dùng chung phạm vi, người
// bật sau cùng trên máy là người nhận (máy chủ chuyển đăng ký theo địa chỉ)
export type PushApplication = 'teacher' | 'parent' | 'student';
export type PushRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

const IN_APP_BROWSER = /\b(Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|musical_ly|TikTok|Line)\b/i;

async function currentRegistration(base: string): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined;
  }
  return navigator.serviceWorker.getRegistration(base);
}

async function serverKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/v1/public/push/vapid-public-key', { credentials: 'omit' });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { enabled: boolean; public_key: string | null };
    return body.enabled ? body.public_key : null;
  } catch {
    return null;
  }
}

export async function readPushState(base: string): Promise<PushState> {
  const registration = await currentRegistration(base);
  const subscription = registration ? await registration.pushManager?.getSubscription() : null;
  const pushApi =
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window &&
    'serviceWorker' in navigator;
  return detectPushState({
    pushApi,
    ios: isIos({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 }),
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    inAppBrowser: IN_APP_BROWSER.test(navigator.userAgent),
    serviceWorker: Boolean(registration),
    serverEnabled: pushApi && Boolean(registration) ? Boolean(await serverKey()) : true,
    permission: pushApi ? Notification.permission : 'default',
    subscribed: Boolean(subscription),
  });
}

function subscriptionBody(subscription: PushSubscription, application: PushApplication) {
  const json = subscription.toJSON();
  return JSON.stringify({
    endpoint: json.endpoint,
    keys: json.keys,
    app: application,
    device_label: deviceLabel(navigator.userAgent),
    origin: location.origin,
  });
}

// Bật trên máy này: chỉ gọi khi người dùng bấm (trình duyệt chỉ hỏi quyền theo thao tác của người dùng)
export async function enablePush(base: string, application: PushApplication, request: PushRequest): Promise<PushState> {
  const registration = await currentRegistration(base);
  const key = await serverKey();
  if (!registration || !key) {
    return readPushState(base);
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return readPushState(base);
  }
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(key) }));
  await request('/api/v1/push/subscriptions', { method: 'POST', body: subscriptionBody(subscription, application) });
  return readPushState(base);
}

// Tắt trên máy này: thu hồi ở máy chủ rồi hủy đăng ký của trình duyệt
export async function disablePush(base: string, request: PushRequest): Promise<PushState> {
  const registration = await currentRegistration(base);
  const subscription = registration ? await registration.pushManager?.getSubscription() : null;
  if (subscription) {
    try {
      await request('/api/v1/push/subscriptions/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    } finally {
      await subscription.unsubscribe();
    }
  }
  return readPushState(base);
}

// Mở ứng dụng khi đã đăng nhập: máy đang có đăng ký thì báo lại cho máy chủ (cập nhật lần thấy gần nhất, chuyển đăng ký sang người
// đang đăng nhập trên máy). Không hỏi quyền, không tự bật
export async function syncPush(base: string, application: PushApplication, request: PushRequest): Promise<void> {
  try {
    const registration = await currentRegistration(base);
    const subscription = registration ? await registration.pushManager?.getSubscription() : null;
    if (subscription && Notification.permission === 'granted') {
      await request('/api/v1/push/subscriptions', {
        method: 'POST',
        body: subscriptionBody(subscription, application),
      });
    }
  } catch {
    // Máy chủ chưa bật đẩy hoặc mất mạng: lần mở sau thử lại
  }
}

// Đăng xuất: máy dùng chung không nhận đẩy của người dùng trước. Gọi trước khi xóa phiên (cần mã phiên để thu hồi ở máy chủ)
export async function revokePushOnSignOut(base: string, request: PushRequest): Promise<void> {
  try {
    await disablePush(base, request);
  } catch {
    // Không thu hồi được ở máy chủ: đăng ký của trình duyệt đã hủy, máy chủ dọn khi gửi lỗi 404, 410
  }
}

// Trang nhận tin của service worker: chạm thông báo (PUSH_OPENED) hoặc trình duyệt đổi đăng ký (PUSH_SUBSCRIPTION_CHANGED)
export function onServiceWorkerMessage(listener: (message: { type: string; notification_id?: string | null }) => void) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => undefined;
  }
  const handler = (event: MessageEvent) => {
    if (event.data && typeof event.data.type === 'string') {
      listener(event.data);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
