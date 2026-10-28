import { hash, parseOptions, verify, type Options } from '@node-rs/argon2';
import type { FieldError } from '@school-management/server';

// Tham số argon2id tường minh (YCTD-311), không dựa vào mặc định của thư viện: mặc định là m=19 MiB, t=2, p=1 (mức tối thiểu
// OWASP). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 mức khuyến nghị thứ hai của RFC 9106: m=64 MiB, t=3, p=4, đo trên
// máy phát triển khoảng 75 ms mỗi lần băm (mục tiêu dưới 250 ms). Máy chủ yếu hơn thì hạ bằng biến môi trường PASSWORD_HASH_MEMORY_KIB,
// PASSWORD_HASH_TIME_COST, PASSWORD_HASH_PARALLELISM (đọc ở configuration.ts, đặt lúc khởi động) nhưng không thấp hơn mức tối thiểu OWASP
const ARGON2ID = 2;
export const MINIMUM_PASSWORD_HASH_MEMORY_KIB = 19_456;
export const MINIMUM_PASSWORD_HASH_TIME_COST = 2;

export interface PasswordHashParameters {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

export const DEFAULT_PASSWORD_HASH_PARAMETERS: PasswordHashParameters = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
};

let currentParameters: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS;

// Gọi một lần lúc dựng ứng dụng với tham số đã đọc từ cấu hình
export function configurePasswordHashing(parameters: PasswordHashParameters): void {
  if (
    parameters.memoryCost < MINIMUM_PASSWORD_HASH_MEMORY_KIB ||
    parameters.timeCost < MINIMUM_PASSWORD_HASH_TIME_COST ||
    parameters.parallelism < 1
  ) {
    throw new Error('Tham số băm mật khẩu thấp hơn mức tối thiểu (m=19456 KiB, t=2, p=1)');
  }
  currentParameters = { ...parameters };
}

export function passwordHashParameters(): PasswordHashParameters {
  return currentParameters;
}

function hashOptions(): Options {
  // Algorithm là const enum của thư viện, không nhập được khi biên dịch từng tệp; 2 là Argon2id
  return { ...passwordHashParameters(), algorithm: ARGON2ID as Options['algorithm'] };
}

// Băm mật khẩu bằng argon2id, mỗi mật khẩu có muối riêng (BM-02, XT-04)
export function hashPassword(password: string): Promise<string> {
  return hash(password, hashOptions());
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

// Giá trị băm cũ dùng tham số yếu hơn hiện hành (hoặc không phải argon2id) thì băm lại khi người dùng đăng nhập đúng (YCTD-311).
// Chuỗi không đọc được thì không băm lại, để lỗi dữ liệu không thành đổi mật khẩu âm thầm
export function passwordNeedsRehash(passwordHash: string): boolean {
  let parsed: ReturnType<typeof parseOptions>;
  try {
    parsed = parseOptions(passwordHash);
  } catch {
    return false;
  }
  const current = passwordHashParameters();
  return (
    Number(parsed.algorithm) !== ARGON2ID ||
    parsed.memoryCost < current.memoryCost ||
    parsed.timeCost < current.timeCost ||
    parsed.parallelism !== current.parallelism
  );
}

// Giá trị băm giả để thời gian phản hồi như nhau khi không tìm thấy tài khoản
let placeholderHash: Promise<string> | undefined;
export function placeholderPasswordHash(): Promise<string> {
  placeholderHash ??= hashPassword('mat-khau-gia-de-can-thoi-gian-1');
  return placeholderHash;
}

// Mật khẩu tối thiểu 8 ký tự, có cả chữ và số (BM-03)
export const MINIMUM_PASSWORD_LENGTH = 8;

// Độ dài tối thiểu riêng từng trường (DT-SaaS phần S8b): trường đặt ở chính sách mật khẩu, mặc định 8
export function checkPasswordPolicy(
  field: string,
  password: string,
  minimumLength = MINIMUM_PASSWORD_LENGTH,
): FieldError[] {
  const errors: FieldError[] = [];
  if (password.length < minimumLength) {
    errors.push({ field, message: `Mật khẩu phải có ít nhất ${minimumLength} ký tự` });
  }
  if (!/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) {
    errors.push({ field, message: 'Mật khẩu phải có cả chữ và số' });
  }
  return errors;
}
