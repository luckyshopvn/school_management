import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối lớp học (máy chủ API) và danh bạ giáo viên (dịch vụ định danh) (P02-05, YCTD-44)
export type ClassStatus = 'active' | 'closed';
export type AssignmentRole = 'homeroom' | 'subject';

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
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
  status: ClassStatus;
  enrolled_count: number;
  staff: StaffAssignment[];
}

export interface ClassInput {
  org_unit_id: string;
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
}

export interface StaffDirectoryEntry {
  user_id: string;
  full_name: string;
  role_code: string;
}

export const ASSIGNMENT_ROLE_LABELS: Record<AssignmentRole, string> = {
  homeroom: 'Chủ nhiệm',
  subject: 'Bộ môn',
};

export const listClasses = (orgUnitId: string): Promise<ClassRecord[]> =>
  requestJson(`/api/v1/classes?org_unit_id=${orgUnitId}`);

export const createClass = (input: ClassInput): Promise<ClassRecord> =>
  requestJson('/api/v1/classes', { method: 'POST', body: JSON.stringify(input) });

export const updateClass = (
  classId: string,
  changes: Partial<Omit<ClassInput, 'org_unit_id'>> & { status?: ClassStatus },
): Promise<ClassRecord> =>
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
