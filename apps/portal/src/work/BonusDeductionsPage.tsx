import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { formatMoney, listPayItemTypes } from '../payroll/payroll-api.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import { listBonusDeductions, messageOf, send, vietnamToday, type BonusDeduction } from './work-api.js';

// MH-60 Thưởng và khấu trừ theo tháng (P08-07; BR-44, BR-45; YCTD-81): kế toán, kế toán trưởng ghi khoản thưởng
// hoặc khấu trừ có căn cứ vào bảng lương của một tháng; tính lại bảng lương nháp để áp dụng; tháng đã trình duyệt thì khóa.
// Giao diện chung theo Sở (DT-15 phần 15f2): lưới dữ liệu (khóa `bonus-deductions`) tìm theo nhân sự, khoản, căn cứ, mở
// rộng tìm kiếm theo loại và trạng thái; Thêm mới mở biểu mẫu theo khối có nút Ghi
const KIND_LABELS: Record<BonusDeduction['kind'], string> = { allowance: 'Thưởng', deduction: 'Khấu trừ' };
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

const COLUMNS: Array<DataGridColumn<BonusDeduction>> = [
  { id: 'full_name', header: 'Nhân sự', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'item', header: 'Khoản', cell: (row) => `${KIND_LABELS[row.kind]}: ${row.item_name}` },
  {
    id: 'amount',
    header: 'Số tiền',
    className: 'text-right',
    cell: (row) => `${row.kind === 'allowance' ? '' : '−'}${formatMoney(row.amount)}`,
  },
  { id: 'basis', header: 'Căn cứ', cell: (row) => row.basis },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (row.status === 'active' ? 'Hiệu lực' : `Đã hủy: ${row.cancel_reason ?? ''}`),
  },
];

function BonusDeductionForm({
  month,
  onSaved,
  onCancel,
}: {
  month: string;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [staffId, setStaffId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [basis, setBasis] = useState('');
  const types = useQuery({ queryKey: ['pay-item-types'], queryFn: listPayItemTypes });
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, ''],
    queryFn: () => listStaff(orgUnitId ?? '', ''),
    enabled: Boolean(orgUnitId),
  });
  const create = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/bonus-deductions', {
        staff_id: staffId,
        pay_item_type_id: typeId,
        month,
        amount: Number(amount),
        basis,
      }),
    onSuccess: () => onSaved('Đã ghi khoản; tính lại bảng lương nháp của tháng để áp dụng'),
  });
  const error = [types.error, staff.error, create.error].find(Boolean);
  return (
    <form
      aria-label="Ghi thưởng hoặc khấu trừ"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <FormBlock title={`Ghi thưởng hoặc khấu trừ vào bảng lương tháng ${month}`}>
        <FormRow label="Đơn vị">
          <select
            className={FORM_CONTROL_CLASS}
            value={orgUnitId ?? ''}
            onChange={(event) => {
              setStaffId('');
              unitChoice.select(event.target.value);
            }}
          >
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Nhân sự">
          <select className={FORM_CONTROL_CLASS} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">Chọn nhân sự</option>
            {(staff.data ?? [])
              .filter((person) => person.status === 'active')
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Loại khoản">
          <select className={FORM_CONTROL_CLASS} value={typeId} onChange={(event) => setTypeId(event.target.value)}>
            <option value="">Chọn loại</option>
            {(types.data ?? [])
              .filter((type) => type.status === 'active')
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {KIND_LABELS[type.kind]}: {type.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Số tiền">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormRow>
        <FormRow label="Căn cứ">
          <input className={FORM_CONTROL_CLASS} value={basis} onChange={(event) => setBasis(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={create.isPending || !staffId || !typeId || !amount || basis.trim() === ''}
        >
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function BonusDeductionsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.bonusDeductionManage);
  const grid = useGridSettings('bonus-deductions');
  const [month, setMonth] = useState(vietnamToday().slice(0, 7));
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<BonusDeduction['kind'] | ''>('');
  const [status, setStatus] = useState<BonusDeduction['status'] | ''>('');
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const validMonth = /^\d{4}-\d{2}$/.test(month);

  const list = useQuery({
    queryKey: ['bonus-deductions', month],
    queryFn: () => listBonusDeductions(month),
    enabled: validMonth,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['bonus-deductions'] });
    setToastMessage(message);
  };
  const cancel = useMutation({
    mutationFn: (id: string) => send('POST', `/api/v1/bonus-deductions/${id}/cancel`, { reason: 'Hủy khoản ghi nhầm' }),
    onSuccess: () => refresh('Đã hủy khoản'),
  });
  const error = [list.error, cancel.error, grid.error].find(Boolean);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (list.data ?? []).filter(
    (row) =>
      (kind === '' || row.kind === kind) &&
      (status === '' || row.status === status) &&
      (keyword === '' ||
        [row.full_name, row.item_name, row.basis].some((value) => value.toLocaleLowerCase('vi').includes(keyword))),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/bonus-deductions')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <div className="w-48">
          <TextField
            label="Tháng bảng lương"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
        {creating && validMonth ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <BonusDeductionForm
              key={month}
              month={month}
              onCancel={() => setCreating(false)}
              onSaved={(message) => {
                setCreating(false);
                void refresh(message);
              }}
            />
          </section>
        ) : null}
        <DataGrid
          label="Khoản thưởng và khấu trừ"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `khoản ${row.item_name} của ${row.full_name}`}
          getRowAriaLabel={(row) => `Khoản ${row.item_name} của ${row.full_name}`}
          loading={validMonth && list.isPending}
          emptyText="Tháng này chưa có khoản thưởng hoặc khấu trừ."
          search={{ label: 'Tìm theo nhân sự, khoản, căn cứ', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Loại
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as BonusDeduction['kind'] | '')}
                  className={filterClass}
                >
                  <option value="">Tất cả</option>
                  <option value="allowance">{KIND_LABELS.allowance}</option>
                  <option value="deduction">{KIND_LABELS.deduction}</option>
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Trạng thái
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as BonusDeduction['status'] | '')}
                  className={filterClass}
                >
                  <option value="">Tất cả</option>
                  <option value="active">Hiệu lực</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </label>
            </div>
          }
          toolbar={
            canManage ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={(row) =>
            row.can_cancel ? (
              <Button variant="text" disabled={cancel.isPending} onClick={() => cancel.mutate(row.id)}>
                Hủy
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
