import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase } from '../../platform/schema.js';
import { writeAudit } from '../provision-school.js';

// Khóa cổng thanh toán của nền tảng (DT-SaaS phần S5b, YCTD-196): tài khoản nhận tiền thu phí các trường. Lưu như kho khóa của S3
// (một dòng mỗi kết nối, toàn bộ giá trị là một đối tượng JSON mã hóa AES-256-GCM) nhưng bằng khóa gốc của nền tảng
// (`PLATFORM_MASTER_KEY`) vì không thuộc trường nào; chỉ trả gợi ý bốn ký tự cuối của giá trị bí mật, không bao giờ trả lại giá trị

export const PLATFORM_PAYMENT_CONNECTORS = ['payos', 'sepay', 'casso', 'vnpay', 'vietqr'] as const;
export type PlatformPaymentConnector = (typeof PLATFORM_PAYMENT_CONNECTORS)[number];

export interface PlatformConnectorField {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
}

const field = (name: string, label: string, secret = false, required = true): PlatformConnectorField => ({
  name,
  label,
  secret,
  required,
});

export const PLATFORM_CONNECTOR_FIELDS: Record<
  PlatformPaymentConnector,
  { label: string; fields: PlatformConnectorField[] }
> = {
  payos: {
    label: 'PayOS',
    fields: [
      field('client_id', 'Client ID'),
      field('api_key', 'API Key', true),
      field('checksum_key', 'Checksum Key', true),
      field('return_url', 'Địa chỉ quay lại sau thanh toán'),
      field('api_url', 'Địa chỉ API (mặc định của PayOS)', false, false),
    ],
  },
  sepay: { label: 'SePay', fields: [field('webhook_api_key', 'Khóa API của webhook', true)] },
  casso: { label: 'Casso', fields: [field('webhook_secret', 'Khóa bí mật của webhook', true)] },
  vnpay: {
    label: 'VNPay',
    fields: [
      field('tmn_code', 'Mã TMN'),
      field('hash_secret', 'Chuỗi bí mật băm', true),
      field('return_url', 'Địa chỉ quay lại sau thanh toán'),
      field('payment_url', 'Địa chỉ cổng thanh toán (mặc định của VNPay)', false, false),
    ],
  },
  vietqr: { label: 'VietQR tĩnh (đối soát qua sao kê)', fields: [] },
};

export function isPlatformPaymentConnector(value: string): value is PlatformPaymentConnector {
  return (PLATFORM_PAYMENT_CONNECTORS as readonly string[]).includes(value);
}

export interface StoredPlatformConnector {
  connector: PlatformPaymentConnector;
  enabled: boolean;
  values: Record<string, string>;
  version: string;
}

const hintOf = (value: string) => (value.length <= 4 ? '••••' : `••••${value.slice(-4)}`);

// Lưu cấu hình một kết nối: giá trị bí mật để trống thì giữ giá trị cũ; thiếu giá trị bắt buộc thì từ chối
export async function savePlatformConnector(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  input: { connector: PlatformPaymentConnector; enabled: boolean; values: Record<string, string> },
  actor: { type: 'operator' | 'cli'; id?: string },
): Promise<void> {
  const spec = PLATFORM_CONNECTOR_FIELDS[input.connector];
  const existing = (await readPlatformConnectors(platform, masterKey)).get(input.connector);
  const values: Record<string, string> = {};
  const hints: Record<string, string> = {};
  for (const item of spec.fields) {
    const given = (input.values[item.name] ?? '').trim();
    const value = given || (item.secret ? (existing?.values[item.name] ?? '') : '');
    if (item.required && !value) {
      throw new Error(`Thiếu ${item.label}`);
    }
    if (value) {
      values[item.name] = value;
      hints[item.name] = item.secret ? hintOf(value) : value;
    }
  }
  const now = new Date();
  await platform
    .insertInto('platform_integration_secrets')
    .values({
      connector: input.connector,
      enabled: input.enabled,
      values_encrypted: encryptSecret(masterKey, JSON.stringify(values)),
      hints: JSON.stringify(hints),
      updated_at: now,
      updated_by: actor.id ?? null,
    })
    .onConflict((conflict) =>
      conflict.column('connector').doUpdateSet({
        enabled: input.enabled,
        values_encrypted: encryptSecret(masterKey, JSON.stringify(values)),
        hints: JSON.stringify(hints),
        updated_at: now,
        updated_by: actor.id ?? null,
      }),
    )
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'billing.connector-update',
    details: { connector: input.connector, enabled: input.enabled, fields: Object.keys(values) },
  });
}

export async function readPlatformConnectors(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
): Promise<Map<PlatformPaymentConnector, StoredPlatformConnector>> {
  const rows = await platform.selectFrom('platform_integration_secrets').selectAll().execute();
  const result = new Map<PlatformPaymentConnector, StoredPlatformConnector>();
  for (const row of rows) {
    if (!isPlatformPaymentConnector(row.connector)) {
      continue;
    }
    result.set(row.connector, {
      connector: row.connector,
      enabled: row.enabled,
      values: JSON.parse(decryptSecret(masterKey, row.values_encrypted)) as Record<string, string>,
      version: `${row.updated_at.getTime()}`,
    });
  }
  return result;
}

// Danh sách cho cổng vận hành: chỉ gợi ý, không giá trị
export async function listPlatformConnectors(platform: Kysely<PlatformDatabase>) {
  const rows = await platform.selectFrom('platform_integration_secrets').selectAll().execute();
  const stored = new Map(rows.map((row) => [row.connector, row]));
  return PLATFORM_PAYMENT_CONNECTORS.map((connector) => {
    const row = stored.get(connector);
    return {
      connector,
      label: PLATFORM_CONNECTOR_FIELDS[connector].label,
      configured: Boolean(row),
      enabled: row?.enabled ?? false,
      hints: row?.hints ?? {},
      updated_at: row?.updated_at ?? null,
      fields: PLATFORM_CONNECTOR_FIELDS[connector].fields,
    };
  });
}
