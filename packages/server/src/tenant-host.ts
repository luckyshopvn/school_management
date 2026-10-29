import { timingSafeEqual } from 'node:crypto';

// Nguồn tên miền của yêu cầu (biến TENANT_HOST_SOURCE, tài liệu 47 mục 14.4): `host` là tiêu đề Host; `x-forwarded-host` là
// tiêu đề do máy chủ chuyển tiếp đáng tin (cần TRUST_PROXY); `header:<tên>` là tiêu đề do cổng biên đặt, đi kèm bí mật
// chung EDGE_SHARED_SECRET vì máy chủ ở hồ sơ thử nghiệm có địa chỉ công khai
export type TenantHostSource = { kind: 'host' } | { kind: 'x-forwarded-host' } | { kind: 'header'; name: string };

export const EDGE_AUTH_HEADER = 'x-edge-auth';

export function parseTenantHostSource(value: string | undefined): TenantHostSource {
  const text = (value ?? '').trim().toLowerCase();
  if (!text || text === 'host') {
    return { kind: 'host' };
  }
  if (text === 'x-forwarded-host') {
    return { kind: 'x-forwarded-host' };
  }
  const match = /^header:([a-z0-9-]{1,64})$/.exec(text);
  if (match?.[1]) {
    return { kind: 'header', name: match[1] };
  }
  throw new Error('TENANT_HOST_SOURCE chỉ nhận host, x-forwarded-host hoặc header:<tên tiêu đề>');
}

// Tên miền chuẩn hóa: chữ thường, bỏ cổng, bỏ dấu chấm cuối; không hợp lệ thì trả undefined
export function normalizeHost(value: string | undefined): string | undefined {
  let host = (value ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  if (host.startsWith('[')) {
    return undefined;
  }
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(host)) {
    return undefined;
  }
  return host;
}

export interface HostHeaders {
  [name: string]: string | string[] | undefined;
}

function firstHeader(headers: HostHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function secretsEqual(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Trả tên miền của yêu cầu, hoặc undefined khi thiếu hoặc sai (bí mật cổng biên sai thì từ chối)
export function extractTenantHost(
  headers: HostHeaders,
  source: TenantHostSource,
  edgeSecret?: string,
): string | undefined {
  if (source.kind === 'host') {
    return normalizeHost(firstHeader(headers, 'host'));
  }
  if (source.kind === 'x-forwarded-host') {
    return normalizeHost(firstHeader(headers, 'x-forwarded-host'));
  }
  if (!edgeSecret || !secretsEqual(firstHeader(headers, EDGE_AUTH_HEADER), edgeSecret)) {
    return undefined;
  }
  return normalizeHost(firstHeader(headers, source.name));
}
