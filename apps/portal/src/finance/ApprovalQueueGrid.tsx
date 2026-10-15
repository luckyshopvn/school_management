import { useState, type ReactNode } from 'react';
import type { DataGridKey } from '@school-management/shared';
import { Alert, DataGrid, type DataGridColumn } from '@school-management/ui';
import { useGridSettings } from '../pages/grid-settings.js';

// Danh sách chờ duyệt của phân hệ Tài chính – học phí trên lưới dữ liệu chung (DT-15 phần 15f1): mỗi yêu cầu một dòng,
// ngay dưới dòng là nhóm thao tác (Duyệt, lý do từ chối, Từ chối) mang tên của yêu cầu như trước; tìm kiếm tại chỗ, cột và
// số dòng nhớ theo người dùng. Thứ tự và quyền của từng bước duyệt giữ nguyên ở màn hình gọi
export function ApprovalQueueGrid<Row>({
  label,
  gridKey,
  rows,
  loading,
  columns,
  getRowId,
  getRowLabel,
  searchText,
  searchLabel,
  emptyText,
  groupLabel,
  renderActions,
}: {
  label: string;
  gridKey: DataGridKey;
  rows: Row[];
  loading?: boolean;
  columns: Array<DataGridColumn<Row>>;
  getRowId(row: Row): string;
  getRowLabel(row: Row): string;
  searchText(row: Row): string;
  searchLabel: string;
  emptyText: string;
  // Tên nhóm thao tác dưới dòng, giữ như tên nhóm của danh sách cũ
  groupLabel(row: Row): string;
  // Không truyền thì danh sách chỉ xem
  renderActions?(row: Row): ReactNode;
}) {
  const grid = useGridSettings(gridKey);
  const [search, setSearch] = useState('');
  const keyword = search.trim().toLocaleLowerCase('vi');
  const shown = rows.filter((row) => keyword === '' || searchText(row).toLocaleLowerCase('vi').includes(keyword));
  return (
    <>
      {grid.error ? <Alert tone="danger">{grid.error.message}</Alert> : null}
      <DataGrid
        label={label}
        columns={columns}
        rows={shown}
        getRowId={getRowId}
        getRowLabel={getRowLabel}
        loading={loading}
        emptyText={emptyText}
        search={{ label: searchLabel, value: search, onChange: setSearch }}
        renderRowDetail={
          renderActions
            ? (row) => (
                <div className="flex flex-wrap items-end gap-2" role="group" aria-label={groupLabel(row)}>
                  {renderActions(row)}
                </div>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </>
  );
}
