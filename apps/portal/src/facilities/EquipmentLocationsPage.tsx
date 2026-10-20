import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EQUIPMENT_LOCATION_TYPES, PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createLocation,
  downloadFile,
  listLocations,
  listTargets,
  placeTargets,
  updateLocation,
  type EquipmentLocation,
  type EquipmentTarget,
} from './equipment-18g-api.js';
import { fieldErrorsOf, formatNumber, listFacilityRooms, messageOf } from './facilities-api.js';
import { SelectBox, TabBar } from './facilities-ui.js';

// 2.4 Nơi để và tem QR thiết bị (DT-18 phần 18g, YCTD-143): khai báo nơi để của đơn vị (phòng, kho, vị trí trong phòng hoặc
// kho); gán nơi để cho từng thiết bị (tài sản) và lô (số hiện có của thiết bị); chọn thiết bị, lô để in tem QR khổ A4
type Tab = 'locations' | 'targets';

const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

const LOCATION_COLUMNS: Array<DataGridColumn<EquipmentLocation>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, cell: (row) => row.code },
  { id: 'name', header: 'Tên nơi để', alwaysVisible: true, cell: (row) => <span className="font-medium">{row.name}</span> },
  { id: 'type', header: 'Loại', cell: (row) => labelOf(EQUIPMENT_LOCATION_TYPES, row.location_type) },
  { id: 'parent', header: 'Thuộc', cell: (row) => row.parent_name ?? row.room_name ?? '' },
  { id: 'unit', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'count', header: 'Số thiết bị, lô', cell: (row) => formatNumber(row.target_count) },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      row.status === 'active' ? <StatusBadge tone="success" label="Đang dùng" /> : <StatusBadge tone="neutral" label="Ngừng dùng" />,
  },
];

const TARGET_COLUMNS: Array<DataGridColumn<EquipmentTarget>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, cell: (row) => row.code },
  {
    id: 'name',
    header: 'Tên thiết bị',
    alwaysVisible: true,
    cell: (row) => (
      <>
        <span className="font-medium">{row.name}</span>
        {row.class_name ? <span className="text-label text-text-secondary"> ({row.class_name})</span> : null}
      </>
    ),
  },
  { id: 'kind', header: 'Loại', cell: (row) => (row.target_type === 'asset' ? 'Từng thiết bị' : 'Lô') },
  { id: 'quantity', header: 'Số lượng', cell: (row) => `${formatNumber(row.quantity)} ${row.unit}` },
  { id: 'location', header: 'Nơi để', cell: (row) => row.location_name ?? '' },
  { id: 'qr', header: 'Mã tem', cell: (row) => row.qr_code ?? <span className="text-text-secondary">Chưa in</span> },
  { id: 'unit', header: 'Đơn vị', cell: (row) => row.org_unit_name },
];

function LocationForm({
  orgUnitId,
  locations,
  editing,
  onDone,
}: {
  orgUnitId: string;
  locations: EquipmentLocation[];
  editing: EquipmentLocation | null;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<string>(editing?.location_type ?? 'room');
  const [roomId, setRoomId] = useState(editing?.room_id ?? '');
  const [parentId, setParentId] = useState(editing?.parent_id ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const rooms = useQuery({
    queryKey: ['facility-rooms', orgUnitId],
    queryFn: () => listFacilityRooms({ org_unit_id: orgUnitId }),
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        code,
        name,
        location_type: type,
        room_id: type === 'room' ? roomId || null : null,
        parent_id: type === 'position' ? parentId || null : null,
        note: note || null,
      };
      return editing ? updateLocation(editing.id, body) : createLocation({ ...body, org_unit_id: orgUnitId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-locations'] });
      onDone(editing ? 'Đã ghi nơi để' : 'Đã thêm nơi để');
    },
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label={editing ? 'Sửa nơi để' : 'Thêm nơi để'}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TextField label="Mã nơi để" value={code} error={errors.code} onChange={(event) => setCode(event.target.value)} />
        <TextField label="Tên nơi để" value={name} error={errors.name} onChange={(event) => setName(event.target.value)} />
        <SelectBox label="Loại nơi để" value={type} options={EQUIPMENT_LOCATION_TYPES} onChange={setType} />
        {type === 'room' ? (
          <SelectBox
            label="Phòng đã khai báo"
            value={roomId}
            options={(rooms.data?.rooms ?? []).map((room) => ({ value: room.id, label: `${room.code} – ${room.name}` }))}
            emptyLabel="Không gắn phòng"
            error={errors.room_id}
            onChange={setRoomId}
          />
        ) : null}
        {type === 'position' ? (
          <SelectBox
            label="Nằm trong"
            value={parentId}
            options={locations
              .filter((location) => location.parent_id === null && location.id !== editing?.id)
              .map((location) => ({ value: location.id, label: `${location.code} – ${location.name}` }))}
            emptyLabel="Chưa chọn"
            error={errors.parent_id}
            onChange={setParentId}
          />
        ) : null}
        <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
      </div>
    </form>
  );
}

function LocationsTab({ orgUnitId, canManage, onSaved }: { orgUnitId: string; canManage: boolean; onSaved(message: string): void }) {
  const grid = useGridSettings('equipment-locations');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EquipmentLocation | null | 'new'>(null);
  const locations = useQuery({
    queryKey: ['equipment-locations', orgUnitId],
    queryFn: () => listLocations(orgUnitId || null),
  });
  const toggle = useMutation({
    mutationFn: (location: EquipmentLocation) =>
      updateLocation(location.id, { status: location.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-locations'] });
      onSaved('Đã đổi trạng thái nơi để');
    },
  });
  const rows = (locations.data ?? []).filter((row) => matchesSearch(search, row.code, row.name));
  return (
    <div className="flex flex-col gap-4">
      {editing !== null && orgUnitId ? (
        <LocationForm
          key={editing === 'new' ? 'new' : editing.id}
          orgUnitId={orgUnitId}
          locations={locations.data ?? []}
          editing={editing === 'new' ? null : editing}
          onDone={(message) => {
            setEditing(null);
            onSaved(message);
          }}
        />
      ) : null}
      {locations.error ? <Alert tone="danger">{messageOf(locations.error)}</Alert> : null}
      {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
      <DataGrid
        label="Nơi để thiết bị"
        columns={LOCATION_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={locations.isPending}
        emptyText="Chưa có nơi để."
        search={{ label: 'Tìm theo mã, tên nơi để', value: search, onChange: setSearch }}
        toolbar={
          canManage ? (
            <Button variant="primary" disabled={!orgUnitId} onClick={() => setEditing('new')}>
              Thêm nơi để
            </Button>
          ) : null
        }
        rowActions={
          canManage
            ? (row) => (
                <div className="flex gap-2">
                  <Button variant="text" aria-label={`Sửa ${row.name}`} onClick={() => setEditing(row)}>
                    Sửa
                  </Button>
                  <Button variant="text" aria-label={`Đổi trạng thái ${row.name}`} onClick={() => toggle.mutate(row)}>
                    {row.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                  </Button>
                </div>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function TargetsTab({ orgUnitId, canManage, onSaved }: { orgUnitId: string; canManage: boolean; onSaved(message: string): void }) {
  const grid = useGridSettings('equipment-labels');
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [search, setSearch] = useState('');
  const [placeTo, setPlaceTo] = useState('');
  const locations = useQuery({
    queryKey: ['equipment-locations', orgUnitId],
    queryFn: () => listLocations(orgUnitId || null),
  });
  const filters = { org_unit_id: orgUnitId, location_id: locationId, target_type: targetType };
  const targets = useQuery({ queryKey: ['equipment-placements', filters], queryFn: () => listTargets(filters) });
  const refsOf = (rows: EquipmentTarget[]) => rows.map((row) => ({ target_type: row.target_type, id: row.id }));
  const place = useMutation({
    mutationFn: (rows: EquipmentTarget[]) => placeTargets(orgUnitId, placeTo || null, refsOf(rows)),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-placements'] });
      await queryClient.invalidateQueries({ queryKey: ['equipment-locations'] });
      onSaved(`Đã gán nơi để cho ${result.saved} thiết bị, lô`);
    },
  });
  const print = useMutation({
    mutationFn: (rows: EquipmentTarget[]) =>
      downloadFile('/api/v1/equipment-labels', { org_unit_id: orgUnitId, targets: refsOf(rows) }, 'tem-qr-thiet-bi.pdf'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-placements'] });
      onSaved('Đã tạo tệp tem QR');
    },
  });
  const activeLocations = (locations.data ?? []).filter((location) => location.status === 'active');
  const rows = (targets.data ?? []).filter((row) => matchesSearch(search, row.code, row.name, row.qr_code ?? ''));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SelectBox
          label="Nơi để"
          value={locationId}
          options={(locations.data ?? []).map((location) => ({ value: location.id, label: location.name }))}
          emptyLabel="Mọi nơi để"
          onChange={setLocationId}
        />
        <SelectBox
          label="Loại"
          value={targetType}
          options={[
            { value: 'asset', label: 'Từng thiết bị' },
            { value: 'holding', label: 'Lô' },
          ]}
          emptyLabel="Từng thiết bị và lô"
          onChange={setTargetType}
        />
        {canManage ? (
          <SelectBox
            label="Gán vào nơi để"
            value={placeTo}
            options={activeLocations.map((location) => ({ value: location.id, label: location.name }))}
            emptyLabel="Bỏ nơi để"
            onChange={setPlaceTo}
          />
        ) : null}
      </div>
      <p className="text-label text-text-secondary">
        Chọn thiết bị, lô trong bảng rồi bấm "In tem QR" để tải tệp PDF khổ A4 (3 × 8 tem mỗi trang). Mã tem cấp khi in lần đầu
        và giữ nguyên khi in lại; mã QR chỉ chứa mã tem.
      </p>
      {targets.error ? <Alert tone="danger">{messageOf(targets.error)}</Alert> : null}
      {place.error ? <Alert tone="danger">{messageOf(place.error)}</Alert> : null}
      {print.error ? <Alert tone="danger">{messageOf(print.error)}</Alert> : null}
      <DataGrid
        label="Thiết bị và tem QR"
        columns={TARGET_COLUMNS}
        rows={rows}
        getRowId={(row) => `${row.target_type}:${row.id}`}
        getRowLabel={(row) => `${row.code} ${row.name}`}
        loading={targets.isPending}
        emptyText="Không có thiết bị, lô nào."
        selectable={canManage}
        search={{ label: 'Tìm theo mã, tên, mã tem', value: search, onChange: setSearch }}
        toolbar={
          canManage
            ? (selected) => (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={selected.length === 0 || print.isPending || !orgUnitId}
                    onClick={() => print.mutate(selected)}
                  >
                    In tem QR
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={selected.length === 0 || place.isPending || !orgUnitId}
                    onClick={() => place.mutate(selected)}
                  >
                    Gán nơi để
                  </Button>
                </div>
              )
            : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

export function EquipmentLocationsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.equipmentManage);
  const unitChoice = useUnitChoice();
  const [tab, setTab] = useState<Tab>('locations');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const orgUnitId = unitChoice.selectedId ?? '';
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/equipment-locations')}</h1>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectBox
            label="Đơn vị"
            value={orgUnitId}
            options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
            onChange={unitChoice.select}
          />
        </div>
        <TabBar<Tab>
          tabs={[
            { key: 'locations', label: 'Nơi để' },
            { key: 'targets', label: 'Thiết bị và tem QR' },
          ]}
          current={tab}
          onSelect={setTab}
          label="Nơi để và tem QR"
        />
        {tab === 'locations' ? <LocationsTab orgUnitId={orgUnitId} canManage={canManage} onSaved={setToastMessage} /> : null}
        {tab === 'targets' ? <TargetsTab orgUnitId={orgUnitId} canManage={canManage} onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
