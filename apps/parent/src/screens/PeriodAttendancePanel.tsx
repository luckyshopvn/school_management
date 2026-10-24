import { useEffect, useState } from 'react';
import { PERIOD_ATTENDANCE_LABELS, type PeriodAttendanceStatus } from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Điểm danh theo tiết của con trong tháng (DT-20 phần 20d, YCTD-162): số tiết theo từng trạng thái và các tiết vắng, đi muộn
// do giáo viên ghi ở sổ đầu bài; chỉ hiện ở con học cấp phổ thông (LEVEL_FEATURES period_attendance)
interface ChildPeriodAttendance {
  month: string;
  counts: Record<PeriodAttendanceStatus, number>;
  records: Array<{
    lesson_date: string;
    period_no: number;
    subject_name: string;
    status: PeriodAttendanceStatus;
    note: string | null;
  }>;
}

export function PeriodAttendancePanel({ child, month }: { child: { id: string; full_name: string }; month: string }) {
  const [attendance, setAttendance] = useState<ChildPeriodAttendance>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<ChildPeriodAttendance>(`/api/v1/children/${child.id}/period-attendance?month=${month}`)
      .then(setAttendance)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, [child.id, month]);

  return (
    <section className="flex flex-col gap-2" aria-label={`Điểm danh theo tiết của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {attendance ? (
        <>
          <p className="text-content">
            {(Object.keys(PERIOD_ATTENDANCE_LABELS) as PeriodAttendanceStatus[])
              .map((status) => `${PERIOD_ATTENDANCE_LABELS[status]}: ${attendance.counts[status] ?? 0}`)
              .join(' · ')}
          </p>
          {attendance.records.length === 0 ? (
            <p className="text-content text-text-secondary">Tháng này con không vắng, không đi muộn tiết nào.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-content">
              {attendance.records.map((record) => (
                <li key={`${record.lesson_date}:${record.period_no}`}>
                  {record.lesson_date.split('-').reverse().join('/')} tiết {record.period_no} ({record.subject_name}):{' '}
                  {PERIOD_ATTENDANCE_LABELS[record.status]}
                  {record.note ? ` – ${record.note}` : ''}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
