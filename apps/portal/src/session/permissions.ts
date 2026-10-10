import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from './api-client.js';

// Chỉ dùng để ẩn hoặc hiện nút; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (mục 6 của 14_DAC_TA_GIAO_DIEN.md)
export function useHasPermission(permissionCode: string): boolean {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  return currentUser.data?.assignments.some((assignment) => assignment.permissions.includes(permissionCode)) ?? false;
}

// Mọi phân công có quyền đều thuộc một vai trò, ví dụ thủ quỹ chỉ lập phiếu thu tiền mặt (Q-152)
export function useHasPermissionOnlyThrough(permissionCode: string, roleCode: string): boolean {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const granting = (currentUser.data?.assignments ?? []).filter((assignment) =>
    assignment.permissions.includes(permissionCode),
  );
  return granting.length > 0 && granting.every((assignment) => assignment.role_code === roleCode);
}
