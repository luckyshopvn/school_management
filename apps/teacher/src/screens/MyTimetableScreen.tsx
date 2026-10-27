import { useEffect, useState } from 'react';
import { TIMETABLE_WEEKDAY_LABELS } from '@school-management/shared';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Lịch dạy của tôi (DT-20 phần 22c1, YCTD-160): các tiết của thời khoá biểu đang áp dụng mà tôi là giáo viên, theo thứ, kèm
// giờ tiết, lớp, môn, phòng
interface Lesson {
  id: string;
  class_name: string;
  weekday: number;
  period_no: number;
  subject_name: string;
  group_no?: number;
  room_name: string | null;
}

interface MyTimetable {
  versions: Array<{ school_level: string }>;
  slots: Record<string, Array<{ period_no: number; start_time: string; end_time: string }>>;
  lessons: Lesson[];
}

export function MyTimetableScreen({ onBack }: { onBack(): void }) {
  const [timetable, setTimetable] = useState<MyTimetable>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<MyTimetable>('/api/v1/timetables/mine')
      .then(setTimetable)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, []);

  const timeOf = (period: number) =>
    Object.values(timetable?.slots ?? {})
      .flat()
      .find((slot) => slot.period_no === period);
  const days = [...new Set((timetable?.lessons ?? []).map((lesson) => lesson.weekday))].sort(
    (left, right) => left - right,
  );

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Lịch dạy của tôi" />
      <main className="mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {timetable && timetable.lessons.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có tiết dạy trong thời khoá biểu đang áp dụng.</p>
        ) : null}
        {days.map((day) => (
          <section key={day} className="flex flex-col gap-2" aria-label={TIMETABLE_WEEKDAY_LABELS[day]}>
            <h2 className="text-section-title font-semibold text-text">{TIMETABLE_WEEKDAY_LABELS[day]}</h2>
            <ul className="flex flex-col gap-1">
              {(timetable?.lessons ?? [])
                .filter((lesson) => lesson.weekday === day)
                .map((lesson) => {
                  const time = timeOf(lesson.period_no);
                  return (
                    <li key={lesson.id} className="rounded-lg border border-border bg-card p-3 text-content">
                      <span className="font-semibold">
                        Tiết {lesson.period_no}
                        {time ? ` (${time.start_time}–${time.end_time})` : ''}
                      </span>{' '}
                      {lesson.class_name} · {lesson.subject_name}
                      {lesson.group_no ? ` (nhóm ${lesson.group_no})` : ''}
                      {lesson.room_name ? ` · ${lesson.room_name}` : ''}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
