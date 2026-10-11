import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createPayItemType,
  createTaxTable,
  formatMoney,
  listPayItemTypes,
  listTaxTables,
  METHOD_LABELS,
  updatePayItemType,
  type PayCalculationMethod,
  type PayItemKind,
  type PayItemType,
} from './payroll-api.js';

// MH-53 Danh mục lương và biểu thuế (P08-11, BR-44, YCTD-60): kế toán khai phụ cấp, thưởng, khấu trừ chung toàn trường;
// kế toán trưởng thêm phiên bản biểu thuế thu nhập cá nhân khi luật thay đổi
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function describeLevel(type: Pick<PayItemType, 'calculation_method' | 'default_amount' | 'rate_percent'>): string {
  if (type.calculation_method === 'percent_of_base') {
    return type.rate_percent === null ? 'Gán riêng từng người' : `${type.rate_percent}%`;
  }
  return type.default_amount === null ? 'Gán riêng từng người' : formatMoney(type.default_amount);
}

function TypeForm({ onSaved }: { onSaved(message: string): void }) {
  const [kind, setKind] = useState<PayItemKind>('allowance');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [method, setMethod] = useState<PayCalculationMethod>('fixed_monthly');
  const [level, setLevel] = useState('');
  const [flag, setFlag] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      createPayItemType({
        kind,
        code,
        name,
        calculation_method: method,
        default_amount: method === 'percent_of_base' || level === '' ? null : Number(level),
        rate_percent: method === 'percent_of_base' && level !== '' ? Number(level) : null,
        is_tax_exempt: kind === 'allowance' && flag,
        is_mandatory_insurance: kind === 'deduction' && flag,
      }),
    onSuccess: (type) => {
      setCode('');
      setName('');
      setLevel('');
      onSaved(`Đã thêm ${type.name}`);
    },
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm khoản lương"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label className="text-label font-medium text-text">
          Loại khoản
          <select value={kind} onChange={(event) => setKind(event.target.value as PayItemKind)} className={selectClass}>
            <option value="allowance">Phụ cấp, thưởng</option>
            <option value="deduction">Khấu trừ</option>
          </select>
        </label>
        <TextField label="Mã khoản" value={code} onChange={(event) => setCode(event.target.value)} />
        <TextField label="Tên khoản" value={name} onChange={(event) => setName(event.target.value)} />
        <label className="text-label font-medium text-text">
          Cách tính
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as PayCalculationMethod)}
            className={selectClass}
          >
            {(Object.keys(METHOD_LABELS) as PayCalculationMethod[]).map((value) => (
              <option key={value} value={value}>
                {METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={method === 'percent_of_base' ? 'Tỷ lệ chung (%)' : 'Số tiền chung'}
          type="number"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        />
        <label className="flex items-center gap-2 text-label font-medium text-text">
          <input type="checkbox" checked={flag} onChange={(event) => setFlag(event.target.checked)} />
          {kind === 'allowance' ? 'Miễn thuế' : 'Bảo hiểm bắt buộc'}
        </label>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Thêm khoản
        </Button>
      </div>
    </form>
  );
}

function TypeRow({
  type,
  canManage,
  onChanged,
}: {
  type: PayItemType;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const toggle = useMutation({
    mutationFn: () =>
      updatePayItemType(type.id, {
        kind: type.kind,
        code: type.code,
        name: type.name,
        calculation_method: type.calculation_method,
        default_amount: type.default_amount,
        rate_percent: type.rate_percent,
        is_tax_exempt: type.is_tax_exempt,
        is_mandatory_insurance: type.is_mandatory_insurance,
        status: type.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => onChanged('Đã cập nhật khoản lương'),
  });
  return (
    <tr className="border-t border-border" aria-label={`Khoản ${type.code}`}>
      <td className="px-3 py-2">{type.kind === 'allowance' ? 'Phụ cấp, thưởng' : 'Khấu trừ'}</td>
      <td className="px-3 py-2">{type.code}</td>
      <td className="px-3 py-2 font-medium">{type.name}</td>
      <td className="px-3 py-2">{METHOD_LABELS[type.calculation_method]}</td>
      <td className="px-3 py-2">{describeLevel(type)}</td>
      <td className="px-3 py-2">
        {type.is_tax_exempt ? 'Miễn thuế' : type.is_mandatory_insurance ? 'Bảo hiểm bắt buộc' : ''}
      </td>
      <td className="px-3 py-2">{type.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
      <td className="px-3 py-2 text-right">
        {canManage ? (
          <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
            {type.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
          </Button>
        ) : null}
        {toggle.error ? <p className="text-label text-danger">{messageOf(toggle.error)}</p> : null}
      </td>
    </tr>
  );
}

function TaxTableForm({ onSaved }: { onSaved(message: string): void }) {
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [personal, setPersonal] = useState('');
  const [dependent, setDependent] = useState('');
  const [brackets, setBrackets] = useState('');
  const save = useMutation({
    mutationFn: () =>
      createTaxTable({
        effective_from: `${effectiveFrom}-01`,
        personal_deduction: Number(personal),
        dependent_deduction: Number(dependent),
        // Mỗi dòng "mức trần:thuế suất", dòng cuối chỉ có thuế suất
        brackets: brackets
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [upTo, rate] = line.includes(':') ? line.split(':') : [null, line];
            return { up_to: upTo === null ? null : Number(upTo), rate_percent: Number(rate) };
          }),
      }),
    onSuccess: () => onSaved('Đã thêm biểu thuế'),
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm biểu thuế"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <TextField
          label="Hiệu lực từ tháng"
          type="month"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
        <TextField
          label="Giảm trừ bản thân"
          type="number"
          value={personal}
          onChange={(event) => setPersonal(event.target.value)}
        />
        <TextField
          label="Giảm trừ mỗi người phụ thuộc"
          type="number"
          value={dependent}
          onChange={(event) => setDependent(event.target.value)}
        />
        <label className="text-label font-medium text-text">
          Các bậc (mỗi dòng mức trần:thuế suất, dòng cuối chỉ thuế suất)
          <textarea
            value={brackets}
            onChange={(event) => setBrackets(event.target.value)}
            rows={5}
            className="mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
          />
        </label>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Thêm biểu thuế
        </Button>
      </div>
    </form>
  );
}

export function PayItemsPage() {
  const canManageTypes = useHasPermission(PERMISSION_CODES.payItemTypeManage);
  const canManageTax = useHasPermission(PERMISSION_CODES.taxTableManage);
  const canViewPayroll = useHasPermission(PERMISSION_CODES.payrollView);
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ['pay-item-types'], queryFn: listPayItemTypes });
  const taxTables = useQuery({
    queryKey: ['tax-tables'],
    queryFn: listTaxTables,
    enabled: canViewPayroll || canManageTax,
  });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['pay-item-types'] });
    await queryClient.invalidateQueries({ queryKey: ['tax-tables'] });
    setToastMessage(message);
  };

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Danh mục lương và biểu thuế</h1>
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Khoản phụ cấp và khấu trừ"
        >
          <h2 className="text-section-title font-semibold text-text">Phụ cấp, thưởng và khấu trừ</h2>
          {canManageTypes ? <TypeForm onSaved={refresh} /> : null}
          {types.error ? <Alert tone="danger">{messageOf(types.error)}</Alert> : null}
          {types.data && types.data.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có khoản nào.</p>
          ) : null}
          {types.data && types.data.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Tên</th>
                  <th className="px-3 py-2">Cách tính</th>
                  <th className="px-3 py-2">Mức chung</th>
                  <th className="px-3 py-2">Thuế</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {types.data.map((type) => (
                  <TypeRow key={type.id} type={type} canManage={canManageTypes} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        {canViewPayroll || canManageTax ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Biểu thuế thu nhập cá nhân"
          >
            <h2 className="text-section-title font-semibold text-text">Biểu thuế thu nhập cá nhân</h2>
            {canManageTax ? <TaxTableForm onSaved={refresh} /> : null}
            {taxTables.error ? <Alert tone="danger">{messageOf(taxTables.error)}</Alert> : null}
            {(taxTables.data ?? []).map((table) => (
              <div
                key={table.id}
                className="rounded-lg border border-border p-3"
                aria-label={`Biểu thuế từ ${table.effective_from}`}
              >
                <p className="text-content font-medium text-text">
                  Hiệu lực từ {table.effective_from}: giảm trừ bản thân {formatMoney(table.personal_deduction)}, mỗi
                  người phụ thuộc {formatMoney(table.dependent_deduction)}
                </p>
                <ul className="list-disc pl-6 text-content">
                  {table.brackets.map((bracket, index) => (
                    <li key={index}>
                      {bracket.up_to === null
                        ? `Phần trên ${formatMoney(table.brackets[index - 1]?.up_to ?? 0)}`
                        : `Đến ${formatMoney(bracket.up_to)}`}
                      : {bracket.rate_percent}%
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
