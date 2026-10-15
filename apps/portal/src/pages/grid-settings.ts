import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_DATA_GRID_PAGE_SIZE, type DataGridKey } from '@school-management/shared';
import type { DataGridViewSettings } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';

// Cấu hình lưới dữ liệu của tài khoản đang đăng nhập (DT-15 phần 15a): cột hiển thị theo thứ tự và số dòng mỗi trang của
// từng lưới; lưới "default" giữ số dòng mặc định chọn ở "Cấu hình hiển thị lưới"
export interface StoredGridSettings {
  columns: string[] | null;
  page_size: number | null;
}

const queryKeyOf = (gridKey: DataGridKey) => ['grid-settings', gridKey];

export function readGridSettings(gridKey: DataGridKey): Promise<StoredGridSettings> {
  return requestJson(`/api/v1/me/grid-settings/${gridKey}`);
}

export function saveGridSettings(gridKey: DataGridKey, settings: StoredGridSettings): Promise<StoredGridSettings> {
  return requestJson(`/api/v1/me/grid-settings/${gridKey}`, { method: 'PUT', body: JSON.stringify(settings) });
}

// Cấu hình đang áp dụng cho một lưới: số dòng riêng của lưới, không có thì số dòng mặc định của người dùng, không có nữa
// thì số dòng mặc định của màn hình (theo Sở, ví dụ 2.1 là 50), mặc định 20. Đổi cấu hình thì hiện ngay rồi lưu ở máy chủ
export function useGridSettings(
  gridKey: DataGridKey,
  defaultPageSize: number = DEFAULT_DATA_GRID_PAGE_SIZE,
): {
  settings: DataGridViewSettings;
  update(next: DataGridViewSettings): void;
  error: Error | null;
  // Đã đọc xong cấu hình (kể cả khi lỗi), màn hình phân trang ở máy chủ chờ cờ này để không tải hai lần
  ready: boolean;
} {
  const queryClient = useQueryClient();
  const own = useQuery({ queryKey: queryKeyOf(gridKey), queryFn: () => readGridSettings(gridKey) });
  const fallback = useQuery({ queryKey: queryKeyOf('default'), queryFn: () => readGridSettings('default') });
  const save = useMutation({
    mutationFn: (next: StoredGridSettings) => saveGridSettings(gridKey, next),
    onMutate: (next) => queryClient.setQueryData(queryKeyOf(gridKey), next),
    onSuccess: (saved) => queryClient.setQueryData(queryKeyOf(gridKey), saved),
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeyOf(gridKey) }),
  });
  const settings: DataGridViewSettings = {
    columns: own.data?.columns ?? null,
    pageSize: own.data?.page_size ?? fallback.data?.page_size ?? defaultPageSize,
  };
  return {
    settings,
    // Chỉ đổi cột thì vẫn để số dòng theo mặc định của người dùng
    update: (next) =>
      save.mutate({
        columns: next.columns,
        page_size: own.data?.page_size == null && next.pageSize === settings.pageSize ? null : next.pageSize,
      }),
    error: save.error,
    ready: own.status !== 'pending' && fallback.status !== 'pending',
  };
}

// Số dòng mặc định cho mọi lưới, đổi ở menu người dùng
export function useDefaultGridPageSize() {
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: queryKeyOf('default'), queryFn: () => readGridSettings('default') });
  const save = useMutation({
    mutationFn: (pageSize: number) => saveGridSettings('default', { columns: null, page_size: pageSize }),
    onSuccess: (saved) => queryClient.setQueryData(queryKeyOf('default'), saved),
  });
  return { pageSize: current.data?.page_size ?? DEFAULT_DATA_GRID_PAGE_SIZE, save };
}
