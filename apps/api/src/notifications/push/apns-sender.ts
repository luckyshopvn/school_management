import { connect, constants, type ClientHttp2Session } from 'node:http2';
import type { ApnsCredentials } from '@school-management/database';
import { importPKCS8, SignJWT } from 'jose';
import type { PushMessage } from './push-groups.js';
import {
  PushSender,
  TIME_TO_LIVE_SECONDS,
  type PushCredentials,
  type PushSendOutcome,
  type PushTarget,
} from './push-transport.js';

// Bộ nối APNs (DT-26 phần 26g, YCTD-237): Apple Push Notification service qua HTTP/2, xác thực bằng khóa dạng mã thông báo `.p8`.
// - Mã xác thực JWT ES256 (kid là mã khóa, iss là mã đội) dùng lại tối đa 40 phút (Apple không cho làm mới dưới 20 phút, hết hạn sau
//   60 phút); máy chủ trả 403 ExpiredProviderToken, InvalidProviderToken thì ký lại ở lần sau.
// - Giữ một kết nối HTTP/2 cho mỗi máy chủ APNs, kết nối hỏng thì mở lại ở lần gửi sau.
// - Mã lỗi theo tài liệu Apple: 410 Unregistered, 400 BadDeviceToken, DeviceTokenNotForTopic là mã thiết bị không còn dùng được
//   (thu hồi); 403, 429, 5xx là lỗi tạm thời (thử lại).
const HOSTS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' } as const;
const PROVIDER_TOKEN_MILLISECONDS = 40 * 60_000;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const EXPIRED_REASONS = new Set(['Unregistered', 'BadDeviceToken', 'DeviceTokenNotForTopic']);

export function apnsTokenExpired(status: number, reason: string | null): boolean {
  return status === 410 || (status === 400 && reason !== null && EXPIRED_REASONS.has(reason));
}

export function apnsPayload(message: PushMessage) {
  return {
    aps: { alert: { title: message.title, body: message.body }, 'thread-id': message.tag, sound: 'default' },
    ...message.data,
  };
}

export class ApnsSender extends PushSender {
  readonly provider = 'apns';
  private readonly host: string | null;
  private readonly sessions = new Map<string, ClientHttp2Session>();
  private providerToken: { value: string; issuedAt: number; keyId: string } | null = null;

  constructor(options: { host?: string | null } = {}) {
    super();
    this.host = options.host ?? null;
  }

  private async bearer(credentials: ApnsCredentials): Promise<string> {
    const now = Date.now();
    if (
      this.providerToken &&
      this.providerToken.keyId === credentials.keyId &&
      now - this.providerToken.issuedAt < PROVIDER_TOKEN_MILLISECONDS
    ) {
      return this.providerToken.value;
    }
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: credentials.keyId })
      .setIssuer(credentials.teamId)
      .setIssuedAt(Math.floor(now / 1000))
      .sign(await importPKCS8(credentials.privateKey, 'ES256'));
    this.providerToken = { value, issuedAt: now, keyId: credentials.keyId };
    return value;
  }

  private session(host: string): ClientHttp2Session {
    const existing = this.sessions.get(host);
    if (existing && !existing.closed && !existing.destroyed) {
      return existing;
    }
    const session = connect(host);
    session.on('error', () => this.sessions.delete(host));
    session.on('close', () => this.sessions.delete(host));
    // Kết nối không giữ tiến trình chạy khi không còn việc
    session.unref();
    this.sessions.set(host, session);
    return session;
  }

  close(): void {
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
  }

  async send(target: PushTarget, message: PushMessage, credentials: PushCredentials): Promise<PushSendOutcome> {
    if (target.kind !== 'apns' || !credentials.apns) {
      return 'unavailable';
    }
    const apns = credentials.apns;
    const host = this.host ?? HOSTS[apns.environment];
    const authorization = `bearer ${await this.bearer(apns)}`;
    const body = JSON.stringify(apnsPayload(message));
    const { status, reason } = await new Promise<{ status: number; reason: string | null }>((resolve, reject) => {
      const request = this.session(host).request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${encodeURIComponent(target.token)}`,
        authorization,
        'apns-topic': apns.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + TIME_TO_LIVE_SECONDS),
        'apns-collapse-id': message.tag.slice(0, 64),
        'content-type': 'application/json',
      });
      request.setTimeout(REQUEST_TIMEOUT_MILLISECONDS, () => request.close(constants.NGHTTP2_CANCEL));
      let responseStatus = 0;
      let text = '';
      request.setEncoding('utf8');
      request.on('response', (headers) => {
        responseStatus = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0);
      });
      request.on('data', (chunk: string) => {
        text += chunk;
      });
      request.on('end', () => {
        let parsed: { reason?: string };
        try {
          parsed = text ? (JSON.parse(text) as { reason?: string }) : {};
        } catch {
          parsed = {};
        }
        resolve({ status: responseStatus, reason: typeof parsed.reason === 'string' ? parsed.reason : null });
      });
      request.on('error', reject);
      request.end(body);
    });
    if (status === 200) {
      return 'sent';
    }
    if (apnsTokenExpired(status, reason)) {
      return 'expired';
    }
    if (status === 403) {
      this.providerToken = null;
    }
    throw new Error(`APNs trả lỗi ${status || 'không phản hồi'}${reason ? ` ${reason}` : ''}`);
  }
}
