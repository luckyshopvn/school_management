import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createDatabase, replaceDatabaseName, type SystemDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { API_CONFIGURATION, type ApiConfiguration } from './configuration.js';

// Kết nối cơ sở dữ liệu hệ thống và các cơ sở dữ liệu năm học; mã nguồn không giả định chỉ có một cơ sở dữ liệu (AI-41)
@Injectable()
export class Databases implements OnModuleDestroy {
  readonly system: Kysely<SystemDatabase>;
  private readonly schoolYears = new Map<string, Kysely<unknown>>();

  constructor(@Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration) {
    this.system = createDatabase<SystemDatabase>(configuration.systemDatabaseUrl);
  }

  schoolYearConnectionString(databaseName: string): string {
    return replaceDatabaseName(this.configuration.systemDatabaseUrl, databaseName);
  }

  schoolYear<Schema>(databaseName: string): Kysely<Schema> {
    let database = this.schoolYears.get(databaseName);
    if (!database) {
      database = createDatabase<unknown>(this.schoolYearConnectionString(databaseName));
      this.schoolYears.set(databaseName, database);
    }
    return database as Kysely<Schema>;
  }

  // Đóng kết nối cũ để kết nối mới nhận chế độ chỉ đọc của cơ sở dữ liệu
  async closeSchoolYear(databaseName: string): Promise<void> {
    const database = this.schoolYears.get(databaseName);
    this.schoolYears.delete(databaseName);
    await database?.destroy();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.schoolYears.values()].map((database) => database.destroy()));
    this.schoolYears.clear();
    await this.system.destroy();
  }
}
