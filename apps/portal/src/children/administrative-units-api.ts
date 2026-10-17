import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';
import { downloadPost } from './children-api.js';

// 4.1.11. Cập nhật địa danh hành chính (DT-15 phần 15h1, YCTD-116): địa chỉ của học sinh còn theo địa danh cũ, chuyển
// sang địa danh mới, bảng đối chiếu và nhập bảng đối chiếu từ Excel
export type AddressType = 'permanent' | 'hometown' | 'birth_registration' | 'birthplace' | 'current';
export type SuggestionStatus = 'suggested' | 'multiple' | 'none';

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  permanent: 'Thường trú',
  hometown: 'Quê quán',
  birth_registration: 'Nơi khai sinh',
  birthplace: 'Nơi sinh',
  current: 'Chỗ ở hiện nay',
};

export const SUGGESTION_LABELS: Record<SuggestionStatus, string> = {
  suggested: 'Có đề xuất',
  multiple: 'Nhiều xã/phường mới',
  none: 'Chưa có đối chiếu',
};

export interface NewUnitChoice {
  id: string;
  code: string | null;
  ward_name: string;
  province_name: string;
}

export interface OldAddress {
  id: string;
  child_id: string;
  moet_student_code: string | null;
  full_name: string;
  dob: string;
  class_name: string | null;
  child_status: string;
  address_type: AddressType;
  old_province: string;
  old_district: string;
  old_ward: string;
  old_ward_code: string | null;
  suggestion: SuggestionStatus;
  candidates: NewUnitChoice[];
}

export interface AddressFilter {
  address_type?: string;
  suggestion?: string;
  org_unit_id?: string;
  q?: string;
}

export interface AddressPage {
  items: OldAddress[];
  total: number;
  counts: Record<SuggestionStatus, number>;
}

export interface UnitMapping {
  id: string;
  source: 'official' | 'import';
  old_province: string;
  old_district: string;
  old_ward: string;
  old_ward_code: string | null;
  new_province: string;
  new_ward: string;
  new_ward_code: string | null;
}

export interface MappingImportReport {
  status: 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: Array<{ row: number; column: string | null; message: string }>;
  created_units: number;
  created_mappings: number;
}

const parameters = (values: Record<string, string | undefined>, page: number, pageSize: number) => {
  const result = new URLSearchParams(
    Object.entries(values).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );
  result.set('page', String(page));
  result.set('page_size', String(pageSize));
  return result.toString();
};

export const listOldAddresses = (filter: AddressFilter, page: number, pageSize: number): Promise<AddressPage> =>
  requestJson(`/api/v1/administrative-units/addresses?${parameters({ ...filter }, page, pageSize)}`);

export const convertAddresses = (
  items: Array<{ child_id: string; address_type: AddressType; new_unit_id?: string }>,
): Promise<{ updated: number; children: number }> =>
  requestJson('/api/v1/administrative-units/addresses/convert', { method: 'POST', body: JSON.stringify({ items }) });

export const listMappings = (
  q: string,
  page: number,
  pageSize: number,
): Promise<{ items: UnitMapping[]; total: number }> =>
  requestJson(`/api/v1/administrative-units/mappings?${parameters({ q }, page, pageSize)}`);

export async function downloadMappingTemplate(): Promise<void> {
  const response = await fetchWithSession('/api/v1/administrative-units/mappings/template');
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không tải được mẫu');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = 'mau-bang-doi-chieu-dia-danh.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export function importMappings(file: File): Promise<MappingImportReport> {
  const form = new FormData();
  form.set('file', file);
  return requestJson('/api/v1/administrative-units/mappings/import', { method: 'POST', body: form });
}

// Xuất Excel lưới địa chỉ theo bộ lọc và các cột đang hiện (DT-16 phần 16b)
export const exportOldAddresses = (filter: AddressFilter, columns: string[]) =>
  downloadPost('/api/v1/administrative-units/addresses/export', { ...filter, columns }, 'dia-chi-dia-danh-cu.xlsx');
