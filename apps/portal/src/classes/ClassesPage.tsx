import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField, Toast } from '@school-management/ui';
import { listGradeLevels, listRooms, type GradeLevel, type Room } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { readSettings } from '../settings/settings-api.js';
import {
  addAssignment,
  ASSIGNMENT_ROLE_LABELS,
  createClass,
  endAssignment,
  listClasses,
  listStaff,
  updateClass,
  type AssignmentRole,
  type ClassRecord,
} from './classes-api.js';

// MH-03 Danh sách lớp và phân công giáo viên (P02-05, YCTD-44); phân lớp cho trẻ làm ở phần 3b
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

interface ClassFormValues {
  code: string;
  name: string;
  grade_level: string;
  room_id: string;
  max_size: string;
}

function ClassFields({
  values,
  onChange,
  gradeLevels,
  rooms,
  errors,
}: {
  values: ClassFormValues;
  onChange(values: ClassFormValues): void;
  gradeLevels: GradeLevel[];
  rooms: Room[];
  errors: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Mã lớp"
        value={values.code}
        error={errors.code}
        onChange={(event) => onChange({ ...values, code: event.target.value })}
      />
      <TextField
        label="Tên lớp"
        value={values.name}
        error={errors.name}
        onChange={(event) => onChange({ ...values, name: event.target.value })}
      />
      <label className="flex flex-col gap-2 text-label font-medium text-text">
        Bậc học
        <select
          value={values.grade_level}
          onChange={(event) => onChange({ ...values, grade_level: event.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
        >
          <option value="">Chọn bậc học</option>
          {gradeLevels.map((level) => (
            <option key={level.code} value={level.code}>
              {level.name}
            </option>
          ))}
        </select>
        {errors.grade_level ? <span className="text-label text-danger">{errors.grade_level}</span> : null}
      </label>
      <label className="flex flex-col gap-2 text-label font-medium text-text">
        Phòng học
        <select
          value={values.room_id}
          onChange={(event) => onChange({ ...values, room_id: event.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
        >
          <option value="">Chưa chọn</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        {errors.room_id ? <span className="text-label text-danger">{errors.room_id}</span> : null}
      </label>
      <TextField
        label="Sĩ số tối đa"
        inputMode="numeric"
        value={values.max_size}
        error={errors.max_size}
        onChange={(event) => onChange({ ...values, max_size: event.target.value })}
      />
    </>
  );
}

function toInput(values: ClassFormValues) {
  return {
    code: values.code,
    name: values.name,
    grade_level: values.grade_level,
    room_id: values.room_id || null,
    max_size: values.max_size === '' ? Number.NaN : Number(values.max_size),
  };
}

function StaffPanel({
  classRecord,
  canManage,
  onChanged,
}: {
  classRecord: ClassRecord;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AssignmentRole>('homeroom');
  const [staffUserId, setStaffUserId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const staff = useQuery({
    queryKey: ['staff-directory', role, classRecord.org_unit_id],
    queryFn: () => listStaff(role === 'homeroom' ? 'VT-07' : 'VT-08', classRecord.org_unit_id),
    enabled: canManage && classRecord.status === 'active',
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['classes'] });
  const add = useMutation({
    mutationFn: () =>
      addAssignment(classRecord.id, {
        staff_user_id: staffUserId,
        assignment_role: role,
        subject_name: role === 'subject' ? subjectName : null,
      }),
    onSuccess: async () => {
      setStaffUserId('');
      setSubjectName('');
      await refresh();
      onChanged('Đã phân công giáo viên');
    },
  });
  const end = useMutation({
    mutationFn: (assignmentId: string) => endAssignment(classRecord.id, assignmentId),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã kết thúc phân công');
    },
  });
  const errors = fieldErrorsOf(add.error);

  return (
    <div
      className="flex flex-col gap-3 rounded-lg bg-page p-3"
      aria-label={`Giáo viên lớp ${classRecord.name}`}
      role="region"
    >
      {classRecord.staff.length === 0 ? (
        <p className="text-label text-text-secondary">Chưa phân công giáo viên.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {classRecord.staff.map((assignment) => (
            <li key={assignment.id} className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{assignment.staff_name}</span>
              <StatusBadge tone="info" label={ASSIGNMENT_ROLE_LABELS[assignment.assignment_role]} />
              {assignment.subject_name ? <span className="text-label">{assignment.subject_name}</span> : null}
              <span className="text-label text-text-secondary">từ {assignment.from_date}</span>
              {canManage ? (
                <Button variant="text" disabled={end.isPending} onClick={() => end.mutate(assignment.id)}>
                  Kết thúc phân công
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {end.error ? <Alert tone="danger">{messageOf(end.error)}</Alert> : null}
      {canManage && classRecord.status === 'active' ? (
        <div className="flex flex-col gap-2">
          {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Vai trò trong lớp
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as AssignmentRole);
                  setStaffUserId('');
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              >
                <option value="homeroom">Chủ nhiệm</option>
                <option value="subject">Bộ môn</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Giáo viên
              <select
                value={staffUserId}
                onChange={(event) => setStaffUserId(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              >
                <option value="">Chọn giáo viên</option>
                {(staff.data ?? []).map((entry) => (
                  <option key={entry.user_id} value={entry.user_id}>
                    {entry.full_name}
                  </option>
                ))}
              </select>
              {errors.staff_user_id ? <span className="text-label text-danger">{errors.staff_user_id}</span> : null}
            </label>
            {role === 'subject' ? (
              <TextField
                label="Môn dạy"
                value={subjectName}
                error={errors.subject_name}
                onChange={(event) => setSubjectName(event.target.value)}
              />
            ) : null}
            <Button disabled={add.isPending || staffUserId === ''} onClick={() => add.mutate()}>
              Phân công
            </Button>
          </div>
          {staff.isError ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
        </div>
      ) : null}
    </div>
  );
}

function ClassRow({
  classRecord,
  gradeLevels,
  rooms,
  canManage,
  onChanged,
}: {
  classRecord: ClassRecord;
  gradeLevels: GradeLevel[];
  rooms: Room[];
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [values, setValues] = useState<ClassFormValues>({
    code: classRecord.code,
    name: classRecord.name,
    grade_level: classRecord.grade_level,
    room_id: classRecord.room_id ?? '',
    max_size: String(classRecord.max_size),
  });
  const update = useMutation({
    mutationFn: (changes: Parameters<typeof updateClass>[1]) => updateClass(classRecord.id, changes),
    onSuccess: async (_updated, changes) => {
      setEditing(false);
      setConfirmingClose(false);
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      onChanged(
        changes.status === 'closed' ? 'Đã đóng lớp' : changes.status === 'active' ? 'Đã mở lại lớp' : 'Đã lưu lớp',
      );
    },
    onError: () => setConfirmingClose(false),
  });
  const gradeName =
    gradeLevels.find((level) => level.code === classRecord.grade_level)?.name ?? classRecord.grade_level;
  const roomName = rooms.find((room) => room.id === classRecord.room_id)?.name ?? '';
  const homeroomNames = classRecord.staff
    .filter((assignment) => assignment.assignment_role === 'homeroom')
    .map((assignment) => assignment.staff_name)
    .join(', ');

  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="px-3 py-2">{classRecord.code}</td>
        <td className="px-3 py-2 font-medium">{classRecord.name}</td>
        <td className="px-3 py-2">{gradeName}</td>
        <td className="px-3 py-2">{roomName}</td>
        <td className="px-3 py-2">
          {classRecord.enrolled_count}/{classRecord.max_size}
        </td>
        <td className="px-3 py-2">{homeroomNames}</td>
        <td className="px-3 py-2">
          <StatusBadge
            tone={classRecord.status === 'active' ? 'success' : 'neutral'}
            label={classRecord.status === 'active' ? 'Đang dùng' : 'Đã đóng'}
          />
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <Button variant="text" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Ẩn giáo viên' : 'Giáo viên'}
          </Button>
          {canManage ? (
            <>
              <Button variant="text" onClick={() => setEditing(!editing)}>
                Sửa
              </Button>
              {classRecord.status === 'active' ? (
                <Button variant="text" onClick={() => setConfirmingClose(true)}>
                  Đóng lớp
                </Button>
              ) : (
                <Button variant="text" onClick={() => update.mutate({ status: 'active' })}>
                  Mở lại
                </Button>
              )}
            </>
          ) : null}
        </td>
      </tr>
      {update.error ? (
        <tr>
          <td colSpan={8} className="px-3 pb-2">
            <Alert tone="danger">{messageOf(update.error)}</Alert>
          </td>
        </tr>
      ) : null}
      {editing ? (
        <tr>
          <td colSpan={8} className="px-3 pb-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <ClassFields
                values={values}
                onChange={setValues}
                gradeLevels={gradeLevels}
                rooms={rooms}
                errors={fieldErrorsOf(update.error)}
              />
              <div className="flex items-end gap-2">
                <Button disabled={update.isPending} onClick={() => update.mutate(toInput(values))}>
                  Lưu
                </Button>
                <Button variant="text" onClick={() => setEditing(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
      {expanded ? (
        <tr>
          <td colSpan={8} className="px-3 pb-3">
            <StaffPanel classRecord={classRecord} canManage={canManage} onChanged={onChanged} />
          </td>
        </tr>
      ) : null}
      {confirmingClose ? (
        <ConfirmDialog
          open={confirmingClose}
          title={`Đóng lớp ${classRecord.name}?`}
          confirmLabel="Đóng lớp"
          busy={update.isPending}
          onCancel={() => setConfirmingClose(false)}
          onConfirm={() => update.mutate({ status: 'closed' })}
        >
          Lớp không bị xóa, vẫn giữ lịch sử, nhưng không phân công thêm giáo viên và không phân thêm trẻ. Có thể mở lại
          khi năm học còn mở.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export function ClassesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.classManage);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const emptyForm: ClassFormValues = { code: '', name: '', grade_level: '', room_id: '', max_size: '' };
  const [form, setForm] = useState<ClassFormValues>(emptyForm);

  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const rooms = useQuery({
    queryKey: ['rooms', orgUnitId],
    queryFn: () => listRooms(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const settings = useQuery({
    queryKey: ['settings', orgUnitId],
    queryFn: () => readSettings(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined && canManage,
  });
  // Điền sẵn sĩ số tối đa theo cấu hình của đơn vị (BR-04); người dùng vẫn sửa được
  const configuredMaxSize = settings.data?.find((setting) => setting.key === 'max_class_size')?.value;
  useEffect(() => {
    setForm((current) => ({
      ...current,
      max_size: typeof configuredMaxSize === 'number' ? String(configuredMaxSize) : current.max_size,
    }));
  }, [configuredMaxSize, orgUnitId]);

  const activeGradeLevels = (gradeLevels.data ?? []).filter((level) => level.status === 'active');
  const activeRooms = (rooms.data ?? []).filter((room) => room.status === 'active');
  const create = useMutation({
    mutationFn: () => createClass({ org_unit_id: orgUnitId ?? '', ...toInput(form) }),
    onSuccess: async (created) => {
      setForm({ ...emptyForm, max_size: form.max_size });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      setToastMessage(`Đã tạo lớp ${created.name}`);
    },
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Lớp học</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {!orgUnitId && !unitChoice.isPending ? (
          <Alert tone="warning">Chưa có đơn vị. Hãy mở năm học và tạo cây đơn vị trước.</Alert>
        ) : null}
        {canManage && orgUnitId ? (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Tạo lớp">
            <h2 className="text-section-title font-semibold text-text">Tạo lớp</h2>
            {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <ClassFields
                values={form}
                onChange={setForm}
                gradeLevels={activeGradeLevels}
                rooms={activeRooms}
                errors={fieldErrorsOf(create.error)}
              />
            </div>
            <div>
              <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
                Tạo lớp
              </Button>
            </div>
          </section>
        ) : null}
        <section className="rounded-xl border border-border bg-card p-4" aria-label="Danh sách lớp">
          {classes.isPending && orgUnitId ? (
            <div className="h-32 animate-pulse rounded bg-border" aria-hidden="true" />
          ) : null}
          {classes.isError ? <Alert tone="danger">{messageOf(classes.error)}</Alert> : null}
          {classes.data && classes.data.length === 0 ? (
            <p className="text-content text-text-secondary">Đơn vị chưa có lớp.</p>
          ) : null}
          {classes.data && classes.data.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Mã lớp</th>
                  <th className="px-3 py-2">Tên lớp</th>
                  <th className="px-3 py-2">Bậc học</th>
                  <th className="px-3 py-2">Phòng</th>
                  <th className="px-3 py-2">Sĩ số</th>
                  <th className="px-3 py-2">Chủ nhiệm</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {classes.data.map((classRecord) => (
                  <ClassRow
                    key={classRecord.id}
                    classRecord={classRecord}
                    gradeLevels={gradeLevels.data ?? []}
                    rooms={rooms.data ?? []}
                    canManage={canManage}
                    onChanged={setToastMessage}
                  />
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
