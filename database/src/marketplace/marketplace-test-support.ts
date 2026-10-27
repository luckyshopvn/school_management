import { randomBytes } from 'node:crypto';
import { migrateToLatest } from '../migrate.js';
import { testAdminDatabaseUrl } from '../test-admin.js';
import { dropMarketplaceDatabase, provisionMarketplaceDatabase } from './marketplace-database.js';

// Cơ sở dữ liệu chợ gia sư cho kiểm thử (DT-27 phần 27f): tên cơ sở dữ liệu và vai trò riêng của lần chạy (vai trò là của cả cụm
// PostgreSQL), chạy tệp thay đổi cấu trúc bằng vai trò của chợ; gỡ cả hai khi xong
export interface MarketplaceTestDatabase {
  url: string;
  roleName: string;
  databaseName: string;
  close(): Promise<void>;
}

export async function startMarketplaceTestDatabase(label = 'test'): Promise<MarketplaceTestDatabase> {
  const suffix = randomBytes(4).toString('hex');
  const adminUrl = testAdminDatabaseUrl();
  const databaseName = `school_marketplace_${label}_${suffix}`;
  const roleName = `marketplace_${label}_${suffix}`;
  const url = await provisionMarketplaceDatabase({
    adminUrl,
    databaseName,
    roleName,
    rolePassword: randomBytes(18).toString('base64url'),
  });
  const { error } = await migrateToLatest('marketplace', url);
  if (error) {
    await dropMarketplaceDatabase(adminUrl, databaseName, roleName);
    throw error;
  }
  return {
    url,
    roleName,
    databaseName,
    close: () => dropMarketplaceDatabase(adminUrl, databaseName, roleName),
  };
}
