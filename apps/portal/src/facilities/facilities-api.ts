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
  // DT-17 phần 17a
  built_this_year?: boolean;
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
  built_this_year?: boolean;
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
  // Cấp học của thiết bị (YCTD-345)
  school_level: string;
  template_code: string | null;
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

// Cơ sở vật chất đủ theo Sở (DT-16 phần 16i): 1.2 Báo cáo cơ sở vật chất, mức độ đạt chuẩn, 6.1 thực trạng và nhu cầu đầu
// tư, nhập phòng và danh mục thiết bị từ Excel
export const FACILITY_IMPORTS_API_BASE = '/api/v1/facility-imports';

export interface FacilityFigureRow {
  key: string;
  label: string;
  level: 'block' | 'type' | 'total';
  total: number;
  permanent: number;
  semi_permanent: number;
  temporary: number;
  borrowed: number;
  unspecified: number;
  area_m2: number;
}

export interface ToiletRow {
  key: string;
  label: string;
  rooms: number;
  met: number;
  not_met: number;
  unassessed: number;
  separate_gender: number;
  seats: number;
}

export interface StandardLevelRow {
  room_block: string;
  label: string;
  level: string | null;
  level_label: string;
  note: string | null;
  updated_at: string | null;
  hints: string[];
}

export interface FacilityReport {
  school_name: string;
  academic_year: string;
  whole_school: boolean;
  figures: FacilityFigureRow[];
  toilets: { rows: ToiletRow[]; group_rooms: number; group_rooms_ensuite: number; group_rooms_adjacent: number };
  standard: StandardLevelRow[];
  overall_level: string | null;
  overall_level_label: string;
  completeness: Array<{ label: string; done: boolean }>;
}

export const readFacilityReport = (orgUnitId: string): Promise<FacilityReport> =>
  requestJson(`/api/v1/facilities/report?${query({ org_unit_id: orgUnitId })}`);
export const saveStandardLevels = (items: Array<{ room_block: string; level: string; note: string | null }>) =>
  send<FacilityReport>('PUT', '/api/v1/facilities/report/standard-levels', { items });

export interface InvestmentValues {
  permanent: number | null;
  semi_permanent: number | null;
  degraded_level4: number | null;
  borrowed: number | null;
  need_classes: number | null;
  need_rooms: number | null;
  need_budget_million: number | null;
  note: string | null;
}

export interface InvestmentRow extends InvestmentValues {
  category: string;
  label: string;
  updated_at: string | null;
  suggestion: {
    rooms: number;
    permanent: number;
    semi_permanent: number;
    temporary: number;
    borrowed: number;
    unspecified: number;
  } | null;
}

export interface FacilityInvestments {
  school_name: string;
  academic_year: string;
  class_count: number;
  classes_without_room: number;
  can_manage: boolean;
  items: InvestmentRow[];
}

export const readFacilityInvestments = (): Promise<FacilityInvestments> =>
  requestJson('/api/v1/facilities/investments');
export const saveFacilityInvestments = (items: Array<InvestmentValues & { category: string }>) =>
  send<FacilityInvestments>('PUT', '/api/v1/facilities/investments', { items });
