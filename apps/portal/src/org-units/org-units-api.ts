import type { SchoolLevelCode } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';
import { downloadPost } from '../children/children-api.js';

// Gọi nhóm điểm cuối cây đơn vị của máy chủ API (P01-01)
export type OrgUnitType = 'truong_chinh' | 'phan_hieu' | 'diem_truong';
export type OrgUnitStatus = 'active' | 'inactive';

export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  unit_type: OrgUnitType;
  parent_id: string | null;
  address: string | null;
  phone: string | null;
  manager_user_id: string | null;
  status: OrgUnitStatus;
  // Khoảng cách đến cơ sở chính (km), diện tích (m²) của phân hiệu, điểm trường (DT-15 phần 15b)
  distance_km: number | null;
  area_m2: number | null;
}

export interface OrgUnitTree extends OrgUnit {
  children: OrgUnit[];
}

export interface OrgUnitInput {
  code: string;
  name: string;
  unit_type: OrgUnitType;
  address: string | null;
  phone: string | null;
  distance_km?: number | null;
  area_m2?: number | null;
}

export const UNIT_TYPE_LABELS: Record<OrgUnitType, string> = {
  truong_chinh: 'Trường chính',
  phan_hieu: 'Phân hiệu',
  diem_truong: 'Điểm trường',
};

// Cấp học của đơn vị (DT-19 phần 19b, YCTD-152)
export interface OrgUnitLevels {
  org_unit_id: string;
  school_levels: SchoolLevelCode[];
}

export function listOrgUnitLevels(): Promise<OrgUnitLevels[]> {
  return requestJson('/api/v1/org-units/levels');
}

export function setOrgUnitLevels(orgUnitId: string, levels: SchoolLevelCode[]): Promise<OrgUnitLevels> {
  return requestJson(`/api/v1/org-units/${orgUnitId}/levels`, {
    method: 'PUT',
    body: JSON.stringify({ school_levels: levels }),
  });
}

export function readOrgUnitTree(): Promise<OrgUnitTree | null> {
  return requestJson('/api/v1/org-units/tree');
}

export function listOrgUnits(unitType?: OrgUnitType): Promise<OrgUnit[]> {
  return requestJson(`/api/v1/org-units${unitType ? `?unit_type=${unitType}` : ''}`);
}

export function createOrgUnit(input: OrgUnitInput): Promise<OrgUnit> {
  return requestJson('/api/v1/org-units', { method: 'POST', body: JSON.stringify(input) });
}

export function updateOrgUnit(
  orgUnitId: string,
  changes: Partial<
    Pick<OrgUnit, 'code' | 'name' | 'unit_type' | 'address' | 'phone' | 'status' | 'distance_km' | 'area_m2'>
  >,
): Promise<OrgUnit> {
  return requestJson(`/api/v1/org-units/${orgUnitId}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

// Xuất Excel 1.2 phân hiệu, 1.3 điểm trường theo bộ lọc và các cột đang hiện (DT-16 phần 16b)
export const exportSites = (
  filter: { unit_type: 'phan_hieu' | 'diem_truong'; status: string; q: string },
  columns: string[],
) =>
  downloadPost(
    '/api/v1/org-units/export',
    { unit_type: filter.unit_type, status: filter.status || undefined, q: filter.q.trim() || undefined, columns },
    filter.unit_type === 'phan_hieu' ? 'danh-sach-phan-hieu.xlsx' : 'danh-sach-diem-truong.xlsx',
  );
