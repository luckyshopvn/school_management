import { AccessTokenVerifier } from '@school-management/server/access-token';
import {
  normalizeHost,
  parseTenantHostSource,
  runAsSchool,
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
import { databaseHostSettings, readDatabaseHostOptions, type DatabaseHostOptions } from './database-host-adapter.js';

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
  // Tên miền hệ thống (PLATFORM_ROOT_DOMAIN): gốc của các tên miền con `<mã trường>.<tên miền hệ thống>`; có thì trang chọn trường
  // phục vụ ở tên miền này (DT-SaaS phần S1b)
  rootDomain: string | null;
  // Nơi đặt PostgreSQL của trường (DB_HOST_ADAPTER, DT-SaaS phần S9): địa chỉ gom kết nối ghi vào mô tả kết nối
  databaseHost?: DatabaseHostOptions;
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
    rootDomain: normalizeHost(env.PLATFORM_ROOT_DOMAIN?.trim() || undefined) ?? null,
    databaseHost: readDatabaseHostOptions(env),
    connections: {
      ...(poolMax !== undefined ? { poolMax } : {}),
      // Mỗi trường dùng nhóm cho cơ sở dữ liệu định danh, hệ thống và năm học đang dùng
      ...(schools !== undefined ? { maxPools: schools * 3 } : {}),
    },
    cacheSeconds: readNumber(env, 'TENANT_CACHE_SECONDS') ?? 30,
  };
}

export interface SchoolRunResult {
  schoolId: string;
  schoolCode: string;
  ok: boolean;
  durationMilliseconds: number;
  error?: string;
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
      const host = databaseHostSettings(
        configuration.databaseHost ?? readDatabaseHostOptions({}),
        configuration.adminDatabaseUrl,
      );
      this.layout = createSchoolDatabaseLayout(configuration.layout, {
        adminUrl: configuration.adminDatabaseUrl,
        host: host.host,
        port: host.port,
        ...(host.loginSuffix ? { loginSuffix: host.loginSuffix } : {}),
        revokePublicConnect: host.revokePublicConnect,
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
      return this.registry.contextOf(claims.tenantId);
    };
  }

  // Chạy một việc cho từng trường đang phục vụ, mỗi việc trong ngữ cảnh của trường (DT-SaaS phần S1b, tài liệu 32 mục 14.5): bỏ qua
  // trường tạm dừng hoặc đang khởi tạo; trường lỗi không chặn trường khác; số trường chạy song song giới hạn, mỗi trường lệch một
  // khoảng ngẫu nhiên để các trường không dồn cùng lúc
  async forEachServingSchool(
    work: (tenant: TenantContext) => Promise<void>,
    options: { concurrency?: number; jitterMilliseconds?: number } = {},
  ): Promise<SchoolRunResult[]> {
    const ids = await this.registry.listServingSchoolIds();
    const results: SchoolRunResult[] = [];
    const concurrency = Math.max(1, options.concurrency ?? 2);
    const jitter = options.jitterMilliseconds ?? 0;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < ids.length) {
        const id = ids[next] as string;
        next += 1;
        const tenant = await this.registry.contextOf(id).catch(() => null);
        if (!tenant) {
          continue;
        }
        if (jitter > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * jitter)));
        }
        const started = Date.now();
        try {
          await runAsSchool(tenant, () => work(tenant));
          results.push({
            schoolId: tenant.schoolId,
            schoolCode: tenant.code,
            ok: true,
            durationMilliseconds: Date.now() - started,
          });
        } catch (error) {
          results.push({
            schoolId: tenant.schoolId,
            schoolCode: tenant.code,
            ok: false,
            durationMilliseconds: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));
    return results.sort((a, b) => a.schoolCode.localeCompare(b.schoolCode));
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

  // Tên miền có được phục vụ không, cho điểm kiểm tra cấp chứng chỉ theo yêu cầu (DT-SaaS phần S1b; Caddy on-demand TLS hay Cloudflare for
  // SaaS hỏi trước khi cấp): tên miền gốc của hệ thống, hoặc tên miền đã xác minh/đang dùng của trường chưa bị xóa hay đang khởi tạo
  async isServedHost(host: string): Promise<boolean> {
    const normalized = normalizeHost(host);
    if (!normalized) {
      return false;
    }
    if (this.configuration.rootDomain && normalized === this.configuration.rootDomain) {
      return true;
    }
    const row = await this.platform
      .selectFrom('school_domains')
      .innerJoin('schools', 'schools.id', 'school_domains.school_id')
      .select('school_domains.id')
      .where('school_domains.host', '=', normalized)
      .where('school_domains.status', 'in', ['verified', 'active'])
      .where('schools.status', 'in', ['trial', 'active', 'read_only', 'suspended'])
      .executeTakeFirst();
    return row !== undefined;
  }

  // Trang chọn trường ở tên miền gốc: nhập mã trường, nhận địa chỉ của trường. Chỉ trả khi trường đang phục vụ; không liệt kê trường
  async resolveSchoolAddress(code: string): Promise<string | null> {
    const root = this.configuration.rootDomain;
    const normalized = code.trim().toLowerCase();
    if (!root || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(normalized)) {
      return null;
    }
    const school = await this.platform
      .selectFrom('schools')
      .select('id')
      .where('code', '=', normalized)
      .where('status', 'in', ['trial', 'active', 'read_only'])
      .executeTakeFirst();
    if (!school) {
      return null;
    }
    const domain = await this.platform
      .selectFrom('school_domains')
      .select('host')
      .where('school_id', '=', school.id)
      .where('status', '=', 'active')
      .orderBy('kind', 'asc')
      .executeTakeFirst();
    return domain ? `https://${domain.host}/` : null;
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
