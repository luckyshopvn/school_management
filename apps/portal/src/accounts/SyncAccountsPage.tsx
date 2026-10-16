import { useCallback, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDeleteDialog, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { deleteSyncAccount, listSyncAccounts, saveSyncAccount, type SyncAccount } from './accounts-api.js';

// 1.6 Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d, bản chạy nội bộ): biểu mẫu theo khối, nhãn bên trái, nút Ghi. Máy
// chủ lưu mật khẩu đã mã hóa và không bao giờ trả lại; ô mật khẩu để trống khi ghi thì giữ mật khẩu đã lưu. Chưa có giao
// diện lập trình của Bộ, Sở nên chưa đồng bộ được, màn hình ghi rõ điều này
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

function SyncAccountForm({
  account,
  onSaved,
  onDelete,
}: {
  account: SyncAccount;
  onSaved(message: string): void;
  onDelete(account: SyncAccount): void;
}) {
  const [username, setUsername] = useState(account.username ?? '');
  const [password, setPassword] = useState('');
  const save = useMutation({
    mutationFn: () => saveSyncAccount(account.target, { username, password }),
    onSuccess: () => {
      setPassword('');
      onSaved(`Đã ghi ${account.label.toLowerCase()}`);
    },
  });
  const fieldErrors = fieldErrorsOf(save.error);
  const idPrefix = `sync-${account.target}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={account.label}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">{account.label}</h2>
        {account.password_configured ? (
          <StatusBadge tone="success" label="Đã lưu" />
        ) : (
          <StatusBadge tone="neutral" label="Chưa lưu" />
        )}
        <StatusBadge tone="warning" label={account.sync_available ? 'Đồng bộ được' : 'Chưa đồng bộ được'} />
      </div>
      {save.error && Object.keys(fieldErrors).length === 0 ? (
        <Alert tone="danger">{messageOf(save.error)}</Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[180px_1fr]">
        <label htmlFor={`${idPrefix}-username`} className="pt-2 text-label font-medium text-text">
          Tên đăng nhập
        </label>
        <div className="flex flex-col gap-1">
          <input
            id={`${idPrefix}-username`}
            value={username}
            autoComplete="off"
            onChange={(event) => setUsername(event.target.value)}
            aria-invalid={fieldErrors.username ? true : undefined}
            className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-content"
          />
          {fieldErrors.username ? <p className="text-label text-danger">{fieldErrors.username}</p> : null}
        </div>
        <label htmlFor={`${idPrefix}-password`} className="pt-2 text-label font-medium text-text">
          Mật khẩu
        </label>
        <div className="flex flex-col gap-1">
          <input
            id={`${idPrefix}-password`}
            type="password"
            value={password}
            autoComplete="new-password"
            placeholder={account.password_configured ? 'Để trống để giữ mật khẩu đã lưu' : ''}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fieldErrors.password ? true : undefined}
            className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-content"
          />
          {fieldErrors.password ? <p className="text-label text-danger">{fieldErrors.password}</p> : null}
        </div>
        {account.updated_at ? (
          <>
            <span className="text-label font-medium text-text">Cập nhật lúc</span>
            <span className="text-content text-text-secondary">
              {new Date(account.updated_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? 'Đang ghi…' : 'Ghi'}
        </Button>
        {account.password_configured || account.username ? (
          <Button onClick={() => onDelete(account)}>Xóa thông tin</Button>
        ) : null}
      </div>
    </form>
  );
}

export function SyncAccountsPage() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ['sync-accounts'], queryFn: listSyncAccounts });
  const [deleting, setDeleting] = useState<SyncAccount>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sync-accounts'] });
  const remove = useMutation({
    mutationFn: (account: SyncAccount) => deleteSyncAccount(account.target),
    onSuccess: async (_result, account) => {
      setDeleting(undefined);
      await refresh();
      setToastMessage(`Đã xóa ${account.label.toLowerCase()}`);
    },
    onError: () => setDeleting(undefined),
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/sync-accounts')}</h1>
        <Alert tone="info">
          Tên đăng nhập, mật khẩu nhà trường dùng để đồng bộ hồ sơ lên CSDL ngành của Bộ GD&ĐT và của Sở GD&ĐT. Mật khẩu
          được mã hóa khi lưu và không hiển thị lại. Hệ thống chưa đồng bộ được vì chưa có giao diện lập trình của Bộ,
          Sở; khi có sẽ dùng các tài khoản này.
        </Alert>
        {accounts.isError ? <Alert tone="danger">{messageOf(accounts.error)}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {(accounts.data ?? []).map((account) => (
          <SyncAccountForm
            key={`${account.target}-${account.updated_at ?? ''}`}
            account={account}
            onSaved={async (message) => {
              await refresh();
              setToastMessage(message);
            }}
            onDelete={setDeleting}
          />
        ))}
      </div>
      {deleting ? (
        <ConfirmDeleteDialog
          open
          title="Xóa tài khoản đồng bộ"
          subject={deleting.label.toLowerCase()}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        >
          Tên đăng nhập và mật khẩu đã lưu bị xóa; nhập lại khi cần.
        </ConfirmDeleteDialog>
      ) : null}
    </AppShell>
  );
}
