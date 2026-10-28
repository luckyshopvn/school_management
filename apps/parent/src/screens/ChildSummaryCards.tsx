import { useEffect, useState } from 'react';
import { StatusBadge } from '@school-management/ui';
import { SCORE_TERM_LABELS } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Hai thẻ tóm tắt ở thẻ của con trên trang chủ theo mẫu giao diện phụ huynh (YCTD-320): "Khoản cần nộp" (hóa đơn đã phát
// hành còn phải nộp, hạn gần nhất) và "Điểm mới" (môn có điểm ở học kỳ đã khoá gần nhất, con học THCS, THPT). Dùng đúng các
// điểm cuối của bảng Học phí, Điểm học tập; lỗi hay chưa có dữ liệu thì không hiện thẻ. Nút mở bảng chi tiết bên dưới
interface DueInvoice {
  id: string;
  period_year: number;
  period_month: number;
  invoice_kind: 'main' | 'supplementary';
  outstanding_amount: number;
  due_date: string | null;
}

interface LockedTerm {
  term_type: 'first_term' | 'second_term';
  subjects: Array<{
    subject_name: string;
    mode: 'score' | 'comment';
    average: number | null;
    result: 'pass' | 'fail' | null;
  }>;
}

const money = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
const scoreText = (value: number) => String(value).replace('.', ',');
const dateText = (value: string) => value.split('-').reverse().join('/');

const CARD_CLASS = 'flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5';
const LINK_CLASS = 'min-h-11 text-label font-medium text-link hover:underline';

export function DueInvoicesCard({ childId, onOpen }: { childId: string; onOpen(): void }) {
  const [invoices, setInvoices] = useState<DueInvoice[]>();
  useEffect(() => {
    requestJson<DueInvoice[]>(`/api/v1/invoices?child_id=${childId}`)
      .then((loaded) => setInvoices(loaded.filter((invoice) => invoice.outstanding_amount > 0)))
      .catch(() => setInvoices(undefined));
  }, [childId]);
  if (!invoices || invoices.length === 0) {
    return null;
  }
  const nearest = invoices
    .map((invoice) => invoice.due_date)
    .filter((value): value is string => value !== null)
    .sort()[0];
  return (
    <section className={CARD_CLASS} aria-label="Khoản cần nộp">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-content font-semibold text-text">Khoản cần nộp</h3>
        {nearest ? <StatusBadge tone="warning" label={`Hạn ${dateText(nearest)}`} /> : null}
      </div>
      <ul className="flex flex-col gap-1.5 text-label">
        {invoices.slice(0, 3).map((invoice) => (
          <li key={invoice.id} className="flex justify-between gap-2">
            <span className="text-text-secondary">
              Tháng {invoice.period_month}/{invoice.period_year}
              {invoice.invoice_kind === 'supplementary' ? ' (bổ sung)' : ''}
            </span>
            <span className="font-semibold tabular-nums text-text">{money(invoice.outstanding_amount)}</span>
          </li>
        ))}
      </ul>
      <button type="button" className={`${LINK_CLASS} self-start`} onClick={onOpen}>
        Xem và thanh toán
      </button>
    </section>
  );
}

export function RecentScoresCard({ childId, onOpen }: { childId: string; onOpen(): void }) {
  const [term, setTerm] = useState<LockedTerm>();
  useEffect(() => {
    requestJson<{ terms: LockedTerm[] }>(`/api/v1/scores/children/${childId}`)
      .then((loaded) => setTerm(loaded.terms.at(-1)))
      .catch(() => setTerm(undefined));
  }, [childId]);
  const subjects = (term?.subjects ?? []).filter((subject) =>
    subject.mode === 'score' ? subject.average !== null : subject.result !== null,
  );
  if (!term || subjects.length === 0) {
    return null;
  }
  return (
    <section className={CARD_CLASS} aria-label="Điểm mới">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-content font-semibold text-text">Điểm mới</h3>
        <span className="text-label text-text-secondary">{SCORE_TERM_LABELS[term.term_type]}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {subjects.slice(0, 3).map((subject) => (
          <li key={subject.subject_name} className="flex items-center justify-between gap-2">
            <span className="text-content text-text">{subject.subject_name}</span>
            <span className="text-lg font-bold tabular-nums text-brand-strong">
              {subject.mode === 'score' && subject.average !== null
                ? scoreText(subject.average)
                : subject.result === 'pass'
                  ? 'Đạt'
                  : 'Chưa đạt'}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className={`${LINK_CLASS} self-start`} onClick={onOpen}>
        Xem sổ điểm
      </button>
    </section>
  );
}
