// Mô hình lỗi theo 17_DAC_TA_API.md mục 2
export type ErrorCode =
  | 'ERR_VALIDATION'
  | 'ERR_UNAUTHENTICATED'
  | 'ERR_FORBIDDEN'
  | 'ERR_NOT_FOUND'
  | 'ERR_CONFLICT'
  | 'ERR_RULE_VIOLATION'
  | 'ERR_RATE_LIMIT'
  | 'ERR_INTERNAL';

export const STATUS_BY_ERROR_CODE: Record<ErrorCode, number> = {
  ERR_VALIDATION: 400,
  ERR_UNAUTHENTICATED: 401,
  ERR_FORBIDDEN: 403,
  ERR_NOT_FOUND: 404,
  ERR_CONFLICT: 409,
  ERR_RULE_VIOLATION: 422,
  ERR_RATE_LIMIT: 429,
  ERR_INTERNAL: 500,
};

export interface FieldError {
  field: string;
  message: string;
}

export class ApplicationError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: FieldError[] = [],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export function validationError(details: FieldError[]): ApplicationError {
  return new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', details);
}

export function unauthenticatedError(message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'): ApplicationError {
  return new ApplicationError('ERR_UNAUTHENTICATED', message);
}
