import { normalizeHost } from '@school-management/server/tenancy';
import { createDomainProvider } from './domain-provider.js';
import type { LifecycleEnvironment } from './school-lifecycle.js';
import type { TenancyRuntime } from './tenancy-runtime.js';

// Cấu hình vòng đời trường của nền tảng (DT-SaaS phần S2). Đọc từ biến môi trường ở tệp cấu hình của từng dịch vụ hoặc lệnh
// (readLifecycleSettings), không đọc rải rác:
//   PLATFORM_SYSTEM_DOMAIN      tên miền hệ thống; trường mới mặc định có tên miền <mã>.<tên miền hệ thống>
//   PLATFORM_INGRESS_HOST       địa chỉ vào mà tên miền riêng trỏ CNAME tới
//   DOMAIN_PROVIDER             dns-check (mặc định), cloudflare-saas, vercel-domains (S9)
//   SCHOOL_DELETION_GRACE_DAYS  số ngày chờ trước khi xóa vĩnh viễn (mặc định 30)
export interface LifecycleSettings {
  systemDomain: string | null;
  ingressHost: string | null;
  domainProvider: string;
  deletionGraceDays: number;
}

export const DEFAULT_LIFECYCLE_SETTINGS: LifecycleSettings = {
  systemDomain: null,
  ingressHost: null,
  domainProvider: 'dns-check',
  deletionGraceDays: 30,
};

export function lifecycleSettingsFrom(values: Record<string, string | undefined>): LifecycleSettings {
  const raw = values.SCHOOL_DELETION_GRACE_DAYS?.trim();
  const graceDays = raw ? Number(raw) : Number.NaN;
  return {
    systemDomain: normalizeHost(values.PLATFORM_SYSTEM_DOMAIN) ?? null,
    ingressHost: normalizeHost(values.PLATFORM_INGRESS_HOST) ?? null,
    domainProvider: values.DOMAIN_PROVIDER?.trim() || 'dns-check',
    deletionGraceDays: Number.isInteger(graceDays) && graceDays >= 0 ? graceDays : 30,
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
    systemDomain: settings.systemDomain,
    ingressHost: settings.ingressHost,
    domainProvider: createDomainProvider(settings.domainProvider),
  };
}
