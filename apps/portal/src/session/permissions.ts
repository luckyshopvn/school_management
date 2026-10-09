import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from './api-client.js';

// Chỉ dùng để ẩn hoặc hiện nút; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (mục 6 của 14_DAC_TA_GIAO_DIEN.md)
export function useHasPermission(permissionCode: string): boolean {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  return currentUser.data?.assignments.some((assignment) => assignment.permissions.includes(permissionCode)) ?? false;
}
