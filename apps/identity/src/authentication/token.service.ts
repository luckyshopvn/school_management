import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionChannel } from '@school-management/database';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import { unauthenticatedError } from '../common/application-error.js';
import { Clock } from '../common/clock.js';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';

export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
export const TOKEN_ISSUER = 'school-management-identity';
export const TOKEN_AUDIENCE = 'school-management';
const SIGNING_ALGORITHM = 'EdDSA';

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  channel: SessionChannel;
  passwordChangeRequired: boolean;
}

// Mã phiên ký bằng Ed25519 (QĐ-22); hết hạn sau 15 phút (XT-02)
@Injectable()
export class TokenService {
  private privateKey?: Promise<CryptoKey>;
  private publicKey?: Promise<CryptoKey>;

  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly clock: Clock,
  ) {}

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    this.privateKey ??= importPKCS8(this.configuration.tokenPrivateKeyPem, SIGNING_ALGORITHM);
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    return new SignJWT({
      sid: claims.sessionId,
      channel: claims.channel,
      password_change_required: claims.passwordChangeRequired,
    })
      .setProtectedHeader({ alg: SIGNING_ALGORITHM })
      .setSubject(claims.userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
      .sign(await this.privateKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    this.publicKey ??= importSPKI(this.configuration.tokenPublicKeyPem, SIGNING_ALGORITHM);
    try {
      const { payload } = await jwtVerify(token, await this.publicKey, {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        algorithms: [SIGNING_ALGORITHM],
        currentDate: this.clock.now(),
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

// Mã làm mới gồm mã phiên và phần bí mật ngẫu nhiên; chỉ lưu giá trị băm của mã
export function createRefreshToken(sessionId: string): { token: string; hash: string } {
  const token = `${sessionId}.${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionIdFromRefreshToken(token: string): string | undefined {
  const [sessionId, secret] = token.split('.');
  if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) {
    return undefined;
  }
  return sessionId;
}
