import { useCallback, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField, Toast } from '@school-management/ui';
import { listOrgUnits, type OrgUnit } from '../org-units/org-units-api.js';
import { AppShell } from '../pages/AppShell.js';
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

// MH-30 phần tài khoản: danh sách, tạo, khóa, mở khóa, đặt lại mật khẩu, gán vai trò (P01-06, P01-07, PQ-13)
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
      await refresh();
      onChanged('Đã gỡ vai trò');
    },
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
                <Button variant="text" onClick={() => unassign.mutate(assignment.assignment_id)}>
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

  const accounts = useQuery({
    queryKey: ['accounts', q, status, page],
    queryFn: () => listAccounts({ q, status, page }),
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const selected = accounts.data?.items.find((account) => account.id === selectedId);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <TemporaryPasswordDialog password={temporaryPassword} onClose={() => setTemporaryPassword(undefined)} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Tài khoản</h1>
        {accounts.isError ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Danh sách tài khoản"
          >
            <div className="flex flex-wrap items-end gap-3">
              <TextField
                label="Tìm theo tên, số điện thoại, tên đăng nhập"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                className="min-w-64 flex-1"
              />
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
                  className="rounded-lg border border-border bg-card px-3 py-2 text-content"
                >
                  <option value="">Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="locked">Đã khóa</option>
                </select>
              </div>
            </div>
            {accounts.isPending ? (
              <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
            ) : (
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Đăng nhập</th>
                    <th className="px-3 py-2">Vai trò</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(accounts.data?.items ?? []).map((account) => (
                    <tr
                      key={account.id}
                      onClick={() => setSelectedId(account.id)}
                      className={`cursor-pointer border-t border-border hover:bg-selected ${account.id === selectedId ? 'bg-selected' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium">{account.full_name}</td>
                      <td className="px-3 py-2">{account.phone ?? account.username}</td>
                      <td className="px-3 py-2">
                        {account.assignments.map((assignment) => assignment.role_code).join(', ')}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={account.status === 'active' ? 'success' : 'danger'}
                          label={account.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {accounts.data && accounts.data.total_pages > 1 ? (
              <div className="flex items-center gap-3">
                <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Trang trước
                </Button>
                <span className="text-label text-text-secondary">
                  Trang {page} / {accounts.data.total_pages}
                </span>
                <Button disabled={page >= accounts.data.total_pages} onClick={() => setPage(page + 1)}>
                  Trang sau
                </Button>
              </div>
            ) : null}
          </section>

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
      </div>
    </AppShell>
  );
}
