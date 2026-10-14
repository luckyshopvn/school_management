import { useCallback, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listOrgUnits, type OrgUnit } from '../org-units/org-units-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addRole,
  createAccount,
  listAccounts,
  listRoles,
  removeRole,
  resetPassword,
  updateAccount,
  type Account,
  type Role,
  type RoleGrant,
} from './accounts-api.js';
import { RoleGrantFields } from './RoleGrantFields.js';
import { PasswordPolicySection } from './PasswordPolicySection.js';

// MH-30 phần tài khoản: danh sách, tạo, khóa, mở khóa, đặt lại mật khẩu, gán vai trò (P01-06, P01-07, PQ-13); danh sách
// dùng lưới dữ liệu chung, gỡ vai trò qua hộp xác nhận xóa (DT-15 phần 15a)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

function unitName(units: OrgUnit[], orgUnitId: string | null): string {
  return orgUnitId === null
    ? 'Toàn trường'
    : (units.find((unit) => unit.id === orgUnitId)?.name ?? 'Đơn vị không còn trong năm học');
}

// Mật khẩu tạm chỉ hiển thị một lần (PQ-14)
function TemporaryPasswordDialog({ password, onClose }: { password: string | undefined; onClose(): void }) {
  if (!password) {
    return null;
  }
  return (
    <ConfirmDialog open title="Mật khẩu tạm" confirmLabel="Đã ghi lại" onCancel={onClose} onConfirm={onClose}>
      <p>
        Chuyển mật khẩu tạm này cho người dùng. Mật khẩu chỉ hiển thị một lần; người dùng phải đổi ở lần đăng nhập đầu.
      </p>
      <p
        className="mt-3 rounded-lg bg-page px-3 py-2 font-mono text-section-title text-text"
        data-testid="temporary-password"
      >
        {password}
      </p>
    </ConfirmDialog>
  );
}

function CreateAccountForm({
  roles,
  units,
  onCreated,
}: {
  roles: Role[];
  units: OrgUnit[];
  onCreated(result: { account: Account; temporary_password: string | null; uses_default_password: boolean }): void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [grant, setGrant] = useState<RoleGrant>({ role_code: '', org_unit_id: null });
  const create = useMutation({ mutationFn: createAccount, onSuccess: onCreated });
  const fieldErrors = fieldErrorsOf(create.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({
      full_name: fullName,
      phone: phone || null,
      username: username || null,
      valid_until: validUntil || null,
      roles: [grant],
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <TextField
        label="Họ tên"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={fieldErrors.full_name}
      />
      <TextField
        label="Số điện thoại"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fieldErrors.phone}
      />
      <TextField
        label="Tên đăng nhập"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        error={fieldErrors.username}
      />
      <TextField
        label="Ngày hết hiệu lực"
        type="date"
        value={validUntil}
        onChange={(event) => setValidUntil(event.target.value)}
        error={fieldErrors.valid_until}
      />
      <RoleGrantFields roles={roles} units={units} value={grant} onChange={setGrant} idPrefix="create" />
      {fieldErrors['roles[0].org_unit_id'] ? (
        <p className="text-label text-danger">{fieldErrors['roles[0].org_unit_id']}</p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
        </Button>
      </div>
    </form>
  );
}

function AccountDetail({
  account,
  roles,
  units,
  canAssignRoles,
  onChanged,
  onTemporaryPassword,
}: {
  account: Account;
  roles: Role[];
  units: OrgUnit[];
  canAssignRoles: boolean;
  onChanged(message: string): void;
  onTemporaryPassword(password: string): void;
}) {
  const queryClient = useQueryClient();
  const [grant, setGrant] = useState<RoleGrant>({ role_code: '', org_unit_id: null });
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Vai trò đang chờ xác nhận gỡ (hộp xác nhận xóa theo mẫu của Sở, DT-15 phần 15a)
  const [removing, setRemoving] = useState<Account['assignments'][number]>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['accounts'] });

  const toggleLock = useMutation({
    mutationFn: () => updateAccount(account.id, { status: account.status === 'active' ? 'locked' : 'active' }),
    onSuccess: async (updated) => {
      await refresh();
      onChanged(updated.status === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
    },
  });
  const reset = useMutation({
    mutationFn: () => resetPassword(account.id),
    onSuccess: (result) => {
      setConfirmingReset(false);
      onTemporaryPassword(result.temporary_password);
    },
    onError: () => setConfirmingReset(false),
  });
  const assign = useMutation({
    mutationFn: () => addRole(account.id, grant),
    onSuccess: async () => {
      setGrant({ role_code: '', org_unit_id: null });
      await refresh();
      onChanged('Đã gán vai trò');
    },
  });
  const unassign = useMutation({
    mutationFn: (assignmentId: string) => removeRole(account.id, assignmentId),
    onSuccess: async () => {
      setRemoving(undefined);
      await refresh();
      onChanged('Đã gỡ vai trò');
    },
    onError: () => setRemoving(undefined),
  });
  const error = toggleLock.error ?? reset.error ?? assign.error ?? unassign.error;

  return (
    <section className="flex flex-col gap-4" aria-label={`Tài khoản ${account.full_name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">{account.full_name}</h2>
        <StatusBadge
          tone={account.status === 'active' ? 'success' : 'danger'}
          label={account.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
        />
        {account.must_change_password ? <StatusBadge tone="warning" label="Chờ đổi mật khẩu" /> : null}
      </div>
      <p className="text-content text-text-secondary">
        {[account.phone, account.username, account.valid_until ? `hết hiệu lực ${account.valid_until}` : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toggleLock.mutate()} disabled={toggleLock.isPending}>
          {account.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
        </Button>
        <Button onClick={() => setConfirmingReset(true)}>Đặt lại mật khẩu</Button>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-label font-semibold text-text-secondary">VAI TRÒ</h3>
        <ul className="flex flex-col gap-1">
          {account.assignments.map((assignment) => (
            <li key={assignment.assignment_id} className="flex items-center gap-3 text-content">
              <span>
                {assignment.role_name} — {unitName(units, assignment.org_unit_id)}
              </span>
              {canAssignRoles ? (
                <Button variant="text" onClick={() => setRemoving(assignment)}>
                  Gỡ
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canAssignRoles ? (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <RoleGrantFields roles={roles} units={units} value={grant} onChange={setGrant} idPrefix="assign" />
            <div>
              <Button onClick={() => assign.mutate()} disabled={assign.isPending || !grant.role_code}>
                Gán vai trò
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {confirmingReset ? (
        <ConfirmDialog
          open
          title={`Đặt lại mật khẩu của ${account.full_name}?`}
          confirmLabel="Đặt lại"
          busy={reset.isPending}
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => reset.mutate()}
        >
          Mật khẩu hiện tại hết dùng được và mọi phiên đăng nhập của tài khoản bị thu hồi. Hệ thống sinh mật khẩu tạm để
          bạn chuyển cho người dùng.
        </ConfirmDialog>
      ) : null}
      {removing ? (
        <ConfirmDeleteDialog
          open
          title="Gỡ vai trò"
          subject={`vai trò ${removing.role_name} — ${unitName(units, removing.org_unit_id)} của ${account.full_name}`}
          confirmLabel="Gỡ"
          busy={unassign.isPending}
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => unassign.mutate(removing.assignment_id)}
        >
          Người dùng mất các quyền của vai trò này ở đơn vị đã gán; có thể gán lại sau.
        </ConfirmDeleteDialog>
      ) : null}
    </section>
  );
}

export function AccountsPage() {
  const canAssignRoles = useHasPermission(PERMISSION_CODES.accountManage);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [temporaryPassword, setTemporaryPassword] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const queryClient = useQueryClient();
  const grid = useGridSettings('accounts');
  const pageSize = grid.settings.pageSize;

  const accounts = useQuery({
    queryKey: ['accounts', q, status, page, pageSize],
    queryFn: () => listAccounts({ q, status, page, pageSize }),
    enabled: grid.ready,
    // Giữ danh sách cũ trên lưới khi đổi trang, đổi bộ lọc
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const selected = accounts.data?.items.find((account) => account.id === selectedId);

  // Cột theo danh sách người dùng của Sở (1.4); cột ẩn mặc định bật ở "Cấu hình cột hiển thị"
  const columns: Array<DataGridColumn<Account>> = [
    {
      id: 'full_name',
      header: 'Họ tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (account) => account.full_name,
    },
    { id: 'login', header: 'Đăng nhập', cell: (account) => account.phone ?? account.username },
    {
      id: 'roles',
      header: 'Vai trò',
      cell: (account) => account.assignments.map((assignment) => assignment.role_code).join(', '),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (account) => (
        <StatusBadge
          tone={account.status === 'active' ? 'success' : 'danger'}
          label={account.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
        />
      ),
    },
    { id: 'username', header: 'Tên đăng nhập', hiddenByDefault: true, cell: (account) => account.username ?? '' },
    { id: 'phone', header: 'Số điện thoại', hiddenByDefault: true, cell: (account) => account.phone ?? '' },
    {
      id: 'valid_until',
      header: 'Ngày hết hiệu lực',
      hiddenByDefault: true,
      cell: (account) => account.valid_until ?? '',
    },
    {
      id: 'must_change_password',
      header: 'Đổi mật khẩu',
      hiddenByDefault: true,
      cell: (account) => (account.must_change_password ? 'Chờ đổi mật khẩu' : ''),
    },
    {
      id: 'password_changed_at',
      header: 'Thời gian đổi mật khẩu',
      hiddenByDefault: true,
      cell: (account) =>
        account.password_changed_at
          ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
              new Date(account.password_changed_at),
            )
          : '',
    },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <TemporaryPasswordDialog password={temporaryPassword} onClose={() => setTemporaryPassword(undefined)} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Tài khoản</h1>
        {accounts.isError ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
          <DataGrid
            label="Danh sách tài khoản"
            columns={columns}
            rows={accounts.data?.items ?? []}
            getRowId={(account) => account.id}
            getRowLabel={(account) => account.full_name}
            loading={accounts.isPending}
            emptyText="Không có tài khoản phù hợp."
            search={{
              label: 'Tìm theo tên, số điện thoại, tên đăng nhập',
              value: q,
              onChange: (value) => {
                setQ(value);
                setPage(1);
              },
            }}
            advancedSearch={
              <div className="flex flex-col gap-2">
                <label htmlFor="account-status" className="text-label font-medium text-text">
                  Trạng thái
                </label>
                <select
                  id="account-status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="w-56 rounded-lg border border-border bg-card px-3 py-2 text-content"
                >
                  <option value="">Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="locked">Đã khóa</option>
                </select>
              </div>
            }
            toolbar={
              <Button variant="primary" onClick={() => setSelectedId(undefined)}>
                Thêm mới
              </Button>
            }
            selectable
            rowActions={(account) => (
              <Button
                variant="text"
                aria-label={`Hồ sơ ${account.full_name}`}
                onClick={() => setSelectedId(account.id)}
              >
                Hồ sơ
              </Button>
            )}
            onRowClick={(account) => setSelectedId(account.id)}
            activeRowId={selectedId}
            settings={grid.settings}
            onSettingsChange={(next) => {
              grid.update(next);
              setPage(1);
            }}
            serverPagination={{ page, total: accounts.data?.total ?? 0, onPageChange: setPage }}
          />

          <aside className="flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-4">
            {selected ? (
              <>
                <AccountDetail
                  key={selected.id}
                  account={selected}
                  roles={roles.data ?? []}
                  units={units.data ?? []}
                  canAssignRoles={canAssignRoles}
                  onChanged={setToastMessage}
                  onTemporaryPassword={setTemporaryPassword}
                />
                <Button variant="text" onClick={() => setSelectedId(undefined)}>
                  Tạo tài khoản mới
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-section-title font-semibold text-text">Tạo tài khoản</h2>
                <CreateAccountForm
                  roles={roles.data ?? []}
                  units={units.data ?? []}
                  onCreated={(result) => {
                    void queryClient.invalidateQueries({ queryKey: ['accounts'] });
                    // Tài khoản phụ huynh dùng mật khẩu mặc định chung, không có mật khẩu tạm (PQ-06)
                    if (result.temporary_password) {
                      setTemporaryPassword(result.temporary_password);
                    }
                    setToastMessage(
                      result.uses_default_password
                        ? `Đã tạo tài khoản ${result.account.full_name}, dùng mật khẩu mặc định của phụ huynh`
                        : `Đã tạo tài khoản ${result.account.full_name}`,
                    );
                  }}
                />
              </>
            )}
          </aside>
        </div>
        {canAssignRoles ? <PasswordPolicySection onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
