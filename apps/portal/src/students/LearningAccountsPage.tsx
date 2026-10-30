import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPreschool } from '../school-levels/working-level.js';
import { useHasPermission } from '../session/permissions.js';
import { useStudentClassFilter } from './StudentClassFilter.js';
import {
  exportLearningAccounts,
  issueLearningAccounts,
  listLearningAccounts,
  saveIssuedFile,
  type IssuedAccounts,
  type LearningAccountRow,
} from './students-api.js';

// 4.1.10. Tài khoản học và thi (DT-16 phần 16g, mục 4.1.10 của Sở): khởi tạo tài khoản, cấp lại mật khẩu cho học sinh, xuất
// danh sách tài khoản. Trẻ mầm non không tự đăng nhập và chưa có phần mềm học, thi trực tuyến nên tài khoản chỉ lưu nội bộ để
// giao cho phụ huynh khi cần (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11). Mật khẩu chỉ hiện một lần ngay sau
// khi tạo, kèm tệp danh sách tài khoản vừa tạo; hệ thống không lưu mật khẩu rõ
const formatDate = (value: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10).split('-').reverse().join('/') : '';

const COLUMNS: Array<DataGridColumn<LearningAccountRow>> = [
  { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'class', header: 'Lớp', cell: (row) => row.class_name ?? '' },
  { id: 'username', header: 'Tên đăng nhập', cell: (row) => row.username ?? '' },
  {
    id: 'state',
    header: 'Tình trạng',
    cell: (row) =>
      row.username ? (
        <StatusBadge tone="success" label="Đã khởi tạo" />
      ) : (
        <StatusBadge tone="neutral" label="Chưa khởi tạo" />
      ),
  },
  {
    id: 'sign_in',
    header: 'Đăng nhập làm bài thi',
    cell: (row) =>
      row.username ? (
        row.sign_in_ready ? (
          <StatusBadge tone="success" label="Đã mở" />
        ) : (
          <StatusBadge tone="warning" label="Cần cấp lại mật khẩu" />
        )
      ) : (
        ''
      ),
  },
  { id: 'issued_at', header: 'Ngày cấp mật khẩu', cell: (row) => formatDate(row.issued_at) },
  { id: 'issued_by', header: 'Người cấp', hiddenByDefault: true, cell: (row) => row.issued_by_name ?? '' },
  { id: 'reset_count', header: 'Số lần cấp lại', hiddenByDefault: true, cell: (row) => row.reset_count },
];

// Kết quả khởi tạo hoặc cấp lại: mật khẩu chỉ hiện ở đây một lần
function IssuedDialog({ result, onClose }: { result: IssuedAccounts; onClose(): void }) {
  return (
    <ConfirmDialog
      open
      title={result.mode === 'create' ? 'Tài khoản vừa khởi tạo' : 'Mật khẩu vừa cấp lại'}
      confirmLabel="Tải danh sách tài khoản"
      onCancel={onClose}
      onConfirm={() => saveIssuedFile(result.file)}
    >
      <div className="flex flex-col gap-3">
        <Alert tone="warning">
          Mật khẩu chỉ hiện một lần. Tải danh sách hoặc ghi lại trước khi đóng; muốn xem lại phải cấp lại mật khẩu.
        </Alert>
        <table className="w-full text-content" aria-label="Tài khoản vừa tạo">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-1">Họ tên</th>
              <th className="px-3 py-1">Lớp</th>
              <th className="px-3 py-1">Tên đăng nhập</th>
              <th className="px-3 py-1">Mật khẩu</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.child_id} className="border-t border-border">
                <td className="px-3 py-1">{item.full_name}</td>
                <td className="px-3 py-1">{item.class_name}</td>
                <td className="px-3 py-1">{item.username}</td>
                <td className="px-3 py-1 font-mono">{item.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.skipped > 0 ? (
          <p className="text-label text-text-secondary">Bỏ qua {result.skipped} học sinh không thuộc thao tác này.</p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

// Lưới tài khoản học sinh dùng chung cho 4.1.10 và thẻ Học sinh của 5.4
export function LearningAccountsGrid({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const grid = useGridSettings('learning-accounts');
  const classFilter = useStudentClassFilter({ status: 'active' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<IssuedAccounts>();
  const [exportError, setExportError] = useState<string>();
  const filter = { ...classFilter.filter, q: search || undefined };
  const accounts = useQuery({
    queryKey: ['learning-accounts', filter, page, grid.settings.pageSize],
    queryFn: () => listLearningAccounts(filter, page, grid.settings.pageSize),
    enabled: grid.ready,
  });
  const issue = useMutation({
    mutationFn: ({ rows, mode }: { rows: LearningAccountRow[]; mode: 'create' | 'reset' }) =>
      issueLearningAccounts(
        rows.map((row) => row.id),
        mode,
      ),
    onSuccess: async (issued) => {
      setResult(issued);
      onChanged(
        issued.mode === 'create'
          ? `Đã khởi tạo ${issued.items.length} tài khoản`
          : `Đã cấp lại mật khẩu cho ${issued.items.length} học sinh`,
      );
      await queryClient.invalidateQueries({ queryKey: ['learning-accounts'] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {accounts.isError ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
      {issue.error ? <Alert tone="danger">{messageOf(issue.error)}</Alert> : null}
      {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
      <DataGrid
        label="Tài khoản học và thi của học sinh"
        columns={COLUMNS}
        rows={accounts.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={!accounts.data && !accounts.isError}
        emptyText="Không có học sinh nào."
        search={{
          label: 'Tìm theo họ tên',
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        advancedSearch={classFilter.controls(() => setPage(1))}
        selectable
        toolbar={(selected) => (
          <>
            <Button
              variant="primary"
              disabled={selected.length === 0 || issue.isPending}
              onClick={() => issue.mutate({ rows: selected, mode: 'create' })}
            >
              Khởi tạo tài khoản
            </Button>
            <Button
              disabled={selected.length === 0 || issue.isPending}
              onClick={() => issue.mutate({ rows: selected, mode: 'reset' })}
            >
              Cấp lại mật khẩu
            </Button>
            {canExport ? (
              <Button
                onClick={() => {
                  setExportError(undefined);
                  exportLearningAccounts(filter).catch((error: unknown) => setExportError(messageOf(error)));
                }}
              >
                Xuất Excel
              </Button>
            ) : null}
          </>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: accounts.data?.total ?? 0, onPageChange: setPage }}
      />
      {result ? <IssuedDialog result={result} onClose={() => setResult(undefined)} /> : null}
    </div>
  );
}

export function LearningAccountsPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const hasPreschool = useHasPreschool();
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/learning-accounts')}</h1>
        <p className="text-label text-text-secondary">
          Tài khoản lưu nội bộ trên hệ thống của trường
          {hasPreschool
            ? '; học sinh mầm non chưa dùng phần mềm học, thi trực tuyến nên tài khoản chưa dùng để đăng nhập.'
            : '.'}
        </p>
        <LearningAccountsGrid onChanged={setToastMessage} />
      </div>
    </AppShell>
  );
}
