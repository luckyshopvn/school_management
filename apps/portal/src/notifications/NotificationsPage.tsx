import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { readNotifications } from './notifications-api.js';

// MH-55 Thông báo (P19-04, P19-05; BR-70; YCTD-64): thông báo của tôi, đánh dấu đã đọc; người có quyền xem ai đã đọc;
// người gán ở Trường chính sửa mẫu tiêu đề và nội dung theo từng loại thông báo
interface Receipts {
  direct_recipients: Array<{ user_id: string; name: string | null; read_at: string | null }>;
  role_recipients: Array<{ role_code: string; org_unit_id: string | null }>;
  readers: Array<{ user_id: string; name: string | null; read_at: string }>;
  unread_count: number;
}

interface Template {
  template_code: string;
  title_template: string | null;
  body_template: string | null;
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(value),
  );

function ReceiptPanel({ notificationId }: { notificationId: string }) {
  const receipts = useQuery({
    queryKey: ['notification-receipts', notificationId],
    queryFn: () => requestJson<Receipts>(`/api/v1/notifications/${notificationId}/receipts`),
    retry: false,
  });
  if (receipts.error) {
    return <p className="text-label text-danger">{messageOf(receipts.error)}</p>;
  }
  if (!receipts.data) {
    return null;
  }
  return (
    <div className="mt-2 text-label text-text-secondary" aria-label="Người đã đọc">
      {receipts.data.direct_recipients.length > 0 ? (
        <p>
          Người nhận:{' '}
          {receipts.data.direct_recipients
            .map((row) => `${row.name ?? 'Tài khoản'} (${row.read_at ? 'đã đọc' : 'chưa đọc'})`)
            .join(', ')}
        </p>
      ) : null}
      <p>
        Đã đọc:{' '}
        {receipts.data.readers.length === 0
          ? 'chưa có ai'
          : receipts.data.readers.map((row) => row.name ?? 'Tài khoản').join(', ')}
      </p>
    </div>
  );
}

function NotificationList({
  canViewReceipts,
  onChanged,
}: {
  canViewReceipts: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const list = useQuery({ queryKey: ['notifications', unreadOnly], queryFn: () => readNotifications(unreadOnly) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const read = useMutation({
    mutationFn: (id: string) => send('POST', `/api/v1/notifications/${id}/read`),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => send('POST', '/api/v1/notifications/read-all'),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã đánh dấu đọc tất cả');
    },
  });
  const data = list.data;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Thông báo của tôi">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section-title font-semibold text-text">
          Thông báo của tôi ({data?.unread_count ?? 0} chưa đọc)
        </h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-label">
            <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
            Chỉ chưa đọc
          </label>
          <Button disabled={readAll.isPending} onClick={() => readAll.mutate()}>
            Đánh dấu đọc tất cả
          </Button>
        </div>
      </div>
      {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      {data && data.notifications.length === 0 ? (
        <p className="text-content text-text-secondary">Không có thông báo.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(data?.notifications ?? []).map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border border-border p-3 ${item.is_read ? '' : 'bg-selected'}`}
            aria-label={`Thông báo ${item.title}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-content font-semibold text-text">{item.title}</p>
                <p className="text-content text-text">{item.body}</p>
                <p className="text-label text-text-secondary">{formatTime(item.created_at)}</p>
              </div>
              <div className="flex gap-2">
                {!item.is_read ? (
                  <Button variant="text" onClick={() => read.mutate(item.id)}>
                    Đã đọc
                  </Button>
                ) : null}
                {canViewReceipts ? (
                  <Button variant="text" onClick={() => setOpenId(openId === item.id ? undefined : item.id)}>
                    Ai đã đọc
                  </Button>
                ) : null}
              </div>
            </div>
            {openId === item.id ? <ReceiptPanel notificationId={item.id} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TemplateRow({ template, onChanged }: { template: Template; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(template.title_template ?? '{tieu_de}');
  const [body, setBody] = useState(template.body_template ?? '{noi_dung}');
  const save = useMutation({
    mutationFn: () =>
      send('PUT', `/api/v1/notification-templates/${template.template_code}`, {
        title_template: title,
        body_template: body,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      onChanged('Đã lưu mẫu');
    },
  });
  const reset = useMutation({
    mutationFn: () => send('DELETE', `/api/v1/notification-templates/${template.template_code}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      onChanged('Đã dùng lại nội dung gốc');
    },
  });
  return (
    <tr className="border-t border-border align-top" aria-label={`Mẫu ${template.template_code}`}>
      <td className="px-3 py-2 font-medium">{template.template_code}</td>
      <td className="px-3 py-2">
        <TextField label="Tiêu đề mẫu" value={title} onChange={(event) => setTitle(event.target.value)} />
      </td>
      <td className="px-3 py-2">
        <TextField label="Nội dung mẫu" value={body} onChange={(event) => setBody(event.target.value)} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex flex-col items-end gap-2">
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu mẫu
          </Button>
          {template.title_template ? (
            <Button variant="text" disabled={reset.isPending} onClick={() => reset.mutate()}>
              Dùng nội dung gốc
            </Button>
          ) : null}
        </div>
        {(save.error ?? reset.error) ? (
          <p className="text-label text-danger">{messageOf(save.error ?? reset.error)}</p>
        ) : null}
      </td>
    </tr>
  );
}

function TemplatesSection({ onChanged }: { onChanged(message: string): void }) {
  const templates = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => requestJson<Template[]>('/api/v1/notification-templates'),
  });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Mẫu thông báo">
      <h2 className="text-section-title font-semibold text-text">Mẫu thông báo</h2>
      <p className="text-content text-text-secondary">
        Biến dùng được: {'{tieu_de}'} tiêu đề gốc, {'{noi_dung}'} nội dung gốc, {'{don_vi}'} tên đơn vị.
      </p>
      {templates.error ? <Alert tone="danger">{messageOf(templates.error)}</Alert> : null}
      {templates.data ? (
        <table className="w-full text-content">
          <tbody>
            {templates.data.map((template) => (
              <TemplateRow key={template.template_code} template={template} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function NotificationsPage() {
  const canViewReceipts = useHasPermission(PERMISSION_CODES.notificationReceiptView);
  const canManageTemplates = useHasPermission(PERMISSION_CODES.notificationTemplateManage);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Thông báo</h1>
        <NotificationList canViewReceipts={canViewReceipts} onChanged={setToastMessage} />
        {canManageTemplates ? <TemplatesSection onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
