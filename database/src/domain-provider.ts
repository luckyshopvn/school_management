import { randomBytes } from 'node:crypto';
import { resolveCname, resolveTxt } from 'node:dns/promises';

// Bộ nối tên miền riêng của trường (DT-SaaS phần S2, YCTD-193; tài liệu 32 mục 14.4, 14.5). Chọn bằng DOMAIN_PROVIDER của nền
// tảng:
// - dns-check (hồ sơ vận hành): người quản trị trỏ CNAME về địa chỉ vào của nền tảng và thêm bản ghi TXT
//   `_school-verify.<tên miền>` chứa mã xác nhận; bộ nối tra DNS, đủ cả hai thì báo đã xác nhận; chứng chỉ do Caddy cấp theo
//   yêu cầu (S7a);
// - cloudflare-saas, vercel-domains (hồ sơ thử nghiệm): gọi giao diện lập trình của nhà cung cấp, mã của S9; ở đây chỉ khai báo
//   tên để cấu hình báo rõ là chưa có
export type DomainProviderKind = 'dns-check' | 'cloudflare-saas' | 'vercel-domains';
export const DOMAIN_VERIFY_LABEL = '_school-verify';

export interface DomainRequest {
  verificationToken: string | null;
  cnameTarget: string | null;
}

export interface DomainStatus {
  verified: boolean;
  problems: string[];
}

export interface DomainProvider {
  readonly kind: DomainProviderKind;
  request(host: string, ingressHost: string | null): Promise<DomainRequest>;
  status(host: string, request: DomainRequest): Promise<DomainStatus>;
  remove(host: string): Promise<void>;
}

export interface DnsResolver {
  resolveCname(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
}

const systemResolver: DnsResolver = { resolveCname, resolveTxt };

function sameHost(left: string, right: string): boolean {
  return left.toLowerCase().replace(/\.$/, '') === right.toLowerCase().replace(/\.$/, '');
}

export class DnsCheckDomainProvider implements DomainProvider {
  readonly kind = 'dns-check' as const;

  constructor(private readonly resolver: DnsResolver = systemResolver) {}

  async request(_host: string, ingressHost: string | null): Promise<DomainRequest> {
    return { verificationToken: `school-verify=${randomBytes(16).toString('hex')}`, cnameTarget: ingressHost };
  }

  async status(host: string, request: DomainRequest): Promise<DomainStatus> {
    const problems: string[] = [];
    if (request.cnameTarget) {
      try {
        const targets = await this.resolver.resolveCname(host);
        if (!targets.some((target) => sameHost(target, request.cnameTarget as string))) {
          problems.push(`CNAME của ${host} chưa trỏ về ${request.cnameTarget}`);
        }
      } catch {
        problems.push(`Chưa thấy bản ghi CNAME của ${host}`);
      }
    }
    if (request.verificationToken) {
      try {
        const records = (await this.resolver.resolveTxt(`${DOMAIN_VERIFY_LABEL}.${host}`)).map((parts) =>
          parts.join(''),
        );
        if (!records.includes(request.verificationToken)) {
          problems.push(`Bản ghi TXT ${DOMAIN_VERIFY_LABEL}.${host} chưa có mã xác nhận`);
        }
      } catch {
        problems.push(`Chưa thấy bản ghi TXT ${DOMAIN_VERIFY_LABEL}.${host}`);
      }
    }
    return { verified: problems.length === 0, problems };
  }

  async remove(): Promise<void> {
    // Tên miền chỉ nằm ở danh sách của nền tảng; Caddy không cấp chứng chỉ khi tên miền không còn trong danh sách
  }
}

class PendingProvider implements DomainProvider {
  constructor(readonly kind: DomainProviderKind) {}

  private fail(): never {
    throw new Error(`Bộ nối tên miền ${this.kind} chưa có (làm ở DT-SaaS S9); dùng dns-check`);
  }

  async request(): Promise<DomainRequest> {
    return this.fail();
  }

  async status(): Promise<DomainStatus> {
    return this.fail();
  }

  async remove(): Promise<void> {
    this.fail();
  }
}

export function createDomainProvider(kind: string | undefined, resolver?: DnsResolver): DomainProvider {
  const value = (kind?.trim() || 'dns-check') as DomainProviderKind;
  if (value === 'dns-check') {
    return new DnsCheckDomainProvider(resolver);
  }
  if (value === 'cloudflare-saas' || value === 'vercel-domains') {
    return new PendingProvider(value);
  }
  throw new Error('DOMAIN_PROVIDER chỉ nhận dns-check, cloudflare-saas hoặc vercel-domains');
}
