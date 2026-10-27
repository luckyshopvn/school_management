import { appendFile } from 'node:fs/promises';
import webPush from 'web-push';
import { ApnsSender } from './apns-sender.js';
import { FcmSender } from './fcm-sender.js';
import type { PushMessage } from './push-groups.js';
import {
  PushSender,
  TIME_TO_LIVE_SECONDS,
  type PushCredentials,
  type PushKind,
  type PushSendOutcome,
  type PushTarget,
} from './push-transport.js';

export * from './push-transport.js';

// Bộ nối gửi thông báo đẩy (DT-26 phần 26b, YCTD-232; phần 26g, YCTD-237): một bộ phát, nhiều bộ nối chọn bằng cấu hình, không có
// `if` theo nhà cung cấp trong mã nghiệp vụ. Mỗi đăng ký có loại (`web_push`, `fcm`, `apns`); bộ định tuyến chọn bộ nối theo loại:
// - `web_push`: PUSH_PROVIDER=`web-push` (RFC 8030, mã hóa nội dung RFC 8291, khóa VAPID RFC 8292) hoặc `development`;
// - `fcm` (Android, Firebase Cloud Messaging HTTP v1), `apns` (iOS, Apple Push Notification service, khóa `.p8`):
//   PUSH_NATIVE_PROVIDER=`native` hoặc `development`;
// - `development`: giả lập, ghi lại từng lần gửi (trong bộ nhớ và, nếu đặt, tệp PUSH_DEVELOPMENT_OUTBOX) cho kiểm thử đọc.
// Kết quả `expired`: dịch vụ đẩy báo đăng ký không còn, tiến trình gửi thu hồi đăng ký; `unavailable`: loại đăng ký này chưa có bộ
// nối hoặc thiếu khóa (bộ nối tắt, kênh khác chạy như cũ), không tính là lỗi. Lỗi tạm thời ném ra để thử lại.
export class WebPushSender extends PushSender {
  readonly provider = 'web-push';

  async send(target: PushTarget, message: PushMessage, credentials: PushCredentials): Promise<PushSendOutcome> {
    if (target.kind !== 'web_push') {
      return 'unavailable';
    }
    if (!credentials.vapid) {
      throw new Error('Nền tảng chưa có khóa VAPID (lệnh platform generate-vapid-keys)');
    }
    try {
      await webPush.sendNotification({ endpoint: target.endpoint, keys: target.keys }, JSON.stringify(message), {
        vapidDetails: credentials.vapid,
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
  kind: PushKind;
  // Địa chỉ đăng ký Web Push hoặc mã thiết bị FCM, APNs
  endpoint: string;
  message: PushMessage;
}

// Giả lập: địa chỉ hoặc mã thiết bị chứa `het-han` trả hết hạn, chứa `/loi` hoặc `loi-tam` ném lỗi, còn lại ghi nhận đã gửi
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
    const endpoint = target.kind === 'web_push' ? target.endpoint : target.token;
    if (endpoint.includes('het-han')) {
      return 'expired';
    }
    if (endpoint.includes('/loi') || endpoint.includes('loi-tam')) {
      throw new Error('Dịch vụ đẩy giả lập trả lỗi');
    }
    const delivery = {
      at: new Date().toISOString(),
      school: this.schoolOf(),
      kind: target.kind,
      endpoint,
      message,
    };
    this.deliveries.push(delivery);
    if (this.outbox) {
      await appendFile(this.outbox, `${JSON.stringify(delivery)}\n`, 'utf8');
    }
    return 'sent';
  }
}

// Bộ định tuyến: chọn bộ nối theo loại đăng ký; loại chưa có bộ nối trả `unavailable`
export class PushSenderRouter extends PushSender {
  readonly provider: string;

  constructor(private readonly senders: Partial<Record<PushKind, PushSender>>) {
    super();
    this.provider = [...new Set(Object.values(senders).map((sender) => sender.provider))].join(',');
  }

  senderFor(kind: PushKind): PushSender | null {
    return this.senders[kind] ?? null;
  }

  async send(target: PushTarget, message: PushMessage, credentials: PushCredentials): Promise<PushSendOutcome> {
    const sender = this.senders[target.kind];
    return sender ? sender.send(target, message, credentials) : 'unavailable';
  }
}

export interface PushSenderOptions {
  outbox: string | null;
  schoolOf: () => string | null;
  // Địa chỉ dịch vụ FCM, APNs; kiểm thử trỏ tới máy chủ giả lập
  fcmBaseUrl?: string | null;
  fcmTokenUrl?: string | null;
  apnsHost?: string | null;
}

// Chọn bộ nối theo cấu hình; không cấu hình kênh nào thì không gửi đẩy (trả null)
export function createPushSender(
  provider: 'development' | 'web-push' | null | undefined,
  nativeProvider: 'development' | 'native' | null | undefined,
  options: PushSenderOptions,
): PushSenderRouter | null {
  if (!provider && !nativeProvider) {
    return null;
  }
  const development =
    provider === 'development' || nativeProvider === 'development'
      ? new DevelopmentPushSender(options.outbox, options.schoolOf)
      : null;
  const web = provider === 'web-push' ? new WebPushSender() : provider === 'development' ? development : null;
  const native = (real: PushSender) =>
    nativeProvider === 'native' ? real : nativeProvider === 'development' ? development : null;
  const senders: Partial<Record<PushKind, PushSender>> = {};
  const fcm = native(new FcmSender({ baseUrl: options.fcmBaseUrl, tokenUrl: options.fcmTokenUrl }));
  const apns = native(new ApnsSender({ host: options.apnsHost }));
  if (web) {
    senders.web_push = web;
  }
  if (fcm) {
    senders.fcm = fcm;
  }
  if (apns) {
    senders.apns = apns;
  }
  return new PushSenderRouter(senders);
}

// Mã tiêm phụ thuộc của bộ định tuyến đang dùng (null khi chưa bật đẩy)
export const PUSH_SENDER = Symbol('PUSH_SENDER');
