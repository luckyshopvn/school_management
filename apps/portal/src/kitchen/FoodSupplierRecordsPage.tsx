import { useCallback, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FOOD_CERTIFICATE_TYPES,
  FOOD_CERTIFICATE_VALIDITY,
  FOOD_CERTIFICATE_WARNING_DAYS,
  PERMISSION_CODES,
} from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { fieldErrorsOf } from '../facilities/facilities-api.js';
import { SelectBox } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createCertificate,
  formatDay,
  labelOf,
  listCertificates,
  openFoodSafetyFile,
  readSupplierSummary,
  updateCertificate,
  uploadFoodSafetyFile,
  type CertificateValidity,
  type SupplierCertificate,
  type SupplierSafetySummary,
} from './food-safety-api.js';
import { messageOf } from './kitchen-api.js';

// 3.4 Hồ sơ an toàn thực phẩm của nhà cung cấp (DT-18 phần 22b, YCTD-146; BR-144): bếp ghi giấy tờ của nhà cung cấp (giấy
// chứng nhận cơ sở đủ điều kiện an toàn thực phẩm, đăng ký kinh doanh, thú y, kiểm dịch, tự công bố, hợp đồng) kèm hạn hiệu
// lực và tệp quét; giấy sắp hết hạn trong 30 ngày hoặc đã hết hạn được cảnh báo; thu hồi giấy khi không còn giá trị
const VALIDITY_TONES: Record<CertificateValidity, StatusTone> = {
  valid: 'success',
  expiring: 'warning',
  expired: 'danger',
  revoked: 'neutral',
};

const COLUMNS: Array<DataGridColumn<SupplierCertificate>> = [
  {
    id: 'supplier',
    header: 'Nhà cung cấp',
    alwaysVisible: true,
    cell: (row) => <span className="font-medium">{row.supplier_name}</span>,
  },
  { id: 'type', header: 'Loại giấy', cell: (row) => labelOf(FOOD_CERTIFICATE_TYPES, row.certificate_type) },
  { id: 'number', header: 'Số', alwaysVisible: true, cell: (row) => row.number },
  { id: 'issued_by', header: 'Nơi cấp', cell: (row) => row.issued_by ?? '' },
  { id: 'issued_on', header: 'Ngày cấp', cell: (row) => formatDay(row.issued_on) },
  { id: 'expires_on', header: 'Hết hạn', cell: (row) => formatDay(row.expires_on) || 'Không thời hạn' },
  {
    id: 'days_left',
    header: 'Còn',
    cell: (row) =>
      row.days_left === null ? '' : row.days_left < 0 ? `Quá ${-row.days_left} ngày` : `${row.days_left} ngày`,
  },
  {
    id: 'validity',
    header: 'Hiệu lực',
    cell: (row) => (
      <StatusBadge tone={VALIDITY_TONES[row.validity]} label={labelOf(FOOD_CERTIFICATE_VALIDITY, row.validity)} />
    ),
  },
  {
    id: 'file',
    header: 'Tệp',
    cell: (row) =>
      row.file_id ? (
        <button
          type="button"
          className="text-link underline"
          aria-label={`Mở tệp giấy tờ ${row.number}`}
          onClick={() => void openFoodSafetyFile(row.file_id ?? '')}
        >
          {row.file_name ?? 'Mở tệp'}
        </button>
      ) : (
        ''
      ),
  },
  { id: 'scope', header: 'Phạm vi', hiddenByDefault: true, cell: (row) => row.scope_note ?? '' },
];

function SummaryTable({ rows }: { rows: SupplierSafetySummary[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
      <table className="w-full text-content" aria-label="Tổng hợp hồ sơ theo nhà cung cấp">
        <caption className="text-left font-semibold text-text">Tổng hợp theo nhà cung cấp</caption>
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Nhà cung cấp</th>
            <th>Nhóm thực phẩm</th>
            <th>Giấy ATTP</th>
            <th>Số giấy tờ</th>
            <th>Sắp hết hạn</th>
            <th>Hết hạn</th>
            <th>Hết hạn gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-2 text-text-secondary">
                Đơn vị chưa có nhà cung cấp.
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2 font-medium">
                {row.name}
                {row.status === 'inactive' ? <span className="text-text-secondary"> (ngừng dùng)</span> : null}
              </td>
              <td>{row.food_groups ?? ''}</td>
              <td>
                {row.has_valid_food_safety ? (
                  <StatusBadge tone="success" label="Có giấy ATTP còn hiệu lực" />
                ) : (
                  <StatusBadge tone="danger" label="Chưa có giấy ATTP còn hiệu lực" />
                )}
              </td>
              <td>{row.certificate_count}</td>
              <td>{row.expiring_count}</td>
              <td>{row.expired_count}</td>
              <td>{formatDay(row.nearest_expiry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CertificateForm({
  orgUnitId,
  certificate,
  suppliers,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  certificate?: SupplierCertificate;
  suppliers: SupplierSafetySummary[];
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const queryClient = useQueryClient();
  const fileInputId = useId();
  const [values, setValues] = useState({
    supplier_id: certificate?.supplier_id ?? '',
    certificate_type: certificate?.certificate_type ?? 'food_safety',
    number: certificate?.number ?? '',
    issued_by: certificate?.issued_by ?? '',
    issued_on: certificate?.issued_on ?? '',
    expires_on: certificate?.expires_on ?? '',
    scope_note: certificate?.scope_note ?? '',
    file_id: certificate?.file_id ?? '',
    file_name: certificate?.file_name ?? '',
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadFoodSafetyFile(orgUnitId, file),
    onSuccess: (file) => setValues((current) => ({ ...current, file_id: file.id, file_name: file.file_name })),
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        certificate_type: values.certificate_type,
        number: values.number,
        issued_by: values.issued_by.trim() || null,
        issued_on: values.issued_on || null,
        expires_on: values.expires_on || null,
        scope_note: values.scope_note.trim() || null,
        file_id: values.file_id || null,
      };
      return certificate
        ? updateCertificate(certificate.id, body)
        : createCertificate({ ...body, supplier_id: values.supplier_id });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['food-supplier-certificates'] });
      await queryClient.invalidateQueries({ queryKey: ['food-supplier-safety'] });
      onSaved(`Đã ghi giấy tờ số ${saved.number} của ${saved.supplier_name}`);
    },
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      aria-label={certificate ? `Sửa giấy tờ ${certificate.number}` : 'Thêm giấy tờ nhà cung cấp'}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-4">
        {certificate ? (
          <TextField label="Nhà cung cấp" value={certificate.supplier_name} disabled />
        ) : (
          <SelectBox
            label="Nhà cung cấp"
            value={values.supplier_id}
            options={suppliers
              .filter((supplier) => supplier.status === 'active')
              .map((supplier) => ({ value: supplier.id, label: supplier.name }))}
            emptyLabel="Chọn nhà cung cấp"
            error={errors.supplier_id}
            onChange={(value) => setValues({ ...values, supplier_id: value })}
          />
        )}
        <SelectBox
          label="Loại giấy"
          value={values.certificate_type}
          options={FOOD_CERTIFICATE_TYPES}
          error={errors.certificate_type}
          onChange={(value) => setValues({ ...values, certificate_type: value })}
        />
        <TextField
          label="Số giấy"
          value={values.number}
          error={errors.number}
          onChange={(event) => setValues({ ...values, number: event.target.value })}
        />
        <TextField
          label="Nơi cấp"
          value={values.issued_by}
          error={errors.issued_by}
          onChange={(event) => setValues({ ...values, issued_by: event.target.value })}
        />
        <TextField
          label="Ngày cấp"
          type="date"
          value={values.issued_on}
          error={errors.issued_on}
          onChange={(event) => setValues({ ...values, issued_on: event.target.value })}
        />
        <TextField
          label="Ngày hết hạn"
          type="date"
          value={values.expires_on}
          error={errors.expires_on}
          onChange={(event) => setValues({ ...values, expires_on: event.target.value })}
        />
        <TextField
          label="Phạm vi, mặt hàng"
          value={values.scope_note}
          error={errors.scope_note}
          onChange={(event) => setValues({ ...values, scope_note: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {values.file_id ? (
          <Button variant="text" onClick={() => void openFoodSafetyFile(values.file_id)}>
            {values.file_name || 'Tệp đã tải lên'}
          </Button>
        ) : null}
        <label htmlFor={fileInputId} className="text-label font-medium text-text">
          Tệp quét giấy tờ (PDF, ảnh; tối đa 10 MB)
        </label>
        <input
          id={fileInputId}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={upload.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              upload.mutate(file);
            }
          }}
        />
      </div>
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending || upload.isPending}>
          Ghi giấy tờ
        </Button>
        <Button variant="text" onClick={onCancel}>
          Thôi
        </Button>
      </div>
    </form>
  );
}

export function FoodSupplierRecordsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('food-supplier-certificates');
  const [supplierId, setSupplierId] = useState('');
  const [validity, setValidity] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SupplierCertificate | 'new'>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const summary = useQuery({
    queryKey: ['food-supplier-safety', orgUnitId],
    queryFn: () => readSupplierSummary(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const filters = { org_unit_id: orgUnitId, supplier_id: supplierId, validity };
  const certificates = useQuery({
    queryKey: ['food-supplier-certificates', filters],
    queryFn: () => listCertificates(filters),
    enabled: Boolean(orgUnitId),
  });
  // Cảnh báo lấy theo toàn bộ giấy tờ của đơn vị, không theo bộ lọc của lưới
  const allFilters = { org_unit_id: orgUnitId };
  const allCertificates = useQuery({
    queryKey: ['food-supplier-certificates', allFilters],
    queryFn: () => listCertificates(allFilters),
    enabled: Boolean(orgUnitId),
  });
  const revoke = useMutation({
    mutationFn: (certificate: SupplierCertificate) => updateCertificate(certificate.id, { status: 'revoked' }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['food-supplier-certificates'] });
      await queryClient.invalidateQueries({ queryKey: ['food-supplier-safety'] });
      setToastMessage(`Đã thu hồi giấy tờ số ${saved.number}`);
    },
  });
  const warnings = (allCertificates.data ?? []).filter(
    (row) => row.validity === 'expiring' || row.validity === 'expired',
  );
  const rows = (certificates.data ?? []).filter((row) =>
    matchesSearch(search, row.supplier_name, row.number, row.issued_by),
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/food-safety/supplier-records')}</h1>
        <div className="grid gap-3 md:grid-cols-3">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        </div>
        {warnings.length > 0 ? (
          <Alert tone="warning">
            <p>
              Giấy tờ sắp hết hạn trong {FOOD_CERTIFICATE_WARNING_DAYS} ngày hoặc đã hết hạn ({warnings.length}):
            </p>
            <ul className="list-disc pl-5">
              {warnings.map((row) => (
                <li key={row.id}>
                  {row.supplier_name} – {labelOf(FOOD_CERTIFICATE_TYPES, row.certificate_type)} số {row.number}:{' '}
                  {row.validity === 'expired'
                    ? `đã hết hạn ngày ${formatDay(row.expires_on)}`
                    : `hết hạn ngày ${formatDay(row.expires_on)}`}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {summary.error ? <Alert tone="danger">{messageOf(summary.error)}</Alert> : null}
        {summary.data ? <SummaryTable rows={summary.data} /> : null}
        {editing && orgUnitId ? (
          <CertificateForm
            key={editing === 'new' ? 'new' : editing.id}
            orgUnitId={orgUnitId}
            certificate={editing === 'new' ? undefined : editing}
            suppliers={summary.data ?? []}
            onCancel={() => setEditing(undefined)}
            onSaved={(message) => {
              setEditing(undefined);
              setToastMessage(message);
            }}
          />
        ) : null}
        {certificates.error ? <Alert tone="danger">{messageOf(certificates.error)}</Alert> : null}
        {revoke.error ? <Alert tone="danger">{messageOf(revoke.error)}</Alert> : null}
        <DataGrid
          label="Giấy tờ an toàn thực phẩm của nhà cung cấp"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.supplier_name} số ${row.number}`}
          loading={certificates.isPending && Boolean(orgUnitId)}
          emptyText="Chưa có giấy tờ."
          search={{ label: 'Tìm theo nhà cung cấp, số giấy, nơi cấp', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid gap-3 md:grid-cols-3">
              <SelectBox
                label="Lọc theo nhà cung cấp"
                value={supplierId}
                options={(summary.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                emptyLabel="Mọi nhà cung cấp"
                onChange={setSupplierId}
              />
              <SelectBox
                label="Hiệu lực"
                value={validity}
                options={FOOD_CERTIFICATE_VALIDITY}
                emptyLabel="Mọi hiệu lực"
                onChange={setValidity}
              />
            </div>
          }
          toolbar={
            canManage ? (
              <Button variant="primary" onClick={() => setEditing(editing === 'new' ? undefined : 'new')}>
                Thêm giấy tờ
              </Button>
            ) : null
          }
          rowActions={
            canManage
              ? (row) => (
                  <div className="flex gap-1">
                    <Button variant="text" aria-label={`Sửa giấy tờ ${row.number}`} onClick={() => setEditing(row)}>
                      Sửa
                    </Button>
                    {row.status === 'active' ? (
                      <Button
                        variant="text"
                        aria-label={`Thu hồi giấy tờ ${row.number}`}
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(row)}
                      >
                        Thu hồi
                      </Button>
                    ) : null}
                  </div>
                )
              : undefined
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
