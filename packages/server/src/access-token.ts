import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { unauthenticatedError } from './application-error.js';

// Mã phiên do dịch vụ định danh ký bằng Ed25519; bên kiểm tra chỉ cần khóa công khai (QĐ-22)
export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
export const TOKEN_ISSUER = 'school-management-identity';
export const TOKEN_AUDIENCE = 'school-management';
export const TOKEN_SIGNING_ALGORITHM = 'EdDSA';

export type SessionChannel = 'portal' | 'teacher' | 'parent';

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  channel: SessionChannel;
  passwordChangeRequired: boolean;
  // Mã trường (claim `tid`), có khi dịch vụ định danh chạy ở chế độ nhiều trường; bên kiểm tra so với trường của tên miền (S1a).
  // Không dùng `sid` vì claim đó đã là mã phiên
  tenantId?: string;
}

// Xoay khóa ký (DT-SaaS phần S8b, tài liệu 32 mục 14.5): trong thời gian xoay, bên kiểm tra nhận cả khóa công khai mới và khóa cũ
// (TOKEN_PREVIOUS_PUBLIC_KEY); mã phiên cũ sống tối đa ACCESS_TOKEN_LIFETIME_SECONDS (15 phút) nên gỡ khóa cũ sau chừng đó
export class AccessTokenVerifier {
  private publicKeys?: Promise<CryptoKey[]>;

  constructor(
    private readonly publicKeyPem: string,
    private readonly previousPublicKeyPem: string | null = null,
  ) {}

  private keys(): Promise<CryptoKey[]> {
    this.publicKeys ??= Promise.all(
      [this.publicKeyPem, this.previousPublicKeyPem]
        .filter((pem): pem is string => Boolean(pem))
        .map((pem) => importSPKI(pem, TOKEN_SIGNING_ALGORITHM)),
    );
    return this.publicKeys;
  }

  async verify(token: string, now: Date): Promise<AccessTokenClaims> {
    for (const key of await this.keys()) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
          algorithms: [TOKEN_SIGNING_ALGORITHM],
          currentDate: now,
        });
        if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || typeof payload.channel !== 'string') {
          throw unauthenticatedError();
        }
        return {
          userId: payload.sub,
          sessionId: payload.sid,
          channel: payload.channel as SessionChannel,
          passwordChangeRequired: payload.password_change_required === true,
          ...(typeof payload.tid === 'string' ? { tenantId: payload.tid } : {}),
        };
      } catch {
        // Thử khóa kế tiếp (khóa cũ khi đang xoay khóa)
      }
    }
    throw unauthenticatedError();
  }
}

// Khóa lưu trong biến môi trường ở dạng PEM mã hóa base64 để nằm trên một dòng
export function decodeBase64Key(base64Value: string): string {
  return Buffer.from(base64Value, 'base64').toString('utf8');
}

// Đọc mã phiên từ tiêu đề Authorization dạng "Bearer <mã>"
export function readBearerToken(authorizationHeader: string | undefined): string {
  const [scheme, token] = (authorizationHeader ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw unauthenticatedError();
  }
  return token;
}
