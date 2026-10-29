import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Alert, Button, ConfirmDialog, StatusBadge, type StatusTone } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Tab "Mua trực tiếp" của trang gia sư AI cho con (YCTD-383 lát L1b, bản mẫu MH-598): gói do nền tảng bán, trả ngay qua cổng thanh toán
// của nền tảng bằng mã QR hoặc liên kết, nhận biên lai của nền tảng trong ứng dụng. Khung trang và tab chọn nơi mua thuộc lát L1a; tệp
// này chỉ hiển thị phần mua trực tiếp của một con. Quy tắc (chặn mua trùng gói tháng, giữ chỗ 15 phút, kích hoạt khi tiền vào) ở máy chủ
type Level = 'TH' | 'THCS' | 'THPT';

interface Plan {
  id: string;
  kind: 'monthly' | 'top_up';
  name: string;
  price: number;
  turns: number;
  allow_images: boolean;
}

interface Receipt {
  number: string;
  seller: string;
  payer_name: string;
  school_name: string;
  description: string;
  amount: number;
  provider: string;
  provider_reference: string;
  issued_at: string;
}

interface Order {
  id: string;
  code: string;
  kind: 'purchase' | 'upgrade';
  plan_name: string;
  plan_kind: 'monthly' | 'top_up';
  period_month: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded' | 'needs_refund';
  pending_expires_at: string;
  transfer_content: string;
  qr_content: string | null;
  created_at: string;
  receipt: Receipt | null;
  refund: { amount: number; reason: string; created_at: string } | null;
}

interface Overview {
  school_level: Level | null;
  payment: { available: boolean; simulated: boolean };
  current_month: string;
  next_month: string;
  plans: Plan[];
  subscriptions: Array<{
    id: string;
    plan_source: 'school' | 'platform';
    plan_kind: 'monthly' | 'top_up';
    plan_name: string;
    period_month: string | null;
    status: 'pending' | 'active';
    turns: number;
    used_turns: number;
  }>;
  balance: { monthly: number; topUp: number };
  orders: Order[];
  // Nâng gói tháng đang dùng giữa tháng: phần chênh lệch theo số ngày còn lại, lượt cộng thêm cùng tỉ lệ (máy chủ tính)
  upgrade_options: Array<{
    plan_id: string;
    plan_name: string;
    from_plan_name: string;
    price_difference: number;
    extra_turns: number;
    remaining_days: number;
    days_in_month: number;
  }>;
}

const STATUS: Record<Order['status'], { label: string; tone: StatusTone }> = {
  pending: { label: 'Chờ thanh toán', tone: 'warning' },
  paid: { label: 'Đã thanh toán', tone: 'success' },
  expired: { label: 'Hết hạn thanh toán', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  refunded: { label: 'Đã hoàn tiền', tone: 'info' },
  needs_refund: { label: 'Chờ hoàn tiền', tone: 'danger' },
};

const money = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
const monthLabel = (month: string) => `tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;
const time = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const isPaymentUrl = (content: string) => /^https?:\/\//i.test(content);

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function PaymentBox({ order }: { order: Order }) {
  const [image, setImage] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    if (order.qr_content) {
      void QRCode.toDataURL(order.qr_content, { margin: 1, width: 220 }).then((url) => {
        if (!cancelled) {
          setImage(url);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [order.qr_content]);
  if (!order.qr_content) {
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-2" role="group" aria-label={`Mã QR thanh toán ${order.code}`}>
      {image ? <img src={image} alt={`Mã QR thanh toán ${order.code}`} className="h-56 w-56" /> : null}
      {isPaymentUrl(order.qr_content) ? (
        <a
          href={order.qr_content}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand px-4 py-2 text-label font-medium text-white hover:bg-brand-strong"
        >
          Mở trang thanh toán
        </a>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-content">
        <dt className="text-text-secondary">Số tiền</dt>
        <dd className="font-semibold">{money(order.amount)}</dd>
        <dt className="text-text-secondary">Nội dung</dt>
        <dd>{order.transfer_content}</dd>
        <dt className="text-text-secondary">Giữ chỗ tới</dt>
        <dd>{time(order.pending_expires_at)}</dd>
      </dl>
    </div>
  );
}

function ReceiptView({ receipt }: { receipt: Receipt }) {
  return (
    <section aria-label={`Biên lai ${receipt.number}`} className="flex flex-col gap-1 rounded-lg border p-3 text-label">
      <strong className="text-content">Biên lai {receipt.number}</strong>
      <span>Bên bán: {receipt.seller}</span>
      <span>Người trả: {receipt.payer_name}</span>
      <span>Trường của con: {receipt.school_name}</span>
      <span>{receipt.description}</span>
      <span className="font-semibold">Số tiền: {money(receipt.amount)}</span>
      <span className="text-text-secondary">
        Thanh toán lúc {time(receipt.issued_at)}, mã giao dịch của cổng {receipt.provider_reference}
      </span>
    </section>
  );
}

export default function AiTutorDirectPurchase({ childId }: { childId: string }) {
  const [view, setView] = useState<Overview>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState<'current' | 'next'>('current');
  const [openReceipt, setOpenReceipt] = useState<string>();
  const [cancelling, setCancelling] = useState<Order>();

  const load = useCallback(() => {
    requestJson<Overview>(`/api/v1/ai-tutor/direct/children/${childId}`)
      .then((next) => {
        setView(next);
        setErrorMessage(undefined);
      })
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [childId]);
  useEffect(load, [load]);

  const pending = view?.orders.find((order) => order.status === 'pending');

  // Đang chờ tiền vào: hỏi lại mỗi 5 giây tới khi giao dịch đổi trạng thái
  useEffect(() => {
    if (!pending) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      requestJson<Order>(`/api/v1/ai-tutor/direct/orders/${pending.id}`)
        .then((order) => {
          if (order.status !== 'pending') {
            if (order.status === 'paid') {
              setNotice(`Đã thanh toán ${order.code}. Biên lai đã có bên dưới.`);
            }
            load();
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pending, load]);

  const act = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      await work();
      if (done) {
        setNotice(done);
      }
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const buy = (plan: Plan) =>
    act(() =>
      requestJson(`/api/v1/ai-tutor/direct/children/${childId}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          ...(plan.kind === 'monthly' && view
            ? { period_month: month === 'current' ? view.current_month : view.next_month }
            : {}),
        }),
      }),
    );

  if (!view) {
    return errorMessage ? (
      <Alert tone="danger">{errorMessage}</Alert>
    ) : (
      <p className="text-content text-text-secondary">Đang tải...</p>
    );
  }

  const monthlyPlans = view.plans.filter((plan) => plan.kind === 'monthly');
  const topUpPlans = view.plans.filter((plan) => plan.kind === 'top_up');

  return (
    <section aria-label="Mua trực tiếp từ nền tảng" className="flex flex-col gap-3">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <p className="text-label text-text-secondary">
        Trả ngay bằng mã QR hoặc liên kết, nhận biên lai của nền tảng. Mỗi con chỉ có một gói tháng trong một tháng, dù
        mua qua trường hay mua trực tiếp. Đăng ký là đồng ý cho con dùng gia sư AI.
      </p>
      <div className="flex flex-col gap-1 rounded-lg border p-3 text-content" aria-label="Lượt còn của con">
        <span>
          Lượt của gói tháng còn: <strong>{view.balance.monthly}</strong>
        </span>
        <span>
          Lượt mua thêm còn: <strong>{view.balance.topUp}</strong>
        </span>
        {view.subscriptions.map((subscription) => (
          <span key={subscription.id} className="text-label text-text-secondary">
            {subscription.plan_name}
            {subscription.period_month ? `, ${monthLabel(subscription.period_month)}` : ''} (
            {subscription.plan_source === 'school' ? 'mua qua trường' : 'mua trực tiếp'},{' '}
            {subscription.status === 'active'
              ? `đã dùng ${subscription.used_turns}/${subscription.turns} lượt`
              : 'chờ thanh toán'}
            )
          </span>
        ))}
      </div>

      {!view.payment.available ? (
        <Alert tone="info">Nền tảng chưa mở thanh toán trực tuyến cho gia sư AI.</Alert>
      ) : null}
      {view.school_level === null ? (
        <Alert tone="info">Gia sư AI dành cho học sinh Tiểu học, Trung học cơ sở, Trung học phổ thông.</Alert>
      ) : null}

      {pending ? (
        <section
          aria-label="Giao dịch chờ thanh toán"
          className="flex flex-col gap-2 rounded-lg border border-warning p-3"
        >
          <strong className="text-content">
            {pending.kind === 'upgrade' ? 'Nâng lên ' : ''}
            {pending.plan_name}
            {pending.period_month ? `, ${monthLabel(pending.period_month)}` : ''}: chờ thanh toán
          </strong>
          <PaymentBox order={pending} />
          <div className="flex flex-wrap gap-2">
            {view.payment.simulated ? (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      requestJson(`/api/v1/ai-tutor/direct/orders/${pending.id}/simulate-payment`, { method: 'POST' }),
                    'Đã giả lập chuyển tiền. Gói đã được kích hoạt.',
                  )
                }
              >
                Giả lập đã thanh toán
              </Button>
            ) : null}
            <Button disabled={busy} onClick={load}>
              Kiểm tra lại
            </Button>
            <Button variant="text" disabled={busy} onClick={() => setCancelling(pending)}>
              Hủy giao dịch
            </Button>
          </div>
          {view.payment.simulated ? (
            <p className="text-label text-text-secondary">Cổng thanh toán giả lập trên máy: không có tiền thật.</p>
          ) : null}
        </section>
      ) : null}

      {view.payment.available && !pending && view.upgrade_options.length > 0 ? (
        <section aria-label="Nâng gói tháng này" className="flex flex-col gap-2">
          <h3 className="text-content font-semibold">Nâng gói tháng này</h3>
          {view.upgrade_options.map((option) => (
            <div key={option.plan_id} className="flex flex-col gap-1 rounded-lg border p-3 text-content">
              <strong>
                {option.from_plan_name} lên {option.plan_name}
              </strong>
              <span className="text-label text-text-secondary">
                Còn {option.remaining_days}/{option.days_in_month} ngày của tháng: trả thêm{' '}
                {money(option.price_difference)}, cộng {option.extra_turns} lượt hỏi.
              </span>
              <Button
                disabled={busy}
                aria-label={`Nâng lên ${option.plan_name}`}
                onClick={() =>
                  void act(() =>
                    requestJson(`/api/v1/ai-tutor/direct/children/${childId}/upgrades`, {
                      method: 'POST',
                      body: JSON.stringify({ plan_id: option.plan_id }),
                    }),
                  )
                }
              >
                Nâng gói
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {view.payment.available && view.school_level && !pending ? (
        <>
          {monthlyPlans.length > 0 ? (
            <fieldset className="flex flex-wrap gap-3 text-label">
              <legend className="text-content font-semibold">Gói tháng cho</legend>
              <label className="flex items-center gap-1">
                <input type="radio" checked={month === 'current'} onChange={() => setMonth('current')} />
                {monthLabel(view.current_month)}
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" checked={month === 'next'} onChange={() => setMonth('next')} />
                {monthLabel(view.next_month)}
              </label>
            </fieldset>
          ) : null}
          {[...monthlyPlans, ...topUpPlans].map((plan) => (
            <div key={plan.id} className="flex flex-col gap-1 rounded-lg border p-3 text-content">
              <strong>{plan.name}</strong>
              <div className="flex justify-between gap-2">
                <span>
                  {plan.kind === 'monthly'
                    ? `${plan.turns} lượt hỏi mỗi tháng`
                    : `${plan.turns} lượt, dùng khi hết lượt của tháng, giữ 12 tháng`}
                </span>
                <span className="font-semibold">
                  {money(plan.price)}
                  {plan.kind === 'monthly' ? '/tháng' : ''}
                </span>
              </div>
              {plan.kind === 'monthly' ? (
                <span className="text-label text-text-secondary">
                  {plan.allow_images ? 'Gửi được ảnh bài tập' : 'Chỉ gõ chữ'}
                </span>
              ) : null}
              <Button
                variant={plan.kind === 'monthly' ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => void buy(plan)}
                aria-label={`Mua ${plan.name}`}
              >
                {plan.kind === 'monthly' ? 'Chọn gói này' : 'Mua thêm'}
              </Button>
            </div>
          ))}
          {view.plans.length === 0 ? (
            <p className="text-label text-text-secondary">Chưa có gói nào cho cấp học của con.</p>
          ) : null}
        </>
      ) : null}

      {view.orders.length > 0 ? (
        <section aria-label="Giao dịch mua trực tiếp" className="flex flex-col gap-2">
          <h3 className="text-content font-semibold">Giao dịch</h3>
          <ul className="flex flex-col gap-2">
            {view.orders.map((order) => (
              <li key={order.id} className="flex flex-col gap-1 rounded-lg border p-2 text-label">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {order.code}: {order.kind === 'upgrade' ? 'nâng lên ' : ''}
                    {order.plan_name}
                    {order.period_month ? `, ${monthLabel(order.period_month)}` : ''}, {money(order.amount)}
                  </span>
                  <StatusBadge tone={STATUS[order.status].tone} label={STATUS[order.status].label} />
                </div>
                {order.status === 'needs_refund' ? (
                  <span className="text-text-secondary">
                    Tiền đến sau khi giao dịch hết hạn nên gói chưa được kích hoạt; nền tảng sẽ hoàn tiền.
                  </span>
                ) : null}
                {order.refund ? (
                  <span className="text-text-secondary">
                    Đã hoàn {money(order.refund.amount)}: {order.refund.reason}
                  </span>
                ) : null}
                {order.receipt ? (
                  <>
                    <Button
                      variant="text"
                      className="self-start px-0"
                      aria-expanded={openReceipt === order.id}
                      onClick={() => setOpenReceipt(openReceipt === order.id ? undefined : order.id)}
                    >
                      {openReceipt === order.id ? 'Ẩn biên lai' : 'Xem biên lai'}
                    </Button>
                    {openReceipt === order.id ? <ReceiptView receipt={order.receipt} /> : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={cancelling !== undefined}
        title="Hủy giao dịch chờ thanh toán"
        confirmLabel="Hủy giao dịch"
        busy={busy}
        onCancel={() => setCancelling(undefined)}
        onConfirm={() => {
          const order = cancelling;
          setCancelling(undefined);
          if (order) {
            void act(
              () => requestJson(`/api/v1/ai-tutor/direct/orders/${order.id}/cancel`, { method: 'POST' }),
              `Đã hủy ${order.code}.`,
            );
          }
        }}
      >
        Mã QR của giao dịch {cancelling?.code} sẽ hết hiệu lực. Nếu đã chuyển tiền, đừng hủy: hãy bấm Kiểm tra lại.
      </ConfirmDialog>
    </section>
  );
}
