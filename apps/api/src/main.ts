import { applyTrustProxy } from '@school-management/server';
import { readConfigurationFromEnvironment } from './common/configuration.js';
import { createApplication } from './create-application.js';

// Máy chủ API nghiệp vụ
const application = await createApplication(readConfigurationFromEnvironment());
// Sau máy chủ chuyển tiếp thì lấy địa chỉ người dùng từ X-Forwarded-For cho nhật ký và giới hạn yêu cầu (YCTD-92)
applyTrustProxy(application, process.env.TRUST_PROXY);
const port = Number(process.env.API_PORT ?? 3000);
await application.listen(port);
console.log(`Máy chủ API nghiệp vụ chạy ở cổng ${port}`);
