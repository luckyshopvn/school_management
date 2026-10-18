import { useQuery } from '@tanstack/react-query';
import { listOrgUnits, type OrgUnit } from '../org-units/org-units-api.js';
import { ApiError, fetchCurrentUser } from '../session/api-client.js';

// Phần dùng chung của các màn hình văn thư lưu trữ (DT-15 phần 15h2, YCTD-118)
export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

// Lỗi theo ô của biểu mẫu do máy chủ trả
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

export const selectClass =
  'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
export const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
export const formatNumber = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Ô số nhận dấu phẩy thập phân; chữ không đọc được gửi nguyên để máy chủ báo lỗi ở đúng ô
export function numberOrText(text: string): number | string | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : text;
}

// Đơn vị chọn được cho phông, hồ sơ (YCTD-122): người có quyền văn thư toàn trường chọn "Toàn trường" hoặc một phân hiệu,
// điểm trường; người chỉ có quyền ở một số đơn vị chỉ chọn các đơn vị đó. Trường chính là "Toàn trường" nên không liệt kê
export function useArchiveUnits(permissionCode: string): {
  units: OrgUnit[];
  wholeSchool: boolean;
  nameOf(orgUnitId: string | null): string;
} {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const assignments = (currentUser.data?.assignments ?? []).filter((assignment) =>
    assignment.permissions.includes(permissionCode),
  );
  const all = (units.data ?? []).filter((unit) => unit.status === 'active');
  const root = all.find((unit) => unit.unit_type === 'truong_chinh');
  const wholeSchool = assignments.some(
    (assignment) => assignment.org_unit_id === null || (root !== undefined && assignment.org_unit_id === root.id),
  );
  const assignedIds = new Set(assignments.map((assignment) => assignment.org_unit_id));
  const choices = all.filter((unit) => unit.unit_type !== 'truong_chinh' && (wholeSchool || assignedIds.has(unit.id)));
  return {
    units: choices,
    wholeSchool,
    nameOf: (orgUnitId) =>
      orgUnitId ? ((units.data ?? []).find((unit) => unit.id === orgUnitId)?.name ?? '') : 'Toàn trường',
  };
}
