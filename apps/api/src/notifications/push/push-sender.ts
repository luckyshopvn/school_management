import { appendFile } from 'node:fs/promises';
import webPush from 'web-push';
import type { PushMessage } from './push-groups.js';

// Bộ nối gửi thông báo đẩy (DT-26 phần 26b, YCTD-232): một bộ phát, nhiều bộ nối chọn bằng cấu hình PUSH_PROVIDER, không có `if` theo
// nhà cung cấp trong mã nghiệp vụ:
// - `web-push`: giao thức Web Push (RFC 8030), mã hóa nội dung theo RFC 8291, xác thực máy chủ bằng khóa VAPID (RFC 8292);
// - `development`: giả lập, ghi lại từng lần gửi (trong bộ nhớ và, nếu đặt, tệp PUSH_DEVELOPMENT_OUTBOX) cho kiểm thử đọc;
// - chừa `fcm`, `apns` cho phần 26g (cùng giao diện, mã thiết bị thay cho địa chỉ đăng ký).
// Kết quả `expired`: dịch vụ đẩy báo đăng ký không còn (404, 410), tiến trình gửi thu hồi đăng ký. Lỗi tạm thời ném ra để thử lại.
export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidCredentials {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export type PushSendOutcome = 'sent' | 'expired';

export abstract class PushSender {
  abstract readonly provider: string;
  abstract send(target: PushTarget, message: PushMessage, vapid: VapidCredentials | null): Promise<PushSendOutcome>;
}

// Thời gian dịch vụ đẩy giữ thông báo khi máy đang tắt: 1 ngày
const TIME_TO_LIVE_SECONDS = 86_400;

export class WebPushSender extends PushSender {
  readonly provider = 'web-push';

  async send(target: PushTarget, message: PushMessage, vapid: VapidCredentials | null): Promise<PushSendOutcome> {
    if (!vapid) {
      throw new Error('Nền tảng chưa có khóa VAPID (lệnh platform generate-vapid-keys)');
    }
    try {
      await webPush.sendNotification(target, JSON.stringify(message), {
        vapidDetails: vapid,
        TTL: TIME_TO_LIVE_SECONDS,
        urgency: 'normal',
        topic: message.tag.slice(0, 32),
        timeout: 10_000,
      });
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        return 'expired';
      }
      throw new Error(`Dịch vụ đẩy trả lỗi${status ? ` ${status}` : ''}`, { cause: error });
    }
  }
}

export interface DevelopmentPushDelivery {
  at: string;
  school: string | null;
  endpoint: string;
  message: PushMessage;
}

// Giả lập: địa chỉ chứa `/het-han` trả hết hạn, chứa `/loi` ném lỗi, còn lại ghi nhận đã gửi
export class DevelopmentPushSender extends PushSender {
  readonly provider = 'development';
  readonly deliveries: DevelopmentPushDelivery[] = [];

  constructor(
    private readonly outbox: string | null = null,
    private readonly schoolOf: () => string | null = () => null,
  ) {
    super();
  }

  async send(target: PushTarget, message: PushMessage): Promise<PushSendOutcome> {
    if (target.endpoint.includes('/het-han')) {
      return 'expired';
    }
    if (target.endpoint.includes('/loi')) {
      throw new Error('Dịch vụ đẩy giả lập trả lỗi');
    }
    const delivery = { at: new Date().toISOString(), school: this.schoolOf(), endpoint: target.endpoint, message };
    this.deliveries.push(delivery);
    if (this.outbox) {
      await appendFile(this.outbox, `${JSON.stringify(delivery)}\n`, 'utf8');
    }
    return 'sent';
  }
}

const SENDERS: Record<
  'development' | 'web-push',
  (options: { outbox: string | null; schoolOf: () => string | null }) => PushSender
> = {
  development: (options) => new DevelopmentPushSender(options.outbox, options.schoolOf),
  'web-push': () => new WebPushSender(),
};

// Chọn bộ nối theo cấu hình; không cấu hình thì không gửi đẩy (trả null)
export function createPushSender(
  provider: 'development' | 'web-push' | null | undefined,
  options: { outbox: string | null; schoolOf: () => string | null },
): PushSender | null {
  return provider ? SENDERS[provider](options) : null;
}

// Mã tiêm phụ thuộc của bộ nối đang dùng (null khi chưa bật đẩy)
export const PUSH_SENDER = Symbol('PUSH_SENDER');
