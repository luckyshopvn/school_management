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
import { ErrorCountBuffer, type TenancyRuntime } from '@school-management/database';
import {
  Clock,
  createSchoolReadOnlyMiddleware,
  createTenantMiddleware,
  ErrorFilter,
  currentTenant,
  securityHeaders,
  isIdentityWriteAllowedWhenReadOnly,
  setServerErrorListener,
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
  // Tiêu đề bảo mật (DT-SaaS phần S8b), đặt trước mọi lớp trung gian khác
  application.use(securityHeaders());
  if (tenancy) {
    // Máy chủ API gọi dịch vụ định danh bằng địa chỉ nội bộ, không phải tên miền của trường: khi tên miền không phân giải được mà yêu
    // cầu mang mã phiên hợp lệ thì lấy trường theo mã trường trong mã phiên (đã ký)
    application.use(
      createTenantMiddleware({
        resolver: tenancy.registry,
        hostSource: tenancy.configuration.hostSource,
        // Đăng nhập vận hành nền tảng không thuộc trường nào; chỉ phục vụ ở tên miền của cổng nền tảng (kiểm ở bộ điều khiển)
        isTenantFreePath: (path) =>
          path === '/api/v1/health' ||
          path.startsWith(PLATFORM_OPERATOR_LOGIN_PATH) ||
          // Tài khoản cấp trên (DT-SaaS phần S6) không thuộc trường nào
          path.startsWith('/api/v1/auth/parent-org/'),
        ...(tenancy.configuration.edgeSecret ? { edgeSecret: tenancy.configuration.edgeSecret } : {}),
        resolveByToken: tenancy.tokenTenantResolver(
          configuration.tokenPublicKeyPem,
          () => clock.now(),
          configuration.tokenPreviousPublicKeyPem ?? null,
        ),
      }),
    );
    // Trường quá hạn ở chế độ chỉ đọc: chặn quản trị tài khoản, vẫn đăng nhập, đổi mật khẩu được (DT-SaaS phần S5a)
    application.use(createSchoolReadOnlyMiddleware({ isAllowedWrite: isIdentityWriteAllowedWhenReadOnly }));
    // Lỗi máy chủ theo trường cho bảng điều khiển nền tảng (DT-SaaS phần S4): gom trong bộ nhớ, ghi cộng dồn mỗi phút
    const errors = new ErrorCountBuffer();
    setServerErrorListener((report) =>
      errors.add({
        schoolId: currentTenant()?.schoolId ?? null,
        service: 'identity',
        route: report.route,
        status: report.status,
        code: report.code,
        at: clock.now(),
      }),
    );
    const flush = () => (errors.size ? errors.flush(tenancy.platform).catch(() => 0) : Promise.resolve(0));
    const timer = setInterval(() => void flush(), 60_000);
    timer.unref();
    application.getHttpServer().once('close', () => {
      clearInterval(timer);
      setServerErrorListener(null);
      void flush();
    });
  }
  application.setGlobalPrefix(API_VERSION_PREFIX.slice(1));
  application.useGlobalFilters(new ErrorFilter());
  application.enableShutdownHooks();
  return application;
}
