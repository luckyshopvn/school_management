import { useCallback, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, PORTAL_WORKSPACES } from '@school-management/shared';
import { Alert, Button, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listRoles, replaceRoleWorkspaces, type Role } from './accounts-api.js';

// 1.2 Phân quyền nhóm theo phần mềm theo Sở (DT-16 phần 16d): chọn nhóm người dùng, tích các phân hệ của cổng quản trị
// nhóm được dùng. Phân hệ không có nhóm nào của tài khoản được dùng thì ẩn khỏi ô chọn phân hệ và menu. Quyền theo thao
// tác vẫn chỉnh ở 1.3 Phân quyền nhóm theo menu, máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (PQ-13)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function WorkspaceChoices({ role, editable, onSaved }: { role: Role; editable: boolean; onSaved(role: Role): void }) {
  const [selected, setSelected] = useState(() => new Set(role.workspaces));
  const save = useMutation({
    mutationFn: () =>
      replaceRoleWorkspaces(
        role.id,
        PORTAL_WORKSPACES.map((workspace) => workspace.key).filter((key) => selected.has(key)),
      ),
    onSuccess: onSaved,
  });
  const changed = selected.size !== role.workspaces.length || role.workspaces.some((key) => !selected.has(key));
  const toggle = (key: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label={`Phân hệ của ${role.code}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">
          {role.code} {role.name}
        </h2>
        {role.is_system ? <StatusBadge tone="neutral" label="Nhóm hệ thống" /> : null}
        {!role.is_active ? <StatusBadge tone="danger" label="Hết hiệu lực" /> : null}
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {!editable ? (
        <Alert tone="info">Chỉ Hiệu trưởng và quản trị nền tảng sửa được phân hệ của nhóm người dùng.</Alert>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label font-semibold text-text-secondary">PHẦN MỀM (PHÂN HỆ) ĐƯỢC DÙNG</legend>
        {PORTAL_WORKSPACES.map((workspace) => (
          <label key={workspace.key} className="flex items-center gap-2 text-content text-text">
            <input
              type="checkbox"
              checked={selected.has(workspace.key)}
              disabled={!editable}
              onChange={(event) => toggle(workspace.key, event.target.checked)}
            />
            {workspace.label}
          </label>
        ))}
      </fieldset>
      <p className="text-label text-text-muted">
        Phân hệ chỉ quyết định ô chọn phân hệ và menu hiện gì. Mục nào trong phân hệ hiện và được làm gì vẫn theo quyền
        ở 1.3 Phân quyền nhóm theo menu.
      </p>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Đang ghi…' : 'Ghi'}
          </Button>
          <Button
            onClick={() => setSelected(new Set(PORTAL_WORKSPACES.map((workspace) => workspace.key)))}
            disabled={selected.size === PORTAL_WORKSPACES.length}
          >
            Chọn tất cả
          </Button>
          <Button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            Bỏ chọn tất cả
          </Button>
          <span className="text-label text-text-muted">
            Đã chọn {selected.size}/{PORTAL_WORKSPACES.length} phân hệ
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function RoleWorkspacesPage() {
  const editable = useHasPermission(PERMISSION_CODES.accountManage);
  const queryClient = useQueryClient();
  const search: { role?: string } = useSearch({ strict: false });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const [selectedId, setSelectedId] = useState<string | undefined>(search.role);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/role-workspaces')}</h1>
        {roles.isError ? <Alert tone="danger">{messageOf(roles.error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="workspace-role" className="text-label font-medium text-text">
              Nhóm người dùng
            </label>
            <select
              id="workspace-role"
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
        </div>
        {selected ? (
          <WorkspaceChoices
            key={`${selected.id}-${selected.workspaces.join(',')}`}
            role={selected}
            editable={editable}
            onSaved={async (role) => {
              await queryClient.invalidateQueries({ queryKey: ['roles'] });
              // Phân hệ của chính người đang đăng nhập có thể đổi
              await queryClient.invalidateQueries({ queryKey: ['current-user'] });
              setToastMessage(`Đã ghi phân hệ của nhóm ${role.code}`);
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
