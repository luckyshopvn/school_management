// Mã dùng chung của hai dịch vụ máy chủ; giao diện không được dùng gói này (YCTD-36)
export {
  ApplicationError,
  ruleViolationError,
  STATUS_BY_ERROR_CODE,
  unauthenticatedError,
  validationError,
  type ErrorCode,
  type FieldError,
} from './application-error.js';
export { ErrorFilter, setServerErrorListener, type ServerErrorReport } from './error.filter.js';
export { Clock, SystemClock } from './clock.js';
export {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  AccessTokenVerifier,
  decodeBase64Key,
  readBearerToken,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  TOKEN_SIGNING_ALGORITHM,
  type AccessTokenClaims,
  type SessionChannel,
} from './access-token.js';
export {
  PARENT_ORG_TOKEN_AUDIENCE,
  PARENT_ORG_TOKEN_KIND,
  PARENT_ORG_TOKEN_LIFETIME_SECONDS,
  ParentOrgTokenVerifier,
} from './parent-org-token.js';
export {
  ESMS_SEND_URL,
  EsmsClient,
  normalizeVietnamesePhone,
  readEsmsSettings,
  readSmsProviderSettings,
  removeVietnameseDiacritics,
  type EsmsSettings,
  type SmsProviderSettings,
} from './esms-client.js';
export { applyTrustProxy, parseTrustProxy } from './trust-proxy.js';
export * from './tenancy.js';
export * from './totp.js';
export * from './security-headers.js';
