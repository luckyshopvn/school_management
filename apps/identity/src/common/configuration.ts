// Cấu hình của dịch vụ định danh; bí mật đọc từ biến môi trường, không đặt trong mã nguồn (QU-05)
export interface IdentityConfiguration {
  databaseUrl: string;
  redisUrl: string;
  redisKeyPrefix: string;
  tokenPrivateKeyPem: string;
  tokenPublicKeyPem: string;
  loginRequestsPerMinutePerAddress: number;
}

export const IDENTITY_CONFIGURATION = Symbol('IDENTITY_CONFIGURATION');

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

// Khóa lưu trong biến môi trường ở dạng PEM mã hóa base64 để nằm trên một dòng
export function decodeKey(base64Value: string): string {
  return Buffer.from(base64Value, 'base64').toString('utf8');
}

export function readConfigurationFromEnvironment(): IdentityConfiguration {
  return {
    databaseUrl: readRequired('IDENTITY_DATABASE_URL'),
    redisUrl: readRequired('REDIS_URL'),
    redisKeyPrefix: 'identity',
    tokenPrivateKeyPem: decodeKey(readRequired('IDENTITY_TOKEN_PRIVATE_KEY')),
    tokenPublicKeyPem: decodeKey(readRequired('TOKEN_PUBLIC_KEY')),
    loginRequestsPerMinutePerAddress: 10,
  };
}
