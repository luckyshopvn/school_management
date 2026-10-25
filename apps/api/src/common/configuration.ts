import { decodeBase64Key, readSmsProviderSettings, type SmsProviderSettings } from '@school-management/server';
import { PAYMENT_PROVIDER_CODES, type PaymentProviderCode } from '../finance/payment-gateway.js';
import { readPaymentProviderSettings, type PaymentProviderSettings } from '../finance/payment-providers.js';
import { DEFAULT_FACEBOOK_GRAPH_VERSION } from '../integrations/facebook-publisher.js';

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
  // Tác vụ xuất nền (DT-16 phần 16a): chu kỳ tiến trình xuất nền tính bằng giây, 0 là tắt, kiểm thử tự gọi; số dòng tối đa
  // của một lần xuất trực tiếp, vượt thì tạo tác vụ nền (mặc định 10 000)
  exportJobIntervalSeconds?: number;
  // Bộ lập lịch việc nền nhiều trường (DT-SaaS phần S1b): chu kỳ tick trong tiến trình (giây; 0 là tắt, dùng điểm tick bên ngoài), số trường
  // chạy song song, mã dùng chung INTERNAL_JOB_TOKEN cho điểm tick bên ngoài (trống là không có điểm đó), số lần xếp thời khóa biểu đang chạy tối đa
  // mỗi trường (hạn mức gói do phần S5a thay thế)
  schedulerIntervalSeconds?: number;
  schedulerConcurrency?: number;
  schedulerSecret?: string;
  timetableMaxActiveRuns?: number;
  syncExportRowLimit?: number;
  // Đăng Fanpage và gửi Zalo: `development` là bộ giả lập (YCTD-90). Khóa trang Facebook chỉ đặt ở biến môi trường;
  // Graph API dùng phiên bản facebookGraphVersion, mặc định v21.0 (YCTD-92)
  facebookPublisher?: 'development' | null;
  facebookPageAccessToken?: string | null;
  facebookGraphVersion?: string;
  // `zalo_oa` là kết nối thật: cần mã ứng dụng, khóa bí mật ứng dụng và khóa làm mới ban đầu; khóa truy cập và khóa làm mới
  // luân phiên lưu mã hóa ở cơ sở dữ liệu hệ thống bằng childDataEncryptionKey (YCTD-92)
  zaloSender?: 'development' | 'zalo_oa' | null;
  zaloAppId?: string | null;
  zaloAppSecret?: string | null;
  zaloOaRefreshToken?: string | null;
  zaloOaAccessToken?: string | null;
  // Nhà cung cấp tin nhắn thông báo: 'log' chỉ ghi nhật ký, không dùng được ở môi trường chạy thật; 'esms' là eSMS.vn
  // (YCTD-92). Trống là 'log'
  smsProvider?: SmsProviderSettings;
  // Redis của hàng đợi máy xếp thời khoá biểu chạy nền (DT-20 phần 22c2); trống thì máy xếp chạy ngay trong máy chủ API (kiểm
  // thử)
  redisUrl?: string | null;
}

type IntegrationConfiguration = Pick<
  ApiConfiguration,
  | 'facebookPublisher'
  | 'facebookPageAccessToken'
  | 'facebookGraphVersion'
  | 'zaloSender'
  | 'zaloAppId'
  | 'zaloAppSecret'
  | 'zaloOaRefreshToken'
  | 'zaloOaAccessToken'
>;

// Đọc cấu hình Fanpage và Zalo; bật kết nối thật mà thiếu biến bắt buộc thì máy chủ không khởi động (YCTD-92)
export function readIntegrationConfiguration(environment: NodeJS.ProcessEnv): IntegrationConfiguration {
  const value = (name: string) => environment[name]?.trim() || null;
  const facebookPublisher = value('FACEBOOK_PUBLISHER');
  if (facebookPublisher && facebookPublisher !== 'development' && facebookPublisher !== 'graph') {
    throw new Error('FACEBOOK_PUBLISHER chỉ nhận development hoặc graph');
  }
  if (facebookPublisher === 'graph' && !value('FACEBOOK_PAGE_ACCESS_TOKEN')) {
    throw new Error('Thiếu biến môi trường FACEBOOK_PAGE_ACCESS_TOKEN khi FACEBOOK_PUBLISHER=graph');
  }
  const graphVersion = value('FACEBOOK_GRAPH_VERSION') ?? DEFAULT_FACEBOOK_GRAPH_VERSION;
  if (!/^v\d+\.\d+$/.test(graphVersion)) {
    throw new Error('FACEBOOK_GRAPH_VERSION có dạng vNN.N, ví dụ v21.0');
  }
  const zaloSender = value('ZALO_SENDER');
  if (zaloSender && zaloSender !== 'development' && zaloSender !== 'zalo_oa') {
    throw new Error('ZALO_SENDER chỉ nhận development hoặc zalo_oa');
  }
  if (zaloSender === 'zalo_oa') {
    const missing = ['ZALO_APP_ID', 'ZALO_APP_SECRET', 'ZALO_OA_REFRESH_TOKEN'].filter((name) => !value(name));
    if (missing.length > 0) {
      throw new Error(`Thiếu biến môi trường ${missing.join(', ')} khi ZALO_SENDER=zalo_oa`);
    }
  }
  return {
    facebookPublisher: facebookPublisher === 'development' ? 'development' : null,
    facebookPageAccessToken: value('FACEBOOK_PAGE_ACCESS_TOKEN'),
    facebookGraphVersion: graphVersion,
    zaloSender: zaloSender === 'development' || zaloSender === 'zalo_oa' ? zaloSender : null,
    zaloAppId: value('ZALO_APP_ID'),
    zaloAppSecret: value('ZALO_APP_SECRET'),
    zaloOaRefreshToken: value('ZALO_OA_REFRESH_TOKEN'),
    zaloOaAccessToken: value('ZALO_OA_ACCESS_TOKEN'),
  };
}

export interface ObjectStorageSettings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const API_CONFIGURATION = Symbol('API_CONFIGURATION');
// Thời gian chạy nền tảng nhiều trường (DT-SaaS phần S1a); null ở chế độ một trường
export const TENANCY_RUNTIME = Symbol('TENANCY_RUNTIME');

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

// Ở chế độ nhiều trường (có PLATFORM_DATABASE_URL) địa chỉ cơ sở dữ liệu hệ thống, tiền tố năm học và khóa dữ liệu trẻ là của từng
// trường nên không đọc ở đây; withTenantAccessors thay bằng thuộc tính đọc theo ngữ cảnh của yêu cầu
export function readConfigurationFromEnvironment(options: { multiTenant?: boolean } = {}): ApiConfiguration {
  const paymentGateways = readPaymentGateways(process.env.PAYMENT_GATEWAY);
  const multiTenant = options.multiTenant ?? Boolean(process.env.PLATFORM_DATABASE_URL?.trim());
  return {
    tokenPublicKeyPem: decodeBase64Key(readRequired('TOKEN_PUBLIC_KEY')),
    identityBaseUrl: readRequired('IDENTITY_BASE_URL'),
    systemDatabaseUrl: multiTenant ? '' : readRequired('SYSTEM_DATABASE_URL'),
    schoolYearDatabasePrefix: process.env.SCHOOL_YEAR_DATABASE_PREFIX ?? 'school_year_',
    childDataEncryptionKey: multiTenant ? Buffer.alloc(0) : readKey('CHILD_DATA_ENCRYPTION_KEY'),
    childDataHashKey: multiTenant ? Buffer.alloc(0) : readKey('CHILD_DATA_HASH_KEY'),
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
    exportJobIntervalSeconds: Number(process.env.EXPORT_JOB_INTERVAL_SECONDS ?? 15),
    // SCHEDULER_MODE=external: không có hẹn giờ trong tiến trình, bộ hẹn giờ bên ngoài gọi điểm tick (máy chủ được phép ngủ khi rảnh)
    schedulerIntervalSeconds:
      process.env.SCHEDULER_MODE?.trim() === 'external' ? 0 : Number(process.env.SCHEDULER_INTERVAL_SECONDS ?? 15),
    schedulerConcurrency: Number(process.env.SCHEDULER_CONCURRENCY ?? 2),
    ...(process.env.INTERNAL_JOB_TOKEN?.trim() ? { schedulerSecret: process.env.INTERNAL_JOB_TOKEN.trim() } : {}),
    timetableMaxActiveRuns: Number(process.env.TIMETABLE_MAX_ACTIVE_RUNS ?? 2),
    ...readIntegrationConfiguration(process.env),
    smsProvider: readSmsProviderSettings(),
    redisUrl: process.env.REDIS_URL?.trim() || null,
  };
}
