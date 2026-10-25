import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { unauthenticatedError } from './application-error.js';
import { TOKEN_ISSUER, TOKEN_SIGNING_ALGORITHM } from './access-token.js';

// Mã phiên của tài khoản cấp trên (Bộ, Sở, Phòng Văn hóa – Xã hội; DT-SaaS phần S6): dịch vụ định danh ký, đối tượng riêng nên mã
// phiên của trường, của người vận hành không dùng được ở đây và ngược lại; hạn 8 giờ như mã phiên vận hành
export const PARENT_ORG_TOKEN_AUDIENCE = 'school-management-parent-org';
export const PARENT_ORG_TOKEN_KIND = 'parent_org_user';
export const PARENT_ORG_TOKEN_LIFETIME_SECONDS = 8 * 3600;

export class ParentOrgTokenVerifier {
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

  // Trả mã tài khoản cấp trên
  async verify(token: string, now: Date): Promise<string> {
    for (const key of await this.keys()) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: TOKEN_ISSUER,
          audience: PARENT_ORG_TOKEN_AUDIENCE,
          algorithms: [TOKEN_SIGNING_ALGORITHM],
          currentDate: now,
        });
        if (typeof payload.sub === 'string' && payload.kind === PARENT_ORG_TOKEN_KIND) {
          return payload.sub;
        }
      } catch {
        // Thử khóa kế tiếp (khóa cũ khi đang xoay khóa)
      }
    }
    throw unauthenticatedError();
  }
}
