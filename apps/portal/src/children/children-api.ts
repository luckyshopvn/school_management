import { ApiError, requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối hồ sơ trẻ và tệp đính kèm của máy chủ API (QT-01, YCTD-45)
export type ChildStatus = 'draft' | 'pending' | 'active' | 'paused' | 'withdrawn' | 'graduated';
export type PhotoConsent = 'pending' | 'granted' | 'refused';

export const CHILD_STATUS_LABELS: Record<ChildStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  withdrawn: 'Thôi học',
  graduated: 'Đã tốt nghiệp',
};

export const PHOTO_CONSENT_LABELS: Record<PhotoConsent, string> = {
  granted: 'Đồng ý bằng giấy ký tay',
  refused: 'Không đồng ý',
  pending: 'Chờ phụ huynh xác nhận trên ứng dụng',
};

export interface ChildListItem {
  id: string;
  org_unit_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  status: ChildStatus;
  national_id_masked: string;
  moet_student_code: string | null;
  class_id: string | null;
  class_name: string | null;
}

export interface ChildGuardian {
  id: string;
  full_name: string;
  phone: string | null;
  occupation: string | null;
  is_primary: boolean;
  relationship: string;
  has_account: boolean;
}

export interface ChildEnrollment {
  id: string;
  class_id: string;
  class_name: string;
  from_date: string;
  to_date: string | null;
  reason: string | null;
  is_current: boolean;
}

export interface ChildDetail extends Omit<ChildListItem, 'class_id' | 'class_name'> {
  place_of_birth: string | null;
  address: string | null;
  birth_certificate_file_id: string;
  is_staff_child: boolean;
  related_staff_name: string | null;
  special_needs_note: string | null;
  photo_consent: PhotoConsent;
  photo_consent_file_id: string | null;
  enroll_date: string | null;
  note: string | null;
  reject_reason: string | null;
  health: {
    has_allergies: boolean | null;
    allergies: string | null;
    chronic_conditions: string | null;
    blood_type: string | null;
    note: string | null;
  } | null;
  guardians: ChildGuardian[];
  enrollments: ChildEnrollment[];
  current_class: ChildEnrollment | null;
}

export interface ChildPage {
  items: ChildListItem[];
  page: number;
  total: number;
  total_pages: number;
}

export interface GuardianInput {
  full_name: string;
  phone: string | null;
  relationship_item_id: string;
  is_primary: boolean;
  occupation: string | null;
}

export interface ChildInput {
  org_unit_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female' | '';
  place_of_birth: string | null;
  address: string | null;
  national_id: string;
  moet_student_code: string | null;
  birth_certificate_file_id: string;
  special_needs_note: string | null;
  note: string | null;
  is_staff_child: boolean;
  related_staff_user_id: string | null;
  related_staff_role_code: string | null;
  photo_consent: PhotoConsent | '';
  photo_consent_file_id: string | null;
  health: { has_allergies: boolean | null; allergies: string | null; chronic_conditions: string | null };
  guardians: GuardianInput[];
  confirm_possible_duplicate: boolean;
}

export function listChildren(filter: {
  orgUnitId?: string;
  classId?: string;
  status?: string;
  q?: string;
  page: number;
}): Promise<ChildPage> {
  const parameters = new URLSearchParams({ page: String(filter.page), page_size: '20' });
  for (const [key, value] of [
    ['org_unit_id', filter.orgUnitId],
    ['class_id', filter.classId],
    ['status', filter.status],
    ['q', filter.q],
  ] as const) {
    if (value) {
      parameters.set(key, value);
    }
  }
  return requestJson(`/api/v1/children?${parameters.toString()}`);
}

export const readChild = (childId: string): Promise<ChildDetail> => requestJson(`/api/v1/children/${childId}`);

export const createChild = (input: ChildInput): Promise<ChildDetail> =>
  requestJson('/api/v1/children', { method: 'POST', body: JSON.stringify(input) });

const post = <T>(path: string, body?: unknown): Promise<T> =>
  requestJson(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const submitChild = (childId: string) => post<ChildDetail>(`/api/v1/children/${childId}/submit`);
export const approveChild = (childId: string, classId: string, confirmOverCapacity: boolean) =>
  post<ChildDetail>(`/api/v1/children/${childId}/approve`, {
    class_id: classId,
    confirm_over_capacity: confirmOverCapacity,
  });
export const rejectChild = (childId: string, reason: string) =>
  post<ChildDetail>(`/api/v1/children/${childId}/reject`, { reason });
export const transferClass = (childId: string, classId: string, reason: string, confirmOverCapacity: boolean) =>
  post<ChildDetail>(`/api/v1/children/${childId}/transfer-class`, {
    class_id: classId,
    reason,
    confirm_over_capacity: confirmOverCapacity,
  });
export const updateChild = (childId: string, changes: Record<string, unknown>): Promise<ChildDetail> =>
  requestJson(`/api/v1/children/${childId}`, { method: 'PATCH', body: JSON.stringify(changes) });

export const readNationalId = (childId: string): Promise<{ national_id: string }> =>
  requestJson(`/api/v1/children/${childId}/national-id`);

// Tải tệp qua biểu mẫu nhiều phần; không qua requestJson vì nội dung không phải JSON
export async function uploadFile(
  orgUnitId: string,
  purpose: 'birth_certificate' | 'photo_consent',
  file: File,
): Promise<{ id: string }> {
  const form = new FormData();
  form.set('org_unit_id', orgUnitId);
  form.set('purpose', purpose);
  form.set('file', file);
  return requestJson('/api/v1/files', { method: 'POST', body: form });
}

// Mở tệp trong thẻ mới; tệp tải bằng mã phiên rồi tạo địa chỉ tạm trong trình duyệt
export async function openFile(fileId: string, fetchFile: (path: string) => Promise<Response>): Promise<void> {
  const response = await fetchFile(`/api/v1/files/${fileId}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Bạn không có quyền xem tệp này');
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
}
