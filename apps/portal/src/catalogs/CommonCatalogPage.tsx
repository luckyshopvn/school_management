import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { CatalogTable } from './CatalogTable.js';
import {
  createCatalogItem,
  listCatalogItems,
  listCatalogTypes,
  updateCatalogItem,
  type CatalogItem,
} from './catalogs-api.js';

// MH-50 Danh mục dùng chung (P01-05): loại do hệ thống định nghĩa, Hiệu trưởng thêm, sửa, ngừng các mục (YCTD-42)
function CatalogItemsSection({
  catalogType,
  label,
  canManage,
  onChanged,
}: {
  catalogType: string;
  label: string;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ['catalog-items', catalogType], queryFn: () => listCatalogItems(catalogType) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['catalog-items', catalogType] });
  const toOrder = (value: string | undefined) => (value === undefined || value === '' ? 0 : Number(value));

  return (
    <CatalogTable<CatalogItem>
      title={label}
      rows={items.data}
      isPending={items.isPending}
      error={items.error}
      columns={[
        { label: 'Mã', render: (row) => row.code },
        { label: 'Tên', render: (row) => <span className="font-medium">{row.name}</span> },
        { label: 'Thứ tự', render: (row) => row.order_no },
      ]}
      fields={[
        { key: 'code', label: 'Mã' },
        { key: 'name', label: 'Tên' },
        { key: 'order_no', label: 'Thứ tự', kind: 'number' },
      ]}
      canManage={canManage}
      initialValues={{ code: '', name: '', order_no: '' }}
      valuesOf={(row) => ({ code: row.code, name: row.name, order_no: String(row.order_no) })}
      onCreate={async (values) => {
        await createCatalogItem({
          catalog_type: catalogType,
          code: values.code ?? '',
          name: values.name ?? '',
          order_no: toOrder(values.order_no),
        });
        await refresh();
      }}
      onUpdate={async (row, changes) => {
        await updateCatalogItem(
          row.id,
          'name' in changes
            ? { code: changes.code, name: changes.name, order_no: toOrder(changes.order_no) }
            : { status: changes.status as CatalogItem['status'] },
        );
        await refresh();
      }}
      onChanged={onChanged}
    />
  );
}

export function CommonCatalogPage() {
  const canManage = useHasPermission(PERMISSION_CODES.catalogManage);
  const types = useQuery({ queryKey: ['catalog-types'], queryFn: listCatalogTypes });
  const [chosenType, setChosenType] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const selected = types.data?.find((type) => type.code === chosenType) ?? types.data?.[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Danh mục dùng chung</h1>
        <div className="flex flex-col gap-2">
          <label htmlFor="catalog-type" className="text-label font-medium text-text">
            Loại danh mục
          </label>
          <select
            id="catalog-type"
            value={selected?.code ?? ''}
            onChange={(event) => setChosenType(event.target.value)}
            className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-content"
          >
            {(types.data ?? []).map((type) => (
              <option key={type.code} value={type.code}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        {selected ? (
          <CatalogItemsSection
            key={selected.code}
            catalogType={selected.code}
            label={selected.label}
            canManage={canManage}
            onChanged={setToastMessage}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
