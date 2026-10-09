import { hash, verify } from '@node-rs/argon2';
import type { FieldError } from '@school-management/server';

// Băm mật khẩu bằng argon2id, mỗi mật khẩu có muối riêng (BM-02, XT-04)
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

// Giá trị băm giả để thời gian phản hồi như nhau khi không tìm thấy tài khoản
let placeholderHash: Promise<string> | undefined;
export function placeholderPasswordHash(): Promise<string> {
  placeholderHash ??= hashPassword('mat-khau-gia-de-can-thoi-gian-1');
  return placeholderHash;
}

// Mật khẩu tối thiểu 8 ký tự, có cả chữ và số (BM-03)
export const MINIMUM_PASSWORD_LENGTH = 8;

export function checkPasswordPolicy(field: string, password: string): FieldError[] {
  const errors: FieldError[] = [];
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    errors.push({ field, message: `Mật khẩu phải có ít nhất ${MINIMUM_PASSWORD_LENGTH} ký tự` });
  }
  if (!/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) {
    errors.push({ field, message: 'Mật khẩu phải có cả chữ và số' });
  }
  return errors;
}
