import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MODULE_NAMES,
  PERMISSION_CODES,
  PORTAL_WORKSPACES,
  menuGatePermissionCodes,
  menuPermissionCodes,
  portalMenuText,
  type PortalMenuNode,
  type PortalWorkspace,
} from '@school-management/shared';
import { Alert, Button, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listPermissions, listRoles, replaceRolePermissions, type Permission, type Role } from './accounts-api.js';

// 1.3 Phân quyền nhóm theo menu (DT-15 phần 15e, lựa chọn 3 của Eric ngày 2026-10-13): ma trận quyền hiển thị theo cây
// menu đánh số; mỗi mục menu liệt kê các mã quyền quyết định mục đó hiện (MENU_PERMISSION_RULES ở gói dùng chung), tích
// mục là chọn hết các quyền đó, vẫn bỏ hoặc chọn được từng quyền. Quyền không gắn với mục menu nào nằm ở "Quyền khác".
// Vẫn lưu bằng điểm cuối thay toàn bộ quyền của vai trò; chỉ VT-01, VT-02 sửa được, máy chủ kiểm tra lại (P01-07, PQ-13)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

// Ô chọn nhiều quyền một lúc: đánh dấu khi đã chọn hết, lưng chừng khi mới chọn một phần
function BulkCheckbox({
  label,
  codes,
  selected,
  disabled,
  onChange,
  children,
}: {
  label: string;
  codes: string[];
  selected: Set<string>;
  disabled: boolean;
  onChange(checked: boolean): void;
  children: ReactNode;
}) {
  const reference = useRef<HTMLInputElement>(null);
  const count = codes.filter((code) => selected.has(code)).length;
  useEffect(() => {
    if (reference.current) {
      reference.current.indeterminate = count > 0 && count < codes.length;
    }
  }, [count, codes.length]);
  return (
    <label className="flex items-center gap-2 text-content font-semibold text-text">
      <input
        ref={reference}
        type="checkbox"
        checked={codes.length > 0 && count === codes.length}
        disabled={disabled || codes.length === 0}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {children}{' '}
        <span className="font-normal text-label text-text-muted">
          ({count}/{codes.length})
        </span>
      </span>
    </label>
  );
}

function PermissionCheckbox({
  permission,
  selected,
  disabled,
  onChange,
}: {
  permission: Permission;
  selected: Set<string>;
  disabled: boolean;
  onChange(code: string, checked: boolean): void;
}) {
  return (
    <label className="flex items-start gap-2 text-content text-text">
      <input
        type="checkbox"
        className="mt-1"
        checked={selected.has(permission.code)}
        disabled={disabled}
        onChange={(event) => onChange(permission.code, event.target.checked)}
      />
      <span>
        {permission.description} <span className="text-label text-text-muted">({permission.code})</span>
      </span>
    </label>
  );
}

// Mọi mã quyền gắn với mục menu nào đó (kể cả quyền ở cổng của nhóm menu cũ)
function codesOnMenu(): Set<string> {
  const codes = new Set<string>();
  const walk = (nodes: PortalMenuNode[]) => {
    for (const node of nodes) {
      if (node.path) {
        for (const code of [...menuPermissionCodes(node.path), ...menuGatePermissionCodes(node.path)]) {
          codes.add(code);
        }
      }
      walk(node.children ?? []);
    }
  };
  for (const workspace of PORTAL_WORKSPACES) {
    walk(workspace.menu);
  }
  return codes;
}

function MenuNodeRows({
  node,
  byCode,
  selected,
  editable,
  setMany,
}: {
  node: PortalMenuNode;
  byCode: Map<string, Permission>;
  selected: Set<string>;
  editable: boolean;
  setMany(codes: string[], checked: boolean): void;
}) {
  if (node.children) {
    return (
      <li className="flex flex-col gap-2">
        <p className="text-content font-semibold text-text-secondary">{portalMenuText(node)}</p>
        <ul className="flex flex-col gap-2 border-l border-border pl-4">
          {node.children.map((child) => (
            <MenuNodeRows
              key={child.number + child.label}
              node={child}
              byCode={byCode}
              selected={selected}
              editable={editable}
              setMany={setMany}
            />
          ))}
        </ul>
      </li>
    );
  }
  const path = node.path;
  const permissions = path
    ? menuPermissionCodes(path).flatMap((code) => {
        const permission = byCode.get(code);
        return permission ? [permission] : [];
      })
    : [];
  const gate = path
    ? menuGatePermissionCodes(path).filter(
        (code) => byCode.has(code) && !permissions.some((item) => item.code === code),
      )
    : [];
  const codes = permissions.map((permission) => permission.code);
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border p-3" aria-label={`Mục ${portalMenuText(node)}`}>
      {codes.length > 0 ? (
        <BulkCheckbox
          label={`Chọn mục ${portalMenuText(node)}`}
          codes={codes}
          selected={selected}
          disabled={!editable}
          onChange={(checked) => setMany(codes, checked)}
        >
          {portalMenuText(node)}
        </BulkCheckbox>
      ) : (
        <p className="text-content font-semibold text-text">
          {portalMenuText(node)}{' '}
          <span className="font-normal text-label text-text-muted">— mọi người dùng đều thấy mục này</span>
        </p>
      )}
      {permissions.length > 0 ? (
        <div className="flex flex-col gap-1 pl-6">
          {permissions.map((permission) => (
            <PermissionCheckbox
              key={permission.code}
              permission={permission}
              selected={selected}
              disabled={!editable}
              onChange={(code, checked) => setMany([code], checked)}
            />
          ))}
        </div>
      ) : null}
      {gate.length > 0 ? (
        <p className="pl-6 text-label text-text-muted">
          Mục chỉ hiện khi nhóm có thêm một trong các quyền: {gate.join(', ')}
        </p>
      ) : null}
    </li>
  );
}

function WorkspaceSection({
  workspace,
  ...rest
}: {
  workspace: PortalWorkspace;
  byCode: Map<string, Permission>;
  selected: Set<string>;
  editable: boolean;
  setMany(codes: string[], checked: boolean): void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={workspace.label}>
      <h3 className="text-section-title font-semibold text-text">{workspace.label}</h3>
      <ul className="flex flex-col gap-3">
        {workspace.menu.map((node) => (
          <MenuNodeRows key={node.number + node.label} node={node} {...rest} />
        ))}
      </ul>
    </section>
  );
}

function RoleMatrix({
  role,
  permissions,
  editable,
  workspaceKey,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  editable: boolean;
  workspaceKey: string;
  onSaved(): void;
}) {
  const [selected, setSelected] = useState(new Set(role.permissions));
  useEffect(() => setSelected(new Set(role.permissions)), [role]);
  const save = useMutation({ mutationFn: () => replaceRolePermissions(role.id, [...selected]), onSuccess: onSaved });
  const byCode = useMemo(() => new Map(permissions.map((permission) => [permission.code, permission])), [permissions]);
  // Quyền khác: không gắn với mục menu nào, nhóm theo phân hệ chức năng
  const otherByModule = useMemo(() => {
    const onMenu = codesOnMenu();
    const groups = new Map<string, Permission[]>();
    for (const permission of permissions.filter((item) => !onMenu.has(item.code))) {
      groups.set(permission.module_code, [...(groups.get(permission.module_code) ?? []), permission]);
    }
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [permissions]);
  const changed = selected.size !== role.permissions.length || role.permissions.some((code) => !selected.has(code));
  const setMany = (codes: string[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const code of codes) {
        if (checked) {
          next.add(code);
        } else {
          next.delete(code);
        }
      }
      return next;
    });
  };
  const allCodes = permissions.map((permission) => permission.code);
  const workspaces = PORTAL_WORKSPACES.filter((workspace) => !workspaceKey || workspace.key === workspaceKey);

  return (
    <section className="flex flex-col gap-4" aria-label={`Quyền của ${role.code}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">
          {role.code} {role.name}
        </h2>
        {role.is_system ? <StatusBadge tone="neutral" label="Nhóm hệ thống" /> : null}
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Đang ghi…' : 'Ghi'}
          </Button>
          <Button onClick={() => setMany(allCodes, true)} disabled={selected.size === allCodes.length}>
            Chọn tất cả quyền
          </Button>
          <Button onClick={() => setMany(allCodes, false)} disabled={selected.size === 0}>
            Bỏ chọn tất cả
          </Button>
          <span className="text-label text-text-muted">
            Đã chọn {selected.size}/{allCodes.length} quyền
          </span>
        </div>
      ) : (
        <Alert tone="info">Chỉ Hiệu trưởng và quản trị nền tảng sửa được quyền của nhóm người dùng.</Alert>
      )}
      {workspaces.map((workspace) => (
        <WorkspaceSection
          key={workspace.key}
          workspace={workspace}
          byCode={byCode}
          selected={selected}
          editable={editable}
          setMany={setMany}
        />
      ))}
      {!workspaceKey && otherByModule.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Quyền khác">
          <h3 className="text-section-title font-semibold text-text">Quyền khác</h3>
          <p className="text-label text-text-muted">
            Quyền thao tác không quyết định mục menu nào hiện, nhóm theo phân hệ chức năng.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {otherByModule.map(([moduleCode, modulePermissions]) => (
              <fieldset key={moduleCode} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <legend className="px-1">
                  <BulkCheckbox
                    label={`Chọn cả nhóm ${moduleCode}`}
                    codes={modulePermissions.map((permission) => permission.code)}
                    selected={selected}
                    disabled={!editable}
                    onChange={(checked) =>
                      setMany(
                        modulePermissions.map((permission) => permission.code),
                        checked,
                      )
                    }
                  >
                    {moduleCode}
                    {MODULE_NAMES[moduleCode] ? ` · ${MODULE_NAMES[moduleCode]}` : ''}
                  </BulkCheckbox>
                </legend>
                {modulePermissions.map((permission) => (
                  <PermissionCheckbox
                    key={permission.code}
                    permission={permission}
                    selected={selected}
                    disabled={!editable}
                    onChange={(code, checked) => setMany([code], checked)}
                  />
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      ) : null}
      {editable ? (
        <div>
          <Button variant="primary" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Đang ghi…' : 'Ghi'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function RolePermissionsPage() {
  const editable = useHasPermission(PERMISSION_CODES.accountManage);
  const queryClient = useQueryClient();
  const search: { role?: string } = useSearch({ strict: false });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });
  const [selectedId, setSelectedId] = useState<string | undefined>(search.role);
  const [workspaceKey, setWorkspaceKey] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/role-permissions')}</h1>
        {roles.isError ? <Alert tone="danger">{messageOf(roles.error)}</Alert> : null}
        {permissions.isError ? <Alert tone="danger">{messageOf(permissions.error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="permission-role" className="text-label font-medium text-text">
              Nhóm người dùng
            </label>
            <select
              id="permission-role"
              value={selected?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-80 rounded-lg border border-border bg-card px-3 py-2 text-content"
            >
              {(roles.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.code} {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="permission-workspace" className="text-label font-medium text-text">
              Phân hệ
            </label>
            <select
              id="permission-workspace"
              value={workspaceKey}
              onChange={(event) => setWorkspaceKey(event.target.value)}
              className="w-72 rounded-lg border border-border bg-card px-3 py-2 text-content"
            >
              <option value="">Tất cả phân hệ và quyền khác</option>
              {PORTAL_WORKSPACES.map((workspace) => (
                <option key={workspace.key} value={workspace.key}>
                  {workspace.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selected && permissions.data ? (
          <RoleMatrix
            key={selected.id}
            role={selected}
            permissions={permissions.data}
            editable={editable}
            workspaceKey={workspaceKey}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: ['roles'] });
              setToastMessage(`Đã ghi quyền của ${selected.code}`);
            }}
          />
        ) : (
          <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
        )}
      </div>
    </AppShell>
  );
}
