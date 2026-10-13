import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSmsGateway, EsmsSmsGateway, LoggingSmsGateway } from './sms-gateway.js';

// Lớp gửi tin nhắn thông báo qua eSMS.vn (DT-12 phần 12a, YCTD-92); kịch bản CT-12a-13, CT-12a-14
const SETTINGS = { apiKey: 'k', secretKey: 's', brandname: 'TRUONG_THU', sandbox: false, unicode: true };

describe('Lớp gửi tin nhắn thông báo của máy chủ API', () => {
  it('CT-12a-13: SMS_PROVIDER=esms thì dùng eSMS.vn, chưa cấu hình hoặc log thì ghi nhật ký', () => {
    assert.ok(createSmsGateway({ provider: 'esms', esms: SETTINGS }) instanceof EsmsSmsGateway);
    assert.ok(createSmsGateway({ provider: 'log' }) instanceof LoggingSmsGateway);
    assert.ok(createSmsGateway(undefined) instanceof LoggingSmsGateway);
  });

  it('CT-12a-14: gửi thông báo có dấu qua eSMS.vn; eSMS.vn trả lỗi thì tiến trình gửi nhận lỗi để thử lại', async () => {
    const bodies: Array<Record<string, string>> = [];
    let code = '100';
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ CodeResult: code, SMSID: 'id-1', ErrorMessage: 'Brandname not registered' });
    }) as typeof fetch;
    const gateway = new EsmsSmsGateway(SETTINGS, fakeFetch);
    await gateway.send('0987654321', 'Thông báo: bé nghỉ học hôm nay');
    assert.equal(bodies[0]?.Phone, '84987654321');
    assert.equal(bodies[0]?.Content, 'Thông báo: bé nghỉ học hôm nay');
    assert.equal(bodies[0]?.IsUnicode, '1');
    code = '104';
    await assert.rejects(gateway.send('0987654321', 'Thông báo'), /104: Brandname not registered/);
  });
});
