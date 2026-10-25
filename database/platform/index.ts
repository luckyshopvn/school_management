import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createSchools } from './migrations/0002_create_schools.js';
import { migration as createPlatformSettingsAndOperators } from './migrations/0003_create_platform_settings_and_operators.js';
import { migration as createPlatformAuditLog } from './migrations/0004_create_platform_audit_log.js';
import { migration as createSchedulerState } from './migrations/0010_create_scheduler_state.js';
import { migration as createPlans } from './migrations/0040_create_plans.js';

// Khối số giữ sẵn của phần S1a: 0001 đến 0009 (tài liệu 32 mục 14.3)
export const platformMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_schools': createSchools,
  '0003_create_platform_settings_and_operators': createPlatformSettingsAndOperators,
  '0004_create_platform_audit_log': createPlatformAuditLog,
  // Khối 0010 đến 0019 của phần S1b
  '0010_create_scheduler_state': createSchedulerState,
  // Gói dịch vụ và giới hạn (S5a): 0040 đến 0049
  '0040_create_plans': createPlans,
};
