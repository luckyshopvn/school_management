import type { TenancyRuntime } from '@school-management/database';
import type { TenantContext } from '@school-management/server';
import type { Request } from 'express';

// Tệp gói SCORM ở chế độ nhiều trường (DT-28 phần 28h, YCTD-278): khi phục vụ ở nguồn gốc nội dung riêng (`SCORM_CONTENT_ORIGIN`),
// tên miền không cho biết trường nên lấy trường theo phần đầu của mã truy cập trong đường dẫn. Phần này chưa được tin: dịch vụ
// SCORM kiểm chữ ký HMAC và mã trường của mã truy cập phải trùng trường của yêu cầu, sai thì 404
const CONTENT_PREFIX = '/api/v1/scorm-content/';

export function schoolOfContentPath(path: string): string | null {
  if (!path.startsWith(CONTENT_PREFIX)) return null;
  const token = path.slice(CONTENT_PREFIX.length).split('/')[0] ?? '';
  const payload = token.split('.')[0] ?? '';
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { s?: unknown };
    return typeof claims.s === 'string' && /^[0-9a-f-]{36}$/i.test(claims.s) ? claims.s : null;
  } catch {
    return null;
  }
}

export function scormAwareResolver(
  tenancy: TenancyRuntime,
  fallback: (request: Request) => Promise<TenantContext | null>,
): (request: Request) => Promise<TenantContext | null> {
  return async (request) => {
    const schoolId = schoolOfContentPath(request.path);
    if (schoolId) {
      return tenancy.registry.contextOf(schoolId);
    }
    return fallback(request);
  };
}
