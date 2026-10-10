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
  CatalogStatus,
  ChildGender,
  ChildStatus,
  ClassStatus,
  FilePurpose,
  ImportStatus,
  ImportType,
  OrgUnitStatus,
  OrgUnitType,
  PhotoConsent,
  PhotoConsentMethod,
  PickupConfirmationStatus,
  PickupPersonKind,
  PickupType,
  SchoolYearDatabase,
} from '../school-year/schema.js';
