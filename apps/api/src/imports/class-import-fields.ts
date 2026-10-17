import type { ClassAgeGroup } from '@school-management/database';
import { CLASS_AGE_GROUPS, classStageOf } from '@school-management/shared';
import type { RowError } from './excel.js';
import { foldText } from './moet-columns.js';

// Cột thông tin lớp theo Sở của 2.2 Nhập lớp học từ Excel (DT-16 phần 16e, khảo sát mục 3.2 dòng 2.2): nhóm tuổi, thứ tự,
// học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, ghép vào lớp, lớp bán trú như 2.1 Hồ sơ lớp học. Hàm thuần,
// không đọc cơ sở dữ liệu; ô trống là không có (cờ là Không, nhóm tuổi là theo bậc học)
export const CLASS_SO_IMPORT_COLUMNS = [
  { key: 'age_group', header: 'Nhóm tuổi', note: 'Tên hoặc mã trong danh mục Nhóm tuổi; để trống là theo bậc học' },
  { key: 'sort_order', header: 'Thứ tự', note: 'Số nguyên từ 0 đến 9999, không bắt buộc' },
  { key: 'two_sessions_per_day', header: 'Học 2 buổi/ngày', note: 'Có hoặc Không (để trống là Không)' },
  {
    key: 'mixed_age_count',
    header: 'Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi',
    note: 'Ghi 2 hoặc 3 với lớp mẫu giáo ghép độ tuổi, để trống nếu không ghép',
  },
  { key: 'is_combined', header: 'Lớp ghép', note: 'Có hoặc Không (để trống là Không)' },
  {
    key: 'combined_into_code',
    header: 'Ghép vào lớp',
    note: 'Mã lớp đang dùng của cùng đơn vị mà lớp này ghép vào; chỉ ghi khi là lớp ghép',
  },
  { key: 'boarding', header: 'Lớp bán trú', note: 'Có hoặc Không (để trống là Không)' },
] as const;

export type ClassSoImportKey = (typeof CLASS_SO_IMPORT_COLUMNS)[number]['key'];

export interface ClassSoValues {
  age_group: ClassAgeGroup | null;
  sort_order: number | null;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_code: string | null;
  boarding: boolean;
}

const YES = new Set(['co', 'x', '1', 'true']);
const NO = new Set(['khong', '0', 'false', '']);

// Nhóm tuổi nhận mã (years_3_4) hoặc tên ("3–4 tuổi", "3-4 tuổi")
export function parseAgeGroup(text: string): ClassAgeGroup | null | undefined {
  const folded = foldText(text)
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-');
  if (folded === '') {
    return null;
  }
  const found = CLASS_AGE_GROUPS.find(
    (group) =>
      group.key === folded ||
      foldText(group.label)
        .replace(/[–—]/g, '-')
        .replace(/\s*-\s*/g, '-') === folded,
  );
  return found ? (found.key as ClassAgeGroup) : undefined;
}

function parseFlag(text: string): boolean | undefined {
  const folded = foldText(text);
  if (YES.has(folded)) {
    return true;
  }
  return NO.has(folded) ? false : undefined;
}

// Đọc các cột được chọn; cột không chọn trả undefined để lớp đã có giữ nguyên. Lỗi ghi theo dòng, theo tiêu đề cột
export function readClassSoValues(
  row: number,
  values: Record<string, string | undefined>,
  selected: Set<string>,
  errors: RowError[],
): Partial<ClassSoValues> {
  const result: Partial<ClassSoValues> = {};
  const text = (key: ClassSoImportKey) => (values[key] ?? '').trim();
  if (selected.has('age_group')) {
    const ageGroup = parseAgeGroup(text('age_group'));
    if (ageGroup === undefined) {
      errors.push({ row, column: header('age_group'), message: 'Nhóm tuổi không có trong danh mục' });
    } else {
      result.age_group = ageGroup;
    }
  }
  if (selected.has('sort_order')) {
    const value = text('sort_order');
    const number = Number(value);
    if (value === '') {
      result.sort_order = null;
    } else if (!Number.isInteger(number) || number < 0 || number > 9999) {
      errors.push({ row, column: header('sort_order'), message: 'Số nguyên từ 0 đến 9999' });
    } else {
      result.sort_order = number;
    }
  }
  if (selected.has('mixed_age_count')) {
    const value = text('mixed_age_count');
    if (value === '') {
      result.mixed_age_count = null;
    } else if (value === '2' || value === '3') {
      result.mixed_age_count = Number(value);
    } else {
      errors.push({ row, column: header('mixed_age_count'), message: 'Ghi 2 hoặc 3, hoặc để trống' });
    }
  }
  for (const key of ['two_sessions_per_day', 'is_combined', 'boarding'] as const) {
    if (!selected.has(key)) {
      continue;
    }
    const flag = parseFlag(text(key));
    if (flag === undefined) {
      errors.push({ row, column: header(key), message: 'Ghi Có hoặc Không' });
    } else {
      result[key] = flag;
    }
  }
  if (selected.has('combined_into_code')) {
    result.combined_into_code = text('combined_into_code') || null;
  }
  return result;
}

// Ràng buộc như 2.1 Hồ sơ lớp học (YCTD-111): chỉ lớp mẫu giáo ghép 2 hoặc 3 độ tuổi; chỉ lớp ghép mới ghi lớp ghép vào
export function checkClassSoRules(
  row: number,
  merged: {
    age_group: ClassAgeGroup;
    mixed_age_count: number | null;
    is_combined: boolean;
    combined_into_code: string | null;
  },
  errors: RowError[],
): void {
  if (merged.mixed_age_count !== null && classStageOf(merged.age_group) !== 'mau_giao') {
    errors.push({ row, column: header('mixed_age_count'), message: 'Chỉ lớp mẫu giáo mới ghép 2 hoặc 3 độ tuổi' });
  }
  if (merged.combined_into_code && !merged.is_combined) {
    errors.push({ row, column: header('combined_into_code'), message: 'Chỉ ghi lớp ghép vào khi là lớp ghép' });
  }
}

function header(key: ClassSoImportKey): string {
  return CLASS_SO_IMPORT_COLUMNS.find((column) => column.key === key)?.header ?? key;
}

// Ghi ra tệp mẫu kèm dữ liệu theo cách đọc ở trên
export function classSoTemplateValues(row: {
  age_group: ClassAgeGroup | null;
  sort_order: number | null;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_code: string | null;
  boarding: boolean;
}): Record<ClassSoImportKey, string | number> {
  const flag = (value: boolean) => (value ? 'Có' : 'Không');
  return {
    age_group: row.age_group ? (CLASS_AGE_GROUPS.find((group) => group.key === row.age_group)?.label ?? '') : '',
    sort_order: row.sort_order ?? '',
    two_sessions_per_day: flag(row.two_sessions_per_day),
    mixed_age_count: row.mixed_age_count ?? '',
    is_combined: flag(row.is_combined),
    combined_into_code: row.combined_into_code ?? '',
    boarding: flag(row.boarding),
  };
}
