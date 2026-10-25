import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createSchools } from './migrations/0002_create_schools.js';
import { migration as createPlatformSettingsAndOperators } from './migrations/0003_create_platform_settings_and_operators.js';
import { migration as createPlatformAuditLog } from './migrations/0004_create_platform_audit_log.js';

// Khối số giữ sẵn của phần S1a: 0001 đến 0009 (tài liệu 32 mục 14.3)
export const platformMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_schools': createSchools,
  '0003_create_platform_settings_and_operators': createPlatformSettingsAndOperators,
  '0004_create_platform_audit_log': createPlatformAuditLog,
};
