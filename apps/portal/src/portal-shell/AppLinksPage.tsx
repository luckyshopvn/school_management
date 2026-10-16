import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listAppLinks, saveAppLinks, type AppLinkInput } from './portal-shell-api.js';

// Quản trị hệ thống 3.6 Ứng dụng liên kết (DT-16 phần 16c): danh sách ứng dụng hiện ở lưới ứng dụng trên thanh đầu trang
// (như ô eNetViet của Sở). Quản trị tự nhập tên, đường dẫn, mô tả; phần mềm không gắn sẵn ứng dụng của bên thứ ba
type Row = { key: number; name: string; url: string; description: string };

let nextKey = 1;
const toRow = (link: Pick<AppLinkInput, 'name' | 'url'> & { description: string | null }): Row => ({
  key: nextKey++,
  name: link.name,
  url: link.url,
  description: link.description ?? '',
});

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function AppLinksPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.announcementManage);
  const links = useQuery({ queryKey: ['app-links'], queryFn: listAppLinks });
  const [rows, setRows] = useState<Row[]>([]);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  useEffect(() => {
    if (links.data) {
      setRows(links.data.map(toRow));
    }
  }, [links.data]);
  const save = useMutation({
    mutationFn: () =>
      saveAppLinks(
        rows.map((row) => ({ name: row.name, url: row.url.trim(), description: row.description.trim() || null })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['app-links'] });
      setToastMessage('Đã ghi danh sách ứng dụng liên kết');
    },
  });
  const fieldError = (index: number, field: string) =>
    save.error instanceof ApiError
      ? save.error.details.find((detail) => detail.field === `links[${index}].${field}`)?.message
      : undefined;
  const update = (index: number, change: Partial<Row>) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, ...change } : row)));
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= rows.length) {
      return;
    }
    const next = [...rows];
    [next[index], next[target]] = [next[target] as Row, next[index] as Row];
    setRows(next);
  };

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/app-links')}</h1>
        <p className="text-label text-text-secondary">
          Ứng dụng trong danh sách hiện ở nút lưới ứng dụng trên thanh đầu trang của mọi người dùng, theo thứ tự dưới đây.
          Đường dẫn bắt đầu bằng http:// hoặc https://, mở ở thẻ mới.
        </p>
        {links.error ? <Alert tone="danger">{messageOf(links.error)}</Alert> : null}
        {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
          <Alert tone="danger">{messageOf(save.error)}</Alert>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-content" aria-label="Danh sách ứng dụng liên kết">
            <thead className="bg-page text-label text-text-secondary">
              <tr>
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Tên ứng dụng</th>
                <th className="px-3 py-2">Đường dẫn</th>
                <th className="px-3 py-2">Mô tả</th>
                <th className="px-3 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-text-secondary">
                    Chưa có ứng dụng liên kết.
                  </td>
                </tr>
              ) : null}
              {rows.map((row, index) => (
                <tr key={row.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      className={FORM_CONTROL_CLASS}
                      aria-label={`Tên ứng dụng dòng ${index + 1}`}
                      value={row.name}
                      maxLength={100}
                      disabled={!canManage}
                      onChange={(event) => update(index, { name: event.target.value })}
                    />
                    {fieldError(index, 'name') ? (
                      <p className="text-label text-danger">{fieldError(index, 'name')}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={FORM_CONTROL_CLASS}
                      aria-label={`Đường dẫn dòng ${index + 1}`}
                      value={row.url}
                      maxLength={500}
                      disabled={!canManage}
                      onChange={(event) => update(index, { url: event.target.value })}
                    />
                    {fieldError(index, 'url') ? (
                      <p className="text-label text-danger">{fieldError(index, 'url')}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={FORM_CONTROL_CLASS}
                      aria-label={`Mô tả dòng ${index + 1}`}
                      value={row.description}
                      maxLength={200}
                      disabled={!canManage}
                      onChange={(event) => update(index, { description: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <div className="flex gap-1">
                        <Button variant="text" aria-label={`Đưa dòng ${index + 1} lên`} onClick={() => move(index, -1)}>
                          ↑
                        </Button>
                        <Button variant="text" aria-label={`Đưa dòng ${index + 1} xuống`} onClick={() => move(index, 1)}>
                          ↓
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => setRows(rows.filter((_, position) => position !== index))}
                        >
                          Bỏ
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canManage ? (
          <div className="flex gap-3">
            <Button onClick={() => setRows([...rows, toRow({ name: '', url: 'https://', description: null })])}>
              Thêm ứng dụng
            </Button>
            <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
              Ghi
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
