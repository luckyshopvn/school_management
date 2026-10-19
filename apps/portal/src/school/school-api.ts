import { downloadPost } from '../children/children-api.js';
import { requestJson } from '../session/api-client.js';

// Gọi điểm cuối 1.7 Rà soát thông tin kiểm định CLGD và 1.8 Tách trường (DT-16 phần 16e)
export interface AccreditationFigures {
  // Ô như Sở thêm ở DT-17 phần 17e (khảo sát mục 10.5)
  school_name: string | null;
  school_code: string | null;
  ownership_type: string | null;
  education_level: string;
  national_standard_year: number | null;
  national_standard_date: string | null;
  national_standard_level: string | null;
  accreditation_year: number | null;
  accreditation_date: string | null;
  accreditation_level: string | null;
  national_standard_registration: string | null;
  floor_area_per_child_m2: number | null;
  class_count: number | null;
  classroom_count: number | null;
  subject_room_count: number | null;
  land_area_m2: number | null;
  floor_area_m2: number | null;
  child_count: number | null;
  area_per_child_m2: number | null;
}

export interface AccreditationReview {
  org_unit: { id: string; name: string };
  saved: (AccreditationFigures & { note: string | null; collected_at: string | null; updated_at: string }) | null;
}

export const readAccreditationReview = (): Promise<AccreditationReview> => requestJson('/api/v1/accreditation-review');

export const collectAccreditationFigures = (): Promise<AccreditationFigures & { collected_at: string }> =>
  requestJson('/api/v1/accreditation-review/collect', { method: 'POST' });

export const saveAccreditationReview = (
  input: Omit<AccreditationFigures, 'education_level'> & { note: string | null; collected: boolean },
): Promise<AccreditationReview> =>
  requestJson('/api/v1/accreditation-review', { method: 'PUT', body: JSON.stringify(input) });

export type SchoolSplitStatus = 'draft' | 'confirmed' | 'received';

export const SCHOOL_SPLIT_STATUS_LABELS: Record<SchoolSplitStatus, string> = {
  draft: 'Chưa xác nhận',
  confirmed: 'Đã xác nhận đi',
  received: 'Đã tiếp nhận',
};

export interface SchoolSplitRequest {
  id: string;
  code: string;
  destination_school: string;
  destination_code: string | null;
  reason: string;
  status: SchoolSplitStatus;
  confirmed_at: string | null;
  received_at: string | null;
  received_note: string | null;
  created_at: string;
  child_count: number;
  staff_count: number;
}

export interface SchoolSplitDetail extends Omit<SchoolSplitRequest, 'child_count' | 'staff_count'> {
  children: Array<{ id: string; full_name: string; dob: string; class_name: string | null; status: string }>;
  staff: Array<{ id: string; code: string; full_name: string; status: string }>;
}

export interface SchoolSplitInput {
  destination_school: string;
  destination_code: string | null;
  reason: string;
  child_ids: string[];
  staff_ids: string[];
}

export interface SplitCandidate {
  id: string;
  full_name: string;
  dob: string | null;
  class_name?: string | null;
  code?: string;
}

export const listSchoolSplits = (): Promise<SchoolSplitRequest[]> => requestJson('/api/v1/school-splits');

export const readSchoolSplit = (id: string): Promise<SchoolSplitDetail> => requestJson(`/api/v1/school-splits/${id}`);

export const listSplitCandidates = (type: 'child' | 'staff', q: string): Promise<SplitCandidate[]> =>
  requestJson(`/api/v1/school-splits/candidates?${new URLSearchParams({ type, q }).toString()}`);

export const createSchoolSplit = (input: SchoolSplitInput): Promise<SchoolSplitDetail> =>
  requestJson('/api/v1/school-splits', { method: 'POST', body: JSON.stringify(input) });

export const updateSchoolSplit = (id: string, input: SchoolSplitInput): Promise<SchoolSplitDetail> =>
  requestJson(`/api/v1/school-splits/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deleteSchoolSplit = (id: string): Promise<void> =>
  requestJson(`/api/v1/school-splits/${id}`, { method: 'DELETE' });

export const changeSchoolSplitStatus = (
  id: string,
  action: 'confirm' | 'unconfirm' | 'receive',
  note: string | null = null,
): Promise<SchoolSplitDetail> =>
  requestJson(`/api/v1/school-splits/${id}/status`, { method: 'POST', body: JSON.stringify({ action, note }) });

export const exportSchoolSplit = (id: string, subject: 'children' | 'staff') =>
  downloadPost(`/api/v1/school-splits/${id}/export`, { subject }, `tach-truong-${subject}.xlsx`);
