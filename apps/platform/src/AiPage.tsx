import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { call } from './PlansPage.js';
import { PlatformApiError } from './platform-api.js';

// Trang "Trợ lý AI" của cổng vận hành nền tảng (DT-23 phần 23d, YCTD-214; GD-102, GD-103): khóa nhà cung cấp AI dùng chung của nền tảng
// (cấu hình `platform`; chỉ hiện bốn ký tự cuối), nhà cung cấp và mã mô hình của nền tảng, màn hình thiết lập riêng đơn giá AI của từng gói
// (token miễn phí mỗi kỳ, đơn giá token vào và ra theo một nghìn token, đơn giá riêng theo mô hình, phí tối thiểu, bước làm tròn; số tiền để
// trống cho đến khi nhập lúc triển khai), số token đã dùng của từng trường trong tháng. Giới hạn số yêu cầu và token của gói đặt ở trang
// Gói dịch vụ
interface PlanPricing {
  plan_id: string;
  code: string;
  name: string;
  status: 'active' | 'archived';
  ai_max_requests: number | null;
  ai_max_tokens: number | null;
  configured: boolean;
  ready: boolean;
  pricing: {
    freeTokens: number;
    inputPricePer1k: number | null;
    outputPricePer1k: number | null;
    modelPrices: Record<string, { input: number; output: number }>;
    minimumFee: number;
    roundingStep: number;
  };
}

interface Overview {
  settings: { provider: string; model: string; endpoint: string | null };
  key: { configured: boolean; enabled: boolean; hint: string | null };
  plans: PlanPricing[];
}

interface UsageRow {
  school_id: string;
  code: string;
  name: string;
  config: 'school' | 'platform';
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
}

export function AiPage({ accessToken }: { accessToken: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [settings, setSettings] = useState({ provider: 'anthropic', model: '', endpoint: '' });
  const [key, setKey] = useState({ enabled: true, api_key: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [next, nextUsage] = await Promise.all([
      call<Overview>(accessToken, 'GET', 'ai'),
      call<{ rows: UsageRow[] }>(accessToken, 'GET', 'ai/usage'),
    ]);
    setOverview(next);
    setUsage(nextUsage.rows);
    setSettings({
      provider: next.settings.provider,
      model: next.settings.model,
      endpoint: next.settings.endpoint ?? '',
    });
    setKey((current) => ({ ...current, enabled: next.key.configured ? next.key.enabled : true }));
  }, [accessToken]);

  useEffect(() => {
    reload().catch(() => setError('Không đọc được thiết lập trợ lý AI'));
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
      await call(accessToken, 'PUT', 'ai/settings', {
        provider: settings.provider,
        model: settings.model,
        endpoint: settings.endpoint,
      });
      return 'Đã lưu nhà cung cấp và mô hình của nền tảng';
    });
  };

  const saveKey = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await call(accessToken, 'PUT', 'ai/key', {
        enabled: key.enabled,
        ...(key.api_key ? { api_key: key.api_key } : {}),
      });
      setKey((current) => ({ ...current, api_key: '' }));
      return 'Đã lưu khóa AI dùng chung của nền tảng';
    });
  };

  return (
    <section aria-label="Trợ lý AI">
      <h2>Trợ lý AI</h2>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <form aria-label="Khóa AI dùng chung của nền tảng" onSubmit={saveKey}>
        <h3>Khóa nhà cung cấp AI dùng chung (cấu hình nền tảng cấp khóa)</h3>
        <p>
          {overview?.key.configured ? `Đã nhập khóa ${overview.key.hint ?? ''}.` : 'Chưa nhập khóa.'} Khóa mã hóa bằng
          khóa gốc của nền tảng, chỉ ở cơ sở dữ liệu nền tảng, không bao giờ xuống cơ sở dữ liệu của trường và không
          hiện lại.
        </p>
        <label>
          Khóa API mới (để trống là giữ khóa cũ)
          <input
            type="password"
            autoComplete="off"
            value={key.api_key}
            onChange={(event) => setKey({ ...key, api_key: event.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={key.enabled}
            onChange={(event) => setKey({ ...key, enabled: event.target.checked })}
          />{' '}
          Bật khóa dùng chung
        </label>
        <button type="submit">Lưu khóa</button>
      </form>

      <form aria-label="Nhà cung cấp và mô hình của nền tảng" onSubmit={saveSettings}>
        <h3>Nhà cung cấp và mô hình của nền tảng</h3>
        <label>
          Nhà cung cấp
          <input
            value={settings.provider}
            onChange={(event) => setSettings({ ...settings, provider: event.target.value })}
          />
        </label>
        <label>
          Mã mô hình
          <input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} />
        </label>
        <label>
          Địa chỉ API (trống là mặc định của nhà cung cấp)
          <input
            value={settings.endpoint}
            onChange={(event) => setSettings({ ...settings, endpoint: event.target.value })}
          />
        </label>
        <button type="submit">Lưu nhà cung cấp</button>
      </form>

      <p>Đơn giá AI theo gói và giới hạn AI đặt ở trang Gói dịch vụ (mục Phí AI của gói).</p>

      <h3>Token đã dùng trong tháng</h3>
      <table aria-label="Token AI đã dùng">
        <thead>
          <tr>
            <th>Trường</th>
            <th>Cấu hình</th>
            <th>Mô hình</th>
            <th>Yêu cầu</th>
            <th>Token vào</th>
            <th>Token ra</th>
          </tr>
        </thead>
        <tbody>
          {usage.map((row) => (
            <tr key={`${row.school_id}-${row.config}-${row.model}`}>
              <td>
                {row.code} {row.name}
              </td>
              <td>{row.config === 'platform' ? 'Nền tảng cấp khóa (thu phí)' : 'Trường tự nhập khóa (miễn phí)'}</td>
              <td>{row.model}</td>
              <td>{row.requests.toLocaleString('vi-VN')}</td>
              <td>{row.input_tokens.toLocaleString('vi-VN')}</td>
              <td>{row.output_tokens.toLocaleString('vi-VN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
