import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { createRole, deleteRole, listRoles, updateRole, type Role } from './accounts-api.js';

// MH-30 phần vai trò, theo màn hình 1.1 Nhóm người dùng của Sở (DT-15 phần 15e): danh sách trên lưới dữ liệu chung, thêm
// nhóm bằng biểu mẫu nhãn bên trái và nút Ghi; ma trận quyền chuyển sang 1.3 Phân quyền nhóm theo menu (P01-07, PQ-13).
// DT-16 phần 16d: cột Hiệu lực theo dữ liệu, nút Sửa (tên, hiệu lực) và Xóa qua hộp xác nhận xóa; máy chủ không cho xóa
// nhóm hệ thống hoặc nhóm đang có người dùng, không cho ngừng hiệu lực nhóm hệ thống
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

// Nhóm quản trị là nhóm có quyền quản lý tài khoản (toàn trường hoặc theo đơn vị)
function isAdministratorRole(role: Role): boolean {
  return (
    role.permissions.includes(PERMISSION_CODES.accountManage) ||
    role.permissions.includes(PERMISSION_CODES.accountManageInUnit)
  );
}

// Biểu mẫu thêm mới (role chưa có) hoặc sửa nhóm; mã nhóm không sửa được
function RoleForm({ role, onSaved, onCancel }: { role?: Role; onSaved(role: Role): void; onCancel(): void }) {
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [active, setActive] = useState(role?.is_active ?? true);
  const save = useMutation({
    mutationFn: () => (role ? updateRole(role.id, { name, is_active: active }) : createRole(code, name)),
    onSuccess: onSaved,
  });
  const fieldErrors = fieldErrorsOf(save.error);
  const title = role ? `Sửa nhóm người dùng ${role.code}` : 'Thêm nhóm người dùng';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={title}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {save.error && Object.keys(fieldErrors).length === 0 ? (
        <Alert tone="danger">{messageOf(save.error)}</Alert>
      ) : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label font-semibold text-text-secondary">THÔNG TIN CHUNG</legend>
        <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[180px_1fr]">
          <label htmlFor="role-code" className="pt-2 text-label font-medium text-text">
            Mã nhóm
          </label>
          <div className="flex flex-col gap-1">
            <input
              id="role-code"
              value={code}
              readOnly={Boolean(role)}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              aria-invalid={fieldErrors.code ? true : undefined}
              className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-content read-only:bg-page"
            />
            {fieldErrors.code ? <p className="text-label text-danger">{fieldErrors.code}</p> : null}
          </div>
          <label htmlFor="role-name" className="pt-2 text-label font-medium text-text">
            Tên nhóm
          </label>
          <div className="flex flex-col gap-1">
            <input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={fieldErrors.name ? true : undefined}
              className="w-full max-w-xl rounded-lg border border-border bg-card px-3 py-2 text-content"
            />
            {fieldErrors.name ? <p className="text-label text-danger">{fieldErrors.name}</p> : null}
          </div>
          {role ? (
            <>
              <span className="pt-2 text-label font-medium text-text">Hiệu lực</span>
              <label className="flex items-center gap-2 pt-2 text-content text-text">
                <input
                  type="checkbox"
                  checked={active}
                  disabled={role.is_system}
                  onChange={(event) => setActive(event.target.checked)}
                />
                Nhóm đang có hiệu lực
                {role.is_system ? (
                  <span className="text-label text-text-secondary">(nhóm hệ thống luôn có hiệu lực)</span>
                ) : null}
              </label>
            </>
          ) : null}
        </div>
      </fieldset>
      {role && !active ? (
        <Alert tone="warning">
          Người dùng thuộc nhóm hết hiệu lực mất mọi quyền và phân hệ của nhóm này từ yêu cầu kế tiếp.
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? 'Đang ghi…' : 'Ghi'}
        </Button>
        <Button onClick={onCancel}>Đóng</Button>
      </div>
    </form>
  );
}

export function RolesPage() {
  const editable = useHasPermission(PERMISSION_CODES.accountManage);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const grid = useGridSettings('roles');
  const [keyword, setKeyword] = useState('');
  // undefined: không mở biểu mẫu; null: thêm mới; nhóm: sửa nhóm đó
  const [editing, setEditing] = useState<Role | null>();
  const [deleting, setDeleting] = useState<Role>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const remove = useMutation({
    mutationFn: (role: Role) => deleteRole(role.id),
    onSuccess: async (_result, role) => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      setToastMessage(`Đã xóa nhóm người dùng ${role.code}`);
    },
    onError: () => setDeleting(undefined),
  });

  const normalized = keyword.trim().toLowerCase();
  const rows = (roles.data ?? []).filter(
    (role) => !normalized || `${role.code} ${role.name}`.toLowerCase().includes(normalized),
  );
  const openPermissions = (role: Role) => void navigate({ to: '/role-permissions', search: { role: role.id } });

  // Cột theo màn hình Nhóm người dùng của Sở
  const columns: Array<DataGridColumn<Role>> = [
    { id: 'code', header: 'Mã nhóm', alwaysVisible: true, className: 'font-medium', cell: (role) => role.code },
    { id: 'name', header: 'Tên nhóm', cell: (role) => role.name },
    {
      id: 'active',
      header: 'Hiệu lực',
      cell: (role) =>
        role.is_active ? <StatusBadge tone="success" label="Có" /> : <StatusBadge tone="danger" label="Không" />,
    },
    { id: 'administrator', header: 'Là nhóm quản trị', cell: (role) => (isAdministratorRole(role) ? 'Có' : '') },
    { id: 'system', header: 'Là nhóm hệ thống', cell: (role) => (role.is_system ? 'Có' : '') },
    {
      id: 'permission_count',
      header: 'Số quyền',
      hiddenByDefault: true,
      cell: (role) => role.permissions.length,
    },
    { id: 'user_count', header: 'Số người dùng', hiddenByDefault: true, cell: (role) => role.user_count },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/roles')}</h1>
        {roles.isError ? <Alert tone="danger">{messageOf(roles.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {editing !== undefined ? (
          <RoleForm
            key={editing?.id ?? 'new'}
            role={editing ?? undefined}
            onCancel={() => setEditing(undefined)}
            onSaved={async (role) => {
              const created = editing === null;
              setEditing(undefined);
              await queryClient.invalidateQueries({ queryKey: ['roles'] });
              setToastMessage(created ? `Đã thêm nhóm người dùng ${role.code}` : `Đã ghi nhóm người dùng ${role.code}`);
            }}
          />
        ) : null}
        <DataGrid
          label="Danh sách nhóm người dùng"
          columns={columns}
          rows={rows}
          getRowId={(role) => role.id}
          getRowLabel={(role) => `${role.code} ${role.name}`}
          loading={roles.isPending}
          emptyText="Không có nhóm người dùng phù hợp."
          search={{ label: 'Tìm theo mã, tên nhóm', value: keyword, onChange: setKeyword }}
          toolbar={
            editable ? (
              <Button
                variant="primary"
                onClick={() => {
                  remove.reset();
                  setEditing(null);
                }}
                disabled={editing === null}
              >
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={(role) => (
            <div className="flex gap-1">
              {editable ? (
                <Button
                  variant="text"
                  aria-label={`Sửa ${role.code}`}
                  onClick={() => {
                    remove.reset();
                    setEditing(role);
                  }}
                >
                  Sửa
                </Button>
              ) : null}
              <Button variant="text" aria-label={`Phân quyền ${role.code}`} onClick={() => openPermissions(role)}>
                Phân quyền
              </Button>
              {editable && !role.is_system ? (
                <Button
                  variant="text"
                  aria-label={`Xóa ${role.code}`}
                  onClick={() => {
                    remove.reset();
                    setDeleting(role);
                  }}
                >
                  Xóa
                </Button>
              ) : null}
            </div>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {deleting ? (
        <ConfirmDeleteDialog
          open
          title="Xóa nhóm người dùng"
          subject={`nhóm người dùng ${deleting.code} ${deleting.name}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        >
          Quyền và phân hệ của nhóm bị xóa theo. Nhóm đang có người dùng thì không xóa được; hãy ngừng hiệu lực thay vì
          xóa.
        </ConfirmDeleteDialog>
      ) : null}
    </AppShell>
  );
}
