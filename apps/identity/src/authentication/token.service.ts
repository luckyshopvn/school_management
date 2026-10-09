import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  AccessTokenVerifier,
  Clock,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  TOKEN_SIGNING_ALGORITHM,
  type AccessTokenClaims,
} from '@school-management/server';
import { importPKCS8, SignJWT, type CryptoKey } from 'jose';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';

// Mã phiên ký bằng Ed25519 (QĐ-22); hết hạn sau 15 phút (XT-02)
@Injectable()
export class TokenService {
  private privateKey?: Promise<CryptoKey>;
  private readonly verifier: AccessTokenVerifier;

  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly clock: Clock,
  ) {
    this.verifier = new AccessTokenVerifier(configuration.tokenPublicKeyPem);
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    this.privateKey ??= importPKCS8(this.configuration.tokenPrivateKeyPem, TOKEN_SIGNING_ALGORITHM);
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    return new SignJWT({
      sid: claims.sessionId,
      channel: claims.channel,
      password_change_required: claims.passwordChangeRequired,
    })
      .setProtectedHeader({ alg: TOKEN_SIGNING_ALGORITHM })
      .setSubject(claims.userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
      .sign(await this.privateKey);
  }

  verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.verifier.verify(token, this.clock.now());
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
