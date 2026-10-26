import {
  createParamDecorator,
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AccessTokenVerifier,
  ApplicationError,
  Clock,
  currentTenant,
  isMultiTenantMode,
  readBearerToken,
  unauthenticatedError,
} from '@school-management/server';
import { isPermissionInPlan } from '@school-management/shared';
import type { Request } from 'express';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentUser } from './current-user.js';
import { IdentityClient } from './identity-client.js';

const PUBLIC_ENDPOINT = 'publicEndpoint';
const REQUIRED_PERMISSIONS = 'requiredPermissions';
const STUDENT_ENDPOINT = 'studentEndpoint';

// Điểm cuối không cần mã phiên, ví dụ kiểm tra sức khỏe
export const PublicEndpoint = () => SetMetadata(PUBLIC_ENDPOINT, true);

// Điểm cuối của học sinh (DT-23 phần 23a, nhóm /student/*): chỉ mã phiên của kênh student gọi được. Ngược lại mã phiên kênh student
// chỉ gọi được điểm cuối loại này, nên học sinh không với tới được dữ liệu của cán bộ, phụ huynh dù tuyến quên khai quyền
export const StudentEndpoint = () => SetMetadata(STUDENT_ENDPOINT, true);

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
    this.verifier = new AccessTokenVerifier(
      configuration.tokenPublicKeyPem,
      configuration.tokenPreviousPublicKeyPem ?? null,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT, targets)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = readBearerToken(request.header('authorization'));
    const claims = await this.verifier.verify(accessToken, this.clock.now());
    // Nhiều trường: mã phiên phải mang đúng mã trường của tên miền; mã phiên của trường khác bị từ chối (DT-SaaS phần S1a)
    if (isMultiTenantMode() && (!claims.tenantId || claims.tenantId !== currentTenant()?.schoolId)) {
      throw unauthenticatedError();
    }
    if (claims.passwordChangeRequired) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn cần đổi mật khẩu trước khi tiếp tục');
    }
    // Kênh student và nhóm điểm cuối của học sinh đi cặp với nhau, kiểm tra sau khi mã phiên đã đúng trường
    const studentEndpoint = this.reflector.getAllAndOverride<boolean>(STUDENT_ENDPOINT, targets) === true;
    if ((claims.channel === 'student') !== studentEndpoint) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Mã phiên này không dùng được cho chức năng này');
    }
    const currentUser = new CurrentUser(await this.identityClient.describeCurrentUser(accessToken), {
      channel: claims.channel,
      sessionId: claims.sessionId,
    });
    request.currentUser = currentUser;

    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_PERMISSIONS, targets);
    if (requiredPermissions && !requiredPermissions.some((code) => currentUser.hasPermission(code))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', [
        { field: 'permission', message: requiredPermissions.join(', ') },
      ]);
    }
    // Gói dịch vụ của trường (DT-SaaS phần S5a): quyền đủ nhưng mọi quyền đáp ứng đều thuộc phân hệ ngoài gói thì 403
    // MODULE_NOT_IN_PLAN; dữ liệu của phân hệ bị tắt được giữ nguyên
    const plan = currentTenant()?.plan;
    if (
      plan &&
      requiredPermissions &&
      !requiredPermissions.some((code) => currentUser.hasPermission(code) && isPermissionInPlan(code, plan.modules))
    ) {
      throw new ApplicationError('MODULE_NOT_IN_PLAN', 'Phân hệ này không có trong gói dịch vụ của trường', [
        { field: 'plan', message: plan.code },
      ]);
    }
    return true;
  }
}
