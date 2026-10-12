import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối thuốc và dặn thuốc (P10-02 đến P10-05, P10-09; YCTD-75)
export type MedicationStatus = 'pending' | 'administering' | 'completed' | 'rejected';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'ordered';

export interface Dose {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  administered_at: string | null;
  dose_note: string | null;
  is_skipped: boolean;
  skip_reason: string | null;
  parent_acknowledged_at: string | null;
}

export interface MedicationRequest {
  id: string;
  child_id: string;
  full_name: string;
  class_name: string | null;
  org_unit_id: string;
  medicine_name: string;
  dosage: string;
  times: string[];
  from_date: string;
  to_date: string;
  allergy_note: string;
  note: string | null;
  medicine_photo_ids: string[];
  prescription_photo_id: string | null;
  assigned_role: 'nurse' | 'homeroom';
  status: MedicationStatus;
  received_quantity: string | null;
  reject_reason: string | null;
  administrations: Dose[];
}

export interface ScheduleRow {
  request_id: string;
  child_id: string;
  full_name: string;
  class_name: string | null;
  medicine_name: string;
  dosage: string;
  scheduled_date: string;
  scheduled_time: string;
  can_administer: boolean;
  administration: Dose | null;
}

export interface Medicine {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  active_ingredient: string | null;
  unit: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  stock_qty: number;
  status: 'active' | 'inactive';
}

export interface Pharmacy {
  id: string;
  org_unit_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: 'active' | 'inactive';
}

export interface PurchaseRequest {
  id: string;
  org_unit_id: string;
  medicine_id: string;
  medicine_name: string;
  unit: string;
  quantity: number;
  estimated_unit_price: number;
  estimated_amount: number;
  reason: string;
  status: PurchaseStatus;
  requires_principal: boolean;
  reject_reason: string | null;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  pharmacy_name: string;
  order_date: string;
  total_amount: number;
  items: Array<{ id: string; medicine_name: string; unit: string; quantity: number; unit_price: number }>;
}

export interface MedicineIssue {
  id: string;
  code: string;
  medicine_name: string;
  unit: string;
  quantity: number;
  recipient: string;
  reason: string;
  issued_at: string;
}

export const MEDICATION_STATUS_LABELS: Record<MedicationStatus, string> = {
  pending: 'Chờ nhận',
  administering: 'Đang cho uống',
  completed: 'Hoàn thành',
  rejected: 'Từ chối',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  ordered: 'Đã lập phiếu mua',
};

export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export const timeOf = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

export function describeDose(dose: Dose): string {
  return dose.is_skipped
    ? `Bỏ liều: ${dose.skip_reason ?? ''} (${dose.parent_acknowledged_at ? 'phụ huynh đã biết' : 'phụ huynh chưa xác nhận'})`
    : `Đã cho uống lúc ${dose.administered_at ? timeOf(dose.administered_at) : ''}`;
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

// Mở ảnh thuốc, ảnh đơn thuốc trong thẻ mới; tệp tải bằng mã phiên
export async function openFile(fileId: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/files/${fileId}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Bạn không có quyền xem tệp này');
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}
