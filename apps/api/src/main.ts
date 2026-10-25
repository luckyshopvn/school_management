import { createTenancyRuntime } from '@school-management/database';
import { applyTrustProxy } from '@school-management/server';
import { readConfigurationFromEnvironment } from './common/configuration.js';
import { withTenantAccessors } from './common/tenant-configuration.js';
import { createApplication } from './create-application.js';

// Máy chủ API nghiệp vụ
// Có PLATFORM_DATABASE_URL thì chạy nhiều trường (DT-SaaS phần S1a); không có thì chế độ một trường như trước
const tenancy = createTenancyRuntime();
const baseConfiguration = readConfigurationFromEnvironment();
const application = await createApplication(
  tenancy ? withTenantAccessors(baseConfiguration, tenancy) : baseConfiguration,
  { tenancy },
);
// Nhóm kết nối và cơ sở dữ liệu nền tảng đóng khi máy chủ dừng
if (tenancy) {
  application.getHttpServer().once('close', () => {
    void tenancy.close();
  });
}
// Sau máy chủ chuyển tiếp thì lấy địa chỉ người dùng từ X-Forwarded-For cho nhật ký và giới hạn yêu cầu (YCTD-92)
applyTrustProxy(application, process.env.TRUST_PROXY);
const port = Number(process.env.API_PORT ?? 3000);
await application.listen(port);
console.log(`Máy chủ API nghiệp vụ chạy ở cổng ${port}`);
