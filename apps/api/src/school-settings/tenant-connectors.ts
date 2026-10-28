import { isMultiTenantMode, currentTenant } from '@school-management/server';
import type { SmsProviderSettings } from '@school-management/server';
import type { ApiConfiguration, ObjectStorageSettings } from '../common/configuration.js';
import {
  PaymentGatewayRegistry,
  UnavailablePaymentGateway,
  type PaymentProviderCode,
} from '../finance/payment-gateway.js';
import {
  createPaymentGateway,
  DEFAULT_PAYOS_API_URL,
  DEFAULT_VNPAY_PAYMENT_URL,
  type PaymentProviderSettings,
} from '../finance/payment-providers.js';
import { FileStorage, S3FileStorage } from '../files/file-storage.js';
import {
  DevelopmentFacebookPublisher,
  DEFAULT_FACEBOOK_GRAPH_VERSION,
  FacebookPublisher,
  GraphApiFacebookPublisher,
  UnavailableFacebookPublisher,
  type FacebookPostInput,
} from '../integrations/facebook-publisher.js';
import {
  DevelopmentZaloSender,
  OfficialAccountZaloSender,
  UnavailableZaloSender,
  ZaloSender,
} from '../integrations/zalo-sender.js';
import { ZaloTokenStore, type ZaloTokenStoreOptions } from '../integrations/zalo-token-store.js';
import { createSmsGateway, LoggingSmsGateway, SmsGateway } from '../notifications/sms-gateway.js';
import type { SchoolSettings, StoredConnector } from './school-settings.js';

// Bộ nối ngoài đọc cấu hình theo từng trường (DT-SaaS phần S3, YCTD-195, tài liệu 32 mục 14.5), thay cho `readConfigurationFromEnvironment`.
// Quy tắc chọn nguồn của mỗi bộ nối:
//   1. trường có cấu hình đang bật ở `integration_secrets` thì dùng cấu hình đó;
//   2. bộ giả lập (`development`, ghi nhật ký) đặt ở cấu hình máy chủ vẫn dùng được cho phát triển và kiểm thử;
//   3. chế độ một trường: khóa ở biến môi trường như trước (hành vi không đổi);
//   4. chế độ nhiều trường: bộ nối tắt (không có khóa, báo chưa cấu hình), tuyệt đối không dùng khóa của cả bản triển khai hay của
//      trường khác.
// Bộ nối dựng từ cấu hình được giữ lại theo trường và dựng lại khi cấu hình đổi

class ConnectorCache<T> {
  private readonly entries = new Map<string, { version: string; value: T }>();

  get(version: string, build: () => T): T {
    const key = currentTenant()?.code ?? '';
    const cached = this.entries.get(key);
    if (cached && cached.version === version) {
      return cached.value;
    }
    const value = build();
    this.entries.set(key, { version, value });
    return value;
  }
}

const flag = (value: string | undefined) => value === 'true';

// ---- Tin nhắn eSMS
export class TenantSmsGateway extends SmsGateway {
  private readonly cache = new ConnectorCache<SmsGateway>();

  constructor(
    private readonly settings: SchoolSettings,
    private readonly configuration: ApiConfiguration,
  ) {
    super();
  }

  private async resolve(): Promise<SmsGateway> {
    const stored = await this.settings.active('esms');
    if (stored) {
      return this.cache.get(stored.version, () =>
        createSmsGateway({
          provider: 'esms',
          esms: {
            apiKey: stored.values.api_key ?? '',
            secretKey: stored.values.secret_key ?? '',
            brandname: stored.values.brandname ?? '',
            sandbox: flag(stored.values.sandbox),
            unicode: flag(stored.values.unicode),
          },
        }),
      );
    }
    // Nhiều trường không có cấu hình thì chỉ ghi nhật ký, không gửi tin thật bằng khóa của cả bản triển khai
    const environment: SmsProviderSettings | undefined = isMultiTenantMode()
      ? { provider: 'log' }
      : this.configuration.smsProvider;
    return this.cache.get(`env:${environment?.provider ?? 'log'}`, () => createSmsGateway(environment));
  }

  async send(phone: string, text: string): Promise<void> {
    await (await this.resolve()).send(phone, text);
  }
}

// ---- Fanpage
export class TenantFacebookPublisher extends FacebookPublisher {
  readonly provider = 'tenant';
  readonly available = false;
  private readonly cache = new ConnectorCache<FacebookPublisher>();

  constructor(
    private readonly settings: SchoolSettings,
    private readonly configuration: ApiConfiguration,
  ) {
    super();
  }

  // Bộ nối đang dùng của trường trong ngữ cảnh (kiểm thử lấy bộ giả lập ở đây)
  async current(): Promise<FacebookPublisher> {
    const stored = await this.settings.active('facebook');
    if (stored && stored.values.page_access_token) {
      return this.cache.get(
        stored.version,
        () =>
          new GraphApiFacebookPublisher(
            stored.values.page_access_token as string,
            stored.values.graph_version || DEFAULT_FACEBOOK_GRAPH_VERSION,
          ),
      );
    }
    if (this.configuration.facebookPublisher === 'development') {
      return this.cache.get('env:development', () => new DevelopmentFacebookPublisher());
    }
    if (!isMultiTenantMode() && this.configuration.facebookPageAccessToken) {
      const token = this.configuration.facebookPageAccessToken;
      return this.cache.get(
        `env:${token.length}`,
        () => new GraphApiFacebookPublisher(token, this.configuration.facebookGraphVersion),
      );
    }
    return this.cache.get('none', () => new UnavailableFacebookPublisher());
  }

  override async isAvailable(): Promise<boolean> {
    return (await this.current()).available;
  }

  override async providerName(): Promise<string> {
    return (await this.current()).provider;
  }

  async publish(input: FacebookPostInput): Promise<{ postId: string }> {
    return (await this.current()).publish(input);
  }

  async verify(pageId: string): Promise<{ id: string; name: string }> {
    return (await this.current()).verify(pageId);
  }
}

// ---- Zalo Official Account
export function zaloTokenOptions(
  settings: SchoolSettings,
  configuration: ApiConfiguration,
): () => Promise<ZaloTokenStoreOptions> {
  return async () => {
    const stored = await settings.active('zalo');
    if (stored) {
      return {
        appId: stored.values.app_id ?? null,
        appSecret: stored.values.app_secret ?? null,
        seedRefreshToken: stored.values.oa_refresh_token ?? null,
        seedAccessToken: null,
      };
    }
    if (isMultiTenantMode()) {
      return { appId: null, appSecret: null, seedRefreshToken: null, seedAccessToken: null };
    }
    return {
      appId: configuration.zaloAppId ?? null,
      appSecret: configuration.zaloAppSecret ?? null,
      seedRefreshToken: configuration.zaloOaRefreshToken ?? null,
      seedAccessToken: configuration.zaloOaAccessToken ?? null,
    };
  };
}

export class TenantZaloSender extends ZaloSender {
  readonly provider = 'tenant';
  readonly available = false;
  private readonly cache = new ConnectorCache<ZaloSender>();

  constructor(
    private readonly settings: SchoolSettings,
    private readonly configuration: ApiConfiguration,
    private readonly tokens: ZaloTokenStore,
  ) {
    super();
  }

  // Bộ nối đang dùng của trường trong ngữ cảnh (kiểm thử lấy bộ giả lập ở đây)
  async current(): Promise<ZaloSender> {
    const stored = await this.settings.active('zalo');
    if (stored) {
      return this.cache.get(stored.version, () => new OfficialAccountZaloSender(this.tokens));
    }
    if (this.configuration.zaloSender === 'development') {
      return this.cache.get('env:development', () => new DevelopmentZaloSender());
    }
    if (!isMultiTenantMode() && this.configuration.zaloSender === 'zalo_oa') {
      return this.cache.get('env:zalo_oa', () => new OfficialAccountZaloSender(this.tokens));
    }
    return this.cache.get('none', () => new UnavailableZaloSender());
  }

  override async isAvailable(): Promise<boolean> {
    return (await this.current()).available;
  }

  override async providerName(): Promise<string> {
    return (await this.current()).provider;
  }

  async send(zaloUserId: string, text: string): Promise<void> {
    await (await this.current()).send(zaloUserId, text);
  }

  async verify(): Promise<{ oaId: string; name: string }> {
    return (await this.current()).verify();
  }
}

// ---- Cổng thanh toán
// Thứ tự ưu tiên khi trường bật nhiều cổng: cổng đầu là cổng mặc định
const PAYMENT_ORDER = ['payos', 'vnpay', 'sepay', 'casso', 'vietqr'] as const;

export function paymentSettingsOf(stored: Map<string, StoredConnector>): {
  codes: PaymentProviderCode[];
  providers: PaymentProviderSettings;
} {
  const codes: PaymentProviderCode[] = [];
  const providers: PaymentProviderSettings = {};
  for (const connector of PAYMENT_ORDER) {
    const row = stored.get(connector);
    if (!row?.enabled) {
      continue;
    }
    const value = (name: string) => row.values[name] ?? '';
    if (connector === 'payos') {
      providers.payos = {
        clientId: value('client_id'),
        apiKey: value('api_key'),
        checksumKey: value('checksum_key'),
        returnUrl: value('return_url'),
        cancelUrl: value('cancel_url') || value('return_url'),
        apiUrl: (value('api_url') || DEFAULT_PAYOS_API_URL).replace(/\/+$/, ''),
      };
      codes.push('payos');
    } else if (connector === 'vnpay') {
      providers.vnpay = {
        tmnCode: value('tmn_code'),
        hashSecret: value('hash_secret'),
        returnUrl: value('return_url'),
        paymentUrl: value('payment_url') || DEFAULT_VNPAY_PAYMENT_URL,
        expireMinutes: 15,
      };
      codes.push('vnpay');
    } else if (connector === 'sepay') {
      providers.sepay = { webhookApiKey: value('webhook_api_key') };
      codes.push('sepay');
    } else if (connector === 'casso') {
      providers.casso = { webhookSecret: value('webhook_secret') };
      codes.push('casso');
    } else {
      codes.push('vietqr-static');
    }
  }
  return { codes, providers };
}

// Bảng cổng thanh toán của trường trong ngữ cảnh: dựng từ các kết nối thanh toán đang bật; chưa bật kết nối nào thì dùng cổng
// giả lập đặt ở cấu hình máy chủ (phát triển, kiểm thử), chế độ một trường dùng cổng ở biến môi trường như trước; còn lại là chưa nối
export class TenantPaymentGatewayRegistry extends PaymentGatewayRegistry {
  private readonly cache = new ConnectorCache<PaymentGatewayRegistry>();

  constructor(
    private readonly settings: SchoolSettings,
    private readonly configuration: ApiConfiguration,
  ) {
    super([]);
  }

  // Bảng cổng của trường trong ngữ cảnh; nơi dùng gọi `prepare()` đầu mỗi thao tác rồi dùng bảng trả về
  override async prepare(): Promise<PaymentGatewayRegistry> {
    const all = await this.settings.all();
    const paymentRows = new Map([...all].filter(([connector]) => PAYMENT_ORDER.includes(connector as never)));
    const version = [...paymentRows.values()].map((row) => `${row.connector}:${row.enabled}:${row.version}`).join('|');
    const registry = this.cache.get(version || `env:${currentTenant()?.code ?? ''}`, () => {
      const { codes, providers } = paymentSettingsOf(paymentRows);
      if (codes.length > 0) {
        return new PaymentGatewayRegistry(codes.map((code) => createPaymentGateway(code, providers)));
      }
      const simulated = (this.configuration.paymentGateways ?? []).filter(
        (code) => code === 'development' || code === 'vietqr-static',
      );
      if (isMultiTenantMode()) {
        return new PaymentGatewayRegistry(simulated.map((code) => createPaymentGateway(code)));
      }
      return new PaymentGatewayRegistry(
        (this.configuration.paymentGateways ?? []).map((code) =>
          createPaymentGateway(code, this.configuration.paymentProviders),
        ),
      );
    });
    return registry;
  }
}

// ---- Kho tệp
// Trường có kho riêng thì dùng kho đó; không thì kho chung của bản triển khai (khóa tệp đã có tiền tố của trường)
export class TenantFileStorage extends FileStorage {
  private readonly cache = new ConnectorCache<FileStorage>();

  constructor(
    private readonly settings: SchoolSettings,
    private readonly shared: FileStorage | null,
  ) {
    super();
  }

  private async resolve(): Promise<FileStorage> {
    const stored = await this.settings.active('storage');
    if (stored) {
      return this.cache.get(
        stored.version,
        () =>
          new S3FileStorage({
            endpoint: stored.values.endpoint ?? '',
            region: stored.values.region ?? '',
            bucket: stored.values.bucket ?? '',
            accessKeyId: stored.values.access_key_id ?? '',
            secretAccessKey: stored.values.secret_access_key ?? '',
          } satisfies ObjectStorageSettings),
      );
    }
    if (!this.shared) {
      throw new Error('Thiếu cấu hình kho tệp');
    }
    return this.shared;
  }

  // Kho chung của bản triển khai, không qua cấu hình của trường: dùng cho phần không thuộc trường nào (tệp giấy tờ của gia sư ở chợ,
  // DT-27 phần 27g), nơi không có ngữ cảnh trường để đọc cấu hình kho riêng
  deploymentStorage(): FileStorage {
    if (!this.shared) {
      throw new Error('Thiếu cấu hình kho tệp');
    }
    return this.shared;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await (await this.resolve()).put(key, body, contentType);
  }

  async get(key: string): Promise<Buffer> {
    return (await this.resolve()).get(key);
  }

  async delete(key: string): Promise<void> {
    await (await this.resolve()).delete(key);
  }

  async deletePrefix(prefix: string): Promise<number> {
    return (await this.resolve()).deletePrefix(prefix);
  }
}

export { LoggingSmsGateway, UnavailablePaymentGateway };
