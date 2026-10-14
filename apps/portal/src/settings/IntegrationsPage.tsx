import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { menuPageTitle } from '../pages/page-title.js';

// MH-71 Kết nối ngoài (P01.integration.manage; P14-08, G3-03, G3-08; YCTD-90): Hiệu trưởng bật, tắt Fanpage và Zalo Official
// Account, nhập mã trang, mã Official Account; khóa truy cập đặt ở biến môi trường của máy chủ nên trang chỉ báo đã có hay
// chưa. Liên kết số điện thoại phụ huynh đã quan tâm Official Account với mã người dùng Zalo. YCTD-92: nút Kiểm tra kết nối
// cho từng kết nối (máy chủ gọi Facebook, Zalo và trả tên trang, tên Official Account hoặc lỗi) và ô nhập khóa làm mới Zalo
// (ô mật khẩu; máy chủ lưu mã hóa, không trả lại) khi khóa cũ hết hạn sau 3 tháng
type Connector = 'facebook' | 'zalo';

interface Integration {
  connector: Connector;
  enabled: boolean;
  config: Record<string, string>;
  provider: string;
  credentials_configured: boolean;
  token_status?: {
    refresh_token_configured: boolean;
    access_token_expires_at: string | null;
    refreshed_at: string | null;
  };
}

interface ConnectionTest {
  connector: Connector;
  ok: boolean;
  page_name?: string;
  oa_name?: string;
}

interface Follower {
  id: string;
  phone: string;
  zalo_user_id: string;
  display_name: string | null;
  guardian_name: string | null;
  linked_at: string;
}

const FIELDS: Record<
  Connector,
  { title: string; idField: string; idLabel: string; nameField: string; nameLabel: string }
> = {
  facebook: {
    title: 'Fanpage Facebook',
    idField: 'page_id',
    idLabel: 'Mã trang',
    nameField: 'page_name',
    nameLabel: 'Tên trang',
  },
  zalo: {
    title: 'Zalo Official Account',
    idField: 'oa_id',
    idLabel: 'Mã Official Account',
    nameField: 'oa_name',
    nameLabel: 'Tên Official Account',
  },
};

const send = <T,>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function ConnectorForm({ integration, onSaved }: { integration: Integration; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const fields = FIELDS[integration.connector];
  const [enabled, setEnabled] = useState(integration.enabled);
  const [externalId, setExternalId] = useState(integration.config[fields.idField] ?? '');
  const [name, setName] = useState(integration.config[fields.nameField] ?? '');
  useEffect(() => {
    setEnabled(integration.enabled);
    setExternalId(integration.config[fields.idField] ?? '');
    setName(integration.config[fields.nameField] ?? '');
  }, [integration, fields]);
  const save = useMutation({
    mutationFn: () =>
      send<Integration>('PUT', `/api/v1/integrations/${integration.connector}`, {
        enabled,
        config: { [fields.idField]: externalId, [fields.nameField]: name },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      onSaved(`Đã lưu ${fields.title}`);
    },
  });
  const test = useMutation({
    mutationFn: () => send<ConnectionTest>('POST', `/api/v1/integrations/${integration.connector}/test`),
  });
  const testedName = test.data ? (test.data.page_name ?? test.data.oa_name ?? '') : '';
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      aria-label={fields.title}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{fields.title}</h2>
      <p className="text-label text-text-secondary">
        Nhà cung cấp: {integration.provider === 'development' ? 'bộ giả lập' : integration.provider} ·{' '}
        {integration.credentials_configured ? 'Đã có khóa truy cập ở máy chủ' : 'Chưa có khóa truy cập ở máy chủ'}
        {integration.token_status
          ? ` · ${integration.token_status.refresh_token_configured ? 'Đã có khóa làm mới' : 'Chưa có khóa làm mới'}`
          : ''}
        {integration.token_status?.access_token_expires_at
          ? ` · Khóa truy cập hết hạn lúc ${new Date(integration.token_status.access_token_expires_at).toLocaleString('vi-VN')}`
          : ''}
      </p>
      <label className="flex items-center gap-2 text-content text-text">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Bật kết nối {fields.title}
      </label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField label={fields.idLabel} value={externalId} onChange={(event) => setExternalId(event.target.value)} />
        <TextField label={fields.nameLabel} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu {fields.title}
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label={`Kiểm tra kết nối ${fields.title}`}
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          Kiểm tra kết nối
        </Button>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {test.error ? <Alert tone="danger">{messageOf(test.error)}</Alert> : null}
      {test.data ? <Alert tone="success">Kết nối được tới {testedName || fields.title}</Alert> : null}
    </form>
  );
}

// Thay khóa làm mới Zalo; ô mật khẩu, sau khi lưu xóa trắng vì máy chủ không trả lại khóa
function ZaloRefreshToken({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [refreshToken, setRefreshToken] = useState('');
  const save = useMutation({
    mutationFn: () =>
      send<Integration>('PUT', '/api/v1/integrations/zalo/refresh-token', { refresh_token: refreshToken }),
    onSuccess: async () => {
      setRefreshToken('');
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      onSaved('Đã cập nhật khóa làm mới Zalo');
    },
  });
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      aria-label="Khóa làm mới Zalo"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Khóa làm mới Zalo</h2>
      <p className="text-label text-text-secondary">
        Khóa làm mới do Zalo cấp có hạn 3 tháng; máy chủ tự làm mới khóa truy cập. Khi Zalo báo khóa làm mới hết hạn,
        lấy khóa mới trên trang quản trị ứng dụng Zalo rồi dán vào đây. Khóa được lưu mã hóa và không hiển thị lại.
      </p>
      <TextField
        label="Khóa làm mới mới"
        type="password"
        autoComplete="off"
        value={refreshToken}
        onChange={(event) => setRefreshToken(event.target.value)}
      />
      <div>
        <Button type="submit" variant="primary" disabled={!refreshToken.trim() || save.isPending}>
          Cập nhật khóa làm mới Zalo
        </Button>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </form>
  );
}

function Followers({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [zaloUserId, setZaloUserId] = useState('');
  const followers = useQuery({
    queryKey: ['zalo-followers'],
    queryFn: () => requestJson<Follower[]>('/api/v1/integrations/zalo/followers'),
  });
  const link = useMutation({
    mutationFn: () =>
      send<Follower>('POST', '/api/v1/integrations/zalo/followers', { phone, zalo_user_id: zaloUserId }),
    onSuccess: async () => {
      setPhone('');
      setZaloUserId('');
      await queryClient.invalidateQueries({ queryKey: ['zalo-followers'] });
      onSaved('Đã liên kết Zalo');
    },
  });
  const unlink = useMutation({
    mutationFn: (id: string) => send<void>('DELETE', `/api/v1/integrations/zalo/followers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zalo-followers'] }),
  });
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Phụ huynh quan tâm Zalo">
      <h2 className="text-section-title font-semibold text-text">Phụ huynh quan tâm Zalo</h2>
      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          link.mutate();
        }}
      >
        <TextField label="Số điện thoại phụ huynh" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <TextField
          label="Mã người dùng Zalo"
          value={zaloUserId}
          onChange={(event) => setZaloUserId(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={!phone || !zaloUserId || link.isPending}>
            Liên kết Zalo
          </Button>
        </div>
      </form>
      {link.error ? <Alert tone="danger">{messageOf(link.error)}</Alert> : null}
      <table className="w-full text-left text-content text-text">
        <thead>
          <tr>
            <th>Số điện thoại</th>
            <th>Phụ huynh</th>
            <th>Mã người dùng Zalo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(followers.data ?? []).map((follower) => (
            <tr key={follower.id}>
              <td>{follower.phone}</td>
              <td>{follower.guardian_name ?? follower.display_name ?? ''}</td>
              <td>{follower.zalo_user_id}</td>
              <td>
                <Button variant="text" onClick={() => unlink.mutate(follower.id)}>
                  Bỏ liên kết
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function IntegrationsPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const integrations = useQuery({
    queryKey: ['integrations'],
    queryFn: () => requestJson<Integration[]>('/api/v1/integrations'),
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/integrations')}</h1>
        {integrations.error ? <Alert tone="danger">{messageOf(integrations.error)}</Alert> : null}
        {(integrations.data ?? []).map((integration) => (
          <ConnectorForm key={integration.connector} integration={integration} onSaved={setToastMessage} />
        ))}
        {integrations.data ? <ZaloRefreshToken onSaved={setToastMessage} /> : null}
        <Followers onSaved={setToastMessage} />
      </div>
    </AppShell>
  );
}
