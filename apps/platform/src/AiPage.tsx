import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import { call } from './PlansPage.js';
import { EmptyState, errorMessage, LoadError, OutcomeBanner, Skeleton, useBusy, type Outcome } from './platform-ui.js';

// Trang "Trợ lý AI" của cổng vận hành nền tảng (DT-23 phần 23d, YCTD-214; GD-102, GD-103): khóa nhà cung cấp AI dùng chung của nền tảng
// (cấu hình `platform`; chỉ hiện bốn ký tự cuối), nhà cung cấp và mã mô hình của nền tảng, màn hình thiết lập riêng đơn giá AI của từng gói
// (token miễn phí mỗi kỳ, đơn giá token vào và ra theo một nghìn token, đơn giá riêng theo mô hình, phí tối thiểu, bước làm tròn; số tiền để
// trống cho đến khi nhập lúc triển khai), số token đã dùng của từng trường trong tháng. Giới hạn số yêu cầu và token của gói đặt ở trang
// Gói dịch vụ. Giao diện YCTD-370: thẻ nhà cung cấp gồm hai phần lưu riêng; bảng đơn giá theo gói đọc từ GET ai, nút "Sửa ở Gói dịch vụ"
// mở đúng gói; vai trò không có ai.settings xem nhà cung cấp, khóa ở dạng chỉ xem
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
  config: 'school' | 'platform' | 'tutor_school' | 'tutor_platform';
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
}

// Gia sư AI học sinh (YCTD-383 lát L2): token của gói trường bán tính lên hóa đơn dịch vụ, của gói nền tảng bán là chi phí của nền tảng
const USAGE_CONFIG_LABELS: Record<UsageRow['config'], string> = {
  platform: 'Nền tảng cấp khóa (thu phí)',
  school: 'Trường tự nhập khóa (miễn phí)',
  tutor_school: 'Gia sư AI học sinh, gói trường bán (thu phí)',
  tutor_platform: 'Gia sư AI học sinh, gói nền tảng bán (chi phí nền tảng)',
};

interface PlanSchoolRow {
  id: string;
  code: string;
  name: string;
  plan: { id: string } | null;
}

// Tháng dạng yyyy-mm theo giờ của máy; khoảng ngày gửi cho GET ai/usage (YCTD-374, ĐX-CN-3)
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

// Thanh so với hạn mức của gói: dưới 80% tông nhấn, từ 80% cảnh báo, từ 100% nguy hiểm
function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return <span className="muted">{count(used)} · không giới hạn</span>;
  }
  const percent = limit === 0 ? (used > 0 ? 100 : 0) : Math.round((used / limit) * 100);
  const tone = percent >= 100 ? 'danger' : percent >= 80 ? 'warn' : 'ok';
  return (
    <div className="meter" data-tone={tone}>
      <span>
        {count(used)} / {count(limit)} ({percent}%)
      </span>
      <span
        className="meter-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
      >
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </span>
    </div>
  );
}

function count(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('vi-VN');
}

export function AiPage({
  accessToken,
  role,
  onOpenPlan,
}: {
  accessToken: string;
  role: OperatorRole;
  onOpenPlan: (planId: string) => void;
}) {
  const canConfigure = operatorCan(role, 'ai.settings');
  const canPrice = operatorCan(role, 'ai.pricing');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [planOfSchool, setPlanOfSchool] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState({ provider: 'anthropic', model: '', endpoint: '' });
  const [key, setKey] = useState({ enabled: true, api_key: '' });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, runBusy] = useBusy();

  const reload = useCallback(async () => {
    const [next, schools] = await Promise.all([
      call<Overview>(accessToken, 'GET', 'ai'),
      call<PlanSchoolRow[]>(accessToken, 'GET', 'plan-schools'),
    ]);
    setOverview(next);
    setPlanOfSchool(
      Object.fromEntries(schools.flatMap((school) => (school.plan ? [[school.id, school.plan.id]] : []))),
    );
    setSettings({
      provider: next.settings.provider,
      model: next.settings.model,
      endpoint: next.settings.endpoint ?? '',
    });
    setKey((current) => ({ ...current, enabled: next.key.configured ? next.key.enabled : true }));
  }, [accessToken]);

  // Token đã dùng theo tháng chọn; máy chủ nhận khoảng ngày from, to
  useEffect(() => {
    const { from, to } = monthRange(month);
    setUsageError(null);
    call<{ rows: UsageRow[] }>(accessToken, 'GET', `ai/usage?from=${from}&to=${to}`)
      .then((reply) => setUsage(reply.rows))
      .catch((caught: unknown) => setUsageError(`Không đọc được token đã dùng: ${errorMessage(caught)}`));
  }, [accessToken, month]);

  // Hạn mức tính theo tháng, gộp mọi cấu hình và mô hình của trường
  const bySchool = Object.values(
    usage.reduce<Record<string, { school_id: string; code: string; name: string; requests: number; tokens: number }>>(
      (sum, row) => {
        const current = sum[row.school_id] ?? {
          school_id: row.school_id,
          code: row.code,
          name: row.name,
          requests: 0,
          tokens: 0,
        };
        current.requests += row.requests;
        current.tokens += row.input_tokens + row.output_tokens;
        sum[row.school_id] = current;
        return sum;
      },
      {},
    ),
  );

  const load = useCallback(() => {
    setLoadError(null);
    reload().catch((caught: unknown) =>
      setLoadError(
        `Không đọc được thiết lập trợ lý AI: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`,
      ),
    );
  }, [reload]);
  useEffect(load, [load]);

  const run = (work: () => Promise<string>) =>
    runBusy(async () => {
      setOutcome(null);
      try {
        setOutcome({ tone: 'ok', text: await work() });
        await reload();
      } catch (caught) {
        setOutcome({ tone: 'danger', text: `Không lưu được: ${errorMessage(caught)}` });
      }
    });

  const saveSettings = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await call(accessToken, 'PUT', 'ai/settings', {
        provider: settings.provider,
        model: settings.model,
        endpoint: settings.endpoint,
      });
      return 'Đã lưu nhà cung cấp và mô hình của nền tảng.';
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
      return 'Đã lưu khóa AI dùng chung của nền tảng.';
    });
  };

  const keyStatus = overview?.key.configured ? (
    <span className="status" data-tone={overview.key.enabled ? 'ok' : 'idle'}>
      Đã nhập {overview.key.hint ?? ''}
      {overview.key.enabled ? '' : ', đang tắt'}
    </span>
  ) : (
    <span className="status" data-tone="warn">
      Chưa nhập khóa
    </span>
  );

  return (
    <section aria-label="Trợ lý AI">
      <div className="page-head">
        <div>
          <h1>Trợ lý AI</h1>
          <p className="lead">
            Nhà cung cấp AI của nền tảng, đơn giá AI theo gói và số token các trường đã dùng trong tháng.
          </p>
        </div>
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      {!overview && !loadError ? (
        <section className="card">
          <Skeleton lines={4} label="Đang tải thiết lập trợ lý AI" />
        </section>
      ) : null}
      {overview ? (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <section className="card" aria-labelledby="nha-cung-cap">
            <h2 id="nha-cung-cap">Nhà cung cấp của nền tảng</h2>
            {canConfigure ? (
              <div className="columns">
                <form className="stack wide" aria-label="Nhà cung cấp và mô hình của nền tảng" onSubmit={saveSettings}>
                  <div className="grid-2">
                    <label className="field">
                      Nhà cung cấp
                      <input
                        value={settings.provider}
                        onChange={(event) => setSettings({ ...settings, provider: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      Mã mô hình
                      <input
                        value={settings.model}
                        onChange={(event) => setSettings({ ...settings, model: event.target.value })}
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>
                      Địa chỉ API <span className="hint">trống là mặc định của nhà cung cấp</span>
                    </span>
                    <input
                      value={settings.endpoint}
                      onChange={(event) => setSettings({ ...settings, endpoint: event.target.value })}
                    />
                  </label>
                  <div className="button-row">
                    <button type="submit" className="button-primary button-large" disabled={busy}>
                      Lưu nhà cung cấp
                    </button>
                  </div>
                </form>
                <form className="stack narrow" aria-label="Khóa AI dùng chung của nền tảng" onSubmit={saveKey}>
                  <div>
                    <strong>Khóa dùng chung</strong> {keyStatus}
                  </div>
                  <p className="muted" style={{ margin: 0 }}>
                    Khóa mã hóa bằng khóa gốc của nền tảng, chỉ ở cơ sở dữ liệu nền tảng, không bao giờ xuống cơ sở dữ
                    liệu của trường và không hiện lại.
                  </p>
                  <label className="field">
                    <span>
                      Khóa API mới <span className="hint">để trống là giữ khóa cũ</span>
                    </span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={key.api_key}
                      onChange={(event) => setKey({ ...key, api_key: event.target.value })}
                    />
                  </label>
                  <div className="feature-row" style={{ borderTop: 0, padding: 0 }}>
                    <div>
                      <span id="bat-khoa-chung">Bật khóa dùng chung</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={key.enabled}
                      aria-labelledby="bat-khoa-chung"
                      onClick={() => setKey({ ...key, enabled: !key.enabled })}
                    />
                  </div>
                  <div className="button-row">
                    <button type="submit" className="button-primary button-large" disabled={busy}>
                      Lưu khóa
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <dl className="details">
                  <dt>Nhà cung cấp</dt>
                  <dd>{overview.settings.provider}</dd>
                  <dt>Mã mô hình</dt>
                  <dd>{overview.settings.model}</dd>
                  <dt>Địa chỉ API</dt>
                  <dd>{overview.settings.endpoint || 'Mặc định của nhà cung cấp'}</dd>
                  <dt>Khóa dùng chung</dt>
                  <dd>{keyStatus}</dd>
                </dl>
                <p className="muted">Chỉ quản trị nền tảng sửa được.</p>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="don-gia-theo-goi">
            <h2 id="don-gia-theo-goi">Đơn giá AI theo gói</h2>
            {overview.plans.length === 0 ? <EmptyState title="Chưa có gói nào" /> : null}
            {overview.plans.length ? (
              <div className="table-scroll">
                <table className="sticky-first" aria-label="Đơn giá AI theo gói" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th scope="col">Gói</th>
                      <th scope="col" className="number">
                        Token miễn phí mỗi kỳ
                      </th>
                      <th scope="col" className="number">
                        Đơn giá vào / ra (đồng mỗi 1.000 token)
                      </th>
                      <th scope="col" className="number">
                        Phí tối thiểu (đồng)
                      </th>
                      <th scope="col">Trạng thái</th>
                      {canPrice ? (
                        <th scope="col">
                          <span className="visually-hidden">Thao tác</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {overview.plans.map((plan) => (
                      <tr key={plan.plan_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{plan.name}</div>
                          <div className="muted">{plan.code}</div>
                        </td>
                        <td className="number">{count(plan.pricing.freeTokens)}</td>
                        <td className="number">
                          {count(plan.pricing.inputPricePer1k)} / {count(plan.pricing.outputPricePer1k)}
                        </td>
                        <td className="number">{count(plan.pricing.minimumFee)}</td>
                        <td>
                          <span className="status" data-tone={plan.ready ? 'ok' : 'warn'}>
                            {plan.ready ? 'Sẵn sàng' : 'Chưa nhập đơn giá'}
                          </span>
                        </td>
                        {canPrice ? (
                          <td>
                            <button
                              type="button"
                              className="button-link"
                              aria-label={`Sửa đơn giá AI của gói ${plan.name} ở Gói dịch vụ`}
                              onClick={() => onOpenPlan(plan.plan_id)}
                            >
                              Sửa ở Gói dịch vụ
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="card" aria-labelledby="token-da-dung">
            <div className="card-head">
              <h2 id="token-da-dung">Token đã dùng trong tháng</h2>
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                Tháng
                <input
                  type="month"
                  className="inline-select"
                  value={month}
                  max={currentMonth()}
                  onChange={(event) => setMonth(event.target.value || currentMonth())}
                />
              </label>
            </div>
            {usageError ? (
              <p className="field-error" role="alert">
                {usageError}
              </p>
            ) : null}
            {bySchool.length ? (
              <div className="table-scroll" style={{ marginBottom: '1rem' }}>
                <table className="sticky-first" aria-label="So với hạn mức của gói" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th scope="col">Trường</th>
                      <th scope="col">Yêu cầu so với hạn mức</th>
                      <th scope="col">Token so với hạn mức</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySchool.map((school) => {
                      const plan = overview.plans.find((item) => item.plan_id === planOfSchool[school.school_id]);
                      return (
                        <tr key={school.school_id}>
                          <td>
                            <div>{school.name}</div>
                            <div className="muted">
                              {school.code} · {plan ? `gói ${plan.name}` : 'chưa gán gói'}
                            </div>
                          </td>
                          <td>
                            <QuotaBar
                              label={`Yêu cầu AI của ${school.code} so với hạn mức`}
                              used={school.requests}
                              limit={plan?.ai_max_requests ?? null}
                            />
                          </td>
                          <td>
                            <QuotaBar
                              label={`Token AI của ${school.code} so với hạn mức`}
                              used={school.tokens}
                              limit={plan?.ai_max_tokens ?? null}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {usage.length === 0 ? (
              usageError ? null : (
                <EmptyState title="Tháng này chưa có lượt dùng trợ lý AI" />
              )
            ) : (
              <div className="table-scroll">
                <table className="sticky-first" aria-label="Token AI đã dùng" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th scope="col">Trường</th>
                      <th scope="col">Cấu hình</th>
                      <th scope="col">Mô hình</th>
                      <th scope="col" className="number">
                        Yêu cầu
                      </th>
                      <th scope="col" className="number">
                        Token vào
                      </th>
                      <th scope="col" className="number">
                        Token ra
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => (
                      <tr key={`${row.school_id}-${row.config}-${row.model}`}>
                        <td>
                          <div>{row.name}</div>
                          <div className="muted">{row.code}</div>
                        </td>
                        <td>
                          <span
                            className="status"
                            data-tone={row.config === 'platform' || row.config === 'tutor_school' ? 'info' : 'idle'}
                          >
                            {USAGE_CONFIG_LABELS[row.config]}
                          </span>
                        </td>
                        <td>{row.model}</td>
                        <td className="number">{count(row.requests)}</td>
                        <td className="number">{count(row.input_tokens)}</td>
                        <td className="number">{count(row.output_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
