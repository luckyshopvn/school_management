import type { SchoolLevelCode, SubjectAssessment, SubjectKind, SubjectOptionGroup } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Nền Tiểu học (DT-20 phần 20a, YCTD-158): môn học và hoạt động giáo dục, số tiết theo khối, phân công giảng dạy theo môn,
// môn tự chọn của học sinh
export interface Subject {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  kind: SubjectKind;
  assessment: SubjectAssessment;
  option_group: SubjectOptionGroup | null;
  order_no: number;
  status: 'active' | 'inactive';
}

export type SubjectInput = Pick<
  Subject,
  'code' | 'name' | 'school_level' | 'kind' | 'assessment' | 'option_group' | 'order_no'
>;

export interface CurriculumSubject {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  kind: SubjectKind;
  grade_level_code: string;
  periods_per_week: number;
  is_elective: boolean;
}

export interface ClassTeaching {
  class: {
    id: string;
    code: string;
    name: string;
    org_unit_id: string;
    grade_level: string;
    school_level: SchoolLevelCode;
  };
  curriculum: { id: string; code: string; name: string } | null;
  subjects: Array<
    CurriculumSubject & {
      assignment: { id: string; staff_user_id: string; staff_name: string; periods_per_week: number } | null;
    }
  >;
  planned_periods: number;
}

export interface TeacherLoad {
  staff_user_id: string;
  staff_name: string;
  total_periods: number;
  classes: number;
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const listSubjects = (level?: SchoolLevelCode): Promise<Subject[]> =>
  requestJson(`/api/v1/subjects${level ? `?school_level=${level}` : ''}`);
export const createSubject = (input: SubjectInput): Promise<Subject> =>
  requestJson('/api/v1/subjects', json('POST', input));
export const updateSubject = (
  id: string,
  changes: Partial<Pick<Subject, 'name' | 'kind' | 'assessment' | 'option_group' | 'order_no' | 'status'>>,
): Promise<Subject> => requestJson(`/api/v1/subjects/${id}`, json('PATCH', changes));
export const loadSubjectTemplate = (
  level: SchoolLevelCode,
): Promise<{ created_subjects: string[]; curriculum_id: string; created_periods: number }> =>
  requestJson('/api/v1/subjects/templates', json('POST', { school_level: level }));
export const listCurriculumSubjects = (curriculumId: string): Promise<CurriculumSubject[]> =>
  requestJson(`/api/v1/curricula/${curriculumId}/subjects`);
export const saveCurriculumSubjects = (
  curriculumId: string,
  subjects: Array<Pick<CurriculumSubject, 'subject_id' | 'grade_level_code' | 'periods_per_week' | 'is_elective'>>,
): Promise<CurriculumSubject[]> => requestJson(`/api/v1/curricula/${curriculumId}/subjects`, json('PUT', { subjects }));
export const readClassTeaching = (classId: string): Promise<ClassTeaching> =>
  requestJson(`/api/v1/teaching-assignments?class_id=${classId}`);
export const listTeacherLoads = (level: SchoolLevelCode): Promise<TeacherLoad[]> =>
  requestJson(`/api/v1/teaching-assignments/teachers?school_level=${level}`);
export const assignSubjectTeacher = (
  classId: string,
  input: { staff_user_id: string; subject_id: string; periods_per_week: number | null },
) =>
  requestJson(`/api/v1/classes/${classId}/staff-assignments`, json('POST', { ...input, assignment_role: 'subject' }));
export const readElectiveSubjects = (
  childId: string,
): Promise<{ subjects: Array<{ id: string; name: string }>; options: Array<{ id: string; name: string }> }> =>
  requestJson(`/api/v1/children/${childId}/elective-subjects`);
export const saveElectiveSubjects = (childId: string, subjectIds: string[]) =>
  requestJson(`/api/v1/children/${childId}/elective-subjects`, json('PUT', { subject_ids: subjectIds }));

// Nền THCS, THPT (DT-21 phần 21a, YCTD-167): tổ hợp môn, tổ hợp học sinh đăng ký, tổ bộ môn
export interface SubjectRef {
  id: string;
  code: string;
  name: string;
  option_group: SubjectOptionGroup | null;
}

export interface Combination {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  order_no: number;
  status: 'active' | 'inactive';
  subjects: SubjectRef[];
  student_count: number;
}

export interface ChildCombination {
  registration: {
    combination_id: string;
    combination_code: string;
    combination_name: string;
    status: 'pending' | 'approved';
    previous_combination_id: string | null;
  } | null;
  options: Combination[];
}

export interface SubjectTeam {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  status: 'active' | 'inactive';
  subjects: Array<{ id: string; code: string; name: string }>;
  members: Array<{ staff_user_id: string; staff_name: string; role: 'head' | 'member' }>;
}

export const listCombinations = (): Promise<Combination[]> => requestJson('/api/v1/subject-combinations');
export const createCombination = (input: {
  code: string;
  name: string;
  order_no: number;
  subject_ids: string[];
}): Promise<Combination> => requestJson('/api/v1/subject-combinations', json('POST', input));
export const updateCombination = (
  id: string,
  changes: { name?: string; status?: 'active' | 'inactive'; subject_ids?: string[] },
): Promise<Combination> => requestJson(`/api/v1/subject-combinations/${id}`, json('PATCH', changes));
export const listCombinationStudents = (
  id: string,
): Promise<Array<{ child_id: string; full_name: string; class_name: string | null; status: 'pending' | 'approved' }>> =>
  requestJson(`/api/v1/subject-combinations/${id}/students`);
export const readChildCombination = (childId: string): Promise<ChildCombination> =>
  requestJson(`/api/v1/children/${childId}/subject-combination`);
export const saveChildCombination = (childId: string, combinationId: string) =>
  requestJson(`/api/v1/children/${childId}/subject-combination`, json('PUT', { combination_id: combinationId }));
export const decideChildCombination = (childId: string, approve: boolean) =>
  requestJson(`/api/v1/children/${childId}/subject-combination/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
  });

export const listSubjectTeams = (): Promise<SubjectTeam[]> => requestJson('/api/v1/subject-teams');
export const createSubjectTeam = (input: {
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  subject_ids: string[];
}): Promise<SubjectTeam> => requestJson('/api/v1/subject-teams', json('POST', input));
export const updateSubjectTeam = (
  id: string,
  changes: { name?: string; status?: 'active' | 'inactive'; subject_ids?: string[] },
): Promise<SubjectTeam> => requestJson(`/api/v1/subject-teams/${id}`, json('PATCH', changes));
export const setSubjectTeamMember = (
  id: string,
  input: { org_unit_id: string; staff_user_id: string; role: 'head' | 'member' },
): Promise<SubjectTeam> => requestJson(`/api/v1/subject-teams/${id}/members`, json('PUT', input));
export const removeSubjectTeamMember = (id: string, staffUserId: string): Promise<SubjectTeam> =>
  requestJson(`/api/v1/subject-teams/${id}/members/${staffUserId}`, { method: 'DELETE' });
export const listSubjectTeamLoads = (
  id: string,
): Promise<Array<{ staff_user_id: string; staff_name: string; total_periods: number }>> =>
  requestJson(`/api/v1/subject-teams/${id}/loads`);
