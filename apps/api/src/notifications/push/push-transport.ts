import type { ApnsCredentials, FcmCredentials } from '@school-management/database';
import type { PushMessage } from './push-groups.js';

// Kiểu dùng chung của các bộ nối đẩy (DT-26 phần 26b, 26g): tách khỏi push-sender.ts để bộ nối FCM, APNs kế thừa mà không vòng
// phụ thuộc
export type PushKind = 'web_push' | 'fcm' | 'apns';

export type PushTarget =
  | { kind: 'web_push'; endpoint: string; keys: { p256dh: string; auth: string } }
  | { kind: 'fcm' | 'apns'; token: string };

export interface VapidCredentials {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushCredentials {
  vapid: VapidCredentials | null;
  fcm: FcmCredentials | null;
  apns: ApnsCredentials | null;
}

export type PushSendOutcome = 'sent' | 'expired' | 'unavailable';

export abstract class PushSender {
  abstract readonly provider: string;
  abstract send(target: PushTarget, message: PushMessage, credentials: PushCredentials): Promise<PushSendOutcome>;
}

// Thời gian dịch vụ đẩy giữ thông báo khi máy đang tắt: 1 ngày
export const TIME_TO_LIVE_SECONDS = 86_400;
