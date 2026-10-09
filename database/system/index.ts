import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createAcademicYearTables } from './migrations/0002_create_academic_year_tables.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu hệ thống, theo số thứ tự (QU-01, QĐ-17)
export const systemMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_academic_year_tables': createAcademicYearTables,
};
