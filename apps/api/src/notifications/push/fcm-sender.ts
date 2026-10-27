import type { FcmCredentials } from '@school-management/database';
import { importPKCS8, SignJWT } from 'jose';
import type { PushMessage } from './push-groups.js';
import {
  PushSender,
  TIME_TO_LIVE_SECONDS,
  type PushCredentials,
  type PushSendOutcome,
  type PushTarget,
} from './push-transport.js';

// Bộ nối FCM (DT-26 phần 26g, YCTD-237): Firebase Cloud Messaging giao thức HTTP v1 cho ứng dụng Android.
// - Xác thực: tài khoản dịch vụ ký JWT RS256 đổi lấy mã truy cập OAuth 2.0 (phạm vi firebase.messaging), giữ đến 1 phút trước khi hết
//   hạn; máy chủ trả 401 thì bỏ mã đang giữ và thử lại ở lần sau.
// - Nội dung giống Web Push (nhóm, tên trường, mã thông báo), không có dữ liệu cá nhân: nội dung FCM không mã hóa đầu cuối.
// - Mã lỗi theo tài liệu FCM: 404 UNREGISTERED, 403 SENDER_ID_MISMATCH, 400 INVALID_ARGUMENT về mã thiết bị là mã không còn dùng được
//   (thu hồi); 401, 429, 5xx là lỗi tạm thời (thử lại).
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const DEFAULT_BASE_URL = 'https://fcm.googleapis.com';
const DEFAULT_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_MARGIN_MILLISECONDS = 60_000;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

interface FcmErrorBody {
  error?: { code?: number; status?: string; message?: string; details?: { '@type'?: string; errorCode?: string }[] };
}

export function fcmErrorCode(body: FcmErrorBody): string | null {
  const detail = body.error?.details?.find((item) => typeof item.errorCode === 'string');
  return detail?.errorCode ?? body.error?.status ?? null;
}

// Mã thiết bị không còn dùng được: thu hồi đăng ký thay vì thử lại
export function fcmTokenExpired(status: number, body: FcmErrorBody): boolean {
  const code = fcmErrorCode(body);
  if (code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH') {
    return true;
  }
  return status === 400 && code === 'INVALID_ARGUMENT' && /registration token/i.test(body.error?.message ?? '');
}

export function fcmPayload(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { ...message.data },
      android: {
        ttl: `${TIME_TO_LIVE_SECONDS}s`,
        collapse_key: message.tag,
        notification: { tag: message.tag },
      },
    },
  };
}

export class FcmSender extends PushSender {
  readonly provider = 'fcm';
  private readonly baseUrl: string;
  private readonly tokenUrl: string;
  private accessToken: { value: string; expiresAt: number; clientEmail: string } | null = null;

  constructor(options: { baseUrl?: string | null; tokenUrl?: string | null } = {}) {
    super();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.tokenUrl = options.tokenUrl ?? DEFAULT_TOKEN_URL;
  }

  private async token(credentials: FcmCredentials): Promise<string> {
    const now = Date.now();
    if (
      this.accessToken &&
      this.accessToken.clientEmail === credentials.clientEmail &&
      this.accessToken.expiresAt - TOKEN_MARGIN_MILLISECONDS > now
    ) {
      return this.accessToken.value;
    }
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(credentials.clientEmail)
      .setAudience(this.tokenUrl)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(now / 1000) + 3600)
      .sign(await importPKCS8(credentials.privateKey, 'RS256'));
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
    });
    if (!response.ok) {
      throw new Error(`Không lấy được mã truy cập FCM (${response.status})`);
    }
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new Error('Máy chủ xác thực của Google không trả mã truy cập FCM');
    }
    this.accessToken = {
      value: body.access_token,
      expiresAt: now + (body.expires_in ?? 3600) * 1000,
      clientEmail: credentials.clientEmail,
    };
    return body.access_token;
  }

  async send(target: PushTarget, message: PushMessage, credentials: PushCredentials): Promise<PushSendOutcome> {
    if (target.kind !== 'fcm' || !credentials.fcm) {
      return 'unavailable';
    }
    const response = await fetch(
      `${this.baseUrl}/v1/projects/${encodeURIComponent(credentials.fcm.projectId)}/messages:send`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.token(credentials.fcm)}`,
          'content-type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(fcmPayload(target.token, message)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      },
    );
    if (response.ok) {
      return 'sent';
    }
    const body = (await response.json().catch(() => ({}))) as FcmErrorBody;
    if (fcmTokenExpired(response.status, body)) {
      return 'expired';
    }
    if (response.status === 401) {
      this.accessToken = null;
    }
    throw new Error(`FCM trả lỗi ${response.status}${fcmErrorCode(body) ? ` ${fcmErrorCode(body)}` : ''}`);
  }
}
