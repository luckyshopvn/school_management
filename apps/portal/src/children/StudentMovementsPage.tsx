import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { BulkTransferDialog } from '../students/BulkTransferDialog.js';
import { StudentTransfersSection } from '../students/StudentTransfersSection.js';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  exportMovements,
  listMovements,
  MOVEMENT_KIND_LABELS,
  type MovementFilter,
  type MovementKind,
  type StudentMovement,
} from './children-api.js';

// 4.2. Biến động học sinh (DT-15 phần 15c, YCTD-108): nhập học, chuyển lớp, chuyển đơn vị, thôi học theo khoảng ngày, dựng
// từ lịch sử đã có; lưới dữ liệu chung, tìm theo họ tên, mở rộng tìm kiếm theo loại và đơn vị, Xuất Excel. Ghi nhận chuyển
// lớp, chuyển đơn vị, thôi học vẫn làm ở hồ sơ học sinh. Từ DT-16 phần 16g có "Chuyển lớp hàng loạt" và khối chuyển đi, tiếp
// nhận chuyển đến giữa các trường chạy nội bộ
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string) => value.split('-').reverse().join('/');

const COLUMNS: Array<DataGridColumn<StudentMovement>> = [
  { id: 'date', header: 'Ngày', cell: (row) => formatDate(row.date) },
  { id: 'kind', header: 'Loại biến động', cell: (row) => MOVEMENT_KIND_LABELS[row.kind] },
  { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
  { id: 'gender', header: 'Giới tính', hiddenByDefault: true, cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
  { id: 'from', header: 'Từ', cell: (row) => row.from_name ?? '' },
  { id: 'to', header: 'Đến', cell: (row) => row.to_name ?? '' },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason ?? '' },
];

export function StudentMovementsPage() {
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const canApprove = useHasPermission(PERMISSION_CODES.childApprove);
  const queryClient = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('student-movements');
  const [filter, setFilter] = useState<MovementFilter>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const activeFilter: MovementFilter = { ...filter, q: search || undefined };
  const pageSize = grid.settings.pageSize;
  const movements = useQuery({
    queryKey: ['student-movements', activeFilter, page, pageSize],
    queryFn: () => listMovements(activeFilter, page, pageSize),
    enabled: grid.ready,
  });
  const change = (key: keyof MovementFilter, value: string) => {
    setFilter((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const counts = movements.data?.counts;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/student-movements')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Từ ngày"
            type="date"
            value={filter.from ?? ''}
            onChange={(event) => change('from', event.target.value)}
          />
          <TextField
            label="Đến ngày"
            type="date"
            value={filter.to ?? ''}
            onChange={(event) => change('to', event.target.value)}
          />
        </div>
        {counts ? (
          <ul className="flex flex-wrap gap-3 text-content" aria-label="Số biến động theo loại">
            {(Object.keys(MOVEMENT_KIND_LABELS) as MovementKind[]).map((kind) => (
              <li key={kind} className="rounded-lg border border-border bg-card px-3 py-2">
                {MOVEMENT_KIND_LABELS[kind]}: <span className="font-semibold">{counts[kind]}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {movements.isError ? <Alert tone="danger">{messageOf(movements.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        <DataGrid
          label="Danh sách biến động học sinh"
          columns={COLUMNS}
          rows={movements.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.full_name} ${MOVEMENT_KIND_LABELS[row.kind]}`}
          loading={!movements.data && !movements.isError}
          emptyText="Không có biến động trong khoảng ngày đã chọn."
          search={{
            label: 'Tìm theo họ tên',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Loại biến động
                <select
                  value={filter.kind ?? ''}
                  onChange={(event) => change('kind', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(MOVEMENT_KIND_LABELS) as MovementKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {MOVEMENT_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Đơn vị
                <select
                  value={filter.org_unit_id ?? ''}
                  onChange={(event) => change('org_unit_id', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {unitChoice.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={
            <>
              {canApprove ? <Button onClick={() => setBulkOpen(true)}>Chuyển lớp hàng loạt</Button> : null}
              {canExport ? (
                <Button
                  disabled={exporting}
                  onClick={() => {
                    setExportError(undefined);
                    setExporting(true);
                    exportMovements(activeFilter)
                      .catch((error: unknown) => setExportError(messageOf(error)))
                      .finally(() => setExporting(false));
                  }}
                >
                  Xuất Excel
                </Button>
              ) : null}
            </>
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          exportPdf={canExport ? () => exportMovements(activeFilter, 'pdf') : undefined}
          serverPagination={{ page, total: movements.data?.total ?? 0, onPageChange: setPage }}
        />
        <StudentTransfersSection onChanged={setToastMessage} />
      </div>
      {bulkOpen ? (
        <BulkTransferDialog
          onCancel={() => setBulkOpen(false)}
          onDone={(message) => {
            setBulkOpen(false);
            setToastMessage(message);
            void queryClient.invalidateQueries({ queryKey: ['student-movements'] });
            void queryClient.invalidateQueries({ queryKey: ['children'] });
          }}
        />
      ) : null}
    </AppShell>
  );
}
