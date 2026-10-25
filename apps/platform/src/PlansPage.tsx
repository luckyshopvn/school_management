import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PlatformApiError } from './platform-api.js';

// Trang "Gói dịch vụ" của cổng vận hành nền tảng (DT-SaaS phần S5a, YCTD-194): lập, sửa gói (phân hệ, giới hạn, giá niêm yết cho
// S5b), gán gói cho trường, đặt hạn dùng thử, hạn đã trả phí, đổi trạng thái, chạy chuyển trạng thái theo hạn
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
  trial_days: number;
  pricing_mode: 'per_student' | 'per_school' | 'per_module';
  unit_price: number;
  minimum_fee: number;
  billing_cycle: 'monthly' | 'term' | 'yearly';
  status: 'active' | 'archived';
  school_count: number;
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

async function call<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
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
  trial_days: '30',
  pricing_mode: 'per_student' as Plan['pricing_mode'],
  unit_price: '0',
  minimum_fee: '0',
  billing_cycle: 'monthly' as Plan['billing_cycle'],
};

export function PlansPage({ accessToken }: { accessToken: string }) {
  const [modules, setModules] = useState<PlanModule[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [schools, setSchools] = useState<PlanSchool[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assign, setAssign] = useState<
    Record<string, { plan_id: string; trial_ends_on: string; paid_until: string; status: string }>
  >({});

  const reload = useCallback(async () => {
    const [nextModules, nextPlans, nextSchools] = await Promise.all([
      call<PlanModule[]>(accessToken, 'GET', 'plan-modules'),
      call<Plan[]>(accessToken, 'GET', 'plans'),
      call<PlanSchool[]>(accessToken, 'GET', 'plan-schools'),
    ]);
    setModules(nextModules);
    setPlans(nextPlans);
    setSchools(nextSchools);
  }, [accessToken]);

  useEffect(() => {
    reload().catch(() => setError('Không đọc được danh sách gói'));
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
        trial_days: Number(form.trial_days),
        pricing_mode: form.pricing_mode,
        unit_price: Number(form.unit_price),
        minimum_fee: Number(form.minimum_fee),
        billing_cycle: form.billing_cycle,
      };
      const saved = await call<Plan>(
        accessToken,
        form.id ? 'PUT' : 'POST',
        form.id ? `plans/${form.id}` : 'plans',
        body,
      );
      setForm(emptyForm);
      return `Đã lưu gói ${saved.name}`;
    });
  };

  const edit = (plan: Plan) =>
    setForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      allModules: plan.modules === null,
      modules: plan.modules ?? [],
      max_active_students: plan.max_active_students?.toString() ?? '',
      max_storage_mb: plan.max_storage_mb?.toString() ?? '',
      max_school_levels: plan.max_school_levels?.toString() ?? '',
      trial_days: String(plan.trial_days),
      pricing_mode: plan.pricing_mode,
      unit_price: String(plan.unit_price),
      minimum_fee: String(plan.minimum_fee),
      billing_cycle: plan.billing_cycle,
    });

  const assignmentOf = (school: PlanSchool) =>
    assign[school.id] ?? {
      plan_id: school.plan?.id ?? '',
      trial_ends_on: school.trial_ends_on ?? '',
      paid_until: school.paid_until ?? '',
      status: school.status,
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
      return `Đã cập nhật gói của trường ${school.code}`;
    });

  return (
    <section aria-label="Gói dịch vụ">
      <h2>Gói dịch vụ</h2>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <table aria-label="Danh sách gói">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên</th>
            <th>Phân hệ</th>
            <th>Giới hạn</th>
            <th>Giá niêm yết</th>
            <th>Số trường</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>{plan.code}</td>
              <td>
                {plan.name}
                {plan.status === 'archived' ? ' (ngừng dùng)' : ''}
              </td>
              <td>{plan.modules === null ? 'Mọi phân hệ' : `${plan.modules.length} phân hệ`}</td>
              <td>
                {[
                  plan.max_active_students !== null ? `${plan.max_active_students} học sinh` : null,
                  plan.max_storage_mb !== null ? `${plan.max_storage_mb} MB` : null,
                  plan.max_school_levels !== null ? `${plan.max_school_levels} cấp học` : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Không giới hạn'}
              </td>
              <td>
                {PRICING_LABELS[plan.pricing_mode]}: {plan.unit_price.toLocaleString('vi-VN')} đ
              </td>
              <td>{plan.school_count}</td>
              <td>
                <button type="button" onClick={() => edit(plan)}>
                  Sửa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form aria-label={form.id ? 'Sửa gói' : 'Lập gói'} onSubmit={savePlan}>
        <h3>{form.id ? 'Sửa gói' : 'Lập gói'}</h3>
        <label>
          Mã gói
          <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
        </label>
        <label>
          Tên gói
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.allModules}
            onChange={(event) => setForm({ ...form, allModules: event.target.checked })}
          />{' '}
          Mọi phân hệ
        </label>
        {!form.allModules ? (
          <fieldset>
            <legend>Phân hệ được bật</legend>
            {modules.map((module) => (
              <label key={module.key}>
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
                />{' '}
                {module.label}
                {module.core ? ' (luôn bật)' : ''}
              </label>
            ))}
          </fieldset>
        ) : null}
        <label>
          Tối đa học sinh đang học
          <input
            inputMode="numeric"
            value={form.max_active_students}
            onChange={(event) => setForm({ ...form, max_active_students: event.target.value })}
          />
        </label>
        <label>
          Tối đa dung lượng tệp (MB)
          <input
            inputMode="numeric"
            value={form.max_storage_mb}
            onChange={(event) => setForm({ ...form, max_storage_mb: event.target.value })}
          />
        </label>
        <label>
          Tối đa số cấp học
          <input
            inputMode="numeric"
            value={form.max_school_levels}
            onChange={(event) => setForm({ ...form, max_school_levels: event.target.value })}
          />
        </label>
        <label>
          Số ngày dùng thử
          <input
            inputMode="numeric"
            value={form.trial_days}
            onChange={(event) => setForm({ ...form, trial_days: event.target.value })}
          />
        </label>
        <label>
          Cách tính phí
          <select
            value={form.pricing_mode}
            onChange={(event) => setForm({ ...form, pricing_mode: event.target.value as Plan['pricing_mode'] })}
          >
            {Object.entries(PRICING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Đơn giá (đồng)
          <input
            inputMode="numeric"
            value={form.unit_price}
            onChange={(event) => setForm({ ...form, unit_price: event.target.value })}
          />
        </label>
        <label>
          Phí tối thiểu (đồng)
          <input
            inputMode="numeric"
            value={form.minimum_fee}
            onChange={(event) => setForm({ ...form, minimum_fee: event.target.value })}
          />
        </label>
        <button type="submit">Lưu gói</button>
      </form>

      <h3>Gói của từng trường</h3>
      <button
        type="button"
        onClick={() =>
          void run(async () => {
            const result = await call<{ changes: unknown[]; reminders: unknown[] }>(
              accessToken,
              'POST',
              'plan-lifecycle',
            );
            return `Đã chuyển trạng thái ${result.changes.length} trường, ${result.reminders.length} trường cần nhắc`;
          })
        }
      >
        Chạy chuyển trạng thái theo hạn
      </button>
      <table aria-label="Gói của từng trường">
        <thead>
          <tr>
            <th>Trường</th>
            <th>Gói</th>
            <th>Hạn dùng thử</th>
            <th>Hạn đã trả phí</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => {
            const value = assignmentOf(school);
            const update = (change: Partial<typeof value>) =>
              setAssign({ ...assign, [school.id]: { ...value, ...change } });
            return (
              <tr key={school.id}>
                <td>
                  {school.code} – {school.name}
                </td>
                <td>
                  <select
                    aria-label={`Gói của ${school.code}`}
                    value={value.plan_id}
                    onChange={(event) => update({ plan_id: event.target.value })}
                  >
                    <option value="">Chưa gán</option>
                    {plans
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
                    aria-label={`Hạn dùng thử của ${school.code}`}
                    value={value.trial_ends_on}
                    onChange={(event) => update({ trial_ends_on: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    aria-label={`Hạn đã trả phí của ${school.code}`}
                    value={value.paid_until}
                    onChange={(event) => update({ paid_until: event.target.value })}
                  />
                </td>
                <td>
                  <select
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
                  <button type="button" onClick={() => saveSchool(school)}>
                    Lưu
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
