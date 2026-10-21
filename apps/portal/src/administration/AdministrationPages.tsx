import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEMO_ACCOUNT_APP_LABELS,
  IMPERSONATION_STATUS_LABELS,
  SCHOOL_DATA_RETENTION_HOURS,
  type ImpersonationStatus,
} from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, type DataGridColumn, type StatusTone } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { downloadExportJob, type ExportJobStatus } from '../exports/export-api.js';
import {
  listImpersonationActions,
  listImpersonations,
  listSchoolDataExports,
  readDemoStatus,
  requestSchoolDataExport,
  type DemoAccount,
  type Impersonation,
  type ImpersonationAction,
  type SchoolDataExport,
} from './administration-api.js';

// Quản trị hệ thống › 4. Quản trị và trình diễn (DT-18 phần 18h, YCTD-145)
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
    : bytes < 1048576
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const IMPERSONATION_TONES: Record<ImpersonationStatus, StatusTone> = {
  active: 'warning',
  exit: 'success',
  expired: 'neutral',
  logout: 'info',
};

const IMPERSONATION_COLUMNS: Array<DataGridColumn<Impersonation>> = [
  { id: 'started_at', header: 'Bắt đầu', alwaysVisible: true, cell: (row) => formatDateTime(row.started_at) },
  {
    id: 'impersonator_name',
    header: 'Người đăng nhập thay',
    className: 'font-medium',
    cell: (row) => row.impersonator_name,
  },
  { id: 'target_name', header: 'Tài khoản được đăng nhập thay', cell: (row) => row.target_name },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <StatusBadge tone={IMPERSONATION_TONES[row.status]} label={IMPERSONATION_STATUS_LABELS[row.status]} />
    ),
  },
  {
    id: 'ended_at',
    header: 'Kết thúc',
    cell: (row) => formatDateTime(row.ended_at ?? (row.status === 'expired' ? row.expires_at : null)),
  },
  { id: 'ip_address', header: 'Địa chỉ IP', hiddenByDefault: true, cell: (row) => row.ip_address ?? '' },
];

const ACTION_COLUMNS: Array<DataGridColumn<ImpersonationAction>> = [
  { id: 'created_at', header: 'Thời điểm', alwaysVisible: true, cell: (row) => formatDateTime(row.created_at) },
  { id: 'method', header: 'Thao tác', cell: (row) => row.method },
  { id: 'path', header: 'Đường dẫn', className: 'break-all', cell: (row) => row.path },
  {
    id: 'status_code',
    header: 'Kết quả',
    cell: (row) => (row.status_code < 400 ? `Thành công (${row.status_code})` : `Lỗi ${row.status_code}`),
  },
];

function ImpersonationActions({ impersonation }: { impersonation: Impersonation }) {
  const grid = useGridSettings('impersonation-actions');
  const actions = useQuery({
    queryKey: ['impersonation-actions', impersonation.id],
    queryFn: () => listImpersonationActions(impersonation.id),
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Thao tác khi đăng nhập thay">
      <h2 className="text-section-title font-semibold text-text">
        Thao tác của {impersonation.impersonator_name} trên tài khoản {impersonation.target_name}
      </h2>
      {actions.error ? <Alert tone="danger">{messageOf(actions.error)}</Alert> : null}
      <DataGrid
        label="Thao tác khi đăng nhập thay"
        columns={ACTION_COLUMNS}
        rows={actions.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.method} ${row.path}`}
        loading={actions.isPending}
        emptyText="Chưa có thao tác ghi dữ liệu hay tải tệp nào trong lần đăng nhập thay này."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </section>
  );
}

// 4.1. Đăng nhập thay: nhật ký mọi lần đăng nhập thay và thao tác trong từng lần. Bắt đầu đăng nhập thay ở 1.4 Danh sách
// người dùng (nút "Đăng nhập thay" ở khung chi tiết tài khoản)
export function ImpersonationsPage() {
  const grid = useGridSettings('impersonations');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Impersonation>();
  const list = useQuery({
    queryKey: ['impersonations', page, keyword],
    queryFn: () => listImpersonations(page, keyword),
  });
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/impersonations')}</h1>
        <p className="text-label text-text-secondary">
          Bắt đầu đăng nhập thay ở “1.4. Danh sách người dùng”: chọn tài khoản, bấm “Đăng nhập thay”, ghi lý do. Không
          đăng nhập thay được tài khoản có quyền cao hơn. Mỗi lần dài tối đa 60 phút; mọi thao tác ghi dữ liệu và tải
          tệp được ghi lại dưới đây.
        </p>
        {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
        <DataGrid
          label="Nhật ký đăng nhập thay"
          columns={IMPERSONATION_COLUMNS}
          rows={list.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.impersonator_name} đăng nhập thay ${row.target_name}`}
          loading={list.isPending}
          emptyText="Chưa có lần đăng nhập thay nào."
          search={{
            label: 'Tìm theo người, tài khoản, lý do',
            value: keyword,
            onChange: (value) => {
              setKeyword(value);
              setPage(1);
            },
          }}
          onRowClick={(row) => setSelected(row)}
          activeRowId={selected?.id}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setSelected(row)}>
              Xem thao tác
            </Button>
          )}
          serverPagination={{ page, total: list.data?.total ?? 0, onPageChange: setPage }}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
        {selected ? <ImpersonationActions key={selected.id} impersonation={selected} /> : null}
      </div>
    </AppShell>
  );
}

const EXPORT_STATUS: Record<ExportJobStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Đang chờ', tone: 'info' },
  running: { label: 'Đang tạo', tone: 'warning' },
  done: { label: 'Đã tạo xong', tone: 'success' },
  failed: { label: 'Lỗi', tone: 'danger' },
  expired: { label: 'Hết hạn', tone: 'neutral' },
};

const EXPORT_COLUMNS: Array<DataGridColumn<SchoolDataExport>> = [
  { id: 'created_at', header: 'Thời gian tạo', alwaysVisible: true, cell: (row) => formatDateTime(row.created_at) },
  { id: 'user_name', header: 'Người tạo', className: 'font-medium', cell: (row) => row.user_name },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={EXPORT_STATUS[row.status].tone} label={EXPORT_STATUS[row.status].label} />,
  },
  {
    id: 'row_count',
    header: 'Số dòng dữ liệu',
    cell: (row) => (row.row_count === null ? '' : row.row_count.toLocaleString('vi-VN')),
  },
  { id: 'size_bytes', header: 'Dung lượng', cell: (row) => formatSize(row.size_bytes) },
  { id: 'expires_at', header: 'Hạn tải về', cell: (row) => formatDateTime(row.expires_at) },
  { id: 'download_count', header: 'Số lần tải', cell: (row) => String(row.download_count) },
  {
    id: 'last_downloaded_at',
    header: 'Lần tải gần nhất',
    hiddenByDefault: true,
    cell: (row) => formatDateTime(row.last_downloaded_at),
  },
  { id: 'error_message', header: 'Ghi chú', cell: (row) => row.error_message ?? '' },
];

// 4.2. Xuất toàn bộ dữ liệu: gói ZIP gồm mọi bảng dữ liệu (CSV) và tệp đính kèm; tạo ở chế độ nền, màn hình tự hỏi lại và
// báo khi xong. Chỉ người tạo tải được gói của mình, hạn tải 48 giờ, mỗi lần tải được ghi lại
export function SchoolDataExportPage() {
  const grid = useGridSettings('school-data-exports');
  const queryClient = useQueryClient();
  const [downloadError, setDownloadError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const exports = useQuery({
    queryKey: ['school-data-exports'],
    queryFn: listSchoolDataExports,
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === 'pending' || job.status === 'running') ? 3000 : false,
  });
  const create = useMutation({
    mutationFn: requestSchoolDataExport,
    onSuccess: async () => {
      setNotice(undefined);
      await queryClient.invalidateQueries({ queryKey: ['school-data-exports'] });
    },
  });
  const latest = exports.data?.[0];
  const busy = exports.data?.some((job) => job.status === 'pending' || job.status === 'running') ?? false;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/school-data-export')}</h1>
        <p className="text-label text-text-secondary">
          Gói ZIP gồm mọi bảng dữ liệu của trường (tệp CSV, kèm manifest.json mô tả bảng và cột) và tệp đính kèm. Gói
          không có mật khẩu, mã bí mật và số định danh đã mã hóa nhưng có dữ liệu cá nhân của trẻ, phụ huynh, nhân sự:
          lưu ở nơi an toàn. Gói giữ {SCHOOL_DATA_RETENTION_HOURS} giờ kể từ lúc tạo xong; chỉ người tạo tải được.
        </p>
        {exports.error ? <Alert tone="danger">{messageOf(exports.error)}</Alert> : null}
        {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
        {downloadError ? <Alert tone="danger">{downloadError}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {busy ? <Alert tone="info">Đang tạo gói dữ liệu ở chế độ nền; màn hình sẽ báo khi xong.</Alert> : null}
        {!busy && latest?.status === 'done' && latest.download_count === 0 ? (
          <Alert tone="success">Gói dữ liệu đã tạo xong, tải về trước {formatDateTime(latest.expires_at)}.</Alert>
        ) : null}
        <DataGrid
          label="Gói dữ liệu đã tạo"
          columns={EXPORT_COLUMNS}
          rows={exports.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `Gói tạo lúc ${formatDateTime(row.created_at)}`}
          loading={exports.isPending}
          emptyText="Chưa tạo gói dữ liệu nào."
          toolbar={
            <>
              <Button variant="primary" onClick={() => create.mutate()} disabled={create.isPending || busy}>
                Tạo gói dữ liệu
              </Button>
              <Button onClick={() => void exports.refetch()}>Làm mới</Button>
            </>
          }
          rowActions={(row) =>
            row.status === 'done' ? (
              <Button
                variant="text"
                onClick={() => {
                  setDownloadError(undefined);
                  downloadExportJob(row)
                    .then(async () => {
                      setNotice('Đã tải gói dữ liệu; lần tải đã được ghi nhật ký.');
                      await queryClient.invalidateQueries({ queryKey: ['school-data-exports'] });
                    })
                    .catch((error: unknown) => setDownloadError(messageOf(error)));
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

const ACCOUNT_COLUMNS: Array<DataGridColumn<DemoAccount>> = [
  {
    id: 'role',
    header: 'Vai trò',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => `${row.role_code} ${row.role_name}`,
  },
  { id: 'full_name', header: 'Họ tên (giả)', cell: (row) => row.full_name },
  { id: 'login', header: 'Tên đăng nhập', cell: (row) => row.login },
  { id: 'app', header: 'Ứng dụng', cell: (row) => DEMO_ACCOUNT_APP_LABELS[row.app] },
];

// 4.3. Bản trình diễn: trạng thái, lịch đặt lại, tài khoản trình diễn. Bật và đặt lại bằng lệnh trên máy chủ (không có nút
// ở đây để không ai bật nhầm trên dữ liệu thật)
export function DemoEnvironmentPage() {
  const grid = useGridSettings('default');
  const demo = useQuery({ queryKey: ['demo-status'], queryFn: readDemoStatus });
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/demo-environment')}</h1>
        {demo.error ? <Alert tone="danger">{messageOf(demo.error)}</Alert> : null}
        {demo.data && !demo.data.enabled ? (
          <Alert tone="info">
            Máy chủ này không phải bản trình diễn. Bản trình diễn được tạo bằng lệnh tạo dữ liệu trình diễn trên máy chủ
            riêng (xem deploy/README.md); lệnh từ chối chạy trên cơ sở dữ liệu đã có dữ liệu thật.
          </Alert>
        ) : null}
        {demo.data?.enabled ? (
          <>
            <dl className="grid gap-2 text-content sm:grid-cols-[220px_1fr]">
              <dt className="text-text-secondary">Tạo dữ liệu lúc</dt>
              <dd>{formatDateTime(demo.data.seeded_at)}</dd>
              <dt className="text-text-secondary">Tự đặt lại</dt>
              <dd>
                {demo.data.reset_interval_hours ? `Mỗi ${demo.data.reset_interval_hours} giờ` : ''}
                {demo.data.next_reset_at ? `, lần tới lúc ${formatDateTime(demo.data.next_reset_at)}` : ''}
              </dd>
              <dt className="text-text-secondary">Mật khẩu chung</dt>
              <dd>{demo.data.password}</dd>
              <dt className="text-text-secondary">Gửi tin, thanh toán</dt>
              <dd>Chặn: không gửi SMS, Zalo, không đăng Fanpage, không tạo mã thanh toán thật</dd>
            </dl>
            <DataGrid
              label="Tài khoản trình diễn"
              columns={ACCOUNT_COLUMNS}
              rows={demo.data.accounts}
              getRowId={(row) => row.login}
              getRowLabel={(row) => row.login}
              emptyText="Chưa có tài khoản trình diễn."
              settings={grid.settings}
              onSettingsChange={grid.update}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
