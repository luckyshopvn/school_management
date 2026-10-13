import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối hồ sơ trường, cơ sở vật chất, thiết bị dạy học và báo cáo EMIS (DT-14 phần 14d, YCTD-102)
export type ProfileValues = Record<string, unknown>;

export interface SchoolProfile {
  org_unit: { id: string; code: string; name: string; address: string | null; phone: string | null };
  general: ProfileValues;
  other_info: ProfileValues;
  foreign_elements: ProfileValues;
  internet: ProfileValues;
  it_infrastructure: ProfileValues;
  office_accounts: ProfileValues[];
  updated_at: string | null;
}

export interface FacilityRoom {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  capacity: number;
  status: 'active' | 'inactive';
  room_block: string | null;
  room_type: string | null;
  condition: string | null;
  area_m2: number | null;
  facility_attributes: ProfileValues;
  class_names: string[];
}

export interface RoomSummaryRow {
  room_block: string;
  label: string;
  total: number;
  permanent: number;
  semi_permanent: number;
  temporary: number;
  borrowed: number;
  unspecified: number;
  area_m2: number;
}

export interface RoomInput {
  org_unit_id?: string;
  code?: string;
  name?: string;
  capacity?: number;
  room_block?: string | null;
  room_type?: string | null;
  condition?: string | null;
  area_m2?: number | null;
  facility_attributes?: ProfileValues;
}

export interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  equipment_group: string;
  development_area: string | null;
  age_group: string;
  quantity: number;
  norm_basis: string;
  target_users: string;
  equipment_type: string | null;
  is_minimum: boolean;
  is_seeded: boolean;
  status: 'active' | 'inactive';
  note: string | null;
}

export interface EquipmentHolding {
  id: string;
  equipment_item_id: string;
  class_id: string | null;
  class_name: string | null;
  quantity: number;
  next_year_need: number | null;
  note: string | null;
}

export interface EquipmentReportRow {
  equipment_item_id: string;
  code: string;
  name: string;
  unit: string;
  age_group: string;
  equipment_group: string;
  is_minimum: boolean;
  norm: number | null;
  available: number;
  surplus: number | null;
  shortage: number | null;
  next_year_need: number | null;
  rate_percent: number | null;
}

export interface EquipmentReport {
  rows: EquipmentReportRow[];
  classes: Array<{
    class_id: string;
    class_name: string;
    age_group: string | null;
    child_count: number;
    norm: number;
    covered: number;
    rate_percent: number | null;
  }>;
  totals: { item_count: number; met_count: number; norm: number; covered: number; rate_percent: number | null };
  unclassified_classes: string[];
}

export interface EmisRow {
  code: string;
  label: string;
  unit: string;
  total: number;
  public: number | null;
  private: number | null;
  people_founded: number | null;
  female: number | null;
  ethnic_minority: number | null;
}

export interface EmisReport {
  school_name: string;
  academic_year: string;
  ownership: string | null;
  tabs: Array<{ key: string; label: string; rows: EmisRow[] }>;
  warnings: string[];
}

const query = (values: Record<string, string | null | undefined>) =>
  new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();

const send = <T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T> =>
  requestJson(path, { method, body: JSON.stringify(body) });

export const readSchoolProfile = (): Promise<SchoolProfile> => requestJson('/api/v1/school-profile');
export const saveSchoolProfile = (body: Partial<Omit<SchoolProfile, 'org_unit' | 'updated_at'>>) =>
  send<SchoolProfile>('PUT', '/api/v1/school-profile', body);

export const listFacilityRooms = (
  filters: Record<string, string | null | undefined>,
): Promise<{ rooms: FacilityRoom[]; summary: RoomSummaryRow[] }> =>
  requestJson(`/api/v1/facilities/rooms?${query(filters)}`);
export const createRoom = (input: RoomInput) => send<FacilityRoom>('POST', '/api/v1/rooms', input);
export const updateRoom = (id: string, input: RoomInput) => send<FacilityRoom>('PATCH', `/api/v1/rooms/${id}`, input);

export const listEquipmentItems = (filters: Record<string, string | null | undefined>): Promise<EquipmentItem[]> =>
  requestJson(`/api/v1/equipment-items?${query(filters)}`);
export const createEquipmentItem = (input: Record<string, unknown>) =>
  send<EquipmentItem>('POST', '/api/v1/equipment-items', input);
export const updateEquipmentItem = (id: string, input: Record<string, unknown>) =>
  send<EquipmentItem>('PATCH', `/api/v1/equipment-items/${id}`, input);
export const listHoldings = (orgUnitId: string): Promise<EquipmentHolding[]> =>
  requestJson(`/api/v1/equipment-holdings?org_unit_id=${orgUnitId}`);
export const saveHoldings = (
  orgUnitId: string,
  items: Array<{ equipment_item_id: string; class_id: string | null; quantity: number; next_year_need: number | null }>,
) => send<{ saved: number }>('PUT', '/api/v1/equipment-holdings', { org_unit_id: orgUnitId, items });
export const readEquipmentReport = (filters: Record<string, string | null | undefined>): Promise<EquipmentReport> =>
  requestJson(`/api/v1/equipment-report?${query(filters)}`);

export const readEmisReport = (): Promise<EmisReport> => requestJson('/api/v1/reports/emis/start-of-year');

// Xuất Excel: máy chủ ghi nhật ký xuất rồi trả tệp, trình duyệt tải về
export async function downloadExcel(
  path: string,
  body: Record<string, string | null | undefined>,
  fallbackName: string,
) {
  const response = await fetchWithSession(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([, value]) => value))),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

export const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : new Intl.NumberFormat('vi-VN').format(value);
