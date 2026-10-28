import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  AccessTokenVerifier,
  Clock,
  PARENT_ORG_TOKEN_AUDIENCE,
  PARENT_ORG_TOKEN_KIND,
  PARENT_ORG_TOKEN_LIFETIME_SECONDS,
  ParentOrgTokenVerifier,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  TOKEN_SIGNING_ALGORITHM,
  type AccessTokenClaims,
} from '@school-management/server';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import { currentTenant, isMultiTenantMode, unauthenticatedError } from '@school-management/server';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';

export const OPERATOR_TOKEN_AUDIENCE = 'school-management-platform';
// Phiên vận hành nền tảng tối đa 8 giờ, không có mã làm mới; "Ghi nhớ" ở trang đăng nhập cổng vận hành chỉ nhớ tên đăng nhập trên trình
// duyệt, không kéo dài phiên (Eric chốt, YCTD-353, GD-172)
export const OPERATOR_TOKEN_LIFETIME_SECONDS = 8 * 3600;

// Mã phiên ký bằng Ed25519 (QĐ-22); hết hạn sau 15 phút (XT-02)
@Injectable()
export class TokenService {
  private privateKey?: Promise<CryptoKey>;
  private readonly verifier: AccessTokenVerifier;
  private parentOrgVerifier?: ParentOrgTokenVerifier;

  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly clock: Clock,
  ) {
    this.verifier = new AccessTokenVerifier(
      configuration.tokenPublicKeyPem,
      configuration.tokenPreviousPublicKeyPem ?? null,
    );
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    this.privateKey ??= importPKCS8(this.configuration.tokenPrivateKeyPem, TOKEN_SIGNING_ALGORITHM);
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    // Nhiều trường: mã phiên mang mã trường (claim `tid`; `sid` đã là mã phiên) để máy chủ API và dịch vụ định danh từ chối mã
    // phiên của trường này khi dùng ở tên miền của trường khác (DT-SaaS phần S1a)
    const tenantId = currentTenant()?.schoolId;
    return new SignJWT({
      sid: claims.sessionId,
      channel: claims.channel,
      password_change_required: claims.passwordChangeRequired,
      ...(tenantId ? { tid: tenantId } : {}),
      // Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): phạm vi chỉ đọc hoặc toàn quyền
      ...(claims.support ? { spt: claims.support } : {}),
    })
      .setProtectedHeader({ alg: TOKEN_SIGNING_ALGORITHM })
      .setSubject(claims.userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
      .sign(await this.privateKey);
  }

  // Mã phiên của người vận hành nền tảng (DT-SaaS phần S1a): đối tượng riêng nên máy chủ API và dịch vụ của trường không nhận, và
  // mã phiên của trường không dùng được ở cổng nền tảng; hạn 8 giờ
  async signOperatorToken(operatorId: string): Promise<string> {
    this.privateKey ??= importPKCS8(this.configuration.tokenPrivateKeyPem, TOKEN_SIGNING_ALGORITHM);
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    return new SignJWT({ kind: 'platform_operator' })
      .setProtectedHeader({ alg: TOKEN_SIGNING_ALGORITHM })
      .setSubject(operatorId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(OPERATOR_TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + OPERATOR_TOKEN_LIFETIME_SECONDS)
      .sign(await this.privateKey);
  }

  // Mã phiên của tài khoản cấp trên (DT-SaaS phần S6): đối tượng riêng, máy chủ API kiểm bằng ParentOrgTokenVerifier
  async signParentOrgToken(userId: string): Promise<string> {
    this.privateKey ??= importPKCS8(this.configuration.tokenPrivateKeyPem, TOKEN_SIGNING_ALGORITHM);
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    return new SignJWT({ kind: PARENT_ORG_TOKEN_KIND })
      .setProtectedHeader({ alg: TOKEN_SIGNING_ALGORITHM })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(PARENT_ORG_TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + PARENT_ORG_TOKEN_LIFETIME_SECONDS)
      .sign(await this.privateKey);
  }

  verifyParentOrgToken(token: string): Promise<string> {
    this.parentOrgVerifier ??= new ParentOrgTokenVerifier(
      this.configuration.tokenPublicKeyPem,
      this.configuration.tokenPreviousPublicKeyPem ?? null,
    );
    return this.parentOrgVerifier.verify(token, this.clock.now());
  }

  async verifyOperatorToken(token: string): Promise<string> {
    // Khóa cũ vẫn được nhận trong thời gian xoay khóa ký (DT-SaaS phần S8b)
    for (const pem of [this.configuration.tokenPublicKeyPem, this.configuration.tokenPreviousPublicKeyPem]) {
      if (!pem) {
        continue;
      }
      try {
        const key = await importSPKI(pem, TOKEN_SIGNING_ALGORITHM);
        const { payload } = await jwtVerify(token, key, {
          issuer: TOKEN_ISSUER,
          audience: OPERATOR_TOKEN_AUDIENCE,
          algorithms: [TOKEN_SIGNING_ALGORITHM],
          currentDate: this.clock.now(),
        });
        if (typeof payload.sub !== 'string' || payload.kind !== 'platform_operator') {
          throw unauthenticatedError();
        }
        return payload.sub;
      } catch {
        // Thử khóa kế tiếp
      }
    }
    throw unauthenticatedError();
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const claims = await this.verifier.verify(token, this.clock.now());
    // Nhiều trường: mã phiên phải mang đúng mã trường của tên miền; mã phiên của trường khác bị từ chối
    if (isMultiTenantMode() && (!claims.tenantId || claims.tenantId !== currentTenant()?.schoolId)) {
      throw unauthenticatedError();
    }
    return claims;
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
