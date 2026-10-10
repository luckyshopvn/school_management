import { useEffect, useRef, useState } from 'react';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-11 Học phí và công nợ của con (P05-06, P05-09; AC-103, AC-106; YCTD-51, YCTD-53): hóa đơn đã phát hành của con mình,
// chi tiết từng khoản, số còn phải nộp, số dư có và lịch sử đã nộp
interface Invoice {
  id: string;
  code: string | null;
  period_year: number;
  period_month: number;
  invoice_kind: 'main' | 'supplementary';
  total_amount: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  due_date: string | null;
}

interface Debt {
  outstanding_amount: number;
  credit_amount: number;
}

interface Receipt {
  id: string;
  code: string;
  receipt_date: string;
  amount: number;
  payer_name: string;
}

interface InvoiceDetail extends Invoice {
  items: Array<{ id: string; description: string; amount: number; basis_note: string | null }>;
  discounts: Array<{ id: string; discount_type_name: string; applied_amount: number }>;
  adjustments: Array<{ id: string; code: string; reason: string; amount: number }>;
}

const money = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function InvoicesPanel({ child }: { child: { id: string; full_name: string } }) {
  const [invoices, setInvoices] = useState<Invoice[]>();
  const [detail, setDetail] = useState<InvoiceDetail>();
  const [debt, setDebt] = useState<Debt>();
  const [receipts, setReceipts] = useState<Receipt[]>();
  const [errorMessage, setErrorMessage] = useState<string>();
  // Mở nhanh nhiều hóa đơn thì chỉ hiện chi tiết của lần mở sau cùng
  const latestRequest = useRef(0);

  useEffect(() => {
    requestJson<Invoice[]>(`/api/v1/invoices?child_id=${child.id}`)
      .then(setInvoices)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
    requestJson<Debt>(`/api/v1/children/${child.id}/debt`)
      .then(setDebt)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
    requestJson<Receipt[]>(`/api/v1/children/${child.id}/receipts`)
      .then(setReceipts)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [child.id]);

  async function open(invoiceId: string) {
    const requestNumber = ++latestRequest.current;
    try {
      const loaded = await requestJson<InvoiceDetail>(`/api/v1/invoices/${invoiceId}`);
      if (requestNumber === latestRequest.current) {
        setDetail(loaded);
      }
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label={`Học phí của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {debt ? (
        <div className="flex flex-wrap gap-4 text-content font-semibold">
          <span>Còn phải nộp {money(debt.outstanding_amount)}</span>
          {debt.credit_amount > 0 ? <span>Số dư có {money(debt.credit_amount)}</span> : null}
        </div>
      ) : null}
      {invoices && invoices.length === 0 ? <p className="text-content text-text-secondary">Chưa có học phí.</p> : null}
      <ul className="flex flex-col gap-2">
        {(invoices ?? []).map((invoice) => (
          <li
            key={invoice.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
            aria-label={`Hóa đơn ${invoice.code ?? ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-content font-semibold">
                Tháng {invoice.period_month}/{invoice.period_year}
                {invoice.invoice_kind === 'supplementary' ? ' (bổ sung)' : ''}
              </span>
              <span className="text-content font-semibold">Phải nộp {money(invoice.payable_amount)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-label text-text-secondary">
              <span>Số {invoice.code}</span>
              {invoice.outstanding_amount <= 0 ? (
                <StatusBadge tone="success" label="Đã thu đủ" />
              ) : invoice.due_date ? (
                <StatusBadge tone="warning" label={`Hạn nộp ${invoice.due_date}`} />
              ) : null}
              <Button variant="text" onClick={() => void open(invoice.id)}>
                Xem chi tiết
              </Button>
            </div>
            {detail?.id === invoice.id ? (
              <ul className="flex flex-col gap-1 text-content">
                {detail.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.description}
                      {item.basis_note ? ` (${item.basis_note})` : ''}
                    </span>
                    <span>{money(item.amount)}</span>
                  </li>
                ))}
                {detail.discounts.map((discount) => (
                  <li key={discount.id} className="flex justify-between gap-2">
                    <span>Miễn giảm: {discount.discount_type_name}</span>
                    <span>−{money(discount.applied_amount)}</span>
                  </li>
                ))}
                {detail.adjustments.map((adjustment) => (
                  <li key={adjustment.id} className="flex justify-between gap-2">
                    <span>
                      Điều chỉnh {adjustment.code}: {adjustment.reason}
                    </span>
                    <span>{money(adjustment.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-2 font-semibold">
                  <span>Tổng hóa đơn</span>
                  <span>{money(detail.total_amount)}</span>
                </li>
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {receipts && receipts.length > 0 ? (
        <section className="flex flex-col gap-1" aria-label="Lịch sử đã nộp">
          <h3 className="text-content font-semibold text-text">Lịch sử đã nộp</h3>
          <ul className="flex flex-col gap-1 text-content">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex justify-between gap-2">
                <span>
                  {receipt.code} ngày {receipt.receipt_date}
                </span>
                <span>{money(receipt.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
