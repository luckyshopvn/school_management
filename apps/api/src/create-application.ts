import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication, Type } from '@nestjs/common';
import { ErrorCountBuffer, type TenancyRuntime } from '@school-management/database';
import {
  Clock,
  createSchoolReadOnlyMiddleware,
  createTenantMiddleware,
  currentTenant,
  ErrorFilter,
  securityHeaders,
  isApiWriteAllowedWhenReadOnly,
  setServerErrorListener,
  SystemClock,
} from '@school-management/server';
import { API_VERSION_PREFIX } from '@school-management/shared';
import type { AcademicYearTransitionStep } from './academic-years/academic-year-transition.js';
import { ApplicationModule } from './application.module.js';
import type { ApiConfiguration } from './common/configuration.js';
import { TENANT_FREE_PATHS } from './common/school-picker.js';
import type { FileStorage } from './files/file-storage.js';
import type { SmsGateway } from './notifications/sms-gateway.js';
import type { IdentityClient } from './authentication/identity-client.js';

export async function createApplication(
  configuration: ApiConfiguration,
  options: {
    clock?: Clock;
    additionalControllers?: Type[];
    transitionSteps?: AcademicYearTransitionStep[];
    fileStorage?: FileStorage;
    smsGateway?: SmsGateway;
    identityClient?: IdentityClient;
    // Nền tảng nhiều trường (DT-SaaS phần S1a): có thì mỗi yêu cầu nhận diện trường theo tên miền; không có là chế độ một trường
    tenancy?: TenancyRuntime | null;
  } = {},
): Promise<INestApplication> {
  const application = await NestFactory.create(
    ApplicationModule.register(configuration, options.clock ?? new SystemClock(), options),
    { logger: ['error', 'warn'] },
  );
  // Tiêu đề bảo mật (DT-SaaS phần S8b), đặt trước mọi lớp trung gian khác
  application.use(securityHeaders());
  const tenancy = options.tenancy ?? null;
  if (tenancy) {
    // Gọi nội bộ giữa máy chủ API và dịch vụ định danh dùng địa chỉ nội bộ, không phải tên miền của trường: khi tên miền không
    // phân giải được mà yêu cầu mang mã phiên hợp lệ thì lấy trường theo mã trường trong mã phiên (đã ký)
    const clock = options.clock ?? new SystemClock();
    application.use(
      createTenantMiddleware({
        resolver: tenancy.registry,
        hostSource: tenancy.configuration.hostSource,
        isTenantFreePath: (path) => TENANT_FREE_PATHS.has(path),
        ...(tenancy.configuration.edgeSecret ? { edgeSecret: tenancy.configuration.edgeSecret } : {}),
        resolveByToken: tenancy.tokenTenantResolver(
          configuration.tokenPublicKeyPem,
          () => clock.now(),
          configuration.tokenPreviousPublicKeyPem ?? null,
        ),
      }),
    );
    // Trường quá hạn ở chế độ chỉ đọc: chặn yêu cầu ghi (DT-SaaS phần S5a)
    application.use(createSchoolReadOnlyMiddleware({ isAllowedWrite: isApiWriteAllowedWhenReadOnly }));
    // Lỗi máy chủ theo trường cho bảng điều khiển nền tảng (DT-SaaS phần S4): gom trong bộ nhớ, ghi cộng dồn mỗi phút
    const errors = new ErrorCountBuffer();
    setServerErrorListener((report) =>
      errors.add({
        schoolId: currentTenant()?.schoolId ?? null,
        service: 'api',
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
