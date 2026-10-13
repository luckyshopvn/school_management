import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  ROOM_ATTRIBUTES,
  ROOM_BLOCKS,
  ROOM_CONDITIONS,
  ROOM_TYPES,
  type CodeLabel,
} from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createRoom,
  downloadExcel,
  fieldErrorsOf,
  formatNumber,
  listFacilityRooms,
  messageOf,
  updateRoom,
  type FacilityRoom,
  type ProfileValues,
  type RoomInput,
} from './facilities-api.js';
import { ProfileFieldInput, SelectBox, TabBar } from './facilities-ui.js';

// 1.1 Khai báo cơ sở vật chất (YCTD-102): phòng theo năm khối, lọc loại phòng, hiện trạng; tổng hợp theo khối và hiện
// trạng (1.2); thêm, sửa phòng kèm thuộc tính theo quy chuẩn; xuất Excel
const labelOf = (values: ReadonlyArray<CodeLabel>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

interface RoomDraft {
  org_unit_id: string;
  code: string;
  name: string;
  capacity: string;
  room_block: string;
  room_type: string;
  condition: string;
  area_m2: string;
  facility_attributes: ProfileValues;
}

const emptyDraft = (orgUnitId: string, block: string): RoomDraft => ({
  org_unit_id: orgUnitId,
  code: '',
  name: '',
  capacity: '',
  room_block: block,
  room_type: '',
  condition: '',
  area_m2: '',
  facility_attributes: {},
});

const toInput = (draft: RoomDraft): RoomInput => ({
  code: draft.code,
  name: draft.name,
  capacity: draft.capacity === '' ? Number.NaN : Number(draft.capacity),
  room_block: draft.room_block || null,
  room_type: draft.room_type || null,
  condition: draft.condition || null,
  area_m2: draft.area_m2 === '' ? null : Number(draft.area_m2),
  facility_attributes: Object.fromEntries(
    Object.entries(draft.facility_attributes).filter(([, value]) => value !== null && value !== undefined),
  ),
});

function RoomForm({
  draft,
  units,
  creating,
  error,
  pending,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: RoomDraft;
  units: Array<{ id: string; name: string }>;
  creating: boolean;
  error: unknown;
  pending: boolean;
  onChange(draft: RoomDraft): void;
  onSubmit(): void;
  onCancel(): void;
}) {
  const errors = fieldErrorsOf(error);
  const types = ROOM_TYPES.filter((type) => !draft.room_block || type.block === draft.room_block);
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label={creating ? 'Thêm phòng' : 'Sửa phòng'}
    >
      <h2 className="text-section-title font-semibold text-text">
        {creating ? 'Thêm phòng' : `Sửa phòng ${draft.code}`}
      </h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="grid gap-3 md:grid-cols-4">
        {creating ? (
          <SelectBox
            label="Điểm trường"
            value={draft.org_unit_id}
            options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
            onChange={(value) => onChange({ ...draft, org_unit_id: value })}
            error={errors.org_unit_id}
          />
        ) : null}
        <TextField
          label="Mã phòng"
          value={draft.code}
          error={errors.code}
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
        />
        <TextField
          label="Tên phòng"
          value={draft.name}
          error={errors.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        <TextField
          label="Sức chứa"
          type="number"
          value={draft.capacity}
          error={errors.capacity}
          onChange={(event) => onChange({ ...draft, capacity: event.target.value })}
        />
        <SelectBox
          label="Khối phòng"
          value={draft.room_block}
          options={ROOM_BLOCKS}
          emptyLabel="Chưa chọn"
          error={errors.room_block}
          onChange={(value) => onChange({ ...draft, room_block: value, room_type: '' })}
        />
        <SelectBox
          label="Loại phòng"
          value={draft.room_type}
          options={types}
          emptyLabel="Chưa chọn"
          error={errors.room_type}
          onChange={(value) => onChange({ ...draft, room_type: value })}
        />
        <SelectBox
          label="Hiện trạng"
          value={draft.condition}
          options={ROOM_CONDITIONS}
          emptyLabel="Chưa chọn"
          error={errors.condition}
          onChange={(value) => onChange({ ...draft, condition: value })}
        />
        <TextField
          label="Diện tích (m²)"
          type="number"
          step="0.01"
          value={draft.area_m2}
          error={errors.area_m2}
          onChange={(event) => onChange({ ...draft, area_m2: event.target.value })}
        />
        {ROOM_ATTRIBUTES.map((field) => (
          <ProfileFieldInput
            key={field.key}
            field={field}
            value={draft.facility_attributes[field.key]}
            error={errors[`facility_attributes.${field.key}`]}
            onChange={(value) =>
              onChange({ ...draft, facility_attributes: { ...draft.facility_attributes, [field.key]: value } })
            }
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" disabled={pending} onClick={onSubmit}>
          Lưu phòng
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </section>
  );
}

export function FacilityRoomsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.roomManage);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [block, setBlock] = useState('');
  const [roomType, setRoomType] = useState('');
  const [condition, setCondition] = useState('');
  const [draft, setDraft] = useState<{ value: RoomDraft; roomId: string | null }>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filters = { org_unit_id: orgUnitId, room_block: block, room_type: roomType, condition };
  const rooms = useQuery({ queryKey: ['facility-rooms', filters], queryFn: () => listFacilityRooms(filters) });
  const save = useMutation({
    mutationFn: async () => {
      if (!draft) {
        return;
      }
      const input = toInput(draft.value);
      return draft.roomId
        ? updateRoom(draft.roomId, input)
        : createRoom({ ...input, org_unit_id: draft.value.org_unit_id });
    },
    onSuccess: async () => {
      setDraft(undefined);
      setToastMessage('Đã lưu phòng');
      await queryClient.invalidateQueries({ queryKey: ['facility-rooms'] });
    },
  });
  const exportFile = useMutation({
    mutationFn: () => downloadExcel('/api/v1/facilities/rooms/export', filters, 'khai-bao-co-so-vat-chat.xlsx'),
  });
  const edit = (room: FacilityRoom) =>
    setDraft({
      roomId: room.id,
      value: {
        org_unit_id: room.org_unit_id,
        code: room.code,
        name: room.name,
        capacity: String(room.capacity),
        room_block: room.room_block ?? '',
        room_type: room.room_type ?? '',
        condition: room.condition ?? '',
        area_m2: room.area_m2 === null ? '' : String(room.area_m2),
        facility_attributes: room.facility_attributes,
      },
    });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">1.1 Khai báo cơ sở vật chất</h1>
          <div className="flex gap-2">
            {canManage ? (
              <Button
                variant="secondary"
                onClick={() =>
                  setDraft({
                    roomId: null,
                    value: emptyDraft(orgUnitId || unitChoice.selectedId || '', block),
                  })
                }
              >
                Thêm phòng
              </Button>
            ) : null}
            <Button variant="secondary" disabled={exportFile.isPending} onClick={() => exportFile.mutate()}>
              Xuất Excel
            </Button>
          </div>
        </div>
        {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
        <TabBar
          tabs={[
            { key: '', label: 'Tất cả khối' },
            ...ROOM_BLOCKS.map((item) => ({ key: item.value, label: item.label })),
          ]}
          current={block}
          onSelect={(key) => {
            setBlock(key);
            setRoomType('');
          }}
          label="Khối phòng"
        />
        <div className="grid gap-3 md:grid-cols-3">
          <SelectBox
            label="Đơn vị"
            value={orgUnitId}
            options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
            emptyLabel="Mọi đơn vị trong phạm vi"
            onChange={setOrgUnitId}
          />
          <SelectBox
            label="Loại phòng"
            value={roomType}
            options={ROOM_TYPES.filter((type) => !block || type.block === block)}
            emptyLabel="Mọi loại phòng"
            onChange={setRoomType}
          />
          <SelectBox
            label="Hiện trạng"
            value={condition}
            options={ROOM_CONDITIONS}
            emptyLabel="Mọi hiện trạng"
            onChange={setCondition}
          />
        </div>
        {draft ? (
          <RoomForm
            draft={draft.value}
            units={unitChoice.units}
            creating={draft.roomId === null}
            error={save.error}
            pending={save.isPending}
            onChange={(value) => setDraft({ ...draft, value })}
            onSubmit={() => save.mutate()}
            onCancel={() => setDraft(undefined)}
          />
        ) : null}
        {rooms.error ? <Alert tone="danger">{messageOf(rooms.error)}</Alert> : null}
        {rooms.data ? (
          <>
            <section
              className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
              aria-label="Danh sách phòng"
            >
              <h2 className="text-section-title font-semibold text-text">Danh sách phòng</h2>
              {rooms.data.rooms.length === 0 ? (
                <p className="text-content text-text-secondary">Chưa có phòng nào.</p>
              ) : (
                <table className="w-full text-content">
                  <thead className="text-left text-label font-medium text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Điểm trường</th>
                      <th className="px-3 py-2">Tên phòng</th>
                      <th className="px-3 py-2">Loại</th>
                      <th className="px-3 py-2">Hiện trạng</th>
                      <th className="px-3 py-2">Diện tích (m²)</th>
                      <th className="px-3 py-2">Nhóm, lớp</th>
                      <th className="px-3 py-2">Thuộc tính</th>
                      <th className="px-3 py-2">Trạng thái</th>
                      {canManage ? <th className="px-3 py-2" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.data.rooms.map((room) => (
                      <tr key={room.id} className="border-t border-border align-top">
                        <td className="px-3 py-2">{room.org_unit_name}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{room.name}</span> ({room.code})
                        </td>
                        <td className="px-3 py-2">{labelOf(ROOM_TYPES, room.room_type)}</td>
                        <td className="px-3 py-2">{labelOf(ROOM_CONDITIONS, room.condition)}</td>
                        <td className="px-3 py-2">{formatNumber(room.area_m2)}</td>
                        <td className="px-3 py-2">{room.class_names.join(', ')}</td>
                        <td className="px-3 py-2 text-label">
                          {ROOM_ATTRIBUTES.filter((field) => {
                            const value = room.facility_attributes[field.key];
                            return value !== undefined && value !== null && value !== false;
                          })
                            .map((field) => {
                              const value = room.facility_attributes[field.key];
                              return value === true
                                ? field.label
                                : `${field.label}: ${field.kind === 'choice' ? labelOf(field.options ?? [], String(value)) : String(value)}`;
                            })
                            .join('; ')}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={room.status === 'active' ? 'success' : 'neutral'}
                            label={room.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
                          />
                        </td>
                        {canManage ? (
                          <td className="px-3 py-2 text-right">
                            <Button variant="text" onClick={() => edit(room)}>
                              Sửa
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section
              className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
              aria-label="Tổng hợp cơ sở vật chất"
            >
              <h2 className="text-section-title font-semibold text-text">Tổng hợp phòng đang dùng</h2>
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Chỉ tiêu</th>
                    <th className="px-3 py-2">Tổng số</th>
                    <th className="px-3 py-2">Kiên cố</th>
                    <th className="px-3 py-2">Bán kiên cố</th>
                    <th className="px-3 py-2">Tạm</th>
                    <th className="px-3 py-2">Nhờ, mượn, thuê</th>
                    <th className="px-3 py-2">Chưa khai báo</th>
                    <th className="px-3 py-2">Diện tích (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.data.summary.map((row) => (
                    <tr
                      key={row.room_block}
                      className={`border-t border-border ${row.room_block === 'total' ? 'font-semibold' : ''}`}
                    >
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2">{row.total}</td>
                      <td className="px-3 py-2">{row.permanent}</td>
                      <td className="px-3 py-2">{row.semi_permanent}</td>
                      <td className="px-3 py-2">{row.temporary}</td>
                      <td className="px-3 py-2">{row.borrowed}</td>
                      <td className="px-3 py-2">{row.unspecified}</td>
                      <td className="px-3 py-2">{formatNumber(row.area_m2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
