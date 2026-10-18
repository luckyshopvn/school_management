import { useState } from 'react';
import { resolveVisibleColumns, type DataGridColumn, type DataGridViewSettings } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';

// Nút Xuất Excel trên lưới dữ liệu chung (DT-16 phần 16b): gửi mã các cột đang hiện theo cấu hình của người dùng, giữ
// trạng thái đang xuất để khóa nút và câu báo lỗi để hiện trên màn hình
export function visibleColumnIds<Row>(columns: Array<DataGridColumn<Row>>, settings: DataGridViewSettings): string[] {
  return resolveVisibleColumns(columns, settings.columns).map((column) => column.id);
}

export function useGridExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (download: () => Promise<unknown>) => {
    setError(undefined);
    setExporting(true);
    try {
      await download();
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? [failure.message, ...failure.details.map((detail) => detail.message)].join('. ')
          : 'Không kết nối được tới máy chủ, vui lòng thử lại',
      );
    } finally {
      setExporting(false);
    }
  };
  return { exporting, error, run };
}
