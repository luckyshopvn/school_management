import { randomBytes } from 'node:crypto';
import { resolveCname, resolveTxt } from 'node:dns/promises';

// Bộ nối tên miền riêng của trường (DT-SaaS phần S2, YCTD-193; tài liệu 47 mục 14.4, 14.5). Chọn bằng DOMAIN_PROVIDER của nền
// tảng:
// - dns-check (hồ sơ vận hành): người quản trị trỏ CNAME về địa chỉ vào của nền tảng và thêm bản ghi TXT
//   `_school-verify.<tên miền>` chứa mã xác nhận; bộ nối tra DNS, đủ cả hai thì báo đã xác nhận; chứng chỉ do Caddy cấp theo
//   yêu cầu (S7a);
// - cloudflare-saas, vercel-domains (hồ sơ thử nghiệm, DT-SaaS phần S9): gọi giao diện lập trình của nhà cung cấp; khóa truy cập
//   lấy từ cấu hình của nền tảng (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID; VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID)
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

export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

export interface CloudflareSaasOptions {
  apiToken: string;
  zoneId: string;
  apiBase?: string;
}

export interface VercelDomainsOptions {
  token: string;
  projectId: string;
  teamId?: string | null;
  apiBase?: string;
}

export interface DomainProviderOptions {
  resolver?: DnsResolver;
  cloudflare?: CloudflareSaasOptions | null;
  vercel?: VercelDomainsOptions | null;
  fetch?: FetchFunction;
}

async function callJson(
  fetchFunction: FetchFunction,
  provider: string,
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetchFunction(url, init);
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // Phản hồi không phải JSON: báo theo mã trạng thái
  }
  if (!response.ok) {
    const errors = (body.errors as Array<{ message?: string }> | undefined)?.map((error) => error.message) ?? [];
    const message = errors.filter(Boolean).join('; ') || (body.error as { message?: string } | undefined)?.message;
    throw new Error(`${provider} trả ${response.status}${message ? `: ${message}` : ''}`);
  }
  return body;
}

// Cloudflare for SaaS (tài liệu 47 mục 14.5 S9): mỗi tên miền riêng của trường là một "custom hostname" của vùng tên miền hệ
// thống; chứng chỉ do Cloudflare cấp (xác nhận qua HTTP khi CNAME đã trỏ về địa chỉ vào). Người quản trị của trường trỏ CNAME
// về PLATFORM_INGRESS_HOST và thêm bản ghi TXT xác nhận quyền sở hữu do Cloudflare cấp; bộ nối hỏi trạng thái theo tên miền
export class CloudflareSaasDomainProvider implements DomainProvider {
  readonly kind = 'cloudflare-saas' as const;

  constructor(
    private readonly options: CloudflareSaasOptions,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  private url(path: string): string {
    return `${this.options.apiBase ?? 'https://api.cloudflare.com/client/v4'}/zones/${this.options.zoneId}${path}`;
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.options.apiToken}`, 'content-type': 'application/json' };
  }

  private async find(host: string): Promise<Record<string, unknown> | null> {
    const body = await callJson(
      this.fetchFunction,
      'Cloudflare',
      this.url(`/custom_hostnames?hostname=${encodeURIComponent(host)}`),
      { headers: this.headers() },
    );
    const results = (body.result as Array<Record<string, unknown>> | undefined) ?? [];
    return results.find((item) => item.hostname === host) ?? null;
  }

  async request(host: string, ingressHost: string | null): Promise<DomainRequest> {
    const body = await callJson(this.fetchFunction, 'Cloudflare', this.url('/custom_hostnames'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ hostname: host, ssl: { method: 'http', type: 'dv' } }),
    });
    const result = (body.result ?? {}) as { ownership_verification?: { name?: string; type?: string; value?: string } };
    const ownership = result.ownership_verification;
    return {
      verificationToken: ownership?.name && ownership.value ? `${ownership.name} ${ownership.value}` : null,
      cnameTarget: ingressHost,
    };
  }

  async status(host: string): Promise<DomainStatus> {
    const found = await this.find(host);
    if (!found) {
      return { verified: false, problems: [`Cloudflare chưa có tên miền ${host}`] };
    }
    const ssl = (found.ssl ?? {}) as { status?: string; validation_errors?: Array<{ message?: string }> };
    const problems: string[] = [];
    if (found.status !== 'active') {
      problems.push(`Tên miền đang ở trạng thái ${String(found.status)} (chờ CNAME và bản ghi TXT xác nhận)`);
      for (const error of (found.verification_errors as string[] | undefined) ?? []) {
        problems.push(error);
      }
    }
    if (ssl.status !== 'active') {
      problems.push(`Chứng chỉ đang ở trạng thái ${String(ssl.status)}`);
      for (const error of ssl.validation_errors ?? []) {
        if (error.message) {
          problems.push(error.message);
        }
      }
    }
    return { verified: problems.length === 0, problems };
  }

  async remove(host: string): Promise<void> {
    const found = await this.find(host);
    if (found?.id) {
      await callJson(this.fetchFunction, 'Cloudflare', this.url(`/custom_hostnames/${String(found.id)}`), {
        method: 'DELETE',
        headers: this.headers(),
      });
    }
  }
}

// Vercel Domains (tổ hợp 3b): tên miền riêng thêm vào dự án Vercel làm cổng biên; người quản trị của trường trỏ CNAME về
// cname.vercel-dns.com và thêm các bản ghi xác nhận Vercel yêu cầu
export class VercelDomainsProvider implements DomainProvider {
  readonly kind = 'vercel-domains' as const;

  constructor(
    private readonly options: VercelDomainsOptions,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  private url(version: string, path: string): string {
    const base = this.options.apiBase ?? 'https://api.vercel.com';
    const team = this.options.teamId ? `?teamId=${encodeURIComponent(this.options.teamId)}` : '';
    return `${base}/${version}/projects/${encodeURIComponent(this.options.projectId)}/domains${path}${team}`;
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.options.token}`, 'content-type': 'application/json' };
  }

  async request(host: string): Promise<DomainRequest> {
    const body = await callJson(this.fetchFunction, 'Vercel', this.url('v10', ''), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name: host }),
    });
    const challenges =
      (body.verification as Array<{ type?: string; domain?: string; value?: string }> | undefined) ?? [];
    return {
      verificationToken:
        challenges
          .map((challenge) => `${challenge.type ?? 'TXT'} ${challenge.domain ?? ''} ${challenge.value ?? ''}`)
          .join('; ') || null,
      cnameTarget: 'cname.vercel-dns.com',
    };
  }

  async status(host: string): Promise<DomainStatus> {
    const body = await callJson(this.fetchFunction, 'Vercel', this.url('v9', `/${encodeURIComponent(host)}/verify`), {
      method: 'POST',
      headers: this.headers(),
    });
    return body.verified === true
      ? { verified: true, problems: [] }
      : { verified: false, problems: [`Vercel chưa xác nhận tên miền ${host}`] };
  }

  async remove(host: string): Promise<void> {
    await callJson(this.fetchFunction, 'Vercel', this.url('v9', `/${encodeURIComponent(host)}`), {
      method: 'DELETE',
      headers: this.headers(),
    });
  }
}

export function createDomainProvider(kind: string | undefined, options: DomainProviderOptions = {}): DomainProvider {
  const value = (kind?.trim() || 'dns-check') as DomainProviderKind;
  if (value === 'dns-check') {
    return new DnsCheckDomainProvider(options.resolver);
  }
  if (value === 'cloudflare-saas') {
    if (!options.cloudflare?.apiToken || !options.cloudflare.zoneId) {
      throw new Error('DOMAIN_PROVIDER=cloudflare-saas cần CLOUDFLARE_API_TOKEN và CLOUDFLARE_ZONE_ID');
    }
    return new CloudflareSaasDomainProvider(options.cloudflare, options.fetch);
  }
  if (value === 'vercel-domains') {
    if (!options.vercel?.token || !options.vercel.projectId) {
      throw new Error('DOMAIN_PROVIDER=vercel-domains cần VERCEL_TOKEN và VERCEL_PROJECT_ID');
    }
    return new VercelDomainsProvider(options.vercel, options.fetch);
  }
  throw new Error('DOMAIN_PROVIDER chỉ nhận dns-check, cloudflare-saas hoặc vercel-domains');
}
