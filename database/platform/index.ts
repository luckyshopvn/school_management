import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createSchools } from './migrations/0002_create_schools.js';
import { migration as createPlatformSettingsAndOperators } from './migrations/0003_create_platform_settings_and_operators.js';
import { migration as createPlatformAuditLog } from './migrations/0004_create_platform_audit_log.js';
import { migration as createSchedulerState } from './migrations/0010_create_scheduler_state.js';
import { migration as createSchoolLifecycle } from './migrations/0020_create_school_lifecycle.js';
import { migration as addDomainVerification } from './migrations/0021_add_domain_verification.js';
import { migration as createSchoolConsents } from './migrations/0022_create_school_consents.js';
import { migration as createKeyRotations } from './migrations/0030_create_key_rotations.js';
import { migration as createPlans } from './migrations/0040_create_plans.js';
import { migration as createBilling } from './migrations/0050_create_billing.js';
import { migration as createBackupRuns } from './migrations/0070_create_backup_runs.js';
import { migration as addDatabaseLoginName } from './migrations/0100_add_database_login_name.js';

// Khối số giữ sẵn của phần S1a: 0001 đến 0009; S2: 0020 đến 0029 (tài liệu 32 mục 14.3)
export const platformMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_schools': createSchools,
  '0003_create_platform_settings_and_operators': createPlatformSettingsAndOperators,
  '0004_create_platform_audit_log': createPlatformAuditLog,
  // Khối 0010 đến 0019 của phần S1b
  '0010_create_scheduler_state': createSchedulerState,
  '0020_create_school_lifecycle': createSchoolLifecycle,
  '0021_add_domain_verification': addDomainVerification,
  '0022_create_school_consents': createSchoolConsents,
  // Khối 0030 đến 0039 của phần S3
  '0030_create_key_rotations': createKeyRotations,
  // Gói dịch vụ và giới hạn (S5a): 0040 đến 0049
  '0040_create_plans': createPlans,
  // Thu phí tự động (S5b): 0050 đến 0059
  '0050_create_billing': createBilling,
  // Khối 0070 đến 0079 của phần S7b
  '0070_create_backup_runs': createBackupRuns,
  // Khối 0100 đến 0109 của phần S9
  '0100_add_database_login_name': addDatabaseLoginName,
};
