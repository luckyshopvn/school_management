import { useEffect, useState } from 'react';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-04, MP-05 Học tập của con (P03-04, P03-06, P03-07; BR-15, BR-69; YCTD-80): thời khóa biểu tuần này và lịch hoạt
// động 14 ngày tới của lớp, phiếu tiến độ học tập đã công bố của con
interface Learning {
  class_name: string | null;
  timetable: {
    effective_from: string | null;
    slots: Array<{ id: string; weekday: number; start_time: string; end_time: string; activity_name: string }>;
  } | null;
  activities: Array<{ id: string; activity_date: string; start_time: string; end_time: string; activity_name: string }>;
  progress: Array<{
    id: string;
    period_value: string;
    domain_name: string | null;
    indicator_code: string;
    level: 'achieved' | 'developing' | 'not_yet';
    comment: string | null;
  }>;
}

const WEEKDAYS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const LEVELS = { achieved: 'Đạt', developing: 'Đang phát triển', not_yet: 'Chưa đạt' };

export function LearningPanel({ child }: { child: { id: string; full_name: string } }) {
  const [learning, setLearning] = useState<Learning>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<Learning>(`/api/v1/children/${child.id}/learning`)
      .then(setLearning)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, [child.id]);

  return (
    <section className="flex flex-col gap-3" aria-label={`Học tập của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {learning ? (
        <>
          <div className="flex flex-col gap-1">
            <h3 className="text-content font-semibold">Thời khóa biểu tuần này</h3>
            {(learning.timetable?.slots ?? []).length === 0 ? (
              <p className="text-label text-text-secondary">Chưa có thời khóa biểu đã công bố.</p>
            ) : null}
            <ul className="flex flex-col gap-1 text-label">
              {(learning.timetable?.slots ?? []).map((slot) => (
                <li key={slot.id}>
                  {WEEKDAYS[slot.weekday]} {slot.start_time}–{slot.end_time}: {slot.activity_name}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-content font-semibold">Lịch hoạt động sắp tới</h3>
            {learning.activities.length === 0 ? (
              <p className="text-label text-text-secondary">Chưa có hoạt động đã công bố.</p>
            ) : null}
            <ul className="flex flex-col gap-1 text-label">
              {learning.activities.map((activity) => (
                <li key={activity.id}>
                  {activity.activity_date} {activity.start_time}–{activity.end_time}: {activity.activity_name}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-content font-semibold">Tiến độ học tập</h3>
            {learning.progress.length === 0 ? (
              <p className="text-label text-text-secondary">Chưa có phiếu tiến độ đã công bố.</p>
            ) : null}
            <ul className="flex flex-col gap-1 text-label">
              {learning.progress.map((row) => (
                <li key={row.id}>
                  {row.period_value} · {row.domain_name ? `${row.domain_name}: ` : ''}
                  {row.indicator_code}: {LEVELS[row.level]}
                  {row.comment ? `. ${row.comment}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
