import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { endAssignment, listClasses, listStaff } from '../classes/classes-api.js';
import { assignSubjectTeacher, listTeacherLoads, readClassTeaching, type ClassTeaching } from './subjects-api.js';

// 7.2 Phân công giảng dạy theo môn (DT-20 phần 20a, YCTD-158; THCS, THPT dùng chung ở DT-21 phần 21a): chọn cấp, lớp, mỗi môn của khối theo chương trình của lớp
// có một giáo viên bộ môn (VT-08) và số tiết được phân (trống là số tiết của chương trình); bảng tổng tiết của giáo viên.
// Ai xem được lớp đều xem; phân công cần quyền quản lý lớp như 3.3 Phân công phụ trách lớp
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function SubjectRow({
  teaching,
  row,
  canManage,
  onChanged,
}: {
  teaching: ClassTeaching;
  row: ClassTeaching['subjects'][number];
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [staffUserId, setStaffUserId] = useState('');
  const [periods, setPeriods] = useState('');
  const staff = useQuery({
    queryKey: ['staff-directory', 'subject', teaching.class.org_unit_id],
    queryFn: () => listStaff('VT-08', teaching.class.org_unit_id),
    enabled: canManage && !row.assignment,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['class-teaching'] });
    await queryClient.invalidateQueries({ queryKey: ['teacher-loads'] });
    await queryClient.invalidateQueries({ queryKey: ['class-assignments'] });
  };
  const assign = useMutation({
    mutationFn: () =>
      assignSubjectTeacher(teaching.class.id, {
        staff_user_id: staffUserId,
        subject_id: row.subject_id,
        periods_per_week: periods.trim() === '' ? null : Number(periods.replace(',', '.')),
      }),
    onSuccess: async () => {
      setStaffUserId('');
      setPeriods('');
      await refresh();
      onChanged(`Đã phân công môn ${row.subject_name}`);
    },
  });
  const end = useMutation({
    mutationFn: () => endAssignment(teaching.class.id, row.assignment?.id ?? ''),
    onSuccess: async () => {
      await refresh();
      onChanged(`Đã kết thúc phân công môn ${row.subject_name}`);
    },
  });
  return (
    <tr className="border-t border-border" aria-label={row.subject_name}>
      <th scope="row" className="px-3 py-2 text-left font-medium">
        {row.subject_name}
        {row.is_elective ? <span className="ml-2 text-label text-text-secondary">(tự chọn)</span> : null}
      </th>
      <td className="px-3 py-2">{row.periods_per_week}</td>
      <td className="px-3 py-2">
        {row.assignment ? (
          <span>
            {row.assignment.staff_name} · {row.assignment.periods_per_week} tiết
          </span>
        ) : canManage ? (
          <span className="flex flex-wrap items-center gap-2">
            <select
              className={FORM_CONTROL_CLASS}
              aria-label={`Giáo viên môn ${row.subject_name}`}
              value={staffUserId}
              onChange={(event) => setStaffUserId(event.target.value)}
            >
              <option value="">Chọn giáo viên bộ môn</option>
              {(staff.data ?? []).map((entry) => (
                <option key={entry.user_id} value={entry.user_id}>
                  {entry.full_name}
                </option>
              ))}
            </select>
            <input
              className={`w-20 ${FORM_CONTROL_CLASS}`}
              inputMode="decimal"
              placeholder={String(row.periods_per_week)}
              aria-label={`Số tiết phân môn ${row.subject_name}`}
              value={periods}
              onChange={(event) => setPeriods(event.target.value)}
            />
            <Button disabled={!staffUserId || assign.isPending} onClick={() => assign.mutate()}>
              Phân công
            </Button>
          </span>
        ) : (
          <span className="text-text-secondary">Chưa phân công</span>
        )}
        {assign.error ? <Alert tone="danger">{messageOf(assign.error)}</Alert> : null}
      </td>
      <td className="px-3 py-2 text-right">
        {canManage && row.assignment ? (
          <Button variant="text" disabled={end.isPending} onClick={() => end.mutate()}>
            Kết thúc
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function TeachingAssignmentsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.classManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [classId, setClassId] = useState('');
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((item) => item.value !== 'MN');
  const [chosenLevel, setChosenLevel] = useState<SchoolLevelCode>();
  const levelOption = levels.find((item) => item.value === chosenLevel) ?? levels[0];
  const level: SchoolLevelCode = levelOption?.value ?? 'TH';
  const classLabel = `Lớp ${levelOption?.label ?? 'Tiểu học'}`;
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const levelClasses = (classes.data ?? []).filter((item) => item.school_level === level && item.status === 'active');
  const teaching = useQuery({
    queryKey: ['class-teaching', classId],
    queryFn: () => readClassTeaching(classId),
    enabled: Boolean(classId),
  });
  const loads = useQuery({ queryKey: ['teacher-loads', level], queryFn: () => listTeacherLoads(level) });
  const assignedPeriods = (teaching.data?.subjects ?? []).reduce(
    (sum, row) => sum + (row.assignment?.periods_per_week ?? 0),
    0,
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/teaching-assignments')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="max-w-sm">
            <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          </div>
          {levels.length > 1 ? (
            <label className="text-label font-medium text-text">
              Cấp học
              <select
                aria-label="Cấp học"
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={level}
                onChange={(event) => {
                  setChosenLevel(event.target.value as SchoolLevelCode);
                  setClassId('');
                }}
              >
                {levels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-label font-medium text-text">
            {classLabel}
            <select
              aria-label={classLabel}
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">Chọn lớp</option>
              {levelClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {classes.data && levelClasses.length === 0 ? (
          <p className="text-content text-text-secondary">Đơn vị chưa có lớp của cấp này đang hoạt động.</p>
        ) : null}
        {teaching.error ? <Alert tone="danger">{messageOf(teaching.error)}</Alert> : null}
        {teaching.data ? (
          <section className="flex flex-col gap-3" aria-label={`Phân công môn lớp ${teaching.data.class.name}`}>
            <p className="text-content">
              {teaching.data.curriculum
                ? `Chương trình: ${teaching.data.curriculum.name}. Tổng tiết theo chương trình: ${teaching.data.planned_periods}; đã phân: ${assignedPeriods}.`
                : 'Cấp này chưa có chương trình; nạp môn mẫu ở 7.1 Môn học và hoạt động giáo dục.'}
            </p>
            <table className="w-full text-content" aria-label="Môn của lớp">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Môn học</th>
                  <th className="px-3 py-2">Tiết/tuần theo chương trình</th>
                  <th className="px-3 py-2">Giáo viên dạy</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {teaching.data.subjects.map((row) => (
                  <SubjectRow
                    key={row.subject_id}
                    teaching={teaching.data}
                    row={row}
                    canManage={canManage}
                    onChanged={setToastMessage}
                  />
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
        <section className="flex flex-col gap-3" aria-label="Tổng tiết của giáo viên">
          <h2 className="text-section-title font-semibold text-text">Tổng tiết mỗi tuần của giáo viên</h2>
          {loads.error ? <Alert tone="danger">{messageOf(loads.error)}</Alert> : null}
          <table className="w-full text-content" aria-label="Tổng tiết giáo viên">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Giáo viên</th>
                <th className="px-3 py-2">Số lớp</th>
                <th className="px-3 py-2">Tổng tiết/tuần</th>
              </tr>
            </thead>
            <tbody>
              {(loads.data ?? []).map((row) => (
                <tr key={row.staff_user_id} className="border-t border-border">
                  <td className="px-3 py-2">{row.staff_name}</td>
                  <td className="px-3 py-2">{row.classes}</td>
                  <td className="px-3 py-2">{row.total_periods}</td>
                </tr>
              ))}
              {loads.data && loads.data.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-text-secondary">
                    Chưa có phân công theo môn.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
