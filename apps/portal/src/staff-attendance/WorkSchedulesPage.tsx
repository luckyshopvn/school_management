import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';

// MH-56 Lịch nghỉ và lịch công tác (P08-02, YCTD-68): phòng nhân sự, quản lý đơn vị lập lịch nháp theo tháng rồi công bố
// cho nhân sự; xóa lịch khi kỳ công còn mở
interface WorkSchedule {
  id: string;
  staff_id: string;
  full_name: string;
  schedule_date: string;
  schedule_type: 'business_trip' | 'day_off';
  note: string | null;
  status: 'draft' | 'published';
}

const TYPE_LABELS = { business_trip: 'Công tác', day_off: 'Nghỉ theo lịch' } as const;
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function WorkSchedulesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.workScheduleManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [month, setMonth] = useState(vietnamMonth);
  const [staffId, setStaffId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleType, setScheduleType] = useState<'business_trip' | 'day_off'>('business_trip');
  const [note, setNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const schedules = useQuery({
    queryKey: ['work-schedules', orgUnitId, month],
    queryFn: () => requestJson<WorkSchedule[]>(`/api/v1/work-schedules?org_unit_id=${orgUnitId}&month=${month}`),
    enabled: Boolean(orgUnitId) && /^\d{4}-\d{2}$/.test(month),
  });
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, ''],
    queryFn: () => listStaff(orgUnitId ?? '', ''),
    enabled: Boolean(orgUnitId) && canManage,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
    setToastMessage(message);
  };
  const create = useMutation({
    mutationFn: () =>
      requestJson('/api/v1/work-schedules', {
        method: 'POST',
        body: JSON.stringify({
          staff_id: staffId,
          schedule_date: scheduleDate,
          schedule_type: scheduleType,
          note: note || null,
        }),
      }),
    onSuccess: () => {
      setNote('');
      return refresh('Đã thêm lịch nháp');
    },
  });
  const publish = useMutation({
    mutationFn: () =>
      requestJson<{ published_count: number }>('/api/v1/work-schedules/publish', {
        method: 'POST',
        body: JSON.stringify({ org_unit_id: orgUnitId, month }),
      }),
    onSuccess: (result) => refresh(`Đã công bố ${result.published_count} lịch`),
  });
  const remove = useMutation({
    mutationFn: (scheduleId: string) => requestJson(`/api/v1/work-schedules/${scheduleId}`, { method: 'DELETE' }),
    onSuccess: () => refresh('Đã xóa lịch'),
  });
  const error = [schedules.error, create.error, publish.error, remove.error].find(Boolean);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Lịch công tác</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <div className="w-48">
            <TextField
              label="Tháng của lịch"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          {canManage ? (
            <Button disabled={publish.isPending} onClick={() => publish.mutate()}>
              Công bố lịch tháng
            </Button>
          ) : null}
        </div>

        {canManage ? (
          <form
            aria-label="Thêm lịch"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label className="text-label font-medium text-text">
              Nhân sự
              <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
                <option value="">Chọn nhân sự</option>
                {(staff.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Ngày"
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
            />
            <label className="text-label font-medium text-text">
              Loại lịch
              <select
                value={scheduleType}
                onChange={(event) => setScheduleType(event.target.value as 'business_trip' | 'day_off')}
                className={selectClass}
              >
                <option value="business_trip">Công tác</option>
                <option value="day_off">Nghỉ theo lịch</option>
              </select>
            </label>
            <TextField label="Ghi chú lịch" value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending || staffId === '' || scheduleDate === ''}
              >
                Thêm lịch
              </Button>
            </div>
          </form>
        ) : null}

        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Ngày</th>
              <th>Nhân sự</th>
              <th>Loại</th>
              <th>Ghi chú</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(schedules.data ?? []).map((row) => (
              <tr
                key={row.id}
                className="border-t border-border"
                aria-label={`Lịch của ${row.full_name} ngày ${row.schedule_date}`}
              >
                <td className="py-2">{row.schedule_date}</td>
                <td>{row.full_name}</td>
                <td>{TYPE_LABELS[row.schedule_type]}</td>
                <td>{row.note}</td>
                <td>{row.status === 'published' ? 'Đã công bố' : 'Nháp'}</td>
                <td>
                  {canManage ? (
                    <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate(row.id)}>
                      Xóa
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.data?.length === 0 ? (
          <p className="text-content text-text-secondary">Tháng này chưa có lịch.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
