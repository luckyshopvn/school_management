import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import { Databases } from './databases.js';

export interface CurrentSchoolYear {
  academicYearId: string;
  databaseName: string;
  database: Kysely<SchoolYearDatabase>;
}

// Năm học đang dùng là năm duy nhất ghi được dữ liệu nghiệp vụ (BR-93)
@Injectable()
export class CurrentSchoolYearResolver {
  constructor(private readonly databases: Databases) {}

  async find(): Promise<CurrentSchoolYear | undefined> {
    const row = await this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.id', 'academic_year_databases.database_name'])
      .where('academic_years.status', '=', 'open')
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }
    return {
      academicYearId: row.id,
      databaseName: row.database_name,
      database: this.databases.schoolYear<SchoolYearDatabase>(row.database_name),
    };
  }

  async require(): Promise<CurrentSchoolYear> {
    const current = await this.find();
    if (!current) {
      throw ruleViolationError('BR-93', 'Chưa có năm học đang dùng, hãy mở năm học trước');
    }
    return current;
  }
}
