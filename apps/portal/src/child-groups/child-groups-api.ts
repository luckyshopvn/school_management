import { requestJson } from '../session/api-client.js';

// Gọi các điểm cuối nhóm học sinh (YCTD-102)
export interface ChildGroup {
  id: string;
  org_unit_id: string;
  name: string;
  description: string | null;
  teacher_staff_id: string | null;
  teacher_name: string | null;
  status: 'active' | 'inactive';
  member_count: number;
  can_manage: boolean;
}

export interface ChildGroupDetail extends ChildGroup {
  members: Array<{
    child_id: string;
    full_name: string;
    dob: string;
    class_id: string | null;
    class_name: string | null;
  }>;
}

export interface ClassChild {
  id: string;
  full_name: string;
  class_name: string | null;
}

export const listChildGroups = (orgUnitId: string): Promise<ChildGroup[]> =>
  requestJson(`/api/v1/child-groups${orgUnitId ? `?org_unit_id=${orgUnitId}` : ''}`);
export const readChildGroup = (groupId: string): Promise<ChildGroupDetail> =>
  requestJson(`/api/v1/child-groups/${groupId}`);
export const createChildGroup = (input: {
  org_unit_id: string;
  name: string;
  description: string | null;
  teacher_staff_id: string | null;
}): Promise<ChildGroupDetail> => requestJson('/api/v1/child-groups', { method: 'POST', body: JSON.stringify(input) });
export const addGroupMembers = (groupId: string, childIds: string[]): Promise<ChildGroupDetail> =>
  requestJson(`/api/v1/child-groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ child_ids: childIds }),
  });
export const removeGroupMembers = (groupId: string, childIds: string[]): Promise<ChildGroupDetail> =>
  requestJson(`/api/v1/child-groups/${groupId}/members/remove`, {
    method: 'POST',
    body: JSON.stringify({ child_ids: childIds }),
  });
// Trẻ đang học của một lớp để chọn nhiều trẻ thêm vào nhóm
export const listClassChildren = async (orgUnitId: string, classId: string): Promise<ClassChild[]> =>
  (
    await requestJson<{ items: ClassChild[] }>(
      `/api/v1/children?org_unit_id=${orgUnitId}&class_id=${classId}&status=active&page_size=100`,
    )
  ).items;
