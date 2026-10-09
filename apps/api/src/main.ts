import { readConfigurationFromEnvironment } from './common/configuration.js';
import { createApplication } from './create-application.js';

// Máy chủ API nghiệp vụ
const application = await createApplication(readConfigurationFromEnvironment());
const port = Number(process.env.API_PORT ?? 3000);
await application.listen(port);
console.log(`Máy chủ API nghiệp vụ chạy ở cổng ${port}`);
