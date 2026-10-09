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
}

export class AccessTokenVerifier {
  private publicKey?: Promise<CryptoKey>;

  constructor(private readonly publicKeyPem: string) {}

  async verify(token: string, now: Date): Promise<AccessTokenClaims> {
    this.publicKey ??= importSPKI(this.publicKeyPem, TOKEN_SIGNING_ALGORITHM);
    try {
      const { payload } = await jwtVerify(token, await this.publicKey, {
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
      };
    } catch {
      throw unauthenticatedError();
    }
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
