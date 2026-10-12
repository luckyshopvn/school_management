import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { formatMoney, listPayItemTypes } from '../payroll/payroll-api.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import { listBonusDeductions, messageOf, selectClass, send, vietnamToday } from './work-api.js';

// MH-60 Thưởng và khấu trừ theo tháng (P08-07; BR-44, BR-45; YCTD-81): kế toán, kế toán trưởng ghi khoản thưởng
// hoặc khấu trừ có căn cứ vào bảng lương của một tháng; tính lại bảng lương nháp để áp dụng; tháng đã trình duyệt thì khóa
export function BonusDeductionsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.bonusDeductionManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [month, setMonth] = useState(vietnamToday().slice(0, 7));
  const [staffId, setStaffId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [basis, setBasis] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const rows = useQuery({
    queryKey: ['bonus-deductions', month],
    queryFn: () => listBonusDeductions(month),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });
  const types = useQuery({ queryKey: ['pay-item-types'], queryFn: listPayItemTypes, enabled: canManage });
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, ''],
    queryFn: () => listStaff(orgUnitId ?? '', ''),
    enabled: Boolean(orgUnitId) && canManage,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['bonus-deductions'] });
    setToastMessage(message);
  };
  const create = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/bonus-deductions', {
        staff_id: staffId,
        pay_item_type_id: typeId,
        month,
        amount: Number(amount),
        basis,
      }),
    onSuccess: () => {
      setAmount('');
      setBasis('');
      return refresh('Đã ghi khoản; tính lại bảng lương nháp của tháng để áp dụng');
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => send('POST', `/api/v1/bonus-deductions/${id}/cancel`, { reason: 'Hủy khoản ghi nhầm' }),
    onSuccess: () => refresh('Đã hủy khoản'),
  });
  const error = [rows.error, types.error, create.error, cancel.error].find(Boolean);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Thưởng và khấu trừ</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <TextField
              label="Tháng bảng lương"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          {canManage ? (
            <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          ) : null}
        </div>
        {canManage ? (
          <form
            aria-label="Ghi thưởng hoặc khấu trừ"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label className="text-label font-medium text-text">
              Nhân sự
              <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
                <option value="">Chọn nhân sự</option>
                {(staff.data ?? [])
                  .filter((person) => person.status === 'active')
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Loại khoản
              <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className={selectClass}>
                <option value="">Chọn loại</option>
                {(types.data ?? [])
                  .filter((type) => type.status === 'active')
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.kind === 'allowance' ? 'Thưởng' : 'Khấu trừ'}: {type.name}
                    </option>
                  ))}
              </select>
            </label>
            <TextField
              label="Số tiền"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <TextField label="Căn cứ" value={basis} onChange={(event) => setBasis(event.target.value)} />
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending || !staffId || !typeId || !amount || basis.trim() === ''}
              >
                Ghi khoản
              </Button>
            </div>
          </form>
        ) : null}
        <table className="w-full text-content" aria-label="Khoản thưởng và khấu trừ">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Nhân sự</th>
              <th>Khoản</th>
              <th>Số tiền</th>
              <th>Căn cứ</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).map((row) => (
              <tr
                key={row.id}
                className="border-t border-border"
                aria-label={`Khoản ${row.item_name} của ${row.full_name}`}
              >
                <td className="py-2">{row.full_name}</td>
                <td>
                  {row.kind === 'allowance' ? 'Thưởng' : 'Khấu trừ'}: {row.item_name}
                </td>
                <td>
                  {row.kind === 'allowance' ? '' : '−'}
                  {formatMoney(row.amount)}
                </td>
                <td>{row.basis}</td>
                <td>{row.status === 'active' ? 'Hiệu lực' : `Đã hủy: ${row.cancel_reason ?? ''}`}</td>
                <td>
                  {row.can_cancel ? (
                    <Button variant="text" disabled={cancel.isPending} onClick={() => cancel.mutate(row.id)}>
                      Hủy
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.data?.length === 0 ? (
          <p className="text-content text-text-secondary">Tháng này chưa có khoản thưởng hoặc khấu trừ.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
