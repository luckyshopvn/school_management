import type { NextFunction, Request, Response } from 'express';
import { enterSchool, type TenantContext } from './tenant-context.js';
import { extractTenantHost, type TenantHostSource } from './tenant-host.js';

// Bộ phân giải tên miền thành trường; cài đặt ở gói cơ sở dữ liệu (đọc cơ sở dữ liệu nền tảng)
export interface TenantResolver {
  resolveHost(host: string): Promise<TenantContext | null>;
}

export interface TenantMiddlewareOptions {
  resolver: TenantResolver;
  hostSource: TenantHostSource;
  edgeSecret?: string;
  // Đường dẫn không cần trường: kiểm tra sức khỏe do máy chủ chuyển tiếp gọi bằng địa chỉ nội bộ
  isTenantFreePath?: (path: string) => boolean;
  // Khi tên miền không phân giải được: lấy trường theo mã trường trong mã phiên hợp lệ (gọi nội bộ giữa máy chủ API và dịch vụ
  // định danh dùng địa chỉ nội bộ). Mã phiên do dịch vụ định danh ký nên mã trường trong đó đáng tin; không có mã phiên thì vẫn 404
  resolveByToken?: (request: Request) => Promise<TenantContext | null>;
}

// Trạng thái trường không phục vụ người dùng
const UNAVAILABLE_STATUSES = new Set(['provisioning', 'deleted']);
const SUSPENDED_STATUSES = new Set(['suspended', 'pending_deletion']);

export const DEFAULT_TENANT_FREE_PATHS = new Set(['/api/v1/health']);

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ error: { code, message, details: [] } });
}

// Đặt ngữ cảnh trường ở đầu yêu cầu của dịch vụ định danh và máy chủ API (tài liệu 47 mục 14.4). Tên miền lạ, trường
// đang khởi tạo hoặc đã xóa trả 404 chung, không lộ tên trường; trường tạm dừng trả 503
export function createTenantMiddleware(options: TenantMiddlewareOptions) {
  const isFree = options.isTenantFreePath ?? ((path: string) => DEFAULT_TENANT_FREE_PATHS.has(path));
  return (request: Request, response: Response, next: NextFunction): void => {
    if (isFree(request.path)) {
      next();
      return;
    }
    const resolve = async (): Promise<TenantContext | null> => {
      const host = extractTenantHost(request.headers, options.hostSource, options.edgeSecret);
      const byHost = host ? await options.resolver.resolveHost(host) : null;
      if (byHost || !options.resolveByToken) {
        return byHost;
      }
      return options.resolveByToken(request);
    };
    resolve()
      .then((tenant) => {
        if (!tenant || UNAVAILABLE_STATUSES.has(tenant.status)) {
          sendError(response, 404, 'ERR_NOT_FOUND', 'Không tìm thấy');
          return;
        }
        if (SUSPENDED_STATUSES.has(tenant.status)) {
          sendError(response, 503, 'ERR_SCHOOL_SUSPENDED', 'Trường tạm dừng sử dụng');
          return;
        }
        enterSchool(tenant);
        next();
      })
      .catch((error: unknown) => {
        next(error);
      });
  };
}
