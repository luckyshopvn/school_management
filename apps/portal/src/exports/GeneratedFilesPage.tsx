import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, DataGrid, StatusBadge, type DataGridColumn, type StatusTone } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { downloadExportJob, listExportJobs, type ExportJob, type ExportJobStatus } from './export-api.js';

// 3.5. Tệp đã tạo (DT-16 phần 16a, khảo sát mục 2.3 của Sở): tệp của các lần xuất danh sách lớn chạy ở chế độ nền; người
// dùng chỉ thấy tệp của mình, xem trạng thái, thời gian tạo, thời gian xong, hạn tải và tải về. Danh sách tự làm mới khi còn
// tác vụ đang chờ hoặc đang tạo
const STATUS: Record<ExportJobStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Đang chờ', tone: 'info' },
  running: { label: 'Đang tạo', tone: 'warning' },
  done: { label: 'Đã tạo xong', tone: 'success' },
  failed: { label: 'Lỗi', tone: 'danger' },
  expired: { label: 'Hết hạn', tone: 'neutral' },
};

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDateTime = (value: string | null) => (value ? DATE_TIME.format(new Date(value)) : '');
const formatSize = (bytes: number | null) =>
  bytes === null
    ? ''
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const COLUMNS: Array<DataGridColumn<ExportJob>> = [
  { id: 'title', header: 'Tệp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  {
    id: 'format',
    header: 'Định dạng',
    cell: (row) => (row.format === 'pdf' ? 'PDF' : row.format === 'zip' ? 'ZIP' : 'Excel'),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={STATUS[row.status].tone} label={STATUS[row.status].label} />,
  },
  {
    id: 'row_count',
    header: 'Số dòng',
    cell: (row) => (row.row_count === null ? '' : row.row_count.toLocaleString('vi-VN')),
  },
  { id: 'created_at', header: 'Thời gian tạo', cell: (row) => formatDateTime(row.created_at) },
  { id: 'finished_at', header: 'Thời gian xong', cell: (row) => formatDateTime(row.finished_at) },
  { id: 'expires_at', header: 'Hạn tải về', cell: (row) => formatDateTime(row.expires_at) },
  { id: 'size_bytes', header: 'Dung lượng', hiddenByDefault: true, cell: (row) => formatSize(row.size_bytes) },
  { id: 'error_message', header: 'Ghi chú', cell: (row) => row.error_message ?? '' },
];

export function GeneratedFilesPage() {
  const grid = useGridSettings('generated-files');
  const [downloadError, setDownloadError] = useState<string>();
  const jobs = useQuery({
    queryKey: ['export-jobs'],
    queryFn: listExportJobs,
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === 'pending' || job.status === 'running') ? 5000 : false,
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/generated-files')}</h1>
        <p className="text-label text-text-secondary">
          Danh sách lớn được xuất ở chế độ nền. Tệp giữ 7 ngày kể từ lúc tạo xong; quá hạn thì xuất lại từ màn hình danh
          sách.
        </p>
        {jobs.error ? <Alert tone="danger">{messageOf(jobs.error)}</Alert> : null}
        {downloadError ? <Alert tone="danger">{downloadError}</Alert> : null}
        <DataGrid
          label="Tệp đã tạo"
          columns={COLUMNS}
          rows={jobs.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title}
          getRowAriaLabel={(row) => `Tệp ${row.title}`}
          loading={jobs.isPending}
          emptyText="Chưa có tệp nào được tạo ở chế độ nền."
          toolbar={<Button onClick={() => void jobs.refetch()}>Làm mới</Button>}
          rowActions={(row) =>
            row.status === 'done' ? (
              <Button
                variant="text"
                onClick={() => {
                  setDownloadError(undefined);
                  downloadExportJob(row).catch((error: unknown) => setDownloadError(messageOf(error)));
                }}
              >
                Tải về
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
