import {
  createParamDecorator,
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenVerifier, ApplicationError, Clock, readBearerToken } from '@school-management/server';
import type { Request } from 'express';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentUser } from './current-user.js';
import { IdentityClient } from './identity-client.js';

const PUBLIC_ENDPOINT = 'publicEndpoint';
const REQUIRED_PERMISSIONS = 'requiredPermissions';

// Điểm cuối không cần mã phiên, ví dụ kiểm tra sức khỏe
export const PublicEndpoint = () => SetMetadata(PUBLIC_ENDPOINT, true);

// Lớp 1 của phân quyền: điểm cuối khai báo quyền cần có; có một trong các quyền là đủ (BM-10)
export const RequirePermission = (...permissionCodes: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissionCodes);

interface AuthenticatedRequest extends Request {
  currentUser?: CurrentUser;
}

export const AuthenticatedUser = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentUser => {
  const currentUser = context.switchToHttp().getRequest<AuthenticatedRequest>().currentUser;
  if (!currentUser) {
    throw new ApplicationError('ERR_INTERNAL', 'Thiếu thông tin tài khoản đang gọi');
  }
  return currentUser;
});

// Kiểm tra mã phiên ở mọi yêu cầu: chữ ký trước, sau đó hỏi dịch vụ định danh quyền hiện hành (XT-06, QĐ-20)
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly verifier: AccessTokenVerifier;

  constructor(
    @Inject(API_CONFIGURATION) configuration: ApiConfiguration,
    private readonly identityClient: IdentityClient,
    private readonly reflector: Reflector,
    private readonly clock: Clock,
  ) {
    this.verifier = new AccessTokenVerifier(configuration.tokenPublicKeyPem);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT, targets)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = readBearerToken(request.header('authorization'));
    const claims = await this.verifier.verify(accessToken, this.clock.now());
    if (claims.passwordChangeRequired) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn cần đổi mật khẩu trước khi tiếp tục');
    }
    const currentUser = new CurrentUser(await this.identityClient.describeCurrentUser(accessToken));
    request.currentUser = currentUser;

    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_PERMISSIONS, targets);
    if (requiredPermissions && !requiredPermissions.some((code) => currentUser.hasPermission(code))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', [
        { field: 'permission', message: requiredPermissions.join(', ') },
      ]);
    }
    return true;
  }
}
