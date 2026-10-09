import { requestJson } from '../session/api-client.js';

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
}

export const UNIT_TYPE_LABELS: Record<OrgUnitType, string> = {
  truong_chinh: 'Trường chính',
  phan_hieu: 'Phân hiệu',
  diem_truong: 'Điểm trường',
};

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
  changes: Partial<Pick<OrgUnit, 'code' | 'name' | 'unit_type' | 'address' | 'phone' | 'status'>>,
): Promise<OrgUnit> {
  return requestJson(`/api/v1/org-units/${orgUnitId}`, { method: 'PATCH', body: JSON.stringify(changes) });
}
