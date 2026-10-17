import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { WHOLE_SCHOOL_ROLE_CODES } from '@school-management/shared';
import { Alert, ConfirmDialog } from '@school-management/ui';
import type { OrgUnit } from '../org-units/org-units-api.js';
import { ApiError } from '../session/api-client.js';
import {
  bulkAddRole,
  bulkResetPassword,
  createStaffAccounts,
  listStaffWithoutAccount,
  type BulkPasswordResult,
  type DirectoryAccount,
  type Role,
  type RoleGrant,
  type StaffAccountResult,
} from './accounts-api.js';
import { RoleGrantFields } from './RoleGrantFields.js';

// Thao tác hàng loạt của 1.4 Danh sách người dùng theo Sở (DT-16 phần 16d): Phân nhóm quyền, Cấp mật khẩu cho các dòng
// đã chọn; Lấy danh sách CBQL/GV tạo tài khoản cho nhân sự chưa có. Mật khẩu tạm chỉ hiển thị một lần (PQ-14)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const TABLE_CLASS = 'mt-3 w-full border-collapse text-left text-label';
const CELL_CLASS = 'border-b border-border px-2 py-1';

export function BulkRoleDialog({
  accounts,
  roles,
  units,
  onClose,
  onDone,
}: {
  accounts: DirectoryAccount[];
  roles: Role[];
  units: OrgUnit[];
  onClose(): void;
  onDone(message: string): void;
}) {
  const [grant, setGrant] = useState<RoleGrant>({ role_code: '', org_unit_id: null });
  const assign = useMutation({
    mutationFn: () =>
      bulkAddRole(
        accounts.map((account) => account.id),
        grant,
      ),
  });
  const skipped = assign.data?.items.filter((item) => !item.added) ?? [];

  if (assign.data) {
    const added = assign.data.items.length - skipped.length;
    return (
      <ConfirmDialog
        open
        title="Kết quả phân nhóm quyền"
        confirmLabel="Đóng"
        onCancel={onClose}
        onConfirm={() => {
          onDone(`Đã phân nhóm quyền cho ${added} tài khoản`);
          onClose();
        }}
      >
        <p>
          Đã gán nhóm cho {added}/{assign.data.items.length} tài khoản. Các tài khoản được gán phải đăng nhập lại.
        </p>
        {skipped.length > 0 ? (
          <table className={TABLE_CLASS} aria-label="Tài khoản bỏ qua">
            <tbody>
              {skipped.map((item) => (
                <tr key={item.user_id}>
                  <td className={CELL_CLASS}>{item.full_name}</td>
                  <td className={CELL_CLASS}>{item.skipped_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ConfirmDialog>
    );
  }
  const unitRequired =
    grant.role_code !== '' && !(WHOLE_SCHOOL_ROLE_CODES as readonly string[]).includes(grant.role_code);
  return (
    <ConfirmDialog
      open
      title={`Phân nhóm quyền cho ${accounts.length} tài khoản`}
      confirmLabel="Ghi"
      busy={assign.isPending}
      onCancel={onClose}
      onConfirm={() => {
        if (grant.role_code && (!unitRequired || grant.org_unit_id)) {
          assign.mutate();
        }
      }}
    >
      {assign.error ? <Alert tone="danger">{messageOf(assign.error)}</Alert> : null}
      <p className="mb-3">Thêm nhóm quyền dưới đây cho các tài khoản đã chọn; nhóm đang có của tài khoản giữ nguyên.</p>
      <RoleGrantFields roles={roles} units={units} value={grant} onChange={setGrant} idPrefix="bulk" />
    </ConfirmDialog>
  );
}

function PasswordTable({
  rows,
}: {
  rows: Array<{ key: string; name: string | null; login: string | null; password: string | null; note: string | null }>;
}) {
  return (
    <table className={TABLE_CLASS} aria-label="Mật khẩu tạm">
      <thead>
        <tr>
          <th className={CELL_CLASS}>Họ tên</th>
          <th className={CELL_CLASS}>Tên đăng nhập</th>
          <th className={CELL_CLASS}>Mật khẩu tạm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className={CELL_CLASS}>{row.name}</td>
            <td className={CELL_CLASS}>{row.login}</td>
            <td className={`${CELL_CLASS} font-mono`} data-testid="bulk-temporary-password">
              {row.password ?? <span className="font-sans text-danger">{row.note}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BulkPasswordDialog({
  accounts,
  onClose,
  onDone,
}: {
  accounts: DirectoryAccount[];
  onClose(): void;
  onDone(message: string): void;
}) {
  const reset = useMutation({ mutationFn: () => bulkResetPassword(accounts.map((account) => account.id)) });

  if (reset.data) {
    const items: BulkPasswordResult[] = reset.data.items;
    const issued = items.filter((item) => item.temporary_password).length;
    return (
      <ConfirmDialog
        open
        title="Mật khẩu tạm"
        confirmLabel="Đã ghi lại"
        onCancel={onClose}
        onConfirm={() => {
          onDone(`Đã cấp mật khẩu cho ${issued} tài khoản`);
          onClose();
        }}
      >
        <p>
          Chuyển mật khẩu tạm cho từng người dùng. Mật khẩu chỉ hiển thị một lần; người dùng phải đổi ở lần đăng nhập
          sau.
        </p>
        <PasswordTable
          rows={items.map((item) => ({
            key: item.user_id,
            name: item.full_name,
            login: item.login,
            password: item.temporary_password,
            note: item.skipped_reason,
          }))}
        />
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      open
      title={`Cấp mật khẩu cho ${accounts.length} tài khoản?`}
      confirmLabel="Cấp mật khẩu"
      busy={reset.isPending}
      onCancel={onClose}
      onConfirm={() => reset.mutate()}
    >
      {reset.error ? <Alert tone="danger">{messageOf(reset.error)}</Alert> : null}
      Mật khẩu hiện tại của các tài khoản đã chọn hết dùng được và mọi phiên đăng nhập bị thu hồi. Hệ thống sinh mỗi tài
      khoản một mật khẩu tạm, bắt buộc đổi khi đăng nhập.
    </ConfirmDialog>
  );
}

export function StaffAccountsDialog({
  roles,
  onClose,
  onDone,
}: {
  roles: Role[];
  onClose(): void;
  onDone(message: string): void;
}) {
  const staff = useQuery({ queryKey: ['staff-without-account'], queryFn: listStaffWithoutAccount });
  const [chosen, setChosen] = useState<Set<string>>();
  const [roleCode, setRoleCode] = useState('');
  const create = useMutation({
    mutationFn: (staffIds: string[]) => createStaffAccounts(staffIds, roleCode),
  });
  // Mặc định chọn mọi nhân sự trong danh sách
  const selected = chosen ?? new Set((staff.data ?? []).map((row) => row.id));
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setChosen(next);
  };

  if (create.data) {
    const items: StaffAccountResult[] = create.data.items;
    const created = items.filter((item) => !item.error).length;
    return (
      <ConfirmDialog
        open
        title="Kết quả lấy danh sách CBQL/GV"
        confirmLabel="Đã ghi lại"
        onCancel={onClose}
        onConfirm={() => {
          onDone(`Đã tạo ${created} tài khoản cho cán bộ, giáo viên`);
          onClose();
        }}
      >
        <p>
          Đã tạo {created}/{items.length} tài khoản. Mật khẩu tạm chỉ hiển thị một lần; người dùng phải đổi ở lần đăng
          nhập đầu.
        </p>
        <PasswordTable
          rows={items.map((item) => ({
            key: item.staff_id,
            name: item.full_name,
            login: item.login,
            password: item.temporary_password,
            note: item.error,
          }))}
        />
      </ConfirmDialog>
    );
  }
  const rows = staff.data ?? [];
  return (
    <ConfirmDialog
      open
      title="Lấy danh sách CBQL/GV"
      confirmLabel="Tạo tài khoản"
      busy={create.isPending}
      onCancel={onClose}
      onConfirm={() => {
        if (roleCode && selected.size > 0) {
          create.mutate([...selected]);
        }
      }}
    >
      {staff.error ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <p className="mb-3">
        Cán bộ, giáo viên đang làm việc chưa có tài khoản. Tên đăng nhập lấy theo mã nhân sự (chữ thường), kèm số điện
        thoại nếu có; nhóm quyền theo đơn vị gán ở đơn vị chính của nhân sự.
      </p>
      <div className="mb-3 flex flex-col gap-2">
        <label htmlFor="staff-account-role" className="text-label font-medium text-text">
          Nhóm quyền
        </label>
        <select
          id="staff-account-role"
          value={roleCode}
          onChange={(event) => setRoleCode(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-content"
        >
          <option value="">Chọn nhóm quyền</option>
          {roles
            .filter((role) => role.is_active && role.code !== 'VT-14')
            .map((role) => (
              <option key={role.id} value={role.code}>
                {role.code} {role.name}
              </option>
            ))}
        </select>
      </div>
      {staff.isPending ? <p>Đang tải danh sách nhân sự…</p> : null}
      {staff.data && rows.length === 0 ? <p>Mọi cán bộ, giáo viên đang làm việc đều đã có tài khoản.</p> : null}
      {rows.length > 0 ? (
        <table className={TABLE_CLASS} aria-label="Nhân sự chưa có tài khoản">
          <thead>
            <tr>
              <th className={CELL_CLASS}>Chọn</th>
              <th className={CELL_CLASS}>Mã nhân sự</th>
              <th className={CELL_CLASS}>Họ tên</th>
              <th className={CELL_CLASS}>Đơn vị</th>
              <th className={CELL_CLASS}>Tên đăng nhập</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={CELL_CLASS}>
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${row.code} ${row.full_name}`}
                    checked={selected.has(row.id)}
                    onChange={(event) => toggle(row.id, event.target.checked)}
                  />
                </td>
                <td className={CELL_CLASS}>{row.code}</td>
                <td className={CELL_CLASS}>{row.full_name}</td>
                <td className={CELL_CLASS}>{row.org_unit_name}</td>
                <td className={CELL_CLASS}>{row.suggested_username ?? row.phone ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </ConfirmDialog>
  );
}
