import { applyTrustProxy } from '@school-management/server';
import { readConfigurationFromEnvironment } from './common/configuration.js';
import { createApplication } from './create-application.js';

// Dịch vụ định danh
const application = await createApplication(readConfigurationFromEnvironment());
// Sau máy chủ chuyển tiếp thì lấy địa chỉ người dùng từ X-Forwarded-For để giới hạn đăng nhập theo địa chỉ (YCTD-92)
applyTrustProxy(application, process.env.TRUST_PROXY);
const port = Number(process.env.IDENTITY_PORT ?? 3001);
await application.listen(port);
console.log(`Dịch vụ định danh chạy ở cổng ${port}`);
