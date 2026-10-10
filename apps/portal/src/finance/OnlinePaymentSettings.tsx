import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { listCashflowCategories } from '../fees/fees-api.js';
import { ApiError } from '../session/api-client.js';
import { readOnlinePaymentSettings, saveOnlinePaymentSettings, type CashAccount } from './finance-api.js';

// Tài khoản duy nhất của trường nhận thanh toán trực tuyến bằng mã QR và khoản mục thu của phiếu thu tự lập
// (P06-11, YCTD-57); chọn trong tài khoản ngân hàng của Trường chính
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function OnlinePaymentSettings({
  accounts,
  onSaved,
}: {
  accounts: CashAccount[];
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ['online-payment-settings'], queryFn: readOnlinePaymentSettings });
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const banks = accounts.filter((account) => account.account_type === 'bank' && account.status === 'active');
  const incomes = (categories.data ?? []).filter(
    (category) => category.flow_type === 'income' && category.status === 'active',
  );
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const save = useMutation({
    mutationFn: () => saveOnlinePaymentSettings(accountId || banks[0]?.id || '', categoryId || incomes[0]?.id || ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['online-payment-settings'] });
      onSaved('Đã lưu tài khoản nhận thanh toán trực tuyến');
    },
  });

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Tài khoản nhận thanh toán trực tuyến"
    >
      <h2 className="text-section-title font-semibold text-text">Tài khoản nhận thanh toán trực tuyến</h2>
      <p className="text-content text-text-secondary">
        {current.data
          ? `Đang nhận vào ${current.data.name} (${current.data.bank_name ?? ''} ${current.data.account_number ?? ''})`
          : 'Chưa cấu hình; phụ huynh chưa thanh toán được bằng mã QR.'}
      </p>
      {banks.length === 0 ? (
        <p className="text-content text-text-secondary">Chọn Trường chính và khai báo tài khoản ngân hàng trước.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Tài khoản ngân hàng
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={selectClass}>
              {banks.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label font-medium text-text">
            Khoản mục của phiếu thu tự lập
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}>
              {incomes.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu tài khoản nhận
          </Button>
        </div>
      )}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </section>
  );
}
