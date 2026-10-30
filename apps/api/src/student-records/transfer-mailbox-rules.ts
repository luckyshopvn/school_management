import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  randomInt,
  sign,
  verify,
} from 'node:crypto';
import type { WrappedTransferSecret } from '@school-management/database';
import { decryptSecret, encryptSecret } from '../common/secret-encryption.js';
import { transferPackageRule } from './transfer-package-rules.js';

// Mật mã của hộp thư chuyển trường, lát L2 (YCTD-390; BM-241). Gói gửi qua hộp thư mã hóa bằng mật khẩu ngẫu nhiên 32 ký tự (cùng
// định dạng gói của lát L1); mật khẩu bọc bằng khóa công khai X25519 của trường đến (khóa tạm thời, HKDF-SHA256, AES-256-GCM).
// Trường đi ký mã gói, hai trường, mã băm của gói bằng khóa Ed25519 của mình. Khóa riêng của trường lưu ở nền tảng, bọc bằng khóa gốc
const WRAP_INFO = Buffer.from('school-management.student-transfer/1 wrap', 'utf8');
const SECRET_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Gói chưa ai mở sau 90 ngày thì hết hạn; gói đã tiếp nhận, từ chối, thu hồi xóa sau 30 ngày
export const MAILBOX_EXPIRY_DAYS = 90;
export const MAILBOX_PURGE_DAYS = 30;

export interface SchoolTransferKeyRow {
  encryption_public_key: string;
  encryption_private_key_encrypted: string;
  signing_public_key: string;
  signing_private_key_encrypted: string;
}

export function generateMailboxSecret(): string {
  return Array.from({ length: 32 }, () => SECRET_ALPHABET[randomInt(SECRET_ALPHABET.length)]).join('');
}

export function generateSchoolTransferKeys(masterKey: Buffer): SchoolTransferKeyRow {
  const encryption = generateKeyPairSync('x25519');
  const signing = generateKeyPairSync('ed25519');
  const pem = (
    key: { export(options: { type: 'spki' | 'pkcs8'; format: 'pem' }): string | Buffer },
    type: 'spki' | 'pkcs8',
  ) => String(key.export({ type, format: 'pem' }));
  return {
    encryption_public_key: pem(encryption.publicKey, 'spki'),
    encryption_private_key_encrypted: encryptSecret(masterKey, pem(encryption.privateKey, 'pkcs8')),
    signing_public_key: pem(signing.publicKey, 'spki'),
    signing_private_key_encrypted: encryptSecret(masterKey, pem(signing.privateKey, 'pkcs8')),
  };
}

export function wrapSecret(recipientPublicKeyPem: string, secret: string): WrappedTransferSecret {
  const ephemeral = generateKeyPairSync('x25519');
  const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: createPublicKey(recipientPublicKeyPem) });
  const ephemeralPem = String(ephemeral.publicKey.export({ type: 'spki', format: 'pem' }));
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.from(ephemeralPem, 'utf8'), WRAP_INFO, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    ephemeral_public_key: ephemeralPem,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function unwrapSecret(masterKey: Buffer, keys: SchoolTransferKeyRow, wrapped: WrappedTransferSecret): string {
  try {
    const privateKey = createPrivateKey(decryptSecret(masterKey, keys.encryption_private_key_encrypted));
    const shared = diffieHellman({ privateKey, publicKey: createPublicKey(wrapped.ephemeral_public_key) });
    const key = Buffer.from(
      hkdfSync('sha256', shared, Buffer.from(wrapped.ephemeral_public_key, 'utf8'), WRAP_INFO, 32),
    );
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(wrapped.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(wrapped.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(wrapped.ciphertext, 'base64')), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    throw transferPackageRule('Không mở được gói: gói không gửi cho trường này hoặc khóa của trường đã đổi');
  }
}

// Nội dung được ký: mã gói, trường đi, trường đến, mã băm SHA-256 của tệp gói
export const signedText = (packageCode: string, fromSchoolId: string, toSchoolId: string, sha256: string) =>
  Buffer.from(`${packageCode}\n${fromSchoolId}\n${toSchoolId}\n${sha256}`, 'utf8');

export function signEnvelope(masterKey: Buffer, keys: SchoolTransferKeyRow, data: Buffer): string {
  const privateKey = createPrivateKey(decryptSecret(masterKey, keys.signing_private_key_encrypted));
  return sign(null, data, privateKey).toString('base64');
}

export function verifyEnvelope(signingPublicKeyPem: string, data: Buffer, signature: string): boolean {
  try {
    return verify(null, data, createPublicKey(signingPublicKeyPem), Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
