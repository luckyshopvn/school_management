import { AccessTokenVerifier } from '@school-management/server/access-token';
import {
  parseTenantHostSource,
  setMultiTenantMode,
  type TenantContext,
  type TenantHostSource,
} from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase, SchoolDatabaseLayoutValue } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { registerDescriptor } from './provision-school.js';
import {
  connectionStringOf,
  createSchoolDatabaseLayout,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import { TenantConnections, type TenantConnectionsOptions } from './tenant-connections.js';
import { TenantRegistry } from './tenant-registry.js';

// Cấu hình nền tảng nhiều trường đọc từ biến môi trường của nền tảng (không phải của từng trường, tài liệu 32 mục 14.4).
// Không có PLATFORM_DATABASE_URL thì chế độ một trường: hành vi hiện nay, mọi tên miền thuộc về trường duy nhất
export interface TenancyConfiguration {
  platformDatabaseUrl: string;
  masterKey: Buffer;
  layout: SchoolDatabaseLayoutValue;
  // Tài khoản quản trị tạo cơ sở dữ liệu và vai trò của trường (cấp nền tảng); thiếu thì không tạo được năm học mới
  adminDatabaseUrl: string | null;
  sharedDatabase: string | null;
  hostSource: TenantHostSource;
  edgeSecret: string | null;
  connections: TenantConnectionsOptions;
  cacheSeconds: number;
}

function readNumber(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const value = env[name]?.trim();
  if (!value) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} phải là số dương`);
  }
  return number;
}

export function readMasterKey(env: NodeJS.ProcessEnv): Buffer {
  const text = env.PLATFORM_MASTER_KEY?.trim();
  if (!text) {
    throw new Error('Thiếu biến môi trường PLATFORM_MASTER_KEY');
  }
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32) {
    throw new Error('PLATFORM_MASTER_KEY phải là 32 byte mã hóa base64');
  }
  return key;
}

export function readTenancyConfiguration(env: NodeJS.ProcessEnv = process.env): TenancyConfiguration | null {
  const platformDatabaseUrl = env.PLATFORM_DATABASE_URL?.trim();
  if (!platformDatabaseUrl) {
    return null;
  }
  const layout = (env.TENANT_DB_LAYOUT?.trim() || 'database') as SchoolDatabaseLayoutValue;
  if (layout !== 'database' && layout !== 'schema') {
    throw new Error('TENANT_DB_LAYOUT chỉ nhận database hoặc schema');
  }
  const hostSource = parseTenantHostSource(env.TENANT_HOST_SOURCE);
  const edgeSecret = env.EDGE_SHARED_SECRET?.trim() || null;
  if (hostSource.kind === 'header' && !edgeSecret) {
    throw new Error('TENANT_HOST_SOURCE=header:<tên> cần EDGE_SHARED_SECRET');
  }
  if (hostSource.kind === 'x-forwarded-host' && !env.TRUST_PROXY?.trim()) {
    throw new Error(
      'TENANT_HOST_SOURCE=x-forwarded-host cần TRUST_PROXY (chỉ tin tiêu đề của máy chủ chuyển tiếp đáng tin)',
    );
  }
  const sharedDatabase = env.PLATFORM_SHARED_DATABASE?.trim() || null;
  if (layout === 'schema' && !sharedDatabase) {
    throw new Error('TENANT_DB_LAYOUT=schema cần PLATFORM_SHARED_DATABASE');
  }
  const poolMax = readNumber(env, 'TENANT_POOL_MAX');
  const schools = readNumber(env, 'TENANT_POOL_SCHOOLS');
  return {
    platformDatabaseUrl,
    masterKey: readMasterKey(env),
    layout,
    adminDatabaseUrl: env.PLATFORM_ADMIN_DATABASE_URL?.trim() || null,
    sharedDatabase,
    hostSource,
    edgeSecret,
    connections: {
      ...(poolMax !== undefined ? { poolMax } : {}),
      // Mỗi trường dùng nhóm cho cơ sở dữ liệu định danh, hệ thống và năm học đang dùng
      ...(schools !== undefined ? { maxPools: schools * 3 } : {}),
    },
    cacheSeconds: readNumber(env, 'TENANT_CACHE_SECONDS') ?? 30,
  };
}

// Thời gian chạy của nền tảng nhiều trường: bộ phân giải, nhóm kết nối, bố cục cơ sở dữ liệu; dịch vụ định danh và máy chủ API
// dùng chung một lớp này
export class TenancyRuntime {
  readonly platform: Kysely<PlatformDatabase>;
  readonly registry: TenantRegistry;
  readonly connections: TenantConnections;
  readonly layout: SchoolDatabaseLayout | null;

  constructor(readonly configuration: TenancyConfiguration) {
    setMultiTenantMode(true);
    this.platform = createDatabase<PlatformDatabase>(configuration.platformDatabaseUrl, { max: 5 });
    this.registry = new TenantRegistry(this.platform, configuration.masterKey, {
      cacheSeconds: configuration.cacheSeconds,
    });
    this.connections = new TenantConnections(this.registry, configuration.connections);
    if (configuration.adminDatabaseUrl) {
      const url = new URL(configuration.adminDatabaseUrl);
      this.layout = createSchoolDatabaseLayout(configuration.layout, {
        adminUrl: configuration.adminDatabaseUrl,
        host: url.hostname,
        port: url.port ? Number(url.port) : 5432,
        ...(configuration.sharedDatabase ? { sharedDatabase: configuration.sharedDatabase } : {}),
      });
    } else {
      this.layout = null;
    }
  }

  // Gọi nội bộ giữa máy chủ API và dịch vụ định danh dùng địa chỉ nội bộ, không phải tên miền của trường: khi tên miền không phân
  // giải được mà yêu cầu mang mã phiên hợp lệ thì lấy trường theo mã trường (claim tid) trong mã phiên đã ký. Không có mã phiên,
  // mã phiên sai hoặc thiếu tid thì không có trường (404 chung)
  tokenTenantResolver(
    tokenPublicKeyPem: string,
    now: () => Date = () => new Date(),
  ): (request: { header(name: string): string | undefined }) => Promise<TenantContext | null> {
    const verifier = new AccessTokenVerifier(tokenPublicKeyPem);
    return async (request) => {
      const [scheme, token] = (request.header('authorization') ?? '').split(' ');
      if (scheme !== 'Bearer' || !token) {
        return null;
      }
      const claims = await verifier.verify(token, now()).catch(() => null);
      if (!claims?.tenantId) {
        return null;
      }
      return (await this.registry.loadSchool(claims.tenantId))?.context ?? null;
    };
  }

  private requireLayout(): SchoolDatabaseLayout {
    if (!this.layout) {
      throw new Error('Thiếu PLATFORM_ADMIN_DATABASE_URL: nền tảng không tạo được cơ sở dữ liệu của trường');
    }
    return this.layout;
  }

  // Tạo cơ sở dữ liệu năm học của một trường theo bố cục của trường và đăng ký mô tả kết nối; trả chuỗi kết nối để chạy tệp
  // thay đổi cấu trúc
  async createYearDatabase(tenant: TenantContext, name: string): Promise<string> {
    const layout = this.requireLayout();
    const record = this.registry.recordOf(tenant.schoolId);
    const sibling = [...record.databases.values()][0];
    if (!sibling) {
      throw new Error(`Trường ${tenant.code} chưa có cơ sở dữ liệu nào`);
    }
    // Bố cục database: vai trò của trường dùng chung một mật khẩu cho mọi cơ sở dữ liệu của trường
    const descriptor = await layout.create({
      schoolCode: tenant.code,
      kind: 'school-year',
      logicalName: name,
      physicalName: name,
      schoolRolePassword: sibling.password,
    });
    await registerDescriptor(this.platform, this.configuration.masterKey, tenant.schoolId, descriptor);
    await this.registry.loadSchool(tenant.schoolId);
    return connectionStringOf(descriptor);
  }

  async dropYearDatabase(tenant: TenantContext, name: string): Promise<void> {
    const layout = this.requireLayout();
    const descriptor: DatabaseDescriptor = this.registry.descriptorOf(tenant, 'school-year', name);
    await this.connections.close(tenant, 'school-year', name);
    await layout.drop(descriptor);
    await this.platform
      .deleteFrom('school_databases')
      .where('school_id', '=', tenant.schoolId)
      .where('kind', '=', 'school-year')
      .where('name', '=', name)
      .execute();
    await this.registry.loadSchool(tenant.schoolId);
  }

  async setYearReadOnly(tenant: TenantContext, name: string, readOnly: boolean): Promise<void> {
    const layout = this.requireLayout();
    const descriptor = this.registry.descriptorOf(tenant, 'school-year', name);
    await layout.setReadOnly(descriptor, readOnly);
    await this.platform
      .updateTable('school_databases')
      .set({ status: readOnly ? 'read_only' : 'active', updated_at: new Date() })
      .where('school_id', '=', tenant.schoolId)
      .where('kind', '=', 'school-year')
      .where('name', '=', name)
      .execute();
    // Đóng kết nối cũ để kết nối mới nhận chế độ chỉ đọc hoặc ghi
    await this.connections.close(tenant, 'school-year', name);
    await this.registry.loadSchool(tenant.schoolId);
  }

  async close(): Promise<void> {
    await this.connections.closeAll();
    await this.platform.destroy();
  }
}

export function createTenancyRuntime(env: NodeJS.ProcessEnv = process.env): TenancyRuntime | null {
  const configuration = readTenancyConfiguration(env);
  return configuration ? new TenancyRuntime(configuration) : null;
}
