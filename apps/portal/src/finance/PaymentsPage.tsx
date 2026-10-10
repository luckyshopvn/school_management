import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { uploadFile } from '../children/children-api.js';
import { formatMoney, listCashflowCategories } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission, useHasPermissionOnlyThrough } from '../session/permissions.js';
import {
  createPayment,
  decidePayment,
  deletePayment,
  listCashAccounts,
  listDebts,
  listPayments,
  listPendingPayments,
  PAYMENT_STATUS_TEXT,
  PAYMENT_TYPE_LABELS,
  submitPayment,
  type PaymentType,
} from './finance-api.js';

// MH-10 Phiếu chi và phê duyệt (P06-04; QT-05; BR-24, BR-28, BR-34, BR-77; YCTD-55): lập nháp kèm chứng từ, trình duyệt;
// Ban Giám hiệu duyệt theo hạn mức, duyệt là phát hành; phiếu hoàn tiền thôi học chỉ Hiệu trưởng duyệt
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function PaymentForm({ orgUnitId, onCreated }: { orgUnitId: string; onCreated(message: string): void }) {
  const cashOnly = useHasPermissionOnlyThrough(PERMISSION_CODES.paymentManage, 'VT-16');
  const accounts = useQuery({ queryKey: ['cash-accounts', orgUnitId], queryFn: () => listCashAccounts(orgUnitId) });
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const [paymentType, setPaymentType] = useState<PaymentType>('regular');
  const debts = useQuery({
    queryKey: ['debts', orgUnitId, false],
    queryFn: () => listDebts(orgUnitId, false),
    enabled: paymentType === 'refund',
  });
  const [childId, setChildId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  // Mã yêu cầu giữ nguyên khi bấm lại để máy chủ không tạo phiếu thứ hai (QT-05 E5)
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const usableAccounts = (accounts.data ?? []).filter(
    (account) => account.status === 'active' && (!cashOnly || account.account_type === 'cash'),
  );
  const expenseCategories = (categories.data ?? []).filter(
    (category) => category.flow_type === 'expense' && category.status === 'active',
  );
  const refundable = (debts.data ?? []).filter((row) => row.credit_amount > 0);

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const fileIds = [];
      for (const file of files) {
        fileIds.push((await uploadFile(orgUnitId, 'payment_voucher', file)).id);
      }
      const created = await createPayment({
        request_key: requestKey,
        org_unit_id: orgUnitId,
        payment_type: paymentType,
        ...(paymentType === 'refund' ? { child_id: childId || refundable[0]?.id } : {}),
        payee_name: payeeName,
        amount: Number(amount || 0),
        content,
        account_id: accountId || usableAccounts[0]?.id || '',
        category_id: categoryId || expenseCategories[0]?.id || '',
        file_ids: fileIds,
      });
      return submit ? submitPayment(created.id) : created;
    },
    onSuccess: (payment) => {
      setRequestKey(crypto.randomUUID());
      setAmount('');
      setContent('');
      setFiles([]);
      onCreated(payment.status === 'pending' ? 'Đã trình duyệt phiếu chi' : 'Đã lưu phiếu chi nháp');
    },
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Lập phiếu chi"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(true);
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Lập phiếu chi</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Loại phiếu chi
          <select
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value as PaymentType)}
            className={selectClass}
          >
            {(['regular', 'refund', 'payroll'] as const).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        {paymentType === 'refund' ? (
          <label className="text-label font-medium text-text">
            Trẻ được hoàn tiền
            <select value={childId} onChange={(event) => setChildId(event.target.value)} className={selectClass}>
              {refundable.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.full_name} (số dư có {formatMoney(row.credit_amount)})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <TextField label="Người nhận" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} />
        <TextField
          label="Số tiền chi"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <label className="text-label font-medium text-text">
          Nguồn chi
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={selectClass}>
            {usableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({formatMoney(account.current_balance)})
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Khoản mục chi
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField label="Nội dung chi" value={content} onChange={(event) => setContent(event.target.value)} />
      <label className="text-label font-medium text-text">
        Chứng từ kèm theo (ảnh hoặc PDF)
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          className="mt-2 block text-content"
          onChange={(event) => setFiles([...(event.target.files ?? [])])}
        />
      </label>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu và trình duyệt
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate(false)}>
          Lưu nháp
        </Button>
      </div>
    </form>
  );
}

export function PaymentsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.paymentManage);
  const canApprove = useHasPermission(PERMISSION_CODES.paymentApprove);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ['payments', orgUnitId],
    queryFn: () => listPayments(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const pending = useQuery({
    queryKey: ['payments-pending', orgUnitId],
    queryFn: () => listPendingPayments(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId) && canApprove,
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['payments'] });
    await queryClient.invalidateQueries({ queryKey: ['payments-pending'] });
    await queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
    setToastMessage(message);
  };
  const action = useMutation({
    mutationFn: (input: { paymentId: string; kind: 'submit' | 'delete' | 'approve' | 'reject' }): Promise<unknown> =>
      input.kind === 'submit'
        ? submitPayment(input.paymentId)
        : input.kind === 'delete'
          ? deletePayment(input.paymentId)
          : decidePayment(input.paymentId, input.kind === 'approve', reasons[input.paymentId] ?? ''),
    onSuccess: (_result, input) =>
      refresh(
        {
          submit: 'Đã trình duyệt phiếu chi',
          delete: 'Đã xóa phiếu chi nháp',
          approve: 'Đã duyệt và phát hành phiếu chi',
          reject: 'Đã từ chối phiếu chi',
        }[input.kind],
      ),
  });
  const rows = payments.data ?? [];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Phiếu chi</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {payments.error ? <Alert tone="danger">{messageOf(payments.error)}</Alert> : null}
        {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
        {canManage && orgUnitId ? (
          <PaymentForm key={orgUnitId} orgUnitId={orgUnitId} onCreated={(message) => void refresh(message)} />
        ) : null}
        {canApprove ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Phiếu chi chờ duyệt"
          >
            <h2 className="text-section-title font-semibold text-text">Phiếu chi chờ duyệt</h2>
            {pending.data && pending.data.length === 0 ? (
              <p className="text-content text-text-secondary">Không có phiếu chi chờ duyệt.</p>
            ) : null}
            {(pending.data ?? []).map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-2 border-t border-border pt-3"
                role="group"
                aria-label={`Phiếu chi cho ${payment.payee_name}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">
                    {PAYMENT_TYPE_LABELS[payment.payment_type]}: {payment.payee_name}
                    {payment.child_name ? ` (trẻ ${payment.child_name})` : ''}
                  </span>
                  <span>{formatMoney(payment.amount)}</span>
                  <span className="text-text-secondary">{payment.account_name}</span>
                  {payment.requires_principal ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null}
                </div>
                <span className="text-label text-text-secondary">{payment.content}</span>
                <div className="flex flex-wrap items-end gap-2">
                  <Button
                    variant="primary"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ paymentId: payment.id, kind: 'approve' })}
                  >
                    Duyệt
                  </Button>
                  <TextField
                    label={`Lý do từ chối phiếu chi cho ${payment.payee_name}`}
                    value={reasons[payment.id] ?? ''}
                    onChange={(event) => setReasons({ ...reasons, [payment.id]: event.target.value })}
                  />
                  <Button
                    variant="danger"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ paymentId: payment.id, kind: 'reject' })}
                  >
                    Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : null}
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Danh sách phiếu chi"
        >
          {payments.data && rows.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có phiếu chi.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Số phiếu</th>
                  <th className="px-3 py-2">Ngày chi</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Người nhận</th>
                  <th className="px-3 py-2">Nguồn chi</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border" aria-label={`Phiếu chi ${row.payee_name}`}>
                    <td className="px-3 py-2 font-medium">{row.code ?? ''}</td>
                    <td className="px-3 py-2">{row.payment_date ?? ''}</td>
                    <td className="px-3 py-2">{PAYMENT_TYPE_LABELS[row.payment_type]}</td>
                    <td className="px-3 py-2">{row.payee_name}</td>
                    <td className="px-3 py-2">{row.account_name}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        tone={row.status === 'issued' ? 'success' : row.status === 'draft' ? 'neutral' : 'warning'}
                        label={PAYMENT_STATUS_TEXT[row.status]}
                      />
                      {row.reject_reason && row.status === 'draft' ? (
                        <span className="block text-label text-danger">Bị từ chối: {row.reject_reason}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {canManage && row.status === 'draft' ? (
                        <>
                          <Button
                            variant="text"
                            disabled={action.isPending}
                            onClick={() => action.mutate({ paymentId: row.id, kind: 'submit' })}
                          >
                            Trình duyệt
                          </Button>
                          <Button
                            variant="text"
                            disabled={action.isPending}
                            onClick={() => action.mutate({ paymentId: row.id, kind: 'delete' })}
                          >
                            Xóa
                          </Button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
