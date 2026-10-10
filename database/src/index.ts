export { createDatabase } from './connection.js';
export {
  createEmptyDatabase,
  dropDatabaseIfExists,
  listDatabasesWithPrefix,
  makeDatabaseReadOnly,
} from './database-administration.js';
export { readConnectionString, replaceDatabaseName, type ServiceDatabaseKind } from './environment.js';
export { migrateToLatest, type DatabaseKind } from './migrate.js';
export type { IdentityDatabase, LoginMethod, SessionChannel, UserStatus } from '../identity/schema.js';
export type {
  AcademicTermType,
  AcademicYearDatabaseStatus,
  AcademicYearStatus,
  SystemDatabase,
} from '../system/schema.js';
export type {
  ApprovalThresholdStatus,
  AssignmentRole,
  AssignmentStatus,
  AttendanceSource,
  AttendanceStatus,
  AuditLogsTable,
  CashflowType,
  CatalogStatus,
  ChildGender,
  ChildStatus,
  ClassStatus,
  DiscountCalculationMethod,
  FeeDocumentStatus,
  FeeType,
  FilePurpose,
  ImportStatus,
  ImportType,
  InvoiceKind,
  InvoiceStatus,
  LateChargeMethod,
  OrgUnitStatus,
  OrgUnitType,
  PhotoConsent,
  PhotoConsentMethod,
  PickupConfirmationStatus,
  PickupPersonKind,
  PickupType,
  RegistrationSource,
  RegistrationStatus,
  SchoolYearDatabase,
  ServiceCalculationMethod,
} from '../school-year/schema.js';
export { MEAL_SERVICE_ID } from '../school-year/migrations/0010_create_fee_catalogs.js';
