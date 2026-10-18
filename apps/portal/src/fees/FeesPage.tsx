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
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { CatalogGrid } from '../catalogs/CatalogGrid.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { FeeSchedulesSection } from './FeeSchedulesSection.js';
import {
  CALCULATION_METHOD_LABELS,
  createDiscountType,
  createService,
  formatMoney,
  listDiscountTypes,
  listServices,
  updateDiscountType,
  updateService,
  type CalculationMethod,
  type DiscountType,
  type Service,
} from './fees-api.js';

// MH-04 Biểu phí và danh mục dịch vụ (P05-01, P05-02, P05-11; YCTD-49): dùng chung toàn trường; kế toán quản lý dịch vụ và
// biểu phí, kế toán và Hiệu trưởng quản lý loại miễn giảm. Danh mục dịch vụ và loại miễn giảm dùng lưới dữ liệu chung,
// biểu mẫu theo khối với nút Ghi (DT-15 phần 15f1)
const TUITION = 'tuition';

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function ServicesSection({
  services,
  isPending,
  error,
  canManage,
  onChanged,
}: {
  services: Service[] | undefined;
  isPending: boolean;
  error: unknown;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services'] });
  const methodOptions = Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => ({ value, label }));
  const mandatoryOptions = [
    { value: 'false', label: 'Không bắt buộc' },
    { value: 'true', label: 'Bắt buộc' },
  ];
  return (
    <CatalogGrid<Service>
      title="Danh mục dịch vụ"
      gridKey="services"
      rows={services}
      isPending={isPending}
      error={error}
      columns={[
        { id: 'code', header: 'Mã', cell: (row) => row.code },
        {
          id: 'name',
          header: 'Tên',
          alwaysVisible: true,
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        { id: 'unit', header: 'Đơn vị tính', cell: (row) => row.unit },
        {
          id: 'calculation_method',
          header: 'Cách tính',
          cell: (row) => CALCULATION_METHOD_LABELS[row.calculation_method],
        },
        { id: 'is_mandatory', header: 'Bắt buộc', cell: (row) => (row.is_mandatory ? 'Bắt buộc' : 'Không') },
      ]}
      searchText={(row) => `${row.code} ${row.name}`}
      getRowLabel={(row) => row.name}
      fields={[
        { key: 'code', label: 'Mã', fixedAfterCreate: true },
        { key: 'name', label: 'Tên dịch vụ' },
        { key: 'unit', label: 'Đơn vị tính' },
        { key: 'calculation_method', label: 'Cách tính', kind: 'select', options: methodOptions },
        { key: 'is_mandatory', label: 'Bắt buộc', kind: 'select', options: mandatoryOptions },
      ]}
      canManage={canManage}
      initialValues={{ code: '', name: '', unit: 'tháng', calculation_method: 'monthly', is_mandatory: 'false' }}
      valuesOf={(row) => ({
        code: row.code,
        name: row.name,
        unit: row.unit,
        calculation_method: row.calculation_method,
        is_mandatory: String(row.is_mandatory),
      })}
      onCreate={async (values) => {
        await createService({
          code: values.code ?? '',
          name: values.name ?? '',
          unit: values.unit ?? '',
          calculation_method: (values.calculation_method ?? 'monthly') as CalculationMethod,
          is_mandatory: values.is_mandatory === 'true',
        });
        await refresh();
      }}
      onUpdate={async (row, changes) => {
        await updateService(
          row.id,
          'name' in changes
            ? {
                name: changes.name,
                unit: changes.unit,
                calculation_method: changes.calculation_method as CalculationMethod,
                is_mandatory: changes.is_mandatory === 'true',
              }
            : { status: changes.status as Service['status'] },
        );
        await refresh();
      }}
      onChanged={onChanged}
    />
  );
}

function DiscountTypeForm({ services, onSaved, onCancel }: { services: Service[]; onSaved(): void; onCancel(): void }) {
  const [form, setForm] = useState<{
    code: string;
    name: string;
    calculation_method: 'percent' | 'amount';
    value: string;
    condition_note: string;
  }>({ code: '', name: '', calculation_method: 'percent', value: '', condition_note: '' });
  const [targets, setTargets] = useState<string[]>([]);
  const targetLabel = (target: string) =>
    target === TUITION ? 'Học phí chính khóa' : (services.find((service) => service.id === target)?.name ?? target);
  const create = useMutation({
    mutationFn: () =>
      createDiscountType({
        code: form.code,
        name: form.name,
        calculation_method: form.calculation_method,
        value: Number(form.value),
        applies_to: targets,
        condition_note: form.condition_note || null,
      }),
    onSuccess: onSaved,
  });
  const fieldErrors =
    create.error instanceof ApiError
      ? Object.fromEntries(create.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  return (
    <form
      noValidate
      aria-label="Thêm mới loại miễn giảm"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Thêm mới loại miễn giảm</h2>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thông tin chung">
        <FormRow label="Mã" error={fieldErrors.code}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        </FormRow>
        <FormRow label="Tên loại miễn giảm" error={fieldErrors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </FormRow>
        <FormRow label="Cách tính" error={fieldErrors.calculation_method}>
          <select
            className={FORM_CONTROL_CLASS}
            value={form.calculation_method}
            onChange={(event) => setForm({ ...form, calculation_method: event.target.value as 'percent' | 'amount' })}
          >
            <option value="percent">Theo phần trăm</option>
            <option value="amount">Theo số tiền</option>
          </select>
        </FormRow>
        <FormRow
          label={form.calculation_method === 'percent' ? 'Mức giảm (%)' : 'Số tiền giảm (đồng)'}
          error={fieldErrors.value}
        >
          <input
            className={FORM_CONTROL_CLASS}
            type="number"
            value={form.value}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
          />
        </FormRow>
        <FormRow label="Khoản áp dụng" error={fieldErrors.applies_to}>
          <div className="flex flex-wrap gap-4" role="group" aria-label="Khoản áp dụng">
            {[TUITION, ...services.filter((service) => service.status === 'active').map((service) => service.id)].map(
              (target) => (
                <label key={target} className="flex items-center gap-2 text-content">
                  <input
                    type="checkbox"
                    checked={targets.includes(target)}
                    onChange={(event) =>
                      setTargets(
                        event.target.checked ? [...targets, target] : targets.filter((value) => value !== target),
                      )
                    }
                  />
                  {targetLabel(target)}
                </label>
              ),
            )}
          </div>
        </FormRow>
        <FormRow label="Điều kiện áp dụng" error={fieldErrors.condition_note}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.condition_note}
            onChange={(event) => setForm({ ...form, condition_note: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function DiscountTypesSection({
  services,
  canManage,
  onChanged,
}: {
  services: Service[];
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('discount-types');
  const discountTypes = useQuery({ queryKey: ['discount-types'], queryFn: listDiscountTypes });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['discount-types'] });
  const targetLabel = (target: string) =>
    target === TUITION ? 'Học phí chính khóa' : (services.find((service) => service.id === target)?.name ?? target);
  const toggle = useMutation({
    mutationFn: (row: DiscountType) =>
      updateDiscountType(row.id, { status: row.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã cập nhật trạng thái');
    },
  });
  const columns: Array<DataGridColumn<DiscountType>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    {
      id: 'value',
      header: 'Mức giảm',
      cell: (row) => (row.calculation_method === 'percent' ? `${row.value}%` : formatMoney(row.value)),
    },
    { id: 'applies_to', header: 'Khoản áp dụng', cell: (row) => row.applies_to.map(targetLabel).join(', ') },
    { id: 'condition_note', header: 'Điều kiện', cell: (row) => row.condition_note ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : 'neutral'}
          label={row.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
        />
      ),
    },
  ];
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (discountTypes.data ?? []).filter(
    (row) =>
      (status === '' || row.status === status) &&
      (keyword === '' || `${row.code} ${row.name}`.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Loại miễn giảm</h2>
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <DiscountTypeForm
            services={services}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              void refresh();
              onChanged('Đã thêm loại miễn giảm');
            }}
          />
        </section>
      ) : null}
      {discountTypes.error ? <Alert tone="danger">{messageOf(discountTypes.error)}</Alert> : null}
      {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label="Loại miễn giảm"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={discountTypes.isPending}
        emptyText="Chưa có loại miễn giảm."
        search={{ label: 'Tìm theo mã, tên', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={`mt-1 ${FORM_CONTROL_CLASS}`}
              >
                <option value="">Tất cả</option>
                <option value="active">Đang dùng</option>
                <option value="inactive">Ngừng sử dụng</option>
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
        rowActions={
          canManage
            ? (row) => (
                <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate(row)}>
                  {row.status === 'active' ? 'Ngừng sử dụng' : 'Dùng lại'}
                </Button>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

export function FeesPage() {
  const canManageFees = useHasPermission(PERMISSION_CODES.feeCatalogManage);
  const canManageDiscounts = useHasPermission(PERMISSION_CODES.discountTypeManage);
  const services = useQuery({ queryKey: ['services'], queryFn: listServices });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/fees')}</h1>
        <div className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Danh mục dịch vụ</h2>
          <ServicesSection
            services={services.data}
            isPending={services.isPending}
            error={services.error}
            canManage={canManageFees}
            onChanged={setToastMessage}
          />
        </div>
        <FeeSchedulesSection services={services.data ?? []} canManage={canManageFees} onChanged={setToastMessage} />
        <DiscountTypesSection
          services={services.data ?? []}
          canManage={canManageDiscounts}
          onChanged={setToastMessage}
        />
      </div>
    </AppShell>
  );
}
