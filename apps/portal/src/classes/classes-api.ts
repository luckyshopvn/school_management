import type { ClassAgeGroupKey, ClassStage, SchoolLevelCode } from '@school-management/shared';
import { downloadPost } from '../children/children-api.js';
import type { ExportFormat } from '../exports/export-api.js';
import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối lớp học (máy chủ API) và danh bạ giáo viên (dịch vụ định danh) (P02-05, YCTD-44); thông tin lớp, bộ
// lọc, xuất Excel và phân công phụ trách lớp theo Sở (DT-15 phần 15b, YCTD-111)
export type ClassStatus = 'active' | 'closed';
export type AssignmentRole = 'homeroom' | 'subject';
export type OrgUnitKind = 'truong_chinh' | 'phan_hieu' | 'diem_truong';

export interface StaffAssignment {
  id: string;
  class_id: string;
  staff_user_id: string;
  staff_name: string;
  assignment_role: AssignmentRole;
  subject_name: string | null;
  from_date: string;
  to_date: string | null;
  status: 'active' | 'ended';
}

export interface ClassRecord {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: OrgUnitKind;
  code: string;
  name: string;
  grade_level: string;
  grade_name: string;
  // Nhóm tuổi đang áp dụng; age_group_from_grade là lớp chưa chọn riêng, lấy theo bậc học. Lớp ngoài cấp Mầm non không có
  // nhóm tuổi, nhóm lớp; cấp lấy theo khối, chương trình trống là mặc định của cấp (DT-19 phần 19b, YCTD-152)
  age_group: ClassAgeGroupKey | null;
  age_group_from_grade: boolean;
  stage: ClassStage | null;
  school_level: SchoolLevelCode;
  curriculum_id: string | null;
  curriculum_name: string | null;
  sort_order: number | null;
  room_id: string | null;
  room_name: string | null;
  max_size: number;
  status: ClassStatus;
  enrolled_count: number;
  homeroom_names: string;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_class_id: string | null;
  combined_into_name: string | null;
  boarding: boolean;
  staff: StaffAssignment[];
}

export interface ClassInput {
  org_unit_id: string;
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
  age_group: ClassAgeGroupKey | null;
  sort_order: number | null;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_class_id: string | null;
  boarding: boolean;
  curriculum_id?: string | null;
}

export type ClassChanges = Partial<Omit<ClassInput, 'org_unit_id'>> & { status?: ClassStatus };

// Bộ lọc của lưới; chuỗi rỗng là không lọc
export interface ClassFilter {
  q?: string;
  org_unit_id?: string;
  grade_level?: string;
  status?: string;
  stage?: string;
  age_group?: string;
  two_sessions_per_day?: string;
  boarding?: string;
  is_combined?: string;
}

export interface StaffDirectoryEntry {
  user_id: string;
  full_name: string;
  role_code: string;
}

// Dòng của giáo viên chưa phân công (DT-16 phần 16e) để trống lớp, vai trò, ngày
export interface ClassAssignmentRow {
  id: string;
  class_id: string | null;
  class_code: string;
  class_name: string;
  grade_name: string;
  org_unit_id: string;
  org_unit_name: string;
  staff_user_id: string;
  staff_name: string;
  assignment_role: AssignmentRole | null;
  subject_name: string | null;
  from_date: string | null;
}

export interface ClassAssignmentFilter {
  q?: string;
  org_unit_id?: string;
  assignment_role?: string;
  // Tình trạng phân công: assigned, unassigned; trống là cả hai
  assignment?: string;
}

// Kết quả xóa lớp, thao tác hàng loạt (DT-16 phần 16e)
export interface BulkClassResult {
  succeeded: Array<{ id: string; name: string }>;
  failed: Array<{ id: string; name: string; message: string }>;
}

export const ASSIGNMENT_ROLE_LABELS: Record<AssignmentRole, string> = {
  homeroom: 'Chủ nhiệm',
  subject: 'Bộ môn',
};

function cleaned(filter: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filter).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );
}

// Lớp của một đơn vị, dùng ở các màn hình chọn lớp
export const listClasses = (orgUnitId: string): Promise<ClassRecord[]> =>
  requestJson(`/api/v1/classes?org_unit_id=${orgUnitId}`);

// Danh sách lớp theo bộ lọc của lưới Hồ sơ lớp học
export const searchClasses = (filter: ClassFilter = {}): Promise<ClassRecord[]> => {
  const parameters = new URLSearchParams(cleaned(filter)).toString();
  return requestJson(`/api/v1/classes${parameters ? `?${parameters}` : ''}`);
};

export const exportClasses = (filter: ClassFilter, columns: string[], format: ExportFormat = 'xlsx') =>
  downloadPost('/api/v1/classes/export', { ...cleaned(filter), columns, format }, `danh-sach-lop.${format}`);

export const createClass = (input: ClassInput): Promise<ClassRecord> =>
  requestJson('/api/v1/classes', { method: 'POST', body: JSON.stringify(input) });

export const updateClass = (classId: string, changes: ClassChanges): Promise<ClassRecord> =>
  requestJson(`/api/v1/classes/${classId}`, { method: 'PATCH', body: JSON.stringify(changes) });

// Xóa lớp chưa phát sinh dữ liệu và thao tác hàng loạt trên các lớp đã chọn (DT-16 phần 16e)
export const deleteClasses = (classIds: string[]): Promise<BulkClassResult> =>
  requestJson('/api/v1/classes/delete', { method: 'POST', body: JSON.stringify({ class_ids: classIds }) });

export const bulkUpdateClasses = (
  classIds: string[],
  changes: { status?: ClassStatus; two_sessions_per_day?: boolean; boarding?: boolean },
): Promise<BulkClassResult> =>
  requestJson('/api/v1/classes/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ class_ids: classIds, ...changes }),
  });

export const listAssignments = (classId: string): Promise<StaffAssignment[]> =>
  requestJson(`/api/v1/classes/${classId}/staff-assignments`);

export const addAssignment = (
  classId: string,
  input: { staff_user_id: string; assignment_role: AssignmentRole; subject_name: string | null },
): Promise<StaffAssignment> =>
  requestJson(`/api/v1/classes/${classId}/staff-assignments`, { method: 'POST', body: JSON.stringify(input) });

export const endAssignment = (classId: string, assignmentId: string): Promise<StaffAssignment> =>
  requestJson(`/api/v1/classes/${classId}/staff-assignments/${assignmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ended' }),
  });

export const listStaff = (roleCode: string, orgUnitId: string): Promise<StaffDirectoryEntry[]> =>
  requestJson(`/api/v1/users/directory?role_code=${roleCode}&org_unit_id=${orgUnitId}`);

// 3.3 Phân công phụ trách lớp
export const listClassAssignments = (filter: ClassAssignmentFilter = {}): Promise<ClassAssignmentRow[]> => {
  const parameters = new URLSearchParams(cleaned(filter)).toString();
  return requestJson(`/api/v1/class-assignments${parameters ? `?${parameters}` : ''}`);
};

export const exportClassAssignments = (filter: ClassAssignmentFilter, format: ExportFormat = 'xlsx') =>
  downloadPost('/api/v1/class-assignments/export', { ...cleaned(filter), format }, `phan-cong-phu-trach-lop.${format}`);
