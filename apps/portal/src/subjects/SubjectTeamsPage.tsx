import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listStaff } from '../classes/classes-api.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  createSubjectTeam,
  listSubjectTeamLoads,
  listSubjectTeams,
  listSubjects,
  removeSubjectTeamMember,
  setSubjectTeamMember,
  updateSubjectTeam,
  type SubjectTeam,
} from './subjects-api.js';

// 7.13 Tổ bộ môn (DT-21 phần 21a, YCTD-167): tổ chuyên môn của THCS, THPT gồm các môn, tổ trưởng, thành viên là giáo viên bộ
// môn (VT-08) của đơn vị; tổng tiết mỗi tuần của thành viên theo phân công giảng dạy (7.2). Mọi người xem; người quản lý
// danh mục (P01.catalog.manage) tạo, sửa
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function TeamForm({ levels, onSaved }: { levels: SchoolLevelCode[]; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SchoolLevelCode>(levels[0] ?? 'THCS');
  const [chosen, setChosen] = useState<string[]>([]);
  const subjects = useQuery({ queryKey: ['subjects', level], queryFn: () => listSubjects(level) });
  const create = useMutation({
    mutationFn: () => createSubjectTeam({ code, name, school_level: level, subject_ids: chosen }),
    onSuccess: async (team) => {
      setCode('');
      setName('');
      setChosen([]);
      await queryClient.invalidateQueries({ queryKey: ['subject-teams'] });
      onSaved(`Đã thêm tổ ${team.name}`);
    },
  });
  return (
    <form
      aria-label="Thêm tổ bộ môn"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Mã tổ
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Tên tổ
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {levels.length > 1 ? (
          <label className="text-label font-medium text-text">
            Cấp học
            <select
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={level}
              onChange={(event) => {
                setLevel(event.target.value as SchoolLevelCode);
                setChosen([]);
              }}
            >
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-label font-medium text-text">Môn của tổ</legend>
        {(subjects.data ?? [])
          .filter((subject) => subject.status === 'active')
          .map((subject) => (
            <label key={subject.id} className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={chosen.includes(subject.id)}
                onChange={(event) =>
                  setChosen((current) =>
                    event.target.checked ? [...current, subject.id] : current.filter((id) => id !== subject.id),
                  )
                }
              />
              {subject.name}
            </label>
          ))}
      </fieldset>
      <div>
        <Button type="submit" variant="primary" disabled={!code || !name || create.isPending}>
          Thêm tổ
        </Button>
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </form>
  );
}

function TeamMembers({
  team,
  canManage,
  onChanged,
}: {
  team: SubjectTeam;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [staffUserId, setStaffUserId] = useState('');
  const staff = useQuery({
    queryKey: ['staff-directory', 'subject', unitChoice.selectedId],
    queryFn: () => listStaff('VT-08', unitChoice.selectedId ?? ''),
    enabled: canManage && Boolean(unitChoice.selectedId),
  });
  const loads = useQuery({ queryKey: ['subject-team-loads', team.id], queryFn: () => listSubjectTeamLoads(team.id) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['subject-teams'] });
    await queryClient.invalidateQueries({ queryKey: ['subject-team-loads', team.id] });
    onChanged(message);
  };
  const add = useMutation({
    mutationFn: (role: 'head' | 'member') =>
      setSubjectTeamMember(team.id, {
        org_unit_id: unitChoice.selectedId ?? '',
        staff_user_id: staffUserId,
        role,
      }),
    onSuccess: () => refresh('Đã ghi thành viên tổ'),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeSubjectTeamMember(team.id, userId),
    onSuccess: () => refresh('Đã bỏ thành viên khỏi tổ'),
  });
  return (
    <div className="flex flex-col gap-2">
      <ul className="list-disc pl-6 text-content" aria-label={`Thành viên tổ ${team.name}`}>
        {team.members.map((member) => (
          <li key={member.staff_user_id}>
            {member.staff_name}
            {member.role === 'head' ? ' (Tổ trưởng)' : ''}
            {' - '}
            {loads.data?.find((load) => load.staff_user_id === member.staff_user_id)?.total_periods ?? 0} tiết/tuần
            {canManage ? (
              <Button variant="text" onClick={() => remove.mutate(member.staff_user_id)}>
                Bỏ khỏi tổ
              </Button>
            ) : null}
          </li>
        ))}
        {team.members.length === 0 ? <li className="list-none">Tổ chưa có thành viên.</li> : null}
      </ul>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="max-w-sm">
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          </div>
          <label className="text-label font-medium text-text">
            Giáo viên
            <select
              aria-label={`Giáo viên của tổ ${team.name}`}
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={staffUserId}
              onChange={(event) => setStaffUserId(event.target.value)}
            >
              <option value="">Chọn giáo viên</option>
              {(staff.data ?? []).map((entry) => (
                <option key={entry.user_id} value={entry.user_id}>
                  {entry.full_name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!staffUserId || add.isPending} onClick={() => add.mutate('member')}>
            Thêm thành viên
          </Button>
          <Button disabled={!staffUserId || add.isPending} onClick={() => add.mutate('head')}>
            Đặt làm tổ trưởng
          </Button>
        </div>
      ) : null}
      {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
    </div>
  );
}

export function SubjectTeamsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.catalogManage);
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels
    .map((level) => level.value)
    .filter((level): level is SchoolLevelCode => level === 'THCS' || level === 'THPT');
  const [toastMessage, setToastMessage] = useState<string>();
  const [openId, setOpenId] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const teams = useQuery({ queryKey: ['subject-teams'], queryFn: listSubjectTeams });
  const toggle = useMutation({
    mutationFn: (team: SubjectTeam) =>
      updateSubjectTeam(team.id, { status: team.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subject-teams'] });
    },
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/subject-teams')}</h1>
        {teams.error ? <Alert tone="danger">{messageOf(teams.error)}</Alert> : null}
        <table className="w-full text-content" aria-label="Tổ bộ môn">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên tổ</th>
              <th className="px-3 py-2">Cấp</th>
              <th className="px-3 py-2">Môn</th>
              <th className="px-3 py-2">Thành viên</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(teams.data ?? []).map((team) => (
              <tr key={team.id} className="border-t border-border align-top">
                <td className="px-3 py-2">{team.code}</td>
                <td className="px-3 py-2">{team.name}</td>
                <td className="px-3 py-2">{team.school_level}</td>
                <td className="px-3 py-2">{team.subjects.map((subject) => subject.name).join(', ')}</td>
                <td className="px-3 py-2">
                  <Button variant="text" onClick={() => setOpenId(openId === team.id ? undefined : team.id)}>
                    {team.members.length} thành viên
                  </Button>
                  {openId === team.id ? (
                    <TeamMembers team={team} canManage={canManage} onChanged={setToastMessage} />
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={team.status === 'active' ? 'success' : 'neutral'}
                    label={team.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage ? (
                    <Button variant="text" onClick={() => toggle.mutate(team)}>
                      {team.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {teams.data && teams.data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-2 text-text-secondary">
                  Chưa có tổ bộ môn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {canManage && levels.length > 0 ? <TeamForm levels={levels} onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
