import { fetchWithSession, readError, requestJson } from '../session/api-client.js';
import type { MealType } from './kitchen-api.js';

// Gọi nhóm điểm cuối bán trú: kiểm thực ba bước, lưu và hủy mẫu, lô hàng nhập, hồ sơ an toàn thực phẩm của nhà cung cấp,
// truy xuất nguồn gốc và sổ in (DT-18 phần 22b, YCTD-146)
export type CheckResult = 'pass' | 'fail';
export type RejectionAction = 'returned' | 'destroyed' | 'other';
export type LotStatus = 'pending' | 'accepted' | 'rejected' | 'used_up' | 'disposed';
export type ExpiryState = 'none' | 'ok' | 'expiring' | 'expired';
export type CertificateValidity = 'valid' | 'expiring' | 'expired' | 'revoked';
export type SampleStatus = 'stored' | 'held' | 'destroyed';

export interface FoodSafetyFile {
  id: string;
  org_unit_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export interface FoodLot {
  id: string;
  code: string;
  org_unit_id: string;
  ingredient_id: string;
  supplier_id: string;
  purchase_item_id: string | null;
  food_category: 'fresh' | 'dry';
  received_date: string;
  received_time: string | null;
  quantity: number;
  deliverer_name: string | null;
  manufacturer: string | null;
  manufacturer_address: string | null;
  lot_number: string | null;
  production_date: string | null;
  expiry_date: string | null;
  storage_condition: 'ambient' | 'chilled' | 'frozen' | null;
  document_number: string | null;
  document_file_id: string | null;
  veterinary_certificate: string | null;
  quarantine_certificate: string | null;
  status: LotStatus;
  rejection_action: RejectionAction | null;
  handling_note: string | null;
  note: string | null;
  ingredient_name: string;
  ingredient_code: string;
  unit: string;
  supplier_name: string;
  supplier_address: string | null;
  supplier_phone: string | null;
  purchase_id: string | null;
  purchase_code: string | null;
  document_file_name: string | null;
  expiry_state: ExpiryState;
}

export interface FoodLotDetail extends FoodLot {
  inspection: {
    inspection_id: string;
    inspection_date: string;
    inspection_status: 'draft' | 'confirmed';
    inspector_name: string;
    sensory_result: CheckResult | null;
    rapid_test_result: CheckResult | null;
    action: string | null;
  } | null;
  usage: Array<{
    inspection_date: string;
    meal_type: MealType | null;
    dish_name: string | null;
    servings: number | null;
  }>;
}

export interface InspectionLine {
  id: string;
  line_no: number;
  lot_id: string | null;
  meal_type: MealType | null;
  dish_id: string | null;
  dish_name: string | null;
  main_ingredients: string | null;
  servings: number | null;
  first_time: string | null;
  second_time: string | null;
  hygiene_people: CheckResult | null;
  hygiene_equipment: CheckResult | null;
  hygiene_area: CheckResult | null;
  utensils: string | null;
  sensory_result: CheckResult | null;
  rapid_test_result: CheckResult | null;
  rejection_action: RejectionAction | null;
  action: string | null;
  note: string | null;
  lot: FoodLot | null;
  lots: Array<{
    id: string;
    code: string;
    ingredient_name: string;
    supplier_name: string;
    received_date: string;
    expiry_date: string | null;
  }>;
}

export interface InspectionSheet {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  inspection_date: string;
  step: 1 | 2 | 3;
  inspector_name: string;
  inspector_title: string | null;
  inspected_time: string | null;
  location: string | null;
  note: string | null;
  status: 'draft' | 'confirmed';
  confirmed_at: string | null;
  lines: InspectionLine[];
}

export interface InspectionDay {
  org_unit_id: string;
  date: string;
  steps: [InspectionSheet | null, InspectionSheet | null, InspectionSheet | null];
}

export interface InspectionListItem {
  id: string;
  org_unit_id: string;
  inspection_date: string;
  step: 1 | 2 | 3;
  inspector_name: string;
  inspector_title: string | null;
  status: 'draft' | 'confirmed';
  confirmed_at: string | null;
  line_count: number;
  fail_count: number;
}

// Dòng gửi lên khi ghi phiếu; lot_ids là các lô đã dùng cho món ở bước 2
export type InspectionLineInput = Omit<InspectionLine, 'id' | 'line_no' | 'lot' | 'lots'> & { lot_ids: string[] };

export interface FoodSample {
  id: string;
  org_unit_id: string;
  sample_date: string;
  meal_type: MealType;
  dish_id: string | null;
  dish_name: string;
  servings: number;
  food_form: 'solid' | 'liquid';
  quantity: number;
  container: string;
  storage_temperature: number;
  sampled_at: string;
  sampled_by_name: string;
  status: SampleStatus;
  hold_reason: string | null;
  held_at: string | null;
  destroyed_at: string | null;
  destroyed_by_name: string | null;
  quality_note: string | null;
  note: string | null;
  earliest_destroy_at: string;
  destroy_state: 'destroyed' | 'held' | 'retaining' | 'due';
}

export interface SampleSuggestion {
  meal_type: MealType | null;
  dish_id: string | null;
  dish_name: string | null;
  servings: number;
  required: boolean;
  sampled: boolean;
}

export interface SupplierCertificate {
  id: string;
  supplier_id: string;
  supplier_name: string;
  certificate_type: string;
  number: string;
  issued_by: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope_note: string | null;
  file_id: string | null;
  file_name?: string | null;
  status: 'active' | 'revoked';
  validity: CertificateValidity;
  days_left: number | null;
}

export interface SupplierSafetySummary {
  id: string;
  name: string;
  food_groups: string | null;
  phone: string | null;
  address: string | null;
  status: 'active' | 'inactive';
  certificate_count: number;
  has_valid_food_safety: boolean;
  expiring_count: number;
  expired_count: number;
  nearest_expiry: string | null;
}

export interface TraceLot extends FoodLot {
  first_step: {
    lot_id: string;
    inspection_date: string;
    inspector_name: string;
    sensory_result: CheckResult | null;
    rapid_test_result: CheckResult | null;
  } | null;
  certificates: Array<{
    id: string;
    supplier_id: string;
    certificate_type: string;
    number: string;
    issued_on: string | null;
    expires_on: string | null;
    status: 'active' | 'revoked';
    validity_on_date: CertificateValidity;
  }>;
}

interface TraceStepLine {
  id: string;
  inspection_id: string;
  step: number;
  inspection_status: 'draft' | 'confirmed';
  inspector_name: string;
  sensory_result: CheckResult | null;
  hygiene_people: CheckResult | null;
  hygiene_equipment: CheckResult | null;
  hygiene_area: CheckResult | null;
  action: string | null;
}

export interface TraceDish {
  meal_type: MealType;
  dish_id: string | null;
  dish_name: string;
  servings: number | null;
  step2: TraceStepLine | null;
  step3: TraceStepLine | null;
  lots_source: 'recorded' | 'inferred' | 'none';
  lots: TraceLot[];
  samples: FoodSample[];
}

export interface TraceResult {
  org_unit_id: string;
  date: string;
  dishes: TraceDish[];
}

type Filters = Record<string, string | null | undefined>;

const query = (values: Filters) =>
  new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();

const send = <T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T> =>
  requestJson(path, { method, body: JSON.stringify(body) });

// Tệp quét giấy tờ, chứng từ (PDF, JPEG, PNG; tối đa 10 MB) tải lên trước, rồi gắn mã tệp vào giấy tờ hoặc lô
export function uploadFoodSafetyFile(orgUnitId: string, file: File): Promise<FoodSafetyFile> {
  const form = new FormData();
  form.set('org_unit_id', orgUnitId);
  form.set('file', file, file.name);
  return requestJson('/api/v1/food-safety/files', { method: 'POST', body: form });
}

// Mở tệp bằng mã phiên nên không dùng liên kết trực tiếp
export async function openFoodSafetyFile(fileId: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/food-safety/files/${fileId}`);
  if (!response.ok) {
    throw await readError(response);
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const listInspections = (filters: Filters): Promise<InspectionListItem[]> =>
  requestJson(`/api/v1/food-inspections?${query(filters)}`);
export const readInspectionDay = (orgUnitId: string, date: string): Promise<InspectionDay> =>
  requestJson(`/api/v1/food-inspections/day?${query({ org_unit_id: orgUnitId, date })}`);
export const createInspection = (body: Record<string, unknown>) =>
  send<InspectionSheet>('POST', '/api/v1/food-inspections', body);
export const updateInspection = (id: string, body: Record<string, unknown>) =>
  send<InspectionSheet>('PUT', `/api/v1/food-inspections/${id}`, body);
export const confirmInspection = (id: string) =>
  send<InspectionSheet>('POST', `/api/v1/food-inspections/${id}/confirm`, {});

export const listSamples = (filters: Filters): Promise<FoodSample[]> =>
  requestJson(`/api/v1/food-samples?${query(filters)}`);
export const listSampleSuggestions = (orgUnitId: string, date: string): Promise<SampleSuggestion[]> =>
  requestJson(`/api/v1/food-samples/suggestions?${query({ org_unit_id: orgUnitId, date })}`);
export const createSample = (body: Record<string, unknown>) => send<FoodSample>('POST', '/api/v1/food-samples', body);
export const destroySamples = (ids: string[], qualityNote: string | null) =>
  send<FoodSample[]>('POST', '/api/v1/food-samples/destroy', { ids, quality_note: qualityNote });
export const holdSample = (id: string, reason: string) =>
  send<FoodSample>('POST', `/api/v1/food-samples/${id}/hold`, { hold_reason: reason });
export const releaseSample = (id: string) => send<FoodSample>('POST', `/api/v1/food-samples/${id}/release`, {});

export const listLots = (filters: Filters): Promise<FoodLot[]> => requestJson(`/api/v1/food-lots?${query(filters)}`);
export const readLot = (id: string): Promise<FoodLotDetail> => requestJson(`/api/v1/food-lots/${id}`);
export const createLot = (body: Record<string, unknown>) => send<FoodLotDetail>('POST', '/api/v1/food-lots', body);
export const updateLot = (id: string, body: Record<string, unknown>) =>
  send<FoodLotDetail>('PATCH', `/api/v1/food-lots/${id}`, body);
export const closeLot = (id: string, status: 'used_up' | 'disposed', handlingNote: string | null) =>
  send<FoodLotDetail>('POST', `/api/v1/food-lots/${id}/close`, { status, handling_note: handlingNote });

export const listCertificates = (filters: Filters): Promise<SupplierCertificate[]> =>
  requestJson(`/api/v1/food-supplier-certificates?${query(filters)}`);
export const createCertificate = (body: Record<string, unknown>) =>
  send<SupplierCertificate>('POST', '/api/v1/food-supplier-certificates', body);
export const updateCertificate = (id: string, body: Record<string, unknown>) =>
  send<SupplierCertificate>('PATCH', `/api/v1/food-supplier-certificates/${id}`, body);
export const readSupplierSummary = (orgUnitId: string): Promise<SupplierSafetySummary[]> =>
  requestJson(`/api/v1/food-suppliers/safety-summary?${query({ org_unit_id: orgUnitId })}`);

export const readTrace = (filters: Filters): Promise<TraceResult> =>
  requestJson(`/api/v1/food-safety/trace?${query(filters)}`);

// Sổ in theo khoảng ngày: sổ kiểm thực ba bước, sổ lưu và hủy mẫu, nhãn mẫu; máy chủ ghi nhật ký xuất rồi trả tệp
export async function downloadBook(body: {
  org_unit_id: string;
  from: string;
  to: string;
  book: 'inspections' | 'samples' | 'labels';
  format: 'pdf' | 'xlsx';
}) {
  const response = await fetchWithSession('/api/v1/food-safety/books', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `so-${body.book}.${body.format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

// Giờ "HH:MM" từ cột giờ của máy chủ (có thể kèm giây)
export const clockTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : '');

// Ngày "DD/MM/YYYY" và thời điểm theo giờ Việt Nam "HH:MM DD/MM/YYYY"
export const formatDay = (value: string | null | undefined) => (value ? value.split('-').reverse().join('/') : '');
export function formatMoment(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const local = new Date(new Date(value).getTime() + 7 * 3_600_000).toISOString();
  return `${local.slice(11, 16)} ${formatDay(local.slice(0, 10))}`;
}

// Giá trị cho ô datetime-local theo giờ Việt Nam
export const localMomentNow = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16);

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined) =>
  values.find((item) => item.value === value)?.label ?? '';
