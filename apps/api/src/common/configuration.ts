import { decodeBase64Key } from '@school-management/server';

// Cấu hình của máy chủ API nghiệp vụ; máy chủ API chỉ giữ khóa công khai để kiểm tra mã phiên (QĐ-22)
export interface ApiConfiguration {
  tokenPublicKeyPem: string;
  identityBaseUrl: string;
  systemDatabaseUrl: string;
  // Tên cơ sở dữ liệu năm học có dạng <tiền tố><năm bắt đầu>_<năm kết thúc>
  schoolYearDatabasePrefix: string;
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
    systemDatabaseUrl: readRequired('SYSTEM_DATABASE_URL'),
    schoolYearDatabasePrefix: process.env.SCHOOL_YEAR_DATABASE_PREFIX ?? 'school_year_',
  };
}
