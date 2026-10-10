import { decodeBase64Key } from '@school-management/server';

// Cấu hình của máy chủ API nghiệp vụ; máy chủ API chỉ giữ khóa công khai để kiểm tra mã phiên (QĐ-22)
export interface ApiConfiguration {
  tokenPublicKeyPem: string;
  identityBaseUrl: string;
  systemDatabaseUrl: string;
  // Tên cơ sở dữ liệu năm học có dạng <tiền tố><năm bắt đầu>_<năm kết thúc>
  schoolYearDatabasePrefix: string;
  // Khóa mã hóa và khóa băm số định danh của trẻ, mỗi khóa 32 byte (BM-64, YCTD-45)
  childDataEncryptionKey: Buffer;
  childDataHashKey: Buffer;
  // Kho tệp tương thích S3; trống khi kiểm thử dùng kho trong bộ nhớ
  objectStorage: ObjectStorageSettings | null;
  // Nhà cung cấp tài khoản ảo và mã QR; trống là chưa nối (T1), `development` là bộ giả lập (YCTD-57)
  paymentGateway?: 'development' | null;
}

export interface ObjectStorageSettings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const API_CONFIGURATION = Symbol('API_CONFIGURATION');

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

export function readKey(name: string): Buffer {
  const key = Buffer.from(readRequired(name), 'base64');
  if (key.length !== 32) {
    throw new Error(`Biến môi trường ${name} phải là 32 byte mã hóa base64`);
  }
  return key;
}

export function readConfigurationFromEnvironment(): ApiConfiguration {
  return {
    tokenPublicKeyPem: decodeBase64Key(readRequired('TOKEN_PUBLIC_KEY')),
    identityBaseUrl: readRequired('IDENTITY_BASE_URL'),
    systemDatabaseUrl: readRequired('SYSTEM_DATABASE_URL'),
    schoolYearDatabasePrefix: process.env.SCHOOL_YEAR_DATABASE_PREFIX ?? 'school_year_',
    childDataEncryptionKey: readKey('CHILD_DATA_ENCRYPTION_KEY'),
    childDataHashKey: readKey('CHILD_DATA_HASH_KEY'),
    objectStorage: {
      endpoint: readRequired('S3_ENDPOINT'),
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: readRequired('S3_BUCKET'),
      accessKeyId: readRequired('S3_ACCESS_KEY_ID'),
      secretAccessKey: readRequired('S3_SECRET_ACCESS_KEY'),
    },
    paymentGateway: process.env.PAYMENT_GATEWAY === 'development' ? 'development' : null,
  };
}
