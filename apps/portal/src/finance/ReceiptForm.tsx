import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { formatMoney, listCashflowCategories } from '../fees/fees-api.js';
import { ApiError } from '../session/api-client.js';
import {
  createReceipt,
  listCashAccounts,
  METHOD_LABELS,
  type ChildDebt,
  type Receipt,
  type ReceiptMethod,
} from './finance-api.js';

// Biểu mẫu phiếu thu và phân bổ (MH-09; P06-01, P06-02; BR-31; Q-47, Q-152): chọn hóa đơn còn phải nộp, mỗi hóa đơn
// thu đủ số còn lại; tiền thừa thành số dư có. Thủ quỹ chỉ có lựa chọn tiền mặt
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function ReceiptForm({
  debt,
  cashOnly,
  onIssued,
}: {
  debt: ChildDebt;
  cashOnly: boolean;
  onIssued(receipt: Receipt): void;
}) {
  const accounts = useQuery({
    queryKey: ['cash-accounts', debt.org_unit_id],
    queryFn: () => listCashAccounts(debt.org_unit_id),
  });
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const openInvoices = debt.invoices.filter((invoice) => invoice.outstanding_amount > 0);
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState<ReceiptMethod>('cash');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(today());
  const [content, setContent] = useState('');
  // Mã yêu cầu giữ nguyên khi bấm lại để máy chủ không tạo phiếu thứ hai (QT-04 E5)
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const allocated = openInvoices
    .filter((invoice) => selected.includes(invoice.id))
    .reduce((sum, invoice) => sum + invoice.outstanding_amount, 0);
  const received = Number(amount || 0);
  const usableAccounts = (accounts.data ?? []).filter(
    (account) =>
      account.status === 'active' &&
      (method === 'cash'
        ? account.account_type === 'cash'
        : method === 'transfer'
          ? account.account_type === 'bank'
          : true),
  );
  const incomeCategories = (categories.data ?? []).filter(
    (category) => category.flow_type === 'income' && category.status === 'active',
  );

  const issue = useMutation({
    mutationFn: () =>
      createReceipt({
        request_key: requestKey,
        child_id: debt.child_id,
        payer_name: payerName,
        amount: received,
        method,
        account_id: accountId || usableAccounts[0]?.id || '',
        category_id: categoryId || incomeCategories[0]?.id || '',
        receipt_date: receiptDate,
        content,
        allocations: openInvoices
          .filter((invoice) => selected.includes(invoice.id))
          .map((invoice) => ({ invoice_id: invoice.id, amount: invoice.outstanding_amount })),
      }),
    onSuccess: (receipt) => {
      setRequestKey(crypto.randomUUID());
      setSelected([]);
      setAmount('');
      onIssued(receipt);
    },
  });

  const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
      aria-label={`Lập phiếu thu cho ${debt.child_name}`}
      onSubmit={(event) => {
        event.preventDefault();
        issue.mutate();
      }}
    >
      <h3 className="text-content font-semibold text-text">Lập phiếu thu</h3>
      {openInvoices.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-label font-medium text-text">Hóa đơn cần thanh toán</legend>
          {openInvoices.map((invoice) => (
            <label key={invoice.id} className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={selected.includes(invoice.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? [...selected, invoice.id] : selected.filter((id) => id !== invoice.id),
                  )
                }
              />
              {invoice.code} kỳ {invoice.period_month}/{invoice.period_year}: {formatMoney(invoice.outstanding_amount)}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-content text-text-secondary">Trẻ không còn hóa đơn phải nộp; số thu sẽ thành số dư có.</p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField label="Người nộp" value={payerName} onChange={(event) => setPayerName(event.target.value)} />
        <TextField
          label="Số tiền thu"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <TextField
          label="Ngày thu"
          type="date"
          value={receiptDate}
          onChange={(event) => setReceiptDate(event.target.value)}
        />
        <label className="text-label font-medium text-text">
          Phương thức
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value as ReceiptMethod);
              setAccountId('');
            }}
            className={selectClass}
          >
            {(cashOnly ? (['cash'] as const) : (['cash', 'transfer', 'other'] as const)).map((value) => (
              <option key={value} value={value}>
                {METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Tài khoản nhận
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={selectClass}>
            {usableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Khoản mục thu
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}>
            {incomeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField label="Nội dung" value={content} onChange={(event) => setContent(event.target.value)} />
      <div className="flex flex-wrap items-center gap-4 text-content">
        <span>Tổng phân bổ {formatMoney(allocated)}</span>
        <span>Còn lại {formatMoney(received - allocated)}</span>
        {received > allocated && allocated > 0 ? (
          <span className="text-text-secondary">Số còn lại ghi thành số dư có cho kỳ sau</span>
        ) : null}
      </div>
      {received > 0 && allocated > received ? (
        <Alert tone="danger">Tổng phân bổ vượt số tiền đã thu, điều chỉnh lại</Alert>
      ) : null}
      {issue.error ? <Alert tone="danger">{messageOf(issue.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={issue.isPending}>
          Phát hành phiếu thu
        </Button>
      </div>
    </form>
  );
}
