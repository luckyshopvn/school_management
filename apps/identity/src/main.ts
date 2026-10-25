import { createTenancyRuntime } from '@school-management/database';
import { applyTrustProxy, SystemClock } from '@school-management/server';
import { readConfigurationFromEnvironment } from './common/configuration.js';
import { createApplication } from './create-application.js';

// Dịch vụ định danh
// Có PLATFORM_DATABASE_URL thì chạy nhiều trường (DT-SaaS phần S1a); không có thì chế độ một trường như trước
const tenancy = createTenancyRuntime();
const application = await createApplication(
  readConfigurationFromEnvironment(),
  new SystemClock(),
  undefined,
  undefined,
  tenancy,
);
if (tenancy) {
  application.getHttpServer().once('close', () => {
    void tenancy.close();
  });
}
// Sau máy chủ chuyển tiếp thì lấy địa chỉ người dùng từ X-Forwarded-For để giới hạn đăng nhập theo địa chỉ (YCTD-92)
applyTrustProxy(application, process.env.TRUST_PROXY);
const port = Number(process.env.IDENTITY_PORT ?? 3001);
await application.listen(port);
console.log(`Dịch vụ định danh chạy ở cổng ${port}`);
