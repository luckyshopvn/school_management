import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  cancelPayable,
  createPayable,
  listIssuedPayments,
  listPayables,
  PAYABLE_STATUS_LABELS,
  payPayable,
  readPayableSources,
  type Payable,
} from './finance-g2-api.js';

// MH-57 (đề xuất) Công nợ phải trả nhà cung cấp (P06-07; BR-28, BR-36; YCTD-82): ghi từ phiếu mua hàng, phiếu mua thuốc hoặc lập
// tay; tổng còn phải trả theo nhà cung cấp, quá hạn; ghi đã trả bằng phiếu chi đã phát hành đúng số tiền
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function PayForm({
  payable,
  orgUnitId,
  onDone,
}: {
  payable: Payable;
  orgUnitId: string;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ['issued-payments', orgUnitId],
    queryFn: () => listIssuedPayments(orgUnitId),
  });
  const matching = (payments.data ?? []).filter((payment) => payment.amount === payable.amount);
  const [paymentId, setPaymentId] = useState('');
  const pay = useMutation({
    mutationFn: () => payPayable(payable.id, paymentId || (matching[0]?.id ?? '')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      onDone(`Đã ghi trả ${payable.code}`);
    },
  });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Phiếu chi đã phát hành
        <select
          value={paymentId || (matching[0]?.id ?? '')}
          onChange={(event) => setPaymentId(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
        >
          {matching.map((payment) => (
            <option key={payment.id} value={payment.id}>
              {payment.code} {payment.payee_name} {formatMoney(payment.amount)}
            </option>
          ))}
        </select>
      </label>
      <Button variant="primary" disabled={matching.length === 0 || pay.isPending} onClick={() => pay.mutate()}>
        Ghi đã trả
      </Button>
      {payments.data && matching.length === 0 ? (
        <span className="text-content text-text-secondary">Chưa có phiếu chi đã phát hành đúng số tiền.</span>
      ) : null}
      {pay.error ? <Alert tone="danger">{messageOf(pay.error)}</Alert> : null}
    </div>
  );
}

export function PayablesPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const canManage = useHasPermission(PERMISSION_CODES.payableManage);
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [payingId, setPayingId] = useState<string>();
  const [dueDate, setDueDate] = useState(() => addDays(today(), 30));
  const [manual, setManual] = useState({
    supplierId: '',
    payeeName: '',
    documentRef: '',
    description: '',
    amount: '',
    documentDate: today(),
  });

  const payables = useQuery({
    queryKey: ['payables', orgUnitId],
    queryFn: () => listPayables(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const sources = useQuery({
    queryKey: ['payable-sources', orgUnitId],
    queryFn: () => readPayableSources(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId) && canManage,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['payables'] });
    await queryClient.invalidateQueries({ queryKey: ['payable-sources'] });
  };
  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) => createPayable(input),
    onSuccess: async (created) => {
      await refresh();
      setToastMessage(`Đã ghi công nợ phải trả ${created.code}`);
    },
  });
  const cancel = useMutation({
    mutationFn: (payable: Payable) => cancelPayable(payable.id, 'Ghi nhầm'),
    onSuccess: refresh,
  });
  const data = payables.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Nợ nhà cung cấp</h1>
        <Toast message={toastMessage} onClose={closeToast} />
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        </div>
        {payables.error ? <Alert tone="danger">{messageOf(payables.error)}</Alert> : null}
        {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
        {cancel.error ? <Alert tone="danger">{messageOf(cancel.error)}</Alert> : null}
        {data ? (
          <section
            className="flex flex-wrap gap-6 rounded-xl border border-border bg-card p-4 text-content"
            aria-label="Tổng hợp phải trả"
          >
            <span className="font-semibold">Còn phải trả {formatMoney(data.totals.open_amount)}</span>
            <span>Quá hạn {formatMoney(data.totals.overdue_amount)}</span>
            <span>Đã trả {formatMoney(data.totals.paid_amount)}</span>
            {data.payees.map((payee) => (
              <span key={payee.payee_name}>
                {payee.payee_name}: {formatMoney(payee.open_amount)}
              </span>
            ))}
          </section>
        ) : null}
        {canManage && sources.data ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Chứng từ mua chưa ghi"
          >
            <h2 className="text-section-title font-semibold text-text">Chứng từ mua chưa ghi công nợ</h2>
            <div className="w-44">
              <TextField
                label="Hạn thanh toán"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            {sources.data.purchase_orders.length + sources.data.medicine_orders.length === 0 ? (
              <p className="text-content text-text-secondary">Không có chứng từ mua chờ ghi.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sources.data.purchase_orders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {order.code} ngày {order.order_date}, {order.supplier_name}, {formatMoney(order.total_amount)}
                    </span>
                    <Button
                      variant="text"
                      onClick={() =>
                        create.mutate({ source_type: 'purchase_order', source_id: order.id, due_date: dueDate })
                      }
                    >
                      Ghi công nợ {order.code}
                    </Button>
                  </li>
                ))}
                {sources.data.medicine_orders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {order.code} ngày {order.order_date}, {order.pharmacy_name}, {formatMoney(order.total_amount)}
                    </span>
                    <Button
                      variant="text"
                      onClick={() =>
                        create.mutate({
                          source_type: 'medicine_purchase_order',
                          source_id: order.id,
                          due_date: dueDate,
                        })
                      }
                    >
                      Ghi công nợ {order.code}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="text-label font-semibold text-text">Lập tay theo chứng từ của nhà cung cấp</h3>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-2 text-label font-medium text-text">
                Nhà cung cấp
                <select
                  value={manual.supplierId}
                  onChange={(event) => setManual({ ...manual, supplierId: event.target.value })}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
                >
                  <option value="">Nhập tên người nhận</option>
                  {sources.data.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              {manual.supplierId ? null : (
                <div className="w-56">
                  <TextField
                    label="Tên người nhận"
                    value={manual.payeeName}
                    onChange={(event) => setManual({ ...manual, payeeName: event.target.value })}
                  />
                </div>
              )}
              <div className="w-40">
                <TextField
                  label="Số chứng từ"
                  value={manual.documentRef}
                  onChange={(event) => setManual({ ...manual, documentRef: event.target.value })}
                />
              </div>
              <div className="w-64">
                <TextField
                  label="Nội dung"
                  value={manual.description}
                  onChange={(event) => setManual({ ...manual, description: event.target.value })}
                />
              </div>
              <div className="w-40">
                <TextField
                  label="Số tiền"
                  type="number"
                  value={manual.amount}
                  onChange={(event) => setManual({ ...manual, amount: event.target.value })}
                />
              </div>
              <div className="w-44">
                <TextField
                  label="Ngày chứng từ"
                  type="date"
                  value={manual.documentDate}
                  onChange={(event) => setManual({ ...manual, documentDate: event.target.value })}
                />
              </div>
              <Button
                variant="primary"
                disabled={!manual.description.trim() || !manual.amount || create.isPending}
                onClick={() =>
                  create.mutate({
                    org_unit_id: orgUnitId,
                    ...(manual.supplierId ? { supplier_id: manual.supplierId } : { payee_name: manual.payeeName }),
                    document_ref: manual.documentRef || undefined,
                    description: manual.description,
                    amount: Number(manual.amount),
                    document_date: manual.documentDate,
                    due_date: dueDate,
                  })
                }
              >
                Ghi công nợ phải trả
              </Button>
            </div>
          </section>
        ) : null}
        {data ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Bảng phải trả"
          >
            {data.rows.length === 0 ? (
              <p className="text-content text-text-secondary">Chưa có công nợ phải trả.</p>
            ) : (
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Mã</th>
                    <th className="px-3 py-2">Người nhận</th>
                    <th className="px-3 py-2">Chứng từ</th>
                    <th className="px-3 py-2 text-right">Số tiền</th>
                    <th className="px-3 py-2">Hạn</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((payable) => (
                    <tr key={payable.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{payable.code}</td>
                      <td className="px-3 py-2">{payable.payee_name}</td>
                      <td className="px-3 py-2">
                        {payable.document_ref ?? ''} {payable.description}
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(payable.amount)}</td>
                      <td className="px-3 py-2">
                        {payable.due_date}
                        {payable.overdue_days > 0 ? ` (quá ${payable.overdue_days} ngày)` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={payable.status === 'paid' ? 'success' : payable.overdue_days > 0 ? 'danger' : 'warning'}
                          label={PAYABLE_STATUS_LABELS[payable.status]}
                        />
                        {payable.payment_code ? ` ${payable.payment_code}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {canManage && payable.status === 'open' ? (
                          payingId === payable.id && orgUnitId ? (
                            <PayForm
                              payable={payable}
                              orgUnitId={orgUnitId}
                              onDone={(message) => {
                                setPayingId(undefined);
                                setToastMessage(message);
                              }}
                            />
                          ) : (
                            <>
                              <Button variant="text" onClick={() => setPayingId(payable.id)}>
                                Trả {payable.code}
                              </Button>
                              <Button variant="text" onClick={() => cancel.mutate(payable)}>
                                Hủy
                              </Button>
                            </>
                          )
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
