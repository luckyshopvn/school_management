import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, TextField, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createHoliday,
  createSchoolDayChange,
  deleteHoliday,
  deleteSchoolDayChange,
  listSchoolDays,
  SCHOOL_DAY_CHANGE_LABELS,
  updateHoliday,
  type Holiday,
  type SchoolDayChange,
  type SchoolDayChangeType,
} from './staff-attendance-api.js';

// MH-37 Ngày lễ và lịch bù (P08-09, P08-10; BR-84; YCTD-59): lịch chung toàn trường theo năm dương lịch. Phòng nhân sự
// gán ở Trường chính lập ngày nghỉ lễ; Ban Giám hiệu lập ngày học bù thứ bảy và ngày nghỉ bù. Chỉ đổi ngày từ ngày mai
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const weekdayName = (date: string) => WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';

function HolidayForm({ onSaved }: { onSaved(message: string): void }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [paid, setPaid] = useState('co');
  const save = useMutation({
    mutationFn: () => createHoliday({ holiday_date: date, name, is_paid: paid === 'co' }),
    onSuccess: (holiday) => {
      setDate('');
      setName('');
      onSaved(`Đã thêm ngày lễ ${holiday.holiday_date}`);
    },
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm ngày nghỉ lễ"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField label="Ngày lễ" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <TextField label="Tên ngày lễ" value={name} onChange={(event) => setName(event.target.value)} />
        <label className="text-label font-medium text-text">
          Hưởng lương
          <select value={paid} onChange={(event) => setPaid(event.target.value)} className={selectClass}>
            <option value="co">Có hưởng lương</option>
            <option value="khong">Không hưởng lương</option>
          </select>
        </label>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Thêm ngày lễ
        </Button>
      </div>
    </form>
  );
}

function ChangeForm({ onSaved }: { onSaved(message: string): void }) {
  const [date, setDate] = useState('');
  const [changeType, setChangeType] = useState<SchoolDayChangeType>('makeup_school_day');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => createSchoolDayChange({ change_date: date, change_type: changeType, note: note || null }),
    onSuccess: (change) => {
      setDate('');
      setNote('');
      onSaved(`Đã thêm ${SCHOOL_DAY_CHANGE_LABELS[change.change_type].toLowerCase()} ngày ${change.change_date}`);
    },
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm ngày học bù hoặc nghỉ bù"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Loại lịch
          <select
            value={changeType}
            onChange={(event) => setChangeType(event.target.value as SchoolDayChangeType)}
            className={selectClass}
          >
            <option value="makeup_school_day">Học bù thứ bảy</option>
            <option value="compensatory_day_off">Nghỉ bù (thứ hai đến thứ sáu)</option>
          </select>
        </label>
        <TextField label="Ngày áp dụng" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <TextField label="Ghi chú lịch" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Thêm lịch
        </Button>
      </div>
    </form>
  );
}

function HolidayRow({
  holiday,
  canManage,
  onChanged,
  onDelete,
}: {
  holiday: Holiday;
  canManage: boolean;
  onChanged(message: string): void;
  onDelete(holiday: Holiday): void;
}) {
  const toggle = useMutation({
    mutationFn: () => updateHoliday(holiday.id, { name: holiday.name, is_paid: !holiday.is_paid }),
    onSuccess: () => onChanged('Đã đổi hưởng lương của ngày lễ'),
  });
  return (
    <tr className="border-t border-border" aria-label={`Ngày lễ ${holiday.holiday_date}`}>
      <td className="px-3 py-2">{holiday.holiday_date}</td>
      <td className="px-3 py-2">{weekdayName(holiday.holiday_date)}</td>
      <td className="px-3 py-2 font-medium">{holiday.name}</td>
      <td className="px-3 py-2">{holiday.is_paid ? 'Có' : 'Không'}</td>
      <td className="px-3 py-2 text-right">
        {canManage ? (
          <span className="flex justify-end gap-2">
            <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
              {holiday.is_paid ? 'Đổi thành không lương' : 'Đổi thành có lương'}
            </Button>
            <Button variant="text" onClick={() => onDelete(holiday)}>
              Xóa
            </Button>
          </span>
        ) : null}
        {toggle.error ? <p className="text-label text-danger">{messageOf(toggle.error)}</p> : null}
      </td>
    </tr>
  );
}

export function SchoolDaysPage() {
  const canManageHolidays = useHasPermission(PERMISSION_CODES.holidayManage);
  const canManageChanges = useHasPermission(PERMISSION_CODES.schoolDayChangeManage);
  const queryClient = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const schoolDays = useQuery({ queryKey: ['school-days', year], queryFn: () => listSchoolDays(year) });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'holiday'; holiday: Holiday } | { kind: 'change'; change: SchoolDayChange }
  >();
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['school-days'] });
    setToastMessage(message);
  };
  const remove = useMutation({
    mutationFn: () =>
      pendingDelete?.kind === 'holiday'
        ? deleteHoliday(pendingDelete.holiday.id)
        : deleteSchoolDayChange(pendingDelete?.change.id ?? ''),
    onSuccess: async () => {
      setPendingDelete(undefined);
      await refresh('Đã xóa khỏi lịch');
    },
  });
  const holidays = schoolDays.data?.holidays ?? [];
  const changes = schoolDays.data?.changes ?? [];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Xóa khỏi lịch"
        confirmLabel="Xóa"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setPendingDelete(undefined);
          remove.reset();
        }}
      >
        <p>
          {pendingDelete?.kind === 'holiday'
            ? `Xóa ngày lễ ${pendingDelete.holiday.holiday_date} (${pendingDelete.holiday.name})?`
            : `Xóa lịch ngày ${pendingDelete?.change.change_date ?? ''}?`}
        </p>
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      </ConfirmDialog>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Ngày lễ và lịch bù</h1>
        <p className="text-content text-text-secondary">
          Lịch chung toàn trường. Thứ bảy mặc định nghỉ. Ngày lễ và ngày nghỉ bù trẻ không học, nhân sự nghỉ; ngày học
          bù thứ bảy là ngày học của mọi lớp và ngày làm việc của mọi nhân sự.
        </p>
        <div className="w-40">
          <TextField
            label="Năm"
            type="number"
            value={String(year)}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </div>
        {schoolDays.error ? <Alert tone="danger">{messageOf(schoolDays.error)}</Alert> : null}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Ngày nghỉ lễ">
          <h2 className="text-section-title font-semibold text-text">Ngày nghỉ lễ</h2>
          {canManageHolidays ? <HolidayForm onSaved={refresh} /> : null}
          {schoolDays.data && holidays.length === 0 ? (
            <p className="text-content text-text-secondary">Năm này chưa có ngày nghỉ lễ.</p>
          ) : null}
          {holidays.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Thứ</th>
                  <th className="px-3 py-2">Tên ngày lễ</th>
                  <th className="px-3 py-2">Hưởng lương</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <HolidayRow
                    key={holiday.id}
                    holiday={holiday}
                    canManage={canManageHolidays}
                    onChanged={refresh}
                    onDelete={(target) => setPendingDelete({ kind: 'holiday', holiday: target })}
                  />
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Lịch học bù và nghỉ bù"
        >
          <h2 className="text-section-title font-semibold text-text">Lịch học bù và nghỉ bù</h2>
          {canManageChanges ? <ChangeForm onSaved={refresh} /> : null}
          {schoolDays.data && changes.length === 0 ? (
            <p className="text-content text-text-secondary">Năm này chưa có lịch học bù hoặc nghỉ bù.</p>
          ) : null}
          {changes.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Thứ</th>
                  <th className="px-3 py-2">Loại lịch</th>
                  <th className="px-3 py-2">Ghi chú</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.id} className="border-t border-border" aria-label={`Lịch ngày ${change.change_date}`}>
                    <td className="px-3 py-2">{change.change_date}</td>
                    <td className="px-3 py-2">{weekdayName(change.change_date)}</td>
                    <td className="px-3 py-2 font-medium">{SCHOOL_DAY_CHANGE_LABELS[change.change_type]}</td>
                    <td className="px-3 py-2">{change.note ?? ''}</td>
                    <td className="px-3 py-2 text-right">
                      {canManageChanges ? (
                        <Button variant="text" onClick={() => setPendingDelete({ kind: 'change', change })}>
                          Xóa
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
