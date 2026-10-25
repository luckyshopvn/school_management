import { lifecycleSettingsFrom, type LifecycleSettings } from '@school-management/database';
import { decodeBase64Key, readSmsProviderSettings, type SmsProviderSettings } from '@school-management/server';

// Cấu hình của dịch vụ định danh; bí mật đọc từ biến môi trường, không đặt trong mã nguồn (QU-05)
export interface IdentityConfiguration {
  databaseUrl: string;
  redisUrl: string;
  redisKeyPrefix: string;
  tokenPrivateKeyPem: string;
  tokenPublicKeyPem: string;
  loginRequestsPerMinutePerAddress: number;
  // Máy chủ API, để đọc cây đơn vị khi quản lý tài khoản (YCTD-39)
  apiBaseUrl: string;
  // Nhà cung cấp tin nhắn: 'log' chỉ ghi ra nhật ký, không dùng được ở môi trường chạy thật (YCTD-43); 'esms' là
  // eSMS.vn, cần khóa và tên thương hiệu ở biến môi trường (YCTD-92)
  smsProvider: SmsProviderSettings;
  // Tên miền riêng của cổng vận hành nền tảng (DT-SaaS phần S1a, ví dụ platform.<tên miền hệ thống>); trống thì tắt đăng nhập
  // vận hành nền tảng. Là cấu hình của nền tảng, không ghi cứng
  platformConsoleHost?: string | null;
  // Khởi tạo và vòng đời trường ở cổng nền tảng (DT-SaaS phần S2): tên miền hệ thống, địa chỉ vào, bộ nối tên miền, số ngày chờ xóa
  platformLifecycle?: LifecycleSettings;
}

export const IDENTITY_CONFIGURATION = Symbol('IDENTITY_CONFIGURATION');
// Thời gian chạy nền tảng nhiều trường (DT-SaaS phần S1a); null ở chế độ một trường
export const TENANCY_RUNTIME = Symbol('TENANCY_RUNTIME');

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

// Ở chế độ nhiều trường (có PLATFORM_DATABASE_URL) cơ sở dữ liệu định danh là của từng trường nên không đọc ở đây
export function readConfigurationFromEnvironment(): IdentityConfiguration {
  const multiTenant = Boolean(process.env.PLATFORM_DATABASE_URL?.trim());
  return {
    databaseUrl: multiTenant ? '' : readRequired('IDENTITY_DATABASE_URL'),
    redisUrl: readRequired('REDIS_URL'),
    redisKeyPrefix: 'identity',
    tokenPrivateKeyPem: decodeBase64Key(readRequired('IDENTITY_TOKEN_PRIVATE_KEY')),
    tokenPublicKeyPem: decodeBase64Key(readRequired('TOKEN_PUBLIC_KEY')),
    loginRequestsPerMinutePerAddress: Number(process.env.LOGIN_REQUESTS_PER_MINUTE ?? 10),
    apiBaseUrl: readRequired('API_BASE_URL'),
    smsProvider: readSmsProviderSettings(),
    platformConsoleHost: process.env.PLATFORM_CONSOLE_HOST?.trim() || null,
    platformLifecycle: lifecycleSettingsFrom(process.env),
  };
}
