import { generateKeyPairSync } from 'node:crypto';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';

// Khóa VAPID của nền tảng cho thông báo đẩy Web Push (DT-26 phần 26b, YCTD-232): cặp khóa P-256, khóa công khai dạng điểm không nén
// (65 byte) và khóa riêng (32 byte), mã hóa base64url theo RFC 8292; khóa riêng lưu mã hóa bằng khóa gốc của nền tảng
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function generateVapidKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });
  const point = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(publicJwk.x as string, 'base64url'),
    Buffer.from(publicJwk.y as string, 'base64url'),
  ]);
  return { publicKey: point.toString('base64url'), privateKey: privateJwk.d as string };
}

export function validVapidSubject(subject: string): boolean {
  return /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject);
}

// Sinh cặp khóa mới, thay khóa đang dùng (khóa cũ ghi thời điểm thôi dùng); trả khóa công khai
export async function rotateVapidKeys(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  subject: string,
): Promise<{ publicKey: string }> {
  if (!validVapidSubject(subject)) {
    throw new Error('Địa chỉ liên hệ VAPID phải là mailto:<thư điện tử> hoặc https://<địa chỉ>');
  }
  const pair = generateVapidKeyPair();
  await platform.transaction().execute(async (transaction) => {
    await transaction
      .updateTable('platform_push_keys')
      .set({ retired_at: new Date() })
      .where('retired_at', 'is', null)
      .execute();
    await transaction
      .insertInto('platform_push_keys')
      .values({
        public_key: pair.publicKey,
        private_key_encrypted: encryptSecret(masterKey, pair.privateKey),
        subject,
      })
      .execute();
    await transaction
      .insertInto('platform_audit_log')
      .values({
        actor_type: 'cli',
        action: 'push.vapid-rotated',
        details: JSON.stringify({ public_key: pair.publicKey }),
      })
      .execute();
  });
  return { publicKey: pair.publicKey };
}

export async function readActiveVapidKeys(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
): Promise<VapidKeys | null> {
  const row = await platform
    .selectFrom('platform_push_keys')
    .select(['public_key', 'private_key_encrypted', 'subject'])
    .where('retired_at', 'is', null)
    .executeTakeFirst();
  return row
    ? {
        publicKey: row.public_key,
        privateKey: decryptSecret(masterKey, row.private_key_encrypted),
        subject: row.subject,
      }
    : null;
}
