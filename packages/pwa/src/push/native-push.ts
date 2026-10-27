import type { PushState } from './push-state.js';

// Thông báo đẩy gốc trong ứng dụng cài đặt (DT-26 phần 26g, YCTD-237). Trang của trường mở trong vỏ Capacitor (26f) có cầu nối gốc
// với plugin PushNotifications (vỏ chèn cầu nối cho các tên miền trường được phép); gói không nhập @capacitor nên ứng dụng web chạy
// trên trình duyệt như cũ. Luồng giống Web Push của 26b, cùng điểm cuối của máy chủ:
// - bật (người dùng bấm): xin quyền thông báo (Android 13 trở lên, iOS), lấy mã thiết bị FCM (Android) hoặc APNs (iOS), gửi về
//   `POST /api/v1/push/subscriptions` với `kind`, `token`, `origin` là địa chỉ gốc của ứng dụng web của trường;
// - mở ứng dụng khi đã đăng nhập: lấy lại mã (mã có thể đổi), mã đổi thì thu hồi mã cũ rồi gửi mã mới;
// - tắt, đăng xuất: thu hồi ở máy chủ theo `kind`, `token`, hủy đăng ký của máy;
// - chạm thông báo: báo trang như service worker của Web Push (PUSH_OPENED); thông báo thuộc ứng dụng khác (trường khác, vai trò khác)
//   thì về trang khởi động của vỏ với `#mo=<địa chỉ>`, trang khởi động chỉ mở khi địa chỉ trùng một ứng dụng đã lưu trên máy.
// Mã thiết bị đang dùng giữ ở localStorage của trang (theo tên miền của trường) để thu hồi khi tắt, đăng xuất.
export type NativePushKind = 'fcm' | 'apns';

interface PushToken {
  value: string;
}

interface PermissionStatus {
  receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}

interface ActionPerformed {
  notification: { data?: Record<string, unknown> };
}

interface ListenerHandle {
  remove: () => Promise<void>;
}

export interface NativePushPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  addListener(event: 'registration', listener: (token: PushToken) => void): Promise<ListenerHandle>;
  addListener(event: 'registrationError', listener: (error: { error: string }) => void): Promise<ListenerHandle>;
  addListener(event: 'pushNotificationReceived', listener: (notification: unknown) => void): Promise<ListenerHandle>;
  addListener(
    event: 'pushNotificationActionPerformed',
    listener: (action: ActionPerformed) => void,
  ): Promise<ListenerHandle>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: { PushNotifications?: NativePushPlugin };
}

export interface NativePushTarget {
  kind: NativePushKind;
  plugin: NativePushPlugin;
  // Bản dựng có cấu hình dịch vụ đẩy của máy (Android: google-services.json); chưa có thì không lấy mã thiết bị
  ready: boolean;
}

type PushRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
type PushApplication = 'teacher' | 'parent' | 'student';

const STORAGE_KEY = 'day-goc-ma-thiet-bi';
const REGISTRATION_WAIT_MILLISECONDS = 10_000;

// Cầu nối gốc của vỏ ứng dụng cài đặt; null khi chạy trên trình duyệt. Vỏ Android đặt DAY_GOC_SAN_SANG = false khi bản dựng chưa có
// cấu hình Firebase (gọi register lúc đó làm ứng dụng dừng)
export function nativePush(
  scope: { Capacitor?: CapacitorGlobal; DAY_GOC_SAN_SANG?: unknown } = globalThis as {
    Capacitor?: CapacitorGlobal;
    DAY_GOC_SAN_SANG?: unknown;
  },
): NativePushTarget | null {
  const capacitor = scope.Capacitor;
  const plugin = capacitor?.Plugins?.PushNotifications;
  if (!capacitor?.isNativePlatform?.() || !plugin || capacitor.isPluginAvailable?.('PushNotifications') === false) {
    return null;
  }
  return {
    kind: capacitor.getPlatform?.() === 'ios' ? 'apns' : 'fcm',
    plugin,
    ready: scope.DAY_GOC_SAN_SANG !== false,
  };
}

export interface NativePushEnvironment {
  // Máy chủ có khóa cho loại đẩy của máy và bản dựng có cấu hình dịch vụ đẩy
  serverEnabled: boolean;
  permission: PermissionStatus['receive'];
  stored: boolean;
}

// Hàm thuần: trạng thái đẩy gốc theo máy chủ, quyền của máy, mã đã gửi
export function detectNativePushState(environment: NativePushEnvironment): PushState {
  if (!environment.serverEnabled) {
    return 'server-disabled';
  }
  if (environment.permission === 'denied') {
    return 'denied';
  }
  return environment.stored && environment.permission === 'granted' ? 'on' : 'off';
}

interface StoredToken {
  kind: NativePushKind;
  token: string;
  // Địa chỉ gốc của ứng dụng đã gửi mã (so với `app_url` của thông báo khi chạm)
  appUrl?: string;
}

function storedToken(): StoredToken | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredToken | null;
    return value && typeof value.token === 'string' ? value : null;
  } catch {
    return null;
  }
}

function storeToken(value: StoredToken | null): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Không ghi được (chế độ riêng tư): lần mở sau đồng bộ lại
  }
}

async function serverEnabled(kind: NativePushKind): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/public/push/vapid-public-key', { credentials: 'omit' });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { native?: Partial<Record<NativePushKind, boolean>> };
    return body.native?.[kind] === true;
  } catch {
    return false;
  }
}

// Lấy mã thiết bị: gọi register rồi chờ sự kiện registration (hoặc registrationError, hết 10 giây)
async function deviceToken(plugin: NativePushPlugin): Promise<string> {
  const handles: ListenerHandle[] = [];
  try {
    const token = new Promise<string>((resolve, reject) => {
      void plugin.addListener('registration', (value) => resolve(value.value)).then((handle) => handles.push(handle));
      void plugin
        .addListener('registrationError', (value) => reject(new Error(value.error)))
        .then((handle) => handles.push(handle));
      setTimeout(() => reject(new Error('Máy không trả mã thiết bị')), REGISTRATION_WAIT_MILLISECONDS);
    });
    await plugin.register();
    return await token;
  } finally {
    for (const handle of handles) {
      void handle.remove();
    }
  }
}

function appUrlOf(base: string): string {
  return new URL(base, location.origin).href;
}

function subscriptionBody(target: NativePushTarget, token: string, base: string, application: PushApplication) {
  return JSON.stringify({
    kind: target.kind,
    token,
    app: application,
    origin: appUrlOf(base),
    device_label: target.kind === 'apns' ? 'iPhone · Ứng dụng' : 'Android · Ứng dụng',
  });
}

export async function readNativePushState(target: NativePushTarget): Promise<PushState> {
  const [enabled, permission] = await Promise.all([
    target.ready ? serverEnabled(target.kind) : false,
    target.plugin.checkPermissions().then(
      (status) => status.receive,
      () => 'denied' as const,
    ),
  ]);
  return detectNativePushState({ serverEnabled: enabled, permission, stored: storedToken()?.kind === target.kind });
}

export async function enableNativePush(
  target: NativePushTarget,
  base: string,
  application: PushApplication,
  request: PushRequest,
): Promise<PushState> {
  if (!target.ready || !(await serverEnabled(target.kind))) {
    return readNativePushState(target);
  }
  const permission = await target.plugin.requestPermissions();
  if (permission.receive !== 'granted') {
    return readNativePushState(target);
  }
  const token = await deviceToken(target.plugin);
  await request('/api/v1/push/subscriptions', {
    method: 'POST',
    body: subscriptionBody(target, token, base, application),
  });
  storeToken({ kind: target.kind, token, appUrl: appUrlOf(base) });
  return readNativePushState(target);
}

export async function disableNativePush(target: NativePushTarget, request: PushRequest): Promise<PushState> {
  const stored = storedToken();
  if (stored) {
    try {
      await request('/api/v1/push/subscriptions/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ kind: stored.kind, token: stored.token }),
      });
    } finally {
      storeToken(null);
      await target.plugin.unregister().catch(() => undefined);
    }
  }
  return readNativePushState(target);
}

// Mở ứng dụng khi đã đăng nhập: máy đã bật thì lấy lại mã, báo máy chủ (mã đổi thì thu hồi mã cũ). Không hỏi quyền, không tự bật
export async function syncNativePush(
  target: NativePushTarget,
  base: string,
  application: PushApplication,
  request: PushRequest,
): Promise<void> {
  const stored = storedToken();
  if (!target.ready || !stored || (await target.plugin.checkPermissions()).receive !== 'granted') {
    return;
  }
  const token = await deviceToken(target.plugin);
  if (token !== stored.token) {
    await request('/api/v1/push/subscriptions/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ kind: stored.kind, token: stored.token }),
    }).catch(() => undefined);
  }
  await request('/api/v1/push/subscriptions', {
    method: 'POST',
    body: subscriptionBody(target, token, base, application),
  });
  storeToken({ kind: target.kind, token, appUrl: appUrlOf(base) });
}

// Chạm thông báo thuộc ứng dụng khác: địa chỉ trang khởi động của vỏ kèm `#mo=`; null khi cùng ứng dụng hoặc không biết trang khởi động
export function launcherRedirect(appUrl: unknown, current: string | undefined, launcher: unknown): string | null {
  if (typeof appUrl !== 'string' || !URL.canParse(appUrl) || typeof launcher !== 'string' || !URL.canParse(launcher)) {
    return null;
  }
  if (current && new URL(appUrl).href === current) {
    return null;
  }
  return `${new URL('/', launcher).href}#mo=${encodeURIComponent(new URL(appUrl).href)}`;
}

// Chạm thông báo khi trang đang mở: báo trang như service worker (PUSH_OPENED), hoặc về trang khởi động nếu thông báo thuộc ứng
// dụng khác; thông báo đến khi đang mở: PUSH_RECEIVED
export function onNativePushMessage(
  target: NativePushTarget,
  listener: (message: { type: string; notification_id?: string | null }) => void,
): () => void {
  const handles: Promise<ListenerHandle>[] = [
    target.plugin.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data ?? {};
      const redirect = launcherRedirect(
        data.app_url,
        storedToken()?.appUrl,
        (globalThis as { WEBVIEW_SERVER_URL?: unknown }).WEBVIEW_SERVER_URL,
      );
      if (redirect) {
        location.assign(redirect);
        return;
      }
      const id = data.notification_id;
      listener({ type: 'PUSH_OPENED', notification_id: typeof id === 'string' ? id : null });
    }),
    target.plugin.addListener('pushNotificationReceived', () => listener({ type: 'PUSH_RECEIVED' })),
  ];
  return () => {
    for (const handle of handles) {
      void handle.then((value) => value.remove());
    }
  };
}
