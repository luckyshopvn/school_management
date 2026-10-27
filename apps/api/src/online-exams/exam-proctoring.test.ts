import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { ageOn, needsParentConsent } from '@school-management/shared';
import { decryptBytes, encryptBytes, turnCredentials } from './exam-proctoring.js';

// Giám thị camera cho thi trực tuyến (DT-23 phần 23e, YCTD-215): hàm thuần, kịch bản CT-23e-1a đến CT-23e-1c
describe('Giám thị camera: hàm thuần', () => {
  it('CT-23e-1a: tuổi tròn và điều kiện cần cha mẹ đồng ý (dưới 16 tuổi, chưa rõ ngày sinh coi là chưa đủ tuổi)', () => {
    assert.equal(ageOn('2010-10-26', '2026-10-26'), 16);
    assert.equal(ageOn('2010-10-27', '2026-10-26'), 15);
    assert.equal(ageOn('2014-03-01T00:00:00.000Z', '2026-10-26'), 12);
    assert.equal(ageOn(null, '2026-10-26'), null);
    assert.equal(ageOn('khong-hop-le', '2026-10-26'), null);
    assert.equal(needsParentConsent('2010-10-26', '2026-10-26'), false, 'đủ 16 tuổi tự xác nhận thông báo');
    assert.equal(needsParentConsent('2010-10-27', '2026-10-26'), true);
    assert.equal(needsParentConsent(null, '2026-10-26'), true);
  });

  it('CT-23e-1b: mã hoá bản ghi AES-256-GCM: giải mã đúng, sai khoá hoặc sửa bản mã thì lỗi, mỗi lần một số dùng một lần', () => {
    const key = randomBytes(32);
    const body = Buffer.from('doan ghi hinh thu');
    const sealed = encryptBytes(key, body);
    assert.ok(!sealed.includes(body));
    assert.deepEqual(decryptBytes(key, sealed), body);
    assert.notDeepEqual(encryptBytes(key, body), sealed);
    assert.throws(() => decryptBytes(randomBytes(32), sealed));
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    assert.throws(() => decryptBytes(key, tampered));
  });

  it('CT-23e-1c: thông tin đăng nhập TURN có hạn theo cách coturn use-auth-secret', () => {
    const now = new Date('2026-10-26T08:00:00Z');
    const credentials = turnCredentials('bi-mat-dung-chung', 'student-abc', now, 3600);
    assert.equal(credentials.username, `${Math.floor(now.getTime() / 1000) + 3600}:student-abc`);
    assert.equal(
      credentials.credential,
      createHmac('sha1', 'bi-mat-dung-chung').update(credentials.username).digest('base64'),
    );
  });
});
