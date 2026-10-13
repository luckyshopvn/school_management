import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { API_CONFIGURATION, type ApiConfiguration } from './configuration.js';
import { decryptSecret, encryptSecret } from './secret-encryption.js';

// Mã hóa số định danh cá nhân của trẻ khi lưu (BM-64); băm có khóa để kiểm tra trùng mà không cần giải mã (BR-07)
@Injectable()
export class ChildDataProtection {
  constructor(@Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration) {}

  // Kết quả gồm số dùng một lần, thẻ xác thực và bản mã, mã hóa base64
  encrypt(plainText: string): string {
    return encryptSecret(this.configuration.childDataEncryptionKey, plainText);
  }

  decrypt(encoded: string): string {
    return decryptSecret(this.configuration.childDataEncryptionKey, encoded);
  }

  hash(plainText: string): string {
    return createHmac('sha256', this.configuration.childDataHashKey).update(plainText).digest('hex');
  }
}

export function maskNationalId(lastFour: string): string {
  return `********${lastFour}`;
}
