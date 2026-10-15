import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { createRole, listRoles, type Role } from './accounts-api.js';

// MH-30 phần vai trò, theo màn hình 1.1 Nhóm người dùng của Sở (DT-15 phần 15e): danh sách trên lưới dữ liệu chung, thêm
// nhóm bằng biểu mẫu nhãn bên trái và nút Ghi; ma trận quyền chuyển sang 1.3 Phân quyền nhóm theo menu (P01-07, PQ-13)
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

function CreateRoleForm({ onCreated, onCancel }: { onCreated(role: Role): void; onCancel(): void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const create = useMutation({ mutationFn: () => createRole(code, name), onSuccess: onCreated });
  const fieldErrors = fieldErrorsOf(create.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Thêm nhóm người dùng"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-section-title font-semibold text-text">Thêm nhóm người dùng</h2>
      {create.error && Object.keys(fieldErrors).length === 0 ? (
        <Alert tone="danger">{messageOf(create.error)}</Alert>
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
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              aria-invalid={fieldErrors.code ? true : undefined}
              className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-content"
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
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? 'Đang ghi…' : 'Ghi'}
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
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const normalized = keyword.trim().toLowerCase();
  const rows = (roles.data ?? []).filter(
    (role) => !normalized || `${role.code} ${role.name}`.toLowerCase().includes(normalized),
  );
  const openPermissions = (role: Role) => void navigate({ to: '/role-permissions', search: { role: role.id } });

  // Cột theo màn hình Nhóm người dùng của Sở; mọi nhóm đang dùng được nên Hiệu lực luôn là "Có"
  const columns: Array<DataGridColumn<Role>> = [
    { id: 'code', header: 'Mã nhóm', alwaysVisible: true, className: 'font-medium', cell: (role) => role.code },
    { id: 'name', header: 'Tên nhóm', cell: (role) => role.name },
    { id: 'active', header: 'Hiệu lực', cell: () => <StatusBadge tone="success" label="Có" /> },
    { id: 'administrator', header: 'Là nhóm quản trị', cell: (role) => (isAdministratorRole(role) ? 'Có' : '') },
    { id: 'system', header: 'Là nhóm hệ thống', cell: (role) => (role.is_system ? 'Có' : '') },
    {
      id: 'permission_count',
      header: 'Số quyền',
      hiddenByDefault: true,
      cell: (role) => role.permissions.length,
    },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/roles')}</h1>
        {roles.isError ? <Alert tone="danger">{messageOf(roles.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {creating ? (
          <CreateRoleForm
            onCancel={() => setCreating(false)}
            onCreated={async (role) => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['roles'] });
              setToastMessage(`Đã thêm nhóm người dùng ${role.code}`);
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
              <Button variant="primary" onClick={() => setCreating(true)} disabled={creating}>
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={(role) => (
            <Button variant="text" aria-label={`Phân quyền ${role.code}`} onClick={() => openPermissions(role)}>
              Phân quyền
            </Button>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
