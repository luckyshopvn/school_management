import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EQUIPMENT_CONDITIONS, EQUIPMENT_STOCKTAKE_STATUSES, PERMISSION_CODES } from '@school-management/shared';
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
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createStocktake,
  downloadFile,
  listLocations,
  listStocktakes,
  readStocktake,
  returnStocktake,
  stocktakeAction,
  type StocktakeDetail,
  type StocktakeLine,
  type StocktakeListItem,
  type StocktakeStatus,
} from './equipment-18g-api.js';
import { fieldErrorsOf, formatNumber, messageOf } from './facilities-api.js';
import { SelectBox } from './facilities-ui.js';
import { RecordForm, StocktakeScanPanel } from './StocktakeScanPanel.js';

// 2.5 Kiểm kê thiết bị (DT-18 phần 18g, YCTD-143): lập đợt kiểm kê của đơn vị (cả đơn vị hoặc một nơi để), quét mã tem
// trên điện thoại (ứng dụng giáo viên hoặc trang này trên web di động), đối chiếu với sổ, nộp, duyệt hoặc trả lại, chốt chênh
// lệch, biên bản kiểm kê PDF, Excel. Người chỉ có quyền quét thấy đợt của đơn vị mình và ghi kết quả khi đợt đang kiểm kê
const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

const STATUS_TONES: Record<StocktakeStatus, StatusTone> = {
  counting: 'info',
  submitted: 'warning',
  approved: 'success',
  closed: 'neutral',
  cancelled: 'neutral',
};

const RESULT_LABELS: Record<StocktakeLine['status'], { label: string; tone: StatusTone }> = {
  unchecked: { label: 'Chưa kiểm', tone: 'neutral' },
  matched: { label: 'Khớp', tone: 'success' },
  shortage: { label: 'Thiếu', tone: 'danger' },
  surplus: { label: 'Thừa', tone: 'warning' },
};

const LIST_COLUMNS: Array<DataGridColumn<StocktakeListItem>> = [
  { id: 'code', header: 'Mã đợt', alwaysVisible: true, cell: (row) => row.code },
  {
    id: 'name',
    header: 'Tên đợt',
    alwaysVisible: true,
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  { id: 'unit', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'location', header: 'Nơi kiểm kê', cell: (row) => row.location_name ?? 'Cả đơn vị' },
  { id: 'started_on', header: 'Ngày kiểm kê', cell: (row) => row.started_on },
  { id: 'progress', header: 'Đã kiểm', cell: (row) => `${row.counted_count}/${row.line_count}` },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <StatusBadge tone={STATUS_TONES[row.status]} label={labelOf(EQUIPMENT_STOCKTAKE_STATUSES, row.status)} />
    ),
  },
];

const LINE_COLUMNS: Array<DataGridColumn<StocktakeLine>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, cell: (row) => row.code },
  {
    id: 'name',
    header: 'Tên thiết bị',
    alwaysVisible: true,
    cell: (row) => (
      <>
        <span className="font-medium">{row.name}</span>
        {row.in_scope ? null : <span className="text-label text-text-secondary"> (ngoài sổ)</span>}
      </>
    ),
  },
  { id: 'location', header: 'Nơi để theo sổ', cell: (row) => row.location_name ?? '' },
  { id: 'expected', header: 'Theo sổ', cell: (row) => formatNumber(row.expected_quantity) },
  { id: 'counted', header: 'Đếm được', cell: (row) => formatNumber(row.counted_quantity) },
  { id: 'usable', header: 'Dùng được', cell: (row) => formatNumber(row.usable_quantity) },
  { id: 'difference', header: 'Chênh lệch', cell: (row) => formatNumber(row.difference) },
  {
    id: 'result',
    header: 'Kết quả',
    cell: (row) => <StatusBadge tone={RESULT_LABELS[row.status].tone} label={RESULT_LABELS[row.status].label} />,
  },
  { id: 'condition', header: 'Tình trạng', cell: (row) => labelOf(EQUIPMENT_CONDITIONS, row.condition) },
  { id: 'found', header: 'Nơi thấy', cell: (row) => row.found_location_name ?? '' },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
];

function CreateForm({ orgUnitId, onCreated }: { orgUnitId: string; onCreated(id: string, message: string): void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [startedOn, setStartedOn] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState('');
  const [members, setMembers] = useState('');
  const [note, setNote] = useState('');
  const locations = useQuery({
    queryKey: ['equipment-locations', orgUnitId],
    queryFn: () => listLocations(orgUnitId),
  });
  const create = useMutation({
    mutationFn: () =>
      createStocktake({
        org_unit_id: orgUnitId,
        name,
        started_on: startedOn,
        location_id: locationId || null,
        members: members || null,
        note: note || null,
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-stocktakes'] });
      onCreated(created.id, `Đã lập đợt ${created.code} với ${created.line_count} dòng theo sổ`);
    },
  });
  const errors = fieldErrorsOf(create.error);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Lập đợt kiểm kê"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TextField
          label="Tên đợt kiểm kê"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Ngày kiểm kê"
          type="date"
          value={startedOn}
          error={errors.started_on}
          onChange={(event) => setStartedOn(event.target.value)}
        />
        <SelectBox
          label="Nơi kiểm kê"
          value={locationId}
          options={(locations.data ?? [])
            .filter((location) => location.parent_id === null && location.status === 'active')
            .map((location) => ({ value: location.id, label: location.name }))}
          emptyLabel="Cả đơn vị"
          onChange={setLocationId}
        />
        <TextField label="Tổ kiểm kê" value={members} onChange={(event) => setMembers(event.target.value)} />
        <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending || !orgUnitId}>
          Ghi
        </Button>
      </div>
    </form>
  );
}

function SummaryBlock({ detail }: { detail: StocktakeDetail }) {
  const summary = detail.summary;
  const items = [
    ['Đã kiểm', `${summary.counted_count}/${summary.line_count}`],
    ['Khớp sổ', summary.matched_count],
    ['Thiếu', `${summary.shortage_count} dòng (${formatNumber(summary.shortage_quantity)})`],
    ['Thừa', `${summary.surplus_count} dòng (${formatNumber(summary.surplus_quantity)})`],
    ['Ngoài sổ', summary.out_of_scope_count],
    [
      'Tỷ lệ sử dụng được',
      summary.usable_rate_percent === null ? '—' : `${formatNumber(summary.usable_rate_percent)}%`,
    ],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-6" aria-label="Tổng hợp kiểm kê">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col rounded-xl border border-border bg-card p-3">
          <dt className="text-label text-text-secondary">{label}</dt>
          <dd className="text-content font-semibold text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StocktakeDetailView({
  id,
  canManage,
  onBack,
  onMessage,
}: {
  id: string;
  canManage: boolean;
  onBack(): void;
  onMessage(message: string): void;
}) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('equipment-stocktake-lines');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [editing, setEditing] = useState<StocktakeLine>();
  const detail = useQuery({ queryKey: ['equipment-stocktake', id], queryFn: () => readStocktake(id) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['equipment-stocktake', id] });
    await queryClient.invalidateQueries({ queryKey: ['equipment-stocktakes'] });
  };
  const act = useMutation({
    mutationFn: (action: 'submit' | 'approve' | 'cancel' | 'close' | 'return') =>
      action === 'return' ? returnStocktake(id, returnNote) : stocktakeAction(id, action),
    onSuccess: async (updated) => {
      await refresh();
      onMessage(`Đợt kiểm kê: ${labelOf(EQUIPMENT_STOCKTAKE_STATUSES, updated.status)}`);
    },
  });
  const minutes = useMutation({
    mutationFn: (format: 'pdf' | 'xlsx') =>
      downloadFile(`/api/v1/equipment-stocktakes/${id}/minutes`, { format }, `bien-ban-kiem-ke.${format}`),
  });
  if (!detail.data) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : <p aria-busy="true">Đang tải…</p>;
  }
  const data = detail.data;
  const rows = data.lines.filter(
    (line) => (!result || line.status === result) && matchesSearch(search, line.code, line.name, line.qr_code ?? ''),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="text" onClick={onBack}>
          Quay lại danh sách
        </Button>
        <h2 className="text-section-title font-semibold text-text">
          {data.code} – {data.name}
        </h2>
        <StatusBadge tone={STATUS_TONES[data.status]} label={labelOf(EQUIPMENT_STOCKTAKE_STATUSES, data.status)} />
      </div>
      <p className="text-content text-text-secondary">
        {data.org_unit_name}; {data.location_name ?? 'cả đơn vị'}; ngày kiểm kê {data.started_on}
        {data.members ? `; tổ kiểm kê: ${data.members}` : ''}
      </p>
      {data.return_note && data.status === 'counting' ? (
        <Alert tone="warning">Bị trả lại: {data.return_note}</Alert>
      ) : null}
      <SummaryBlock detail={data} />
      <div className="flex flex-wrap gap-2">
        {canManage && data.status === 'counting' ? (
          <>
            <Button variant="primary" disabled={act.isPending} onClick={() => act.mutate('submit')}>
              Nộp kết quả
            </Button>
            <Button variant="text" disabled={act.isPending} onClick={() => act.mutate('cancel')}>
              Hủy đợt
            </Button>
          </>
        ) : null}
        {canManage && data.status === 'submitted' ? (
          <Button variant="primary" disabled={act.isPending} onClick={() => act.mutate('approve')}>
            Duyệt
          </Button>
        ) : null}
        {canManage && data.status === 'approved' ? (
          <Button variant="primary" disabled={act.isPending} onClick={() => act.mutate('close')}>
            Chốt chênh lệch
          </Button>
        ) : null}
        <Button variant="secondary" disabled={minutes.isPending} onClick={() => minutes.mutate('pdf')}>
          Biên bản PDF
        </Button>
        <Button variant="secondary" disabled={minutes.isPending} onClick={() => minutes.mutate('xlsx')}>
          Biên bản Excel
        </Button>
      </div>
      {canManage && (data.status === 'submitted' || data.status === 'approved') ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Lý do trả lại" value={returnNote} onChange={(event) => setReturnNote(event.target.value)} />
          <Button disabled={act.isPending || !returnNote.trim()} onClick={() => act.mutate('return')}>
            Trả lại
          </Button>
        </div>
      ) : null}
      {data.status === 'approved' ? (
        <p className="text-label text-text-secondary">
          Chốt chênh lệch: lô lấy số dùng được làm số hiện có; thiết bị thấy ở nơi khác đổi nơi để; tài sản hỏng hoặc
          không tìm thấy được lập ghi nhận hỏng, mất chờ duyệt ở Kho và tài sản.
        </p>
      ) : null}
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
      {minutes.error ? <Alert tone="danger">{messageOf(minutes.error)}</Alert> : null}
      {data.status === 'counting' ? (
        <StocktakeScanPanel
          stocktake={data}
          onRecorded={(message) => {
            void refresh();
            onMessage(message);
          }}
        />
      ) : null}
      {editing && data.status === 'counting' ? (
        <RecordForm
          key={editing.id}
          stocktake={data}
          scanned={{
            line: editing,
            qrCode: editing.qr_code,
            target: {
              target_type: editing.target_type,
              code: editing.code,
              name: editing.name,
              unit: editing.unit,
              location_name: editing.location_name,
              quantity: editing.expected_quantity,
            },
          }}
          onCancel={() => setEditing(undefined)}
          onSaved={(line) => {
            setEditing(undefined);
            void refresh();
            onMessage(`Đã ghi ${line.code} – ${line.name}`);
          }}
        />
      ) : null}
      <DataGrid
        label="Đối chiếu kiểm kê"
        columns={LINE_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.code} ${row.name}`}
        emptyText="Không có dòng nào."
        search={{ label: 'Tìm theo mã, tên, mã tem', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid gap-3 md:grid-cols-3">
            <SelectBox
              label="Kết quả"
              value={result}
              options={Object.entries(RESULT_LABELS).map(([value, item]) => ({ value, label: item.label }))}
              emptyLabel="Mọi kết quả"
              onChange={setResult}
            />
          </div>
        }
        rowActions={
          data.status === 'counting'
            ? (row) => (
                <Button variant="text" aria-label={`Ghi kết quả ${row.code}`} onClick={() => setEditing(row)}>
                  Ghi kết quả
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

export function EquipmentStocktakesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.equipmentManage);
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('equipment-stocktakes');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filters = { org_unit_id: orgUnitId, status };
  const list = useQuery({ queryKey: ['equipment-stocktakes', filters], queryFn: () => listStocktakes(filters) });
  const createUnit = orgUnitId || unitChoice.selectedId || '';
  const rows = (list.data ?? []).filter((row) => matchesSearch(search, row.code, row.name));
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/equipment-stocktakes')}</h1>
        {selectedId ? (
          <StocktakeDetailView
            id={selectedId}
            canManage={canManage}
            onBack={() => setSelectedId(undefined)}
            onMessage={setToastMessage}
          />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <SelectBox
                label="Đơn vị"
                value={orgUnitId}
                options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
                emptyLabel="Mọi đơn vị trong phạm vi"
                onChange={setOrgUnitId}
              />
              <SelectBox
                label="Trạng thái"
                value={status}
                options={EQUIPMENT_STOCKTAKE_STATUSES}
                emptyLabel="Mọi trạng thái"
                onChange={setStatus}
              />
            </div>
            {creating ? (
              <CreateForm
                orgUnitId={createUnit}
                onCreated={(id, message) => {
                  setCreating(false);
                  setSelectedId(id);
                  setToastMessage(message);
                }}
              />
            ) : null}
            {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
            <DataGrid
              label="Đợt kiểm kê thiết bị"
              columns={LIST_COLUMNS}
              rows={rows}
              getRowId={(row) => row.id}
              getRowLabel={(row) => `${row.code} ${row.name}`}
              loading={list.isPending}
              emptyText="Chưa có đợt kiểm kê."
              search={{ label: 'Tìm theo mã, tên đợt', value: search, onChange: setSearch }}
              toolbar={
                canManage ? (
                  <Button variant="primary" onClick={() => setCreating(!creating)}>
                    Lập đợt kiểm kê
                  </Button>
                ) : null
              }
              rowActions={(row) => (
                <Button variant="text" aria-label={`Mở ${row.code}`} onClick={() => setSelectedId(row.id)}>
                  Mở
                </Button>
              )}
              settings={grid.settings}
              onSettingsChange={grid.update}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
