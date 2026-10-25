import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { ApplicationModule } from './application.module.js';
import { PLATFORM_OPERATOR_LOGIN_PATH } from './platform/platform-operators.js';
import type { OrganizationDirectory } from './accounts/organization-directory.js';
import type { IdentityConfiguration } from './common/configuration.js';
import type { SmsSender } from './messaging/sms-sender.js';
import type { TenancyRuntime } from '@school-management/database';
import {
  Clock,
  createSchoolReadOnlyMiddleware,
  createTenantMiddleware,
  ErrorFilter,
  isIdentityWriteAllowedWhenReadOnly,
  SystemClock,
} from '@school-management/server';

export async function createApplication(
  configuration: IdentityConfiguration,
  clock: Clock = new SystemClock(),
  organizationDirectory?: OrganizationDirectory,
  smsSender?: SmsSender,
  // Nền tảng nhiều trường (DT-SaaS phần S1a): có thì mỗi yêu cầu nhận diện trường theo tên miền; không có là chế độ một trường
  tenancy: TenancyRuntime | null = null,
): Promise<INestApplication> {
  const application = await NestFactory.create<NestExpressApplication>(
    ApplicationModule.register(configuration, clock, organizationDirectory, smsSender, tenancy),
    { logger: ['error', 'warn'] },
  );
  if (tenancy) {
    // Máy chủ API gọi dịch vụ định danh bằng địa chỉ nội bộ, không phải tên miền của trường: khi tên miền không phân giải được mà yêu
    // cầu mang mã phiên hợp lệ thì lấy trường theo mã trường trong mã phiên (đã ký)
    application.use(
      createTenantMiddleware({
        resolver: tenancy.registry,
        hostSource: tenancy.configuration.hostSource,
        // Đăng nhập vận hành nền tảng không thuộc trường nào; chỉ phục vụ ở tên miền của cổng nền tảng (kiểm ở bộ điều khiển)
        isTenantFreePath: (path) => path === '/api/v1/health' || path.startsWith(PLATFORM_OPERATOR_LOGIN_PATH),
        ...(tenancy.configuration.edgeSecret ? { edgeSecret: tenancy.configuration.edgeSecret } : {}),
        resolveByToken: tenancy.tokenTenantResolver(configuration.tokenPublicKeyPem, () => clock.now()),
      }),
    );
    // Trường quá hạn ở chế độ chỉ đọc: chặn quản trị tài khoản, vẫn đăng nhập, đổi mật khẩu được (DT-SaaS phần S5a)
    application.use(createSchoolReadOnlyMiddleware({ isAllowedWrite: isIdentityWriteAllowedWhenReadOnly }));
  }
  application.setGlobalPrefix(API_VERSION_PREFIX.slice(1));
  application.useGlobalFilters(new ErrorFilter());
  application.enableShutdownHooks();
  return application;
}
