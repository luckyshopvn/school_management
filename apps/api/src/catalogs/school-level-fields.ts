import type { FieldError } from '@school-management/server';
import { isSchoolLevelCode, type SchoolLevelCode } from '@school-management/shared';

// Đọc mã cấp học ở thân yêu cầu hoặc chuỗi truy vấn (DT-19 phần 19b, YCTD-152); trống trả undefined để nơi gọi chọn mặc định
export const STRUCTURE_RULE_CODE = 'YCTD-152';

export function readSchoolLevel(
  source: Record<string, unknown> | undefined,
  field: string,
  errors: FieldError[],
): SchoolLevelCode | undefined {
  const value = source?.[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (!isSchoolLevelCode(value)) {
    errors.push({ field, message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    return undefined;
  }
  return value;
}
