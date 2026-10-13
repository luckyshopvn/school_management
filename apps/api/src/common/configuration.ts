import { decodeBase64Key } from '@school-management/server';
import { PAYMENT_PROVIDER_CODES, type PaymentProviderCode } from '../finance/payment-gateway.js';
import { readPaymentProviderSettings, type PaymentProviderSettings } from '../finance/payment-providers.js';

// Mã cổng không có trong danh sách thì bỏ qua; mỗi mã chỉ một lần, giữ thứ tự ghi
export function readPaymentGateways(text: string | undefined): PaymentProviderCode[] {
  const codes = (text ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter((code): code is PaymentProviderCode => (PAYMENT_PROVIDER_CODES as readonly string[]).includes(code));
  return [...new Set(codes)];
}

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
  // Các cổng thanh toán trực tuyến được bật, cổng đầu là mặc định; trống là chưa nối (T1), `development` là bộ giả
  // lập (YCTD-57), `vietqr-static` là mã VietQR tĩnh đối soát qua sao kê (YCTD-89). Biến PAYMENT_GATEWAY ghi các mã
  // cách nhau bằng dấu phẩy; `payos`, `sepay`, `casso`, `vnpay` là nhà cung cấp thật (YCTD-92)
  paymentGateways?: PaymentProviderCode[];
  // Khóa của các nhà cung cấp thật, chỉ đọc từ biến môi trường; cổng bật mà thiếu khóa thì máy chủ không khởi động
  paymentProviders?: PaymentProviderSettings;
  // Chu kỳ tiến trình gửi thông báo và nhắc nhật ký, tính bằng giây; 0 là tắt, kiểm thử tự gọi (YCTD-71)
  notificationDispatchIntervalSeconds?: number;
  // Đăng Fanpage và gửi Zalo: `development` là bộ giả lập; khóa truy cập chỉ đặt ở biến môi trường, không lưu trong cơ sở
  // dữ liệu (YCTD-90)
  facebookPublisher?: 'development' | null;
  facebookPageAccessToken?: string | null;
  zaloSender?: 'development' | null;
  zaloOaAccessToken?: string | null;
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
  const paymentGateways = readPaymentGateways(process.env.PAYMENT_GATEWAY);
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
    paymentGateways,
    paymentProviders: readPaymentProviderSettings(paymentGateways),
    notificationDispatchIntervalSeconds: Number(process.env.NOTIFICATION_DISPATCH_INTERVAL_SECONDS ?? 60),
    facebookPublisher: process.env.FACEBOOK_PUBLISHER === 'development' ? 'development' : null,
    facebookPageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || null,
    zaloSender: process.env.ZALO_SENDER === 'development' ? 'development' : null,
    zaloOaAccessToken: process.env.ZALO_OA_ACCESS_TOKEN || null,
  };
}
