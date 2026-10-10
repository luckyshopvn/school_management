import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  checkIn,
  checkOut,
  describeDay,
  formatMinutes,
  readAttendanceSheet,
  readMyAttendance,
  saveAttendanceLog,
  type AttendanceLog,
  type AttendanceSheet,
  type StaffDay,
} from './staff-attendance-api.js';

// MH-44 và MH-13 Chấm công (P08-01, BR-39, YCTD-59): nhân sự tự bấm vào ca, ra ca hôm nay theo giờ máy chủ; người có quyền xem
// bảng chấm công của đơn vị theo tháng; phòng nhân sự nhập hoặc sửa giờ của một ngày
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);

function lateText(log: AttendanceLog): string {
  const parts = [];
  if (log.late_minutes) {
    parts.push(`muộn ${log.late_minutes} phút`);
  }
  if (log.early_leave_minutes) {
    parts.push(`về sớm ${log.early_leave_minutes} phút`);
  }
  return parts.join(', ');
}

function dayCellClass(day: StaffDay): string {
  if (day.kind === 'work') {
    return '';
  }
  return day.kind === 'rest' ? 'bg-page text-text-muted' : 'bg-selected';
}

function MyAttendanceSection({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(vietnamMonth);
  const mine = useQuery({ queryKey: ['my-attendance', month], queryFn: () => readMyAttendance(month), retry: false });
  const refresh = (data: Awaited<ReturnType<typeof checkIn>>) => {
    queryClient.setQueryData(['my-attendance', data.today.slice(0, 7)], data);
  };
  const enter = useMutation({
    mutationFn: checkIn,
    onSuccess: (data) => {
      refresh(data);
      onChanged(`Đã vào ca lúc ${data.today_log?.check_in ?? ''}`);
    },
  });
  const leave = useMutation({
    mutationFn: checkOut,
    onSuccess: (data) => {
      refresh(data);
      onChanged(`Đã ra ca lúc ${data.today_log?.check_out ?? ''}`);
    },
  });

  if (mine.error instanceof ApiError && mine.error.status === 404) {
    return (
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Chấm công của tôi">
        <h2 className="text-section-title font-semibold text-text">Chấm công của tôi</h2>
        <p className="mt-2 text-content text-text-secondary">
          Tài khoản chưa gắn với hồ sơ nhân sự nên chưa tự chấm công được. Liên hệ phòng nhân sự để liên kết.
        </p>
      </section>
    );
  }
  const data = mine.data;
  const todayLog = data?.today_log ?? null;
  const days = new Map((data?.days ?? []).map((day) => [day.date, day]));

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Chấm công của tôi">
      <h2 className="text-section-title font-semibold text-text">Chấm công của tôi</h2>
      {mine.error ? <Alert tone="danger">{messageOf(mine.error)}</Alert> : null}
      {data ? (
        <>
          <p className="text-content text-text">
            Hôm nay {data.today}:{' '}
            {todayLog
              ? `vào ca ${todayLog.check_in}${todayLog.check_out ? `, ra ca ${todayLog.check_out}` : ', chưa ra ca'}`
              : 'chưa vào ca'}
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              disabled={enter.isPending || Boolean(todayLog) || data.staff.status !== 'active'}
              onClick={() => enter.mutate()}
            >
              Vào ca
            </Button>
            <Button
              variant="secondary"
              disabled={leave.isPending || !todayLog || data.staff.status !== 'active'}
              onClick={() => leave.mutate()}
            >
              Ra ca
            </Button>
          </div>
        </>
      ) : null}
      {enter.error ? <Alert tone="danger">{messageOf(enter.error)}</Alert> : null}
      {leave.error ? <Alert tone="danger">{messageOf(leave.error)}</Alert> : null}
      <div className="w-48">
        <TextField label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      {data && data.logs.length === 0 ? (
        <p className="text-content text-text-secondary">Tháng này chưa có chấm công.</p>
      ) : null}
      {data && data.logs.length > 0 ? (
        <table className="w-full text-content" aria-label="Chấm công trong tháng">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Loại ngày</th>
              <th className="px-3 py-2">Giờ vào</th>
              <th className="px-3 py-2">Giờ ra</th>
              <th className="px-3 py-2">Số giờ làm</th>
              <th className="px-3 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((log) => {
              const day = days.get(log.work_date);
              return (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-3 py-2">{log.work_date}</td>
                  <td className="px-3 py-2">{day ? describeDay(day) : ''}</td>
                  <td className="px-3 py-2">{log.check_in}</td>
                  <td className="px-3 py-2">{log.check_out ?? ''}</td>
                  <td className="px-3 py-2">{formatMinutes(log.worked_minutes)}</td>
                  <td className="px-3 py-2">{[lateText(log), log.note].filter(Boolean).join('. ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function AttendanceLogForm({ sheet, onSaved }: { sheet: AttendanceSheet; onSaved(message: string): void }) {
  const [staffId, setStaffId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () =>
      saveAttendanceLog({
        staff_id: staffId,
        work_date: workDate,
        check_in: checkInTime,
        check_out: checkOutTime || null,
        note: note || null,
      }),
    onSuccess: (log) => {
      setNote('');
      onSaved(`Đã lưu chấm công ngày ${log.work_date}`);
    },
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Nhập giờ chấm công"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Nhập giờ chấm công</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="text-label font-medium text-text">
          Nhân sự
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
            <option value="">Chọn nhân sự</option>
            {sheet.staff.map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} – {row.full_name}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Ngày chấm công"
          type="date"
          max={sheet.today}
          value={workDate}
          onChange={(event) => setWorkDate(event.target.value)}
        />
        <TextField
          label="Giờ vào"
          type="time"
          value={checkInTime}
          onChange={(event) => setCheckInTime(event.target.value)}
        />
        <TextField
          label="Giờ ra"
          type="time"
          value={checkOutTime}
          onChange={(event) => setCheckOutTime(event.target.value)}
        />
        <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu chấm công
        </Button>
      </div>
    </form>
  );
}

function AttendanceSheetSection({ onChanged }: { onChanged(message: string): void }) {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(vietnamMonth);
  const sheet = useQuery({
    queryKey: ['attendance-sheet', orgUnitId, month],
    queryFn: () => readAttendanceSheet(orgUnitId ?? '', month),
    enabled: Boolean(orgUnitId) && /^\d{4}-\d{2}$/.test(month),
  });
  const data = sheet.data;
  const hours = data?.work_hours;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <div className="w-48">
          <TextField
            label="Tháng của bảng"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>
      {sheet.error ? <Alert tone="danger">{messageOf(sheet.error)}</Alert> : null}
      {hours ? (
        <p className="text-content text-text-secondary">
          {hours.start_time && hours.end_time
            ? `Giờ làm việc ${hours.start_time} – ${hours.end_time}, nghỉ trưa ${hours.lunch_break_minutes} phút`
            : 'Đơn vị chưa cấu hình giờ vào làm và giờ tan làm nên chưa xếp đi muộn, về sớm (Cấu hình hệ thống)'}
        </p>
      ) : null}
      {data?.can_manage ? (
        <AttendanceLogForm
          sheet={data}
          onSaved={async (message) => {
            await queryClient.invalidateQueries({ queryKey: ['attendance-sheet'] });
            onChanged(message);
          }}
        />
      ) : null}
      {data ? (
        <section className="overflow-x-auto rounded-xl border border-border bg-card p-4" aria-label="Bảng chấm công">
          {data.staff.length === 0 ? (
            <p className="text-content text-text-secondary">Đơn vị chưa có nhân sự trong tháng này.</p>
          ) : (
            <table className="text-label">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card px-2 py-1 text-left">Nhân sự</th>
                  {data.days.map((day) => (
                    <th
                      key={day.date}
                      title={describeDay(day)}
                      className={`px-1 py-1 text-center font-medium ${dayCellClass(day)}`}
                    >
                      {Number(day.date.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.staff.map((row) => {
                  const logs = new Map(row.logs.map((log) => [log.work_date, log]));
                  return (
                    <tr key={row.id} className="border-t border-border" aria-label={`Chấm công của ${row.full_name}`}>
                      <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1 font-medium">{row.full_name}</td>
                      {data.days.map((day) => {
                        const log = logs.get(day.date);
                        return (
                          <td
                            key={day.date}
                            title={
                              log ? `${log.check_in} – ${log.check_out ?? '?'} ${lateText(log)}` : describeDay(day)
                            }
                            className={`min-w-12 px-1 py-1 text-center ${dayCellClass(day)} ${
                              log && (log.late_minutes || log.early_leave_minutes) ? 'text-danger' : ''
                            }`}
                          >
                            {log ? (
                              <span className="flex flex-col leading-tight">
                                <span>{log.check_in}</span>
                                <span>{log.check_out ?? '–'}</span>
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}

export function StaffAttendancePage() {
  const canView = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Chấm công</h1>
        <MyAttendanceSection onChanged={setToastMessage} />
        {canView ? <AttendanceSheetSection onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
