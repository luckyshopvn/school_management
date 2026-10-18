import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { CatalogGrid } from '../catalogs/CatalogGrid.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createCashflowCategory,
  listCashflowCategories,
  updateCashflowCategory,
  type CashflowCategory,
} from './fees-api.js';

// MH-39 Khoản mục và nhóm thu chi (P06-10, BR-36; YCTD-49): dùng chung toàn trường; kế toán và kế toán trưởng quản lý.
// Lưới dữ liệu chung, biểu mẫu theo khối với nút Ghi (DT-15 phần 15f1)
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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/cashflow-categories')}</h1>
        <CatalogGrid<CashflowCategory>
          title="Khoản mục và nhóm thu chi"
          gridKey="cashflow-categories"
          rows={categories.data}
          isPending={categories.isPending}
          error={categories.error}
          columns={[
            { id: 'code', header: 'Mã', cell: (row) => row.code },
            {
              id: 'name',
              header: 'Tên',
              alwaysVisible: true,
              cell: (row) => <span className="font-medium">{row.name}</span>,
            },
            { id: 'group_name', header: 'Nhóm', cell: (row) => row.group_name },
            { id: 'flow_type', header: 'Loại', cell: (row) => FLOW_LABELS[row.flow_type] },
          ]}
          searchText={(row) => `${row.code} ${row.name} ${row.group_name}`}
          searchLabel="Tìm theo mã, tên, nhóm"
          getRowLabel={(row) => row.name}
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
