import {
  Controller,
  Get,
  Injectable,
  Logger,
  Query,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { ApplicationError, Clock, STATUS_BY_ERROR_CODE } from '@school-management/server';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';

// Đăng nhập thay trên máy chủ API (DT-18 phần 18h, YCTD-145). Dịch vụ định danh mở phiên đăng nhập thay và ghi lần bắt đầu,
// kết thúc; máy chủ API biết phiên đang đăng nhập thay qua /auth/me và:
// - ghi mọi thao tác ghi (POST, PUT, PATCH, DELETE) và mọi lần tải tệp, xuất tệp vào impersonation_actions: ai đăng nhập thay,
//   vào tài khoản nào, lúc nào, phương thức, đường dẫn (không có chuỗi truy vấn), mã kết quả. Nhật ký thao tác nghiệp vụ của
//   từng phân hệ cũng ghi tên người thực hiện kèm "đăng nhập thay bởi …" (originOf);
// - chặn thao tác trên chứng thư số và kí số, chặn xuất toàn bộ dữ liệu.
export const IMPERSONATION_RULE_CODE = 'YCTD-145';
const BLOCKED_PATHS = [
  /^\/api\/v1\/signing\/certificate(\/|$)/,
  /^\/api\/v1\/signing\/dossiers\/sign$/,
  /^\/api\/v1\/outgoing-documents\/[^/]+\/sign$/,
  /^\/api\/v1\/school-data-exports$/,
];
// Đọc dữ liệu ra ngoài: tải tệp, xuất tệp
const DOWNLOAD_PATH = /(\/file|\/files\/[^/]+|\/download|\/export|\/exports?\/[^/]*|\.xlsx|\.pdf)$/;
const LIST_LIMIT = 500;

@Injectable()
export class ImpersonationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ImpersonationInterceptor');

  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { currentUser?: CurrentUser }>();
    const impersonation = request.currentUser?.description.impersonation;
    if (!request.currentUser || !impersonation) {
      return next.handle();
    }
    const path = request.path;
    const method = request.method.toUpperCase();
    const writes = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (writes && BLOCKED_PATHS.some((pattern) => pattern.test(path))) {
      return throwError(
        () =>
          new ApplicationError(
            'ERR_FORBIDDEN',
            'Đang đăng nhập thay, không thao tác chứng thư số, kí số hoặc xuất toàn bộ dữ liệu được',
            [],
            undefined,
            IMPERSONATION_RULE_CODE,
          ),
      );
    }
    if (!writes && !DOWNLOAD_PATH.test(path)) {
      return next.handle();
    }
    const currentUser = request.currentUser;
    const record = (statusCode: number) =>
      from(
        this.databases.system
          .insertInto('impersonation_actions')
          .values({
            impersonation_id: impersonation.id,
            impersonator_user_id: impersonation.impersonator_id,
            impersonator_name: impersonation.impersonator_name,
            target_user_id: currentUser.id,
            target_name: currentUser.description.full_name,
            method,
            path: path.slice(0, 500),
            status_code: statusCode,
            ip_address: request.ip ?? null,
            created_at: this.clock.now(),
          })
          .execute()
          .catch((error: unknown) => {
            this.logger.error('Không ghi được nhật ký đăng nhập thay', error instanceof Error ? error.stack : String(error));
          }),
      );
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      mergeMap((value) => record(response.statusCode).pipe(mergeMap(() => [value]))),
      catchError((error: unknown) => {
        const statusCode = error instanceof ApplicationError ? STATUS_BY_ERROR_CODE[error.code] : 500;
        return record(statusCode).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }
}

// Thao tác trong các lần đăng nhập thay, cho màn hình nhật ký đăng nhập thay
@Controller('impersonation-actions')
@RequirePermission('P01.account.impersonate')
export class ImpersonationActionsController {
  constructor(private readonly databases: Databases) {}

  @Get()
  async list(@Query('impersonation_id') impersonationId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (currentUser.description.impersonation) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đang đăng nhập thay, không xem nhật ký đăng nhập thay được');
    }
    let query = this.databases.system
      .selectFrom('impersonation_actions')
      .select([
        'id',
        'impersonation_id',
        'impersonator_name',
        'target_name',
        'method',
        'path',
        'status_code',
        'ip_address',
        'created_at',
      ]);
    if (impersonationId) {
      if (!/^[0-9a-f-]{36}$/.test(impersonationId)) {
        throw new ApplicationError('ERR_VALIDATION', 'Mã đăng nhập thay không hợp lệ');
      }
      query = query.where('impersonation_id', '=', impersonationId);
    }
    return { items: await query.orderBy('created_at', 'desc').limit(LIST_LIMIT).execute() };
  }
}
