import { Fragment, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission, useHasPermissionOnlyThrough } from '../session/permissions.js';
import {
  allocateCredit,
  listChildReceipts,
  listDebts,
  METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  readChildDebt,
  type PaymentStatus,
} from './finance-api.js';
import { ReceiptForm } from './ReceiptForm.js';

// MH-08 Danh sách công nợ (P05-09; QT-04 bước 1, 6; BR-32, BR-33; YCTD-53): số phải thu, đã thu, còn lại, số dư có,
// quá hạn; chi tiết của trẻ có lịch sử phiếu thu, lập phiếu thu và dùng số dư có. Nhắc nợ là giai đoạn 2
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_TONES: Record<PaymentStatus, 'success' | 'warning' | 'danger'> = {
  paid: 'success',
  unpaid: 'warning',
  overdue: 'danger',
};

function ChildDebtPanel({ childId, onChanged }: { childId: string; onChanged(message: string): void }) {
  const canCollect = useHasPermission(PERMISSION_CODES.receiptManage);
  const cashOnly = useHasPermissionOnlyThrough(PERMISSION_CODES.receiptManage, 'VT-16');
  const queryClient = useQueryClient();
  const debt = useQuery({ queryKey: ['child-debt', childId], queryFn: () => readChildDebt(childId) });
  const receipts = useQuery({ queryKey: ['child-receipts', childId], queryFn: () => listChildReceipts(childId) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['child-debt', childId] });
    await queryClient.invalidateQueries({ queryKey: ['child-receipts', childId] });
    await queryClient.invalidateQueries({ queryKey: ['debts'] });
  };
  const creditAllocation = useMutation({
    mutationFn: (invoice: { id: string; outstanding_amount: number }) =>
      allocateCredit(childId, [{ invoice_id: invoice.id, amount: invoice.outstanding_amount }]),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã dùng số dư có thanh toán hóa đơn');
    },
  });
  const data = debt.data;

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={`Công nợ của ${data?.child_name ?? ''}`}>
      {debt.error ? <Alert tone="danger">{messageOf(debt.error)}</Alert> : null}
      {creditAllocation.error ? <Alert tone="danger">{messageOf(creditAllocation.error)}</Alert> : null}
      {data ? (
        <>
          <div className="flex flex-wrap gap-4 text-content">
            <span>Còn phải nộp {formatMoney(data.outstanding_amount)}</span>
            <span>Số dư có {formatMoney(data.credit_amount)}</span>
          </div>
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-1">Hóa đơn</th>
                <th className="px-3 py-1">Kỳ</th>
                <th className="px-3 py-1">Đến hạn</th>
                <th className="px-3 py-1 text-right">Phải nộp</th>
                <th className="px-3 py-1 text-right">Đã thu</th>
                <th className="px-3 py-1 text-right">Còn lại</th>
                <th className="px-3 py-1">Trạng thái</th>
                <th className="px-3 py-1" />
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-border">
                  <td className="px-3 py-1">{invoice.code}</td>
                  <td className="px-3 py-1">
                    {invoice.period_month}/{invoice.period_year}
                  </td>
                  <td className="px-3 py-1">{invoice.due_date}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(invoice.payable_amount)}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(invoice.paid_amount)}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(invoice.outstanding_amount)}</td>
                  <td className="px-3 py-1">
                    <StatusBadge
                      tone={STATUS_TONES[invoice.payment_status]}
                      label={
                        invoice.payment_status === 'overdue'
                          ? `Quá hạn ${invoice.overdue_days} ngày`
                          : PAYMENT_STATUS_LABELS[invoice.payment_status]
                      }
                    />
                  </td>
                  <td className="px-3 py-1 text-right">
                    {canCollect &&
                    invoice.outstanding_amount > 0 &&
                    data.credit_amount >= invoice.outstanding_amount ? (
                      <Button
                        variant="text"
                        disabled={creditAllocation.isPending}
                        onClick={() => creditAllocation.mutate(invoice)}
                      >
                        Dùng số dư có
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canCollect ? (
            <ReceiptForm
              debt={data}
              cashOnly={cashOnly}
              onIssued={async (receipt) => {
                await refresh();
                onChanged(`Đã phát hành phiếu thu ${receipt.code}`);
              }}
            />
          ) : null}
        </>
      ) : null}
      <h3 className="text-content font-semibold text-text">Lịch sử phiếu thu</h3>
      {receipts.data && receipts.data.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có phiếu thu.</p>
      ) : null}
      <ul className="flex flex-col gap-1 text-content">
        {(receipts.data ?? []).map((receipt) => (
          <li key={receipt.id}>
            {receipt.code} ngày {receipt.receipt_date}: {formatMoney(receipt.amount)} ({METHOD_LABELS[receipt.method]},{' '}
            {receipt.account_name}), đã phân bổ {formatMoney(receipt.allocated_amount)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DebtsPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const debts = useQuery({
    queryKey: ['debts', orgUnitId, overdueOnly],
    queryFn: () => listDebts(orgUnitId ?? '', overdueOnly),
    enabled: Boolean(orgUnitId),
  });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const rows = debts.data ?? [];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Công nợ</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex items-center gap-2 text-content">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
            Chỉ trẻ có công nợ quá hạn
          </label>
        </div>
        {debts.error ? <Alert tone="danger">{messageOf(debts.error)}</Alert> : null}
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Danh sách công nợ"
        >
          {debts.data && rows.length === 0 ? (
            <p className="text-content text-text-secondary">Không có công nợ.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Trẻ</th>
                  <th className="px-3 py-2">Lớp</th>
                  <th className="px-3 py-2 text-right">Phải thu</th>
                  <th className="px-3 py-2 text-right">Đã thu</th>
                  <th className="px-3 py-2 text-right">Còn lại</th>
                  <th className="px-3 py-2 text-right">Số dư có</th>
                  <th className="px-3 py-2">Quá hạn</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border" aria-label={`Công nợ ${row.full_name}`}>
                      <td className="px-3 py-2 font-medium">{row.full_name}</td>
                      <td className="px-3 py-2">{row.class_name}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.payable_amount)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.paid_amount)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.outstanding_amount)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.credit_amount)}</td>
                      <td className="px-3 py-2">
                        {row.overdue_amount > 0 ? (
                          <StatusBadge
                            tone="danger"
                            label={`${formatMoney(row.overdue_amount)}, ${row.overdue_days} ngày`}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
                          {openId === row.id ? 'Ẩn' : 'Chi tiết'}
                        </Button>
                      </td>
                    </tr>
                    {openId === row.id ? (
                      <tr>
                        <td colSpan={8} className="px-3 pb-3">
                          <ChildDebtPanel childId={row.id} onChanged={setToastMessage} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
