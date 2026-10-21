import { useCallback, useId, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FOOD_CHECK_RESULTS,
  FOOD_LOT_CATEGORIES,
  FOOD_LOT_STATUSES,
  FOOD_REJECTION_ACTIONS,
  FOOD_STORAGE_CONDITIONS,
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
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addDays,
  clockTime,
  closeLot,
  createLot,
  formatDay,
  labelOf,
  listLots,
  openFoodSafetyFile,
  readLot,
  updateLot,
  uploadFoodSafetyFile,
  type ExpiryState,
  type FoodLot,
  type FoodLotDetail,
  type LotStatus,
} from './food-safety-api.js';
import { MEAL_LABELS, messageOf, vietnamToday, type Ingredient, type Supplier } from './kitchen-api.js';

// 3.3 Lô hàng nhập (DT-18 phần 22b, YCTD-146; BR-145): lô tạo khi xác nhận nhập phiếu đi chợ (mỗi dòng một lô) hoặc nhập tay
// (hàng giao theo hợp đồng, tài trợ). Lô chờ kiểm tra sửa được mọi thông tin; lô đã kiểm tra bước 1 chỉ sửa số chứng từ, tệp
// chứng từ, ghi chú. Lô đạt đóng được khi dùng hết hoặc hủy (kèm lý do). Xem kết quả kiểm tra bước 1 và các món đã dùng lô
const STATUS_TONES: Record<LotStatus, StatusTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  used_up: 'neutral',
  disposed: 'neutral',
};

const EXPIRY_LABELS: Partial<Record<ExpiryState, { label: string; tone: StatusTone }>> = {
  expiring: { label: 'Sắp hết hạn', tone: 'warning' },
  expired: { label: 'Đã hết hạn', tone: 'danger' },
};

const COLUMNS: Array<DataGridColumn<FoodLot>> = [
  { id: 'code', header: 'Mã lô', alwaysVisible: true, cell: (row) => <span className="font-medium">{row.code}</span> },
  { id: 'ingredient', header: 'Nguyên liệu', alwaysVisible: true, cell: (row) => row.ingredient_name },
  { id: 'supplier', header: 'Nhà cung cấp', cell: (row) => row.supplier_name },
  {
    id: 'received',
    header: 'Ngày nhập',
    cell: (row) => `${formatDay(row.received_date)} ${clockTime(row.received_time)}`.trim(),
  },
  { id: 'quantity', header: 'Khối lượng', cell: (row) => `${row.quantity.toLocaleString('vi-VN')} ${row.unit}` },
  { id: 'lot_number', header: 'Số lô', cell: (row) => row.lot_number ?? '' },
  {
    id: 'expiry',
    header: 'Hạn dùng',
    cell: (row) => {
      const warning = ['pending', 'accepted'].includes(row.status) ? EXPIRY_LABELS[row.expiry_state] : undefined;
      return (
        <span className="flex flex-wrap items-center gap-1">
          {formatDay(row.expiry_date)}
          {warning ? <StatusBadge tone={warning.tone} label={warning.label} /> : null}
        </span>
      );
    },
  },
  { id: 'document', header: 'Chứng từ', cell: (row) => row.document_number ?? '' },
  { id: 'purchase', header: 'Phiếu đi chợ', cell: (row) => row.purchase_code ?? '' },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={labelOf(FOOD_LOT_STATUSES, row.status)} />,
  },
];

// Các trường của lô theo thứ tự trên biểu mẫu; trường sửa được sau kiểm tra bước 1 đánh dấu document
const TEXT_FIELDS = [
  ['deliverer_name', 'Người giao hàng'],
  ['manufacturer', 'Cơ sở sản xuất'],
  ['manufacturer_address', 'Địa chỉ cơ sở sản xuất'],
  ['lot_number', 'Số lô'],
  ['veterinary_certificate', 'Giấy chứng nhận thú y'],
  ['quarantine_certificate', 'Giấy chứng nhận kiểm dịch'],
] as const;

interface LotFormValues {
  ingredient_id: string;
  supplier_id: string;
  quantity: string;
  food_category: string;
  received_date: string;
  received_time: string;
  deliverer_name: string;
  manufacturer: string;
  manufacturer_address: string;
  lot_number: string;
  production_date: string;
  expiry_date: string;
  storage_condition: string;
  document_number: string;
  document_file_id: string;
  document_file_name: string;
  veterinary_certificate: string;
  quarantine_certificate: string;
  note: string;
}

function valuesOf(lot: FoodLot | undefined): LotFormValues {
  return {
    ingredient_id: lot?.ingredient_id ?? '',
    supplier_id: lot?.supplier_id ?? '',
    quantity: lot ? String(lot.quantity) : '',
    food_category: lot?.food_category ?? 'fresh',
    received_date: lot?.received_date ?? vietnamToday(),
    received_time: clockTime(lot?.received_time),
    deliverer_name: lot?.deliverer_name ?? '',
    manufacturer: lot?.manufacturer ?? '',
    manufacturer_address: lot?.manufacturer_address ?? '',
    lot_number: lot?.lot_number ?? '',
    production_date: lot?.production_date ?? '',
    expiry_date: lot?.expiry_date ?? '',
    storage_condition: lot?.storage_condition ?? '',
    document_number: lot?.document_number ?? '',
    document_file_id: lot?.document_file_id ?? '',
    document_file_name: lot?.document_file_name ?? '',
    veterinary_certificate: lot?.veterinary_certificate ?? '',
    quarantine_certificate: lot?.quarantine_certificate ?? '',
    note: lot?.note ?? '',
  };
}

function LotForm({
  orgUnitId,
  lot,
  canManage,
  onSaved,
}: {
  orgUnitId: string;
  lot?: FoodLotDetail;
  canManage: boolean;
  onSaved(lot: FoodLotDetail, message: string): void;
}) {
  const queryClient = useQueryClient();
  const fileInputId = useId();
  const [values, setValues] = useState(() => valuesOf(lot));
  const creating = lot === undefined;
  // Lô đã kiểm tra bước 1 chỉ sửa chứng từ, tệp chứng từ, ghi chú (BR-145)
  const documentOnly = lot !== undefined && lot.status !== 'pending';
  const locked = !canManage || documentOnly;
  const ingredients = useQuery({
    queryKey: ['kitchen-ingredients', orgUnitId],
    queryFn: () => requestJson<Ingredient[]>(`/api/v1/ingredients?org_unit_id=${orgUnitId}`),
    enabled: creating,
  });
  const suppliers = useQuery({
    queryKey: ['kitchen-suppliers', orgUnitId],
    queryFn: () => requestJson<Supplier[]>(`/api/v1/food-suppliers?org_unit_id=${orgUnitId}`),
    enabled: creating,
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadFoodSafetyFile(orgUnitId, file),
    onSuccess: (file) =>
      setValues((current) => ({ ...current, document_file_id: file.id, document_file_name: file.file_name })),
  });
  const text = (value: string) => value.trim() || null;
  const body = (): Record<string, unknown> => {
    const documentPart = {
      document_number: text(values.document_number),
      document_file_id: values.document_file_id || null,
      note: text(values.note),
    };
    if (documentOnly) {
      return documentPart;
    }
    return {
      ...documentPart,
      food_category: values.food_category,
      received_date: values.received_date,
      received_time: values.received_time || null,
      ...(creating || lot.purchase_item_id === null
        ? { quantity: values.quantity === '' ? null : Number(values.quantity) }
        : {}),
      ...Object.fromEntries(TEXT_FIELDS.map(([field]) => [field, text(values[field])])),
      production_date: values.production_date || null,
      expiry_date: values.expiry_date || null,
      storage_condition: values.storage_condition || null,
    };
  };
  const save = useMutation({
    mutationFn: () =>
      creating
        ? createLot({
            ...body(),
            org_unit_id: orgUnitId,
            ingredient_id: values.ingredient_id,
            supplier_id: values.supplier_id,
          })
        : updateLot(lot.id, body()),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['food-lots'] });
      await queryClient.invalidateQueries({ queryKey: ['food-lot', saved.id] });
      onSaved(saved, creating ? `Đã thêm lô ${saved.code}` : `Đã ghi lô ${saved.code}`);
    },
  });
  const errors = fieldErrorsOf(save.error);
  const set = (field: keyof LotFormValues) => (event: { target: { value: string } }) =>
    setValues({ ...values, [field]: event.target.value });
  return (
    <form
      aria-label={creating ? 'Thêm lô hàng' : `Thông tin lô ${lot.code}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {documentOnly && canManage ? (
        <p className="text-label text-text-secondary">
          Lô đã kiểm tra bước 1 chỉ sửa được số chứng từ, tệp chứng từ và ghi chú.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        {creating ? (
          <>
            <SelectBox
              label="Nguyên liệu"
              value={values.ingredient_id}
              options={(ingredients.data ?? [])
                .filter((item) => item.status === 'active')
                .map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))}
              emptyLabel="Chọn nguyên liệu"
              error={errors.ingredient_id}
              onChange={(value) => setValues({ ...values, ingredient_id: value })}
            />
            <SelectBox
              label="Nhà cung cấp"
              value={values.supplier_id}
              options={(suppliers.data ?? [])
                .filter((item) => item.status === 'active')
                .map((item) => ({ value: item.id, label: item.name }))}
              emptyLabel="Chọn nhà cung cấp"
              error={errors.supplier_id}
              onChange={(value) => setValues({ ...values, supplier_id: value })}
            />
          </>
        ) : null}
        <TextField
          label={creating ? 'Khối lượng' : `Khối lượng (${lot.unit})`}
          type="number"
          step="0.001"
          min={0}
          value={values.quantity}
          error={errors.quantity}
          disabled={locked || (!creating && lot.purchase_item_id !== null)}
          onChange={set('quantity')}
        />
        {locked ? (
          <TextField label="Nhóm thực phẩm" value={labelOf(FOOD_LOT_CATEGORIES, values.food_category)} disabled />
        ) : (
          <SelectBox
            label="Nhóm thực phẩm"
            value={values.food_category}
            options={FOOD_LOT_CATEGORIES}
            error={errors.food_category}
            onChange={(value) => setValues({ ...values, food_category: value })}
          />
        )}
        <TextField
          label="Ngày nhập"
          type="date"
          value={values.received_date}
          error={errors.received_date}
          disabled={locked}
          onChange={set('received_date')}
        />
        <TextField
          label="Giờ nhập"
          type="time"
          value={values.received_time}
          error={errors.received_time}
          disabled={locked}
          onChange={set('received_time')}
        />
        {TEXT_FIELDS.map(([field, label]) => (
          <TextField
            key={field}
            label={label}
            value={values[field]}
            error={errors[field]}
            disabled={locked}
            onChange={set(field)}
          />
        ))}
        <TextField
          label="Ngày sản xuất"
          type="date"
          value={values.production_date}
          error={errors.production_date}
          disabled={locked}
          onChange={set('production_date')}
        />
        <TextField
          label="Hạn dùng"
          type="date"
          value={values.expiry_date}
          error={errors.expiry_date}
          disabled={locked}
          onChange={set('expiry_date')}
        />
        {locked ? (
          <TextField
            label="Điều kiện bảo quản"
            value={labelOf(FOOD_STORAGE_CONDITIONS, values.storage_condition)}
            disabled
          />
        ) : (
          <SelectBox
            label="Điều kiện bảo quản"
            value={values.storage_condition}
            options={FOOD_STORAGE_CONDITIONS}
            emptyLabel="Chưa ghi"
            error={errors.storage_condition}
            onChange={(value) => setValues({ ...values, storage_condition: value })}
          />
        )}
        <TextField
          label="Số chứng từ"
          value={values.document_number}
          error={errors.document_number}
          disabled={!canManage}
          onChange={set('document_number')}
        />
        <TextField
          label="Ghi chú"
          value={values.note}
          error={errors.note}
          disabled={!canManage}
          onChange={set('note')}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {values.document_file_id ? (
          <Button
            variant="text"
            onClick={() => void openFoodSafetyFile(values.document_file_id)}
            aria-label={`Mở tệp chứng từ ${values.document_file_name}`}
          >
            {values.document_file_name || 'Tệp chứng từ'}
          </Button>
        ) : null}
        {canManage ? (
          <>
            <label htmlFor={fileInputId} className="text-label font-medium text-text">
              Tệp chứng từ (PDF, ảnh; tối đa 10 MB)
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
          </>
        ) : null}
      </div>
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {canManage ? (
        <div>
          <Button type="submit" variant="primary" disabled={save.isPending || upload.isPending}>
            Ghi lô
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function LotDetail({
  id,
  orgUnitId,
  canManage,
  onClose,
  onMessage,
}: {
  id: string;
  orgUnitId: string;
  canManage: boolean;
  onClose(): void;
  onMessage(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [handlingNote, setHandlingNote] = useState('');
  const detail = useQuery({ queryKey: ['food-lot', id], queryFn: () => readLot(id) });
  const close = useMutation({
    mutationFn: (status: 'used_up' | 'disposed') =>
      closeLot(id, status, status === 'disposed' ? handlingNote.trim() || null : null),
    onSuccess: async (lot) => {
      await queryClient.invalidateQueries({ queryKey: ['food-lots'] });
      await queryClient.invalidateQueries({ queryKey: ['food-lot', id] });
      onMessage(`Lô ${lot.code}: ${labelOf(FOOD_LOT_STATUSES, lot.status)}`);
    },
  });
  if (!detail.data) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : <p aria-busy="true">Đang tải…</p>;
  }
  const lot = detail.data;
  const inspection = lot.inspection;
  return (
    <section aria-label={`Lô ${lot.code}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="text" onClick={onClose}>
          Đóng
        </Button>
        <h2 className="text-section-title font-semibold text-text">
          Lô {lot.code} – {lot.ingredient_name}
        </h2>
        <StatusBadge tone={STATUS_TONES[lot.status]} label={labelOf(FOOD_LOT_STATUSES, lot.status)} />
      </div>
      <p className="text-content text-text-secondary">
        Nhà cung cấp {lot.supplier_name}
        {lot.supplier_address ? `, ${lot.supplier_address}` : ''}
        {lot.supplier_phone ? `, điện thoại ${lot.supplier_phone}` : ''}
        {lot.purchase_code ? `; phiếu đi chợ ${lot.purchase_code}` : '; nhập tay'}
      </p>
      {lot.status === 'rejected' ? (
        <Alert tone="danger">
          Không đạt: {labelOf(FOOD_REJECTION_ACTIONS, lot.rejection_action)}
          {lot.handling_note ? ` – ${lot.handling_note}` : ''}
        </Alert>
      ) : null}
      {lot.status === 'disposed' && lot.handling_note ? (
        <Alert tone="warning">Đã hủy: {lot.handling_note}</Alert>
      ) : null}
      <div className="rounded-xl border border-border bg-card p-4 text-content">
        <h3 className="font-semibold text-text">Kiểm tra trước khi chế biến (bước 1)</h3>
        {inspection ? (
          <p>
            Ngày {formatDay(inspection.inspection_date)}, người kiểm tra {inspection.inspector_name}; cảm quan:{' '}
            {labelOf(FOOD_CHECK_RESULTS, inspection.sensory_result) || 'chưa ghi'}; xét nghiệm nhanh:{' '}
            {labelOf(FOOD_CHECK_RESULTS, inspection.rapid_test_result) || 'không làm'}
            {inspection.action ? `; xử lý: ${inspection.action}` : ''}
            {inspection.inspection_status === 'draft' ? ' (phiếu chưa xác nhận)' : ''}
          </p>
        ) : (
          <p className="text-text-secondary">Lô chưa có trong phiếu kiểm tra bước 1.</p>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-content">
        <h3 className="font-semibold text-text">Món đã dùng lô</h3>
        {lot.usage.length === 0 ? (
          <p className="text-text-secondary">Chưa có món nào ghi dùng lô này ở bước 2.</p>
        ) : (
          <table className="w-full" aria-label={`Món đã dùng lô ${lot.code}`}>
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Ngày</th>
                <th>Bữa</th>
                <th>Món</th>
                <th>Số suất</th>
              </tr>
            </thead>
            <tbody>
              {lot.usage.map((usage, index) => (
                <tr key={index} className="border-t border-border">
                  <td className="py-2">{formatDay(usage.inspection_date)}</td>
                  <td>{usage.meal_type ? MEAL_LABELS[usage.meal_type] : ''}</td>
                  <td>{usage.dish_name ?? ''}</td>
                  <td>{usage.servings ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {canManage && lot.status === 'accepted' ? (
        <div className="flex flex-wrap items-end gap-2">
          <Button disabled={close.isPending} onClick={() => close.mutate('used_up')}>
            Đã dùng hết
          </Button>
          <TextField
            label="Lý do và cách hủy lô"
            value={handlingNote}
            onChange={(event) => setHandlingNote(event.target.value)}
          />
          <Button
            variant="danger"
            disabled={close.isPending || !handlingNote.trim()}
            onClick={() => close.mutate('disposed')}
          >
            Hủy lô
          </Button>
        </div>
      ) : null}
      {close.error ? <Alert tone="danger">{messageOf(close.error)}</Alert> : null}
      <LotForm
        key={`${lot.id}-${lot.status}`}
        orgUnitId={orgUnitId}
        lot={lot}
        canManage={canManage}
        onSaved={(_saved, message) => onMessage(message)}
      />
    </section>
  );
}

export function FoodLotsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('food-lots');
  const today = vietnamToday();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState('');
  const [expiry, setExpiry] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  // Mở thẳng một lô từ liên kết (phiếu đi chợ): /food-safety/lots?lot_id=...
  const linked: { lot_id?: string } = useSearch({ strict: false });
  const [selectedId, setSelectedId] = useState<string | undefined>(linked.lot_id);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filters = { org_unit_id: orgUnitId, from, to, status, expiry };
  const list = useQuery({
    queryKey: ['food-lots', filters],
    queryFn: () => listLots(filters),
    enabled: Boolean(orgUnitId),
  });
  const rows = (list.data ?? []).filter((row) =>
    matchesSearch(search, row.code, row.ingredient_name, row.supplier_name, row.lot_number, row.document_number),
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/food-safety/lots')}</h1>
        <div className="grid gap-3 md:grid-cols-5">
          <UnitSelect
            units={unitChoice.units}
            selectedId={orgUnitId}
            onSelect={(id) => {
              unitChoice.select(id);
              setSelectedId(undefined);
            }}
          />
          <TextField label="Nhập từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <TextField label="Nhập đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <SelectBox
            label="Trạng thái"
            value={status}
            options={FOOD_LOT_STATUSES}
            emptyLabel="Mọi trạng thái"
            onChange={setStatus}
          />
          <SelectBox
            label="Hạn dùng"
            value={expiry}
            options={[
              { value: 'expiring', label: 'Sắp hết hạn' },
              { value: 'expired', label: 'Đã hết hạn' },
            ]}
            emptyLabel="Mọi hạn dùng"
            onChange={setExpiry}
          />
        </div>
        {creating && orgUnitId ? (
          <LotForm
            key={orgUnitId}
            orgUnitId={orgUnitId}
            canManage={canManage}
            onSaved={(lot, message) => {
              setCreating(false);
              setSelectedId(lot.id);
              setToastMessage(message);
            }}
          />
        ) : null}
        {selectedId && orgUnitId ? (
          <LotDetail
            key={selectedId}
            id={selectedId}
            orgUnitId={orgUnitId}
            canManage={canManage}
            onClose={() => setSelectedId(undefined)}
            onMessage={setToastMessage}
          />
        ) : null}
        {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
        <DataGrid
          label="Lô hàng nhập"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.code} ${row.ingredient_name}`}
          loading={list.isPending && Boolean(orgUnitId)}
          emptyText="Chưa có lô hàng trong khoảng ngày."
          search={{
            label: 'Tìm theo mã lô, nguyên liệu, nhà cung cấp, số lô, chứng từ',
            value: search,
            onChange: setSearch,
          }}
          toolbar={
            canManage ? (
              <Button
                variant="primary"
                onClick={() => {
                  setCreating(!creating);
                  setSelectedId(undefined);
                }}
              >
                Thêm lô
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <Button
              variant="text"
              aria-label={`Mở lô ${row.code}`}
              onClick={() => {
                setCreating(false);
                setSelectedId(row.id);
              }}
            >
              Mở
            </Button>
          )}
          activeRowId={selectedId}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
