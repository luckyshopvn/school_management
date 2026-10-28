import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { ruleViolationError } from '@school-management/server';
import type { NextFunction, Request, Response } from 'express';
import { catchError, throwError, type Observable } from 'rxjs';

// Xem năm học đã đóng (BC-09, YCTD-342): cổng quản trị gửi mã năm học đang xem ở tiêu đề này. Bộ giải năm học đang dùng
// (CurrentSchoolYearResolver) đọc mã ở ngữ cảnh của yêu cầu và trả cơ sở dữ liệu của năm đó; năm đã đóng chỉ đọc được
export const VIEWED_ACADEMIC_YEAR_HEADER = 'x-academic-year-id';

export interface ViewedSchoolYear {
  academicYearId: string;
  // GET, HEAD là yêu cầu đọc; yêu cầu khác cần ghi nên không chạy trên năm học đã đóng
  readOnlyRequest: boolean;
}

const storage = new AsyncLocalStorage<ViewedSchoolYear>();

export function viewedSchoolYear(): ViewedSchoolYear | undefined {
  return storage.getStore();
}

export function runWithViewedSchoolYear<Result>(viewed: ViewedSchoolYear, work: () => Result): Result {
  return storage.run(viewed, work);
}

export function viewedSchoolYearMiddleware(request: Request, _response: Response, next: NextFunction): void {
  const academicYearId = request.header(VIEWED_ACADEMIC_YEAR_HEADER)?.trim();
  if (!academicYearId) {
    next();
    return;
  }
  runWithViewedSchoolYear(
    { academicYearId, readOnlyRequest: request.method === 'GET' || request.method === 'HEAD' },
    () => next(),
  );
}

// Mã lỗi PostgreSQL khi đọc năm học đã đóng: ghi vào cơ sở dữ liệu chỉ đọc; cột, bảng chưa có vì năm đã đóng giữ nguyên cấu trúc
// lúc đóng (QU-11) nên chức năng làm sau ngày đóng năm học không đọc được dữ liệu năm đó
const READ_ONLY_TRANSACTION = '25006';
const MISSING_STRUCTURE = new Set(['42703', '42P01']);

export function translateViewedYearError(error: unknown): unknown {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === READ_ONLY_TRANSACTION) {
    return ruleViolationError(
      'BR-93',
      'Năm học đang xem đã đóng, chỉ xem được; thao tác này cần ghi dữ liệu nên chỉ làm ở năm học đang dùng',
    );
  }
  if (typeof code === 'string' && MISSING_STRUCTURE.has(code)) {
    return ruleViolationError(
      'BR-93',
      'Năm học đang xem đóng trước khi có chức năng này nên không xem được dữ liệu của chức năng này ở năm đó',
    );
  }
  return error;
}

// Đổi lỗi cơ sở dữ liệu của yêu cầu xem năm học đã đóng thành lỗi nghiệp vụ có thông điệp rõ, thay cho lỗi hệ thống
@Injectable()
export class ViewedSchoolYearInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!viewedSchoolYear()) {
      return next.handle();
    }
    return next.handle().pipe(catchError((error: unknown) => throwError(() => translateViewedYearError(error))));
  }
}
