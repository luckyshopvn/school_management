import type { SchoolLevelCode, SubjectAssessment, SubjectKind } from '@school-management/shared';
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
  order_no: number;
  status: 'active' | 'inactive';
}

export type SubjectInput = Pick<Subject, 'code' | 'name' | 'school_level' | 'kind' | 'assessment' | 'order_no'>;

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
  changes: Partial<Pick<Subject, 'name' | 'kind' | 'assessment' | 'order_no' | 'status'>>,
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
