import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import {
  createSchoolReadOnlyMiddleware,
  isApiWriteAllowedWhenReadOnly,
  isIdentityWriteAllowedWhenReadOnly,
} from './school-plan-middleware.js';
import { runAsSchool, type TenantContext } from './tenant-context.js';

// Gói dịch vụ (DT-SaaS phần S5a, YCTD-194), kịch bản CT-S5a-2: chế độ chỉ đọc chặn ghi
const tenant = (status: TenantContext['status']): TenantContext => ({
  schoolId: '00000000-0000-4000-8000-000000000001',
  code: 'alpha',
  name: 'Trường giả',
  status,
  dataClass: 'synthetic',
  keyPrefix: 'alpha:',
  yearDatabasePrefix: 'school_year_alpha_',
});

function run(
  status: TenantContext['status'] | null,
  method: string,
  path: string,
  allow = isApiWriteAllowedWhenReadOnly,
) {
  const middleware = createSchoolReadOnlyMiddleware({ isAllowedWrite: allow });
  let nextCalled = false;
  let statusCode = 0;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  } as unknown as Response;
  const work = () => middleware({ method, path } as Request, response, () => (nextCalled = true));
  if (status) {
    runAsSchool(tenant(status), work);
  } else {
    work();
  }
  return { nextCalled, statusCode, code: (body as { error?: { code?: string } } | undefined)?.error?.code };
}

describe('gói dịch vụ: phân hệ, chế độ chỉ đọc', () => {
  it('CT-S5a-2: trường chỉ đọc bị chặn ghi trừ xuất dữ liệu, đăng nhập, gia hạn; trường khác, chế độ một trường không chặn', () => {
    assert.deepEqual(run('read_only', 'POST', '/api/v1/org-units'), {
      nextCalled: false,
      statusCode: 403,
      code: 'SCHOOL_READ_ONLY',
    });
    assert.equal(run('read_only', 'GET', '/api/v1/org-units').nextCalled, true);
    assert.equal(run('read_only', 'POST', '/api/v1/org-units/export').nextCalled, true);
    assert.equal(run('read_only', 'POST', '/api/v1/export-jobs').nextCalled, true);
    assert.equal(run('read_only', 'DELETE', '/api/v1/classes/x').statusCode, 403);
    assert.equal(run('active', 'POST', '/api/v1/org-units').nextCalled, true);
    assert.equal(run(null, 'POST', '/api/v1/org-units').nextCalled, true, 'chế độ một trường không chặn');
    assert.equal(run('read_only', 'POST', '/api/v1/auth/login', isIdentityWriteAllowedWhenReadOnly).nextCalled, true);
    assert.equal(run('read_only', 'POST', '/api/v1/users', isIdentityWriteAllowedWhenReadOnly).statusCode, 403);
    assert.equal(run('read_only', 'PUT', '/api/v1/auth/settings', isIdentityWriteAllowedWhenReadOnly).statusCode, 403);
  });
});
