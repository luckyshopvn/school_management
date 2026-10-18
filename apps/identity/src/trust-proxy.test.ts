import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { applyTrustProxy, parseTrustProxy } from '@school-management/server';
import { startTestApplication, type TestContext } from './test-support.js';

describe('Dịch vụ định danh: chạy sau máy chủ chuyển tiếp (YCTD-92)', () => {
  it('đọc biến TRUST_PROXY theo thiết lập trust proxy của Express', () => {
    assert.equal(parseTrustProxy(undefined), undefined);
    assert.equal(parseTrustProxy(''), undefined);
    assert.equal(parseTrustProxy('false'), undefined);
    assert.equal(parseTrustProxy('true'), true);
    assert.equal(parseTrustProxy('1'), 1);
    assert.equal(parseTrustProxy(' uniquelocal, loopback '), 'uniquelocal, loopback');
  });

  describe('giới hạn đăng nhập tính theo địa chỉ trong X-Forwarded-For', () => {
    let context: TestContext;

    before(async () => {
      context = await startTestApplication({ loginRequestsPerMinutePerAddress: 3 });
      applyTrustProxy(context.application, 'loopback');
    });

    after(async () => {
      await context.close();
    });

    async function login(address: string): Promise<number> {
      const response = await fetch(`${context.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
        // Mỗi địa chỉ một tên đăng nhập để số lần sai tính theo tài khoản (mã xác nhận, DT-16 phần 16c) không lẫn vào giới hạn
        body: JSON.stringify({ login: `khong_ton_tai_${address}`, password: 'SaiMatKhau1', channel: 'portal' }),
      });
      await response.text();
      return response.status;
    }

    it('người dùng ở địa chỉ khác không bị chặn chung giới hạn', async () => {
      context.clock.freeze();
      for (let attempt = 0; attempt < 3; attempt++) {
        assert.equal(await login('203.0.113.10'), 401);
      }
      assert.equal(await login('203.0.113.10'), 429);
      assert.equal(await login('203.0.113.20'), 401);
    });
  });
});
