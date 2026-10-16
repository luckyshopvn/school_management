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
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
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
// kế toán trưởng thêm phiên bản biểu thuế thu nhập cá nhân khi luật thay đổi. Giao diện chung theo Sở (DT-15 phần 15f2):
// lưới khoản lương (khóa `pay-item-types`) tìm theo mã, tên, mở rộng tìm kiếm theo loại và trạng thái; Thêm mới mở biểu
// mẫu theo khối có nút Ghi. Các phiên bản biểu thuế giữ dạng từng biểu, biểu mẫu thêm biểu thuế theo khối
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const KIND_LABELS: Record<PayItemKind, string> = { allowance: 'Phụ cấp, thưởng', deduction: 'Khấu trừ' };
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

function describeLevel(type: Pick<PayItemType, 'calculation_method' | 'default_amount' | 'rate_percent'>): string {
  if (type.calculation_method === 'percent_of_base') {
    return type.rate_percent === null ? 'Gán riêng từng người' : `${type.rate_percent}%`;
  }
  return type.default_amount === null ? 'Gán riêng từng người' : formatMoney(type.default_amount);
}

const TYPE_COLUMNS: Array<DataGridColumn<PayItemType>> = [
  { id: 'kind', header: 'Loại', cell: (row) => KIND_LABELS[row.kind] },
  { id: 'code', header: 'Mã', cell: (row) => row.code },
  { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'calculation_method', header: 'Cách tính', cell: (row) => METHOD_LABELS[row.calculation_method] },
  { id: 'level', header: 'Mức chung', cell: (row) => describeLevel(row) },
  {
    id: 'tax',
    header: 'Thuế',
    cell: (row) => (row.is_tax_exempt ? 'Miễn thuế' : row.is_mandatory_insurance ? 'Bảo hiểm bắt buộc' : ''),
  },
  { id: 'status', header: 'Trạng thái', cell: (row) => (row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng') },
];

function TypeForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
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
    onSuccess: (type) => onSaved(`Đã thêm ${type.name}`),
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
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thêm khoản lương">
        <FormRow label="Loại khoản">
          <select
            className={FORM_CONTROL_CLASS}
            value={kind}
            onChange={(event) => setKind(event.target.value as PayItemKind)}
          >
            <option value="allowance">{KIND_LABELS.allowance}</option>
            <option value="deduction">{KIND_LABELS.deduction}</option>
          </select>
        </FormRow>
        <FormRow label="Mã khoản">
          <input className={FORM_CONTROL_CLASS} value={code} onChange={(event) => setCode(event.target.value)} />
        </FormRow>
        <FormRow label="Tên khoản">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Cách tính">
          <select
            className={FORM_CONTROL_CLASS}
            value={method}
            onChange={(event) => setMethod(event.target.value as PayCalculationMethod)}
          >
            {(Object.keys(METHOD_LABELS) as PayCalculationMethod[]).map((value) => (
              <option key={value} value={value}>
                {METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label={method === 'percent_of_base' ? 'Tỷ lệ chung (%)' : 'Số tiền chung'}>
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          />
        </FormRow>
        <FormRow label={kind === 'allowance' ? 'Miễn thuế' : 'Bảo hiểm bắt buộc'}>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={flag}
            onChange={(event) => setFlag(event.target.checked)}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function TypeActions({ type, onChanged }: { type: PayItemType; onChanged(message: string): void }) {
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
    <span className="flex flex-col items-end gap-1">
      <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
        {type.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
      </Button>
      {toggle.error ? <span className="text-label text-danger">{messageOf(toggle.error)}</span> : null}
    </span>
  );
}

function TaxTableForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
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
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thêm biểu thuế">
        <FormRow label="Hiệu lực từ tháng">
          <input
            type="month"
            className={FORM_CONTROL_CLASS}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </FormRow>
        <FormRow label="Giảm trừ bản thân">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={personal}
            onChange={(event) => setPersonal(event.target.value)}
          />
        </FormRow>
        <FormRow label="Giảm trừ mỗi người phụ thuộc">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={dependent}
            onChange={(event) => setDependent(event.target.value)}
          />
        </FormRow>
        <FormRow label="Các bậc (mỗi dòng mức trần:thuế suất, dòng cuối chỉ thuế suất)">
          <textarea
            rows={5}
            className={FORM_CONTROL_CLASS}
            value={brackets}
            onChange={(event) => setBrackets(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
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
  const grid = useGridSettings('pay-item-types');
  const types = useQuery({ queryKey: ['pay-item-types'], queryFn: listPayItemTypes });
  const taxTables = useQuery({
    queryKey: ['tax-tables'],
    queryFn: listTaxTables,
    enabled: canViewPayroll || canManageTax,
  });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<PayItemKind | ''>('');
  const [status, setStatus] = useState<PayItemType['status'] | ''>('');
  const [creatingType, setCreatingType] = useState(false);
  const [creatingTax, setCreatingTax] = useState(false);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['pay-item-types'] });
    await queryClient.invalidateQueries({ queryKey: ['tax-tables'] });
    setToastMessage(message);
  };
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (types.data ?? []).filter(
    (type) =>
      (kind === '' || type.kind === kind) &&
      (status === '' || type.status === status) &&
      (keyword === '' ||
        type.code.toLocaleLowerCase('vi').includes(keyword) ||
        type.name.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/pay-items')}</h1>
        <div className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Phụ cấp, thưởng và khấu trừ</h2>
          {creatingType ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <TypeForm
                onCancel={() => setCreatingType(false)}
                onSaved={(message) => {
                  setCreatingType(false);
                  void refresh(message);
                }}
              />
            </section>
          ) : null}
          {types.error ? <Alert tone="danger">{messageOf(types.error)}</Alert> : null}
          {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
          <DataGrid
            label="Khoản phụ cấp và khấu trừ"
            columns={TYPE_COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `khoản ${row.code}`}
            getRowAriaLabel={(row) => `Khoản ${row.code}`}
            loading={types.isPending}
            emptyText="Chưa có khoản nào."
            search={{ label: 'Tìm theo mã, tên khoản', value: search, onChange: setSearch }}
            advancedSearch={
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-label font-medium text-text">
                  Loại
                  <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value as PayItemKind | '')}
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
                    onChange={(event) => setStatus(event.target.value as PayItemType['status'] | '')}
                    className={filterClass}
                  >
                    <option value="">Tất cả</option>
                    <option value="active">Đang dùng</option>
                    <option value="inactive">Ngừng dùng</option>
                  </select>
                </label>
              </div>
            }
            toolbar={
              canManageTypes ? (
                <Button variant="primary" onClick={() => setCreatingType(true)}>
                  Thêm mới
                </Button>
              ) : null
            }
            rowActions={canManageTypes ? (row) => <TypeActions type={row} onChanged={refresh} /> : undefined}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        </div>
        {canViewPayroll || canManageTax ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Biểu thuế thu nhập cá nhân"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-section-title font-semibold text-text">Biểu thuế thu nhập cá nhân</h2>
              {canManageTax && !creatingTax ? (
                <Button variant="primary" onClick={() => setCreatingTax(true)}>
                  Thêm mới
                </Button>
              ) : null}
            </div>
            {canManageTax && creatingTax ? (
              <TaxTableForm
                onCancel={() => setCreatingTax(false)}
                onSaved={(message) => {
                  setCreatingTax(false);
                  void refresh(message);
                }}
              />
            ) : null}
            {taxTables.error ? <Alert tone="danger">{messageOf(taxTables.error)}</Alert> : null}
            {taxTables.data && taxTables.data.length === 0 ? (
              <p className="text-content text-text-secondary">Chưa có biểu thuế.</p>
            ) : null}
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
