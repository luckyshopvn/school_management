import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
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
  type ChildGroupDetail,
} from './child-groups-api.js';

// Nhóm trẻ (YCTD-102): Ban Giám hiệu, quản lý đơn vị lập nhóm trong đơn vị (năng khiếu, chăm sóc đặc biệt...), chọn giáo
// viên phụ trách, thêm nhiều trẻ theo lớp, bớt trẻ; giáo viên xem nhóm có trẻ của lớp mình hoặc nhóm mình phụ trách
function CreateGroupForm({ orgUnitId, onCreated }: { orgUnitId: string; onCreated(group: ChildGroupDetail): void }) {
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
      aria-label="Lập nhóm trẻ"
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
      <div className="flex items-end">
        <Button type="submit" variant="primary" disabled={create.isPending || name.trim() === ''}>
          Lập nhóm
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
    <div className="flex flex-col gap-2" aria-label="Thêm trẻ vào nhóm" role="group">
      {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Chọn lớp để thêm trẻ
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
            <span className="text-text-secondary">Mọi trẻ của lớp đã trong nhóm.</span>
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
  const group = useQuery({ queryKey: ['child-groups', 'detail', groupId], queryFn: () => readChildGroup(groupId) });
  const updated = (message: string) => (data: ChildGroupDetail) => {
    queryClient.setQueryData(['child-groups', 'detail', groupId], data);
    onChanged(message);
  };
  const remove = useMutation({
    mutationFn: (childId: string) => removeGroupMembers(groupId, [childId]),
    onSuccess: updated('Đã bỏ trẻ khỏi nhóm'),
  });
  const data = group.data;
  const error = [group.error, remove.error].find(Boolean);
  if (!data) {
    return error ? <Alert tone="danger">{messageOf(error)}</Alert> : null;
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label={`Nhóm ${data.name}`}>
      <h2 className="text-section-title font-semibold text-text">Nhóm {data.name}</h2>
      {data.description ? <p>{data.description}</p> : null}
      <p className="text-text-secondary">Giáo viên phụ trách: {data.teacher_name ?? 'Chưa có'}</p>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Trẻ trong nhóm">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Họ tên trẻ</th>
            <th>Lớp</th>
            <th>Ngày sinh</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.members.map((member) => (
            <tr key={member.child_id} className="border-t border-border">
              <td className="py-2">{member.full_name}</td>
              <td>{member.class_name ?? ''}</td>
              <td>{member.dob}</td>
              <td>
                {data.can_manage ? (
                  <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate(member.child_id)}>
                    Bỏ {member.full_name}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.members.length === 0 ? <p className="text-text-secondary">Nhóm chưa có trẻ.</p> : null}
      {data.can_manage ? <AddMembers group={data} onChanged={updated('Đã thêm trẻ vào nhóm')} /> : null}
    </section>
  );
}

export function ChildGroupsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.childGroupManage);
  const unitChoice = useUnitChoice();
  const [groupId, setGroupId] = useState<string>();
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
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Nhóm trẻ</h1>
        {canManage && orgUnitId ? (
          <>
            <UnitSelect
              units={unitChoice.units}
              selectedId={orgUnitId}
              onSelect={(id) => {
                unitChoice.select(id);
                setGroupId(undefined);
              }}
            />
            <CreateGroupForm
              orgUnitId={orgUnitId}
              onCreated={(group) => {
                setGroupId(group.id);
                changed(`Đã lập nhóm ${group.name}`);
              }}
            />
          </>
        ) : null}
        {groups.error ? <Alert tone="danger">{messageOf(groups.error)}</Alert> : null}
        <section className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Danh sách nhóm trẻ">
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Tên nhóm</th>
                <th>Giáo viên phụ trách</th>
                <th>Số trẻ</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(groups.data ?? []).map((group) => (
                <tr key={group.id} className="border-t border-border">
                  <td className="py-2">{group.name}</td>
                  <td>{group.teacher_name ?? ''}</td>
                  <td>{group.member_count}</td>
                  <td>{group.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
                  <td>
                    <Button variant="text" onClick={() => setGroupId(group.id)}>
                      Xem nhóm {group.name}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups.data?.length === 0 ? <p className="text-text-secondary">Chưa có nhóm trẻ.</p> : null}
        </section>
        {groupId ? <GroupPanel key={groupId} groupId={groupId} onChanged={changed} /> : null}
      </div>
    </AppShell>
  );
}
