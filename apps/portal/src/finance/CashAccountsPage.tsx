import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { CatalogTable } from '../catalogs/CatalogTable.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import {
  ACCOUNT_TYPE_LABELS,
  createCashAccount,
  listCashAccounts,
  updateCashAccount,
  type CashAccount,
  type CashAccountType,
} from './finance-api.js';

// MH-11 Quỹ và tài khoản ngân hàng (P06-05, BR-34; YCTD-53): kế toán và kế toán trưởng khai báo; số dư hiện tại chỉ đổi
// qua phiếu thu, phiếu chi. Sổ quỹ theo ngày làm ở phần phiếu chi và quỹ
export function CashAccountsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.cashAccountManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const accounts = useQuery({
    queryKey: ['cash-accounts', orgUnitId],
    queryFn: () => listCashAccounts(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Quỹ và tài khoản ngân hàng</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <CatalogTable<CashAccount>
          title="Quỹ và tài khoản của đơn vị"
          rows={accounts.data}
          isPending={accounts.isPending}
          error={accounts.error}
          columns={[
            { label: 'Tên', render: (row) => <span className="font-medium">{row.name}</span> },
            { label: 'Loại', render: (row) => ACCOUNT_TYPE_LABELS[row.account_type] },
            {
              label: 'Ngân hàng',
              render: (row) => (row.bank_name ? `${row.bank_name} ${row.account_number ?? ''}` : ''),
            },
            { label: 'Số dư đầu', render: (row) => formatMoney(row.opening_balance) },
            { label: 'Số dư hiện tại', render: (row) => formatMoney(row.current_balance) },
          ]}
          fields={[
            {
              key: 'account_type',
              label: 'Loại',
              kind: 'select',
              fixedAfterCreate: true,
              options: [
                { value: 'cash', label: ACCOUNT_TYPE_LABELS.cash },
                { value: 'bank', label: ACCOUNT_TYPE_LABELS.bank },
              ],
            },
            { key: 'name', label: 'Tên quỹ hoặc tài khoản' },
            { key: 'bank_name', label: 'Ngân hàng' },
            { key: 'account_number', label: 'Số tài khoản' },
            { key: 'opening_balance', label: 'Số dư đầu', kind: 'number', fixedAfterCreate: true },
          ]}
          canManage={canManage}
          initialValues={{ account_type: 'cash', name: '', bank_name: '', account_number: '', opening_balance: '0' }}
          valuesOf={(row) => ({
            account_type: row.account_type,
            name: row.name,
            bank_name: row.bank_name ?? '',
            account_number: row.account_number ?? '',
            opening_balance: String(row.opening_balance),
          })}
          onCreate={async (values) => {
            await createCashAccount({
              org_unit_id: orgUnitId ?? '',
              account_type: (values.account_type ?? 'cash') as CashAccountType,
              name: values.name ?? '',
              bank_name: values.bank_name ?? '',
              account_number: values.account_number ?? '',
              opening_balance: Number(values.opening_balance ?? 0),
            });
            await refresh();
          }}
          onUpdate={async (row, changes) => {
            await updateCashAccount(
              row.id,
              'name' in changes
                ? {
                    name: changes.name,
                    bank_name: changes.bank_name ?? '',
                    account_number: changes.account_number ?? '',
                  }
                : { status: changes.status as CashAccount['status'] },
            );
            await refresh();
          }}
          onChanged={setToastMessage}
        />
      </div>
    </AppShell>
  );
}
