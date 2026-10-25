import { normalizeHost } from '@school-management/server/tenancy';
import { createDomainProvider, type DomainProviderOptions } from './domain-provider.js';
import type { DataPolicy, LifecycleEnvironment } from './school-lifecycle.js';
import type { TenancyRuntime } from './tenancy-runtime.js';

// Cấu hình vòng đời trường của nền tảng (DT-SaaS phần S2, S9). Đọc từ biến môi trường ở tệp cấu hình của từng dịch vụ hoặc lệnh
// (lifecycleSettingsFrom), không đọc rải rác. Tên miền hệ thống dùng chung PLATFORM_ROOT_DOMAIN của S1b (cấu hình nền tảng
// nhiều trường): trường mới mặc định có tên miền <mã>.<tên miền hệ thống>
//   PLATFORM_INGRESS_HOST       địa chỉ vào mà tên miền riêng trỏ CNAME tới
//   DOMAIN_PROVIDER             dns-check (mặc định), cloudflare-saas, vercel-domains (S9)
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID                 khóa của bộ nối cloudflare-saas
//   VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID          khóa của bộ nối vercel-domains
//   SCHOOL_DELETION_GRACE_DAYS  số ngày chờ trước khi xóa vĩnh viễn (mặc định 30)
//   PLATFORM_DATA_POLICY        any (mặc định), consent-required (hồ sơ thử nghiệm), synthetic-only (S9)
export interface LifecycleSettings {
  ingressHost: string | null;
  domainProvider: string;
  domainProviderOptions?: DomainProviderOptions;
  deletionGraceDays: number;
  dataPolicy?: DataPolicy;
}

export const DEFAULT_LIFECYCLE_SETTINGS: LifecycleSettings = {
  ingressHost: null,
  domainProvider: 'dns-check',
  deletionGraceDays: 30,
  dataPolicy: 'any',
};

export function readDataPolicy(value: string | undefined): DataPolicy {
  const policy = (value?.trim() || 'any') as DataPolicy;
  if (!['any', 'consent-required', 'synthetic-only'].includes(policy)) {
    throw new Error('PLATFORM_DATA_POLICY chỉ nhận any, consent-required hoặc synthetic-only');
  }
  return policy;
}

export function lifecycleSettingsFrom(values: Record<string, string | undefined>): LifecycleSettings {
  const raw = values.SCHOOL_DELETION_GRACE_DAYS?.trim();
  const graceDays = raw ? Number(raw) : Number.NaN;
  const cloudflareToken = values.CLOUDFLARE_API_TOKEN?.trim();
  const cloudflareZone = values.CLOUDFLARE_ZONE_ID?.trim();
  const vercelToken = values.VERCEL_TOKEN?.trim();
  const vercelProject = values.VERCEL_PROJECT_ID?.trim();
  return {
    ingressHost: normalizeHost(values.PLATFORM_INGRESS_HOST) ?? null,
    domainProvider: values.DOMAIN_PROVIDER?.trim() || 'dns-check',
    domainProviderOptions: {
      cloudflare: cloudflareToken && cloudflareZone ? { apiToken: cloudflareToken, zoneId: cloudflareZone } : null,
      vercel:
        vercelToken && vercelProject
          ? { token: vercelToken, projectId: vercelProject, teamId: values.VERCEL_TEAM_ID?.trim() || null }
          : null,
    },
    deletionGraceDays: Number.isInteger(graceDays) && graceDays >= 0 ? graceDays : 30,
    dataPolicy: readDataPolicy(values.PLATFORM_DATA_POLICY),
  };
}

export function lifecycleEnvironmentOf(runtime: TenancyRuntime, settings: LifecycleSettings): LifecycleEnvironment {
  if (!runtime.layout) {
    throw new Error('Khởi tạo trường cần PLATFORM_ADMIN_DATABASE_URL (tài khoản tạo cơ sở dữ liệu, vai trò)');
  }
  return {
    platform: runtime.platform,
    masterKey: runtime.configuration.masterKey,
    layout: runtime.layout,
    systemDomain: runtime.configuration.rootDomain,
    ingressHost: settings.ingressHost,
    domainProvider: createDomainProvider(settings.domainProvider, settings.domainProviderOptions ?? {}),
    dataPolicy: settings.dataPolicy ?? 'any',
  };
}
