import { createPrivateKey } from 'node:crypto';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import type { NativePushProvider } from '../platform/schema-parts/dt-26g-day-goc.js';

// Khóa đẩy gốc của nền tảng (DT-26 phần 26g, YCTD-237): FCM (tài khoản dịch vụ Firebase, giao thức HTTP v1) cho Android, APNs (khóa
// dạng mã thông báo `.p8`) cho iOS; một ứng dụng chung cho mọi trường nên khóa ở cơ sở dữ liệu nền tảng, mã hóa bằng khóa gốc.
// Nạp từ tệp do Eric tạo trên máy mình (lệnh `platform set-native-push-key`), không có tệp khóa nào trong kho mã
export interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export type ApnsEnvironment = 'sandbox' | 'production';

export interface ApnsCredentials {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  environment: ApnsEnvironment;
}

export interface NativePushCredentials {
  fcm: FcmCredentials | null;
  apns: ApnsCredentials | null;
}

function validPrivateKey(pem: string): boolean {
  try {
    createPrivateKey(pem);
    return true;
  } catch {
    return false;
  }
}

// Tệp tài khoản dịch vụ tải từ Firebase (Cài đặt dự án → Tài khoản dịch vụ → Tạo khóa riêng mới)
export function parseFcmServiceAccount(text: string): FcmCredentials {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Tệp tài khoản dịch vụ Firebase không phải JSON');
  }
  const projectId = typeof value.project_id === 'string' ? value.project_id : '';
  const clientEmail = typeof value.client_email === 'string' ? value.client_email : '';
  const privateKey = typeof value.private_key === 'string' ? value.private_key : '';
  if (value.type !== 'service_account' || !/^[a-z0-9-]{4,40}$/.test(projectId) || !clientEmail.includes('@')) {
    throw new Error('Tệp tài khoản dịch vụ Firebase thiếu type=service_account, project_id hoặc client_email');
  }
  if (!validPrivateKey(privateKey)) {
    throw new Error('Khóa riêng trong tệp tài khoản dịch vụ Firebase không đọc được');
  }
  return { projectId, clientEmail, privateKey };
}

// Khóa APNs tạo ở Apple Developer (Certificates, Identifiers & Profiles → Keys, bật Apple Push Notifications service)
export function parseApnsKey(input: {
  privateKey: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  environment: string;
}): ApnsCredentials {
  if (!/^[A-Z0-9]{10}$/.test(input.keyId) || !/^[A-Z0-9]{10}$/.test(input.teamId)) {
    throw new Error('Mã khóa APNs và mã đội Apple là 10 ký tự chữ hoa, chữ số');
  }
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(input.bundleId)) {
    throw new Error('Mã gói ứng dụng iOS không đúng (ví dụ vn.schoolmanagement.demo)');
  }
  if (input.environment !== 'sandbox' && input.environment !== 'production') {
    throw new Error('Môi trường APNs là sandbox hoặc production');
  }
  if (!validPrivateKey(input.privateKey)) {
    throw new Error('Tệp khóa APNs .p8 không đọc được');
  }
  return {
    keyId: input.keyId,
    teamId: input.teamId,
    bundleId: input.bundleId,
    privateKey: input.privateKey,
    environment: input.environment,
  };
}

function summaryOf(
  provider: NativePushProvider,
  credentials: FcmCredentials | ApnsCredentials,
): Record<string, string> {
  if (provider === 'fcm') {
    const fcm = credentials as FcmCredentials;
    return { project_id: fcm.projectId, client_email: fcm.clientEmail };
  }
  const apns = credentials as ApnsCredentials;
  return { key_id: apns.keyId, team_id: apns.teamId, bundle_id: apns.bundleId, environment: apns.environment };
}

// Thay khóa đang dùng của một nhà cung cấp (khóa cũ ghi thời điểm thôi dùng); ghi nhật ký nền tảng phần không bí mật
export async function storeNativePushKey(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  provider: NativePushProvider,
  credentials: FcmCredentials | ApnsCredentials,
): Promise<Record<string, string>> {
  const summary = summaryOf(provider, credentials);
  await platform.transaction().execute(async (transaction) => {
    await transaction
      .updateTable('platform_native_push_keys')
      .set({ retired_at: new Date() })
      .where('provider', '=', provider)
      .where('retired_at', 'is', null)
      .execute();
    await transaction
      .insertInto('platform_native_push_keys')
      .values({
        provider,
        credentials_encrypted: encryptSecret(masterKey, JSON.stringify(credentials)),
        summary: JSON.stringify(summary),
      })
      .execute();
    await transaction
      .insertInto('platform_audit_log')
      .values({ actor_type: 'cli', action: `push.${provider}-key-stored`, details: JSON.stringify(summary) })
      .execute();
  });
  return summary;
}

export async function retireNativePushKey(
  platform: Kysely<PlatformDatabase>,
  provider: NativePushProvider,
): Promise<boolean> {
  const result = await platform
    .updateTable('platform_native_push_keys')
    .set({ retired_at: new Date() })
    .where('provider', '=', provider)
    .where('retired_at', 'is', null)
    .executeTakeFirst();
  if (Number(result.numUpdatedRows) > 0) {
    await platform
      .insertInto('platform_audit_log')
      .values({ actor_type: 'cli', action: `push.${provider}-key-retired`, details: JSON.stringify({}) })
      .execute();
  }
  return Number(result.numUpdatedRows) > 0;
}

export async function readNativePushCredentials(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
): Promise<NativePushCredentials> {
  const rows = await platform
    .selectFrom('platform_native_push_keys')
    .select(['provider', 'credentials_encrypted'])
    .where('retired_at', 'is', null)
    .execute();
  const read = <T>(provider: NativePushProvider): T | null => {
    const row = rows.find((item) => item.provider === provider);
    return row ? (JSON.parse(decryptSecret(masterKey, row.credentials_encrypted)) as T) : null;
  };
  return { fcm: read<FcmCredentials>('fcm'), apns: read<ApnsCredentials>('apns') };
}
