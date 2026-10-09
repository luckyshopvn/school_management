import { ParseUUIDPipe } from '@nestjs/common';
import { validationError } from '@school-management/server';

// Kiểm tra mã định danh trên đường dẫn; sai thì trả ERR_VALIDATION theo mô hình lỗi chung
export function uuidParameter(message: string): ParseUUIDPipe {
  return new ParseUUIDPipe({ exceptionFactory: () => validationError([{ field: 'id', message }]) });
}
