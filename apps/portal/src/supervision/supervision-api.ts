import { requestJson } from '../session/api-client.js';

// Gọi các điểm cuối danh mục nội quy, khu vực, phân công giám thị trực (YCTD-391, lát L1)
export type SupervisionLevel = 'TH' | 'THCS' | 'THPT';
export type RuleKind = 'violation' | 'commendation';
export type ParentNotice = 'none' | 'immediate' | 'daily_digest';
export type RecordStatus = 'active' | 'inactive';

export const KIND_LABELS: Record<RuleKind, string> = { violation: 'Vi phạm', commendation: 'Khen' };
export const NOTICE_LABELS: Record<ParentNotice, string> = {
  none: 'Không báo',
  immediate: 'Báo ngay',
  daily_digest: 'Gộp tin cuối ngày',
};
export const WEEKDAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

export interface SchoolZone {
  id: string;
  name: string;
  description: string | null;
  order_no: number;
  status: RecordStatus;
}

export interface RuleItem {
  id: string;
  code: string;
  name: string;
  kind: RuleKind;
  school_level: SupervisionLevel;
  parent_notice: ParentNotice;
  class_criterion_id: string | null;
  class_criterion_name: string | null;
  class_criterion_points: number | null;
  order_no: number;
  status: RecordStatus;
}

export interface StaffOption {
  id: string;
  full_name: string;
}

export interface SupervisionAssignment {
  id: string;
  staff_id: string;
  staff_name: string;
  school_level: SupervisionLevel;
  grade_levels: string[];
  zone_ids: string[];
  weekdays: number[];
  start_time: string;
  end_time: string;
  from_date: string | null;
  to_date: string | null;
  note: string | null;
  status: RecordStatus;
  updated_by_name: string | null;
}

export interface AssignmentInput {
  staff_id: string;
  school_level: SupervisionLevel;
  grade_levels: string[];
  zone_ids: string[];
  weekdays: number[];
  start_time: string;
  end_time: string;
  note: string | null;
}

export interface OnDutySupervisor {
  user_id: string;
  staff_id: string;
  full_name: string;
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const listZones = () => requestJson<SchoolZone[]>('/api/v1/supervision/zones');
export const createZone = (input: { name: string; description: string | null }) =>
  requestJson<SchoolZone>('/api/v1/supervision/zones', json('POST', input));
export const updateZone = (zoneId: string, changes: Partial<Pick<SchoolZone, 'name' | 'description' | 'status'>>) =>
  requestJson<SchoolZone>(`/api/v1/supervision/zones/${zoneId}`, json('PATCH', changes));

export const listRuleItems = (level: SupervisionLevel) =>
  requestJson<RuleItem[]>(`/api/v1/supervision/rule-items?school_level=${level}`);
export const createRuleItem = (input: {
  code: string;
  name: string;
  kind: RuleKind;
  school_level: SupervisionLevel;
  parent_notice: ParentNotice;
  class_criterion_id: string | null;
}) => requestJson<RuleItem>('/api/v1/supervision/rule-items', json('POST', input));
export const updateRuleItem = (
  itemId: string,
  changes: Partial<Pick<RuleItem, 'name' | 'parent_notice' | 'class_criterion_id' | 'status'>>,
) => requestJson<RuleItem>(`/api/v1/supervision/rule-items/${itemId}`, json('PATCH', changes));
export const loadDefaultRuleItems = (level: SupervisionLevel) =>
  requestJson<{ created: string[]; skipped: string[] }>(
    '/api/v1/supervision/rule-items/defaults',
    json('POST', { school_level: level }),
  );

export const listStaffOptions = () => requestJson<StaffOption[]>('/api/v1/supervision/staff-options');
export const listAssignments = (level: SupervisionLevel) =>
  requestJson<SupervisionAssignment[]>(`/api/v1/supervision/assignments?school_level=${level}`);
export const createAssignment = (input: AssignmentInput) =>
  requestJson<SupervisionAssignment>('/api/v1/supervision/assignments', json('POST', input));
export const updateAssignment = (
  assignmentId: string,
  changes: Partial<Omit<AssignmentInput, 'staff_id'>> & { status?: RecordStatus },
) => requestJson<SupervisionAssignment>(`/api/v1/supervision/assignments/${assignmentId}`, json('PATCH', changes));
export const findOnDuty = (zoneId: string, at: string) =>
  requestJson<OnDutySupervisor[]>(
    `/api/v1/supervision/on-duty?${new URLSearchParams({ zone_id: zoneId, at: new Date(at).toISOString() })}`,
  );
