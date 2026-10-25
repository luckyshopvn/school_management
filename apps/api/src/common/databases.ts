import { Inject, Injectable, Optional, type OnModuleDestroy } from '@nestjs/common';
import {
  createDatabase,
  createEmptyDatabase,
  dropDatabaseIfExists,
  makeDatabaseReadOnly,
  makeDatabaseWritable,
  replaceDatabaseName,
  type SystemDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import { requireTenant, type TenantContext } from '@school-management/server';
import type { Kysely } from 'kysely';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from './configuration.js';

// Kết nối cơ sở dữ liệu hệ thống và các cơ sở dữ liệu năm học; mã nguồn không giả định chỉ có một cơ sở dữ liệu (AI-41).
// Chế độ một trường (mặc định): cơ sở dữ liệu theo biến môi trường như trước đây. Chế độ nhiều trường (DT-SaaS phần S1a, có
// PLATFORM_DATABASE_URL): mỗi yêu cầu chỉ nhận kết nối của trường trong ngữ cảnh (nhận diện theo tên miền ở đầu yêu cầu); thiếu
// ngữ cảnh là lỗi, không rơi về trường nào. Chữ ký giữ nguyên nên hàng trăm chỗ gọi không phải sửa
@Injectable()
export class Databases implements OnModuleDestroy {
  private readonly singleSystem: Kysely<SystemDatabase> | null;
  private readonly schoolYears = new Map<string, Kysely<unknown>>();

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {
    this.singleSystem = tenancy ? null : createDatabase<SystemDatabase>(configuration.systemDatabaseUrl);
  }

  private runtime(): TenancyRuntime {
    if (!this.tenancy) {
      throw new Error('Chế độ nhiều trường chưa được cấu hình');
    }
    return this.tenancy;
  }

  // Trường của yêu cầu hiện tại; undefined ở chế độ một trường
  private tenant(what: string): TenantContext | undefined {
    return requireTenant(what);
  }

  get system(): Kysely<SystemDatabase> {
    const tenant = this.tenant('cơ sở dữ liệu hệ thống');
    if (tenant) {
      return this.runtime().connections.database<SystemDatabase>(tenant, 'system', 'system');
    }
    return this.singleSystem as Kysely<SystemDatabase>;
  }

  schoolYearConnectionString(databaseName: string): string {
    const tenant = this.tenant('cơ sở dữ liệu năm học');
    if (tenant) {
      return this.runtime().registry.connectionString(tenant, 'school-year', databaseName);
    }
    return replaceDatabaseName(this.configuration.systemDatabaseUrl, databaseName);
  }

  schoolYear<Schema>(databaseName: string): Kysely<Schema> {
    const tenant = this.tenant('cơ sở dữ liệu năm học');
    if (tenant) {
      return this.runtime().connections.database<Schema>(tenant, 'school-year', databaseName);
    }
    let database = this.schoolYears.get(databaseName);
    if (!database) {
      database = createDatabase<unknown>(this.schoolYearConnectionString(databaseName));
      this.schoolYears.set(databaseName, database);
    }
    return database as Kysely<Schema>;
  }

  // Tạo cơ sở dữ liệu năm học rỗng, trả chuỗi kết nối để chạy tệp thay đổi cấu trúc
  async createSchoolYearDatabase(databaseName: string): Promise<string> {
    const tenant = this.tenant('cơ sở dữ liệu năm học');
    if (tenant) {
      return this.runtime().createYearDatabase(tenant, databaseName);
    }
    await createEmptyDatabase(this.configuration.systemDatabaseUrl, databaseName);
    return this.schoolYearConnectionString(databaseName);
  }

  // Xóa cơ sở dữ liệu năm học (hoàn tác khi mở năm học lỗi hoặc hủy mở); không có thì không làm gì
  async dropSchoolYearDatabase(databaseName: string): Promise<void> {
    const tenant = this.tenant('cơ sở dữ liệu năm học');
    if (tenant) {
      const runtime = this.runtime();
      if (!runtime.registry.recordOf(tenant.schoolId).databases.has(`school-year:${databaseName}`)) {
        return;
      }
      await runtime.dropYearDatabase(tenant, databaseName);
      return;
    }
    await this.closeSchoolYear(databaseName);
    await dropDatabaseIfExists(this.configuration.systemDatabaseUrl, databaseName);
  }

  // Khóa ghi (năm học đã đóng, BR-93) hoặc mở lại; kết nối cũ được đóng để kết nối mới nhận chế độ chỉ đọc
  async setSchoolYearReadOnly(databaseName: string, readOnly: boolean): Promise<void> {
    const tenant = this.tenant('cơ sở dữ liệu năm học');
    if (tenant) {
      await this.runtime().setYearReadOnly(tenant, databaseName, readOnly);
      return;
    }
    if (readOnly) {
      await makeDatabaseReadOnly(this.configuration.systemDatabaseUrl, databaseName);
    } else {
      await makeDatabaseWritable(this.configuration.systemDatabaseUrl, databaseName);
    }
    await this.closeSchoolYear(databaseName);
  }

  // Đóng kết nối cũ để kết nối mới nhận chế độ chỉ đọc của cơ sở dữ liệu
  async closeSchoolYear(databaseName: string): Promise<void> {
    const tenant = this.tenant('cơ sở dữ liệu năm học');
    if (tenant) {
      const runtime = this.runtime();
      if (runtime.registry.recordOf(tenant.schoolId).databases.has(`school-year:${databaseName}`)) {
        await runtime.connections.close(tenant, 'school-year', databaseName);
      }
      return;
    }
    const database = this.schoolYears.get(databaseName);
    this.schoolYears.delete(databaseName);
    await database?.destroy();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.schoolYears.values()].map((database) => database.destroy()));
    this.schoolYears.clear();
    // Nhóm kết nối của từng trường do thời gian chạy nền tảng đóng khi dịch vụ dừng
    await this.singleSystem?.destroy();
  }
}
