import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApplicationError, unauthenticatedError } from '@school-management/server';
import type { AccessTokenClaims } from '@school-management/server';
import { TokenService } from './token.service.js';
import { SupportSessionsService } from '../platform/support-sessions.js';

// Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): không đăng nhập thay, không đổi mật khẩu của tài khoản hỗ trợ; phiên chỉ
// đọc chỉ được đọc và đăng xuất
const SUPPORT_FORBIDDEN_PATHS = ['/api/v1/auth/impersonation', '/api/v1/auth/change-password'];
const SUPPORT_READ_ONLY_WRITES = ['/api/v1/auth/logout'];
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const ALLOWED_WHILE_PASSWORD_CHANGE_REQUIRED = 'allowedWhilePasswordChangeRequired';

// Điểm cuối vẫn dùng được khi tài khoản bắt buộc đổi mật khẩu (BM-07)
export const AllowedWhilePasswordChangeRequired = () => SetMetadata(ALLOWED_WHILE_PASSWORD_CHANGE_REQUIRED, true);

export interface AuthenticatedRequest extends Request {
  accessTokenClaims: AccessTokenClaims;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
    private readonly support: SupportSessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization') ?? '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw unauthenticatedError();
    }
    const claims = await this.tokenService.verifyAccessToken(token);
    const allowed = this.reflector.get<boolean>(ALLOWED_WHILE_PASSWORD_CHANGE_REQUIRED, context.getHandler());
    if (claims.passwordChangeRequired && !allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn cần đổi mật khẩu trước khi tiếp tục');
    }
    if (claims.support) {
      await this.guardSupport(request, claims.sessionId, claims.support);
    }
    request.accessTokenClaims = claims;
    return true;
  }

  private async guardSupport(request: AuthenticatedRequest, sessionId: string, scope: 'read' | 'full'): Promise<void> {
    const active = await this.support.requireActive(sessionId);
    const route = `${request.baseUrl}${(request.route as { path?: string } | undefined)?.path ?? request.path}`;
    const method = request.method.toUpperCase();
    const forbidden =
      SUPPORT_FORBIDDEN_PATHS.some((path) => route.startsWith(path)) ||
      ((scope === 'read' || active.scope === 'read') &&
        !READ_METHODS.includes(method) &&
        !SUPPORT_READ_ONLY_WRITES.includes(route));
    if (forbidden) {
      this.support.record(active, method, route, 403);
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Phiên hỗ trợ chỉ đọc hoặc thao tác không dùng được trong phiên hỗ trợ',
      );
    }
    // Máy chủ API hỏi /auth/me ở mỗi yêu cầu; thao tác đã ghi ở máy chủ API nên không ghi lại ở đây
    if (route !== '/api/v1/auth/me') {
      request.res?.once('finish', () => this.support.record(active, method, route, request.res?.statusCode ?? 0));
    }
  }
}
