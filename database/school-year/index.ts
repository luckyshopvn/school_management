import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createOrgUnitsAndAuditLogs } from './migrations/0002_create_org_units_and_audit_logs.js';
import { migration as createSettings } from './migrations/0003_create_settings.js';
import { migration as createCatalogs } from './migrations/0004_create_catalogs.js';
import { migration as createClasses } from './migrations/0005_create_classes.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu năm học, theo số thứ tự (QU-01, QU-11)
export const schoolYearMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_org_units_and_audit_logs': createOrgUnitsAndAuditLogs,
  '0003_create_settings': createSettings,
  '0004_create_catalogs': createCatalogs,
  '0005_create_classes': createClasses,
};
