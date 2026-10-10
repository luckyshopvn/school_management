import { randomUUID } from 'node:crypto';
import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApplicationError, STATUS_BY_ERROR_CODE, type ErrorCode } from './application-error.js';

const ERROR_CODE_BY_HTTP_STATUS: Record<number, ErrorCode> = {
  400: 'ERR_VALIDATION',
  401: 'ERR_UNAUTHENTICATED',
  403: 'ERR_FORBIDDEN',
  404: 'ERR_NOT_FOUND',
  409: 'ERR_CONFLICT',
  // Tệp tải lên vượt dung lượng cho phép (KT-06, BM-27)
  413: 'ERR_VALIDATION',
  429: 'ERR_RATE_LIMIT',
};

// Phản hồi lỗi chỉ gồm mã lỗi, thông điệp tiếng Việt, chi tiết theo trường và mã tương quan (BM-29, KT-08)
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const correlationId = request.header('x-correlation-id') ?? randomUUID();

    let code: ErrorCode = 'ERR_INTERNAL';
    let message = 'Hệ thống gặp lỗi, vui lòng thử lại sau';
    let details: ApplicationError['details'] = [];
    let retryAfterSeconds: number | undefined;
    let ruleCode: string | undefined;

    if (exception instanceof ApplicationError) {
      code = exception.code;
      message = exception.message;
      details = exception.details;
      retryAfterSeconds = exception.retryAfterSeconds;
      ruleCode = exception.ruleCode;
    } else if (exception instanceof HttpException && ERROR_CODE_BY_HTTP_STATUS[exception.getStatus()]) {
      code = ERROR_CODE_BY_HTTP_STATUS[exception.getStatus()] ?? 'ERR_INTERNAL';
      message =
        exception.getStatus() === 413
          ? 'Tệp vượt dung lượng cho phép'
          : code === 'ERR_NOT_FOUND'
            ? 'Không tìm thấy'
            : 'Yêu cầu không hợp lệ';
    } else {
      this.logger.error(
        `Lỗi hệ thống, mã tương quan ${correlationId}`,
        exception instanceof Error ? exception.stack : '',
      );
    }

    response.setHeader('x-correlation-id', correlationId);
    if (retryAfterSeconds !== undefined) {
      response.setHeader('retry-after', String(retryAfterSeconds));
    }
    response.status(STATUS_BY_ERROR_CODE[code]).json({
      error: {
        code,
        message,
        details,
        ...(retryAfterSeconds !== undefined ? { retry_after_seconds: retryAfterSeconds } : {}),
        ...(ruleCode !== undefined ? { rule_code: ruleCode } : {}),
        correlation_id: correlationId,
      },
    });
  }
}
