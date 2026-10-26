import { useCallback, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  resolveVisibleColumns,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listOrgUnits, type OrgUnit } from '../org-units/org-units-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  EMPTY_ACCOUNT_FILTER,
  addRole,
  createAccount,
  exportAccounts,
  listAccountDirectory,
  listRoles,
  removeRole,
  resetPassword,
  updateAccount,
  type Account,
  type AccountFilter,
  type DirectoryAccount,
  type Role,
  type RoleGrant,
} from './accounts-api.js';
import { BulkPasswordDialog, BulkRoleDialog, StaffAccountsDialog } from './AccountBulkDialogs.js';
import { UserSchoolLevelsBlock } from '../school-levels/UserSchoolLevelsBlock.js';
import { RoleGrantFields } from './RoleGrantFields.js';
import { PasswordPolicySection } from './PasswordPolicySection.js';
import { ExternalProvidersSection } from './ExternalProvidersSection.js';
import { ImpersonateDialog } from '../administration/ImpersonateDialog.js';

// MH-30 phần tài khoản: danh sách, tạo, khóa, mở khóa, đặt lại mật khẩu, gán vai trò (P01-06, P01-07, PQ-13); danh sách
// dùng lưới dữ liệu chung, gỡ vai trò qua hộp xác nhận xóa (DT-15 phần 15a). DT-16 phần 16d: đủ cột, bộ lọc, nút của Sở
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
  canImpersonate,
  onChanged,
  onTemporaryPassword,
}: {
  account: Account;
  roles: Role[];
  units: OrgUnit[];
  canAssignRoles: boolean;
  canImpersonate: boolean;
  onChanged(message: string): void;
  onTemporaryPassword(password: string): void;
}) {
  const queryClient = useQueryClient();
  const [grant, setGrant] = useState<RoleGrant>({ role_code: '', org_unit_id: null });
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
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
        {canImpersonate && account.status === 'active' ? (
          <Button onClick={() => setImpersonating(true)}>Đăng nhập thay</Button>
        ) : null}
      </div>
      {impersonating ? <ImpersonateDialog account={account} onClose={() => setImpersonating(false)} /> : null}
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
      <UserSchoolLevelsBlock userId={account.id} onChanged={onChanged} />
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

// Loại tài khoản theo vai trò: chỉ có vai trò phụ huynh là tài khoản phụ huynh, có vai trò khác là cán bộ, nhân viên
function accountType(account: Account): string {
  if (account.assignments.length === 0) {
    return 'Chưa có nhóm quyền';
  }
  return account.assignments.every((assignment) => assignment.role_code === 'VT-14')
    ? 'Phụ huynh'
    : 'Cán bộ, nhân viên';
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
}

const FILTER_CONTROL_CLASS = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-content';

function FilterInput({
  id,
  label,
  value,
  type,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: string;
  onChange(value: string): void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FILTER_CONTROL_CLASS}
      />
    </div>
  );
}

type BulkAction = 'roles' | 'password' | 'staff';

export function AccountsPage() {
  const canAssignRoles = useHasPermission(PERMISSION_CODES.accountManage);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  // Đăng nhập thay (DT-18 phần 18h)
  const canImpersonate = useHasPermission(PERMISSION_CODES.accountImpersonate);
  const [filter, setFilter] = useState<AccountFilter>(EMPTY_ACCOUNT_FILTER);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [temporaryPassword, setTemporaryPassword] = useState<string>();
  // Thao tác hàng loạt đang mở và các tài khoản đã chọn trên lưới lúc mở (DT-16 phần 16d)
  const [bulk, setBulk] = useState<{ action: BulkAction; accounts: DirectoryAccount[] }>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const queryClient = useQueryClient();
  const grid = useGridSettings('accounts');
  const pageSize = grid.settings.pageSize;
  // Đổi bộ lọc thì về trang 1
  const changeFilter = (changes: Partial<AccountFilter>) => {
    setFilter((current) => ({ ...current, ...changes }));
    setPage(1);
  };

  // Máy chủ API ghép tài khoản với hồ sơ nhân sự để có Mã nhân sự, Mã Bộ, lọc Mã định danh (DT-16 phần 16d)
  const accounts = useQuery({
    queryKey: ['accounts', filter, page, pageSize],
    queryFn: () => listAccountDirectory({ ...filter, page, pageSize }),
    enabled: grid.ready,
    // Giữ danh sách cũ trên lưới khi đổi trang, đổi bộ lọc
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const selected = accounts.data?.items.find((account) => account.id === selectedId);

  // Cột theo 1.4 Danh sách người dùng của Sở (DT-15 phần 15e, đủ cột ở DT-16 phần 16d); cột ẩn mặc định bật ở "Cấu hình
  // cột hiển thị". Mã cột trùng với cột của tệp Excel ở máy chủ API
  const columns: Array<DataGridColumn<DirectoryAccount>> = [
    { id: 'login', header: 'Tên đăng nhập', cell: (account) => account.username ?? account.phone },
    {
      id: 'full_name',
      header: 'Tên hiển thị',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (account) => account.full_name,
    },
    {
      id: 'roles',
      header: 'Nhóm quyền',
      cell: (account) => [...new Set(account.assignments.map((assignment) => assignment.role_name))].join(', '),
    },
    { id: 'staff_code', header: 'Mã nhân sự', cell: (account) => account.staff_code ?? '' },
    { id: 'moet_staff_code', header: 'Mã Bộ', cell: (account) => account.moet_staff_code ?? '' },
    { id: 'account_type', header: 'Loại tài khoản', cell: accountType },
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
    {
      id: 'must_change_password',
      header: 'Trạng thái đổi mật khẩu',
      cell: (account) => (account.must_change_password ? 'Chờ đổi mật khẩu' : 'Đã đổi'),
    },
    {
      id: 'password_changed_at',
      header: 'Thời gian đổi mật khẩu',
      cell: (account) => formatDateTime(account.password_changed_at),
    },
    {
      id: 'password_expires_at',
      header: 'Ngày hết hạn mật khẩu',
      cell: (account) => formatDate(account.password_expires_at),
    },
    {
      id: 'valid_until',
      header: 'Ngày hết hiệu lực',
      hiddenByDefault: true,
      cell: (account) => account.valid_until ?? '',
    },
    { id: 'phone', header: 'Số điện thoại', hiddenByDefault: true, cell: (account) => account.phone ?? '' },
    {
      id: 'last_login_at',
      header: 'Đăng nhập gần nhất',
      hiddenByDefault: true,
      cell: (account) => formatDateTime(account.last_login_at),
    },
  ];

  const runExport = async () => {
    setExportError(undefined);
    setExporting(true);
    try {
      await exportAccounts(
        filter,
        resolveVisibleColumns(columns, grid.settings.columns).map((column) => column.id),
      );
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
    }
  };
  const afterBulk = async (message?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    if (message) {
      setToastMessage(message);
    }
  };

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <TemporaryPasswordDialog password={temporaryPassword} onClose={() => setTemporaryPassword(undefined)} />
      {bulk?.action === 'roles' ? (
        <BulkRoleDialog
          accounts={bulk.accounts}
          roles={roles.data ?? []}
          units={units.data ?? []}
          onClose={() => setBulk(undefined)}
          onDone={afterBulk}
        />
      ) : null}
      {bulk?.action === 'password' ? (
        <BulkPasswordDialog accounts={bulk.accounts} onClose={() => setBulk(undefined)} onDone={afterBulk} />
      ) : null}
      {bulk?.action === 'staff' ? (
        <StaffAccountsDialog roles={roles.data ?? []} onClose={() => setBulk(undefined)} onDone={afterBulk} />
      ) : null}
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/accounts')}</h1>
        {accounts.isError ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
          <DataGrid
            label="Danh sách người dùng"
            columns={columns}
            rows={accounts.data?.items ?? []}
            getRowId={(account) => account.id}
            getRowLabel={(account) => account.full_name}
            loading={accounts.isPending}
            emptyText="Không có người dùng phù hợp."
            search={{
              label: 'Tìm theo tên, số điện thoại, tên đăng nhập',
              value: filter.q,
              onChange: (value) => changeFilter({ q: value }),
            }}
            // Bộ lọc theo Sở: nhóm quyền, mã định danh, trạng thái, tên đăng nhập, tên nhân sự, trạng thái đổi mật khẩu,
            // ngày hết hạn mật khẩu
            advancedSearch={
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="account-role" className="text-label font-medium text-text">
                    Nhóm quyền
                  </label>
                  <select
                    id="account-role"
                    value={filter.roleCode}
                    onChange={(event) => changeFilter({ roleCode: event.target.value })}
                    className={FILTER_CONTROL_CLASS}
                  >
                    <option value="">Tất cả</option>
                    {(roles.data ?? []).map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.code} {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <FilterInput
                  id="account-identifier"
                  label="Mã định danh"
                  value={filter.identifier}
                  onChange={(value) => changeFilter({ identifier: value })}
                />
                <div className="flex flex-col gap-2">
                  <label htmlFor="account-status" className="text-label font-medium text-text">
                    Trạng thái
                  </label>
                  <select
                    id="account-status"
                    value={filter.status}
                    onChange={(event) => changeFilter({ status: event.target.value })}
                    className={FILTER_CONTROL_CLASS}
                  >
                    <option value="">Tất cả</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="locked">Đã khóa</option>
                  </select>
                </div>
                <FilterInput
                  id="account-login"
                  label="Tên đăng nhập"
                  value={filter.login}
                  onChange={(value) => changeFilter({ login: value })}
                />
                <FilterInput
                  id="account-full-name"
                  label="Tên nhân sự"
                  value={filter.fullName}
                  onChange={(value) => changeFilter({ fullName: value })}
                />
                <div className="flex flex-col gap-2">
                  <label htmlFor="account-password-state" className="text-label font-medium text-text">
                    Trạng thái đổi mật khẩu
                  </label>
                  <select
                    id="account-password-state"
                    value={filter.mustChangePassword}
                    onChange={(event) => changeFilter({ mustChangePassword: event.target.value })}
                    className={FILTER_CONTROL_CLASS}
                  >
                    <option value="">Tất cả</option>
                    <option value="true">Chờ đổi mật khẩu</option>
                    <option value="false">Đã đổi</option>
                  </select>
                </div>
                <FilterInput
                  id="account-expires-from"
                  label="Hết hạn mật khẩu từ ngày"
                  type="date"
                  value={filter.passwordExpiresFrom}
                  onChange={(value) => changeFilter({ passwordExpiresFrom: value })}
                />
                <FilterInput
                  id="account-expires-to"
                  label="Hết hạn mật khẩu đến ngày"
                  type="date"
                  value={filter.passwordExpiresTo}
                  onChange={(value) => changeFilter({ passwordExpiresTo: value })}
                />
              </div>
            }
            // Nút theo Sở: Phân nhóm quyền, Cấp mật khẩu cho các dòng đã chọn; Lấy danh sách CBQL/GV; Xuất Excel
            toolbar={(selectedRows) => (
              <>
                <Button variant="primary" onClick={() => setSelectedId(undefined)}>
                  Thêm mới
                </Button>
                {canAssignRoles ? (
                  <Button
                    disabled={selectedRows.length === 0}
                    onClick={() => setBulk({ action: 'roles', accounts: selectedRows })}
                  >
                    Phân nhóm quyền
                  </Button>
                ) : null}
                <Button
                  disabled={selectedRows.length === 0}
                  onClick={() => setBulk({ action: 'password', accounts: selectedRows })}
                >
                  Cấp mật khẩu
                </Button>
                <Button onClick={() => setBulk({ action: 'staff', accounts: [] })}>Lấy danh sách CBQL/GV</Button>
                {canExport ? (
                  <Button onClick={() => void runExport()} disabled={exporting}>
                    {exporting ? 'Đang xuất…' : 'Xuất Excel'}
                  </Button>
                ) : null}
              </>
            )}
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
                  canImpersonate={canImpersonate}
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
        {canAssignRoles ? <ExternalProvidersSection onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
