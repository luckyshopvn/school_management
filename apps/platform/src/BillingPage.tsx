import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { call } from './PlansPage.js';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import {
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

// Trang "Thu phí" của cổng vận hành nền tảng (DT-SaaS phần S5b, YCTD-196): công nợ theo trường, hóa đơn và chi tiết, lập hóa đơn tay,
// điều chỉnh tay có lý do (giảm giá, ghi nhận tiền tay, hủy, tặng kỳ, gán giao dịch chưa khớp), hóa đơn điện tử, quy tắc tính phí, cấu
// hình thu phí và khóa cổng thanh toán của nền tảng (chỉ hiện gợi ý bốn ký tự cuối). Giao diện YCTD-370: bốn ô tổng hợp, năm thẻ chọn;
// chi tiết và điều chỉnh hóa đơn, tặng kỳ, gán giao dịch, lập hóa đơn trong hộp thoại (bỏ hộp nhập của trình duyệt); hủy hóa đơn phải tích ô đồng
// ý; chỉ vai trò có billing.connectors nhập khóa cổng thanh toán
interface Receivable {
  school_id: string;
  school_code: string;
  school_name: string;
  status: string;
  paid_until: string | null;
  outstanding: number;
  open_invoices: number;
  overdue_invoices: number;
  earliest_due: string | null;
}

interface InvoiceRow {
  id: string;
  code: string;
  school_code: string;
  school_name: string;
  period_start: string;
  period_end: string;
  total: number;
  amount_paid: number;
  outstanding: number;
  status: 'issued' | 'paid' | 'void';
  overdue: boolean;
  due_on: string;
  payment_content: string;
}

interface InvoiceDetail extends InvoiceRow {
  subtotal: number;
  discount_total: number;
  vat_percent: number;
  vat_amount: number;
  lines: Array<{ sort: number; description: string; quantity: number; unit_price: number; amount: number }>;
  payments: Array<{ id: string; provider: string; provider_reference: string; amount: number; received_at: string }>;
  einvoices: Array<{
    provider: string;
    status: string;
    external_id: string | null;
    lookup_code: string | null;
    error: string | null;
  }>;
}

interface Connector {
  connector: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  hints: Record<string, string>;
  fields: Array<{ name: string; label: string; secret: boolean; required: boolean }>;
}

interface Overview {
  settings: {
    invoice_prefix: string;
    receiving_account: { bank_bin: string | null; account_number: string | null; account_name: string | null };
    einvoice_provider: string;
    auto_issue_einvoice: boolean;
    remind_days_before: number[];
    remind_days_after: number[];
    channels: string[];
  };
  einvoice_providers: string[];
  connectors: Connector[];
  receivables: Receivable[];
  unmatched_payments: Array<{
    id: string;
    provider: string;
    provider_reference: string;
    amount: number;
    transfer_content: string;
  }>;
  modules: Array<{ key: string; label: string }>;
}

interface PriceRuleRow {
  id: string;
  code: string;
  name: string;
  components: string[];
  student_tiers: Array<{ up_to: number | null; unit_price: number }>;
  tier_mode: 'graduated' | 'volume';
  school_fee: number;
  module_prices: Record<string, number>;
  minimum_fee: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  vat_percent: number;
  due_days: number;
  status: 'active' | 'archived';
  plans: string[];
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const STATUS: Record<string, string> = { issued: 'Chưa trả', paid: 'Đã trả', void: 'Đã hủy' };
const COMPONENTS: Record<string, string> = {
  per_student: 'Theo số học sinh đang học',
  per_school: 'Theo trường',
  per_module: 'Theo phân hệ',
};
const PERIODS: Record<string, string> = { monthly: 'Tháng', quarterly: 'Quý', yearly: 'Năm' };
const listOfDays = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number);

// Bậc thang nhập dạng "100:10000, 300:8000, :5000" (để trống số học sinh tối đa ở bậc cuối)
function parseTiers(text: string) {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [upTo, price] = item.split(':').map((part) => part.trim());
      return { up_to: upTo ? Number(upTo) : null, unit_price: Number(price) };
    });
}
const tiersText = (tiers: PriceRuleRow['student_tiers']) =>
  tiers.map((tier) => `${tier.up_to ?? ''}:${tier.unit_price}`).join(', ');

const emptyRule = {
  id: null as string | null,
  code: '',
  name: '',
  components: ['per_student'] as string[],
  tiers: ':0',
  tier_mode: 'graduated' as 'graduated' | 'volume',
  school_fee: '0',
  module_prices: {} as Record<string, string>,
  minimum_fee: '0',
  period: 'monthly' as PriceRuleRow['period'],
  vat_percent: '0',
  due_days: '15',
};

const TABS_BASE = ['hoa-don', 'cong-no', 'chua-khop', 'quy-tac', 'cau-hinh'] as const;
type BillingTab = (typeof TABS_BASE)[number];

const FILTERS: Array<[string, string]> = [
  ['', 'Tất cả'],
  ['issued', 'Chưa trả'],
  ['overdue', 'Quá hạn'],
  ['paid', 'Đã trả'],
  ['void', 'Đã hủy'],
];

// Việc điều chỉnh trên một hóa đơn: điểm cuối cũ, ô cần nhập; lý do luôn bắt buộc
const ACTIONS: Record<string, { label: string; done: string; amount: boolean; reference: boolean }> = {
  'manual-payment': { label: 'Ghi nhận tiền tay', done: 'Đã ghi nhận tiền', amount: true, reference: true },
  discount: { label: 'Giảm giá', done: 'Đã giảm giá', amount: true, reference: false },
  einvoice: {
    label: 'Phát hành hóa đơn điện tử',
    done: 'Đã phát hành hóa đơn điện tử',
    amount: false,
    reference: false,
  },
  'einvoice-cancel': { label: 'Hủy hóa đơn điện tử', done: 'Đã hủy hóa đơn điện tử', amount: false, reference: false },
  void: { label: 'Hủy hóa đơn', done: 'Đã hủy', amount: false, reference: false },
};

// Diễn giải bậc thang để người nhập kiểm lại ngay
function readTiers(text: string): string {
  const tiers = parseTiers(text);
  if (!tiers.length || tiers.some((tier) => Number.isNaN(tier.unit_price) || Number.isNaN(tier.up_to ?? 0))) {
    return 'chưa đọc được, nhập dạng số tối đa:đơn giá, cách nhau dấu phẩy';
  }
  return tiers
    .map((tier) => `${tier.up_to === null ? 'phần còn lại' : `đến ${tier.up_to} học sinh`}: ${money(tier.unit_price)}`)
    .join('; ');
}

function shortDay(value: string | null): string {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN') : '—';
}

function invoiceStatus(invoice: InvoiceRow) {
  if (invoice.status === 'issued' && invoice.overdue) {
    return (
      <span className="status" data-tone="danger">
        Quá hạn
      </span>
    );
  }
  const tone = invoice.status === 'paid' ? 'ok' : invoice.status === 'void' ? 'idle' : 'warn';
  return (
    <span className="status" data-tone={tone}>
      {STATUS[invoice.status]}
    </span>
  );
}

function InvoiceDialog({
  accessToken,
  invoiceId,
  onChanged,
  onClose,
}: {
  accessToken: string;
  invoiceId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState('manual-payment');
  const [action, setAction] = useState({ amount: '', reference: '', reason: '' });
  const [agreed, setAgreed] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reasonMissing, setReasonMissing] = useState(false);
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    call<InvoiceDetail>(accessToken, 'GET', `billing/invoices/${invoiceId}`)
      .then(setDetail)
      .catch((caught: unknown) => setLoadError(`Không đọc được hóa đơn: ${errorMessage(caught)}`));
  }, [accessToken, invoiceId]);
  useEffect(load, [load]);

  const chosen = ACTIONS[kind] ?? ACTIONS['manual-payment']!;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!action.reason.trim()) {
      setReasonMissing(true);
      return;
    }
    setReasonMissing(false);
    const current = detail;
    if (!current) {
      return;
    }
    void run(async () => {
      setOutcome(null);
      try {
        await call(accessToken, 'POST', `billing/invoices/${current.id}/${kind}`, {
          ...(chosen.amount && action.amount ? { amount: Number(action.amount) } : {}),
          reference: chosen.reference ? action.reference : '',
          reason: action.reason,
        });
        setOutcome({ tone: 'ok', text: `${chosen.done}: ${current.code}.` });
        setAction({ amount: '', reference: '', reason: '' });
        setAgreed(false);
        load();
        onChanged();
      } catch (caught) {
        setOutcome({ tone: 'danger', text: `Không thực hiện được: ${errorMessage(caught)}` });
      }
    });
  };

  return (
    <Dialog title={detail ? `Hóa đơn ${detail.code} – ${detail.school_name}` : 'Hóa đơn'} onClose={onClose} wide>
      <div className="dialog-body">
        {loadError ? (
          <p className="field-error" role="alert">
            {loadError}
          </p>
        ) : null}
        {!detail && !loadError ? <Skeleton lines={4} /> : null}
        {detail ? (
          <>
            <dl className="details">
              <dt>Kỳ</dt>
              <dd>
                {shortDay(detail.period_start)} – {shortDay(detail.period_end)}
              </dd>
              <dt>Hạn trả</dt>
              <dd>{shortDay(detail.due_on)}</dd>
              <dt>Trạng thái</dt>
              <dd>{invoiceStatus(detail)}</dd>
              <dt>Nội dung chuyển khoản</dt>
              <dd>
                <code>{detail.payment_content}</code>
              </dd>
            </dl>
            <div className="table-scroll">
              <table aria-label="Dòng hóa đơn">
                <thead>
                  <tr>
                    <th scope="col">Nội dung</th>
                    <th scope="col" className="number">
                      Số lượng
                    </th>
                    <th scope="col" className="number">
                      Đơn giá
                    </th>
                    <th scope="col" className="number">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr key={line.sort}>
                      <td>{line.description}</td>
                      <td className="number">{line.quantity.toLocaleString('vi-VN')}</td>
                      <td className="number">{money(line.unit_price)}</td>
                      <td className="number">{money(line.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3}>VAT {detail.vat_percent}%</td>
                    <td className="number">{money(detail.vat_amount)}</td>
                  </tr>
                  <tr>
                    <th scope="row" colSpan={3}>
                      Tổng cộng (đã trả {money(detail.amount_paid)})
                    </th>
                    <td className="number">
                      <strong>{money(detail.total)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid-2">
              <div>
                <strong>Tiền đã nhận</strong>
                {detail.payments.length ? (
                  <ul aria-label="Tiền đã nhận" style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                    {detail.payments.map((payment) => (
                      <li key={payment.id}>
                        {payment.provider} {payment.provider_reference}: {money(payment.amount)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Chưa nhận tiền.
                  </p>
                )}
              </div>
              <div>
                <strong>Hóa đơn điện tử</strong>
                {detail.einvoices.length ? (
                  <ul aria-label="Hóa đơn điện tử" style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                    {detail.einvoices.map((document, index) => (
                      <li key={index}>
                        {document.provider}: {document.status} {document.lookup_code ?? ''} {document.error ?? ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Chưa phát hành.
                  </p>
                )}
              </div>
            </div>
            <form className="stack form-group" aria-label={`Điều chỉnh hóa đơn ${detail.code}`} onSubmit={submit}>
              <OutcomeBanner outcome={outcome} />
              <div className="grid-2">
                <label className="field">
                  Việc cần làm
                  <select
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value);
                      setAgreed(false);
                    }}
                  >
                    {Object.entries(ACTIONS).map(([value, item]) => (
                      <option key={value} value={value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {chosen.amount ? (
                  <label className="field">
                    Số tiền (đồng)
                    <input
                      inputMode="numeric"
                      value={action.amount}
                      onChange={(event) => setAction({ ...action, amount: event.target.value })}
                    />
                  </label>
                ) : null}
                {chosen.reference ? (
                  <label className="field">
                    Mã giao dịch
                    <input
                      value={action.reference}
                      onChange={(event) => setAction({ ...action, reference: event.target.value })}
                    />
                  </label>
                ) : null}
              </div>
              <label className="field">
                Lý do
                <input
                  value={action.reason}
                  onChange={(event) => setAction({ ...action, reason: event.target.value })}
                  aria-invalid={reasonMissing ? true : undefined}
                />
                {reasonMissing ? <span className="field-error">Nhập lý do điều chỉnh.</span> : null}
              </label>
              {kind === 'void' ? (
                <label className="check">
                  <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                  Tôi đã đọc và đồng ý hủy hóa đơn này; hóa đơn đã hủy không dùng lại được.
                </label>
              ) : null}
              <div className="button-row">
                <button
                  type="submit"
                  className={kind === 'void' ? 'button-danger' : 'button-primary'}
                  disabled={busy || (kind === 'void' && !agreed)}
                  aria-busy={busy}
                >
                  {busy ? 'Đang xử lý…' : chosen.label}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
      <div className="dialog-foot">
        <button type="button" className="button-secondary" onClick={onClose}>
          Đóng
        </button>
      </div>
    </Dialog>
  );
}

function FreePeriodDialog({
  accessToken,
  school,
  onDone,
  onClose,
}: {
  accessToken: string;
  school: Receivable;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const [months, setMonths] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  return (
    <Dialog title={`Tặng kỳ cho ${school.school_name}`} onClose={onClose}>
      <form
        aria-label="Tặng kỳ"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            setError(null);
            try {
              const result = await call<{ paidUntil: string }>(
                accessToken,
                'POST',
                `billing/schools/${school.school_id}/free-period`,
                { months: Number(months), reason },
              );
              onDone(`Đã tặng kỳ cho ${school.school_code}, hạn mới ${shortDay(result.paidUntil)}.`);
            } catch (caught) {
              setError(`Không tặng được: ${errorMessage(caught)}`);
            }
          });
        }}
      >
        <div className="dialog-body">
          <p className="muted" style={{ margin: 0 }}>
            Hạn đã trả phí hiện tại: {shortDay(school.paid_until)}.
          </p>
          <label className="field">
            Số tháng tặng
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={months}
              onChange={(event) => setMonths(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Lý do
            <input value={reason} onChange={(event) => setReason(event.target.value)} required />
          </label>
          {error ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
        </div>
        <div className="dialog-foot">
          <button type="button" className="button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang tặng…' : 'Tặng kỳ'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AssignDialog({
  accessToken,
  payment,
  onDone,
  onClose,
}: {
  accessToken: string;
  payment: Overview['unmatched_payments'][number];
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<InvoiceRow[] | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => {
    call<InvoiceRow[]>(accessToken, 'GET', 'billing/invoices?status=issued')
      .then(setOpen)
      .catch((caught: unknown) => setError(`Không đọc được hóa đơn chưa trả: ${errorMessage(caught)}`));
  }, [accessToken]);
  return (
    <Dialog title={`Gán giao dịch ${payment.provider_reference} vào hóa đơn`} onClose={onClose}>
      <form
        aria-label="Gán giao dịch vào hóa đơn"
        onSubmit={(event) => {
          event.preventDefault();
          const invoice = open?.find((item) => item.id === invoiceId);
          if (!invoice) {
            return;
          }
          void run(async () => {
            setError(null);
            try {
              await call(accessToken, 'POST', `billing/payments/${payment.id}/assign`, {
                invoice_id: invoice.id,
                reason,
              });
              onDone(`Đã gán vào ${invoice.code}.`);
            } catch (caught) {
              setError(`Không gán được: ${errorMessage(caught)}`);
            }
          });
        }}
      >
        <div className="dialog-body">
          <dl className="details">
            <dt>Số tiền</dt>
            <dd>{money(payment.amount)}</dd>
            <dt>Nội dung chuyển khoản</dt>
            <dd>{payment.transfer_content}</dd>
          </dl>
          {open === null && !error ? <Skeleton lines={2} /> : null}
          {open ? (
            <label className="field">
              Hóa đơn chưa trả
              <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} required>
                <option value="">Chọn hóa đơn</option>
                {open.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.code} – {invoice.school_code} – còn nợ {money(invoice.outstanding)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            Lý do
            <input value={reason} onChange={(event) => setReason(event.target.value)} required />
          </label>
          {error ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
        </div>
        <div className="dialog-foot">
          <button type="button" className="button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button-primary" disabled={busy || !open} aria-busy={busy}>
            {busy ? 'Đang gán…' : 'Gán vào hóa đơn'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ManualInvoiceDialog({
  accessToken,
  schools,
  onDone,
  onClose,
}: {
  accessToken: string;
  schools: Receivable[];
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const [manual, setManual] = useState({ school_id: '', active_students: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  return (
    <Dialog title="Lập hóa đơn tay (kỳ đang chạy)" onClose={onClose}>
      <form
        aria-label="Lập hóa đơn tay"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            setError(null);
            try {
              const created = await call<{ code: string }>(accessToken, 'POST', 'billing/invoices', {
                school_id: manual.school_id,
                ...(manual.active_students ? { active_students: Number(manual.active_students) } : {}),
                note: manual.note,
              });
              onDone(`Đã lập hóa đơn ${created.code}.`);
            } catch (caught) {
              setError(`Không lập được hóa đơn: ${errorMessage(caught)}`);
            }
          });
        }}
      >
        <div className="dialog-body">
          <label className="field">
            Trường
            <select
              value={manual.school_id}
              onChange={(event) => setManual({ ...manual, school_id: event.target.value })}
              required
            >
              <option value="">Chọn trường</option>
              {schools.map((row) => (
                <option key={row.school_id} value={row.school_id}>
                  {row.school_code} – {row.school_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Số học sinh đang học <span className="hint">trống là số chốt gần nhất</span>
            </span>
            <input
              inputMode="numeric"
              value={manual.active_students}
              onChange={(event) => setManual({ ...manual, active_students: event.target.value })}
            />
          </label>
          <label className="field">
            Ghi chú
            <input value={manual.note} onChange={(event) => setManual({ ...manual, note: event.target.value })} />
          </label>
          {error ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
        </div>
        <div className="dialog-foot">
          <button type="button" className="button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang lập…' : 'Lập hóa đơn'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function BillingPage({ accessToken, role }: { accessToken: string; role: OperatorRole }) {
  const canConnect = operatorCan(role, 'billing.connectors');
  const [tab, setTab] = useState<BillingTab>('hoa-don');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [rules, setRules] = useState<PriceRuleRow[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [editingRule, setEditingRule] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, Record<string, string>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [freePeriod, setFreePeriod] = useState<Receivable | null>(null);
  const [assigning, setAssigning] = useState<Overview['unmatched_payments'][number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, runBusy] = useBusy();

  const reload = useCallback(async () => {
    const [nextOverview, nextInvoices, nextRules] = await Promise.all([
      call<Overview>(accessToken, 'GET', 'billing'),
      call<InvoiceRow[]>(accessToken, 'GET', `billing/invoices${filter ? `?status=${filter}` : ''}`),
      call<PriceRuleRow[]>(accessToken, 'GET', 'billing/price-rules'),
    ]);
    setOverview(nextOverview);
    setInvoices(nextInvoices);
    setRules(nextRules);
    const current = nextOverview.settings;
    setSettings({
      invoice_prefix: current.invoice_prefix,
      bank_bin: current.receiving_account.bank_bin ?? '',
      account_number: current.receiving_account.account_number ?? '',
      account_name: current.receiving_account.account_name ?? '',
      einvoice_provider: current.einvoice_provider,
      remind_days_before: current.remind_days_before.join(', '),
      remind_days_after: current.remind_days_after.join(', '),
    });
  }, [accessToken, filter]);

  const load = useCallback(() => {
    setLoadError(null);
    reload().catch((caught: unknown) =>
      setLoadError(
        `Không đọc được dữ liệu thu phí: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`,
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
        setOutcome({ tone: 'danger', text: `Không thực hiện được: ${errorMessage(caught)}` });
      }
    });

  const finish = (text: string) => {
    setOutcome({ tone: 'ok', text });
    load();
  };

  const saveRule = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const body = {
        code: ruleForm.code,
        name: ruleForm.name,
        components: ruleForm.components,
        student_tiers: parseTiers(ruleForm.tiers),
        tier_mode: ruleForm.tier_mode,
        school_fee: Number(ruleForm.school_fee),
        module_prices: Object.fromEntries(
          Object.entries(ruleForm.module_prices)
            .filter(([, value]) => value.trim() !== '')
            .map(([key, value]) => [key, Number(value)]),
        ),
        minimum_fee: Number(ruleForm.minimum_fee),
        period: ruleForm.period,
        vat_percent: Number(ruleForm.vat_percent),
        due_days: Number(ruleForm.due_days),
      };
      await call(
        accessToken,
        ruleForm.id ? 'PUT' : 'POST',
        ruleForm.id ? `billing/price-rules/${ruleForm.id}` : 'billing/price-rules',
        body,
      );
      setRuleForm(emptyRule);
      setEditingRule(false);
      return `Đã lưu quy tắc ${body.name}.`;
    });
  };

  const editRule = (rule: PriceRuleRow) => {
    setRuleForm({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      components: rule.components,
      tiers: tiersText(rule.student_tiers),
      tier_mode: rule.tier_mode,
      school_fee: String(rule.school_fee),
      module_prices: Object.fromEntries(Object.entries(rule.module_prices).map(([key, value]) => [key, String(value)])),
      minimum_fee: String(rule.minimum_fee),
      period: rule.period,
      vat_percent: String(rule.vat_percent),
      due_days: String(rule.due_days),
    });
    setEditingRule(true);
  };

  const ruleNumber = (name: 'school_fee' | 'minimum_fee' | 'vat_percent' | 'due_days', label: string) => (
    <label className="field">
      {label}
      <input
        inputMode="numeric"
        value={ruleForm[name]}
        onChange={(event) => setRuleForm({ ...ruleForm, [name]: event.target.value })}
      />
    </label>
  );

  const totals = overview
    ? overview.receivables.reduce(
        (sum, row) => ({
          outstanding: sum.outstanding + row.outstanding,
          open: sum.open + row.open_invoices,
          overdue: sum.overdue + row.overdue_invoices,
        }),
        { outstanding: 0, open: 0, overdue: 0 },
      )
    : null;
  const tabs = [
    { key: 'hoa-don' as const, label: 'Hóa đơn' },
    { key: 'cong-no' as const, label: 'Công nợ theo trường' },
    { key: 'chua-khop' as const, label: `Giao dịch chưa khớp (${overview?.unmatched_payments.length ?? 0})` },
    { key: 'quy-tac' as const, label: 'Quy tắc tính phí' },
    { key: 'cau-hinh' as const, label: 'Cấu hình' },
  ];

  return (
    <section aria-label="Thu phí">
      <div className="page-head">
        <div>
          <h1>Thu phí</h1>
          <p className="lead">
            Hóa đơn dịch vụ của các trường, công nợ, giao dịch chưa khớp, quy tắc tính phí và cấu hình thu.
          </p>
        </div>
        {overview ? (
          <div className="page-actions">
            <button type="button" className="button-primary button-large" onClick={() => setCreating(true)}>
              Lập hóa đơn
            </button>
          </div>
        ) : null}
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      {!overview && !loadError ? (
        <section className="card">
          <Skeleton lines={5} label="Đang tải dữ liệu thu phí" />
        </section>
      ) : null}
      {overview && totals ? (
        <>
          <div className="tiles compact" role="list" aria-label="Tổng hợp thu phí">
            <div className="card tile" role="listitem">
              <span className="muted">Còn phải thu</span>
              <strong>{money(totals.outstanding)}</strong>
              <span className="muted">Mọi trường</span>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Hóa đơn chưa trả</span>
              <strong>{totals.open.toLocaleString('vi-VN')}</strong>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Hóa đơn quá hạn</span>
              <strong>{totals.overdue.toLocaleString('vi-VN')}</strong>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Giao dịch chưa khớp</span>
              <strong>{overview.unmatched_payments.length.toLocaleString('vi-VN')}</strong>
            </div>
          </div>
          <TabList label="Phần của thu phí" tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'hoa-don' ? (
            <TabPanel tab="hoa-don">
              <section className="card" aria-labelledby="hoa-don-tieu-de">
                <div className="card-head">
                  <h2 id="hoa-don-tieu-de">Hóa đơn</h2>
                  <div className="pills" role="group" aria-label="Lọc hóa đơn">
                    {FILTERS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {invoices.length === 0 ? (
                  <EmptyState title="Không có hóa đơn nào khớp bộ lọc" />
                ) : (
                  <div className="table-scroll">
                    <table className="sticky-first" aria-label="Danh sách hóa đơn" style={{ minWidth: 860 }}>
                      <thead>
                        <tr>
                          <th scope="col">Mã</th>
                          <th scope="col">Trường</th>
                          <th scope="col">Kỳ</th>
                          <th scope="col" className="number">
                            Tổng
                          </th>
                          <th scope="col" className="number">
                            Còn nợ
                          </th>
                          <th scope="col">Hạn</th>
                          <th scope="col">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td>
                              <button
                                type="button"
                                className="button-link"
                                aria-label={`Xem hóa đơn ${invoice.code}`}
                                onClick={() => setSelected(invoice.id)}
                              >
                                {invoice.code}
                              </button>
                            </td>
                            <td>
                              <div>{invoice.school_name}</div>
                              <div className="muted">{invoice.school_code}</div>
                            </td>
                            <td className="nowrap">
                              {shortDay(invoice.period_start)} – {shortDay(invoice.period_end)}
                            </td>
                            <td className="number">{money(invoice.total)}</td>
                            <td className="number">{money(invoice.outstanding)}</td>
                            <td className="nowrap">{shortDay(invoice.due_on)}</td>
                            <td>{invoiceStatus(invoice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </TabPanel>
          ) : null}

          {tab === 'cong-no' ? (
            <TabPanel tab="cong-no">
              <section className="card" aria-labelledby="cong-no-tieu-de">
                <h2 id="cong-no-tieu-de">Công nợ theo trường</h2>
                {overview.receivables.length === 0 ? (
                  <EmptyState title="Chưa có trường nào" />
                ) : (
                  <div className="table-scroll">
                    <table className="sticky-first" aria-label="Công nợ theo trường" style={{ minWidth: 860 }}>
                      <thead>
                        <tr>
                          <th scope="col">Trường</th>
                          <th scope="col">Trạng thái</th>
                          <th scope="col" className="number">
                            Còn nợ
                          </th>
                          <th scope="col" className="number">
                            Hóa đơn chưa trả
                          </th>
                          <th scope="col" className="number">
                            Quá hạn
                          </th>
                          <th scope="col">Hạn đã trả phí</th>
                          <th scope="col">
                            <span className="visually-hidden">Thao tác</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.receivables.map((row) => (
                          <tr key={row.school_id}>
                            <td>
                              <div>{row.school_name}</div>
                              <div className="muted">{row.school_code}</div>
                            </td>
                            <td>{row.status}</td>
                            <td className="number">{money(row.outstanding)}</td>
                            <td className="number">{row.open_invoices}</td>
                            <td className="number">
                              {row.overdue_invoices ? (
                                <span className="status" data-tone="danger">
                                  {row.overdue_invoices}
                                </span>
                              ) : (
                                0
                              )}
                            </td>
                            <td className="nowrap">{shortDay(row.paid_until)}</td>
                            <td>
                              <button
                                type="button"
                                className="button-link"
                                aria-label={`Tặng kỳ cho ${row.school_code}`}
                                onClick={() => setFreePeriod(row)}
                              >
                                Tặng kỳ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </TabPanel>
          ) : null}

          {tab === 'chua-khop' ? (
            <TabPanel tab="chua-khop">
              <section className="card" aria-labelledby="chua-khop-tieu-de">
                <h2 id="chua-khop-tieu-de">Giao dịch chưa khớp</h2>
                {overview.unmatched_payments.length === 0 ? (
                  <EmptyState title="Không có giao dịch chưa khớp">
                    Tiền chuyển khoản đúng nội dung tự khớp vào hóa đơn.
                  </EmptyState>
                ) : (
                  <div className="table-scroll">
                    <table className="sticky-first" aria-label="Giao dịch chưa khớp" style={{ minWidth: 760 }}>
                      <thead>
                        <tr>
                          <th scope="col">Mã giao dịch</th>
                          <th scope="col">Cổng</th>
                          <th scope="col" className="number">
                            Số tiền
                          </th>
                          <th scope="col">Nội dung chuyển khoản</th>
                          <th scope="col">
                            <span className="visually-hidden">Thao tác</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.unmatched_payments.map((payment) => (
                          <tr key={payment.id}>
                            <td>{payment.provider_reference}</td>
                            <td>{payment.provider}</td>
                            <td className="number">{money(payment.amount)}</td>
                            <td>{payment.transfer_content}</td>
                            <td>
                              <button type="button" className="button-link" onClick={() => setAssigning(payment)}>
                                Gán vào hóa đơn
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </TabPanel>
          ) : null}

          {tab === 'quy-tac' ? (
            <TabPanel tab="quy-tac">
              <div className="stack" style={{ gap: '1.5rem' }}>
                <section className="card" aria-labelledby="quy-tac-tieu-de">
                  <div className="card-head">
                    <h2 id="quy-tac-tieu-de">Quy tắc tính phí</h2>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setRuleForm(emptyRule);
                        setEditingRule(true);
                      }}
                    >
                      Lập quy tắc
                    </button>
                  </div>
                  {rules.length === 0 ? (
                    <EmptyState title="Chưa có quy tắc nào">
                      Gói chưa gắn quy tắc thì tính theo giá niêm yết.
                    </EmptyState>
                  ) : (
                    <div className="table-scroll">
                      <table className="sticky-first" aria-label="Quy tắc tính phí" style={{ minWidth: 760 }}>
                        <thead>
                          <tr>
                            <th scope="col">Quy tắc</th>
                            <th scope="col">Thành phần</th>
                            <th scope="col">Kỳ thu</th>
                            <th scope="col">Gói dùng</th>
                            <th scope="col">
                              <span className="visually-hidden">Thao tác</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map((rule) => (
                            <tr key={rule.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{rule.name}</div>
                                <div className="muted">{rule.code}</div>
                              </td>
                              <td>{rule.components.map((component) => COMPONENTS[component]).join(' + ')}</td>
                              <td>{PERIODS[rule.period]}</td>
                              <td>{rule.plans.join(', ') || '—'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="button-link"
                                  aria-label={`Sửa quy tắc ${rule.name}`}
                                  onClick={() => editRule(rule)}
                                >
                                  Sửa
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                {editingRule ? (
                  <section className="card" aria-labelledby="bieu-mau-quy-tac">
                    <h2 id="bieu-mau-quy-tac">
                      {ruleForm.id ? `Sửa quy tắc: ${ruleForm.name}` : 'Lập quy tắc tính phí'}
                    </h2>
                    <form
                      className="stack"
                      style={{ gap: '1.25rem' }}
                      aria-label={ruleForm.id ? 'Sửa quy tắc tính phí' : 'Lập quy tắc tính phí'}
                      onSubmit={saveRule}
                    >
                      <fieldset className="form-group" style={{ borderTop: 0, paddingTop: 0 }}>
                        <legend>Thông tin quy tắc</legend>
                        <div className="grid-2">
                          <label className="field">
                            Mã quy tắc
                            <input
                              value={ruleForm.code}
                              onChange={(event) => setRuleForm({ ...ruleForm, code: event.target.value })}
                              required
                            />
                          </label>
                          <label className="field">
                            Tên quy tắc
                            <input
                              value={ruleForm.name}
                              onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })}
                              required
                            />
                          </label>
                        </div>
                      </fieldset>
                      <fieldset className="form-group">
                        <legend>Thành phần tính phí</legend>
                        <div className="grid-3" style={{ gap: '0.25rem 1rem' }}>
                          {Object.entries(COMPONENTS).map(([key, label]) => (
                            <label key={key} className="check">
                              <input
                                type="checkbox"
                                checked={ruleForm.components.includes(key)}
                                onChange={(event) =>
                                  setRuleForm({
                                    ...ruleForm,
                                    components: event.target.checked
                                      ? [...ruleForm.components, key]
                                      : ruleForm.components.filter((item) => item !== key),
                                  })
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset className="form-group">
                        <legend>Giá</legend>
                        <div className="stack">
                          <label className="field">
                            <span>
                              Bậc thang theo học sinh{' '}
                              <span className="hint">số tối đa:đơn giá, bậc cuối để trống số tối đa</span>
                            </span>
                            <input
                              value={ruleForm.tiers}
                              onChange={(event) => setRuleForm({ ...ruleForm, tiers: event.target.value })}
                              aria-describedby="doc-bac-thang"
                            />
                            <span className="hint" id="doc-bac-thang">
                              Đọc là: {readTiers(ruleForm.tiers)}
                            </span>
                          </label>
                          <div className="grid-3">
                            <label className="field">
                              Cách tính bậc
                              <select
                                value={ruleForm.tier_mode}
                                onChange={(event) =>
                                  setRuleForm({ ...ruleForm, tier_mode: event.target.value as 'graduated' | 'volume' })
                                }
                              >
                                <option value="graduated">Lũy tiến theo từng bậc</option>
                                <option value="volume">Cả trường theo một bậc</option>
                              </select>
                            </label>
                            {ruleNumber('school_fee', 'Phí theo trường mỗi kỳ (đồng)')}
                            {ruleNumber('minimum_fee', 'Phí tối thiểu mỗi kỳ (đồng)')}
                          </div>
                          {ruleForm.components.includes('per_module') ? (
                            <div className="grid-3" role="group" aria-label="Giá từng phân hệ mỗi kỳ (đồng)">
                              {overview.modules.map((module) => (
                                <label key={module.key} className="field">
                                  {module.label}
                                  <input
                                    inputMode="numeric"
                                    value={ruleForm.module_prices[module.key] ?? ''}
                                    onChange={(event) =>
                                      setRuleForm({
                                        ...ruleForm,
                                        module_prices: { ...ruleForm.module_prices, [module.key]: event.target.value },
                                      })
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </fieldset>
                      <fieldset className="form-group">
                        <legend>Kỳ thu và thuế</legend>
                        <div className="grid-3">
                          <label className="field">
                            Kỳ thu
                            <select
                              value={ruleForm.period}
                              onChange={(event) =>
                                setRuleForm({ ...ruleForm, period: event.target.value as PriceRuleRow['period'] })
                              }
                            >
                              {Object.entries(PERIODS).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {ruleNumber('vat_percent', 'VAT (%)')}
                          {ruleNumber('due_days', 'Số ngày hạn trả sau cuối kỳ')}
                        </div>
                      </fieldset>
                      <div className="button-row">
                        <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
                          {busy ? 'Đang lưu…' : 'Lưu quy tắc'}
                        </button>
                        <button
                          type="button"
                          className="button-secondary button-large"
                          onClick={() => {
                            setRuleForm(emptyRule);
                            setEditingRule(false);
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  </section>
                ) : null}
              </div>
            </TabPanel>
          ) : null}

          {tab === 'cau-hinh' ? (
            <TabPanel tab="cau-hinh">
              <div className="columns">
                <section className="card wide" aria-labelledby="cau-hinh-thu-phi">
                  <h2 id="cau-hinh-thu-phi">Cấu hình thu phí</h2>
                  <form
                    className="stack"
                    aria-label="Cấu hình thu phí"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        await call(accessToken, 'PUT', 'billing/settings', {
                          invoice_prefix: settings.invoice_prefix,
                          receiving_account: {
                            bank_bin: settings.bank_bin || null,
                            account_number: settings.account_number || null,
                            account_name: settings.account_name || null,
                          },
                          einvoice_provider: settings.einvoice_provider,
                          remind_days_before: listOfDays(settings.remind_days_before ?? ''),
                          remind_days_after: listOfDays(settings.remind_days_after ?? ''),
                        });
                        return 'Đã lưu cấu hình thu phí.';
                      });
                    }}
                  >
                    <div className="grid-2">
                      {[
                        ['invoice_prefix', 'Tiền tố mã hóa đơn', ''],
                        ['bank_bin', 'Mã BIN ngân hàng nhận tiền', ''],
                        ['account_number', 'Số tài khoản nhận tiền', ''],
                        ['account_name', 'Tên tài khoản nhận tiền', ''],
                        ['remind_days_before', 'Nhắc trước hạn', 'số ngày, cách nhau dấu phẩy'],
                        ['remind_days_after', 'Nhắc sau hạn', 'số ngày, cách nhau dấu phẩy'],
                      ].map(([key, label, hint]) => (
                        <label key={key} className="field">
                          <span>
                            {label} {hint ? <span className="hint">{hint}</span> : null}
                          </span>
                          <input
                            value={settings[key as string] ?? ''}
                            onChange={(event) => setSettings({ ...settings, [key as string]: event.target.value })}
                          />
                        </label>
                      ))}
                      <label className="field">
                        Bộ nối hóa đơn điện tử
                        <select
                          value={settings.einvoice_provider ?? 'none'}
                          onChange={(event) => setSettings({ ...settings, einvoice_provider: event.target.value })}
                        >
                          {overview.einvoice_providers.map((code) => (
                            <option key={code} value={code}>
                              {code === 'none' ? 'Chưa nối (nhà cung cấp chưa chốt)' : 'Giả lập (phát triển, kiểm thử)'}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="button-row">
                      <button type="submit" className="button-primary button-large" disabled={busy}>
                        Lưu cấu hình
                      </button>
                    </div>
                  </form>
                </section>
                <section className="card narrow" aria-labelledby="cong-thanh-toan">
                  <h2 id="cong-thanh-toan">Cổng thanh toán của nền tảng</h2>
                  {overview.connectors.map((connector) => {
                    const state = connector.configured ? (
                      <span className="status" data-tone={connector.enabled ? 'ok' : 'idle'}>
                        {connector.enabled ? 'Đang bật' : 'Đang tắt'}
                      </span>
                    ) : (
                      <span className="status" data-tone="warn">
                        Chưa cấu hình
                      </span>
                    );
                    return canConnect ? (
                      <form
                        key={connector.connector}
                        className="stack form-group"
                        aria-label={`Kết nối ${connector.label}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void run(async () => {
                            await call(accessToken, 'PUT', `billing/connectors/${connector.connector}`, {
                              enabled: true,
                              values: secrets[connector.connector] ?? {},
                            });
                            setSecrets({ ...secrets, [connector.connector]: {} });
                            return `Đã lưu kết nối ${connector.label}.`;
                          });
                        }}
                      >
                        <div>
                          <strong>{connector.label}</strong> {state}
                        </div>
                        {connector.fields.map((field) => (
                          <label key={field.name} className="field">
                            {field.label}
                            <input
                              type={field.secret ? 'password' : 'text'}
                              autoComplete="off"
                              placeholder={connector.hints[field.name] ?? ''}
                              value={secrets[connector.connector]?.[field.name] ?? ''}
                              onChange={(event) =>
                                setSecrets({
                                  ...secrets,
                                  [connector.connector]: {
                                    ...(secrets[connector.connector] ?? {}),
                                    [field.name]: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                        ))}
                        <div className="button-row">
                          <button type="submit" className="button-secondary" disabled={busy}>
                            Lưu và bật
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div key={connector.connector} className="feature-row">
                        <div>
                          <strong>{connector.label}</strong>
                        </div>
                        {state}
                      </div>
                    );
                  })}
                  {canConnect ? null : <p className="muted">Chỉ quản trị nền tảng nhập khóa cổng thanh toán.</p>}
                </section>
              </div>
            </TabPanel>
          ) : null}
        </>
      ) : null}
      {selected ? (
        <InvoiceDialog
          accessToken={accessToken}
          invoiceId={selected}
          onChanged={load}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {freePeriod ? (
        <FreePeriodDialog
          accessToken={accessToken}
          school={freePeriod}
          onClose={() => setFreePeriod(null)}
          onDone={(text) => {
            setFreePeriod(null);
            finish(text);
          }}
        />
      ) : null}
      {assigning ? (
        <AssignDialog
          accessToken={accessToken}
          payment={assigning}
          onClose={() => setAssigning(null)}
          onDone={(text) => {
            setAssigning(null);
            finish(text);
          }}
        />
      ) : null}
      {creating && overview ? (
        <ManualInvoiceDialog
          accessToken={accessToken}
          schools={overview.receivables}
          onClose={() => setCreating(false)}
          onDone={(text) => {
            setCreating(false);
            finish(text);
          }}
        />
      ) : null}
    </section>
  );
}
