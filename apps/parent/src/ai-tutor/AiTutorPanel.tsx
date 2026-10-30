import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, ConfirmDialog, FORM_CONTROL_CLASS, StatusBadge, type StatusTone } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import AiTutorDirectPurchase from './AiTutorDirectPurchase.js';

// Gia sư AI cho con (YCTD-383 lát L1a; bản mẫu MH-598): chọn nơi mua "Mua qua trường" (phí vào hóa đơn học phí kỳ tới) hoặc "Mua trực
// tiếp" (lát L1b). Mua là đồng ý cho con dùng; hủy được khi chưa lên hóa đơn học phí và con chưa dùng lượt; nâng gói tháng giữa tháng
// trả phần chênh lệch theo số ngày còn lại; xem số lượt đã dùng
interface Plan {
  id: string;
  kind: 'monthly' | 'top_up';
  name: string;
  price: number;
  turns: number;
  allow_images: boolean;
}

interface Subscription {
  id: string;
  plan_source: 'school' | 'platform';
  plan_id: string;
  plan_kind: 'monthly' | 'top_up';
  plan_name: string;
  period_month: string | null;
  price: number;
  status: 'pending' | 'active' | 'cancelled' | 'refunded';
  turns: number;
  used_turns: number;
  valid_until: string | null;
  created_at: string;
  invoiced: boolean;
  can_cancel: boolean;
  cancel_note: string | null;
  upgrades: Array<{
    id: string;
    from_plan_name: string;
    to_plan_name: string;
    price_difference: number;
    extra_turns: number;
    status: string;
  }>;
}

interface ChildView {
  child: { id: string; full_name: string; class_name: string | null; school_level: string | null };
  enabled: boolean;
  current_month: string;
  next_month: string;
  plans: Plan[];
  balance: { monthly: number; top_up: number };
  subscriptions: Subscription[];
}

interface Quote {
  from_plan_name: string;
  to_plan_name: string;
  remaining_days: number;
  days_in_month: number;
  price_difference: number;
  extra_turns: number;
}

type Pending =
  | { action: 'buy'; plan: Plan; periodMonth: string | null }
  | { action: 'upgrade'; plan: Plan; subscription: Subscription; quote: Quote }
  | { action: 'cancel'; subscription: Subscription };

const STATUS: Record<Subscription['status'], { tone: StatusTone; label: string }> = {
  pending: { tone: 'warning', label: 'Chờ thanh toán' },
  active: { tone: 'success', label: 'Đang dùng' },
  cancelled: { tone: 'neutral', label: 'Đã hủy' },
  refunded: { tone: 'neutral', label: 'Đã hoàn tiền' },
};

const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const monthLabel = (periodMonth: string) => `tháng ${Number(periodMonth.slice(5, 7))}/${periodMonth.slice(0, 4)}`;

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function AiTutorPanel({ child }: { child: { id: string; full_name: string } }) {
  const [tab, setTab] = useState<'school' | 'direct'>('school');
  const [view, setView] = useState<ChildView>();
  const [periodMonth, setPeriodMonth] = useState<string>();
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const base = `/api/v1/children/${child.id}/ai-tutor`;

  const load = useCallback(async () => {
    try {
      const loaded = await requestJson<ChildView>(base);
      setView(loaded);
      setPeriodMonth((current) => current ?? loaded.current_month);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (request: () => Promise<ChildView>, done: string) => {
    setBusy(true);
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      setView(await request());
      setNotice(done);
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
      setPending(undefined);
    }
  };

  const confirm = () => {
    if (!pending) {
      return;
    }
    if (pending.action === 'buy') {
      void run(
        () =>
          requestJson<ChildView>(`${base}/purchases`, {
            method: 'POST',
            body: JSON.stringify({ plan_id: pending.plan.id, period_month: pending.periodMonth, consent: true }),
          }),
        `Đã mua ${pending.plan.name}; phí vào hóa đơn học phí kỳ tới`,
      );
    } else if (pending.action === 'upgrade') {
      void run(
        () =>
          requestJson<ChildView>(`${base}/purchases/${pending.subscription.id}/upgrade`, {
            method: 'POST',
            body: JSON.stringify({ plan_id: pending.plan.id }),
          }),
        `Đã nâng lên ${pending.plan.name}, cộng ${pending.quote.extra_turns} lượt`,
      );
    } else {
      void run(
        () => requestJson<ChildView>(`${base}/purchases/${pending.subscription.id}/cancel`, { method: 'POST' }),
        `Đã hủy ${pending.subscription.plan_name}`,
      );
    }
  };

  const askUpgrade = async (plan: Plan, subscription: Subscription) => {
    setErrorMessage(undefined);
    try {
      const quote = await requestJson<Quote>(
        `${base}/purchases/${subscription.id}/upgrade-quote?plan_id=${encodeURIComponent(plan.id)}`,
      );
      setPending({ action: 'upgrade', plan, subscription, quote });
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  const active = (view?.subscriptions ?? []).filter((row) => row.status === 'active' || row.status === 'pending');
  const monthlyOf = (month: string | undefined) =>
    active.find((row) => row.plan_kind === 'monthly' && row.period_month === month);
  const currentMonthly = view ? monthlyOf(view.current_month) : undefined;
  const chosenMonthly = monthlyOf(periodMonth);
  const monthlyPlans = (view?.plans ?? []).filter((plan) => plan.kind === 'monthly');
  const topUpPlans = (view?.plans ?? []).filter((plan) => plan.kind === 'top_up');

  return (
    <section className="flex flex-col gap-3" aria-label={`Gia sư AI của ${child.full_name}`}>
      <div className="flex gap-2" role="tablist" aria-label="Nơi mua">
        <Button
          role="tab"
          aria-selected={tab === 'school'}
          variant={tab === 'school' ? 'secondary' : 'text'}
          onClick={() => setTab('school')}
        >
          Mua qua trường
        </Button>
        <Button
          role="tab"
          aria-selected={tab === 'direct'}
          variant={tab === 'direct' ? 'secondary' : 'text'}
          onClick={() => setTab('direct')}
        >
          Mua trực tiếp
        </Button>
      </div>
      {tab === 'direct' ? <AiTutorDirectPurchase childId={child.id} /> : null}
      {tab === 'school' ? (
        <div className="flex flex-col gap-3" role="tabpanel" aria-label="Mua qua trường">
          {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {view ? (
            <>
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3" aria-label="Lượt hỏi của con">
                <p className="text-content font-semibold text-text">
                  Tháng {Number(view.current_month.slice(5, 7))} của con
                </p>
                {currentMonthly ? (
                  <>
                    <p className="text-content text-text">
                      Đã dùng {currentMonthly.used_turns} / {currentMonthly.turns} lượt ({currentMonthly.plan_name})
                    </p>
                    <progress
                      className="h-2 w-full"
                      max={currentMonthly.turns}
                      value={currentMonthly.used_turns}
                      aria-label="Lượt đã dùng trong tháng"
                    />
                  </>
                ) : (
                  <p className="text-content text-text-secondary">Con chưa có gói tháng trong tháng này</p>
                )}
                <p className="text-content text-text">Lượt mua thêm còn {view.balance.top_up}</p>
              </div>
              {!view.enabled ? (
                <Alert tone="info">Trường chưa mở bán Gia sư AI cho cấp học của con</Alert>
              ) : (
                <>
                  {monthlyPlans.length > 0 ? (
                    <label className="flex flex-col gap-1 text-label text-text-secondary">
                      Tháng dùng của gói tháng
                      <select
                        className={FORM_CONTROL_CLASS}
                        value={periodMonth}
                        onChange={(event) => setPeriodMonth(event.target.value)}
                      >
                        <option value={view.current_month}>{monthLabel(view.current_month)} (tháng này)</option>
                        <option value={view.next_month}>{monthLabel(view.next_month)} (tháng sau)</option>
                      </select>
                    </label>
                  ) : null}
                  <ul className="flex flex-col gap-2" aria-label="Gói trường bán">
                    {monthlyPlans.map((plan) => {
                      const isCurrent = chosenMonthly?.plan_id === plan.id;
                      const canUpgrade =
                        chosenMonthly !== undefined &&
                        chosenMonthly.plan_source === 'school' &&
                        chosenMonthly.status === 'active' &&
                        !isCurrent &&
                        plan.price >
                          (monthlyPlans.find((item) => item.id === chosenMonthly.plan_id)?.price ??
                            chosenMonthly.price);
                      return (
                        <li
                          key={plan.id}
                          aria-label={plan.name}
                          className="flex flex-col gap-1 rounded-xl border border-border p-3"
                        >
                          <span className="text-content font-semibold text-text">{plan.name}</span>
                          <span className="text-label text-text-secondary">{plan.turns} lượt hỏi mỗi tháng</span>
                          <span className="text-content text-text">{money(plan.price)}/tháng</span>
                          <span className="text-label text-text-secondary">
                            {plan.allow_images ? 'Gửi được ảnh bài tập' : 'Chỉ gõ chữ'}
                          </span>
                          {isCurrent ? (
                            <StatusBadge tone="success" label="Con đang dùng gói này" />
                          ) : canUpgrade && chosenMonthly ? (
                            <Button disabled={busy} onClick={() => void askUpgrade(plan, chosenMonthly)}>
                              Nâng lên gói này
                            </Button>
                          ) : chosenMonthly ? null : (
                            <Button
                              variant="primary"
                              disabled={busy}
                              onClick={() => setPending({ action: 'buy', plan, periodMonth: periodMonth ?? null })}
                            >
                              Chọn gói này
                            </Button>
                          )}
                        </li>
                      );
                    })}
                    {topUpPlans.map((plan) => (
                      <li
                        key={plan.id}
                        aria-label={plan.name}
                        className="flex flex-col gap-1 rounded-xl border border-border p-3"
                      >
                        <span className="text-content font-semibold text-text">{plan.name}</span>
                        <span className="text-label text-text-secondary">
                          {plan.turns} lượt, dùng khi hết lượt của tháng, giữ 12 tháng
                        </span>
                        <span className="text-content text-text">{money(plan.price)}</span>
                        <Button disabled={busy} onClick={() => setPending({ action: 'buy', plan, periodMonth: null })}>
                          Mua thêm
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {view.plans.length === 0 ? <Alert tone="info">Trường chưa có gói đang bán</Alert> : null}
                </>
              )}
              <p className="text-label text-text-secondary">
                Mua qua trường: phí cộng vào hóa đơn học phí kỳ tới. Mỗi con chỉ có một gói tháng trong một tháng. Đăng
                ký là đồng ý cho con dùng gia sư AI.
              </p>
              {view.subscriptions.length > 0 ? (
                <ul className="flex flex-col gap-2" aria-label="Các lần mua">
                  {view.subscriptions.map((row) => (
                    <li
                      key={row.id}
                      aria-label={`Lần mua ${row.plan_name}`}
                      className="flex flex-col gap-1 rounded-xl border border-border p-3"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-content font-semibold text-text">{row.plan_name}</span>
                        <StatusBadge tone={STATUS[row.status].tone} label={STATUS[row.status].label} />
                      </span>
                      <span className="text-label text-text-secondary">
                        {[
                          row.plan_source === 'school' ? 'Mua qua trường' : 'Mua trực tiếp',
                          row.period_month ? monthLabel(row.period_month) : 'Gói lượt',
                          money(row.price),
                          `đã dùng ${row.used_turns}/${row.turns} lượt`,
                          row.invoiced ? 'đã lên hóa đơn học phí' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {row.upgrades
                        .filter((upgrade) => upgrade.status === 'applied')
                        .map((upgrade) => (
                          <span key={upgrade.id} className="text-label text-text-secondary">
                            Nâng {upgrade.from_plan_name} lên {upgrade.to_plan_name}: {money(upgrade.price_difference)},
                            cộng {upgrade.extra_turns} lượt
                          </span>
                        ))}
                      {row.can_cancel ? (
                        <Button
                          variant="text"
                          disabled={busy}
                          onClick={() => setPending({ action: 'cancel', subscription: row })}
                        >
                          Hủy lần mua
                        </Button>
                      ) : row.cancel_note && row.plan_source === 'school' && row.status === 'active' ? (
                        <span className="text-label text-text-secondary">{row.cancel_note}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={pending !== undefined}
        title={
          pending?.action === 'buy'
            ? `Mua ${pending.plan.name}`
            : pending?.action === 'upgrade'
              ? `Nâng lên ${pending.plan.name}`
              : 'Hủy lần mua'
        }
        confirmLabel={pending?.action === 'cancel' ? 'Hủy lần mua' : 'Đồng ý'}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(undefined)}
      >
        {pending?.action === 'buy' ? (
          <p>
            {money(pending.plan.price)}
            {pending.periodMonth ? ` cho ${monthLabel(pending.periodMonth)}` : ''}, cộng vào hóa đơn học phí kỳ tới. Bấm
            Đồng ý là cha mẹ đồng ý cho {child.full_name} dùng Gia sư AI.
          </p>
        ) : null}
        {pending?.action === 'upgrade' ? (
          <p>
            Trả thêm {money(pending.quote.price_difference)} theo {pending.quote.remaining_days}/
            {pending.quote.days_in_month} ngày còn lại của tháng, cộng {pending.quote.extra_turns} lượt. Phần chênh lệch
            vào hóa đơn học phí kỳ tới.
          </p>
        ) : null}
        {pending?.action === 'cancel' ? (
          <p>Con không dùng được lượt của gói này nữa; phí không vào hóa đơn học phí.</p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
