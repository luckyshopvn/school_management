import type { OrgUnitStatus } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import type { OrgUnit } from './org-units.service.js';

// Xuất Excel 1.2. Quản lý phân hiệu, 1.3. Quản lý điểm trường theo Sở (DT-16 phần 16b): cột như lưới, theo các cột đang
// hiện và bộ lọc trạng thái, từ khóa tên hoặc mã của màn hình
export type ExportedSiteType = 'phan_hieu' | 'diem_truong';

export interface OrgUnitExportFilter {
  unitType: ExportedSiteType;
  status: OrgUnitStatus | null;
  q: string | null;
}

const STATUS_LABELS: Record<OrgUnitStatus, string> = { active: 'Đang dùng', inactive: 'Ngừng sử dụng' };

export const ORG_UNIT_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: OrgUnit): string | number }> = [
  { id: 'code', label: 'Mã', value: (row) => row.code },
  { id: 'name', label: 'Tên', value: (row) => row.name },
  { id: 'address', label: 'Địa chỉ', value: (row) => row.address ?? '' },
  { id: 'distance_km', label: 'Khoảng cách đến cơ sở chính (km)', value: (row) => row.distance_km ?? '' },
  { id: 'area_m2', label: 'Diện tích (m²)', value: (row) => row.area_m2 ?? '' },
  { id: 'phone', label: 'Điện thoại', value: (row) => row.phone ?? '' },
  { id: 'status', label: 'Trạng thái', value: (row) => STATUS_LABELS[row.status] },
];

export const DEFAULT_ORG_UNIT_EXPORT_COLUMNS = ORG_UNIT_EXPORT_COLUMNS.map((column) => column.id);

export const ORG_UNIT_EXPORT_SCREENS: Record<ExportedSiteType, { reportCode: string; title: string; file: string }> = {
  phan_hieu: { reportCode: 'branches', title: 'Quản lý phân hiệu', file: 'danh-sach-phan-hieu' },
  diem_truong: { reportCode: 'school-sites', title: 'Quản lý điểm trường', file: 'danh-sach-diem-truong' },
};

export function readOrgUnitExportFilter(body: Record<string, unknown>, errors: FieldError[]): OrgUnitExportFilter {
  const unitType = body.unit_type;
  if (unitType !== 'phan_hieu' && unitType !== 'diem_truong') {
    errors.push({ field: 'unit_type', message: 'Loại đơn vị phải là phan_hieu hoặc diem_truong' });
  }
  const status = body.status;
  if (status !== undefined && status !== null && status !== '' && status !== 'active' && status !== 'inactive') {
    errors.push({ field: 'status', message: 'Trạng thái phải là active hoặc inactive' });
  }
  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (q.length > 100) {
    errors.push({ field: 'q', message: 'Tối đa 100 ký tự' });
  }
  return {
    unitType: unitType === 'diem_truong' ? 'diem_truong' : 'phan_hieu',
    status: status === 'active' || status === 'inactive' ? status : null,
    q: q === '' ? null : q,
  };
}

// Cùng cách lọc với lưới: tên hoặc mã chứa từ khóa, không phân biệt hoa thường
export function matchesOrgUnitExport(unit: OrgUnit, filter: OrgUnitExportFilter): boolean {
  const keyword = filter.q?.toLocaleLowerCase('vi');
  return (
    (filter.status === null || unit.status === filter.status) &&
    (!keyword ||
      unit.name.toLocaleLowerCase('vi').includes(keyword) ||
      unit.code.toLocaleLowerCase('vi').includes(keyword))
  );
}
