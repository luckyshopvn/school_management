import type { SchoolLevelCode, SchoolLevelView } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Cấp học của trường (máy chủ API) và phạm vi cấp học của tài khoản (dịch vụ định danh), DT-19 phần 19a
export interface SchoolLevelListItem extends SchoolLevelView {
  class_count: number;
}

export interface SchoolLevelList {
  levels: SchoolLevelListItem[];
  user_levels: SchoolLevelCode[];
}

export type SchoolLevelInput = Pick<
  SchoolLevelView,
  'code' | 'is_enabled' | 'order_no' | 'display_name' | 'learner_term' | 'context_label'
>;

export function listSchoolLevels(): Promise<SchoolLevelList> {
  return requestJson('/api/v1/school-levels');
}

export function saveSchoolLevels(levels: SchoolLevelInput[]): Promise<SchoolLevelList> {
  return requestJson('/api/v1/school-levels', { method: 'PUT', body: JSON.stringify({ levels }) });
}

export function readUserSchoolLevels(userId: string): Promise<{ school_levels: SchoolLevelCode[] }> {
  return requestJson(`/api/v1/users/${userId}/school-levels`);
}

export function saveUserSchoolLevels(
  userId: string,
  schoolLevels: SchoolLevelCode[],
): Promise<{ school_levels: SchoolLevelCode[] }> {
  return requestJson(`/api/v1/users/${userId}/school-levels`, {
    method: 'PUT',
    body: JSON.stringify({ school_levels: schoolLevels }),
  });
}
