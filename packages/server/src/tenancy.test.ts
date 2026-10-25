import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { cacheKey, storageKey } from './resource-names.js';
import { decryptSecret, encryptSecret } from './secret-encryption.js';
import { validateSchoolCode } from './school-code.js';
import {
  currentTenant,
  isMultiTenantMode,
  requireTenant,
  runAsSchool,
  setMultiTenantMode,
  TenantContextMissingError,
  type TenantContext,
} from './tenant-context.js';
import { extractTenantHost, normalizeHost, parseTenantHostSource } from './tenant-host.js';
import { createTenantMiddleware } from './tenant-middleware.js';

function tenant(code: string, keyPrefix = code): TenantContext {
  return {
    schoolId: `id-${code}`,
    code,
    name: `Trường ${code}`,
    status: 'active',
    dataClass: 'synthetic',
    keyPrefix,
    yearDatabasePrefix: `s_${code}_y`,
  };
}

afterEach(() => {
  setMultiTenantMode(false);
});

describe('ngữ cảnh trường', () => {
  it('chế độ một trường: không cần ngữ cảnh, khóa giữ nguyên dạng cũ', () => {
    assert.equal(isMultiTenantMode(), false);
    assert.equal(requireTenant('cơ sở dữ liệu'), undefined);
    assert.equal(storageKey('incoming-documents', 'a', 'b'), 'incoming-documents/a/b');
    assert.equal(cacheKey('counts', 'u1'), 'counts:u1');
  });

  it('chế độ nhiều trường: thiếu ngữ cảnh là lỗi, không rơi về trường mặc định', () => {
    setMultiTenantMode(true);
    assert.throws(() => requireTenant('cơ sở dữ liệu'), TenantContextMissingError);
    assert.throws(() => storageKey('files', 'x'), TenantContextMissingError);
    assert.throws(() => cacheKey('counts'), TenantContextMissingError);
  });

  it('khóa tệp và khóa bộ nhớ đệm có tiền tố của đúng trường, kể cả sau await', async () => {
    setMultiTenantMode(true);
    const read = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [storageKey('files', 'x'), cacheKey('counts', 'u1'), currentTenant()?.code];
    };
    const [alpha, beta] = await Promise.all([
      runAsSchool(tenant('alpha'), () => read()),
      runAsSchool(tenant('beta'), () => read()),
    ]);
    assert.deepEqual(alpha, ['tenants/alpha/files/x', 't:alpha:counts:u1', 'alpha']);
    assert.deepEqual(beta, ['tenants/beta/files/x', 't:beta:counts:u1', 'beta']);
  });

  it('trường số 1 có tiền tố trống nên khóa hiện có còn đúng', () => {
    setMultiTenantMode(true);
    runAsSchool(tenant('truong-mot', ''), () => {
      assert.equal(storageKey('files', 'x'), 'files/x');
      assert.equal(cacheKey('counts'), 'counts');
    });
  });

  it('phần khóa không hợp lệ vẫn bị từ chối', () => {
    setMultiTenantMode(true);
    runAsSchool(tenant('alpha'), () => {
      assert.throws(() => storageKey('../x'));
      assert.throws(() => cacheKey('a:b'));
    });
  });
});

describe('mã trường', () => {
  it('chấp nhận mã hợp lệ, từ chối mã sai mẫu, hai gạch ngang và mã dành riêng', () => {
    assert.equal(validateSchoolCode('mn-hoang-yen'), null);
    assert.equal(validateSchoolCode('alpha'), null);
    assert.notEqual(validateSchoolCode('ab'), null);
    assert.notEqual(validateSchoolCode('-abc'), null);
    assert.notEqual(validateSchoolCode('abc-'), null);
    assert.notEqual(validateSchoolCode('Abc'), null);
    assert.notEqual(validateSchoolCode('a--b'), null);
    assert.notEqual(validateSchoolCode('platform'), null);
    assert.equal(validateSchoolCode('platform', []), null);
  });
});

describe('nguồn tên miền', () => {
  it('chuẩn hóa tên miền: chữ thường, bỏ cổng, bỏ dấu chấm cuối, từ chối giá trị lạ', () => {
    assert.equal(normalizeHost('Alpha.E2E.localhost:5373'), 'alpha.e2e.localhost');
    assert.equal(normalizeHost('alpha.example.vn.'), 'alpha.example.vn');
    assert.equal(normalizeHost('a.vn, b.vn'), 'a.vn');
    assert.equal(normalizeHost('[::1]:3000'), undefined);
    assert.equal(normalizeHost('bad host'), undefined);
    assert.equal(normalizeHost(undefined), undefined);
  });

  it('đọc nguồn từ biến cấu hình', () => {
    assert.deepEqual(parseTenantHostSource(undefined), { kind: 'host' });
    assert.deepEqual(parseTenantHostSource('X-Forwarded-Host'), { kind: 'x-forwarded-host' });
    assert.deepEqual(parseTenantHostSource('header:x-tenant-host'), { kind: 'header', name: 'x-tenant-host' });
    assert.throws(() => parseTenantHostSource('header:'));
    assert.throws(() => parseTenantHostSource('khac'));
  });

  it('tiêu đề Host, X-Forwarded-Host và tiêu đề cổng biên kèm bí mật', () => {
    const headers = {
      host: 'api.internal:3000',
      'x-forwarded-host': 'alpha.example.vn',
      'x-tenant-host': 'beta.example.vn',
      'x-edge-auth': 'bi-mat-gia',
    };
    assert.equal(extractTenantHost(headers, { kind: 'host' }), 'api.internal');
    assert.equal(extractTenantHost(headers, { kind: 'x-forwarded-host' }), 'alpha.example.vn');
    const edge = { kind: 'header', name: 'x-tenant-host' } as const;
    assert.equal(extractTenantHost(headers, edge, 'bi-mat-gia'), 'beta.example.vn');
    assert.equal(extractTenantHost(headers, edge, 'sai'), undefined);
    assert.equal(extractTenantHost(headers, edge, undefined), undefined);
    assert.equal(extractTenantHost({ ...headers, 'x-edge-auth': undefined }, edge, 'bi-mat-gia'), undefined);
  });
});

interface MiddlewareResult {
  status?: number;
  body?: unknown;
  seen?: string;
  nextError?: unknown;
}

describe('phần mềm trung gian nhận diện trường', () => {
  function run(options: { host?: string; path?: string; status?: TenantContext['status'] }) {
    const resolver = {
      async resolveHost(host: string) {
        if (host !== 'alpha.example.vn') {
          return null;
        }
        return { ...tenant('alpha'), status: options.status ?? 'active' };
      },
    };
    const middleware = createTenantMiddleware({ resolver, hostSource: { kind: 'host' } });
    return new Promise<MiddlewareResult>((resolve) => {
      const result: MiddlewareResult = {};
      const request = {
        path: options.path ?? '/api/v1/auth/login',
        headers: { host: options.host },
      } as unknown as Request;
      const response = {
        status(code: number) {
          result.status = code;
          return this;
        },
        json(body: unknown) {
          result.body = body;
          resolve(result);
        },
      } as unknown as Response;
      const next: NextFunction = (error?: unknown) => {
        result.nextError = error;
        result.seen = currentTenant()?.code;
        resolve(result);
      };
      middleware(request, response, next);
    });
  }

  it('đặt ngữ cảnh khi tên miền thuộc một trường đang hoạt động', async () => {
    const result = await run({ host: 'alpha.example.vn:443' });
    assert.equal(result.seen, 'alpha');
  });

  it('tên miền lạ, thiếu Host, trường đang khởi tạo hoặc đã xóa đều trả 404 chung', async () => {
    for (const options of [
      { host: 'la.example.vn' },
      { host: undefined },
      { host: 'alpha.example.vn', status: 'provisioning' as const },
      { host: 'alpha.example.vn', status: 'deleted' as const },
    ]) {
      const result = await run(options);
      assert.equal(result.status, 404);
      assert.deepEqual(result.body, { error: { code: 'ERR_NOT_FOUND', message: 'Không tìm thấy', details: [] } });
    }
  });

  it('trường tạm dừng trả 503, đường dẫn sức khỏe không cần trường', async () => {
    assert.equal((await run({ host: 'alpha.example.vn', status: 'suspended' })).status, 503);
    const health = await run({ host: undefined, path: '/api/v1/health' });
    assert.equal(health.status, undefined);
    assert.equal(health.seen, undefined);
  });
});

describe('mã hóa bí mật', () => {
  it('mã hóa và giải mã khứ hồi, khóa khác giải không được', () => {
    const key = Buffer.alloc(32, 7);
    const encoded = encryptSecret(key, 'mat-khau-gia');
    assert.equal(decryptSecret(key, encoded), 'mat-khau-gia');
    assert.notEqual(encryptSecret(key, 'mat-khau-gia'), encoded);
    assert.throws(() => decryptSecret(Buffer.alloc(32, 8), encoded));
  });
});
