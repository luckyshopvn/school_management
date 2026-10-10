import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { CatalogTable } from '../catalogs/CatalogTable.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createCashflowCategory,
  listCashflowCategories,
  updateCashflowCategory,
  type CashflowCategory,
} from './fees-api.js';

// MH-39 Khoản mục và nhóm thu chi (P06-10, BR-36; YCTD-49): dùng chung toàn trường; kế toán và kế toán trưởng quản lý
const FLOW_LABELS: Record<CashflowCategory['flow_type'], string> = { income: 'Thu', expense: 'Chi' };

export function CashflowCategoriesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.cashflowCategoryManage);
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Khoản mục thu chi</h1>
        <CatalogTable<CashflowCategory>
          title="Khoản mục và nhóm thu chi"
          rows={categories.data}
          isPending={categories.isPending}
          error={categories.error}
          columns={[
            { label: 'Mã', render: (row) => row.code },
            { label: 'Tên', render: (row) => <span className="font-medium">{row.name}</span> },
            { label: 'Nhóm', render: (row) => row.group_name },
            { label: 'Loại', render: (row) => FLOW_LABELS[row.flow_type] },
          ]}
          fields={[
            { key: 'code', label: 'Mã', fixedAfterCreate: true },
            { key: 'name', label: 'Tên khoản mục' },
            { key: 'group_name', label: 'Nhóm thu chi' },
            {
              key: 'flow_type',
              label: 'Loại',
              kind: 'select',
              fixedAfterCreate: true,
              options: [
                { value: 'income', label: 'Thu' },
                { value: 'expense', label: 'Chi' },
              ],
            },
          ]}
          canManage={canManage}
          initialValues={{ code: '', name: '', group_name: '', flow_type: 'income' }}
          valuesOf={(row) => ({ code: row.code, name: row.name, group_name: row.group_name, flow_type: row.flow_type })}
          onCreate={async (values) => {
            await createCashflowCategory({
              code: values.code ?? '',
              name: values.name ?? '',
              group_name: values.group_name ?? '',
              flow_type: (values.flow_type ?? 'income') as CashflowCategory['flow_type'],
            });
            await refresh();
          }}
          onUpdate={async (row, changes) => {
            await updateCashflowCategory(
              row.id,
              'name' in changes
                ? { name: changes.name, group_name: changes.group_name }
                : { status: changes.status as CashflowCategory['status'] },
            );
            await refresh();
          }}
          onChanged={setToastMessage}
        />
      </div>
    </AppShell>
  );
}
