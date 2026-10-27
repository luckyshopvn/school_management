import {
  lifecycleSettingsFrom,
  readTenancyConfiguration,
  type LifecycleSettings,
  type TenancyConfiguration,
} from '@school-management/database';
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
  // Khóa công khai cũ còn nhận trong thời gian xoay khóa ký (DT-SaaS phần S8b)
  tokenPreviousPublicKeyPem?: string | null;
  identityBaseUrl: string;
  systemDatabaseUrl: string;
  // Tên cơ sở dữ liệu năm học có dạng <tiền tố><năm bắt đầu>_<năm kết thúc>
  schoolYearDatabasePrefix: string;
  // Chỉ kiểm thử: tạo cơ sở dữ liệu năm học bằng bản sao của cơ sở dữ liệu mẫu đã chạy tệp thay đổi cấu trúc thay cho cơ sở dữ
  // liệu rỗng; bước chạy tệp thay đổi cấu trúc sau đó giữ nguyên
  schoolYearDatabasesFromTemplate?: boolean;
  // Khóa mã hóa và khóa băm số định danh của trẻ, mỗi khóa 32 byte (BM-64, YCTD-45)
  childDataEncryptionKey: Buffer;
  childDataHashKey: Buffer;
  // Kho tệp tương thích S3; trống khi kiểm thử dùng kho trong bộ nhớ
  objectStorage: ObjectStorageSettings | null;
  // Máy chủ ICE cho giám thị camera của thi trực tuyến (DT-23 phần 23e): STUN, TURN (coturn tự host) và khóa dùng chung để cấp
  // tên đăng nhập, mật khẩu TURN có hạn; trống thì trình duyệt chỉ dùng kết nối trực tiếp trong cùng mạng
  webrtc?: WebrtcSettings;
  // Lớp video trực tiếp (DT-27 phần 27a): nhà cung cấp phòng video (`livekit` tự host, `livekit-cloud` dự phòng, `mock` kiểm thử);
  // trống là tắt video, các biến LIVEKIT_* không bắt buộc
  video?: VideoSettings | null;
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
  // Bảng điều khiển nền tảng (DT-SaaS phần S4): chu kỳ thu số liệu của từng trường (giây, mặc định 3600; 0 là tắt)
  schoolMetricsIntervalSeconds?: number;
  // Đơn vị cấp trên (DT-SaaS phần S6): chu kỳ bản chụp tổng hợp của từng trường (giây, mặc định 6 giờ; 0 là tắt), ngưỡng ẩn nhóm nhỏ
  aggregateSnapshotIntervalSeconds?: number;
  parentOrgMinGroup?: number;
  // Tên miền của cổng nền tảng: số liệu cho tài khoản cấp trên chỉ phục vụ ở đây (tên miền khác 404); trống thì tắt
  platformConsoleHost?: string | null;
  // Chợ gia sư (DT-27 phần 27f): kết nối cơ sở dữ liệu `marketplace` bằng vai trò riêng của chợ; trống là tắt chợ. Bí mật băm mã học
  // sinh khi phụ huynh liên kết hồ sơ con ở chợ với trường (HMAC theo mã trường); trống thì không liên kết được
  marketplaceDatabaseUrl?: string | null;
  marketLinkSecret?: string | null;
  // Nguồn gốc riêng phục vụ tệp gói SCORM (DT-28 phần 28h), ví dụ https://noi-dung.he-thong.example; trống thì phục vụ ở tên miền của
  // trường (tệp vẫn ở nguồn gốc riêng nhờ CSP sandbox, không đọc được phiên, cookie của ứng dụng)
  scormContentOrigin?: string | null;
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
  // Bộ giả lập nhà cung cấp AI `mock` (DT-23 phần 23d): chỉ cho kiểm thử, không gọi dịch vụ ngoài; không bật ở môi trường chạy thật
  aiMock?: boolean;
  // Thông báo đẩy (DT-26 phần 26b, YCTD-232): bộ nối `development` (giả lập, ghi lại để kiểm thử đọc) hoặc `web-push`; trống là
  // không gửi đẩy. Khóa VAPID: chế độ nhiều trường đọc ở cơ sở dữ liệu nền tảng, chế độ một trường lấy VAPID_PUBLIC_KEY,
  // VAPID_PRIVATE_KEY, VAPID_SUBJECT. Đẩy gốc FCM, APNs (phần 26g, YCTD-237): PUSH_NATIVE_PROVIDER; khóa ở cơ sở dữ liệu nền tảng
  // (nhiều trường) hoặc tệp khóa (một trường)
  push?: PushConfiguration;
}

export interface PushConfiguration {
  provider: 'development' | 'web-push' | null;
  // Đẩy gốc tới ứng dụng cài đặt: `native` (FCM, APNs thật) hoặc `development` (giả lập); trống là không gửi đẩy gốc
  nativeProvider: 'development' | 'native' | null;
  // Chế độ một trường: đường dẫn tệp tài khoản dịch vụ Firebase, khóa APNs .p8 và các mã đi kèm (không ghi vào kho mã)
  fcmServiceAccountFile: string | null;
  apnsKeyFile: string | null;
  apnsKeyId: string | null;
  apnsTeamId: string | null;
  apnsBundleId: string | null;
  apnsEnvironment: 'sandbox' | 'production';
  // Địa chỉ dịch vụ FCM, APNs; chỉ đổi khi kiểm thử với máy chủ giả lập
  fcmBaseUrl: string | null;
  fcmTokenUrl: string | null;
  apnsHost: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  vapidSubject: string | null;
  // Bộ giả lập ghi thêm từng lần gửi vào tệp này (một dòng JSON mỗi lần) cho kiểm thử giao diện đọc; trống thì chỉ giữ trong bộ nhớ
  developmentOutbox: string | null;
  // Gộp các thông báo cùng nhóm tới cùng người trong số phút này thành một lần đẩy; 0 là không gộp
  coalesceMinutes: number;
  // Đăng ký không thấy quá số ngày này thì dọn
  subscriptionRetentionDays: number;
}

// PUSH_PROVIDER=development|web-push; web-push cần đủ khóa VAPID ở chế độ một trường. PUSH_NATIVE_PROVIDER=development|native. Bộ giả lập không bật ở môi trường chạy thật
export function readPushConfiguration(environment: NodeJS.ProcessEnv, multiTenant: boolean): PushConfiguration {
  const value = (name: string) => environment[name]?.trim() || null;
  const provider = value('PUSH_PROVIDER');
  if (provider && provider !== 'development' && provider !== 'web-push') {
    throw new Error('PUSH_PROVIDER chỉ nhận development hoặc web-push');
  }
  if (provider === 'development' && environment.NODE_ENV === 'production') {
    throw new Error('PUSH_PROVIDER=development chỉ dùng cho phát triển và kiểm thử');
  }
  const nativeProvider = value('PUSH_NATIVE_PROVIDER');
  if (nativeProvider && nativeProvider !== 'development' && nativeProvider !== 'native') {
    throw new Error('PUSH_NATIVE_PROVIDER chỉ nhận development hoặc native');
  }
  if (nativeProvider === 'development' && environment.NODE_ENV === 'production') {
    throw new Error('PUSH_NATIVE_PROVIDER=development chỉ dùng cho phát triển và kiểm thử');
  }
  const apnsEnvironment = value('APNS_ENVIRONMENT') ?? 'production';
  if (apnsEnvironment !== 'sandbox' && apnsEnvironment !== 'production') {
    throw new Error('APNS_ENVIRONMENT chỉ nhận sandbox hoặc production');
  }
  if (value('APNS_KEY_FILE')) {
    const missing = ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID'].filter((name) => !value(name));
    if (missing.length > 0) {
      throw new Error(`Thiếu biến môi trường ${missing.join(', ')} khi đặt APNS_KEY_FILE`);
    }
  }
  if (provider === 'web-push' && !multiTenant) {
    const missing = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].filter((name) => !value(name));
    if (missing.length > 0) {
      throw new Error(`Thiếu biến môi trường ${missing.join(', ')} khi PUSH_PROVIDER=web-push`);
    }
  }
  const number = (name: string, fallback: number) => {
    const parsed = Number(value(name) ?? fallback);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    provider: provider === 'development' || provider === 'web-push' ? provider : null,
    nativeProvider: nativeProvider === 'development' || nativeProvider === 'native' ? nativeProvider : null,
    fcmServiceAccountFile: value('FCM_SERVICE_ACCOUNT_FILE'),
    apnsKeyFile: value('APNS_KEY_FILE'),
    apnsKeyId: value('APNS_KEY_ID'),
    apnsTeamId: value('APNS_TEAM_ID'),
    apnsBundleId: value('APNS_BUNDLE_ID'),
    apnsEnvironment,
    fcmBaseUrl: value('FCM_API_BASE_URL'),
    fcmTokenUrl: value('FCM_TOKEN_URL'),
    apnsHost: value('APNS_HOST'),
    vapidPublicKey: value('VAPID_PUBLIC_KEY'),
    vapidPrivateKey: value('VAPID_PRIVATE_KEY'),
    vapidSubject: value('VAPID_SUBJECT'),
    developmentOutbox: value('PUSH_DEVELOPMENT_OUTBOX'),
    coalesceMinutes: number('PUSH_COALESCE_MINUTES', 5),
    subscriptionRetentionDays: number('PUSH_SUBSCRIPTION_RETENTION_DAYS', 90),
  };
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

export type VideoProviderCode = 'livekit' | 'livekit-cloud' | 'mock';

export interface VideoSettings {
  provider: VideoProviderCode;
  // Địa chỉ API của máy chủ phòng (http/https) và địa chỉ trình duyệt kết nối (ws/wss); mock thì để trống
  apiUrl: string;
  clientUrl: string;
  apiKey: string;
  apiSecret: string;
}

// VIDEO_PROVIDER: trống là tắt; `livekit`, `livekit-cloud` cần LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (LIVEKIT_PUBLIC_URL
// là địa chỉ trình duyệt nối tới, mặc định theo LIVEKIT_URL); `mock` chỉ dùng cho kiểm thử
export function readVideoConfiguration(environment: NodeJS.ProcessEnv): VideoSettings | null {
  const provider = environment.VIDEO_PROVIDER?.trim() ?? '';
  if (provider === '') {
    return null;
  }
  if (provider === 'mock') {
    if (environment.NODE_ENV === 'production') {
      throw new Error('VIDEO_PROVIDER=mock chỉ dùng cho kiểm thử, không bật ở môi trường chạy thật');
    }
    return { provider, apiUrl: '', clientUrl: 'mock://video', apiKey: 'mock', apiSecret: 'mock-video-secret' };
  }
  if (provider !== 'livekit' && provider !== 'livekit-cloud') {
    throw new Error(`VIDEO_PROVIDER không hỗ trợ: ${provider}`);
  }
  const missing = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường ${missing.join(', ')} khi VIDEO_PROVIDER=${provider}`);
  }
  const apiUrl = (environment.LIVEKIT_URL as string).trim();
  return {
    provider,
    apiUrl,
    clientUrl: environment.LIVEKIT_PUBLIC_URL?.trim() || apiUrl.replace(/^http/, 'ws'),
    apiKey: (environment.LIVEKIT_API_KEY as string).trim(),
    apiSecret: (environment.LIVEKIT_API_SECRET as string).trim(),
  };
}

export interface WebrtcSettings {
  stunUrls: string[];
  turnUrls: string[];
  turnSecret: string | null;
  turnTtlSeconds: number;
}

function readList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
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
    tokenPreviousPublicKeyPem: process.env.TOKEN_PREVIOUS_PUBLIC_KEY
      ? decodeBase64Key(process.env.TOKEN_PREVIOUS_PUBLIC_KEY)
      : null,
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
    webrtc: {
      stunUrls: readList(process.env.STUN_URLS),
      turnUrls: readList(process.env.TURN_URLS),
      turnSecret: process.env.TURN_SHARED_SECRET?.trim() || null,
      turnTtlSeconds: Number(process.env.TURN_TTL_SECONDS) > 0 ? Number(process.env.TURN_TTL_SECONDS) : 4 * 3600,
    },
    paymentGateways,
    paymentProviders: readPaymentProviderSettings(paymentGateways),
    notificationDispatchIntervalSeconds: Number(process.env.NOTIFICATION_DISPATCH_INTERVAL_SECONDS ?? 60),
    exportJobIntervalSeconds: Number(process.env.EXPORT_JOB_INTERVAL_SECONDS ?? 15),
    // SCHEDULER_MODE=external: không có hẹn giờ trong tiến trình, bộ hẹn giờ bên ngoài gọi điểm tick (máy chủ được phép ngủ khi rảnh)
    schedulerIntervalSeconds:
      process.env.SCHEDULER_MODE?.trim() === 'external' ? 0 : Number(process.env.SCHEDULER_INTERVAL_SECONDS ?? 15),
    schedulerConcurrency: Number(process.env.SCHEDULER_CONCURRENCY ?? 2),
    schoolMetricsIntervalSeconds: Number(process.env.SCHOOL_METRICS_INTERVAL_SECONDS ?? 3600),
    aggregateSnapshotIntervalSeconds: Number(process.env.AGGREGATE_SNAPSHOT_INTERVAL_SECONDS ?? 21_600),
    parentOrgMinGroup: Number(process.env.PARENT_ORG_MIN_GROUP) > 0 ? Number(process.env.PARENT_ORG_MIN_GROUP) : 5,
    platformConsoleHost: process.env.PLATFORM_CONSOLE_HOST?.trim() || null,
    marketplaceDatabaseUrl: process.env.MARKETPLACE_DATABASE_URL?.trim() || null,
    marketLinkSecret: process.env.MARKET_LINK_SECRET?.trim() || null,
    scormContentOrigin: process.env.SCORM_CONTENT_ORIGIN?.trim().replace(/\/+$/, '') || null,
    ...(process.env.INTERNAL_JOB_TOKEN?.trim() ? { schedulerSecret: process.env.INTERNAL_JOB_TOKEN.trim() } : {}),
    timetableMaxActiveRuns: Number(process.env.TIMETABLE_MAX_ACTIVE_RUNS ?? 2),
    ...readIntegrationConfiguration(process.env),
    smsProvider: readSmsProviderSettings(),
    redisUrl: process.env.REDIS_URL?.trim() || null,
    aiMock: readAiMock(process.env),
    push: readPushConfiguration(process.env, multiTenant),
    video: readVideoConfiguration(process.env),
  };
}

// AI_MOCK=true bật bộ giả lập nhà cung cấp AI; từ chối khi NODE_ENV=production để không lọt vào bản chạy thật
export function readAiMock(environment: NodeJS.ProcessEnv): boolean {
  if (environment.AI_MOCK?.trim() !== 'true') {
    return false;
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error('AI_MOCK=true chỉ dùng cho kiểm thử, không bật ở môi trường chạy thật');
  }
  return true;
}

// Cấu hình của lệnh vòng đời trường (DT-SaaS phần S2): nền tảng nhiều trường, tên miền hệ thống và số ngày chờ xóa, tên người
// chạy lệnh ghi vào nhật ký nền tảng
export interface PlatformCommandSettings {
  tenancy: TenancyConfiguration | null;
  lifecycle: LifecycleSettings;
  actorName: string;
}

export function readPlatformCommandSettings(): PlatformCommandSettings {
  return {
    tenancy: readTenancyConfiguration(process.env),
    lifecycle: lifecycleSettingsFrom(process.env),
    actorName: process.env.PLATFORM_CLI_ACTOR?.trim() || 'Lệnh vòng đời trường (máy chủ API)',
  };
}
