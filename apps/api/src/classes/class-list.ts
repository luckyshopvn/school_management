import type { ClassAgeGroup, ClassStatus, OrgUnitType } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import {
  CLASS_AGE_GROUPS,
  CLASS_STAGE_LABELS,
  classAgeGroupLabel,
  type ClassStage,
  type SchoolLevelCode,
} from '@school-management/shared';
import { readSchoolLevel } from '../catalogs/school-level-fields.js';
import { isUuid } from '../common/request-fields.js';

// Danh sách lớp theo mục 2.1 "Hồ sơ lớp học" của Sở (DT-15 phần 15b, YCTD-111): bộ lọc mở rộng, cột và tệp Excel dùng
// chung cho lưới và xuất Excel. Lớp của Trường chính để trống cột Phân hiệu và Điểm trường; lớp của phân hiệu, điểm trường
// hiện tên đơn vị ở cột tương ứng
export const CLASS_STATUSES: ClassStatus[] = ['active', 'closed'];
export const CLASS_AGE_GROUP_KEYS = CLASS_AGE_GROUPS.map((group) => group.key) as ClassAgeGroup[];

export interface ClassListFilter {
  orgUnitId?: string;
  status?: ClassStatus;
  gradeLevel?: string;
  q?: string;
  ageGroup?: ClassAgeGroup;
  stage?: ClassStage;
  twoSessions?: boolean;
  boarding?: boolean;
  combined?: boolean;
  // Cấp của lớp (DT-19 phần 19b, YCTD-152)
  schoolLevel?: SchoolLevelCode;
}

function readYesNo(query: Record<string, unknown>, field: string, errors: FieldError[]): boolean | undefined {
  const value = query[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  errors.push({ field, message: 'Chọn true hoặc false' });
  return undefined;
}

function readText(query: Record<string, unknown>, field: string, errors: FieldError[], maximum: number) {
  const value = query[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return undefined;
  }
  return value.trim() || undefined;
}

// Đọc bộ lọc từ chuỗi truy vấn (lưới) hoặc thân yêu cầu (xuất Excel)
export function readClassListFilter(query: Record<string, unknown>, errors: FieldError[]): ClassListFilter {
  const orgUnitId = query.org_unit_id;
  if (orgUnitId !== undefined && orgUnitId !== null && orgUnitId !== '' && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const status = query.status;
  if (status !== undefined && status !== null && status !== '' && !CLASS_STATUSES.includes(status as ClassStatus)) {
    errors.push({ field: 'status', message: 'Trạng thái là active hoặc closed' });
  }
  const ageGroup = query.age_group;
  if (
    ageGroup !== undefined &&
    ageGroup !== null &&
    ageGroup !== '' &&
    !CLASS_AGE_GROUP_KEYS.includes(ageGroup as ClassAgeGroup)
  ) {
    errors.push({ field: 'age_group', message: 'Nhóm tuổi không có trong danh mục' });
  }
  const stage = query.stage;
  const isStage = (value: unknown): value is ClassStage =>
    typeof value === 'string' && Object.hasOwn(CLASS_STAGE_LABELS, value);
  if (stage !== undefined && stage !== null && stage !== '' && !isStage(stage)) {
    errors.push({ field: 'stage', message: 'Nhóm lớp là nhom_tre hoặc mau_giao' });
  }
  return {
    orgUnitId: isUuid(orgUnitId) ? orgUnitId : undefined,
    status: CLASS_STATUSES.includes(status as ClassStatus) ? (status as ClassStatus) : undefined,
    gradeLevel: readText(query, 'grade_level', errors, 50),
    q: readText(query, 'q', errors, 100),
    ageGroup: CLASS_AGE_GROUP_KEYS.includes(ageGroup as ClassAgeGroup) ? (ageGroup as ClassAgeGroup) : undefined,
    stage: isStage(stage) ? stage : undefined,
    twoSessions: readYesNo(query, 'two_sessions_per_day', errors),
    boarding: readYesNo(query, 'boarding', errors),
    combined: readYesNo(query, 'is_combined', errors),
    schoolLevel: readSchoolLevel(query, 'school_level', errors),
  };
}

// Dòng của lưới và tệp Excel; age_group là nhóm tuổi đang áp dụng (đã chọn ở lớp, hoặc theo bậc học). Lớp ngoài cấp Mầm non
// không có nhóm tuổi, nhóm lớp (YCTD-152)
export interface ClassListRow {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: OrgUnitType;
  code: string;
  name: string;
  grade_level: string;
  grade_name: string;
  age_group: ClassAgeGroup | null;
  age_group_from_grade: boolean;
  stage: ClassStage | null;
  school_level: SchoolLevelCode;
  curriculum_id: string | null;
  curriculum_name: string | null;
  sort_order: number | null;
  room_id: string | null;
  room_name: string | null;
  max_size: number;
  enrolled_count: number;
  homeroom_names: string;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_class_id: string | null;
  combined_into_name: string | null;
  boarding: boolean;
  status: ClassStatus;
}

export function matchesClassFilter(row: ClassListRow, filter: ClassListFilter): boolean {
  return (
    (filter.ageGroup === undefined || row.age_group === filter.ageGroup) &&
    (filter.stage === undefined || row.stage === filter.stage) &&
    (filter.twoSessions === undefined || row.two_sessions_per_day === filter.twoSessions) &&
    (filter.boarding === undefined || row.boarding === filter.boarding) &&
    (filter.combined === undefined || row.is_combined === filter.combined)
  );
}

const yes = (value: boolean) => (value ? 'Có' : '');

// Cột theo thứ tự cột của Sở; mã cột trùng mã cột của lưới ở cổng quản trị
export const CLASS_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: ClassListRow): string | number }> = [
  { id: 'branch', label: 'Phân hiệu', value: (row) => (row.org_unit_type === 'phan_hieu' ? row.org_unit_name : '') },
  { id: 'code', label: 'Mã lớp', value: (row) => row.code },
  { id: 'name', label: 'Tên lớp', value: (row) => row.name },
  { id: 'grade', label: 'Khối', value: (row) => row.grade_name },
  { id: 'stage', label: 'Nhóm lớp', value: (row) => (row.stage ? CLASS_STAGE_LABELS[row.stage] : '') },
  {
    id: 'nursery_group',
    label: 'Nhóm trẻ',
    value: (row) => (row.stage === 'nhom_tre' && row.age_group ? classAgeGroupLabel(row.age_group) : ''),
  },
  {
    id: 'age_group',
    label: 'Nhóm tuổi',
    value: (row) => (row.stage === 'mau_giao' && row.age_group ? classAgeGroupLabel(row.age_group) : ''),
  },
  { id: 'sort_order', label: 'Thứ tự', value: (row) => row.sort_order ?? '' },
  { id: 'homeroom', label: 'Giáo viên chủ nhiệm', value: (row) => row.homeroom_names },
  { id: 'enrolled', label: 'Số học sinh', value: (row) => row.enrolled_count },
  { id: 'two_sessions_per_day', label: 'Học 2 buổi/ngày', value: (row) => yes(row.two_sessions_per_day) },
  {
    id: 'mixed_age',
    label: 'Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi',
    value: (row) => (row.mixed_age_count ? `Ghép ${row.mixed_age_count} độ tuổi` : ''),
  },
  { id: 'is_combined', label: 'Lớp ghép', value: (row) => yes(row.is_combined) },
  { id: 'combined_into', label: 'Ghép vào lớp', value: (row) => row.combined_into_name ?? '' },
  { id: 'boarding', label: 'Lớp bán trú', value: (row) => yes(row.boarding) },
  { id: 'dissolved', label: 'Lớp giải thể', value: (row) => yes(row.status === 'closed') },
  {
    id: 'school_site',
    label: 'Điểm trường',
    value: (row) => (row.org_unit_type === 'diem_truong' ? row.org_unit_name : ''),
  },
  { id: 'room', label: 'Phòng học', value: (row) => row.room_name ?? '' },
  { id: 'max_size', label: 'Sĩ số tối đa', value: (row) => row.max_size },
];

// Cột hiện mặc định trên lưới (theo màn hình 2.1 của Sở, YCTD-117), dùng khi người xuất không gửi danh sách cột
export const DEFAULT_CLASS_EXPORT_COLUMNS = [
  'code',
  'name',
  'grade',
  'stage',
  'nursery_group',
  'age_group',
  'sort_order',
  'enrolled',
  'two_sessions_per_day',
  'is_combined',
  'combined_into',
  'boarding',
  'dissolved',
];

export function readExportColumns(
  body: Record<string, unknown> | undefined,
  available: Array<{ id: string }>,
  defaults: string[],
  errors: FieldError[],
): string[] {
  const raw = body?.columns;
  if (raw === undefined || raw === null) {
    return defaults;
  }
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.some((id) => !available.some((column) => column.id === id)) ||
    new Set(raw).size !== raw.length
  ) {
    errors.push({ field: 'columns', message: 'Danh sách cột không hợp lệ' });
    return defaults;
  }
  return raw as string[];
}
