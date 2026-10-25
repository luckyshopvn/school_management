import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { securityHeaders } from './security-headers.js';

// Tiêu đề bảo mật (DT-SaaS phần S8b, YCTD-201)
function run(options: { path: string; secure?: boolean; forwardedProto?: string }) {
  const headers = new Map<string, string>();
  const removed: string[] = [];
  const request = {
    path: options.path,
    secure: options.secure ?? false,
    header: (name: string) => (name.toLowerCase() === 'x-forwarded-proto' ? options.forwardedProto : undefined),
  } as unknown as Request;
  const response = {
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    removeHeader: (name: string) => removed.push(name),
  } as unknown as Response;
  let called = false;
  securityHeaders()(request, response, () => {
    called = true;
  });
  return { headers, removed, called };
}

describe('tiêu đề bảo mật', () => {
  it('đặt tiêu đề chung, bỏ X-Powered-By, gọi tiếp', () => {
    const { headers, removed, called } = run({ path: '/api/v1/health' });
    assert.ok(called);
    assert.deepEqual(removed, ['X-Powered-By']);
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(headers.get('permissions-policy') ?? '', /camera=\(\)/);
    assert.equal(headers.has('cache-control'), false);
  });

  it('HSTS chỉ khi yêu cầu đến qua HTTPS', () => {
    assert.equal(run({ path: '/api/v1/health' }).headers.has('strict-transport-security'), false);
    assert.match(
      run({ path: '/x', forwardedProto: 'https' }).headers.get('strict-transport-security') ?? '',
      /max-age=31536000/,
    );
    assert.ok(run({ path: '/x', secure: true }).headers.has('strict-transport-security'));
    assert.equal(run({ path: '/x', forwardedProto: 'http' }).headers.has('strict-transport-security'), false);
  });

  it('không lưu đệm phản hồi xác thực', () => {
    assert.equal(run({ path: '/api/v1/auth/login' }).headers.get('cache-control'), 'no-store');
    assert.equal(run({ path: '/api/v1/auth' }).headers.get('cache-control'), 'no-store');
    assert.equal(run({ path: '/api/v1/authors' }).headers.has('cache-control'), false);
  });
});
