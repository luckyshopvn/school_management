import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, requestJson } from '../session/api-client.js';

// MH-42 Khóa API của đối tác (P01-14; BM-65, BM-66; YCTD-63): Hiệu trưởng cấp khóa theo phạm vi dữ liệu, căn cứ pháp lý,
// địa chỉ mạng cho phép, ngày hết hạn; khóa chỉ hiện một lần khi cấp; thu hồi có hiệu lực ngay
type Scope = 'reports' | 'finance' | 'children' | 'staff';

interface ApiClient {
  id: string;
  name: string;
  partner_type: string;
  scopes: Scope[];
  legal_basis: string | null;
  key_prefix: string;
  allowed_ips: string[];
  valid_until: string;
  status: 'active' | 'revoked';
  last_used_at: string | null;
}

const SCOPE_LABELS: Record<Scope, string> = {
  reports: 'Báo cáo tổng hợp',
  finance: 'Thu chi và công nợ',
  children: 'Danh sách trẻ và phụ huynh',
  staff: 'Nhân sự và lương',
};

const send = <T,>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function CreateForm({ onCreated }: { onCreated(key: string): void }) {
  const [name, setName] = useState('');
  const [partnerType, setPartnerType] = useState('');
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [legalBasis, setLegalBasis] = useState('');
  const [ips, setIps] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const create = useMutation({
    mutationFn: () =>
      send<ApiClient & { api_key: string }>('POST', '/api/v1/api-clients', {
        name,
        partner_type: partnerType,
        scopes,
        legal_basis: legalBasis || null,
        allowed_ips: ips
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean),
        valid_until: validUntil,
      }),
    onSuccess: (client) => {
      setName('');
      onCreated(client.api_key);
    },
  });
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Cấp khóa API"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Cấp khóa API</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField label="Tên đối tác" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Loại đối tác" value={partnerType} onChange={(event) => setPartnerType(event.target.value)} />
        <TextField
          label="Ngày hết hạn"
          type="date"
          value={validUntil}
          onChange={(event) => setValidUntil(event.target.value)}
        />
        <TextField
          label="Địa chỉ mạng cho phép (cách nhau bằng dấu phẩy)"
          value={ips}
          onChange={(event) => setIps(event.target.value)}
        />
        <TextField label="Căn cứ pháp lý" value={legalBasis} onChange={(event) => setLegalBasis(event.target.value)} />
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-label font-medium text-text">Phạm vi dữ liệu</legend>
        {(Object.keys(SCOPE_LABELS) as Scope[]).map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              checked={scopes.includes(scope)}
              onChange={(event) =>
                setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((item) => item !== scope))
              }
            />
            {SCOPE_LABELS[scope]}
          </label>
        ))}
      </fieldset>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          Cấp khóa
        </Button>
      </div>
    </form>
  );
}

export function ApiClientsPage() {
  const queryClient = useQueryClient();
  const clients = useQuery({
    queryKey: ['api-clients'],
    queryFn: () => requestJson<ApiClient[]>('/api/v1/api-clients'),
  });
  const [newKey, setNewKey] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const revoke = useMutation({
    mutationFn: (clientId: string) => send<ApiClient>('POST', `/api/v1/api-clients/${clientId}/revoke`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api-clients'] });
      setToastMessage('Đã thu hồi khóa');
    },
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Khóa API cho đối tác</h1>
        <CreateForm
          onCreated={async (key) => {
            setNewKey(key);
            await queryClient.invalidateQueries({ queryKey: ['api-clients'] });
          }}
        />
        {newKey ? (
          <Alert tone="warning">
            Khóa mới (chỉ hiện một lần, hãy gửi cho đối tác qua kênh an toàn):{' '}
            <code aria-label="Khóa mới">{newKey}</code>
          </Alert>
        ) : null}
        {clients.error ? <Alert tone="danger">{messageOf(clients.error)}</Alert> : null}
        {revoke.error ? <Alert tone="danger">{messageOf(revoke.error)}</Alert> : null}
        {clients.data && clients.data.length > 0 ? (
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Đối tác</th>
                <th className="px-3 py-2">Phạm vi</th>
                <th className="px-3 py-2">Khóa</th>
                <th className="px-3 py-2">Hết hạn</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {clients.data.map((client) => (
                <tr key={client.id} className="border-t border-border" aria-label={`Khóa của ${client.name}`}>
                  <td className="px-3 py-2 font-medium">
                    {client.name} ({client.partner_type})
                  </td>
                  <td className="px-3 py-2">{client.scopes.map((scope) => SCOPE_LABELS[scope]).join(', ')}</td>
                  <td className="px-3 py-2">{client.key_prefix}…</td>
                  <td className="px-3 py-2">{client.valid_until}</td>
                  <td className="px-3 py-2">{client.status === 'active' ? 'Đang dùng' : 'Đã thu hồi'}</td>
                  <td className="px-3 py-2 text-right">
                    {client.status === 'active' ? (
                      <Button variant="danger" disabled={revoke.isPending} onClick={() => revoke.mutate(client.id)}>
                        Thu hồi
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </AppShell>
  );
}
