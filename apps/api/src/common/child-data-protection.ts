import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { API_CONFIGURATION, type ApiConfiguration } from './configuration.js';

// Mã hóa số định danh cá nhân của trẻ khi lưu (BM-64); băm có khóa để kiểm tra trùng mà không cần giải mã (BR-07)
const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

@Injectable()
export class ChildDataProtection {
  constructor(@Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration) {}

  // Kết quả gồm số dùng một lần, thẻ xác thực và bản mã, mã hóa base64
  encrypt(plainText: string): string {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.configuration.childDataEncryptionKey, nonce);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(encoded: string): string {
    const raw = Buffer.from(encoded, 'base64');
    const decipher = createDecipheriv(
      ALGORITHM,
      this.configuration.childDataEncryptionKey,
      raw.subarray(0, NONCE_BYTES),
    );
    decipher.setAuthTag(raw.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(NONCE_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
  }

  hash(plainText: string): string {
    return createHmac('sha256', this.configuration.childDataHashKey).update(plainText).digest('hex');
  }
}

export function maskNationalId(lastFour: string): string {
  return `********${lastFour}`;
}
