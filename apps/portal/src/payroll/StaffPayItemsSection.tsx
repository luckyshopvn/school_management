import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import {
  addStaffPayItem,
  formatMoney,
  listPayItemTypes,
  METHOD_LABELS,
  readStaffPayItems,
  removeStaffPayItem,
  setDependents,
} from './payroll-api.js';

// Khoản lương riêng và số người phụ thuộc của một nhân sự trong MH-12 (P08-11, YCTD-60): phòng nhân sự gán khoản trong
// danh mục, nhập mức riêng nếu khác mức chung; người xem được hợp đồng chỉ xem
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function StaffPayItemsSection({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const items = useQuery({
    queryKey: ['staff-pay-items', staffId],
    queryFn: () => readStaffPayItems(staffId),
    retry: false,
  });
  const types = useQuery({
    queryKey: ['pay-item-types'],
    queryFn: listPayItemTypes,
    enabled: Boolean(items.data?.can_manage),
  });
  const [typeId, setTypeId] = useState('');
  const [level, setLevel] = useState('');
  const [dependents, setDependentsText] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff-pay-items', staffId] });
  const chosen = types.data?.find((type) => type.id === typeId);
  const add = useMutation({
    mutationFn: () =>
      addStaffPayItem(staffId, {
        pay_item_type_id: typeId,
        amount: chosen?.calculation_method !== 'percent_of_base' && level !== '' ? Number(level) : null,
        rate_percent: chosen?.calculation_method === 'percent_of_base' && level !== '' ? Number(level) : null,
      }),
    onSuccess: () => {
      setLevel('');
      return refresh();
    },
  });
  const remove = useMutation({ mutationFn: removeStaffPayItem, onSuccess: refresh });
  const saveDependents = useMutation({
    mutationFn: () => setDependents(staffId, Number(dependents)),
    onSuccess: refresh,
  });

  if (items.error instanceof ApiError && items.error.status === 403) {
    return null;
  }
  const data = items.data;
  const error = add.error ?? remove.error ?? saveDependents.error ?? items.error;
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3" aria-label="Khoản lương riêng">
      <h3 className="text-content font-semibold text-text">Khoản lương riêng</h3>
      {data ? <p className="text-content text-text">Số người phụ thuộc: {data.dependents_count}</p> : null}
      {data && data.items.length === 0 ? <p className="text-content text-text-secondary">Chưa gán khoản nào.</p> : null}
      {data && data.items.length > 0 ? (
        <table className="w-full text-content">
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-t border-border" aria-label={`Khoản ${item.code} của nhân sự`}>
                <td className="px-3 py-1 font-medium">{item.name}</td>
                <td className="px-3 py-1">{METHOD_LABELS[item.calculation_method]}</td>
                <td className="px-3 py-1">
                  {item.calculation_method === 'percent_of_base'
                    ? `${item.rate_percent ?? item.default_rate_percent ?? ''}%`
                    : formatMoney(item.amount ?? item.default_amount ?? 0)}
                </td>
                <td className="px-3 py-1 text-right">
                  {data.can_manage ? (
                    <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>
                      Bỏ khoản
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {data?.can_manage ? (
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
          <label className="text-label font-medium text-text">
            Khoản trong danh mục
            <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className={selectClass}>
              <option value="">Chọn khoản</option>
              {(types.data ?? [])
                .filter((type) => type.status === 'active')
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
          </label>
          <TextField
            label={
              chosen?.calculation_method === 'percent_of_base' ? 'Tỷ lệ riêng (%)' : 'Mức riêng (trống là mức chung)'
            }
            type="number"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          />
          <Button disabled={add.isPending || !typeId} onClick={() => add.mutate()}>
            Gán khoản
          </Button>
          <div className="flex items-end gap-2">
            <TextField
              label="Số người phụ thuộc"
              type="number"
              value={dependents}
              onChange={(event) => setDependentsText(event.target.value)}
            />
            <Button disabled={saveDependents.isPending || dependents === ''} onClick={() => saveDependents.mutate()}>
              Lưu
            </Button>
          </div>
        </div>
      ) : null}
      {error && !(error instanceof ApiError && error.status === 403) ? (
        <Alert tone="danger">{messageOf(error)}</Alert>
      ) : null}
    </section>
  );
}
