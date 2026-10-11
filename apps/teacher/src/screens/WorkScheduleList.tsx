import { useEffect, useState } from 'react';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MG-12 Lịch công tác của tôi (P08-02, YCTD-68): lịch nghỉ và lịch công tác đã công bố của tháng này và tháng sau
interface WorkSchedule {
  id: string;
  schedule_date: string;
  schedule_type: 'business_trip' | 'day_off';
  note: string | null;
}

const TYPE_LABELS = { business_trip: 'Công tác', day_off: 'Nghỉ theo lịch' } as const;

function months(): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const next = new Date(Date.parse(`${today.slice(0, 7)}-01T00:00:00Z`) + 32 * 86_400_000).toISOString().slice(0, 7);
  return [today.slice(0, 7), next];
}

export function WorkScheduleList() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    Promise.all(months().map((month) => requestJson<WorkSchedule[]>(`/api/v1/me/work-schedules?month=${month}`)))
      .then((lists) => setSchedules(lists.flat()))
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, []);

  if (errorMessage) {
    return <Alert tone="danger">{errorMessage}</Alert>;
  }
  return (
    <ul className="flex flex-col gap-1 text-content" aria-label="Lịch công tác của tôi">
      {schedules?.length === 0 ? <li className="text-text-secondary">Chưa có lịch công tác.</li> : null}
      {(schedules ?? []).map((row) => (
        <li key={row.id}>
          {row.schedule_date}: {TYPE_LABELS[row.schedule_type]}
          {row.note ? ` — ${row.note}` : ''}
        </li>
      ))}
    </ul>
  );
}
