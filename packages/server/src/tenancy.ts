// Phần dùng chung của nền tảng nhiều trường (DT-SaaS phần S1a), không phụ thuộc NestJS nên gói cơ sở dữ liệu và tiến trình nền
// import được qua đường dẫn con `@school-management/server/tenancy`
export { decryptSecret, encryptSecret } from './secret-encryption.js';
export {
  currentTenant,
  enterSchool,
  isMultiTenantMode,
  requireTenant,
  runAsSchool,
  setMultiTenantMode,
  TenantContextMissingError,
  type SchoolDataClass,
  type SchoolStatus,
  type TenantContext,
  type TenantPlan,
} from './tenant-context.js';
export { DEFAULT_RESERVED_SCHOOL_CODES, SCHOOL_CODE_PATTERN, validateSchoolCode } from './school-code.js';
export {
  EDGE_AUTH_HEADER,
  extractTenantHost,
  normalizeHost,
  parseTenantHostSource,
  secretsEqual,
  type HostHeaders,
  type TenantHostSource,
} from './tenant-host.js';
export {
  createTenantMiddleware,
  DEFAULT_TENANT_FREE_PATHS,
  type TenantMiddlewareOptions,
  type TenantResolver,
} from './tenant-middleware.js';
export {
  createSchoolReadOnlyMiddleware,
  isApiWriteAllowedWhenReadOnly,
  isIdentityWriteAllowedWhenReadOnly,
  type ReadOnlyMiddlewareOptions,
} from './school-plan-middleware.js';
