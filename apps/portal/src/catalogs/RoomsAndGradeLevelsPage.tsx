import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { CatalogTable } from './CatalogTable.js';
import {
  createGradeLevel,
  createRoom,
  listGradeLevels,
  listRooms,
  updateGradeLevel,
  updateRoom,
  type GradeLevel,
  type Room,
} from './catalogs-api.js';
import { UnitSelect, useUnitChoice } from './UnitSelect.js';

// MH-34 Danh mục phòng học theo đơn vị (P01-11) và bậc học toàn trường (P01-12), độ tuổi theo tháng (YCTD-42)
type Tab = 'rooms' | 'grade-levels';

const toNumber = (value: string | undefined) => (value === undefined || value === '' ? Number.NaN : Number(value));

function RoomsSection({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const rooms = useQuery({
    queryKey: ['rooms', orgUnitId],
    queryFn: () => listRooms(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rooms', orgUnitId] });

  return (
    <div className="flex flex-col gap-4">
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {!orgUnitId && !unitChoice.isPending ? (
        <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
      ) : null}
      {orgUnitId ? (
        <CatalogTable<Room>
          key={orgUnitId}
          title="Phòng học"
          rows={rooms.data}
          isPending={rooms.isPending}
          error={rooms.error}
          columns={[
            { label: 'Mã phòng', render: (row) => row.code },
            { label: 'Tên phòng', render: (row) => <span className="font-medium">{row.name}</span> },
            { label: 'Sức chứa', render: (row) => row.capacity },
          ]}
          fields={[
            { key: 'code', label: 'Mã phòng' },
            { key: 'name', label: 'Tên phòng' },
            { key: 'capacity', label: 'Sức chứa', kind: 'number' },
          ]}
          canManage={canManage}
          initialValues={{ code: '', name: '', capacity: '' }}
          valuesOf={(row) => ({ code: row.code, name: row.name, capacity: String(row.capacity) })}
          onCreate={async (values) => {
            await createRoom({
              org_unit_id: orgUnitId,
              code: values.code ?? '',
              name: values.name ?? '',
              capacity: toNumber(values.capacity),
            });
            await refresh();
          }}
          onUpdate={async (row, changes) => {
            await updateRoom(
              row.id,
              'name' in changes
                ? { code: changes.code, name: changes.name, capacity: toNumber(changes.capacity) }
                : { status: changes.status as Room['status'] },
            );
            await refresh();
          }}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}

function GradeLevelsSection({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['grade-levels'] });

  return (
    <CatalogTable<GradeLevel>
      title="Bậc học"
      rows={gradeLevels.data}
      isPending={gradeLevels.isPending}
      error={gradeLevels.error}
      columns={[
        { label: 'Mã', render: (row) => row.code },
        { label: 'Tên bậc học', render: (row) => <span className="font-medium">{row.name}</span> },
        { label: 'Độ tuổi', render: (row) => `${row.age_from_months} đến ${row.age_to_months} tháng` },
        { label: 'Thứ tự', render: (row) => row.order_no },
      ]}
      fields={[
        { key: 'code', label: 'Mã bậc học', fixedAfterCreate: true },
        { key: 'name', label: 'Tên bậc học' },
        { key: 'age_from_months', label: 'Từ tháng tuổi', kind: 'number' },
        { key: 'age_to_months', label: 'Đến tháng tuổi', kind: 'number' },
        { key: 'order_no', label: 'Thứ tự', kind: 'number' },
      ]}
      canManage={canManage}
      initialValues={{ code: '', name: '', age_from_months: '', age_to_months: '', order_no: '' }}
      valuesOf={(row) => ({
        name: row.name,
        age_from_months: String(row.age_from_months),
        age_to_months: String(row.age_to_months),
        order_no: String(row.order_no),
      })}
      onCreate={async (values) => {
        await createGradeLevel({
          code: values.code ?? '',
          name: values.name ?? '',
          age_from_months: toNumber(values.age_from_months),
          age_to_months: toNumber(values.age_to_months),
          order_no: values.order_no ? Number(values.order_no) : 0,
        });
        await refresh();
      }}
      onUpdate={async (row, changes) => {
        await updateGradeLevel(
          row.id,
          'name' in changes
            ? {
                name: changes.name,
                age_from_months: toNumber(changes.age_from_months),
                age_to_months: toNumber(changes.age_to_months),
                order_no: changes.order_no ? Number(changes.order_no) : 0,
              }
            : { status: changes.status as GradeLevel['status'] },
        );
        await refresh();
      }}
      onChanged={onChanged}
    />
  );
}

export function RoomsAndGradeLevelsPage() {
  const canManageRooms = useHasPermission(PERMISSION_CODES.roomManage);
  const canManageGradeLevels = useHasPermission(PERMISSION_CODES.catalogManage);
  const [tab, setTab] = useState<Tab>('rooms');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Phòng học và bậc học</h1>
        <div className="flex gap-2" role="tablist" aria-label="Danh mục">
          <Button
            role="tab"
            aria-selected={tab === 'rooms'}
            variant={tab === 'rooms' ? 'secondary' : 'text'}
            onClick={() => setTab('rooms')}
          >
            Phòng học
          </Button>
          <Button
            role="tab"
            aria-selected={tab === 'grade-levels'}
            variant={tab === 'grade-levels' ? 'secondary' : 'text'}
            onClick={() => setTab('grade-levels')}
          >
            Bậc học
          </Button>
        </div>
        {tab === 'rooms' ? (
          <RoomsSection canManage={canManageRooms} onChanged={setToastMessage} />
        ) : (
          <GradeLevelsSection canManage={canManageGradeLevels} onChanged={setToastMessage} />
        )}
      </div>
    </AppShell>
  );
}
