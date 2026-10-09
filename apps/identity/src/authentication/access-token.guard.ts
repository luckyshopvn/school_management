import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApplicationError, unauthenticatedError } from '../common/application-error.js';
import { TokenService, type AccessTokenClaims } from './token.service.js';

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
    request.accessTokenClaims = claims;
    return true;
  }
}
