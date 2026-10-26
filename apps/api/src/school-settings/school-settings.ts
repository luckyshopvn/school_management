import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationSecretConnector } from '@school-management/database';
import { currentTenant, validationError, type FieldError } from '@school-management/server';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { Databases } from '../common/databases.js';
import { decryptSecret, encryptSecret } from '../common/secret-encryption.js';

// Cấu hình kết nối ngoài riêng từng trường (DT-SaaS phần S3, YCTD-195, tài liệu 32 mục 14.5): thanh toán, eSMS, Zalo OA, Facebook, kho
// tệp. Mỗi kết nối lưu một dòng ở `integration_secrets` của cơ sở dữ liệu hệ thống của trường, giá trị mã hóa bằng khóa của trường;
// không bao giờ trả lại giá trị đã lưu (chỉ bốn ký tự cuối của giá trị bí mật). Lớp này là nguồn duy nhất cho các bộ nối ngoài
// (`tenant-connectors.ts`) thay cho đọc biến môi trường ở chế độ nhiều trường

export type SecretConnector = IntegrationSecretConnector;

export interface ConnectorField {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  // `boolean` nhận chữ `true` hoặc `false`; `url` phải là địa chỉ https (hoặc http ở máy cục bộ)
  kind: 'text' | 'url' | 'boolean' | 'integer';
  max?: number;
}

export interface ConnectorSpec {
  label: string;
  group: 'payment' | 'sms' | 'zalo' | 'facebook' | 'storage' | 'ai';
  fields: ConnectorField[];
  // Cổng nhận thông báo tiền vào: hiển thị địa chỉ gọi lại của trường để dán vào cổng thanh toán
  webhookPath?: string;
}

const field = (
  name: string,
  label: string,
  options: { secret?: boolean; required?: boolean; kind?: ConnectorField['kind']; max?: number } = {},
): ConnectorField => ({
  name,
  label,
  secret: options.secret ?? false,
  required: options.required ?? true,
  kind: options.kind ?? 'text',
  ...(options.max ? { max: options.max } : {}),
});

export const CONNECTOR_SPECS: Record<SecretConnector, ConnectorSpec> = {
  payos: {
    label: 'PayOS',
    group: 'payment',
    webhookPath: '/api/v1/payment-webhooks/payos',
    fields: [
      field('client_id', 'Client ID'),
      field('api_key', 'API Key', { secret: true }),
      field('checksum_key', 'Checksum Key', { secret: true }),
      field('return_url', 'Địa chỉ quay lại sau thanh toán', { kind: 'url' }),
      field('cancel_url', 'Địa chỉ khi hủy thanh toán', { kind: 'url', required: false }),
      field('api_url', 'Địa chỉ API (mặc định của PayOS)', { kind: 'url', required: false }),
    ],
  },
  sepay: {
    label: 'SePay',
    group: 'payment',
    webhookPath: '/api/v1/payment-webhooks/sepay',
    fields: [field('webhook_api_key', 'Khóa API của webhook', { secret: true })],
  },
  casso: {
    label: 'Casso',
    group: 'payment',
    webhookPath: '/api/v1/payment-webhooks/casso',
    fields: [field('webhook_secret', 'Khóa bí mật của webhook', { secret: true })],
  },
  vnpay: {
    label: 'VNPay',
    group: 'payment',
    webhookPath: '/api/v1/payment-webhooks/vnpay-ipn',
    fields: [
      field('tmn_code', 'Mã TMN'),
      field('hash_secret', 'Chuỗi bí mật băm', { secret: true }),
      field('return_url', 'Địa chỉ quay lại sau thanh toán', { kind: 'url' }),
      field('payment_url', 'Địa chỉ cổng thanh toán (mặc định của VNPay)', { kind: 'url', required: false }),
    ],
  },
  vietqr: { label: 'VietQR tĩnh (đối soát qua sao kê)', group: 'payment', fields: [] },
  esms: {
    label: 'eSMS.vn',
    group: 'sms',
    fields: [
      field('api_key', 'API Key', { secret: true }),
      field('secret_key', 'Secret Key', { secret: true }),
      field('brandname', 'Tên thương hiệu đã đăng ký', { max: 11 }),
      field('sandbox', 'Gửi thử (không gửi tin thật): true hoặc false', { kind: 'boolean', required: false }),
      field('unicode', 'Gửi tin có dấu: true hoặc false', { kind: 'boolean', required: false }),
    ],
  },
  zalo: {
    label: 'Zalo Official Account',
    group: 'zalo',
    fields: [
      field('app_id', 'App ID'),
      field('app_secret', 'App Secret', { secret: true }),
      field('oa_refresh_token', 'Khóa làm mới ban đầu', { secret: true, required: false }),
    ],
  },
  facebook: {
    label: 'Facebook Page',
    group: 'facebook',
    fields: [
      field('page_access_token', 'Khóa truy cập trang', { secret: true }),
      field('graph_version', 'Phiên bản Graph API (mặc định v21.0)', { required: false, max: 12 }),
    ],
  },
  // Trợ lý AI cấu hình `school` (DT-23 phần 23d, GD-102): trường tự nhập khóa nhà cung cấp, tự trả chi phí, nền tảng không thu phí
  ai: {
    label: 'Trợ lý AI (khóa của trường)',
    group: 'ai',
    fields: [
      field('api_key', 'Khóa API của nhà cung cấp AI', { secret: true }),
      field('endpoint', 'Địa chỉ API (mặc định của nhà cung cấp)', { kind: 'url', required: false }),
    ],
  },
  storage: {
    label: 'Kho tệp riêng (tương thích S3)',
    group: 'storage',
    fields: [
      field('endpoint', 'Địa chỉ kho', { kind: 'url' }),
      field('region', 'Vùng'),
      field('bucket', 'Tên bucket'),
      field('access_key_id', 'Access Key ID', { secret: true }),
      field('secret_access_key', 'Secret Access Key', { secret: true }),
    ],
  },
};

export const SECRET_CONNECTORS = Object.keys(CONNECTOR_SPECS) as SecretConnector[];

export function isSecretConnector(value: string): value is SecretConnector {
  return Object.hasOwn(CONNECTOR_SPECS, value);
}

export interface StoredConnector {
  id: string;
  connector: SecretConnector;
  enabled: boolean;
  values: Record<string, string>;
  // Thay đổi gần nhất: bộ nối dựng lại khi giá trị này đổi
  version: string;
}

const CACHE_MILLISECONDS = 15_000;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/;

function hintOf(spec: ConnectorField, value: string): string {
  return spec.secret ? `••••${value.slice(-4)}` : value;
}

// Kiểm tra giá trị một kết nối; cột `current` là giá trị đã lưu (trường không gửi hoặc để trống thì giữ giá trị đã lưu)
export function validateConnectorValues(
  connector: SecretConnector,
  input: Record<string, unknown>,
  current: Record<string, string>,
  enabled: boolean,
): { values: Record<string, string>; errors: FieldError[] } {
  const spec = CONNECTOR_SPECS[connector];
  const errors: FieldError[] = [];
  const values: Record<string, string> = {};
  for (const name of Object.keys(input)) {
    if (!spec.fields.some((item) => item.name === name)) {
      errors.push({ field: `values.${name}`, message: 'Trường nhập không có ở kết nối này' });
    }
  }
  for (const item of spec.fields) {
    const raw = input[item.name];
    if (raw !== undefined && typeof raw !== 'string') {
      errors.push({ field: `values.${item.name}`, message: `${item.label} phải là chuỗi` });
      continue;
    }
    const text = (raw ?? '').trim();
    const value = text !== '' ? text : (current[item.name] ?? '');
    if (value === '') {
      if (enabled && item.required) {
        errors.push({ field: `values.${item.name}`, message: `Bật ${spec.label} phải nhập ${item.label}` });
      }
      continue;
    }
    if (value.length > (item.max ?? 500) || /[\r\n\0]/.test(value)) {
      errors.push({ field: `values.${item.name}`, message: `${item.label} không hợp lệ` });
      continue;
    }
    if (item.kind === 'url' && !URL_PATTERN.test(value)) {
      errors.push({ field: `values.${item.name}`, message: `${item.label} phải là địa chỉ http hoặc https` });
      continue;
    }
    if (item.kind === 'boolean' && value !== 'true' && value !== 'false') {
      errors.push({ field: `values.${item.name}`, message: `${item.label} chỉ nhận true hoặc false` });
      continue;
    }
    values[item.name] = value;
  }
  return { values, errors };
}

@Injectable()
export class SchoolSettings {
  private readonly cache = new Map<string, { at: number; rows: Map<SecretConnector, StoredConnector> }>();

  constructor(
    private readonly databases: Databases,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
  ) {}

  private cacheKey(): string {
    return currentTenant()?.code ?? '';
  }

  invalidate(): void {
    this.cache.delete(this.cacheKey());
  }

  // Mọi kết nối đã lưu của trường trong ngữ cảnh (đệm ngắn; ghi qua `save` thì xóa đệm của tiến trình này)
  async all(): Promise<Map<SecretConnector, StoredConnector>> {
    const key = this.cacheKey();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MILLISECONDS) {
      return cached.rows;
    }
    const rows = await this.databases.system.selectFrom('integration_secrets').selectAll().execute();
    const map = new Map<SecretConnector, StoredConnector>();
    for (const row of rows) {
      let values: Record<string, string>;
      try {
        values = JSON.parse(decryptSecret(this.configuration.childDataEncryptionKey, row.values_encrypted)) as Record<
          string,
          string
        >;
      } catch {
        // Không giải mã được (khóa đổi dở): coi như chưa cấu hình, không rơi về khóa nơi khác
        continue;
      }
      map.set(row.connector, {
        id: row.id,
        connector: row.connector,
        enabled: row.enabled,
        values,
        version: row.updated_at.toISOString(),
      });
    }
    this.cache.set(key, { at: Date.now(), rows: map });
    return map;
  }

  // Giá trị đang dùng của một kết nối; chưa lưu hoặc đang tắt thì null
  async active(connector: SecretConnector): Promise<StoredConnector | null> {
    const row = (await this.all()).get(connector);
    return row?.enabled ? row : null;
  }

  async view(connector: SecretConnector) {
    const spec = CONNECTOR_SPECS[connector];
    const row = (await this.all()).get(connector);
    return {
      connector,
      label: spec.label,
      group: spec.group,
      configured: row !== undefined,
      enabled: row?.enabled ?? false,
      fields: spec.fields.map((item) => ({
        name: item.name,
        label: item.label,
        secret: item.secret,
        required: item.required,
        kind: item.kind,
        // Giá trị bí mật chỉ trả bốn ký tự cuối
        value: row?.values[item.name] ? hintOf(item, row.values[item.name] as string) : null,
      })),
      webhook_path: spec.webhookPath ?? null,
      updated_at: row?.version ?? null,
    };
  }

  async save(
    connector: SecretConnector,
    input: { enabled: boolean; values: Record<string, unknown> },
    actor: { id: string; name: string },
  ) {
    const current = (await this.all()).get(connector)?.values ?? {};
    const { values, errors } = validateConnectorValues(connector, input.values, current, input.enabled);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const spec = CONNECTOR_SPECS[connector];
    const hints: Record<string, string> = {};
    for (const item of spec.fields) {
      if (values[item.name]) {
        hints[item.name] = hintOf(item, values[item.name] as string);
      }
    }
    const encrypted = encryptSecret(this.configuration.childDataEncryptionKey, JSON.stringify(values));
    await this.databases.system
      .insertInto('integration_secrets')
      .values({
        connector,
        enabled: input.enabled,
        values_encrypted: encrypted,
        hints: JSON.stringify(hints),
        updated_by: actor.id,
        updated_by_name: actor.name,
      })
      .onConflict((conflict) =>
        conflict.column('connector').doUpdateSet({
          enabled: input.enabled,
          values_encrypted: encrypted,
          hints: JSON.stringify(hints),
          updated_at: new Date(),
          updated_by: actor.id,
          updated_by_name: actor.name,
        }),
      )
      .execute();
    this.invalidate();
    return this.view(connector);
  }

  async remove(connector: SecretConnector): Promise<boolean> {
    const result = await this.databases.system
      .deleteFrom('integration_secrets')
      .where('connector', '=', connector)
      .executeTakeFirst();
    this.invalidate();
    return Number(result.numDeletedRows) > 0;
  }
}
