import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import { PlatformApiError } from './platform-api.js';
import {
  ConfirmDialog,
  EmptyState,
  errorMessage,
  LoadError,
  OutcomeBanner,
  Skeleton,
  TabList,
  TabPanel,
  useBusy,
  type Outcome,
} from './platform-ui.js';

// Trang "Gói dịch vụ" của cổng vận hành nền tảng (DT-SaaS phần S5a, YCTD-194): lập, sửa gói (phân hệ, giới hạn, giá niêm yết cho
// S5b), gán gói cho trường, đặt hạn dùng thử, hạn đã trả phí, đổi trạng thái, chạy chuyển trạng thái theo hạn. Giao diện YCTD-370: hai thẻ
// chọn Các gói, Gói của từng trường; biểu mẫu chỉ hiện khi lập hoặc sửa; vai trò không có plans.manage xem ở dạng chỉ xem
interface PlanModule {
  key: string;
  label: string;
  core: boolean;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  modules: string[] | null;
  max_active_students: number | null;
  max_storage_mb: number | null;
  max_school_levels: number | null;
  // Hạn mức AI mỗi tháng (DT-23 phần 23d): trống là không giới hạn, 0 là không dùng AI
  ai_max_requests: number | null;
  ai_max_tokens: number | null;
  // Lớp video (DT-27 phần 27a): trống là không giới hạn, 0 là không có video hoặc không ghi hình
  video_max_minutes: number | null;
  video_max_recording_mb: number | null;
  trial_days: number;
  pricing_mode: 'per_student' | 'per_school' | 'per_module';
  unit_price: number;
  minimum_fee: number;
  billing_cycle: 'monthly' | 'term' | 'yearly';
  status: 'active' | 'archived';
  school_count: number;
  price_rule_id: string | null;
}

interface PriceRuleOption {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'archived';
}

interface PlanSchool {
  id: string;
  code: string;
  name: string;
  status: string;
  trial_ends_on: string | null;
  paid_until: string | null;
  plan: { id: string; code: string; name: string; effective_from: string } | null;
}

const PRICING_LABELS: Record<Plan['pricing_mode'], string> = {
  per_student: 'Theo số học sinh đang học',
  per_school: 'Theo trường',
  per_module: 'Theo phân hệ',
};
const STATUS_LABELS: Record<string, string> = {
  trial: 'Dùng thử',
  active: 'Hoạt động',
  read_only: 'Chỉ đọc',
  suspended: 'Tạm ngưng',
};

export async function call<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/auth/platform/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let message = 'Không thực hiện được, vui lòng thử lại';
    try {
      const payload = (await response.json()) as { error?: { message?: string; details?: Array<{ message: string }> } };
      message = [payload.error?.message, ...(payload.error?.details ?? []).map((detail) => detail.message)]
        .filter(Boolean)
        .join('. ');
    } catch {
      // Phản hồi không phải JSON: giữ thông điệp mặc định
    }
    throw new PlatformApiError(response.status, message);
  }
  return (await response.json()) as T;
}

const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text));

const emptyForm = {
  id: null as string | null,
  code: '',
  name: '',
  allModules: true,
  modules: [] as string[],
  max_active_students: '',
  max_storage_mb: '',
  max_school_levels: '',
  ai_max_requests: '',
  ai_max_tokens: '',
  video_max_minutes: '',
  video_max_recording_mb: '',
  trial_days: '30',
  pricing_mode: 'per_student' as Plan['pricing_mode'],
  unit_price: '0',
  minimum_fee: '0',
  billing_cycle: 'monthly' as Plan['billing_cycle'],
  price_rule_id: '',
};

interface AiPricingForm {
  free_tokens: string;
  input_price_per_1k: string;
  output_price_per_1k: string;
  minimum_fee: string;
  rounding_step: string;
  model_prices: string;
}

// Phí AI của gói (DT-23 phần 23d, GD-103): token miễn phí mỗi kỳ, đơn giá token vào và ra theo 1.000 token, phí tối thiểu, làm tròn; số
// tiền để trống cho đến khi nhập lúc triển khai. Nằm cùng trang Gói dịch vụ, cùng quy tắc tính phí của S5a, S5b. Từ YCTD-370 là thẻ
// riêng, cảnh báo khi gói chưa nhập đơn giá, lỗi JSON hiện tại đúng ô
function AiPricingBlock({ accessToken, planId, planName }: { accessToken: string; planId: string; planName: string }) {
  const [form, setForm] = useState<AiPricingForm | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => {
    call<{ plans: Array<{ plan_id: string; pricing: Record<string, unknown> & { modelPrices: unknown } }> }>(
      accessToken,
      'GET',
      'ai',
    )
      .then((overview) => {
        const pricing = overview.plans.find((plan) => plan.plan_id === planId)?.pricing as
          | {
              freeTokens: number;
              inputPricePer1k: number | null;
              outputPricePer1k: number | null;
              minimumFee: number;
              roundingStep: number;
              modelPrices: unknown;
            }
          | undefined;
        setForm({
          free_tokens: String(pricing?.freeTokens ?? 0),
          input_price_per_1k: pricing?.inputPricePer1k?.toString() ?? '',
          output_price_per_1k: pricing?.outputPricePer1k?.toString() ?? '',
          minimum_fee: String(pricing?.minimumFee ?? 0),
          rounding_step: String(pricing?.roundingStep ?? 1),
          model_prices: JSON.stringify(pricing?.modelPrices ?? {}),
        });
      })
      .catch(() => setLoadError('Không đọc được phí AI của gói'));
  }, [accessToken, planId]);
  if (!form) {
    return loadError ? (
      <section className="card">
        <p className="field-error" role="alert">
          {loadError}
        </p>
      </section>
    ) : null;
  }
  const field = (name: keyof AiPricingForm, label: string, hint?: string) => (
    <label className="field">
      <span>
        {label} {hint ? <span className="hint">{hint}</span> : null}
      </span>
      <input
        inputMode="decimal"
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
      />
    </label>
  );
  const save = (event: FormEvent) => {
    event.preventDefault();
    setOutcome(null);
    let modelPrices: unknown = {};
    try {
      modelPrices = form.model_prices.trim() ? JSON.parse(form.model_prices) : {};
      setJsonError(null);
    } catch (caught) {
      setJsonError(
        `JSON không hợp lệ (${caught instanceof Error ? caught.message : 'sai cú pháp'}). Ví dụ đúng: {"mo-hinh-a": {"input": 30, "output": 120}}`,
      );
      return;
    }
    void run(async () => {
      try {
        await call(accessToken, 'PUT', `ai/pricing/${planId}`, {
          free_tokens: numberOrNull(form.free_tokens) ?? 0,
          input_price_per_1k: numberOrNull(form.input_price_per_1k),
          output_price_per_1k: numberOrNull(form.output_price_per_1k),
          minimum_fee: numberOrNull(form.minimum_fee) ?? 0,
          rounding_step: numberOrNull(form.rounding_step) ?? 1,
          model_prices: modelPrices,
        });
        setOutcome({ tone: 'ok', text: `Đã lưu phí AI của gói ${planName}.` });
      } catch (caught) {
        setOutcome({ tone: 'danger', text: `Không lưu được phí AI: ${errorMessage(caught)}` });
      }
    });
  };
  const unpriced = form.input_price_per_1k.trim() === '' || form.output_price_per_1k.trim() === '';
  return (
    <section className="card" aria-labelledby="phi-ai-cua-goi">
      <h2 id="phi-ai-cua-goi">Phí AI của gói {planName}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Trường chọn cấu hình nền tảng cấp khóa trả phí theo token: mỗi kỳ trừ token miễn phí, phần còn lại nhân đơn giá,
        làm tròn lên, không thấp hơn phí tối thiểu. Đơn giá để trống thì trường thuộc gói này chưa dùng được cấu hình đó.
      </p>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      <form className="stack" aria-label={`Phí AI của gói ${planName}`} onSubmit={save}>
        <div className="grid-3">
          {field('free_tokens', 'Token miễn phí mỗi kỳ')}
          {field('input_price_per_1k', 'Đơn giá token vào', 'đồng mỗi 1.000 token')}
          {field('output_price_per_1k', 'Đơn giá token ra', 'đồng mỗi 1.000 token')}
          {field('minimum_fee', 'Phí tối thiểu của thành phần AI (đồng)')}
          {field('rounding_step', 'Làm tròn lên theo bội của (đồng)')}
        </div>
        <label className="field">
          <span>
            Đơn giá riêng theo mô hình <span className="hint">dạng JSON; trống là dùng đơn giá chung</span>
          </span>
          <textarea
            rows={3}
            value={form.model_prices}
            onChange={(event) => setForm({ ...form, model_prices: event.target.value })}
            aria-invalid={jsonError ? true : undefined}
            aria-describedby={jsonError ? 'don-gia-mo-hinh-loi' : undefined}
          />
          {jsonError ? (
            <span className="field-error" id="don-gia-mo-hinh-loi">
              {jsonError}
            </span>
          ) : null}
        </label>
        {unpriced ? (
          <div className="banner" data-tone="warn" style={{ margin: 0 }}>
            Gói này chưa nhập đơn giá token: trường thuộc gói chưa dùng được cấu hình "Nền tảng cấp khóa".
          </div>
        ) : null}
        <div className="button-row">
          <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang lưu…' : 'Lưu phí AI'}
          </button>
        </div>
      </form>
    </section>
  );
}

const TABS = [
  { key: 'cac-goi', label: 'Các gói' },
  { key: 'goi-cua-truong', label: 'Gói của từng trường' },
] as const;
type PlansTab = (typeof TABS)[number]['key'];

function count(value: number): string {
  return value.toLocaleString('vi-VN');
}

function day(value: string | null): string {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '—';
}

function limitsOf(plan: Plan): string {
  return (
    [
      plan.max_active_students !== null ? `${count(plan.max_active_students)} học sinh` : null,
      plan.max_storage_mb !== null ? `${count(plan.max_storage_mb)} MB` : null,
      plan.max_school_levels !== null ? `${plan.max_school_levels} cấp học` : null,
      plan.ai_max_requests !== null ? `${count(plan.ai_max_requests)} yêu cầu AI mỗi tháng` : null,
      plan.ai_max_tokens !== null ? `${count(plan.ai_max_tokens)} token AI mỗi tháng` : null,
      plan.video_max_minutes !== null ? `${count(plan.video_max_minutes)} phút video mỗi tháng` : null,
      plan.video_max_recording_mb !== null ? `${count(plan.video_max_recording_mb)} MB bản ghi video` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Không giới hạn'
  );
}

export function PlansPage({
  accessToken,
  role,
  focusPlanId,
}: {
  accessToken: string;
  role: OperatorRole;
  // Mở sẵn biểu mẫu sửa gói này (nút "Sửa ở Gói dịch vụ" của trang Trợ lý AI)
  focusPlanId?: string | null;
}) {
  const canManage = operatorCan(role, 'plans.manage');
  const canPriceAi = operatorCan(role, 'ai.pricing');
  // Quy tắc tính phí thuộc trang Thu phí: chỉ đọc khi vai trò có billing.view (LOI-VH2-1: Hỗ trợ, Kỹ thuật bị 403 làm hỏng cả trang)
  const canReadRules = operatorCan(role, 'billing.view');
  const [tab, setTab] = useState<PlansTab>('cac-goi');
  const [modules, setModules] = useState<PlanModule[]>([]);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [schools, setSchools] = useState<PlanSchool[]>([]);
  const [rules, setRules] = useState<PriceRuleOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmLifecycle, setConfirmLifecycle] = useState(false);
  const [busy, runBusy] = useBusy();
  const [assign, setAssign] = useState<
    Record<string, { plan_id: string; trial_ends_on: string; paid_until: string; status: string }>
  >({});

  const reload = useCallback(async () => {
    const [nextModules, nextPlans, nextSchools, nextRules] = await Promise.all([
      call<PlanModule[]>(accessToken, 'GET', 'plan-modules'),
      call<Plan[]>(accessToken, 'GET', 'plans'),
      call<PlanSchool[]>(accessToken, 'GET', 'plan-schools'),
      canReadRules ? call<PriceRuleOption[]>(accessToken, 'GET', 'billing/price-rules') : Promise.resolve([]),
    ]);
    setRules(nextRules);
    setModules(nextModules);
    setPlans(nextPlans);
    setSchools(nextSchools);
  }, [accessToken, canReadRules]);

  const load = useCallback(() => {
    setLoadError(null);
    reload().catch((caught: unknown) =>
      setLoadError(`Không đọc được danh sách gói: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`),
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
        setOutcome({ tone: 'danger', text: `Không thực hiện được: ${errorMessage(caught)}` });
      }
    });

  const savePlan = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const body = {
        code: form.code,
        name: form.name,
        modules: form.allModules ? null : form.modules,
        max_active_students: numberOrNull(form.max_active_students),
        max_storage_mb: numberOrNull(form.max_storage_mb),
        max_school_levels: numberOrNull(form.max_school_levels),
        ai_max_requests: numberOrNull(form.ai_max_requests),
        ai_max_tokens: numberOrNull(form.ai_max_tokens),
        video_max_minutes: numberOrNull(form.video_max_minutes),
        video_max_recording_mb: numberOrNull(form.video_max_recording_mb),
        trial_days: Number(form.trial_days),
        pricing_mode: form.pricing_mode,
        unit_price: Number(form.unit_price),
        minimum_fee: Number(form.minimum_fee),
        billing_cycle: form.billing_cycle,
        price_rule_id: form.price_rule_id || null,
      };
      const saved = await call<Plan>(
        accessToken,
        form.id ? 'PUT' : 'POST',
        form.id ? `plans/${form.id}` : 'plans',
        body,
      );
      setForm(emptyForm);
      setEditing(false);
      return `Đã lưu gói ${saved.name}.`;
    });
  };

  const edit = useCallback((plan: Plan) => {
    setForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      allModules: plan.modules === null,
      modules: plan.modules ?? [],
      max_active_students: plan.max_active_students?.toString() ?? '',
      max_storage_mb: plan.max_storage_mb?.toString() ?? '',
      max_school_levels: plan.max_school_levels?.toString() ?? '',
      ai_max_requests: plan.ai_max_requests?.toString() ?? '',
      ai_max_tokens: plan.ai_max_tokens?.toString() ?? '',
      video_max_minutes: plan.video_max_minutes?.toString() ?? '',
      video_max_recording_mb: plan.video_max_recording_mb?.toString() ?? '',
      trial_days: String(plan.trial_days),
      pricing_mode: plan.pricing_mode,
      unit_price: String(plan.unit_price),
      minimum_fee: String(plan.minimum_fee),
      billing_cycle: plan.billing_cycle,
      price_rule_id: plan.price_rule_id ?? '',
    });
    setEditing(true);
    setTab('cac-goi');
  }, []);

  // Mở từ trang Trợ lý AI: sửa đúng gói một lần khi danh sách đã tải
  const appliedFocus = useRef<string | null>(null);
  useEffect(() => {
    const target = focusPlanId ? plans?.find((plan) => plan.id === focusPlanId) : undefined;
    if (target && canManage && appliedFocus.current !== target.id) {
      appliedFocus.current = target.id;
      edit(target);
    }
  }, [focusPlanId, plans, canManage, edit]);

  const assignmentOf = (school: PlanSchool) =>
    assign[school.id] ?? {
      plan_id: school.plan?.id ?? '',
      trial_ends_on: school.trial_ends_on ?? '',
      paid_until: school.paid_until ?? '',
      status: school.status,
    };

  const changed = (school: PlanSchool) => {
    const value = assign[school.id];
    return (
      value !== undefined &&
      (value.plan_id !== (school.plan?.id ?? '') ||
        value.trial_ends_on !== (school.trial_ends_on ?? '') ||
        value.paid_until !== (school.paid_until ?? '') ||
        value.status !== school.status)
    );
  };

  const saveSchool = (school: PlanSchool) =>
    void run(async () => {
      const value = assignmentOf(school);
      await call(accessToken, 'PUT', `plan-schools/${school.id}`, {
        ...(value.plan_id && value.plan_id !== school.plan?.id ? { plan_id: value.plan_id } : {}),
        trial_ends_on: value.trial_ends_on || null,
        paid_until: value.paid_until || null,
        ...(value.status !== school.status ? { status: value.status } : {}),
      });
      setAssign((current) => {
        const next = { ...current };
        delete next[school.id];
        return next;
      });
      return `Đã cập nhật gói của trường ${school.code}.`;
    });

  const numberField = (name: keyof typeof emptyForm, label: string, hint?: string) => (
    <label className="field">
      <span>
        {label} {hint ? <span className="hint">{hint}</span> : null}
      </span>
      <input
        inputMode="numeric"
        value={form[name] as string}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
      />
    </label>
  );

  return (
    <section aria-label="Gói dịch vụ">
      <div className="page-head">
        <div>
          <h1>Gói dịch vụ</h1>
          <p className="lead">
            Gói quyết định phân hệ, giới hạn và giá niêm yết của trường. Bật riêng một tính năng cho một trường làm ở trang
            chi tiết trường.
          </p>
        </div>
        {canManage ? (
          <div className="page-actions">
            <button
              type="button"
              className="button-primary button-large"
              onClick={() => {
                setForm(emptyForm);
                setEditing(true);
                setTab('cac-goi');
              }}
            >
              Lập gói mới
            </button>
          </div>
        ) : null}
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      <TabList label="Phần của gói dịch vụ" tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'cac-goi' ? (
        <TabPanel tab="cac-goi">
          <div className="stack" style={{ gap: '1.5rem' }}>
            <section className="card" aria-labelledby="cac-goi-tieu-de">
              <h2 id="cac-goi-tieu-de">Các gói</h2>
              {plans === null && !loadError ? <Skeleton lines={3} /> : null}
              {plans?.length === 0 ? (
                <EmptyState title="Chưa có gói nào">Lập gói đầu tiên để gán cho trường.</EmptyState>
              ) : null}
              {plans?.length ? (
                <div className="table-scroll">
                  <table className="sticky-first" aria-label="Danh sách gói" style={{ minWidth: 820 }}>
                    <thead>
                      <tr>
                        <th scope="col">Gói</th>
                        <th scope="col">Phân hệ</th>
                        <th scope="col">Giới hạn</th>
                        <th scope="col">Giá niêm yết</th>
                        <th scope="col" className="number">
                          Số trường
                        </th>
                        {canManage ? (
                          <th scope="col">
                            <span className="visually-hidden">Thao tác</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{plan.name}</div>
                            <div className="muted">{plan.code}</div>
                            {plan.status === 'archived' ? (
                              <span className="status" data-tone="idle">
                                Ngừng dùng
                              </span>
                            ) : null}
                          </td>
                          <td className="nowrap">
                            {plan.modules === null ? 'Mọi phân hệ' : `${plan.modules.length} phân hệ`}
                          </td>
                          <td>{limitsOf(plan)}</td>
                          <td>
                            {PRICING_LABELS[plan.pricing_mode]}: {count(plan.unit_price)} đ
                          </td>
                          <td className="number">{count(plan.school_count)}</td>
                          {canManage ? (
                            <td>
                              <button
                                type="button"
                                className="button-link"
                                aria-label={`Sửa gói ${plan.name}`}
                                onClick={() => edit(plan)}
                              >
                                Sửa
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
            {editing && canManage ? (
              <section className="card" aria-labelledby="bieu-mau-goi">
                <h2 id="bieu-mau-goi">{form.id ? `Sửa gói: ${form.name}` : 'Lập gói mới'}</h2>
                <form
                  className="stack"
                  style={{ gap: '1.25rem' }}
                  aria-label={form.id ? 'Sửa gói' : 'Lập gói'}
                  onSubmit={savePlan}
                >
                  <fieldset className="form-group" style={{ borderTop: 0, paddingTop: 0 }}>
                    <legend>Thông tin gói</legend>
                    <div className="grid-2">
                      <label className="field">
                        Mã gói
                        <input
                          value={form.code}
                          onChange={(event) => setForm({ ...form, code: event.target.value })}
                          required
                        />
                      </label>
                      <label className="field">
                        Tên gói
                        <input
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                  </fieldset>
                  <fieldset className="form-group">
                    <legend>Phân hệ trong gói</legend>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={form.allModules}
                        onChange={(event) => setForm({ ...form, allModules: event.target.checked })}
                      />
                      Mọi phân hệ
                    </label>
                    {!form.allModules ? (
                      <div className="grid-3" role="group" aria-label="Phân hệ được bật" style={{ gap: '0.25rem 1rem', marginTop: '0.5rem' }}>
                        {modules.map((module) => (
                          <label key={module.key} className="check">
                            <input
                              type="checkbox"
                              disabled={module.core}
                              checked={module.core || form.modules.includes(module.key)}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  modules: event.target.checked
                                    ? [...form.modules, module.key]
                                    : form.modules.filter((key) => key !== module.key),
                                })
                              }
                            />
                            {module.label}
                            {module.core ? ' (luôn bật)' : ''}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </fieldset>
                  <fieldset className="form-group">
                    <legend>
                      Giới hạn <span className="muted" style={{ fontWeight: 400 }}>· để trống là không giới hạn</span>
                    </legend>
                    <div className="grid-3">
                      {numberField('max_active_students', 'Học sinh đang học tối đa')}
                      {numberField('max_storage_mb', 'Dung lượng tệp tối đa (MB)')}
                      {numberField('max_school_levels', 'Số cấp học tối đa')}
                      {numberField('ai_max_requests', 'Yêu cầu AI mỗi tháng', '0 là không dùng AI')}
                      {numberField('ai_max_tokens', 'Token AI mỗi tháng')}
                      {numberField('video_max_minutes', 'Phút người dự lớp video mỗi tháng', '0 là không có video')}
                      {numberField('video_max_recording_mb', 'Dung lượng bản ghi video (MB)', '0 là không ghi hình')}
                    </div>
                  </fieldset>
                  <fieldset className="form-group">
                    <legend>Giá và thu phí</legend>
                    <div className="grid-3">
                      {numberField('trial_days', 'Số ngày dùng thử')}
                      <label className="field">
                        Cách tính phí
                        <select
                          value={form.pricing_mode}
                          onChange={(event) =>
                            setForm({ ...form, pricing_mode: event.target.value as Plan['pricing_mode'] })
                          }
                        >
                          {Object.entries(PRICING_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {numberField('unit_price', 'Đơn giá (đồng)')}
                      {numberField('minimum_fee', 'Phí tối thiểu (đồng)')}
                      {canReadRules ? (
                        <label className="field">
                          Quy tắc tính phí (thu phí tự động)
                          <select
                            value={form.price_rule_id}
                            onChange={(event) => setForm({ ...form, price_rule_id: event.target.value })}
                          >
                            <option value="">Theo giá niêm yết của gói</option>
                            {rules
                              .filter((rule) => rule.status === 'active' || rule.id === form.price_rule_id)
                              .map((rule) => (
                                <option key={rule.id} value={rule.id}>
                                  {rule.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </fieldset>
                  <div className="button-row">
                    <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
                      {busy ? 'Đang lưu…' : 'Lưu gói'}
                    </button>
                    <button
                      type="button"
                      className="button-secondary button-large"
                      onClick={() => {
                        setForm(emptyForm);
                        setEditing(false);
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
            {editing && form.id && canPriceAi ? (
              <AiPricingBlock key={form.id} accessToken={accessToken} planId={form.id} planName={form.name} />
            ) : null}
          </div>
        </TabPanel>
      ) : null}
      {tab === 'goi-cua-truong' ? (
        <TabPanel tab="goi-cua-truong">
          <section className="card" aria-labelledby="goi-cua-truong-tieu-de">
            <div className="card-head">
              <h2 id="goi-cua-truong-tieu-de">Gói của từng trường</h2>
              {canManage ? (
                <button type="button" className="button-secondary" onClick={() => setConfirmLifecycle(true)}>
                  Chạy chuyển trạng thái theo hạn
                </button>
              ) : null}
            </div>
            {plans !== null && schools.length === 0 ? <EmptyState title="Chưa có trường nào" /> : null}
            {schools.length ? (
              <div className="table-scroll">
                <table className="sticky-first" aria-label="Gói của từng trường" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th scope="col">Trường</th>
                      <th scope="col">Gói</th>
                      <th scope="col">Hạn dùng thử</th>
                      <th scope="col">Hạn đã trả phí</th>
                      <th scope="col">Trạng thái</th>
                      {canManage ? (
                        <th scope="col">
                          <span className="visually-hidden">Thao tác</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((school) => {
                      const value = assignmentOf(school);
                      const update = (change: Partial<typeof value>) =>
                        setAssign({ ...assign, [school.id]: { ...value, ...change } });
                      const dirty = changed(school);
                      return (
                        <tr key={school.id}>
                          <td>
                            <div>{school.name}</div>
                            <div className="muted">{school.code}</div>
                            {dirty ? (
                              <span className="status" data-tone="warn">
                                Chưa lưu
                              </span>
                            ) : null}
                          </td>
                          {canManage ? (
                            <>
                              <td>
                                <select
                                  className="inline-select"
                                  aria-label={`Gói của ${school.code}`}
                                  value={value.plan_id}
                                  onChange={(event) => update({ plan_id: event.target.value })}
                                >
                                  <option value="">Chưa gán</option>
                                  {(plans ?? [])
                                    .filter((plan) => plan.status === 'active' || plan.id === school.plan?.id)
                                    .map((plan) => (
                                      <option key={plan.id} value={plan.id}>
                                        {plan.name}
                                      </option>
                                    ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="inline-select"
                                  aria-label={`Hạn dùng thử của ${school.code}`}
                                  value={value.trial_ends_on}
                                  onChange={(event) => update({ trial_ends_on: event.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="inline-select"
                                  aria-label={`Hạn đã trả phí của ${school.code}`}
                                  value={value.paid_until}
                                  onChange={(event) => update({ paid_until: event.target.value })}
                                />
                              </td>
                              <td>
                                <select
                                  className="inline-select"
                                  aria-label={`Trạng thái của ${school.code}`}
                                  value={value.status}
                                  onChange={(event) => update({ status: event.target.value })}
                                >
                                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="button-secondary"
                                  aria-label={`Lưu gói của ${school.code}`}
                                  disabled={!dirty || busy}
                                  onClick={() => saveSchool(school)}
                                >
                                  Lưu
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{school.plan?.name ?? 'Chưa gán'}</td>
                              <td>{day(school.trial_ends_on)}</td>
                              <td>{day(school.paid_until)}</td>
                              <td>{STATUS_LABELS[school.status] ?? school.status}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </TabPanel>
      ) : null}
      {confirmLifecycle ? (
        <ConfirmDialog
          title="Chạy chuyển trạng thái theo hạn?"
          confirmLabel="Chạy chuyển trạng thái"
          busy={busy}
          onConfirm={() =>
            void run(async () => {
              const result = await call<{ changes: unknown[]; reminders: unknown[] }>(
                accessToken,
                'POST',
                'plan-lifecycle',
              );
              setConfirmLifecycle(false);
              return `Đã chuyển trạng thái ${result.changes.length} trường, ${result.reminders.length} trường cần nhắc hạn.`;
            }).then(() => setConfirmLifecycle(false))
          }
          onCancel={() => setConfirmLifecycle(false)}
        >
          <p style={{ margin: 0 }}>
            Hệ thống chuyển trạng thái các trường theo hạn dùng thử và hạn đã trả phí, rồi báo số trường đã chuyển và số
            trường cần nhắc hạn. Chạy lặp trong ngày không đổi thêm.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
