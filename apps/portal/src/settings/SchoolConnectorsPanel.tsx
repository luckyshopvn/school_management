import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Khóa kết nối riêng của trường và thương hiệu (P01.integration.manage; DT-SaaS phần S3, YCTD-195): Hiệu trưởng tự nhập khóa thanh toán, eSMS,
// Zalo, Facebook, kho tệp; máy chủ lưu mã hóa và không trả lại giá trị bí mật (chỉ bốn ký tự cuối), ô để trống là giữ giá trị đã lưu. Mỗi
// kết nối có nút Kiểm tra kết nối; cổng thanh toán hiện địa chỉ gọi lại (webhook) của trường để dán vào trang quản trị của nhà cung cấp.
// Thương hiệu: tên hiển thị và màu chủ đạo; biểu trưng đặt ở Cấu hình website (ảnh biểu trưng của website trường)
interface ConnectorField {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  kind: 'text' | 'url' | 'boolean' | 'integer';
  value: string | null;
}

interface SchoolConnector {
  connector: string;
  label: string;
  group: string;
  configured: boolean;
  enabled: boolean;
  fields: ConnectorField[];
  webhook_url: string | null;
}

interface Branding {
  display_name: string | null;
  school_name: string | null;
  primary_color: string | null;
  app_short_name: string | null;
  has_logo: boolean;
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function ConnectorCard({ connector, onSaved }: { connector: SchoolConnector; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(connector.enabled);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setEnabled(connector.enabled);
    setValues({});
  }, [connector]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['school-connectors'] });
  const save = useMutation({
    mutationFn: () => send('PUT', `/api/v1/school-settings/integrations/${connector.connector}`, { enabled, values }),
    onSuccess: async () => {
      await refresh();
      onSaved(`Đã lưu ${connector.label}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => send('DELETE', `/api/v1/school-settings/integrations/${connector.connector}`),
    onSuccess: async () => {
      await refresh();
      onSaved(`Đã xóa cấu hình ${connector.label}`);
    },
  });
  const test = useMutation({
    mutationFn: () =>
      send<{ ok: boolean; message?: string }>(
        'POST',
        `/api/v1/school-settings/integrations/${connector.connector}/test`,
      ),
  });
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      aria-label={`Cấu hình ${connector.label}`}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="text-section-title font-semibold text-text">{connector.label}</h3>
      <label className="flex items-center gap-2 text-content text-text">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Bật {connector.label}
      </label>
      {connector.fields.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {connector.fields.map((field) => (
            <TextField
              key={field.name}
              label={field.label}
              type={field.secret ? 'password' : 'text'}
              autoComplete="off"
              placeholder={field.value ?? (field.required ? 'Bắt buộc' : 'Không bắt buộc')}
              value={values[field.name] ?? ''}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
            />
          ))}
        </div>
      ) : null}
      <p className="text-label text-text-secondary">
        Ô để trống là giữ giá trị đã lưu; khóa đã lưu không hiển thị lại (chỉ bốn ký tự cuối).
      </p>
      {connector.webhook_url ? (
        <p className="text-label text-text">
          Địa chỉ gọi lại (webhook) của trường để dán vào trang quản trị của nhà cung cấp:{' '}
          <code className="break-all">{connector.webhook_url}</code>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu {connector.label}
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label={`Kiểm tra kết nối ${connector.label}`}
          disabled={!connector.configured || test.isPending}
          onClick={() => test.mutate()}
        >
          Kiểm tra kết nối
        </Button>
        <Button
          type="button"
          variant="text"
          aria-label={`Xóa cấu hình ${connector.label}`}
          disabled={!connector.configured || remove.isPending}
          onClick={() => remove.mutate()}
        >
          Xóa cấu hình
        </Button>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {test.error ? <Alert tone="danger">{messageOf(test.error)}</Alert> : null}
      {test.data ? <Alert tone="success">{test.data.message ?? 'Kết nối được'}</Alert> : null}
    </form>
  );
}

function BrandingCard({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const branding = useQuery({
    queryKey: ['school-branding'],
    queryFn: () => requestJson<Branding>('/api/v1/school-settings/branding'),
  });
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('');
  const [shortName, setShortName] = useState('');
  useEffect(() => {
    setDisplayName(branding.data?.display_name ?? '');
    setColor(branding.data?.primary_color ?? '');
    setShortName(branding.data?.app_short_name ?? '');
  }, [branding.data]);
  const save = useMutation({
    mutationFn: () =>
      send('PUT', '/api/v1/school-settings/branding', {
        display_name: displayName,
        primary_color: color,
        app_short_name: shortName,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['school-branding'] });
      onSaved('Đã lưu thương hiệu');
    },
  });
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      aria-label="Thương hiệu của trường"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="text-section-title font-semibold text-text">Thương hiệu của trường</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField
          label="Tên hiển thị"
          placeholder={branding.data?.school_name ?? 'Tên trường'}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <TextField
          label="Màu chủ đạo (dạng #RRGGBB)"
          placeholder="#1D5FD1"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        {/* Tên dưới biểu tượng khi cài ứng dụng giáo viên, phụ huynh lên màn hình chính (DT-26 phần 26a) */}
        <TextField
          label="Tên ngắn trên màn hình chính (tối đa 9 ký tự)"
          placeholder="Hoa Sen"
          maxLength={9}
          value={shortName}
          onChange={(event) => setShortName(event.target.value)}
        />
      </div>
      <p className="text-label text-text-secondary">
        {branding.data?.has_logo
          ? 'Biểu trưng lấy từ ảnh biểu trưng ở Cấu hình website.'
          : 'Chưa có biểu trưng; tải ảnh biểu trưng ở Cấu hình website.'}
      </p>
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu thương hiệu
        </Button>
      </div>
      {branding.error ? <Alert tone="danger">{messageOf(branding.error)}</Alert> : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </form>
  );
}

export function SchoolConnectorsPanel({ onSaved }: { onSaved(message: string): void }) {
  const connectors = useQuery({
    queryKey: ['school-connectors'],
    queryFn: () => requestJson<SchoolConnector[]>('/api/v1/school-settings/integrations'),
  });
  return (
    <section className="flex flex-col gap-4" aria-label="Khóa kết nối riêng của trường">
      <h2 className="text-section-title font-semibold text-text">Khóa kết nối riêng của trường</h2>
      <p className="text-label text-text-secondary">
        Mỗi trường dùng khóa của chính mình; thiếu cấu hình thì kết nối tương ứng tắt, không dùng khóa của trường khác.
      </p>
      {connectors.error ? <Alert tone="danger">{messageOf(connectors.error)}</Alert> : null}
      {(connectors.data ?? [])
        .filter((connector) => connector.group !== 'ai')
        .map((connector) => (
          <ConnectorCard key={connector.connector} connector={connector} onSaved={onSaved} />
        ))}
      <BrandingCard onSaved={onSaved} />
    </section>
  );
}
