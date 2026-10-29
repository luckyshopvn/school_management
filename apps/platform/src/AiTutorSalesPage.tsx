import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PlatformApiError } from './platform-api.js';
import {
  dateTime,
  Dialog,
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

// Trang "Gia sư AI" của cổng vận hành (YCTD-383 lát L1b, bản mẫu MH-600): gói nền tảng bán thẳng cho phụ huynh (tạo, sửa, ngừng bán; gói
// tháng, gói lượt, cấp học áp dụng), danh sách giao dịch, biên lai, hủy giao dịch đang chờ, hoàn tiền (ghi người thao tác và lý do). Máy chủ
// API ở `/api/v1/platform-ai-tutor/*`, vai trò quản trị hoặc kế toán
type Level = 'TH' | 'THCS' | 'THPT';

interface Plan {
  id: string;
  kind: 'monthly' | 'top_up';
  name: string;
  price: number;
  turns: number;
  allow_images: boolean;
  school_levels: Level[];
  status: 'active' | 'archived';
  paid_orders: number;
}

interface OrderRow {
  id: string;
  code: string;
  school_name: string;
  plan_name: string;
  kind: 'purchase' | 'upgrade';
  amount: number;
  status: string;
  created_at: string;
  receipt_number: string | null;
  refund_amount: number | null;
}

interface OrderDetail {
  id: string;
  code: string;
  school_name: string;
  buyer_name: string;
  plan_name: string;
  period_month: string | null;
  turns: number;
  amount: number;
  status: string;
  transfer_content: string;
  pending_expires_at: string;
  created_at: string;
  cancel_reason: string | null;
  receipt: {
    number: string;
    seller: string;
    payer_name: string;
    school_name: string;
    description: string;
    amount: number;
    provider: string;
    provider_reference: string;
    issued_at: string;
  } | null;
  refund: { amount: number; reason: string; created_at: string; operator_name: string | null } | null;
  payments: Array<{
    provider: string;
    provider_reference: string;
    amount: number;
    received_at: string;
    outcome: string;
  }>;
}

const LEVELS: ReadonlyArray<[Level, string]> = [
  ['TH', 'Tiểu học'],
  ['THCS', 'Trung học cơ sở'],
  ['THPT', 'Trung học phổ thông'],
];

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Chờ thanh toán', tone: 'warn' },
  paid: { label: 'Đã thu', tone: 'ok' },
  expired: { label: 'Hết hạn', tone: 'idle' },
  cancelled: { label: 'Đã hủy', tone: 'idle' },
  refunded: { label: 'Đã hoàn tiền', tone: 'idle' },
  needs_refund: { label: 'Chờ hoàn tiền', tone: 'danger' },
};

const OUTCOMES: Record<string, string> = {
  activated: 'Kích hoạt',
  already_settled: 'Giao dịch đã đóng trước đó',
  amount_mismatch: 'Sai số tiền',
  late: 'Đến sau hạn giữ chỗ',
  unmatched: 'Không khớp',
};

const FILTERS: ReadonlyArray<[string, string]> = [
  ['', 'Tất cả'],
  ['pending', 'Chờ thanh toán'],
  ['paid', 'Đã thu'],
  ['needs_refund', 'Chờ hoàn tiền'],
  ['refunded', 'Đã hoàn tiền'],
  ['expired', 'Hết hạn'],
  ['cancelled', 'Đã hủy'],
];

const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

function levelText(levels: Level[]): string {
  return levels.length === LEVELS.length
    ? 'Mọi cấp'
    : LEVELS.filter(([code]) => levels.includes(code))
        .map(([, label]) => label)
        .join(', ');
}

function StatusPill({ status }: { status: string }) {
  const item = STATUS[status] ?? { label: status, tone: 'idle' };
  return (
    <span className="status" data-tone={item.tone}>
      {item.label}
    </span>
  );
}

async function tutorCall<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/platform-ai-tutor/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; details?: Array<{ message: string }> };
  };
  if (!response.ok) {
    throw new PlatformApiError(
      response.status,
      [payload.error?.message, ...(payload.error?.details ?? []).map((detail) => detail.message)]
        .filter(Boolean)
        .join('. ') || 'Không thực hiện được',
    );
  }
  return payload as T;
}

const EMPTY_FORM = {
  kind: 'monthly' as Plan['kind'],
  name: '',
  price: '',
  turns: '',
  allow_images: false,
  school_levels: ['TH', 'THCS', 'THPT'] as Level[],
};

function PlanDialog({
  token,
  plan,
  onSaved,
  onClose,
}: {
  token: string;
  plan: Plan | null;
  onSaved: (text: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    plan
      ? {
          kind: plan.kind,
          name: plan.name,
          price: String(plan.price),
          turns: String(plan.turns),
          allow_images: plan.allow_images,
          school_levels: plan.school_levels,
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      setError(null);
      const body = {
        kind: form.kind,
        name: form.name,
        price: Number(form.price),
        turns: Number(form.turns),
        allow_images: form.kind === 'monthly' && form.allow_images,
        school_levels: form.school_levels,
      };
      try {
        await (plan ? tutorCall(token, 'PUT', `plans/${plan.id}`, body) : tutorCall(token, 'POST', 'plans', body));
        onSaved(plan ? `Đã lưu gói ${form.name}.` : `Đã tạo gói ${form.name}.`);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    });
  };
  return (
    <Dialog title={plan ? `Sửa gói ${plan.name}` : 'Tạo gói nền tảng'} onClose={onClose}>
      <form onSubmit={submit} aria-label={plan ? 'Sửa gói' : 'Tạo gói'}>
        <div className="dialog-body">
          <label className="field">
            Loại gói
            <select
              value={form.kind}
              disabled={plan !== null}
              onChange={(event) => setForm({ ...form, kind: event.target.value as Plan['kind'] })}
            >
              <option value="monthly">Gói tháng (số lượt mỗi tháng)</option>
              <option value="top_up">Gói lượt mua thêm (giữ 12 tháng)</option>
            </select>
          </label>
          <label className="field">
            Tên gói
            <input
              value={form.name}
              maxLength={80}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="field">
            Giá (đồng)
            <input
              inputMode="numeric"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </label>
          <label className="field">
            Số lượt hỏi
            <input
              inputMode="numeric"
              value={form.turns}
              onChange={(event) => setForm({ ...form, turns: event.target.value })}
            />
          </label>
          {form.kind === 'monthly' ? (
            <label>
              <input
                type="checkbox"
                checked={form.allow_images}
                onChange={(event) => setForm({ ...form, allow_images: event.target.checked })}
              />{' '}
              Cho gửi ảnh bài tập
            </label>
          ) : null}
          <fieldset>
            <legend>Cấp học áp dụng</legend>
            {LEVELS.map(([code, label]) => (
              <label key={code}>
                <input
                  type="checkbox"
                  checked={form.school_levels.includes(code)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      school_levels: event.target.checked
                        ? [...form.school_levels, code]
                        : form.school_levels.filter((level) => level !== code),
                    })
                  }
                />{' '}
                {label}
              </label>
            ))}
          </fieldset>
          {plan ? (
            <p className="muted">Lần mua đã có giữ giá và số lượt lúc mua; thay đổi áp dụng cho lần mua sau.</p>
          ) : null}
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="dialog-foot">
          <button type="button" className="button-secondary" onClick={onClose}>
            Quay lại
          </button>
          <button type="submit" className="button-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang lưu…' : 'Lưu gói'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function OrderDialog({
  token,
  orderId,
  onChanged,
  onClose,
}: {
  token: string;
  orderId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: '', reason: '' });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, run] = useBusy();
  const load = useCallback(() => {
    tutorCall<OrderDetail>(token, 'GET', `orders/${orderId}`)
      .then((next) => {
        setDetail(next);
        setForm({ amount: String(next.amount), reason: '' });
      })
      .catch((caught: unknown) => setLoadError(`Không đọc được giao dịch: ${errorMessage(caught)}`));
  }, [token, orderId]);
  useEffect(load, [load]);

  const act = (action: 'refund' | 'cancel') => (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      setOutcome(null);
      try {
        const next = await tutorCall<OrderDetail>(
          token,
          'POST',
          `orders/${orderId}/${action}`,
          action === 'refund' ? { amount: Number(form.amount), reason: form.reason } : { reason: form.reason },
        );
        setDetail(next);
        setOutcome({ tone: 'ok', text: action === 'refund' ? 'Đã ghi hoàn tiền.' : 'Đã hủy giao dịch.' });
        onChanged();
      } catch (caught) {
        setOutcome({ tone: 'danger', text: `Không thực hiện được: ${errorMessage(caught)}` });
      }
    });
  };

  const canRefund = detail?.status === 'paid' || detail?.status === 'needs_refund';
  return (
    <Dialog title={detail ? `Giao dịch ${detail.code}` : 'Giao dịch'} onClose={onClose} wide>
      <div className="dialog-body">
        <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
        {loadError ? (
          <p className="field-error" role="alert">
            {loadError}
          </p>
        ) : null}
        {!detail && !loadError ? <Skeleton lines={4} /> : null}
        {detail ? (
          <>
            <dl className="details">
              <dt>Trạng thái</dt>
              <dd>
                <StatusPill status={detail.status} />
              </dd>
              <dt>Trường</dt>
              <dd>{detail.school_name}</dd>
              <dt>Người mua</dt>
              <dd>{detail.buyer_name}</dd>
              <dt>Gói</dt>
              <dd>
                {detail.plan_name}, {detail.turns.toLocaleString('vi-VN')} lượt
                {detail.period_month
                  ? `, tháng ${detail.period_month.slice(5, 7)}/${detail.period_month.slice(0, 4)}`
                  : ''}
              </dd>
              <dt>Số tiền</dt>
              <dd>{money(detail.amount)}</dd>
              <dt>Nội dung chuyển khoản</dt>
              <dd>{detail.transfer_content}</dd>
              <dt>Tạo lúc</dt>
              <dd>{dateTime(detail.created_at)}</dd>
              {detail.cancel_reason ? (
                <>
                  <dt>Lý do đóng</dt>
                  <dd>{detail.cancel_reason}</dd>
                </>
              ) : null}
            </dl>
            {detail.receipt ? (
              <section aria-label="Biên lai" className="card">
                <h3>Biên lai {detail.receipt.number}</h3>
                <dl className="details">
                  <dt>Bên bán</dt>
                  <dd>{detail.receipt.seller}</dd>
                  <dt>Người trả</dt>
                  <dd>{detail.receipt.payer_name}</dd>
                  <dt>Trường của con</dt>
                  <dd>{detail.receipt.school_name}</dd>
                  <dt>Nội dung</dt>
                  <dd>{detail.receipt.description}</dd>
                  <dt>Số tiền</dt>
                  <dd>{money(detail.receipt.amount)}</dd>
                  <dt>Cổng, mã giao dịch của cổng</dt>
                  <dd>
                    {detail.receipt.provider}, {detail.receipt.provider_reference}
                  </dd>
                  <dt>Ngày lập</dt>
                  <dd>{dateTime(detail.receipt.issued_at)}</dd>
                </dl>
              </section>
            ) : null}
            {detail.payments.length > 0 ? (
              <table aria-label="Tiền vào của giao dịch">
                <thead>
                  <tr>
                    <th scope="col">Cổng</th>
                    <th scope="col">Mã của cổng</th>
                    <th scope="col" className="number">
                      Số tiền
                    </th>
                    <th scope="col">Lúc</th>
                    <th scope="col">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.map((payment) => (
                    <tr key={`${payment.provider}-${payment.provider_reference}`}>
                      <td>{payment.provider}</td>
                      <td>{payment.provider_reference}</td>
                      <td className="number">{money(payment.amount)}</td>
                      <td>{dateTime(payment.received_at)}</td>
                      <td>{OUTCOMES[payment.outcome] ?? payment.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {detail.refund ? (
              <p>
                Đã hoàn {money(detail.refund.amount)} lúc {dateTime(detail.refund.created_at)}, người thao tác{' '}
                {detail.refund.operator_name}. Lý do: {detail.refund.reason}
              </p>
            ) : null}
            {canRefund ? (
              <form aria-label="Hoàn tiền" onSubmit={act('refund')}>
                <p className="muted">
                  Ghi hoàn tiền sau khi đã chuyển trả cho phụ huynh ngoài hệ thống. Gói của con thôi dùng ngay.
                </p>
                <label className="field">
                  Số hoàn (đồng)
                  <input
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  />
                </label>
                <label className="field">
                  Lý do hoàn tiền
                  <textarea
                    rows={2}
                    value={form.reason}
                    onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  />
                </label>
                <button type="submit" className="button-danger" disabled={busy}>
                  Ghi hoàn tiền
                </button>
              </form>
            ) : null}
            {detail.status === 'pending' ? (
              <form aria-label="Hủy giao dịch" onSubmit={act('cancel')}>
                <label className="field">
                  Lý do hủy
                  <textarea
                    rows={2}
                    value={form.reason}
                    onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  />
                </label>
                <button type="submit" className="button-danger" disabled={busy}>
                  Hủy giao dịch
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

export function AiTutorSalesPage({ token }: { token: string }) {
  const [tab, setTab] = useState<'goi' | 'giao-dich'>('goi');
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, run] = useBusy();

  const loadPlans = useCallback(() => {
    setLoadError(null);
    tutorCall<Plan[]>(token, 'GET', 'plans')
      .then(setPlans)
      .catch((caught: unknown) => setLoadError(`Không đọc được gói: ${errorMessage(caught)}`));
  }, [token]);
  const loadOrders = useCallback(() => {
    tutorCall<OrderRow[]>(token, 'GET', `orders${filter ? `?status=${filter}` : ''}`)
      .then(setOrders)
      .catch((caught: unknown) => setLoadError(`Không đọc được giao dịch: ${errorMessage(caught)}`));
  }, [token, filter]);
  useEffect(loadPlans, [loadPlans]);
  // Mỗi lần mở thẻ Giao dịch (hoặc đổi bộ lọc) đọc lại để thấy giao dịch mới
  useEffect(() => {
    if (tab === 'giao-dich') {
      loadOrders();
    }
  }, [tab, loadOrders]);

  const setStatus = (plan: Plan, status: Plan['status']) =>
    void run(async () => {
      try {
        await tutorCall(token, 'POST', `plans/${plan.id}/status`, { status });
        setOutcome({
          tone: 'ok',
          text: status === 'archived' ? `Đã ngừng bán ${plan.name}.` : `Đã mở bán lại ${plan.name}.`,
        });
        loadPlans();
      } catch (caught) {
        setOutcome({ tone: 'danger', text: `Không thực hiện được: ${errorMessage(caught)}` });
      }
    });

  return (
    <section aria-label="Gia sư AI bán trực tiếp">
      <div className="page-head">
        <div>
          <h1>Gia sư AI bán trực tiếp</h1>
          <p className="lead">
            Gói nền tảng bán thẳng cho phụ huynh qua cổng thanh toán của nền tảng, giao dịch, biên lai và hoàn tiền.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="button-primary button-large" onClick={() => setEditing('new')}>
            Tạo gói
          </button>
        </div>
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={loadPlans} /> : null}
      <TabList
        label="Phần của gia sư AI"
        tabs={[
          { key: 'goi' as const, label: 'Gói nền tảng' },
          { key: 'giao-dich' as const, label: 'Giao dịch' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'goi' ? (
        <TabPanel tab="goi">
          <section className="card" aria-labelledby="goi-tieu-de">
            <h2 id="goi-tieu-de">Gói nền tảng</h2>
            {!plans ? <Skeleton lines={3} /> : null}
            {plans && plans.length === 0 ? <EmptyState title="Chưa có gói nào" /> : null}
            {plans && plans.length > 0 ? (
              <div className="table-scroll">
                <table aria-label="Gói nền tảng" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th scope="col">Gói nền tảng</th>
                      <th scope="col" className="number">
                        Giá
                      </th>
                      <th scope="col" className="number">
                        Lượt
                      </th>
                      <th scope="col">Cấp</th>
                      <th scope="col" className="number">
                        Đã thu
                      </th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id}>
                        <td>
                          <div>{plan.name}</div>
                          <div className="muted">
                            {plan.kind === 'monthly' ? 'Gói tháng' : 'Gói lượt, giữ 12 tháng'}
                            {plan.allow_images ? ', gửi được ảnh' : ''}
                          </div>
                        </td>
                        <td className="number">{money(plan.price)}</td>
                        <td className="number">{plan.turns.toLocaleString('vi-VN')}</td>
                        <td>{levelText(plan.school_levels)}</td>
                        <td className="number">{plan.paid_orders.toLocaleString('vi-VN')}</td>
                        <td>
                          <span className="status" data-tone={plan.status === 'active' ? 'ok' : 'idle'}>
                            {plan.status === 'active' ? 'Đang bán' : 'Ngừng bán'}
                          </span>
                        </td>
                        <td className="nowrap">
                          <button type="button" className="button-link" onClick={() => setEditing(plan)}>
                            Sửa {plan.name}
                          </button>{' '}
                          <button
                            type="button"
                            className="button-link"
                            onClick={() => setStatus(plan, plan.status === 'active' ? 'archived' : 'active')}
                          >
                            {plan.status === 'active' ? `Ngừng bán ${plan.name}` : `Mở bán lại ${plan.name}`}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </TabPanel>
      ) : null}
      {tab === 'giao-dich' ? (
        <TabPanel tab="giao-dich">
          <section className="card" aria-labelledby="giao-dich-tieu-de">
            <div className="card-head">
              <h2 id="giao-dich-tieu-de">Giao dịch</h2>
              <div className="pills" role="group" aria-label="Lọc giao dịch">
                {FILTERS.map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {!orders ? <Skeleton lines={3} /> : null}
            {orders && orders.length === 0 ? <EmptyState title="Không có giao dịch nào khớp bộ lọc" /> : null}
            {orders && orders.length > 0 ? (
              <div className="table-scroll">
                <table aria-label="Danh sách giao dịch" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th scope="col">Giao dịch</th>
                      <th scope="col">Trường</th>
                      <th scope="col">Gói</th>
                      <th scope="col" className="number">
                        Số tiền
                      </th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Biên lai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <button
                            type="button"
                            className="button-link"
                            aria-label={`Xem giao dịch ${order.code}`}
                            onClick={() => setSelected(order.id)}
                          >
                            {order.code}
                          </button>
                          <div className="muted">{dateTime(order.created_at)}</div>
                        </td>
                        <td>{order.school_name}</td>
                        <td>
                          {order.kind === 'upgrade' ? 'Nâng lên ' : ''}
                          {order.plan_name}
                        </td>
                        <td className="number">{money(order.amount)}</td>
                        <td>
                          <StatusPill status={order.status} />
                          {order.refund_amount !== null ? (
                            <div className="muted">Hoàn {money(order.refund_amount)}</div>
                          ) : null}
                        </td>
                        <td>{order.receipt_number ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </TabPanel>
      ) : null}
      {editing ? (
        <PlanDialog
          token={token}
          plan={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setOutcome({ tone: 'ok', text });
            loadPlans();
          }}
        />
      ) : null}
      {selected ? (
        <OrderDialog
          token={token}
          orderId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            loadOrders();
            loadPlans();
          }}
        />
      ) : null}
    </section>
  );
}
