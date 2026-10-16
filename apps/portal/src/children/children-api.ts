import type { MoetProfileEntry } from '../imports/MoetProfileSection.js';
import { downloadExport, type ExportFormat } from '../exports/export-api.js';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

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
  granted: 'Đồng ý',
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
  // Cột theo danh sách học sinh của Sở (4.1.1, 4.1.4; YCTD-108)
  org_unit_name: string;
  grade_level: string | null;
  grade_name: string | null;
  two_sessions_per_day: boolean;
  boarding: boolean;
  has_birth_certificate: boolean;
  // Cột CSDL ngành, chỉ nhóm vai trò xem sức khỏe thấy (BR-53)
  ethnicity: string | null;
  policy_target: string | null;
  disability_type: string | null;
  can_swim: boolean | null;
  contact_phone: string | null;
  sms_phone: string | null;
}

export interface ChildGuardian {
  id: string;
  full_name: string;
  phone: string | null;
  occupation: string | null;
  is_primary: boolean;
  relationship: string;
  has_account: boolean;
  // Phụ huynh có điện thoại nhận tin của học sinh (YCTD-108)
  receives_sms: boolean;
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

export interface ChildDetail extends Pick<
  ChildListItem,
  | 'id'
  | 'org_unit_id'
  | 'full_name'
  | 'dob'
  | 'gender'
  | 'status'
  | 'national_id_masked'
  | 'moet_student_code'
  | 'two_sessions_per_day'
  | 'boarding'
  | 'sms_phone'
> {
  place_of_birth: string | null;
  address: string | null;
  birth_certificate_file_id: string | null;
  is_staff_child: boolean;
  related_staff_user_id: string | null;
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
  // Thông tin theo CSDL ngành, chỉ đọc (YCTD-100)
  moet_profile?: MoetProfileEntry[] | null;
}

export interface ChildPage {
  items: ChildListItem[];
  page: number;
  total: number;
  total_pages: number;
  health_fields_visible?: boolean;
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

// Bộ lọc danh sách học sinh (mục 4.1.4 của Sở, YCTD-108); giá trị rỗng là không lọc
export interface StudentFilter {
  org_unit_id?: string;
  class_id?: string;
  group_id?: string;
  status?: string;
  q?: string;
  missing_birth_certificate?: boolean;
  gender?: string;
  grade_level?: string;
  ethnicity?: string;
  policy?: string;
  disability?: string;
  two_sessions_per_day?: string;
  boarding?: string;
  can_swim?: string;
  moet_student_code?: string;
  national_id?: string;
}

function filterParameters(filter: StudentFilter): URLSearchParams {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value === true) {
      parameters.set(key, 'true');
    } else if (typeof value === 'string' && value !== '') {
      parameters.set(key, value);
    }
  }
  return parameters;
}

export function listChildren(filter: StudentFilter & { page: number; pageSize?: number }): Promise<ChildPage> {
  const { page, pageSize, ...rest } = filter;
  const parameters = filterParameters(rest);
  parameters.set('page', String(page));
  parameters.set('page_size', String(pageSize ?? 20));
  return requestJson(`/api/v1/children?${parameters.toString()}`);
}

// Tải tệp do máy chủ tạo; máy chủ ghi nhật ký xuất rồi trả tệp (dùng chung cho danh sách lớp, YCTD-111, và nhân sự); danh
// sách lớn trả lời nhắn đã tạo tác vụ xuất nền (DT-16 phần 16a)
export const downloadPost = downloadExport;

// Xuất Excel danh sách học sinh theo bộ lọc và các cột đang hiện trên lưới
export const exportChildren = (filter: StudentFilter, columns: string[], format: ExportFormat = 'xlsx') =>
  downloadPost(
    '/api/v1/children/export',
    { ...Object.fromEntries(filterParameters(filter)), columns, format },
    `danh-sach-hoc-sinh.${format}`,
  );

// Cập nhật hàng loạt học 2 buổi/ngày, bán trú (mục 4.1.12 của Sở)
export const bulkUpdateChildren = (
  childIds: string[],
  changes: { two_sessions_per_day?: boolean; boarding?: boolean },
): Promise<{ updated: number }> =>
  requestJson('/api/v1/children/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ child_ids: childIds, ...changes }),
  });

// Chọn phụ huynh có điện thoại nhận tin (mục 4.1.5 của Sở); null là bỏ chọn
export const setSmsGuardian = (childId: string, guardianId: string | null): Promise<ChildDetail> =>
  requestJson(`/api/v1/children/${childId}/sms-guardian`, {
    method: 'PUT',
    body: JSON.stringify({ guardian_id: guardianId }),
  });

// 4.2 Biến động học sinh (YCTD-108)
export type MovementKind = 'enrolled' | 'class_transfer' | 'unit_transfer' | 'withdrawn';

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  enrolled: 'Nhập học',
  class_transfer: 'Chuyển lớp',
  unit_transfer: 'Chuyển đơn vị',
  withdrawn: 'Thôi học',
};

export interface StudentMovement {
  id: string;
  kind: MovementKind;
  date: string;
  child_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  moet_student_code: string | null;
  from_name: string | null;
  to_name: string | null;
  reason: string | null;
}

export interface MovementFilter {
  from?: string;
  to?: string;
  kind?: string;
  org_unit_id?: string;
  q?: string;
}

export interface MovementPage {
  items: StudentMovement[];
  page: number;
  total: number;
  total_pages: number;
  counts: Record<MovementKind, number>;
}

const movementParameters = (filter: MovementFilter) =>
  new URLSearchParams(
    Object.entries(filter).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );

export function listMovements(filter: MovementFilter, page: number, pageSize: number): Promise<MovementPage> {
  const parameters = movementParameters(filter);
  parameters.set('page', String(page));
  parameters.set('page_size', String(pageSize));
  return requestJson(`/api/v1/student-movements?${parameters.toString()}`);
}

export const exportMovements = (filter: MovementFilter, format: ExportFormat = 'xlsx') =>
  downloadPost(
    '/api/v1/student-movements/export',
    { ...Object.fromEntries(movementParameters(filter)), format },
    `bien-dong-hoc-sinh.${format}`,
  );

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
  purpose: 'birth_certificate' | 'photo_consent' | 'payment_voucher',
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

// Chuyển đơn vị, thôi học, đồng ý hình ảnh, cờ trẻ con nhân viên (P02-07, P02-08, P02-09; YCTD-67)
export interface PhotoConsentView {
  photo_consent: PhotoConsent;
  photo_consent_method: 'app' | 'paper' | null;
  history: Array<{ action: PhotoConsent; method: 'app' | 'paper' | null; file_id: string | null; created_at: string }>;
}

export const transferUnit = (
  childId: string,
  input: { class_id: string; reason: string; effective_date?: string; confirm_over_capacity: boolean },
) => post<{ to_org_unit_id: string }>(`/api/v1/children/${childId}/transfer-unit`, input);
export const withdrawChild = (childId: string, input: { leave_date?: string; reason: string }) =>
  post<{ outstanding_amount: number; credit_amount: number }>(`/api/v1/children/${childId}/withdraw`, input);
export const readPhotoConsent = (childId: string): Promise<PhotoConsentView> =>
  requestJson(`/api/v1/children/${childId}/photo-consent`);
export const recordPhotoConsent = (childId: string, input: { action: 'grant' | 'withdraw'; file_id: string }) =>
  post<PhotoConsentView>(`/api/v1/children/${childId}/photo-consent`, input);
export const saveStaffChild = (
  childId: string,
  input: { is_staff_child: boolean; related_staff_user_id: string | null; related_staff_role_code: string | null },
) => requestJson(`/api/v1/children/${childId}/staff-child`, { method: 'PUT', body: JSON.stringify(input) });
