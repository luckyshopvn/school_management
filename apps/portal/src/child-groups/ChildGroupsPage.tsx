import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import { messageOf, selectClass } from '../work/work-api.js';
import {
  addGroupMembers,
  createChildGroup,
  listChildGroups,
  listClassChildren,
  readChildGroup,
  removeGroupMembers,
  type ChildGroup,
  type ChildGroupDetail,
} from './child-groups-api.js';

// Nhóm học sinh (YCTD-102): Ban Giám hiệu, quản lý đơn vị lập nhóm trong đơn vị (năng khiếu, chăm sóc đặc biệt...), chọn giáo
// viên phụ trách, thêm nhiều học sinh theo lớp, bớt học sinh; giáo viên xem nhóm có học sinh của lớp mình hoặc nhóm mình phụ
// trách. Danh sách nhóm và danh sách học sinh trong nhóm theo lưới dữ liệu chung, tìm tại chỗ, Mở rộng tìm kiếm theo trạng
// thái, Thêm mới mở biểu mẫu lập nhóm; bỏ một hoặc nhiều học sinh khỏi nhóm đều qua hộp xác nhận xóa (DT-16 phần 16b)
type Member = ChildGroupDetail['members'][number];

const GROUP_COLUMNS: Array<DataGridColumn<ChildGroup>> = [
  { id: 'name', header: 'Tên nhóm', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'teacher', header: 'Giáo viên phụ trách', cell: (row) => row.teacher_name ?? '' },
  { id: 'member_count', header: 'Số học sinh', cell: (row) => row.member_count },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      row.status === 'active' ? (
        <StatusBadge tone="success" label="Đang dùng" />
      ) : (
        <StatusBadge tone="neutral" label="Ngừng dùng" />
      ),
  },
];

const MEMBER_COLUMNS: Array<DataGridColumn<Member>> = [
  {
    id: 'full_name',
    header: 'Họ tên học sinh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.full_name,
  },
  { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name ?? '' },
  { id: 'dob', header: 'Ngày sinh', cell: (row) => row.dob },
];

function CreateGroupForm({
  orgUnitId,
  onCreated,
  onCancel,
}: {
  orgUnitId: string;
  onCreated(group: ChildGroupDetail): void;
  onCancel(): void;
}) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, ''), retry: false });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teacherStaffId, setTeacherStaffId] = useState('');
  const create = useMutation({
    mutationFn: () =>
      createChildGroup({
        org_unit_id: orgUnitId,
        name,
        description: description || null,
        teacher_staff_id: teacherStaffId || null,
      }),
    onSuccess: (group) => {
      setName('');
      setDescription('');
      setTeacherStaffId('');
      onCreated(group);
    },
  });
  return (
    <form
      aria-label="Lập nhóm học sinh"
      className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? (
        <div className="md:col-span-4">
          <Alert tone="danger">{messageOf(create.error)}</Alert>
        </div>
      ) : null}
      <TextField label="Tên nhóm" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
      <TextField label="Mô tả nhóm" value={description} onChange={(event) => setDescription(event.target.value)} />
      <label className="text-label font-medium text-text">
        Giáo viên phụ trách
        <select
          value={teacherStaffId}
          onChange={(event) => setTeacherStaffId(event.target.value)}
          className={selectClass}
        >
          <option value="">Không có</option>
          {(staff.data ?? [])
            .filter((person) => person.status === 'active')
            .map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending || name.trim() === ''}>
          Lập nhóm
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function AddMembers({ group, onChanged }: { group: ChildGroupDetail; onChanged(group: ChildGroupDetail): void }) {
  const classes = useQuery({ queryKey: ['classes', group.org_unit_id], queryFn: () => listClasses(group.org_unit_id) });
  const [classId, setClassId] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const children = useQuery({
    queryKey: ['class-children', group.org_unit_id, classId],
    queryFn: () => listClassChildren(group.org_unit_id, classId),
    enabled: classId !== '',
  });
  const members = new Set(group.members.map((member) => member.child_id));
  const add = useMutation({
    mutationFn: () => addGroupMembers(group.id, chosen),
    onSuccess: (updated) => {
      setChosen([]);
      onChanged(updated);
    },
  });
  const candidates = (children.data ?? []).filter((child) => !members.has(child.id));
  return (
    <div className="flex flex-col gap-2" aria-label="Thêm học sinh vào nhóm" role="group">
      {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Chọn lớp để thêm học sinh
        <select
          value={classId}
          className={selectClass}
          onChange={(event) => {
            setClassId(event.target.value);
            setChosen([]);
          }}
        >
          <option value="">Chọn lớp</option>
          {(classes.data ?? [])
            .filter((row) => row.status === 'active')
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
        </select>
      </label>
      {classId ? (
        <div className="flex flex-wrap gap-3">
          {candidates.length > 1 ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chosen.length === candidates.length}
                onChange={(event) => setChosen(event.target.checked ? candidates.map((child) => child.id) : [])}
              />
              Chọn cả lớp
            </label>
          ) : null}
          {candidates.map((child) => (
            <label key={child.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chosen.includes(child.id)}
                onChange={(event) =>
                  setChosen((current) =>
                    event.target.checked ? [...current, child.id] : current.filter((id) => id !== child.id),
                  )
                }
              />
              {child.full_name}
            </label>
          ))}
          {children.data && candidates.length === 0 ? (
            <span className="text-text-secondary">Mọi học sinh của lớp đã trong nhóm.</span>
          ) : null}
        </div>
      ) : null}
      <div>
        <Button variant="primary" disabled={add.isPending || chosen.length === 0} onClick={() => add.mutate()}>
          Thêm vào nhóm
        </Button>
      </div>
    </div>
  );
}

function GroupPanel({ groupId, onChanged }: { groupId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('child-group-members');
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<Member[]>();
  const group = useQuery({ queryKey: ['child-groups', 'detail', groupId], queryFn: () => readChildGroup(groupId) });
  const updated = (message: string) => (data: ChildGroupDetail) => {
    queryClient.setQueryData(['child-groups', 'detail', groupId], data);
    onChanged(message);
  };
  const remove = useMutation({
    mutationFn: (childIds: string[]) => removeGroupMembers(groupId, childIds),
    onSuccess: (data) => {
      setRemoving(undefined);
      updated('Đã bỏ học sinh khỏi nhóm')(data);
    },
    onError: () => setRemoving(undefined),
  });
  const data = group.data;
  const error = [group.error, remove.error, grid.error].find(Boolean);
  if (!data) {
    return error ? <Alert tone="danger">{messageOf(error)}</Alert> : null;
  }
  const rows = data.members.filter((member) => matchesSearch(search, member.full_name, member.class_name));
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label={`Nhóm ${data.name}`}>
      <h2 className="text-section-title font-semibold text-text">Nhóm {data.name}</h2>
      {data.description ? <p>{data.description}</p> : null}
      <p className="text-text-secondary">Giáo viên phụ trách: {data.teacher_name ?? 'Chưa có'}</p>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Học sinh trong nhóm"
        columns={MEMBER_COLUMNS}
        rows={rows}
        getRowId={(row) => row.child_id}
        getRowLabel={(row) => row.full_name}
        emptyText="Nhóm chưa có học sinh."
        search={{ label: 'Tìm theo họ tên, lớp', value: search, onChange: setSearch }}
        selectable={data.can_manage}
        toolbar={
          data.can_manage
            ? (selected: Member[]) => (
                <Button
                  variant="danger"
                  disabled={selected.length === 0 || remove.isPending}
                  onClick={() => setRemoving(selected)}
                >
                  Bỏ khỏi nhóm
                </Button>
              )
            : undefined
        }
        rowActions={
          data.can_manage
            ? (row) => (
                <Button variant="text" disabled={remove.isPending} onClick={() => setRemoving([row])}>
                  Bỏ {row.full_name}
                </Button>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {data.can_manage ? <AddMembers group={data} onChanged={updated('Đã thêm học sinh vào nhóm')} /> : null}
      {removing ? (
        <ConfirmDeleteDialog
          open
          title="Bỏ học sinh khỏi nhóm"
          subject={
            removing.length === 1
              ? `học sinh ${removing[0]?.full_name ?? ''} khỏi nhóm ${data.name}`
              : `${removing.length} học sinh khỏi nhóm ${data.name}`
          }
          confirmLabel="Bỏ khỏi nhóm"
          busy={remove.isPending}
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => remove.mutate(removing.map((member) => member.child_id))}
        >
          Học sinh chỉ ra khỏi nhóm, hồ sơ học sinh không bị xóa; có thể thêm lại sau.
        </ConfirmDeleteDialog>
      ) : null}
    </section>
  );
}

export function ChildGroupsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.childGroupManage);
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('child-groups');
  const [groupId, setGroupId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const orgUnitId = canManage ? (unitChoice.selectedId ?? '') : '';
  const groups = useQuery({
    queryKey: ['child-groups', 'list', orgUnitId],
    queryFn: () => listChildGroups(orgUnitId),
    enabled: !canManage || orgUnitId !== '',
  });
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['child-groups', 'list'] });
    setToastMessage(message);
  };
  const rows = (groups.data ?? []).filter(
    (group) => (status === '' || group.status === status) && matchesSearch(search, group.name),
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/child-groups')}</h1>
        {canManage && orgUnitId ? (
          <UnitSelect
            units={unitChoice.units}
            selectedId={orgUnitId}
            onSelect={(id) => {
              unitChoice.select(id);
              setGroupId(undefined);
              setCreating(false);
            }}
          />
        ) : null}
        {canManage && orgUnitId && creating ? (
          <CreateGroupForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onCreated={(group) => {
              setCreating(false);
              setGroupId(group.id);
              changed(`Đã lập nhóm ${group.name}`);
            }}
          />
        ) : null}
        {groups.error ? <Alert tone="danger">{messageOf(groups.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách nhóm học sinh"
          columns={GROUP_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          loading={groups.isLoading}
          emptyText="Chưa có nhóm học sinh."
          search={{ label: 'Tìm theo tên nhóm', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Trạng thái
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
                  <option value="">Tất cả</option>
                  <option value="active">Đang dùng</option>
                  <option value="inactive">Ngừng dùng</option>
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
          rowActions={(row) => (
            <Button variant="text" onClick={() => setGroupId(row.id)}>
              Xem nhóm {row.name}
            </Button>
          )}
          activeRowId={groupId}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
        {groupId ? <GroupPanel key={groupId} groupId={groupId} onChanged={changed} /> : null}
      </div>
    </AppShell>
  );
}
