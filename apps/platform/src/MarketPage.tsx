import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PlatformApiError } from './platform-api.js';

// Trang "Chợ gia sư" của cổng vận hành nền tảng (DT-27 phần 27f, YCTD-256): bật tắt chợ, tên miền con dành riêng, hạn giữ bản ghi (GD-132),
// hạn khiếu nại (GD-133), tỷ lệ hoa hồng mặc định (E-01, để trống khi chưa chốt), đăng phiên bản mới của văn bản pháp lý, số tài khoản.
// Thu tiền thật luôn tắt ở bản này (chặn ở máy chủ đến khi xong E-01 đến E-07). Gọi máy chủ API ở /api/v1/market/admin
interface Overview {
  settings: {
    enabled: boolean;
    host: string | null;
    tutor_host: string | null;
    record_retention_days: number;
    complaint_window_hours: number;
    default_commission_percent: number | null;
    real_payments_enabled: false;
  };
  documents: Array<{ id: string; kind: string; version: number; title: string; published_at: string }>;
  document_kinds: Record<string, string>;
  accounts: Array<{ kind: 'parent' | 'tutor'; status: string; count: number }>;
  children: number;
}

async function marketCall<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/market/admin${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let message = response.status === 404 ? 'Máy chủ chưa bật chợ gia sư' : 'Không thực hiện được, vui lòng thử lại';
    try {
      const payload = (await response.json()) as { error?: { message?: string; details?: Array<{ message: string }> } };
      if (response.status !== 404) {
        message = [payload.error?.message, ...(payload.error?.details ?? []).map((detail) => detail.message)]
          .filter(Boolean)
          .join('. ');
      }
    } catch {
      // Phản hồi không phải JSON: giữ thông điệp mặc định
    }
    throw new PlatformApiError(response.status, message);
  }
  return (await response.json()) as T;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'chờ xác nhận',
  active: 'đang dùng',
  locked: 'đã khóa',
  closed: 'đã đóng',
};

export function MarketPage({ accessToken }: { accessToken: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [form, setForm] = useState({
    enabled: false,
    host: '',
    tutorHost: '',
    retention: '30',
    window: '48',
    commission: '',
  });
  const [document, setDocument] = useState({ kind: 'terms', title: '', body: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await marketCall<Overview>(accessToken, 'GET', '');
    setOverview(next);
    setForm({
      enabled: next.settings.enabled,
      host: next.settings.host ?? '',
      tutorHost: next.settings.tutor_host ?? '',
      retention: String(next.settings.record_retention_days),
      window: String(next.settings.complaint_window_hours),
      commission:
        next.settings.default_commission_percent === null ? '' : String(next.settings.default_commission_percent),
    });
  }, [accessToken]);

  useEffect(() => {
    reload().catch((caught: unknown) =>
      setError(caught instanceof PlatformApiError ? caught.message : 'Không đọc được cấu hình chợ gia sư'),
    );
  }, [reload]);

  const run = async (work: () => Promise<string>) => {
    setError(null);
    setMessage(null);
    try {
      setMessage(await work());
      await reload();
    } catch (caught) {
      setError(caught instanceof PlatformApiError ? caught.message : 'Không thực hiện được');
    }
  };

  const saveSettings = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await marketCall(accessToken, 'PUT', '/settings', {
        enabled: form.enabled,
        host: form.host,
        tutor_host: form.tutorHost,
        record_retention_days: Number(form.retention),
        complaint_window_hours: Number(form.window),
        default_commission_percent: form.commission.trim() === '' ? null : Number(form.commission),
      });
      return 'Đã lưu cấu hình chợ gia sư';
    });
  };

  const publish = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const published = await marketCall<{ version: number }>(accessToken, 'POST', '/documents', document);
      setDocument({ ...document, title: '', body: '' });
      return `Đã đăng phiên bản ${published.version}; người dùng phải đồng ý lại trước khi dùng tiếp`;
    });
  };

  const kinds = overview?.document_kinds ?? {};
  return (
    <section aria-label="Chợ gia sư">
      <h2>Chợ gia sư</h2>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <p>
        Thu tiền thật ở chợ: <strong>tắt</strong>. Bản này chỉ chạy thanh toán giả lập; bật thu tiền thật cần xong E-01
        đến E-07 (tài liệu 32 mục 19.10).
      </p>

      <form aria-label="Cấu hình chợ gia sư" onSubmit={saveSettings}>
        <h3>Cấu hình</h3>
        <label>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          />{' '}
          Bật chợ gia sư
        </label>
        <label>
          Tên miền con dành riêng của chợ
          <input value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} />
        </label>
        <label>
          Tên miền con của ứng dụng Gia sư
          <input value={form.tutorHost} onChange={(event) => setForm({ ...form, tutorHost: event.target.value })} />
        </label>
        <label>
          Hạn giữ bản ghi lớp video (ngày)
          <input
            type="number"
            min={7}
            max={365}
            value={form.retention}
            onChange={(event) => setForm({ ...form, retention: event.target.value })}
          />
        </label>
        <label>
          Hạn khiếu nại trước khi giải ngân (giờ)
          <input
            type="number"
            min={1}
            max={720}
            value={form.window}
            onChange={(event) => setForm({ ...form, window: event.target.value })}
          />
        </label>
        <label>
          Tỷ lệ hoa hồng mặc định (%), để trống khi chưa chốt
          <input
            type="number"
            min={0}
            max={50}
            step={0.01}
            value={form.commission}
            onChange={(event) => setForm({ ...form, commission: event.target.value })}
          />
        </label>
        <button type="submit">Lưu cấu hình chợ</button>
      </form>

      <form aria-label="Đăng văn bản pháp lý của chợ" onSubmit={publish}>
        <h3>Văn bản pháp lý</h3>
        <label>
          Loại văn bản
          <select value={document.kind} onChange={(event) => setDocument({ ...document, kind: event.target.value })}>
            {Object.entries(kinds).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tiêu đề
          <input value={document.title} onChange={(event) => setDocument({ ...document, title: event.target.value })} />
        </label>
        <label>
          Nội dung
          <textarea
            rows={6}
            value={document.body}
            onChange={(event) => setDocument({ ...document, body: event.target.value })}
          />
        </label>
        <button type="submit">Đăng phiên bản mới</button>
      </form>
      <table aria-label="Văn bản pháp lý đã đăng">
        <thead>
          <tr>
            <th>Loại</th>
            <th>Phiên bản</th>
            <th>Tiêu đề</th>
            <th>Ngày đăng</th>
          </tr>
        </thead>
        <tbody>
          {(overview?.documents ?? []).map((row) => (
            <tr key={row.id}>
              <td>{kinds[row.kind] ?? row.kind}</td>
              <td>{row.version}</td>
              <td>{row.title}</td>
              <td>{new Date(row.published_at).toLocaleDateString('vi-VN')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Tài khoản</h3>
      <ul aria-label="Số tài khoản của chợ">
        {(overview?.accounts ?? []).map((row) => (
          <li key={`${row.kind}-${row.status}`}>
            {row.kind === 'parent' ? 'Phụ huynh' : 'Gia sư'} {STATUS_LABELS[row.status] ?? row.status}: {row.count}
          </li>
        ))}
        <li>Hồ sơ con: {overview?.children ?? 0}</li>
      </ul>
    </section>
  );
}
