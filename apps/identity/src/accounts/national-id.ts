import type { FieldError } from '@school-management/server';
import { nationalIdProblem } from '@school-management/shared';

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
