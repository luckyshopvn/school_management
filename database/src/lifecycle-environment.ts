import { normalizeHost } from '@school-management/server/tenancy';
import { createDomainProvider } from './domain-provider.js';
import type { LifecycleEnvironment } from './school-lifecycle.js';
import type { TenancyRuntime } from './tenancy-runtime.js';

// Môi trường vòng đời trường dựng từ thời gian chạy nền tảng và biến môi trường (DT-SaaS phần S2):
//   PLATFORM_SYSTEM_DOMAIN   tên miền hệ thống; trường mới mặc định có tên miền <mã>.<tên miền hệ thống>
//   PLATFORM_INGRESS_HOST    địa chỉ vào mà tên miền riêng trỏ CNAME tới
//   DOMAIN_PROVIDER          dns-check (mặc định), cloudflare-saas, vercel-domains (S9)
//   SCHOOL_DELETION_GRACE_DAYS  số ngày chờ trước khi xóa vĩnh viễn (mặc định 30)
export function lifecycleEnvironmentOf(
  runtime: TenancyRuntime,
  env: NodeJS.ProcessEnv = process.env,
): LifecycleEnvironment {
  if (!runtime.layout) {
    throw new Error('Khởi tạo trường cần PLATFORM_ADMIN_DATABASE_URL (tài khoản tạo cơ sở dữ liệu, vai trò)');
  }
  return {
    platform: runtime.platform,
    masterKey: runtime.configuration.masterKey,
    layout: runtime.layout,
    systemDomain: normalizeHost(env.PLATFORM_SYSTEM_DOMAIN) ?? null,
    ingressHost: normalizeHost(env.PLATFORM_INGRESS_HOST) ?? null,
    domainProvider: createDomainProvider(env.DOMAIN_PROVIDER),
  };
}

export function deletionGraceDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SCHOOL_DELETION_GRACE_DAYS?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(value) && value >= 0 ? value : 30;
}
