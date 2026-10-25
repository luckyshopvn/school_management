import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { call } from './PlansPage.js';
import { PlatformApiError } from './platform-api.js';

// Trang "Thu phí" của cổng vận hành nền tảng (DT-SaaS phần S5b, YCTD-196): công nợ theo trường, hóa đơn và chi tiết, lập hóa đơn tay,
// điều chỉnh tay có lý do (giảm giá, ghi nhận tiền tay, hủy, tặng kỳ, gán giao dịch chưa khớp), hóa đơn điện tử, quy tắc tính phí, cấu
// hình thu phí và khóa cổng thanh toán của nền tảng (chỉ hiện gợi ý bốn ký tự cuối)
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
  einvoices: Array<{ provider: string; status: string; external_id: string | null; lookup_code: string | null; error: string | null }>;
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
  unmatched_payments: Array<{ id: string; provider: string; provider_reference: string; amount: number; transfer_content: string }>;
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

export function BillingPage({ accessToken }: { accessToken: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [rules, setRules] = useState<PriceRuleRow[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<InvoiceDetail | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [action, setAction] = useState({ amount: '', reference: '', reason: '' });
  const [manual, setManual] = useState({ school_id: '', active_students: '', note: '' });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    reload().catch(() => setError('Không đọc được dữ liệu thu phí'));
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

  const open = (id: string) =>
    void run(async () => {
      setSelected(await call<InvoiceDetail>(accessToken, 'GET', `billing/invoices/${id}`));
      setAction({ amount: '', reference: '', reason: '' });
      return '';
    });

  const adjust = (kind: string, label: string) =>
    void run(async () => {
      if (!selected) {
        return '';
      }
      await call(accessToken, 'POST', `billing/invoices/${selected.id}/${kind}`, {
        ...(action.amount ? { amount: Number(action.amount) } : {}),
        reference: action.reference,
        reason: action.reason,
      });
      setSelected(await call<InvoiceDetail>(accessToken, 'GET', `billing/invoices/${selected.id}`));
      return `${label}: ${selected.code}`;
    });

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
      await call(accessToken, ruleForm.id ? 'PUT' : 'POST', ruleForm.id ? `billing/price-rules/${ruleForm.id}` : 'billing/price-rules', body);
      setRuleForm(emptyRule);
      return `Đã lưu quy tắc ${body.name}`;
    });
  };

  const editRule = (rule: PriceRuleRow) =>
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

  if (!overview) {
    return (
      <section aria-label="Thu phí">
        <h2>Thu phí</h2>
        {error ? <p role="alert">{error}</p> : <p>Đang tải…</p>}
      </section>
    );
  }

  return (
    <section aria-label="Thu phí">
      <h2>Thu phí</h2>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <h3>Công nợ theo trường</h3>
      <table aria-label="Công nợ theo trường">
        <thead>
          <tr>
            <th>Trường</th>
            <th>Trạng thái</th>
            <th>Còn nợ</th>
            <th>Hóa đơn chưa trả</th>
            <th>Quá hạn</th>
            <th>Hạn chờ trả</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {overview.receivables.map((row) => (
            <tr key={row.school_id}>
              <td>
                {row.school_code} – {row.school_name}
              </td>
              <td>{row.status}</td>
              <td>{money(row.outstanding)}</td>
              <td>{row.open_invoices}</td>
              <td>{row.overdue_invoices}</td>
              <td>{row.paid_until ?? '—'}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      const months = window.prompt(`Tặng bao nhiêu tháng cho ${row.school_code}?`, '1');
                      const reason = months ? window.prompt('Lý do tặng kỳ') : null;
                      if (!months || !reason) {
                        return 'Đã bỏ qua';
                      }
                      const result = await call<{ paidUntil: string }>(accessToken, 'POST', `billing/schools/${row.school_id}/free-period`, {
                        months: Number(months),
                        reason,
                      });
                      return `Đã tặng kỳ, hạn mới ${result.paidUntil}`;
                    })
                  }
                >
                  Tặng kỳ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        aria-label="Lập hóa đơn tay"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const created = await call<{ code: string }>(accessToken, 'POST', 'billing/invoices', {
              school_id: manual.school_id,
              ...(manual.active_students ? { active_students: Number(manual.active_students) } : {}),
              note: manual.note,
            });
            setManual({ school_id: '', active_students: '', note: '' });
            return `Đã lập hóa đơn ${created.code}`;
          });
        }}
      >
        <h3>Lập hóa đơn tay (kỳ đang chạy)</h3>
        <label>
          Trường
          <select value={manual.school_id} onChange={(event) => setManual({ ...manual, school_id: event.target.value })} required>
            <option value="">Chọn trường</option>
            {overview.receivables.map((row) => (
              <option key={row.school_id} value={row.school_id}>
                {row.school_code} – {row.school_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Số học sinh đang học (trống là số chốt gần nhất)
          <input inputMode="numeric" value={manual.active_students} onChange={(event) => setManual({ ...manual, active_students: event.target.value })} />
        </label>
        <label>
          Ghi chú
          <input value={manual.note} onChange={(event) => setManual({ ...manual, note: event.target.value })} />
        </label>
        <button type="submit">Lập hóa đơn</button>
      </form>

      <h3>Hóa đơn</h3>
      <label>
        Lọc
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">Tất cả</option>
          <option value="issued">Chưa trả</option>
          <option value="overdue">Quá hạn</option>
          <option value="paid">Đã trả</option>
          <option value="void">Đã hủy</option>
        </select>
      </label>
      <table aria-label="Danh sách hóa đơn">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Trường</th>
            <th>Kỳ</th>
            <th>Tổng</th>
            <th>Còn nợ</th>
            <th>Hạn</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.code}</td>
              <td>{invoice.school_code}</td>
              <td>
                {invoice.period_start} – {invoice.period_end}
              </td>
              <td>{money(invoice.total)}</td>
              <td>{money(invoice.outstanding)}</td>
              <td>{invoice.due_on}</td>
              <td>
                {STATUS[invoice.status]}
                {invoice.overdue ? ' (quá hạn)' : ''}
              </td>
              <td>
                <button type="button" onClick={() => open(invoice.id)}>
                  Xem
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected ? (
        <section aria-label={`Hóa đơn ${selected.code}`}>
          <h3>
            Hóa đơn {selected.code} – {selected.school_name}
          </h3>
          <table aria-label="Dòng hóa đơn">
            <tbody>
              {selected.lines.map((line) => (
                <tr key={line.sort}>
                  <td>{line.description}</td>
                  <td>{line.quantity}</td>
                  <td>{money(line.unit_price)}</td>
                  <td>{money(line.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>VAT {selected.vat_percent}%</td>
                <td>{money(selected.vat_amount)}</td>
              </tr>
              <tr>
                <td colSpan={3}>Tổng cộng (đã trả {money(selected.amount_paid)})</td>
                <td>{money(selected.total)}</td>
              </tr>
            </tbody>
          </table>
          <p>Nội dung chuyển khoản: {selected.payment_content}</p>
          <ul aria-label="Tiền đã nhận">
            {selected.payments.map((payment) => (
              <li key={payment.id}>
                {payment.provider} {payment.provider_reference}: {money(payment.amount)}
              </li>
            ))}
          </ul>
          <ul aria-label="Hóa đơn điện tử">
            {selected.einvoices.map((document, index) => (
              <li key={index}>
                {document.provider}: {document.status} {document.lookup_code ?? ''} {document.error ?? ''}
              </li>
            ))}
          </ul>
          <label>
            Số tiền (đồng)
            <input inputMode="numeric" value={action.amount} onChange={(event) => setAction({ ...action, amount: event.target.value })} />
          </label>
          <label>
            Mã giao dịch (ghi nhận tiền tay)
            <input value={action.reference} onChange={(event) => setAction({ ...action, reference: event.target.value })} />
          </label>
          <label>
            Lý do
            <input value={action.reason} onChange={(event) => setAction({ ...action, reason: event.target.value })} />
          </label>
          <button type="button" onClick={() => adjust('discount', 'Đã giảm giá')}>
            Giảm giá
          </button>
          <button type="button" onClick={() => adjust('manual-payment', 'Đã ghi nhận tiền')}>
            Ghi nhận tiền tay
          </button>
          <button type="button" onClick={() => adjust('void', 'Đã hủy')}>
            Hủy hóa đơn
          </button>
          <button type="button" onClick={() => adjust('einvoice', 'Đã phát hành hóa đơn điện tử')}>
            Phát hành hóa đơn điện tử
          </button>
          <button type="button" onClick={() => adjust('einvoice-cancel', 'Đã hủy hóa đơn điện tử')}>
            Hủy hóa đơn điện tử
          </button>
        </section>
      ) : null}

      <h3>Giao dịch chưa khớp</h3>
      <table aria-label="Giao dịch chưa khớp">
        <tbody>
          {overview.unmatched_payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.provider}</td>
              <td>{payment.provider_reference}</td>
              <td>{money(payment.amount)}</td>
              <td>{payment.transfer_content}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      const code = window.prompt('Mã hóa đơn cần gán (ví dụ HD-000001)');
                      const invoice = invoices.find((item) => item.code === code?.trim());
                      const reason = invoice ? window.prompt('Lý do gán') : null;
                      if (!invoice || !reason) {
                        return 'Đã bỏ qua';
                      }
                      await call(accessToken, 'POST', `billing/payments/${payment.id}/assign`, { invoice_id: invoice.id, reason });
                      return `Đã gán vào ${invoice.code}`;
                    })
                  }
                >
                  Gán vào hóa đơn
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Quy tắc tính phí</h3>
      <table aria-label="Quy tắc tính phí">
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.code}</td>
              <td>{rule.name}</td>
              <td>{rule.components.map((component) => COMPONENTS[component]).join(' + ')}</td>
              <td>{PERIODS[rule.period]}</td>
              <td>Gói: {rule.plans.join(', ') || '—'}</td>
              <td>
                <button type="button" onClick={() => editRule(rule)}>
                  Sửa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form aria-label={ruleForm.id ? 'Sửa quy tắc tính phí' : 'Lập quy tắc tính phí'} onSubmit={saveRule}>
        <label>
          Mã quy tắc
          <input value={ruleForm.code} onChange={(event) => setRuleForm({ ...ruleForm, code: event.target.value })} required />
        </label>
        <label>
          Tên quy tắc
          <input value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} required />
        </label>
        <fieldset>
          <legend>Thành phần tính phí</legend>
          {Object.entries(COMPONENTS).map(([key, label]) => (
            <label key={key}>
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
              />{' '}
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          Bậc thang theo học sinh (số tối đa:đơn giá, bậc cuối để trống số tối đa)
          <input value={ruleForm.tiers} onChange={(event) => setRuleForm({ ...ruleForm, tiers: event.target.value })} />
        </label>
        <label>
          Cách tính bậc
          <select
            value={ruleForm.tier_mode}
            onChange={(event) => setRuleForm({ ...ruleForm, tier_mode: event.target.value as 'graduated' | 'volume' })}
          >
            <option value="graduated">Lũy tiến theo từng bậc</option>
            <option value="volume">Cả trường theo một bậc</option>
          </select>
        </label>
        <label>
          Phí theo trường mỗi kỳ (đồng)
          <input inputMode="numeric" value={ruleForm.school_fee} onChange={(event) => setRuleForm({ ...ruleForm, school_fee: event.target.value })} />
        </label>
        <fieldset>
          <legend>Giá từng phân hệ mỗi kỳ (đồng)</legend>
          {overview.modules.map((module) => (
            <label key={module.key}>
              {module.label}
              <input
                inputMode="numeric"
                value={ruleForm.module_prices[module.key] ?? ''}
                onChange={(event) =>
                  setRuleForm({ ...ruleForm, module_prices: { ...ruleForm.module_prices, [module.key]: event.target.value } })
                }
              />
            </label>
          ))}
        </fieldset>
        <label>
          Phí tối thiểu mỗi kỳ (đồng)
          <input inputMode="numeric" value={ruleForm.minimum_fee} onChange={(event) => setRuleForm({ ...ruleForm, minimum_fee: event.target.value })} />
        </label>
        <label>
          Kỳ thu
          <select
            value={ruleForm.period}
            onChange={(event) => setRuleForm({ ...ruleForm, period: event.target.value as PriceRuleRow['period'] })}
          >
            {Object.entries(PERIODS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          VAT (%)
          <input inputMode="numeric" value={ruleForm.vat_percent} onChange={(event) => setRuleForm({ ...ruleForm, vat_percent: event.target.value })} />
        </label>
        <label>
          Số ngày hạn trả sau cuối kỳ
          <input inputMode="numeric" value={ruleForm.due_days} onChange={(event) => setRuleForm({ ...ruleForm, due_days: event.target.value })} />
        </label>
        <button type="submit">Lưu quy tắc</button>
      </form>

      <h3>Cấu hình thu phí</h3>
      <form
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
            return 'Đã lưu cấu hình thu phí';
          });
        }}
      >
        {[
          ['invoice_prefix', 'Tiền tố mã hóa đơn'],
          ['bank_bin', 'Mã BIN ngân hàng nhận tiền'],
          ['account_number', 'Số tài khoản nhận tiền'],
          ['account_name', 'Tên tài khoản nhận tiền'],
          ['remind_days_before', 'Nhắc trước hạn (ngày, cách nhau dấu phẩy)'],
          ['remind_days_after', 'Nhắc sau hạn (ngày)'],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input value={settings[key as string] ?? ''} onChange={(event) => setSettings({ ...settings, [key as string]: event.target.value })} />
          </label>
        ))}
        <label>
          Bộ nối hóa đơn điện tử
          <select value={settings.einvoice_provider ?? 'none'} onChange={(event) => setSettings({ ...settings, einvoice_provider: event.target.value })}>
            {overview.einvoice_providers.map((code) => (
              <option key={code} value={code}>
                {code === 'none' ? 'Chưa nối (nhà cung cấp chưa chốt)' : 'Giả lập (phát triển, kiểm thử)'}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Lưu cấu hình</button>
      </form>

      <h3>Cổng thanh toán của nền tảng</h3>
      {overview.connectors.map((connector) => (
        <form
          key={connector.connector}
          aria-label={`Kết nối ${connector.label}`}
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await call(accessToken, 'PUT', `billing/connectors/${connector.connector}`, {
                enabled: true,
                values: secrets[connector.connector] ?? {},
              });
              setSecrets({ ...secrets, [connector.connector]: {} });
              return `Đã lưu kết nối ${connector.label}`;
            });
          }}
        >
          <h4>
            {connector.label} {connector.configured ? (connector.enabled ? '(đang bật)' : '(đang tắt)') : '(chưa cấu hình)'}
          </h4>
          {connector.fields.map((field) => (
            <label key={field.name}>
              {field.label}
              <input
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={connector.hints[field.name] ?? ''}
                value={secrets[connector.connector]?.[field.name] ?? ''}
                onChange={(event) =>
                  setSecrets({
                    ...secrets,
                    [connector.connector]: { ...(secrets[connector.connector] ?? {}), [field.name]: event.target.value },
                  })
                }
              />
            </label>
          ))}
          <button type="submit">Lưu và bật</button>
        </form>
      ))}
    </section>
  );
}
