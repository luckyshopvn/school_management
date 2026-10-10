import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createOrgUnitsAndAuditLogs } from './migrations/0002_create_org_units_and_audit_logs.js';
import { migration as createSettings } from './migrations/0003_create_settings.js';
import { migration as createCatalogs } from './migrations/0004_create_catalogs.js';
import { migration as createClasses } from './migrations/0005_create_classes.js';
import { migration as createChildren } from './migrations/0006_create_children.js';
import { migration as createDataImports } from './migrations/0007_create_data_imports.js';
import { migration as createAttendance } from './migrations/0008_create_attendance.js';
import { migration as createPickups } from './migrations/0009_create_pickups.js';
import { migration as createFeeCatalogs } from './migrations/0010_create_fee_catalogs.js';
import { migration as createServiceRegistrations } from './migrations/0011_create_service_registrations.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu năm học, theo số thứ tự (QU-01, QU-11)
export const schoolYearMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_org_units_and_audit_logs': createOrgUnitsAndAuditLogs,
  '0003_create_settings': createSettings,
  '0004_create_catalogs': createCatalogs,
  '0005_create_classes': createClasses,
  '0006_create_children': createChildren,
  '0007_create_data_imports': createDataImports,
  '0008_create_attendance': createAttendance,
  '0009_create_pickups': createPickups,
  '0010_create_fee_catalogs': createFeeCatalogs,
  '0011_create_service_registrations': createServiceRegistrations,
};
