import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối các danh mục của máy chủ API (P01-03, 04, 05, 10, 11, 12)
export type CatalogStatus = 'active' | 'inactive';

export interface Department {
  id: string;
  org_unit_id: string;
  parent_id: string | null;
  name: string;
  status: CatalogStatus;
}

export interface JobTitle {
  id: string;
  org_unit_id: string;
  name: string;
  level: string | null;
  status: CatalogStatus;
}

export interface CatalogType {
  code: string;
  label: string;
}

export interface CatalogItem {
  id: string;
  catalog_type: string;
  code: string;
  name: string;
  order_no: number;
  status: CatalogStatus;
}

export interface ApprovalThreshold {
  id: string;
  org_unit_id: string;
  document_type: string;
  threshold_amount: number;
  effective_from: string;
}

export interface Room {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  capacity: number;
  status: CatalogStatus;
}

export interface GradeLevel {
  id: string;
  code: string;
  name: string;
  age_from_months: number;
  age_to_months: number;
  order_no: number;
  status: CatalogStatus;
}

function send<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T> {
  return requestJson(path, { method, body: JSON.stringify(body) });
}

export const listDepartments = (orgUnitId: string): Promise<Department[]> =>
  requestJson(`/api/v1/departments?org_unit_id=${orgUnitId}`);
export const createDepartment = (input: { org_unit_id: string; parent_id: string | null; name: string }) =>
  send<Department>('POST', '/api/v1/departments', input);
export const updateDepartment = (id: string, changes: Partial<Pick<Department, 'name' | 'parent_id' | 'status'>>) =>
  send<Department>('PATCH', `/api/v1/departments/${id}`, changes);

export const listJobTitles = (orgUnitId: string): Promise<JobTitle[]> =>
  requestJson(`/api/v1/job-titles?org_unit_id=${orgUnitId}`);
export const createJobTitle = (input: { org_unit_id: string; name: string; level: string | null }) =>
  send<JobTitle>('POST', '/api/v1/job-titles', input);
export const updateJobTitle = (id: string, changes: Partial<Pick<JobTitle, 'name' | 'level' | 'status'>>) =>
  send<JobTitle>('PATCH', `/api/v1/job-titles/${id}`, changes);

export const listCatalogTypes = (): Promise<CatalogType[]> => requestJson('/api/v1/catalog-types');
export const listCatalogItems = (catalogType: string): Promise<CatalogItem[]> =>
  requestJson(`/api/v1/catalog-items?catalog_type=${catalogType}`);
export const createCatalogItem = (input: { catalog_type: string; code: string; name: string; order_no: number }) =>
  send<CatalogItem>('POST', '/api/v1/catalog-items', input);
export const updateCatalogItem = (
  id: string,
  changes: Partial<Pick<CatalogItem, 'code' | 'name' | 'order_no' | 'status'>>,
) => send<CatalogItem>('PATCH', `/api/v1/catalog-items/${id}`, changes);

export const listApprovalThresholds = (): Promise<ApprovalThreshold[]> => requestJson('/api/v1/approval-thresholds');
export const saveApprovalThreshold = (input: {
  org_unit_id: string;
  document_type: string;
  threshold_amount: number | null;
}) => send<ApprovalThreshold | null>('PUT', '/api/v1/approval-thresholds', input);

export const listRooms = (orgUnitId: string): Promise<Room[]> => requestJson(`/api/v1/rooms?org_unit_id=${orgUnitId}`);
export const createRoom = (input: { org_unit_id: string; code: string; name: string; capacity: number }) =>
  send<Room>('POST', '/api/v1/rooms', input);
export const updateRoom = (id: string, changes: Partial<Pick<Room, 'code' | 'name' | 'capacity' | 'status'>>) =>
  send<Room>('PATCH', `/api/v1/rooms/${id}`, changes);

export const listGradeLevels = (): Promise<GradeLevel[]> => requestJson('/api/v1/grade-levels');
export const createGradeLevel = (input: Omit<GradeLevel, 'id' | 'status'>) =>
  send<GradeLevel>('POST', '/api/v1/grade-levels', input);
export const updateGradeLevel = (
  id: string,
  changes: Partial<Pick<GradeLevel, 'name' | 'age_from_months' | 'age_to_months' | 'order_no' | 'status'>>,
) => send<GradeLevel>('PATCH', `/api/v1/grade-levels/${id}`, changes);
