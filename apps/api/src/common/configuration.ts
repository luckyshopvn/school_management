import { decodeBase64Key } from '@school-management/server';

// Cấu hình của máy chủ API nghiệp vụ; máy chủ API chỉ giữ khóa công khai để kiểm tra mã phiên (QĐ-22)
export interface ApiConfiguration {
  tokenPublicKeyPem: string;
  identityBaseUrl: string;
}

export const API_CONFIGURATION = Symbol('API_CONFIGURATION');

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

export function readConfigurationFromEnvironment(): ApiConfiguration {
  return {
    tokenPublicKeyPem: decodeBase64Key(readRequired('TOKEN_PUBLIC_KEY')),
    identityBaseUrl: readRequired('IDENTITY_BASE_URL'),
  };
}
