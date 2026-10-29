import { sql, type Kysely } from 'kysely';
import type { MarketplaceDatabase } from '../../marketplace/schema.js';
import { createDatabase } from '../connection.js';
import { assertIdentifier } from '../school-database-layout.js';
import { provisionOwnedDatabase } from '../owned-database.js';

// Cơ sở dữ liệu chung của chợ gia sư (DT-27 phần 27f, YCTD-256; tài liệu 47 mục 19.3 "hai sản phẩm, một mã nguồn"): một cơ sở dữ liệu
// riêng `marketplace` (cả hai bố cục `database`, `schema` của trường đều để chợ ở cơ sở dữ liệu riêng như `platform`), vai trò riêng chỉ
// là chủ của cơ sở dữ liệu đó. Cơ sở dữ liệu của trường đã thu quyền kết nối của PUBLIC (bố cục `database`) hoặc chỉ cấp cho vai trò
// của trường (bố cục `schema`), nên vai trò của chợ không kết nối được vào dữ liệu của trường nào
export const DEFAULT_MARKETPLACE_ROLE = 'marketplace_service';

// Kết nối tới cơ sở dữ liệu chợ bằng vai trò của chợ; máy chủ API giữ một nhóm kết nối nhỏ
export function createMarketplaceConnection(connectionString: string): Kysely<MarketplaceDatabase> {
  return createDatabase<MarketplaceDatabase>(connectionString, { max: 5 });
}

export interface ProvisionMarketplaceRequest {
  adminUrl: string;
  databaseName: string;
  roleName?: string;
  rolePassword: string;
}

// Tạo vai trò và cơ sở dữ liệu của chợ (chạy một lần khi dựng môi trường, bằng tài khoản quản trị); trả chuỗi kết nối bằng vai trò của
// chợ để đặt vào MARKETPLACE_DATABASE_URL. Chạy lại khi đã có thì giữ nguyên, chỉ đặt lại mật khẩu
export async function provisionMarketplaceDatabase(request: ProvisionMarketplaceRequest): Promise<string> {
  return provisionOwnedDatabase({ ...request, roleName: request.roleName ?? DEFAULT_MARKETPLACE_ROLE });
}

export async function dropMarketplaceDatabase(
  adminUrl: string,
  databaseName: string,
  roleName?: string,
): Promise<void> {
  assertIdentifier(databaseName, 'Tên cơ sở dữ liệu');
  const admin = createDatabase<unknown>(adminUrl, { max: 1 });
  try {
    await sql`drop database if exists ${sql.id(databaseName)} with (force)`.execute(admin);
    if (roleName) {
      assertIdentifier(roleName, 'Tên vai trò');
      await sql`drop role if exists ${sql.id(roleName)}`.execute(admin);
    }
  } finally {
    await admin.destroy();
  }
}

// Thử kết nối và chạy một câu lệnh bằng chuỗi kết nối (kiểm thử cách ly: vai trò của chợ không vào được cơ sở dữ liệu của trường)
export async function canConnect(connectionString: string): Promise<boolean> {
  const database = createDatabase<unknown>(connectionString, { max: 1 });
  try {
    await sql`select 1`.execute(database);
    return true;
  } catch {
    return false;
  } finally {
    await database.destroy();
  }
}
