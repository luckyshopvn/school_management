import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startApiTestEnvironment, type ApiTestEnvironment } from './test-support.js';

// Tiêu đề bảo mật của máy chủ API (DT-SaaS phần S8b, YCTD-201): đặt ở mọi phản hồi, không lộ phần mềm máy chủ
describe('tiêu đề bảo mật của máy chủ API', () => {
  let environment: ApiTestEnvironment;

  before(async () => {
    environment = await startApiTestEnvironment();
  });

  after(async () => {
    await environment?.close();
  });

  it('phản hồi có tiêu đề bảo mật, không có X-Powered-By; HSTS chỉ khi qua HTTPS', async () => {
    const plain = await fetch(`${environment.baseUrl}/health`);
    assert.equal(plain.status, 200);
    assert.equal(plain.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(plain.headers.get('x-frame-options'), 'DENY');
    assert.equal(plain.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(plain.headers.get('permissions-policy') ?? '', /camera=\(\)/);
    assert.equal(plain.headers.get('x-powered-by'), null);
    assert.equal(plain.headers.get('strict-transport-security'), null);
    const secure = await fetch(`${environment.baseUrl}/health`, { headers: { 'x-forwarded-proto': 'https' } });
    assert.match(secure.headers.get('strict-transport-security') ?? '', /max-age=31536000; includeSubDomains/);
  });

  it('lỗi cũng mang tiêu đề bảo mật', async () => {
    const response = await fetch(`${environment.baseUrl}/khong-co-tuyen-nay`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  });
});
