import type { ClassAgeGroupKey, ClassStage } from '@school-management/shared';
import { downloadPost } from '../children/children-api.js';
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
  // Nhóm tuổi đang áp dụng; age_group_from_grade là lớp chưa chọn riêng, lấy theo bậc học
  age_group: ClassAgeGroupKey;
  age_group_from_grade: boolean;
  stage: ClassStage;
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

export interface ClassAssignmentRow {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  grade_name: string;
  org_unit_id: string;
  org_unit_name: string;
  staff_user_id: string;
  staff_name: string;
  assignment_role: AssignmentRole;
  subject_name: string | null;
  from_date: string;
}

export interface ClassAssignmentFilter {
  q?: string;
  org_unit_id?: string;
  assignment_role?: string;
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

export const exportClasses = (filter: ClassFilter, columns: string[]) =>
  downloadPost('/api/v1/classes/export', { ...cleaned(filter), columns }, 'danh-sach-lop.xlsx');

export const createClass = (input: ClassInput): Promise<ClassRecord> =>
  requestJson('/api/v1/classes', { method: 'POST', body: JSON.stringify(input) });

export const updateClass = (classId: string, changes: ClassChanges): Promise<ClassRecord> =>
  requestJson(`/api/v1/classes/${classId}`, { method: 'PATCH', body: JSON.stringify(changes) });

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

export const exportClassAssignments = (filter: ClassAssignmentFilter) =>
  downloadPost('/api/v1/class-assignments/export', cleaned(filter), 'phan-cong-phu-trach-lop.xlsx');
