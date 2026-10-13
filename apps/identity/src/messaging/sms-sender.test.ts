import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSmsSender, EsmsSmsSender, LoggingSmsSender } from './sms-sender.js';

// Lớp gửi mã đăng nhập qua eSMS.vn (DT-12 phần 12a, YCTD-92); kịch bản CT-12a-11, CT-12a-12
const SETTINGS = { apiKey: 'k', secretKey: 's', brandname: 'TRUONG_THU', sandbox: true, unicode: false };

describe('Lớp gửi tin nhắn của dịch vụ định danh', () => {
  it('CT-12a-11: SMS_PROVIDER=esms thì dùng eSMS.vn, mặc định ghi nhật ký', () => {
    assert.ok(createSmsSender({ provider: 'esms', esms: SETTINGS }) instanceof EsmsSmsSender);
    assert.ok(createSmsSender({ provider: 'log' }) instanceof LoggingSmsSender);
  });

  it('CT-12a-12: gửi mã đăng nhập qua eSMS.vn; eSMS.vn trả lỗi thì luồng gửi nhận lỗi', async () => {
    const bodies: Array<Record<string, string>> = [];
    let code = '100';
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ CodeResult: code, ErrorMessage: 'Balance not enough' });
    }) as typeof fetch;
    const sender = new EsmsSmsSender(SETTINGS, fakeFetch);
    await sender.send('0912345678', 'Mã đăng nhập: 123456');
    assert.equal(bodies[0]?.Phone, '84912345678');
    assert.equal(bodies[0]?.Content, 'Ma dang nhap: 123456');
    code = '103';
    await assert.rejects(sender.send('0912345678', 'Mã đăng nhập: 654321'), /103: Balance not enough/);
  });
});
