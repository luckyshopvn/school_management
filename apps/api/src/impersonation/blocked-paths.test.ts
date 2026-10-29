import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { TenancyRuntime } from '@school-management/database';
import { ApplicationError, type Clock } from '@school-management/server';
import { lastValueFrom, of } from 'rxjs';
import type { Databases } from '../common/databases.js';
import { routingPath } from '../common/request-path.js';
import { SupportSessionInterceptor } from '../platform-dashboard/platform-dashboard.js';
import { ImpersonationInterceptor } from './impersonation.js';

// Lệnh chặn theo đường dẫn so trên dạng Express định tuyến: không phân biệt hoa thường, bỏ "/" cuối (YCTD-374);
// kịch bản CT-1711, CT-1712
const BLOCKED_VARIANTS = [
  '/api/v1/signing/dossiers/sign',
  '/api/v1/signing/dossiers/sign/',
  '/API/v1/Signing/Dossiers/Sign',
  '/api/v1/signing/certificate/',
  '/api/v1/SIGNING/certificate',
  '/api/v1/outgoing-documents/van-ban-1/sign/',
  '/api/v1/Outgoing-Documents/van-ban-1/SIGN',
  '/api/v1/school-data-exports/',
  '/API/V1/School-Data-Exports',
];

function contextOf(request: Record<string, unknown>): ExecutionContext {
  const response = { statusCode: 200, once: () => undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

async function outcome(
  interceptor: { intercept(context: ExecutionContext, next: CallHandler): unknown },
  request: Record<string, unknown>,
): Promise<'blocked' | 'passed'> {
  let handled = false;
  const next: CallHandler = {
    handle: () => {
      handled = true;
      return of('ok');
    },
  };
  try {
    await lastValueFrom(interceptor.intercept(contextOf(request), next) as ReturnType<CallHandler['handle']>);
  } catch (error) {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, 'ERR_FORBIDDEN');
    assert.equal(handled, false);
    return 'blocked';
  }
  assert.equal(handled, true);
  return 'passed';
}

const fakeDatabases = {
  system: { insertInto: () => ({ values: () => ({ execute: async () => undefined }) }) },
} as unknown as Databases;
const fakeClock = { now: () => new Date() } as unknown as Clock;

describe('Lệnh chặn theo đường dẫn (YCTD-374)', () => {
  it('đường dẫn so khớp: chữ thường, bỏ "/" cuối', () => {
    assert.equal(routingPath('/API/v1/Signing/Dossiers/Sign/'), '/api/v1/signing/dossiers/sign');
    assert.equal(routingPath('/api/v1/children//'), '/api/v1/children');
    assert.equal(routingPath('/'), '/');
  });

  it('CT-1711: đăng nhập thay không kí số, không thao tác chứng thư số, không xuất toàn bộ dữ liệu ở mọi cách viết đường dẫn', async () => {
    const interceptor = new ImpersonationInterceptor(fakeDatabases, fakeClock);
    const user = {
      id: 'tai-khoan-dich',
      description: {
        full_name: 'Giáo viên thử',
        impersonation: { id: 'phien-1', impersonator_id: 'quan-tri', impersonator_name: 'Quản trị thử' },
      },
    };
    for (const path of BLOCKED_VARIANTS) {
      assert.equal(await outcome(interceptor, { currentUser: user, path, method: 'POST' }), 'blocked', path);
    }
    assert.equal(await outcome(interceptor, { currentUser: user, path: '/api/v1/children', method: 'POST' }), 'passed');
    assert.equal(
      await outcome(interceptor, { currentUser: user, path: '/api/v1/signing/dossiers', method: 'GET' }),
      'passed',
    );
  });

  it('CT-1712: phiên hỗ trợ toàn quyền không kí số, không thao tác chứng thư số, không xuất toàn bộ dữ liệu ở mọi cách viết đường dẫn', async () => {
    const tenancy = {
      platform: { insertInto: () => ({ values: () => ({ execute: async () => undefined }) }) },
    } as unknown as TenancyRuntime;
    const interceptor = new SupportSessionInterceptor(tenancy);
    const user = { id: 'ho-tro', description: { support: { id: 'phien-ho-tro', scope: 'full' } } };
    for (const path of [...BLOCKED_VARIANTS, '/api/v1/Support-Access/', '/API/v1/signing/dossiers']) {
      assert.equal(
        await outcome(interceptor, { currentUser: user, path, method: 'POST', baseUrl: '' }),
        'blocked',
        path,
      );
    }
    assert.equal(
      await outcome(interceptor, { currentUser: user, path: '/api/v1/children', method: 'POST', baseUrl: '' }),
      'passed',
    );
  });
});
