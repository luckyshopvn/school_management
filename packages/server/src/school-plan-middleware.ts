import type { NextFunction, Request, Response } from 'express';
import { currentTenant } from './tenant-context.js';

// Chế độ chỉ đọc của trường (DT-SaaS phần S5a, YCTD-194; tài liệu 32 mục 14.5): trường ở trạng thái `read_only` (quá hạn dùng thử
// hoặc hạn đã trả phí) chỉ được xem; mọi yêu cầu ghi bị chặn với mã SCHOOL_READ_ONLY, trừ các đường dẫn được phép (đăng nhập, xuất
// dữ liệu, thanh toán và gia hạn). Đặt sau phần mềm trung gian nhận diện trường; chế độ một trường không có ngữ cảnh nên không chặn
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ReadOnlyMiddlewareOptions {
  // Đường dẫn ghi vẫn cho phép khi trường chỉ đọc
  isAllowedWrite: (method: string, path: string) => boolean;
}

export function createSchoolReadOnlyMiddleware(options: ReadOnlyMiddlewareOptions) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const tenant = currentTenant();
    if (
      !tenant ||
      tenant.status !== 'read_only' ||
      READ_METHODS.has(request.method) ||
      options.isAllowedWrite(request.method, request.path)
    ) {
      next();
      return;
    }
    response.status(403).json({
      error: {
        code: 'SCHOOL_READ_ONLY',
        message: 'Trường đang ở chế độ chỉ đọc do quá hạn sử dụng; chỉ xem, xuất dữ liệu, thanh toán và gia hạn được',
        details: [],
      },
    });
  };
}

// Máy chủ API: xuất dữ liệu (tệp xuất, tác vụ xuất nền), thanh toán và gia hạn của nền tảng (S5b) vẫn được phép
export function isApiWriteAllowedWhenReadOnly(_method: string, path: string): boolean {
  return (
    /\/export(?:$|\/)/.test(path) ||
    path.startsWith('/api/v1/export-jobs') ||
    path.startsWith('/api/v1/school-plan') ||
    path.startsWith('/api/v1/billing')
  );
}

// Dịch vụ định danh: đăng nhập, làm mới phiên, đăng xuất, đổi và đặt lại mật khẩu vẫn được phép; quản trị tài khoản bị chặn
export function isIdentityWriteAllowedWhenReadOnly(_method: string, path: string): boolean {
  return path.startsWith('/api/v1/auth/') && !path.startsWith('/api/v1/auth/settings');
}
