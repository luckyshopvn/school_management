import { decodeBase64Key } from '@school-management/server';

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
}

export const IDENTITY_CONFIGURATION = Symbol('IDENTITY_CONFIGURATION');

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

export function readConfigurationFromEnvironment(): IdentityConfiguration {
  return {
    databaseUrl: readRequired('IDENTITY_DATABASE_URL'),
    redisUrl: readRequired('REDIS_URL'),
    redisKeyPrefix: 'identity',
    tokenPrivateKeyPem: decodeBase64Key(readRequired('IDENTITY_TOKEN_PRIVATE_KEY')),
    tokenPublicKeyPem: decodeBase64Key(readRequired('TOKEN_PUBLIC_KEY')),
    loginRequestsPerMinutePerAddress: Number(process.env.LOGIN_REQUESTS_PER_MINUTE ?? 10),
    apiBaseUrl: readRequired('API_BASE_URL'),
  };
}
