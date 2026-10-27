import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createSchools } from './migrations/0002_create_schools.js';
import { migration as createPlatformSettingsAndOperators } from './migrations/0003_create_platform_settings_and_operators.js';
import { migration as createPlatformAuditLog } from './migrations/0004_create_platform_audit_log.js';
import { migration as createSchedulerState } from './migrations/0010_create_scheduler_state.js';
import { migration as createSchoolLifecycle } from './migrations/0020_create_school_lifecycle.js';
import { migration as addDomainVerification } from './migrations/0021_add_domain_verification.js';
import { migration as createSchoolConsents } from './migrations/0022_create_school_consents.js';
import { migration as createOperatorTotp } from './migrations/0080_create_operator_totp.js';
import { migration as createOperatorRecoveryCodes } from './migrations/0081_create_operator_recovery_codes.js';
import { migration as createParentOrgs } from './migrations/0090_create_parent_orgs.js';
import { migration as createKeyRotations } from './migrations/0030_create_key_rotations.js';
import { migration as createPlans } from './migrations/0040_create_plans.js';
import { migration as createBilling } from './migrations/0050_create_billing.js';
import { migration as createPlatformDashboard } from './migrations/0060_create_platform_dashboard.js';
import { migration as createBackupRuns } from './migrations/0070_create_backup_runs.js';
import { migration as addDatabaseLoginName } from './migrations/0100_add_database_login_name.js';
import { migration as addAiPlanLimits } from './migrations/0200_add_ai_plan_limits.js';
import { migration as createAiTokenUsage } from './migrations/0201_create_ai_token_usage.js';
import { migration as createPlanAiPricing } from './migrations/0202_create_plan_ai_pricing.js';
import { migration as createSchoolCatalog } from './migrations/0210_create_school_catalog.js';
import { migration as linkCatalogAndPlatformAccess } from './migrations/0211_link_catalog_and_platform_access.js';
import { migration as createPushKeys } from './migrations/0230_create_push_keys.js';
import { migration as addVideoPlanLimits } from './migrations/0240_add_video_plan_limits.js';

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
  // Khối 0080 đến 0089 của phần S8b
  '0080_create_operator_totp': createOperatorTotp,
  '0081_create_operator_recovery_codes': createOperatorRecoveryCodes,
  // Đơn vị cấp trên (S6): 0090 đến 0099
  '0090_create_parent_orgs': createParentOrgs,
  // Gói dịch vụ và giới hạn (S5a): 0040 đến 0049
  '0040_create_plans': createPlans,
  // Thu phí tự động (S5b): 0050 đến 0059
  '0050_create_billing': createBilling,
  // Bảng điều khiển nền tảng (S4): 0060 đến 0069
  '0060_create_platform_dashboard': createPlatformDashboard,
  // Khối 0070 đến 0079 của phần S7b
  '0070_create_backup_runs': createBackupRuns,
  // Khối 0100 đến 0109 của phần S9
  '0100_add_database_login_name': addDatabaseLoginName,
  // Trợ lý AI (DT-23 phần 23d): 0200 đến 0202
  '0200_add_ai_plan_limits': addAiPlanLimits,
  '0201_create_ai_token_usage': createAiTokenUsage,
  '0202_create_plan_ai_pricing': createPlanAiPricing,
  // Danh mục đơn vị toàn quốc, đăng nhập theo đơn vị, quyền quản trị nền tảng (DT-24): 0210 đến 0219
  '0210_create_school_catalog': createSchoolCatalog,
  '0211_link_catalog_and_platform_access': linkCatalogAndPlatformAccess,
  // Khóa VAPID của nền tảng cho thông báo đẩy (DT-26 phần 26b): 0230
  '0230_create_push_keys': createPushKeys,
  // Giới hạn lớp video của gói (DT-27 phần 27a): 0240
  '0240_add_video_plan_limits': addVideoPlanLimits,
};
