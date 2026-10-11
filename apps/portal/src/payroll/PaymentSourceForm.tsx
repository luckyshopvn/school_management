import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { listCashflowCategories } from '../fees/fees-api.js';
import { listCashAccounts } from '../finance/finance-api.js';

// Chọn quỹ hoặc tài khoản của Trường chính và khoản mục cho phiếu chi lương hoặc phiếu thu thu hồi lương (YCTD-61)
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function AccountCategoryFields({
  flowType,
  label,
  busy,
  onSubmit,
  children,
}: {
  flowType: 'income' | 'expense';
  label: string;
  busy: boolean;
  onSubmit(source: { account_id: string; category_id: string; account_type: string }): void;
  children?: React.ReactNode;
}) {
  const unitChoice = useUnitChoice();
  const root = unitChoice.units.find((unit) => unit.unit_type === 'truong_chinh');
  const accounts = useQuery({
    queryKey: ['cash-accounts', root?.id],
    queryFn: () => listCashAccounts(root?.id ?? ''),
    enabled: Boolean(root),
  });
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const account = accounts.data?.find((row) => row.id === accountId);

  return (
    <form
      className="grid grid-cols-1 items-end gap-3 md:grid-cols-4"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ account_id: accountId, category_id: categoryId, account_type: account?.account_type ?? 'cash' });
      }}
    >
      <label className="text-label font-medium text-text">
        Quỹ hoặc tài khoản của Trường chính
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={selectClass}>
          <option value="">Chọn</option>
          {(accounts.data ?? [])
            .filter((row) => row.status === 'active')
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Khoản mục
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}>
          <option value="">Chọn</option>
          {(categories.data ?? [])
            .filter((row) => row.status === 'active' && row.flow_type === flowType)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
        </select>
      </label>
      {children}
      <div>
        <Button type="submit" variant="primary" disabled={busy || !accountId || !categoryId}>
          {label}
        </Button>
      </div>
    </form>
  );
}
