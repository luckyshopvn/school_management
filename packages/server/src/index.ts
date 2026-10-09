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
export { ErrorFilter } from './error.filter.js';
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
