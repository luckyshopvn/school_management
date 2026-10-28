import { lifecycleSettingsFrom, type LifecycleSettings } from '@school-management/database';
import { decodeBase64Key, readSmsProviderSettings, type SmsProviderSettings } from '@school-management/server';
import { readProviderDefinitions, type ExternalProviderDefinition } from '@school-management/server/external-identity';
import { DEFAULT_PASSWORD_HASH_PARAMETERS, type PasswordHashParameters } from '../authentication/password.js';

// Cấu hình của dịch vụ định danh; bí mật đọc từ biến môi trường, không đặt trong mã nguồn (QU-05)
export interface IdentityConfiguration {
  databaseUrl: string;
  redisUrl: string;
  redisKeyPrefix: string;
  tokenPrivateKeyPem: string;
  tokenPublicKeyPem: string;
  loginRequestsPerMinutePerAddress: number;
  // "Ghi nhớ" ở trang đăng nhập cổng quản trị (YCTD-310): số ngày giữ phiên (PORTAL_REMEMBER_DAYS, mặc định 30, từ 1 đến 90)
  portalRememberDays?: number;
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
  // Bảng điều khiển nền tảng (DT-SaaS phần S4): số lỗi máy chủ trong một giờ của một trường từ đó thì cảnh báo; mặc định 20
  errorAlertPerHour?: number;
  // Khóa mã hóa khóa xác thực hai lớp (32 byte) ở chế độ một trường (DT-SaaS phần S8b); chế độ nhiều trường dùng khóa mã hóa của trường
  totpEncryptionKey?: Buffer | null;
  // Khóa công khai cũ của mã phiên, còn nhận trong thời gian xoay khóa ký (DT-SaaS phần S8b)
  tokenPreviousPublicKeyPem?: string | null;
  // Nhà cung cấp định danh bên ngoài nền tảng khai (DT-25): EXTERNAL_IDENTITY_PROVIDERS và EXTERNAL_IDENTITY_<MÃ>_CLIENT_SECRET; trống là
  // không có nhà cung cấp nào
  externalIdentityProviders?: ExternalProviderDefinition[];
  // Mật khẩu mặc định của tài khoản tạo theo số CCCD (YCTD-311), đọc từ DEFAULT_INITIAL_PASSWORD, không đặt trong mã nguồn vì kho mã
  // công khai. Trống thì tài khoản mới nhận mật khẩu tạm ngẫu nhiên như trước. Luôn phải đổi ở lần đăng nhập đầu
  defaultInitialPassword?: string | null;
  // Tham số băm argon2id (YCTD-311); trống là mặc định trong password.ts
  passwordHash?: PasswordHashParameters;
  // Tên đăng nhập của nhân viên vận hành nền tảng: số CCCD (mặc định) hoặc thư điện tử công ty (YCTD-311)
  platformOperatorLoginRule?: 'cccd' | 'email';
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

// Khóa 32 byte mã hóa base64 ở biến môi trường, trống thì không có (tính năng cần khóa này sẽ báo chưa cấu hình)
function readOptionalKey(name: string): Buffer | null {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(`Biến môi trường ${name} phải là 32 byte mã hóa base64`);
  }
  return key;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Biến môi trường ${name} phải là số nguyên dương`);
  }
  return value;
}

// Mức tối thiểu kiểm ở configurePasswordHashing khi dựng ứng dụng
function readPasswordHashParameters(): PasswordHashParameters {
  return {
    memoryCost: readPositiveInteger('PASSWORD_HASH_MEMORY_KIB', DEFAULT_PASSWORD_HASH_PARAMETERS.memoryCost),
    timeCost: readPositiveInteger('PASSWORD_HASH_TIME_COST', DEFAULT_PASSWORD_HASH_PARAMETERS.timeCost),
    parallelism: readPositiveInteger('PASSWORD_HASH_PARALLELISM', DEFAULT_PASSWORD_HASH_PARAMETERS.parallelism),
  };
}

// Mật khẩu mặc định phải theo chính sách mật khẩu tối thiểu (BM-03); sai thì dừng khởi động để không cấp mật khẩu yếu
function readDefaultInitialPassword(): string | null {
  const value = process.env.DEFAULT_INITIAL_PASSWORD;
  if (!value) {
    return null;
  }
  if (value.length < 8 || !/\p{L}/u.test(value) || !/\p{Nd}/u.test(value)) {
    throw new Error('Biến môi trường DEFAULT_INITIAL_PASSWORD phải có ít nhất 8 ký tự, có cả chữ và số');
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
    portalRememberDays: Number(process.env.PORTAL_REMEMBER_DAYS ?? 30),
    apiBaseUrl: readRequired('API_BASE_URL'),
    smsProvider: readSmsProviderSettings(),
    platformConsoleHost: process.env.PLATFORM_CONSOLE_HOST?.trim() || null,
    tokenPreviousPublicKeyPem: process.env.TOKEN_PREVIOUS_PUBLIC_KEY
      ? decodeBase64Key(process.env.TOKEN_PREVIOUS_PUBLIC_KEY)
      : null,
    totpEncryptionKey: readOptionalKey('TOTP_ENCRYPTION_KEY'),
    platformLifecycle: lifecycleSettingsFrom(process.env),
    errorAlertPerHour:
      Number(process.env.PLATFORM_ERROR_ALERT_PER_HOUR) > 0 ? Number(process.env.PLATFORM_ERROR_ALERT_PER_HOUR) : 20,
    externalIdentityProviders: readProviderDefinitions(process.env),
    defaultInitialPassword: readDefaultInitialPassword(),
    passwordHash: readPasswordHashParameters(),
    platformOperatorLoginRule: process.env.PLATFORM_OPERATOR_LOGIN_RULE?.trim() === 'email' ? 'email' : 'cccd',
  };
}
