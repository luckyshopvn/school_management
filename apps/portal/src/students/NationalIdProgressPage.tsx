import { useQuery } from '@tanstack/react-query';
import { Alert, DataGrid, type DataGridColumn } from '@school-management/ui';
import { CHILD_STATUS_LABELS, type ChildStatus } from '../children/children-api.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import {
  readDuplicates,
  readVerificationProgress,
  type DuplicateStudent,
  type VerificationProgressRow,
} from './students-api.js';

// 5.5. Tiến độ xác thực số định danh học sinh (DT-16 phần 16g, mục 5.5 của Sở): theo lớp tổng số học sinh đang học, số đã
// đánh dấu xác thực ở 4.1.8, tỷ lệ; danh sách hồ sơ nghi trùng (cùng họ tên, ngày sinh) vì số định danh trùng bị chặn khi
// nhập. Tiến độ của nhân sự (5.6) thuộc phần 16f
const formatDate = (value: string) => value.split('-').reverse().join('/');

const PROGRESS_COLUMNS: Array<DataGridColumn<VerificationProgressRow>> = [
  { id: 'org_unit', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'class', header: 'Lớp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.class_name },
  { id: 'total', header: 'Tổng số', cell: (row) => row.total },
  { id: 'verified', header: 'Đã xác thực', cell: (row) => row.verified },
  { id: 'remaining', header: 'Chưa xác thực', cell: (row) => row.total - row.verified },
  { id: 'ratio', header: 'Tỷ lệ (%)', cell: (row) => row.ratio.toLocaleString('vi-VN') },
];

const DUPLICATE_COLUMNS: Array<DataGridColumn<DuplicateStudent>> = [
  { id: 'group', header: 'Nhóm', cell: (row) => row.group },
  { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
  { id: 'national_id', header: 'Số định danh', cell: (row) => row.national_id_masked },
  { id: 'class', header: 'Lớp', cell: (row) => row.class_name ?? '' },
  { id: 'org_unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => CHILD_STATUS_LABELS[row.status as ChildStatus] ?? row.status,
  },
];

export function NationalIdProgressPage() {
  const progressGrid = useGridSettings('national-id-progress');
  const duplicateGrid = useGridSettings('national-id-duplicates');
  const progress = useQuery({ queryKey: ['national-ids', 'progress'], queryFn: readVerificationProgress });
  const duplicates = useQuery({ queryKey: ['national-ids', 'duplicates'], queryFn: readDuplicates });
  const total = progress.data?.total;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/national-id-progress')}</h1>
        {progress.isError ? <Alert tone="danger">{messageOf(progress.error)}</Alert> : null}
        {total ? (
          <ul className="flex flex-wrap gap-3 text-content" aria-label="Tổng hợp xác thực">
            <li className="rounded-lg border border-border bg-card px-3 py-2">
              Tổng số: <span className="font-semibold">{total.total}</span>
            </li>
            <li className="rounded-lg border border-border bg-card px-3 py-2">
              Đã xác thực: <span className="font-semibold">{total.verified}</span>
            </li>
            <li className="rounded-lg border border-border bg-card px-3 py-2">
              Tỷ lệ: <span className="font-semibold">{total.ratio.toLocaleString('vi-VN')}%</span>
            </li>
          </ul>
        ) : null}
        <DataGrid
          label="Tiến độ xác thực theo lớp"
          columns={PROGRESS_COLUMNS}
          rows={progress.data?.items ?? []}
          getRowId={(row) => row.class_id ?? `none-${row.org_unit_name}`}
          getRowLabel={(row) => row.class_name}
          loading={progress.isPending}
          emptyText="Không có học sinh đang học."
          settings={progressGrid.settings}
          onSettingsChange={progressGrid.update}
        />
        <h2 className="text-section-title font-semibold text-text">Danh sách trùng số định danh</h2>
        <p className="text-label text-text-secondary">
          Hệ thống không cho hai hồ sơ cùng một số định danh; danh sách dưới đây là các hồ sơ nghi trùng có cùng họ tên
          và ngày sinh, cần kiểm tra lại số định danh.
        </p>
        {duplicates.isError ? <Alert tone="danger">{messageOf(duplicates.error)}</Alert> : null}
        <DataGrid
          label="Hồ sơ nghi trùng"
          columns={DUPLICATE_COLUMNS}
          rows={duplicates.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          loading={duplicates.isPending}
          emptyText="Không có hồ sơ nghi trùng."
          settings={duplicateGrid.settings}
          onSettingsChange={duplicateGrid.update}
        />
      </div>
    </AppShell>
  );
}
