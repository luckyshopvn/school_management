import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối nơi để, tem QR, kiểm kê và đối sánh danh mục tối thiểu của thiết bị (DT-18 phần 18g, YCTD-143)
export interface EquipmentLocation {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  location_type: 'room' | 'store' | 'position';
  room_id: string | null;
  room_name: string | null;
  parent_id: string | null;
  parent_name: string | null;
  status: 'active' | 'inactive';
  note: string | null;
  target_count: number;
}

export interface EquipmentTarget {
  target_type: 'asset' | 'holding';
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  equipment_item_id: string | null;
  equipment_item_code: string | null;
  class_name: string | null;
  location_id: string | null;
  location_name: string | null;
  qr_code: string | null;
  status: string;
}

export type StocktakeStatus = 'counting' | 'submitted' | 'approved' | 'closed' | 'cancelled';
export type Condition = 'good' | 'damaged' | 'unusable' | 'missing';

export interface StocktakeListItem {
  id: string;
  code: string;
  name: string;
  org_unit_id: string;
  org_unit_name: string;
  location_id: string | null;
  location_name: string | null;
  started_on: string;
  status: StocktakeStatus;
  line_count: number;
  counted_count: number;
}

export interface StocktakeLine {
  id: string;
  target_type: 'asset' | 'holding';
  code: string;
  name: string;
  unit: string;
  location_name: string | null;
  in_scope: boolean;
  expected_quantity: number;
  counted_quantity: number | null;
  usable_quantity: number | null;
  condition: Condition | null;
  found_location_id: string | null;
  found_location_name: string | null;
  note: string | null;
  qr_code: string | null;
  status: 'unchecked' | 'matched' | 'shortage' | 'surplus';
  difference: number | null;
}

export interface StocktakeSummary {
  line_count: number;
  counted_count: number;
  unchecked_count: number;
  matched_count: number;
  shortage_count: number;
  surplus_count: number;
  out_of_scope_count: number;
  expected_total: number;
  counted_total: number;
  usable_total: number;
  shortage_quantity: number;
  surplus_quantity: number;
  usable_rate_percent: number | null;
  conditions: Record<Condition, number>;
}

export interface StocktakeDetail {
  id: string;
  code: string;
  name: string;
  org_unit_id: string;
  org_unit_name: string;
  location_id: string | null;
  location_name: string | null;
  started_on: string;
  members: string | null;
  note: string | null;
  status: StocktakeStatus;
  return_note: string | null;
  lines: StocktakeLine[];
  summary: StocktakeSummary;
}

export interface ScanBody {
  qr_code?: string;
  line_id?: string;
  condition?: Condition | null;
  counted_quantity?: number | null;
  usable_quantity?: number | null;
  found_location_id?: string | null;
  note?: string | null;
}

export interface EquipmentTemplateInfo {
  code: string;
  school_level: string;
  title: string;
  source: string;
  item_count: number;
  loaded_count: number;
}

export interface ComparisonRow {
  equipment_item_id: string;
  code: string;
  name: string;
  unit: string;
  age_group: string;
  equipment_group: string;
  norm: number;
  available: number;
  shortage: number;
  status: 'enough' | 'short' | 'none';
}

export interface Comparison {
  catalog_source: { standard: boolean; legal_basis: string; note: string };
  school_level: string;
  catalog_count: number;
  not_applicable_count: number;
  unclassified_classes: string[];
  rows: ComparisonRow[];
  totals: { item_count: number; enough: number; short: number; none: number; rate_percent: number | null };
}

const query = (values: Record<string, string | null | undefined>) =>
  new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();

const send = <T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T> =>
  requestJson(path, { method, body: JSON.stringify(body) });

export const listLocations = (orgUnitId: string | null): Promise<EquipmentLocation[]> =>
  requestJson(`/api/v1/equipment-locations?${query({ org_unit_id: orgUnitId })}`);
export const createLocation = (body: Record<string, unknown>) =>
  send<EquipmentLocation>('POST', '/api/v1/equipment-locations', body);
export const updateLocation = (id: string, body: Record<string, unknown>) =>
  send<EquipmentLocation>('PATCH', `/api/v1/equipment-locations/${id}`, body);
export const listTargets = (filters: Record<string, string | null | undefined>): Promise<EquipmentTarget[]> =>
  requestJson(`/api/v1/equipment-placements?${query(filters)}`);
export const placeTargets = (
  orgUnitId: string,
  locationId: string | null,
  targets: Array<{ target_type: string; id: string }>,
) =>
  send<{ saved: number }>('PUT', '/api/v1/equipment-placements', {
    org_unit_id: orgUnitId,
    location_id: locationId,
    targets,
  });
export const lookupQr = (code: string): Promise<EquipmentTarget> =>
  requestJson(`/api/v1/equipment-qr/${encodeURIComponent(code)}`);

export const listStocktakes = (filters: Record<string, string | null | undefined>): Promise<StocktakeListItem[]> =>
  requestJson(`/api/v1/equipment-stocktakes?${query(filters)}`);
export const readStocktake = (id: string): Promise<StocktakeDetail> =>
  requestJson(`/api/v1/equipment-stocktakes/${id}`);
export const createStocktake = (body: Record<string, unknown>) =>
  send<{ id: string; code: string; line_count: number }>('POST', '/api/v1/equipment-stocktakes', body);
export const scanStocktake = (id: string, body: ScanBody) =>
  send<StocktakeLine>('POST', `/api/v1/equipment-stocktakes/${id}/scan`, body);
export const stocktakeAction = (id: string, action: 'submit' | 'approve' | 'cancel' | 'close', body?: unknown) =>
  send<{ status: StocktakeStatus }>('POST', `/api/v1/equipment-stocktakes/${id}/${action}`, body ?? {});
export const returnStocktake = (id: string, note: string) =>
  send<{ status: StocktakeStatus }>('POST', `/api/v1/equipment-stocktakes/${id}/return`, { note });

export const listTemplates = (): Promise<EquipmentTemplateInfo[]> => requestJson('/api/v1/equipment-templates');
export const loadTemplate = (code: string, retirePlaceholders: boolean) =>
  send<{ added: number; existing: number; retired: number }>(
    'POST',
    `/api/v1/equipment-templates/${encodeURIComponent(code)}/load`,
    { retire_placeholders: retirePlaceholders },
  );
export const readComparison = (filters: Record<string, string | null | undefined>): Promise<Comparison> =>
  requestJson(`/api/v1/equipment-minimum?${query(filters)}`);

// Tải tệp (tem QR, biên bản, xuất đối sánh): máy chủ ghi nhật ký xuất rồi trả tệp
export async function downloadFile(path: string, body: unknown, fallbackName: string) {
  const response = await fetchWithSession(path, {
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
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

// Nguồn danh mục tối thiểu của từng cấp đang bật (YCTD-345)
export interface CatalogLevelInfo {
  school_level: string;
  standard: boolean;
  legal_basis: string;
  note: string;
  template_codes: string[];
  catalog_count: number;
}

export const listCatalogLevels = (): Promise<CatalogLevelInfo[]> => requestJson('/api/v1/equipment-minimum/levels');
