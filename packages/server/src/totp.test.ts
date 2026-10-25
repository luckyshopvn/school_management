import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  totpCode,
  totpCodeAt,
  totpUri,
  verifyTotp,
} from './totp.js';

// Xác thực hai lớp TOTP (DT-SaaS phần S8b, YCTD-201): đối chiếu vectơ thử của RFC 6238 và các quy tắc kiểm tra mã
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('khớp vectơ thử RFC 6238 (SHA-1, 8 chữ số rút còn 6)', () => {
    const vectors: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ];
    for (const [seconds, expected] of vectors) {
      assert.equal(totpCodeAt(RFC_SECRET, Math.floor(seconds / 30), 8), expected);
      assert.equal(totpCode(RFC_SECRET, new Date(seconds * 1000)), expected.slice(-6));
    }
  });

  it('base32 mã hóa và giải mã đối xứng, từ chối ký tự lạ', () => {
    const data = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    assert.deepEqual(base32Decode(base32Encode(data)), data);
    assert.deepEqual(base32Decode('mfrg gzdf-mz'), base32Decode('MFRGGZDFMZ'));
    assert.throws(() => base32Decode('abc1'), /base32/);
    assert.match(generateTotpSecret(), /^[A-Z2-7]{32}$/);
  });

  it('chấp nhận lệch một bước, từ chối lệch hai bước, sai độ dài, sai dạng', () => {
    const now = new Date(1_700_000_000_000);
    const secret = generateTotpSecret();
    const code = totpCode(secret, now);
    assert.notEqual(verifyTotp(secret, code, now), null);
    assert.notEqual(verifyTotp(secret, code, new Date(now.getTime() + 30_000)), null);
    assert.notEqual(verifyTotp(secret, code, new Date(now.getTime() - 30_000)), null);
    assert.equal(verifyTotp(secret, code, new Date(now.getTime() + 90_000)), null);
    assert.equal(verifyTotp(secret, '12345', now), null);
    assert.equal(verifyTotp(secret, 'abcdef', now), null);
    assert.notEqual(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now), null);
  });

  it('mỗi mã dùng một lần: bước đã dùng trở về trước bị từ chối', () => {
    const now = new Date(1_700_000_000_000);
    const secret = generateTotpSecret();
    const step = verifyTotp(secret, totpCode(secret, now), now);
    assert.notEqual(step, null);
    assert.equal(verifyTotp(secret, totpCode(secret, now), now, { lastUsedStep: step }), null);
    const next = new Date(now.getTime() + 30_000);
    assert.notEqual(verifyTotp(secret, totpCode(secret, next), next, { lastUsedStep: step }), null);
  });

  it('địa chỉ cấu hình và mã khôi phục', () => {
    const uri = totpUri('ABCDEFGH', 'quan.tri@truong', 'School Management');
    assert.match(uri, /^otpauth:\/\/totp\/School%20Management:quan\.tri%40truong\?secret=ABCDEFGH/);
    const codes = generateRecoveryCodes();
    assert.equal(codes.length, 8);
    assert.equal(new Set(codes).size, 8);
    assert.match(codes[0] as string, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    assert.equal(
      hashRecoveryCode(codes[0] as string),
      hashRecoveryCode(normalizeRecoveryCode((codes[0] as string).toLowerCase())),
    );
    assert.notEqual(hashRecoveryCode(codes[0] as string), hashRecoveryCode(codes[1] as string));
  });
});
