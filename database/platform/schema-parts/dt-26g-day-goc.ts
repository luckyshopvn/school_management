import type { ColumnType, Generated } from 'kysely';
import type { CreatedTimestamp } from '../schema.js';

// Khóa đẩy gốc FCM, APNs của nền tảng (DT-26 phần 26g, YCTD-237; migration 0232): khóa mã hóa bằng khóa gốc, phần không bí mật ở
// `summary`; mỗi nhà cung cấp một khóa đang dùng
export type NativePushProvider = 'fcm' | 'apns';

export interface PlatformNativePushKeysTable {
  id: Generated<string>;
  provider: NativePushProvider;
  credentials_encrypted: string;
  summary: ColumnType<Record<string, string>, string | undefined, string>;
  created_at: CreatedTimestamp;
  retired_at: Date | null;
}

declare module '../schema.js' {
  interface PlatformDatabase {
    platform_native_push_keys: PlatformNativePushKeysTable;
  }
}
