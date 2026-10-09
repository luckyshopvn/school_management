import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createAccountTables } from './migrations/0002_create_account_tables.js';
import { migration as seedRolesAndPermissions } from './migrations/0003_seed_roles_and_permissions.js';
import { migration as addAcademicYearPermission } from './migrations/0004_add_academic_year_permission.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu định danh, theo số thứ tự (QU-01)
export const identityMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_account_tables': createAccountTables,
  '0003_seed_roles_and_permissions': seedRolesAndPermissions,
  '0004_add_academic_year_permission': addAcademicYearPermission,
};
