import type { FieldError } from '@school-management/server';
import { isNationalIdShaped, nationalIdProblem, ROLE_CODES_RESERVED_FOR_PRINCIPAL } from '@school-management/shared';

// Quy tắc tài khoản trường theo số CCCD (YCTD-311); phần kiểm thuần ở gói dùng chung
export { isNationalIdShaped, maskLoginIdentifier } from '@school-management/shared';

export function checkNationalId(field: string, value: string, birthYear?: number | null): FieldError[] {
  const problem = nationalIdProblem(value, birthYear);
  return problem ? [{ field, message: problem }] : [];
}

// Loại tài khoản (YCTD-311): cùng một số CCCD có thể vừa là cán bộ, giáo viên vừa là phụ huynh; ứng dụng đang đăng nhập (kênh)
// quyết định loại phiên. Cán bộ và giáo viên dùng cổng quản trị (portal) và ứng dụng giáo viên (teacher)
export type AccountKind = 'staff' | 'parent' | 'student';

export const PARENT_ROLE_CODE = 'VT-14';

export function accountKindsOf(roleCodes: readonly string[], studentRoleCode: string): Set<AccountKind> {
  const kinds = new Set<AccountKind>();
  for (const code of roleCodes) {
    if (code === PARENT_ROLE_CODE) {
      kinds.add('parent');
    } else if (code === studentRoleCode) {
      kinds.add('student');
    } else {
      kinds.add('staff');
    }
  }
  return kinds;
}

export function kindForChannel(channel: 'portal' | 'teacher' | 'parent' | 'student'): AccountKind {
  return channel === 'parent' ? 'parent' : channel === 'student' ? 'student' : 'staff';
}

// Tài khoản quản trị trường (Hiệu trưởng, quản trị; YCTD-314, Eric chốt ngày 2026-10-28): luôn đủ số CCCD (làm tên đăng nhập), họ
// tên, số điện thoại; áp khi tạo tài khoản có vai trò này và khi gán vai trò này cho tài khoản đã có
export function isSchoolAdminRole(roleCode: string): boolean {
  return (ROLE_CODES_RESERVED_FOR_PRINCIPAL as readonly string[]).includes(roleCode);
}

export function schoolAdminIdentityProblems(account: {
  fullName: string | null | undefined;
  phone: string | null | undefined;
  username: string | null | undefined;
}): FieldError[] {
  const problems: FieldError[] = [];
  if (!account.username || !isNationalIdShaped(account.username) || nationalIdProblem(account.username)) {
    problems.push({ field: 'national_id', message: 'Tài khoản quản trị trường bắt buộc có số CCCD (12 chữ số)' });
  }
  if (!account.fullName?.trim()) {
    problems.push({ field: 'full_name', message: 'Tài khoản quản trị trường bắt buộc có họ tên' });
  }
  if (!account.phone) {
    problems.push({ field: 'phone', message: 'Tài khoản quản trị trường bắt buộc có số điện thoại' });
  }
  return problems;
}
