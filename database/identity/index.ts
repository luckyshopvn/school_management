import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createAccountTables } from './migrations/0002_create_account_tables.js';
import { migration as seedRolesAndPermissions } from './migrations/0003_seed_roles_and_permissions.js';
import { migration as addAcademicYearPermission } from './migrations/0004_add_academic_year_permission.js';
import { migration as addOrgUnitPermission } from './migrations/0005_add_org_unit_permission.js';
import { migration as addAccountManagement } from './migrations/0006_add_account_management.js';
import { migration as addIdentitySettings } from './migrations/0007_add_identity_settings.js';
import { migration as addCatalogPermissions } from './migrations/0008_add_catalog_permissions.js';
import { migration as addParentSignIn } from './migrations/0009_add_parent_sign_in.js';
import { migration as addClassPermission } from './migrations/0010_add_class_permission.js';
import { migration as addChildPermissions } from './migrations/0011_add_child_permissions.js';
import { migration as addImportPermission } from './migrations/0012_add_import_permission.js';
import { migration as addAttendancePermission } from './migrations/0013_add_attendance_permission.js';
import { migration as addPickupPermissions } from './migrations/0014_add_pickup_permissions.js';
import { migration as addFeeCatalogPermissions } from './migrations/0015_add_fee_catalog_permissions.js';
import { migration as addRegistrationPermissions } from './migrations/0016_add_registration_permissions.js';
import { migration as addFeeCalculationPermission } from './migrations/0017_add_fee_calculation_permission.js';
import { migration as addDiscountPermissions } from './migrations/0018_add_discount_permissions.js';
import { migration as addReceiptPermissions } from './migrations/0019_add_receipt_permissions.js';
import { migration as addReversalAndOpeningDebtPermissions } from './migrations/0020_add_reversal_and_opening_debt_permissions.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu định danh, theo số thứ tự (QU-01)
export const identityMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_account_tables': createAccountTables,
  '0003_seed_roles_and_permissions': seedRolesAndPermissions,
  '0004_add_academic_year_permission': addAcademicYearPermission,
  '0005_add_org_unit_permission': addOrgUnitPermission,
  '0006_add_account_management': addAccountManagement,
  '0007_add_identity_settings': addIdentitySettings,
  '0008_add_catalog_permissions': addCatalogPermissions,
  '0009_add_parent_sign_in': addParentSignIn,
  '0010_add_class_permission': addClassPermission,
  '0011_add_child_permissions': addChildPermissions,
  '0012_add_import_permission': addImportPermission,
  '0013_add_attendance_permission': addAttendancePermission,
  '0014_add_pickup_permissions': addPickupPermissions,
  '0015_add_fee_catalog_permissions': addFeeCatalogPermissions,
  '0016_add_registration_permissions': addRegistrationPermissions,
  '0017_add_fee_calculation_permission': addFeeCalculationPermission,
  '0018_add_discount_permissions': addDiscountPermissions,
  '0019_add_receipt_permissions': addReceiptPermissions,
  '0020_add_reversal_and_opening_debt_permissions': addReversalAndOpeningDebtPermissions,
};
