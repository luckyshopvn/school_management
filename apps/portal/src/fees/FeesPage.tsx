import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { CatalogTable } from '../catalogs/CatalogTable.js';
import { AppShell } from '../pages/AppShell.js';
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
// biểu phí, kế toán và Hiệu trưởng quản lý loại miễn giảm
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
    <CatalogTable<Service>
      title="Danh mục dịch vụ"
      rows={services}
      isPending={isPending}
      error={error}
      columns={[
        { label: 'Mã', render: (row) => row.code },
        { label: 'Tên', render: (row) => <span className="font-medium">{row.name}</span> },
        { label: 'Đơn vị tính', render: (row) => row.unit },
        { label: 'Cách tính', render: (row) => CALCULATION_METHOD_LABELS[row.calculation_method] },
        { label: 'Bắt buộc', render: (row) => (row.is_mandatory ? 'Bắt buộc' : 'Không') },
      ]}
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
  const discountTypes = useQuery({ queryKey: ['discount-types'], queryFn: listDiscountTypes });
  const empty = { code: '', name: '', calculation_method: 'percent' as const, value: '', condition_note: '' };
  const [form, setForm] = useState<{
    code: string;
    name: string;
    calculation_method: 'percent' | 'amount';
    value: string;
    condition_note: string;
  }>(empty);
  const [targets, setTargets] = useState<string[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['discount-types'] });
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
    onSuccess: async () => {
      setForm(empty);
      setTargets([]);
      await refresh();
      onChanged('Đã thêm loại miễn giảm');
    },
  });
  const toggle = useMutation({
    mutationFn: (row: DiscountType) =>
      updateDiscountType(row.id, { status: row.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã cập nhật trạng thái');
    },
  });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label="Loại miễn giảm">
      <h2 className="text-section-title font-semibold text-text">Loại miễn giảm</h2>
      {canManage ? (
        <div className="flex flex-col gap-3">
          {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <TextField
              label="Mã"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
            <TextField
              label="Tên loại miễn giảm"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <label className="text-label font-medium text-text">
              Cách tính
              <select
                value={form.calculation_method}
                onChange={(event) =>
                  setForm({ ...form, calculation_method: event.target.value as 'percent' | 'amount' })
                }
                className="mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              >
                <option value="percent">Theo phần trăm</option>
                <option value="amount">Theo số tiền</option>
              </select>
            </label>
            <TextField
              label={form.calculation_method === 'percent' ? 'Mức giảm (%)' : 'Số tiền giảm (đồng)'}
              type="number"
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
            />
          </div>
          <fieldset className="flex flex-wrap gap-4">
            <legend className="text-label font-medium text-text">Khoản áp dụng</legend>
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
          </fieldset>
          <TextField
            label="Điều kiện áp dụng"
            value={form.condition_note}
            onChange={(event) => setForm({ ...form, condition_note: event.target.value })}
          />
          <div>
            <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
              Thêm loại miễn giảm
            </Button>
          </div>
        </div>
      ) : null}
      {discountTypes.error ? <Alert tone="danger">{messageOf(discountTypes.error)}</Alert> : null}
      {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
      {discountTypes.data && discountTypes.data.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có loại miễn giảm.</p>
      ) : null}
      {discountTypes.data && discountTypes.data.length > 0 ? (
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Mức giảm</th>
              <th className="px-3 py-2">Khoản áp dụng</th>
              <th className="px-3 py-2">Điều kiện</th>
              <th className="px-3 py-2">Trạng thái</th>
              {canManage ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {discountTypes.data.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">{row.code}</td>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">
                  {row.calculation_method === 'percent' ? `${row.value}%` : formatMoney(row.value)}
                </td>
                <td className="px-3 py-2">{row.applies_to.map(targetLabel).join(', ')}</td>
                <td className="px-3 py-2">{row.condition_note ?? ''}</td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={row.status === 'active' ? 'success' : 'neutral'}
                    label={row.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
                  />
                </td>
                {canManage ? (
                  <td className="px-3 py-2 text-right">
                    <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate(row)}>
                      {row.status === 'active' ? 'Ngừng sử dụng' : 'Dùng lại'}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
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
        <h1 className="text-page-title font-bold text-text">Biểu phí và dịch vụ</h1>
        <ServicesSection
          services={services.data}
          isPending={services.isPending}
          error={services.error}
          canManage={canManageFees}
          onChanged={setToastMessage}
        />
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
