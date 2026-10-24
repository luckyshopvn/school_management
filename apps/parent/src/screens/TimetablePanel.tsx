import { useEffect, useState } from 'react';
import { TIMETABLE_WEEKDAY_LABELS } from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Thời khoá biểu của con (DT-20 phần 22c1, YCTD-160): bản đang áp dụng của lớp con đang học, theo thứ; chỉ hiện ở con học
// cấp phổ thông (LEVEL_FEATURES period_timetable)
interface Lesson {
  id: string;
  weekday: number;
  period_no: number;
  subject_name: string;
  teacher_name: string | null;
}

interface ChildTimetable {
  slots: Record<string, Array<{ period_no: number; start_time: string; end_time: string }>>;
  lessons: Lesson[];
}

export function TimetablePanel({ child }: { child: { id: string; full_name: string } }) {
  const [timetable, setTimetable] = useState<ChildTimetable>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<ChildTimetable>(`/api/v1/children/${child.id}/timetable`)
      .then(setTimetable)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, [child.id]);

  const timeOf = (period: number) =>
    Object.values(timetable?.slots ?? {})
      .flat()
      .find((slot) => slot.period_no === period);
  const days = [...new Set((timetable?.lessons ?? []).map((lesson) => lesson.weekday))].sort(
    (left, right) => left - right,
  );

  return (
    <section className="flex flex-col gap-3" aria-label={`Thời khoá biểu của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {timetable && timetable.lessons.length === 0 ? (
        <p className="text-content text-text-secondary">Lớp chưa có thời khoá biểu đang áp dụng.</p>
      ) : null}
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-1">
          <h3 className="text-content font-semibold">{TIMETABLE_WEEKDAY_LABELS[day]}</h3>
          <ul className="flex flex-col gap-1 text-content">
            {(timetable?.lessons ?? [])
              .filter((lesson) => lesson.weekday === day)
              .map((lesson) => {
                const time = timeOf(lesson.period_no);
                return (
                  <li key={lesson.id}>
                    Tiết {lesson.period_no}
                    {time ? ` (${time.start_time})` : ''}: {lesson.subject_name}
                    {lesson.teacher_name ? ` · ${lesson.teacher_name}` : ''}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}
