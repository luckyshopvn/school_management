import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import {
  bulkResetPassword,
  EMPTY_ACCOUNT_FILTER,
  listAccountDirectory,
  type BulkPasswordResult,
  type DirectoryAccount,
} from '../accounts/accounts-api.js';
import { readSchoolProfile } from '../facilities/facilities-api.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { LearningAccountsGrid } from './LearningAccountsPage.js';

// 5.4. Mã định danh, mật khẩu mặc định (DT-16 phần 16g, mục 5.4 của Sở): ba thẻ Trường, Giáo viên, Học sinh. Hệ thống không
// lưu mật khẩu rõ nên không có "mật khẩu mặc định" để xem lại; "Tạo mật khẩu" cấp mật khẩu mới chỉ hiện một lần (Claude tự
// chọn theo ủy quyền của Eric ngày 2026-10-11). Trường và giáo viên dùng tài khoản đăng nhập của dịch vụ định danh (cấp lại
// mật khẩu hàng loạt của phần 16d); học sinh dùng tài khoản học và thi lưu nội bộ (4.1.10)
type Tab = 'school' | 'staff' | 'students';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'school', label: 'Trường' },
  { key: 'staff', label: 'Giáo viên' },
  { key: 'students', label: 'Học sinh' },
];

const ACCOUNT_COLUMNS: Array<DataGridColumn<DirectoryAccount>> = [
  { id: 'staff_code', header: 'Mã nhân sự', cell: (row) => row.staff_code ?? '' },
  { id: 'moet_staff_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_staff_code ?? '' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'username', header: 'Tên đăng nhập', cell: (row) => row.username ?? row.phone ?? '' },
  {
    id: 'password_state',
    header: 'Mật khẩu',
    cell: (row) =>
      row.must_change_password ? (
        <StatusBadge tone="warning" label="Mật khẩu tạm, chưa đổi" />
      ) : (
        <StatusBadge tone="success" label="Đã đổi mật khẩu" />
      ),
  },
  { id: 'roles', header: 'Nhóm người dùng', cell: (row) => row.assignments.map((item) => item.role_name).join(', ') },
];

function AccountsTab({ roleCode, staffOnly }: { roleCode: string; staffOnly: boolean }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('accounts');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [issued, setIssued] = useState<BulkPasswordResult[]>();
  const accounts = useQuery({
    queryKey: ['account-directory', 'default-passwords', roleCode, search, page, grid.settings.pageSize],
    queryFn: () =>
      listAccountDirectory({ ...EMPTY_ACCOUNT_FILTER, roleCode, q: search, page, pageSize: grid.settings.pageSize }),
    enabled: grid.ready,
  });
  const rows = (accounts.data?.items ?? []).filter((row) => !staffOnly || row.staff_id !== null);
  const reset = useMutation({
    mutationFn: (selected: DirectoryAccount[]) => bulkResetPassword(selected.map((row) => row.id)),
    onSuccess: async (result) => {
      setIssued(result.items);
      await queryClient.invalidateQueries({ queryKey: ['account-directory'] });
    },
  });
  return (
    <div className="flex flex-col gap-4">
      {accounts.isError ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
      {reset.error ? <Alert tone="danger">{messageOf(reset.error)}</Alert> : null}
      <DataGrid
        label={staffOnly ? 'Tài khoản giáo viên' : 'Tài khoản của trường'}
        columns={ACCOUNT_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={!accounts.data && !accounts.isError}
        emptyText="Không có tài khoản nào."
        search={{
          label: 'Tìm theo họ tên, tên đăng nhập',
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        selectable
        toolbar={(selected) => (
          <Button
            variant="primary"
            disabled={selected.length === 0 || reset.isPending}
            onClick={() => reset.mutate(selected)}
          >
            Tạo mật khẩu
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: accounts.data?.total ?? 0, onPageChange: setPage }}
      />
      {issued ? (
        <ConfirmDialog open title="Mật khẩu vừa tạo" confirmLabel="Đóng" onCancel={() => setIssued(undefined)} onConfirm={() => setIssued(undefined)}>
          <div className="flex flex-col gap-3">
            <Alert tone="warning">
              Mật khẩu tạm chỉ hiện một lần; người dùng phải đổi mật khẩu khi đăng nhập lần đầu.
            </Alert>
            <table className="w-full text-content" aria-label="Mật khẩu vừa tạo">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-1">Họ tên</th>
                  <th className="px-3 py-1">Tên đăng nhập</th>
                  <th className="px-3 py-1">Mật khẩu tạm</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((item) => (
                  <tr key={item.user_id} className="border-t border-border">
                    <td className="px-3 py-1">{item.full_name ?? ''}</td>
                    <td className="px-3 py-1">{item.login ?? ''}</td>
                    <td className="px-3 py-1 font-mono">{item.temporary_password ?? item.skipped_reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function SchoolInfo() {
  const profile = useQuery({ queryKey: ['school-profile'], queryFn: readSchoolProfile, retry: false });
  if (!profile.data) {
    return null;
  }
  const electronicId = profile.data.general.electronic_id ?? profile.data.general.digital_identifier;
  return (
    <dl className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-4 text-content md:grid-cols-3">
      <div>
        <dt className="text-label text-text-secondary">Mã trường</dt>
        <dd className="font-medium">{profile.data.org_unit.code}</dd>
      </div>
      <div>
        <dt className="text-label text-text-secondary">Tên trường</dt>
        <dd className="font-medium">{profile.data.org_unit.name}</dd>
      </div>
      <div>
        <dt className="text-label text-text-secondary">Mã định danh điện tử</dt>
        <dd className="font-medium">{typeof electronicId === 'string' && electronicId ? electronicId : 'Chưa có'}</dd>
      </div>
    </dl>
  );
}

export function DefaultPasswordsPage() {
  const [tab, setTab] = useState<Tab>('school');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/default-passwords')}</h1>
        <div role="tablist" aria-label="Loại tài khoản" className="flex gap-2 border-b border-border">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`px-4 py-2 text-content ${tab === item.key ? 'border-b-2 border-primary font-semibold text-primary' : 'text-text-secondary'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === 'school' ? (
          <>
            <SchoolInfo />
            <AccountsTab roleCode="VT-02" staffOnly={false} />
          </>
        ) : null}
        {tab === 'staff' ? <AccountsTab roleCode="" staffOnly /> : null}
        {tab === 'students' ? <LearningAccountsGrid onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
