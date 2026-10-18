import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  describeDose,
  MEDICATION_STATUS_LABELS,
  messageOf,
  openFile,
  postJson,
  PURCHASE_STATUS_LABELS,
  vietnamToday,
  type MedicationRequest,
  type MedicationStatus,
  type Medicine,
  type MedicineIssue,
  type Pharmacy,
  type PurchaseOrder,
  type PurchaseRequest,
  type ScheduleRow,
} from './medicines-api.js';

// MH-17 Thuốc và dặn thuốc (P10-02 đến P10-05, P10-09; BR-48 đến BR-50, BR-63, BR-86, BR-88; YCTD-75): y tế nhận hoặc từ
// chối yêu cầu dặn thuốc, ghi liều và bỏ liều theo khung giờ, thấy trạng thái phụ huynh đã biết bỏ liều; quản lý danh mục
// thuốc, nhà thuốc; đề nghị mua thuốc duyệt theo hạn mức, phiếu mua thuốc tăng tồn, phiếu cấp thuốc trừ tồn.
// Mọi danh sách theo lưới dữ liệu chung, tìm tại chỗ, Mở rộng tìm kiếm, Thêm mới mở biểu mẫu; từ chối nhận thuốc, bỏ liều
// và lập phiếu mua mở ngay dưới dòng (DT-16 phần 16b)
type Tab = 'requests' | 'schedule' | 'catalog' | 'purchases' | 'issues';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const money = (amount: number) => amount.toLocaleString('vi-VN');
const ACTIVE_LABELS: Record<'active' | 'inactive', string> = { active: 'Đang dùng', inactive: 'Ngừng dùng' };
const doseKeyOf = (row: ScheduleRow) => `${row.request_id}:${row.scheduled_time}`;

function NameWithClass({ name, className }: { name: string; className: string | null }) {
  return (
    <>
      {name}
      <br />
      <span className="text-text-secondary">{className ?? ''}</span>
    </>
  );
}

function StatusSelect({
  value,
  onChange,
  labels,
}: {
  value: string;
  onChange(value: string): void;
  labels: Record<string, string>;
}) {
  return (
    <label className="text-label font-medium text-text">
      Trạng thái
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">Tất cả</option>
        {Object.entries(labels).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

const SCHEDULE_COLUMNS: Array<DataGridColumn<ScheduleRow>> = [
  { id: 'scheduled_time', header: 'Giờ', cell: (row) => row.scheduled_time },
  {
    id: 'full_name',
    header: 'Học sinh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => <NameWithClass name={row.full_name} className={row.class_name} />,
  },
  { id: 'medicine_name', header: 'Thuốc', cell: (row) => row.medicine_name },
  { id: 'dosage', header: 'Liều', cell: (row) => row.dosage },
  {
    id: 'administration',
    header: 'Ghi nhận',
    cell: (row) => (row.administration ? describeDose(row.administration) : 'Chưa ghi'),
  },
];

const PURCHASE_REQUEST_COLUMNS: Array<DataGridColumn<PurchaseRequest>> = [
  {
    id: 'medicine_name',
    header: 'Thuốc',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.medicine_name,
  },
  { id: 'quantity', header: 'Số lượng', cell: (row) => `${row.quantity} ${row.unit}` },
  { id: 'estimated_amount', header: 'Dự kiến', cell: (row) => `${money(row.estimated_amount)} đ` },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      `${PURCHASE_STATUS_LABELS[row.status]}${row.status === 'pending' && row.requires_principal ? ' (Hiệu trưởng duyệt)' : ''}${row.reject_reason ? `: ${row.reject_reason}` : ''}`,
  },
];

const ORDER_COLUMNS: Array<DataGridColumn<PurchaseOrder>> = [
  { id: 'code', header: 'Mã phiếu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'order_date', header: 'Ngày mua', cell: (row) => row.order_date },
  { id: 'pharmacy_name', header: 'Nhà thuốc', cell: (row) => row.pharmacy_name },
  {
    id: 'items',
    header: 'Thuốc đã mua',
    cell: (row) =>
      row.items
        .map((item) => `${item.medicine_name}: ${item.quantity} ${item.unit} x ${money(item.unit_price)} đ`)
        .join('; '),
  },
  { id: 'total_amount', header: 'Tổng tiền', cell: (row) => `${money(row.total_amount)} đ` },
];

const ISSUE_COLUMNS: Array<DataGridColumn<MedicineIssue>> = [
  { id: 'code', header: 'Mã phiếu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'issued_at', header: 'Thời điểm', cell: (row) => new Date(row.issued_at).toLocaleString('vi-VN') },
  { id: 'medicine_name', header: 'Thuốc', cell: (row) => row.medicine_name },
  { id: 'quantity', header: 'Số lượng', cell: (row) => `${row.quantity} ${row.unit}` },
  { id: 'recipient', header: 'Người nhận', cell: (row) => row.recipient },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
];

const PHARMACY_COLUMNS: Array<DataGridColumn<Pharmacy>> = [
  { id: 'name', header: 'Tên nhà thuốc', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'phone', header: 'Điện thoại', cell: (row) => row.phone ?? '' },
  { id: 'address', header: 'Địa chỉ', cell: (row) => row.address ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => ACTIVE_LABELS[row.status] },
];

export function MedicinesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.medicineManage);
  const canApprove = useHasPermission(PERMISSION_CODES.medicinePurchaseApprove);
  const canAdminister = useHasPermission(PERMISSION_CODES.medicationAdminister);
  const [tab, setTab] = useState<Tab>(canAdminister ? 'requests' : 'purchases');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string, boolean]> = [
    ['requests', 'Dặn thuốc', canAdminister],
    ['schedule', 'Cho uống hôm nay', canAdminister],
    ['catalog', 'Danh mục thuốc', true],
    ['purchases', 'Mua thuốc', canManage || canApprove],
    ['issues', 'Cấp thuốc', canManage],
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/medicines')}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Thuốc">
          {tabs
            .filter(([, , visible]) => visible)
            .map(([code, label]) => (
              <Button
                key={code}
                role="tab"
                aria-selected={tab === code}
                variant={tab === code ? 'secondary' : 'text'}
                onClick={() => setTab(code)}
              >
                {label}
              </Button>
            ))}
        </div>
        {tab === 'requests' ? <RequestsTab onDone={setToastMessage} /> : null}
        {tab === 'schedule' ? <ScheduleTab onDone={setToastMessage} /> : null}
        {tab === 'catalog' ? <CatalogTab canManage={canManage} onDone={setToastMessage} /> : null}
        {tab === 'purchases' ? (
          <PurchasesTab canManage={canManage} canApprove={canApprove} onDone={setToastMessage} />
        ) : null}
        {tab === 'issues' ? <IssuesTab onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

function RequestsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('medication-requests');
  const [status, setStatus] = useState<MedicationStatus | ''>('pending');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<string>();
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string>();
  const requests = useQuery({
    queryKey: ['medication-requests', orgUnitId, status],
    queryFn: () =>
      requestJson<MedicationRequest[]>(
        `/api/v1/medication-requests?org_unit_id=${orgUnitId}${status ? `&status=${status}` : ''}`,
      ),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['medication-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['medication-schedule'] });
    onDone(message);
  };
  const receive = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/medication-requests/${requestId}/receive`, {}),
    onSuccess: () => refresh('Đã nhận thuốc, thuốc vào danh sách cần cho uống'),
  });
  const reject = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/medication-requests/${requestId}/reject`, { reason }),
    onSuccess: () => {
      setRejecting(undefined);
      setReason('');
      return refresh('Đã từ chối nhận thuốc và báo phụ huynh');
    },
  });
  const complete = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/medication-requests/${requestId}/complete`, {}),
    onSuccess: () => refresh('Đã kết thúc yêu cầu dặn thuốc'),
  });
  const error = [requests.error, receive.error, reject.error, complete.error, grid.error].find(Boolean);
  const columns: Array<DataGridColumn<MedicationRequest>> = [
    {
      id: 'full_name',
      header: 'Học sinh',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => <NameWithClass name={row.full_name} className={row.class_name} />,
    },
    {
      id: 'medicine',
      header: 'Thuốc',
      cell: (row) => (
        <>
          {row.medicine_name}, {row.dosage}
          {row.note ? <div className="text-text-secondary">{row.note}</div> : null}
          <div className="flex flex-wrap gap-1">
            {[...row.medicine_photo_ids, ...(row.prescription_photo_id ? [row.prescription_photo_id] : [])].map(
              (fileId, index) => (
                <Button
                  key={fileId}
                  variant="text"
                  onClick={() => void openFile(fileId).catch((cause: unknown) => setFailure(messageOf(cause)))}
                >
                  {index < row.medicine_photo_ids.length ? `Ảnh thuốc ${index + 1}` : 'Đơn thuốc'}
                </Button>
              ),
            )}
          </div>
        </>
      ),
    },
    { id: 'times', header: 'Giờ uống', cell: (row) => row.times.join(', ') },
    { id: 'period', header: 'Thời gian', cell: (row) => `${row.from_date} đến ${row.to_date}` },
    { id: 'allergy_note', header: 'Dị ứng', cell: (row) => row.allergy_note },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) =>
        `${MEDICATION_STATUS_LABELS[row.status]}${row.assigned_role === 'homeroom' ? ' (giáo viên chủ nhiệm nhận)' : ''}${row.reject_reason ? `: ${row.reject_reason}` : ''}`,
    },
    {
      id: 'administrations',
      header: 'Liều đã ghi',
      cell: (row) =>
        row.administrations.map((dose) => (
          <div key={dose.id}>
            {dose.scheduled_date} {dose.scheduled_time}: {describeDose(dose)}
          </div>
        )),
    },
  ];
  const rows = (requests.data ?? []).filter((request) =>
    matchesSearch(search, request.full_name, request.class_name, request.medicine_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      {/* Đơn vị và trạng thái chọn tập yêu cầu tải từ máy chủ nên giữ trên lưới */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <StatusSelect
          value={status}
          onChange={(value) => setStatus(value as MedicationStatus | '')}
          labels={MEDICATION_STATUS_LABELS}
        />
      </div>
      <DataGrid
        label="Danh sách dặn thuốc"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.medicine_name} của ${row.full_name}`}
        loading={requests.isLoading}
        emptyText="Không có yêu cầu dặn thuốc."
        search={{ label: 'Tìm theo học sinh, lớp, thuốc', value: search, onChange: setSearch }}
        rowActions={(row) => (
          <div className="flex flex-wrap justify-end gap-2">
            {row.status === 'pending' ? (
              <>
                <Button variant="primary" onClick={() => receive.mutate(row.id)} disabled={receive.isPending}>
                  Nhận thuốc
                </Button>
                <Button
                  onClick={() => {
                    setRejecting(row.id);
                    setReason('');
                  }}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
            {row.status === 'administering' ? (
              <Button onClick={() => complete.mutate(row.id)} disabled={complete.isPending}>
                Kết thúc
              </Button>
            ) : null}
          </div>
        )}
        renderRowDetail={(row) =>
          rejecting === row.id && row.status === 'pending' ? (
            <div
              className="flex flex-wrap items-end gap-2"
              role="group"
              aria-label={`Từ chối thuốc của ${row.full_name}`}
            >
              <TextField label="Lý do từ chối" value={reason} onChange={(event) => setReason(event.target.value)} />
              <Button onClick={() => reject.mutate(row.id)} disabled={reason === '' || reject.isPending}>
                Xác nhận từ chối
              </Button>
              <Button variant="text" onClick={() => setRejecting(undefined)}>
                Hủy
              </Button>
            </div>
          ) : null
        }
        activeRowId={rejecting}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function ScheduleTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('medication-schedule');
  const [date, setDate] = useState(vietnamToday);
  const [search, setSearch] = useState('');
  const [recordedFilter, setRecordedFilter] = useState('');
  const [skipping, setSkipping] = useState<string>();
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const schedule = useQuery({
    queryKey: ['medication-schedule', orgUnitId, date],
    queryFn: () => requestJson<ScheduleRow[]>(`/api/v1/medication-schedules?org_unit_id=${orgUnitId}&date=${date}`),
    enabled: Boolean(orgUnitId),
  });
  const record = useMutation({
    mutationFn: ({ row, skipped }: { row: ScheduleRow; skipped: boolean }) =>
      postJson('/api/v1/medication-administrations', {
        request_id: row.request_id,
        scheduled_date: row.scheduled_date,
        scheduled_time: row.scheduled_time,
        is_skipped: skipped,
        skip_reason: skipped ? (skipReasons[doseKeyOf(row)] ?? '') : null,
      }),
    onSuccess: async (_result, { skipped }) => {
      setSkipping(undefined);
      await queryClient.invalidateQueries({ queryKey: ['medication-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['medication-requests'] });
      onDone(skipped ? 'Đã ghi bỏ liều và báo phụ huynh' : 'Đã ghi liều đã cho uống');
    },
  });
  const error = [schedule.error, record.error, grid.error].find(Boolean);
  const rows = (schedule.data ?? []).filter(
    (row) =>
      (recordedFilter === '' || (recordedFilter === 'recorded') === Boolean(row.administration)) &&
      matchesSearch(search, row.full_name, row.class_name, row.medicine_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <TextField label="Ngày cho uống" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <DataGrid
        label="Danh sách liều cho uống"
        columns={SCHEDULE_COLUMNS}
        rows={rows}
        getRowId={doseKeyOf}
        getRowLabel={(row) => `${row.medicine_name} của ${row.full_name} lúc ${row.scheduled_time}`}
        loading={schedule.isLoading}
        emptyText="Không có liều cần cho uống trong ngày."
        search={{ label: 'Tìm theo học sinh, lớp, thuốc', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Ghi nhận
              <select
                value={recordedFilter}
                onChange={(event) => setRecordedFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="pending">Chưa ghi</option>
                <option value="recorded">Đã ghi</option>
              </select>
            </label>
          </div>
        }
        rowActions={(row) =>
          !row.administration && row.can_administer ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="primary"
                onClick={() => record.mutate({ row, skipped: false })}
                disabled={record.isPending}
              >
                Đã cho uống
              </Button>
              <Button onClick={() => setSkipping(doseKeyOf(row))} disabled={record.isPending}>
                Bỏ liều
              </Button>
            </div>
          ) : null
        }
        renderRowDetail={(row) => {
          const key = doseKeyOf(row);
          return skipping === key && !row.administration ? (
            <div className="flex flex-wrap items-end gap-2" role="group" aria-label={`Bỏ liều của ${row.full_name}`}>
              <TextField
                label="Lý do bỏ liều"
                value={skipReasons[key] ?? ''}
                onChange={(event) => setSkipReasons({ ...skipReasons, [key]: event.target.value })}
              />
              <Button onClick={() => record.mutate({ row, skipped: true })} disabled={record.isPending}>
                Xác nhận bỏ liều
              </Button>
              <Button variant="text" onClick={() => setSkipping(undefined)}>
                Hủy
              </Button>
            </div>
          ) : null;
        }}
        activeRowId={skipping}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function CatalogTab({ canManage, onDone }: { canManage: boolean; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('medicines');
  const pharmacyGrid = useGridSettings('pharmacies');
  const [creating, setCreating] = useState(false);
  const [creatingPharmacy, setCreatingPharmacy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pharmacyFilter, setPharmacyFilter] = useState('');
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ingredient, setIngredient] = useState('');
  const [unit, setUnit] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [stock, setStock] = useState('0');
  const [pharmacyName, setPharmacyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const medicines = useQuery({
    queryKey: ['medicines', orgUnitId],
    queryFn: () => requestJson<Medicine[]>(`/api/v1/medicines?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const pharmacies = useQuery({
    queryKey: ['pharmacies', orgUnitId],
    queryFn: () => requestJson<Pharmacy[]>(`/api/v1/pharmacies?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    await queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
    onDone(message);
  };
  const createMedicine = useMutation({
    mutationFn: () =>
      postJson('/api/v1/medicines', {
        org_unit_id: orgUnitId,
        code,
        name,
        active_ingredient: ingredient || null,
        unit,
        pharmacy_id: pharmacyId || null,
        stock_qty: Number(stock) || 0,
      }),
    onSuccess: () => {
      setCode('');
      setName('');
      setIngredient('');
      setStock('0');
      setCreating(false);
      return refresh('Đã thêm thuốc vào danh mục');
    },
  });
  const createPharmacy = useMutation({
    mutationFn: () =>
      postJson('/api/v1/pharmacies', {
        org_unit_id: orgUnitId,
        name: pharmacyName,
        phone: phone || null,
        address: address || null,
      }),
    onSuccess: () => {
      setPharmacyName('');
      setPhone('');
      setAddress('');
      setCreatingPharmacy(false);
      return refresh('Đã thêm nhà thuốc');
    },
  });
  const toggle = useMutation({
    mutationFn: (medicine: Medicine) =>
      postJson(
        `/api/v1/medicines/${medicine.id}`,
        { status: medicine.status === 'active' ? 'inactive' : 'active' },
        'PATCH',
      ),
    onSuccess: () => refresh('Đã cập nhật trạng thái thuốc'),
  });
  const error = [
    medicines.error,
    pharmacies.error,
    createMedicine.error,
    createPharmacy.error,
    toggle.error,
    grid.error,
    pharmacyGrid.error,
  ].find(Boolean);
  const columns: Array<DataGridColumn<Medicine>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'name', header: 'Tên thuốc', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'active_ingredient', header: 'Hoạt chất', cell: (row) => row.active_ingredient ?? '' },
    { id: 'unit', header: 'Đơn vị', cell: (row) => row.unit },
    { id: 'pharmacy_name', header: 'Nhà thuốc', cell: (row) => row.pharmacy_name ?? '' },
    { id: 'stock_qty', header: 'Tồn', cell: (row) => row.stock_qty },
    { id: 'status', header: 'Trạng thái', cell: (row) => ACTIVE_LABELS[row.status] },
  ];
  const rows = (medicines.data ?? []).filter(
    (medicine) =>
      (statusFilter === '' || medicine.status === statusFilter) &&
      (pharmacyFilter === '' || medicine.pharmacy_id === pharmacyFilter) &&
      matchesSearch(search, medicine.code, medicine.name, medicine.active_ingredient),
  );
  const pharmacyRows = (pharmacies.data ?? []).filter((pharmacy) =>
    matchesSearch(pharmacySearch, pharmacy.name, pharmacy.phone, pharmacy.address),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {canManage && creating ? (
        <form
          aria-label="Thêm thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMedicine.mutate();
          }}
        >
          <TextField label="Mã thuốc" value={code} onChange={(event) => setCode(event.target.value)} />
          <TextField label="Tên thuốc" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label="Hoạt chất" value={ingredient} onChange={(event) => setIngredient(event.target.value)} />
          <TextField label="Đơn vị tính" value={unit} onChange={(event) => setUnit(event.target.value)} />
          <label className="text-label font-medium text-text">
            Nhà thuốc
            <select value={pharmacyId} onChange={(event) => setPharmacyId(event.target.value)} className={selectClass}>
              <option value="">Không chọn</option>
              {(pharmacies.data ?? [])
                .filter((pharmacy) => pharmacy.status === 'active')
                .map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
            </select>
          </label>
          <TextField label="Tồn đầu" type="number" value={stock} onChange={(event) => setStock(event.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" disabled={createMedicine.isPending || !code || !name || !unit}>
              Thêm thuốc
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      <DataGrid
        label="Danh mục thuốc"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={medicines.isLoading}
        emptyText="Chưa có thuốc trong danh mục."
        search={{ label: 'Tìm theo mã, tên thuốc, hoạt chất', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatusSelect value={statusFilter} onChange={setStatusFilter} labels={ACTIVE_LABELS} />
            <label className="text-label font-medium text-text">
              Nhà thuốc
              <select
                value={pharmacyFilter}
                onChange={(event) => setPharmacyFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                {(pharmacies.data ?? []).map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          canManage && orgUnitId ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={
          canManage
            ? (row) => (
                <Button variant="text" onClick={() => toggle.mutate(row)} disabled={toggle.isPending}>
                  {row.status === 'active' ? 'Ngừng' : 'Dùng lại'}
                </Button>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />

      <h2 className="text-section-title font-semibold text-text">Nhà thuốc</h2>
      {canManage && creatingPharmacy ? (
        <form
          aria-label="Thêm nhà thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            createPharmacy.mutate();
          }}
        >
          <TextField
            label="Tên nhà thuốc"
            value={pharmacyName}
            onChange={(event) => setPharmacyName(event.target.value)}
          />
          <TextField label="Điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <TextField label="Địa chỉ" value={address} onChange={(event) => setAddress(event.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" disabled={createPharmacy.isPending || !pharmacyName}>
              Thêm nhà thuốc
            </Button>
            <Button variant="text" onClick={() => setCreatingPharmacy(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      <DataGrid
        label="Danh sách nhà thuốc"
        columns={PHARMACY_COLUMNS}
        rows={pharmacyRows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={pharmacies.isLoading}
        emptyText="Chưa có nhà thuốc."
        search={{ label: 'Tìm theo tên, điện thoại, địa chỉ', value: pharmacySearch, onChange: setPharmacySearch }}
        toolbar={
          canManage && orgUnitId ? (
            <Button variant="primary" onClick={() => setCreatingPharmacy(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        settings={pharmacyGrid.settings}
        onSettingsChange={pharmacyGrid.update}
      />
    </div>
  );
}

function PurchasesTab({
  canManage,
  canApprove,
  onDone,
}: {
  canManage: boolean;
  canApprove: boolean;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('medicine-purchase-requests');
  const orderGrid = useGridSettings('medicine-purchase-orders');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [ordering, setOrdering] = useState<PurchaseRequest>();
  const [pharmacyId, setPharmacyId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const medicines = useQuery({
    queryKey: ['medicines', orgUnitId],
    queryFn: () => requestJson<Medicine[]>(`/api/v1/medicines?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const pharmacies = useQuery({
    queryKey: ['pharmacies', orgUnitId],
    queryFn: () => requestJson<Pharmacy[]>(`/api/v1/pharmacies?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const requests = useQuery({
    queryKey: ['medicine-purchase-requests', orgUnitId],
    queryFn: () => requestJson<PurchaseRequest[]>(`/api/v1/medicine-purchase-requests?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const orders = useQuery({
    queryKey: ['medicine-purchase-orders', orgUnitId],
    queryFn: () => requestJson<PurchaseOrder[]>(`/api/v1/medicine-purchase-orders?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    for (const key of ['medicine-purchase-requests', 'medicine-purchase-orders', 'medicines']) {
      await queryClient.invalidateQueries({ queryKey: [key] });
    }
    onDone(message);
  };
  const createRequest = useMutation({
    mutationFn: () =>
      postJson('/api/v1/medicine-purchase-requests', {
        medicine_id: medicineId,
        quantity: Number(quantity),
        estimated_unit_price: Number(price),
        reason,
      }),
    onSuccess: () => {
      setQuantity('');
      setPrice('');
      setReason('');
      setCreating(false);
      return refresh('Đã gửi đề nghị mua thuốc chờ duyệt');
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson(
        `/api/v1/medicine-purchase-requests/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason: rejectReason },
      ),
    onSuccess: (_result, { approve }) => {
      setRejectReason('');
      return refresh(approve ? 'Đã duyệt đề nghị mua thuốc' : 'Đã từ chối đề nghị mua thuốc');
    },
  });
  const createOrder = useMutation({
    mutationFn: (request: PurchaseRequest) =>
      postJson<PurchaseOrder>('/api/v1/medicine-purchase-orders', {
        request_id: request.id,
        pharmacy_id: pharmacyId,
        items: [{ medicine_id: request.medicine_id, quantity: Number(orderQuantity), unit_price: Number(orderPrice) }],
      }),
    onSuccess: (order) => {
      setOrdering(undefined);
      return refresh(`Đã lập phiếu mua thuốc ${order.code}, số lượng thuốc đã tăng`);
    },
  });
  const error = [
    requests.error,
    orders.error,
    createRequest.error,
    decide.error,
    createOrder.error,
    grid.error,
    orderGrid.error,
  ].find(Boolean);
  const rows = (requests.data ?? []).filter(
    (request) =>
      (statusFilter === '' || request.status === statusFilter) &&
      matchesSearch(search, request.medicine_name, request.reason),
  );
  const orderRows = (orders.data ?? []).filter((order) =>
    matchesSearch(orderSearch, order.code, order.pharmacy_name, ...order.items.map((item) => item.medicine_name)),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {canManage && creating ? (
        <form
          aria-label="Đề nghị mua thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            createRequest.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Thuốc cần mua
            <select value={medicineId} onChange={(event) => setMedicineId(event.target.value)} className={selectClass}>
              <option value="">Chọn thuốc</option>
              {(medicines.data ?? []).map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name} (còn {medicine.stock_qty} {medicine.unit})
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Số lượng"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextField
            label="Đơn giá dự kiến"
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <TextField label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={createRequest.isPending || !medicineId || !quantity || price === '' || !reason}
            >
              Gửi đề nghị
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      {canApprove ? (
        <TextField
          label="Lý do từ chối đề nghị"
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      ) : null}
      <DataGrid
        label="Danh sách đề nghị mua thuốc"
        columns={PURCHASE_REQUEST_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.medicine_name}
        loading={requests.isLoading}
        emptyText="Chưa có đề nghị mua thuốc."
        search={{ label: 'Tìm theo thuốc, lý do', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatusSelect value={statusFilter} onChange={setStatusFilter} labels={PURCHASE_STATUS_LABELS} />
          </div>
        }
        toolbar={
          canManage && orgUnitId ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(row) => (
          <div className="flex flex-wrap justify-end gap-2">
            {canApprove && row.status === 'pending' ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => decide.mutate({ id: row.id, approve: true })}
                  disabled={decide.isPending}
                >
                  Duyệt
                </Button>
                <Button
                  onClick={() => decide.mutate({ id: row.id, approve: false })}
                  disabled={decide.isPending || !rejectReason}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
            {canManage && row.status === 'approved' && ordering?.id !== row.id ? (
              <Button
                onClick={() => {
                  setOrdering(row);
                  setOrderQuantity(String(row.quantity));
                  setOrderPrice(String(row.estimated_unit_price));
                }}
              >
                Lập phiếu mua
              </Button>
            ) : null}
          </div>
        )}
        renderRowDetail={(row) =>
          canManage && row.status === 'approved' && ordering?.id === row.id ? (
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-5"
              role="group"
              aria-label={`Lập phiếu mua ${row.medicine_name}`}
            >
              <label className="text-label font-medium text-text">
                Nhà thuốc mua
                <select
                  value={pharmacyId}
                  onChange={(event) => setPharmacyId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Chọn nhà thuốc</option>
                  {(pharmacies.data ?? [])
                    .filter((pharmacy) => pharmacy.status === 'active')
                    .map((pharmacy) => (
                      <option key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.name}
                      </option>
                    ))}
                </select>
              </label>
              <TextField
                label="Số lượng đã mua"
                type="number"
                value={orderQuantity}
                onChange={(event) => setOrderQuantity(event.target.value)}
              />
              <TextField
                label="Đơn giá"
                type="number"
                value={orderPrice}
                onChange={(event) => setOrderPrice(event.target.value)}
              />
              <div className="flex items-end gap-2">
                <Button
                  variant="primary"
                  onClick={() => createOrder.mutate(row)}
                  disabled={createOrder.isPending || !pharmacyId || !orderQuantity || orderPrice === ''}
                >
                  Ghi thuốc đã mua
                </Button>
                <Button variant="text" onClick={() => setOrdering(undefined)}>
                  Hủy
                </Button>
              </div>
            </div>
          ) : null
        }
        activeRowId={ordering?.id}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />

      <h2 className="text-section-title font-semibold text-text">Phiếu mua thuốc</h2>
      <DataGrid
        label="Danh sách phiếu mua thuốc"
        columns={ORDER_COLUMNS}
        rows={orderRows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.code}
        loading={orders.isLoading}
        emptyText="Chưa có phiếu mua thuốc."
        search={{ label: 'Tìm theo mã phiếu, nhà thuốc, thuốc', value: orderSearch, onChange: setOrderSearch }}
        settings={orderGrid.settings}
        onSettingsChange={orderGrid.update}
      />
    </div>
  );
}

function IssuesTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('medicine-issues');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const medicines = useQuery({
    queryKey: ['medicines', orgUnitId],
    queryFn: () => requestJson<Medicine[]>(`/api/v1/medicines?org_unit_id=${orgUnitId}&status=active`),
    enabled: Boolean(orgUnitId),
  });
  const issues = useQuery({
    queryKey: ['medicine-issues', orgUnitId],
    queryFn: () => requestJson<MedicineIssue[]>(`/api/v1/medicine-issues?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const issue = useMutation({
    mutationFn: () =>
      postJson<MedicineIssue>('/api/v1/medicine-issues', {
        medicine_id: medicineId,
        quantity: Number(quantity),
        recipient,
        reason,
      }),
    onSuccess: async (created) => {
      setQuantity('');
      setRecipient('');
      setReason('');
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['medicine-issues'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
      onDone(`Đã lập phiếu cấp thuốc ${created.code}`);
    },
  });
  const error = [medicines.error, issues.error, issue.error, grid.error].find(Boolean);
  const rows = (issues.data ?? []).filter((row) =>
    matchesSearch(search, row.code, row.medicine_name, row.recipient, row.reason),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {creating ? (
        <form
          aria-label="Cấp thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            issue.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Thuốc cấp
            <select value={medicineId} onChange={(event) => setMedicineId(event.target.value)} className={selectClass}>
              <option value="">Chọn thuốc</option>
              {(medicines.data ?? []).map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name} (còn {medicine.stock_qty} {medicine.unit})
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Số lượng cấp"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextField label="Người nhận" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
          <TextField label="Lý do cấp" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={issue.isPending || !medicineId || !quantity || !recipient || !reason}
            >
              Cấp thuốc
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      <DataGrid
        label="Danh sách phiếu cấp thuốc"
        columns={ISSUE_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.code}
        loading={issues.isLoading}
        emptyText="Chưa có phiếu cấp thuốc."
        search={{ label: 'Tìm theo mã phiếu, thuốc, người nhận', value: search, onChange: setSearch }}
        toolbar={
          orgUnitId ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}
