import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DataGrid, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';

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
  const grid = useGridSettings('api-clients');
  // Danh sách khóa trên lưới dữ liệu chung (DT-15 phần 15e)
  const columns: Array<DataGridColumn<ApiClient>> = [
    {
      id: 'name',
      header: 'Đối tác',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (client) => `${client.name} (${client.partner_type})`,
    },
    { id: 'scopes', header: 'Phạm vi', cell: (client) => client.scopes.map((scope) => SCOPE_LABELS[scope]).join(', ') },
    { id: 'key_prefix', header: 'Khóa', cell: (client) => `${client.key_prefix}…` },
    { id: 'valid_until', header: 'Hết hạn', cell: (client) => client.valid_until },
    { id: 'status', header: 'Trạng thái', cell: (client) => (client.status === 'active' ? 'Đang dùng' : 'Đã thu hồi') },
    {
      id: 'allowed_ips',
      header: 'Địa chỉ mạng cho phép',
      hiddenByDefault: true,
      cell: (client) => client.allowed_ips.join(', '),
    },
    { id: 'legal_basis', header: 'Căn cứ pháp lý', hiddenByDefault: true, cell: (client) => client.legal_basis ?? '' },
    { id: 'last_used_at', header: 'Dùng gần nhất', hiddenByDefault: true, cell: (client) => client.last_used_at ?? '' },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/api-clients')}</h1>
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
        <DataGrid
          label="Danh sách khóa API"
          columns={columns}
          rows={clients.data ?? []}
          getRowId={(client) => client.id}
          getRowLabel={(client) => client.name}
          getRowAriaLabel={(client) => `Khóa của ${client.name}`}
          loading={clients.isPending}
          emptyText="Chưa cấp khóa API nào."
          rowActions={(client) =>
            client.status === 'active' ? (
              <Button variant="danger" disabled={revoke.isPending} onClick={() => revoke.mutate(client.id)}>
                Thu hồi
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
