import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { unauthenticatedError } from './application-error.js';
import { TOKEN_ISSUER, TOKEN_SIGNING_ALGORITHM } from './access-token.js';

// Mã phiên của người vận hành nền tảng (DT-SaaS phần S1a) do dịch vụ định danh ký (TokenService.signOperatorToken, cùng đối tượng
// và loại dưới đây). Máy chủ API kiểm mã này cho phần quản trị chợ gia sư ở cổng nền tảng (DT-27 phần 27f): đối tượng riêng nên mã
// phiên của trường, của chợ không dùng được ở đây
export const PLATFORM_OPERATOR_TOKEN_AUDIENCE = 'school-management-platform';
export const PLATFORM_OPERATOR_TOKEN_KIND = 'platform_operator';

export class PlatformOperatorTokenVerifier {
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

  // Trả mã người vận hành
  async verify(token: string, now: Date): Promise<string> {
    for (const key of await this.keys()) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: TOKEN_ISSUER,
          audience: PLATFORM_OPERATOR_TOKEN_AUDIENCE,
          algorithms: [TOKEN_SIGNING_ALGORITHM],
          currentDate: now,
        });
        if (typeof payload.sub === 'string' && payload.kind === PLATFORM_OPERATOR_TOKEN_KIND) {
          return payload.sub;
        }
      } catch {
        // Thử khóa kế tiếp (khóa cũ khi đang xoay khóa)
      }
    }
    throw unauthenticatedError();
  }
}
