import { readConfigurationFromEnvironment } from './common/configuration.js';
import { createApplication } from './create-application.js';

// Dịch vụ định danh
const application = await createApplication(readConfigurationFromEnvironment());
const port = Number(process.env.IDENTITY_PORT ?? 3001);
await application.listen(port);
console.log(`Dịch vụ định danh chạy ở cổng ${port}`);
