// Trạng thái thông báo đẩy trên máy đang dùng (DT-26 phần 26b, YCTD-232). Hàm thuần để kiểm thử đơn vị được:
// - 'unsupported': trình duyệt không có Web Push (trình duyệt cũ, trình duyệt nhúng của Zalo, Facebook);
// - 'needs-install': iPhone, iPad (iOS 16.4 trở lên) chỉ nhận đẩy khi ứng dụng đã cài lên màn hình chính và mở từ biểu tượng;
// - 'no-service-worker': ứng dụng chưa có service worker (ứng dụng giáo viên khi trường tắt ngoại tuyến, GD-108);
// - 'server-disabled': nền tảng chưa bật đẩy (chưa có khóa VAPID);
// - 'denied': người dùng đã chặn thông báo của trang; chỉ mở lại được ở cài đặt của trình duyệt;
// - 'off': chưa bật trên máy này; 'on': máy này đang nhận đẩy
export type PushState =
  'unsupported' | 'needs-install' | 'no-service-worker' | 'server-disabled' | 'denied' | 'off' | 'on';

export interface PushEnvironment {
  // 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  pushApi: boolean;
  ios: boolean;
  standalone: boolean;
  inAppBrowser: boolean;
  serviceWorker: boolean;
  serverEnabled: boolean;
  permission: 'default' | 'granted' | 'denied';
  subscribed: boolean;
}

export function detectPushState(environment: PushEnvironment): PushState {
  if (environment.inAppBrowser) {
    return 'unsupported';
  }
  // iOS chỉ có PushManager khi đã cài lên màn hình chính, nên kiểm iOS trước khi kết luận không hỗ trợ
  if (environment.ios && !environment.standalone) {
    return 'needs-install';
  }
  if (!environment.pushApi) {
    return 'unsupported';
  }
  if (!environment.serviceWorker) {
    return 'no-service-worker';
  }
  if (!environment.serverEnabled) {
    return 'server-disabled';
  }
  if (environment.permission === 'denied') {
    return 'denied';
  }
  return environment.subscribed && environment.permission === 'granted' ? 'on' : 'off';
}

// Khóa VAPID công khai (base64url) thành mảng byte cho pushManager.subscribe
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// Nhãn thiết bị ngắn tự sinh (loại máy, trình duyệt), không gửi nguyên chuỗi nhận dạng trình duyệt lên máy chủ
export function deviceLabel(userAgent: string): string {
  const device = /iPad/.test(userAgent)
    ? 'iPad'
    : /iPhone/.test(userAgent)
      ? 'iPhone'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Macintosh/.test(userAgent)
            ? 'Mac'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'Máy khác';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /(Firefox|FxiOS)\//.test(userAgent)
      ? 'Firefox'
      : /(Chrome|CriOS)\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'trình duyệt';
  return `${device} · ${browser}`;
}
