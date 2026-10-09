import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createRole,
  listPermissions,
  listRoles,
  replaceRolePermissions,
  type Permission,
  type Role,
} from './accounts-api.js';

// MH-30 phần vai trò và ma trận quyền (P01-07, PQ-09, PQ-13)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function RolePermissions({
  role,
  permissions,
  editable,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  editable: boolean;
  onSaved(): void;
}) {
  const [selected, setSelected] = useState(new Set(role.permissions));
  useEffect(() => setSelected(new Set(role.permissions)), [role]);
  const save = useMutation({ mutationFn: () => replaceRolePermissions(role.id, [...selected]), onSuccess: onSaved });
  const byModule = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of permissions) {
      groups.set(permission.module_code, [...(groups.get(permission.module_code) ?? []), permission]);
    }
    return [...groups.entries()];
  }, [permissions]);
  const changed = selected.size !== role.permissions.length || role.permissions.some((code) => !selected.has(code));

  return (
    <section className="flex flex-col gap-4" aria-label={`Quyền của ${role.code}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">
          {role.code} {role.name}
        </h2>
        {role.is_system ? <StatusBadge tone="neutral" label="Vai trò hệ thống" /> : null}
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {byModule.map(([moduleCode, modulePermissions]) => (
          <fieldset key={moduleCode} className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <legend className="px-1 text-label font-semibold text-text">{moduleCode}</legend>
            {modulePermissions.map((permission) => (
              <label key={permission.code} className="flex items-start gap-2 text-content text-text">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(permission.code)}
                  disabled={!editable}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) {
                      next.add(permission.code);
                    } else {
                      next.delete(permission.code);
                    }
                    setSelected(next);
                  }}
                />
                <span>
                  {permission.description} <span className="text-label text-text-muted">({permission.code})</span>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {editable ? (
        <div>
          <Button variant="primary" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Đang lưu…' : 'Lưu quyền của vai trò'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function RolesPage() {
  const editable = useHasPermission(PERMISSION_CODES.accountManage);
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });
  const [selectedId, setSelectedId] = useState<string>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const create = useMutation({
    mutationFn: () => createRole(code, name),
    onSuccess: async (role) => {
      setCode('');
      setName('');
      setSelectedId(role.id);
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      setToastMessage(`Đã tạo vai trò ${role.code}`);
    },
  });
  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Vai trò và quyền</h1>
        {roles.isError ? <Alert tone="danger">{messageOf(roles.error)}</Alert> : null}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-4">
            <ul className="flex flex-col gap-1" aria-label="Danh sách vai trò">
              {(roles.data ?? []).map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(role.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-content hover:bg-selected ${selected?.id === role.id ? 'bg-selected font-medium' : ''}`}
                  >
                    {role.code} {role.name}
                  </button>
                </li>
              ))}
            </ul>
            {editable ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
                <TextField
                  label="Mã vai trò mới"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
                <TextField label="Tên vai trò mới" value={name} onChange={(event) => setName(event.target.value)} />
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Tạo vai trò
                </Button>
              </div>
            ) : null}
          </aside>
          <div className="rounded-xl border border-border bg-card p-4">
            {selected && permissions.data ? (
              <RolePermissions
                key={selected.id}
                role={selected}
                permissions={permissions.data}
                editable={editable}
                onSaved={() => {
                  void queryClient.invalidateQueries({ queryKey: ['roles'] });
                  setToastMessage(`Đã lưu quyền của ${selected.code}`);
                }}
              />
            ) : (
              <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
