import { useCallback, useEffect, useState } from 'react';
import {
  LESSON_RATINGS,
  PERIOD_ATTENDANCE_LABELS,
  type LessonRating,
  type LessonRatingSettings,
  type PeriodAttendanceStatus,
} from '@school-management/shared';
import { Alert, ApplicationHeader, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Sổ đầu bài (DT-20 phần 20d, YCTD-162): các tiết tôi dạy trong ngày theo thời khoá biểu đang áp dụng; mở một tiết ghi tên
// bài, nội dung, nhận xét, xếp loại tiết và điểm danh từng học sinh (mặc định có mặt, có báo vắng thì vắng có phép), rồi ký sổ.
// THCS, THPT (DT-21 phần 21d, YCTD-171): tiết nhóm (21b) ghi riêng, danh sách là học sinh của nhóm; nhãn và quy tắc xếp loại
// tiết theo cấp (bắt buộc khi ký, tiết C, D phải nhận xét); xem sơ đồ chỗ ngồi đang dùng của lớp
interface MyLesson {
  class_id: string;
  class_name: string;
  period_no: number;
  group_no: number;
  subject_name: string;
  log: { id: string; status: 'draft' | 'signed'; lesson_title: string } | null;
}

interface LessonDetail {
  subject_name: string | null;
  log: {
    id: string;
    lesson_title: string;
    content: string | null;
    comment: string | null;
    rating: string | null;
    status: 'draft' | 'signed';
  } | null;
  week_signed: boolean;
  can_edit: boolean;
  group_filtered: boolean;
  rating: LessonRatingSettings;
  seating: {
    effective_from: string;
    desk_columns: number;
    desk_rows: number;
    seats_per_desk: number;
    assignments: Array<{ child_id: string; full_name: string; column_no: number; row_no: number; seat_no: number }>;
  } | null;
  students: Array<{
    child_id: string;
    full_name: string;
    absence_reason: string | null;
    status: PeriodAttendanceStatus;
    note: string | null;
  }>;
}

const STATUSES = Object.keys(PERIOD_ATTENDANCE_LABELS) as PeriodAttendanceStatus[];
const groupText = (groupNo: number) => (groupNo > 0 ? ` · Nhóm ${groupNo}` : '');

// Sơ đồ chỗ ngồi chỉ xem: bàn giáo viên ở trên, mỗi dãy một cột
function SeatingView({ seating }: { seating: NonNullable<LessonDetail['seating']> }) {
  const rows = Array.from({ length: seating.desk_rows }, (_value, index) => index + 1);
  const columns = Array.from({ length: seating.desk_columns }, (_value, index) => index + 1);
  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="text-content font-semibold">Sơ đồ chỗ ngồi</summary>
      <div className="mt-2 text-label text-text-secondary">Bàn giáo viên ở trên</div>
      <div
        className="mt-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${seating.desk_columns}, minmax(0, 1fr))` }}
      >
        {rows.flatMap((row) =>
          columns.map((column) => (
            <div
              key={`${column}:${row}`}
              className="rounded-md border border-border p-1 text-label"
              aria-label={`Dãy ${column} bàn ${row}`}
            >
              {seating.assignments
                .filter((seat) => seat.column_no === column && seat.row_no === row)
                .sort((left, right) => left.seat_no - right.seat_no)
                .map((seat) => (
                  <div key={seat.child_id}>{seat.full_name}</div>
                ))}
            </div>
          )),
        )}
      </div>
    </details>
  );
}

const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';

function LessonForm({ lesson, date, onDone }: { lesson: MyLesson; date: string; onDone(message: string): void }) {
  const [detail, setDetail] = useState<LessonDetail>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState('');
  const [marks, setMarks] = useState<Record<string, PeriodAttendanceStatus>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<LessonDetail>(
      `/api/v1/class-logs/lesson?class_id=${lesson.class_id}&date=${date}&period_no=${lesson.period_no}&group_no=${lesson.group_no}`,
    )
      .then((loaded) => {
        setDetail(loaded);
        setTitle(loaded.log?.lesson_title ?? '');
        setContent(loaded.log?.content ?? '');
        setComment(loaded.log?.comment ?? '');
        setRating(loaded.log?.rating ?? '');
        setMarks(Object.fromEntries(loaded.students.map((student) => [student.child_id, student.status])));
      })
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [lesson, date]);

  const save = async (andSign: boolean) => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const saved = await requestJson<{ id: string }>('/api/v1/class-logs', {
        method: 'PUT',
        body: JSON.stringify({
          class_id: lesson.class_id,
          lesson_date: date,
          period_no: lesson.period_no,
          group_no: lesson.group_no,
          lesson_title: title,
          content: content || null,
          comment: comment || null,
          rating: rating || null,
          attendance: Object.entries(marks).map(([child_id, status]) => ({ child_id, status })),
        }),
      });
      if (andSign) {
        await requestJson(`/api/v1/class-logs/${saved.id}/sign`, { method: 'POST' });
      }
      onDone(andSign ? 'Đã ghi và ký sổ tiết dạy' : 'Đã lưu tiết dạy');
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null;
  }
  const readOnly = !detail.can_edit;
  return (
    <section className="flex flex-col gap-3" aria-label="Ghi tiết dạy">
      <h2 className="text-section-title font-semibold text-text">
        Tiết {lesson.period_no} · {lesson.class_name} · {lesson.subject_name}
        {groupText(lesson.group_no)}
      </h2>
      {lesson.group_no > 0 && !detail.group_filtered ? (
        <Alert tone="info">Lớp chưa đăng ký tổ hợp có môn này nên danh sách là cả lớp.</Alert>
      ) : null}
      {detail.week_signed ? <Alert tone="info">Ban giám hiệu đã ký sổ tuần này, không sửa được.</Alert> : null}
      {detail.log?.status === 'signed' ? <Alert tone="success">Tiết đã ký sổ.</Alert> : null}
      <label className="text-label font-medium text-text">
        Tên bài
        <input
          aria-label="Tên bài"
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={title}
          disabled={readOnly}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Nội dung
        <textarea
          aria-label="Nội dung"
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={content}
          disabled={readOnly}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Nhận xét tiết
        <textarea
          aria-label="Nhận xét tiết"
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={comment}
          disabled={readOnly}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {detail.rating.rating_mode === 'off' ? null : (
        <label className="text-label font-medium text-text">
          Xếp loại tiết{detail.rating.rating_mode === 'required' ? ' (bắt buộc khi ký sổ)' : ''}
          <select
            aria-label="Xếp loại tiết"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={rating}
            disabled={readOnly}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="">Chưa xếp loại</option>
            {LESSON_RATINGS.map((item: LessonRating) => (
              <option key={item} value={item}>
                {item} ({detail.rating.rating_labels[item]})
              </option>
            ))}
          </select>
        </label>
      )}
      {detail.rating.low_rating_comment && (rating === 'C' || rating === 'D') && !comment.trim() ? (
        <Alert tone="info">Tiết xếp loại {rating} cần ghi nhận xét tiết.</Alert>
      ) : null}
      {detail.seating ? <SeatingView seating={detail.seating} /> : null}
      <ul className="flex flex-col gap-2" aria-label="Điểm danh học sinh">
        {detail.students.map((student) => (
          <li key={student.child_id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
            <span className="text-content font-semibold">{student.full_name}</span>
            {student.absence_reason !== null ? (
              <span className="text-label text-text-secondary">
                Phụ huynh báo vắng{student.absence_reason ? `: ${student.absence_reason}` : ''}
              </span>
            ) : null}
            <select
              aria-label={`Điểm danh ${student.full_name}`}
              className={FORM_CONTROL_CLASS}
              value={marks[student.child_id] ?? 'present'}
              disabled={readOnly}
              onChange={(event) =>
                setMarks({ ...marks, [student.child_id]: event.target.value as PeriodAttendanceStatus })
              }
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PERIOD_ATTENDANCE_LABELS[status]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {readOnly ? null : (
        <div className="flex gap-2">
          <Button disabled={busy || !title.trim()} onClick={() => void save(false)}>
            Lưu tiết
          </Button>
          <Button variant="primary" disabled={busy || !title.trim()} onClick={() => void save(true)}>
            Ký sổ
          </Button>
        </div>
      )}
    </section>
  );
}

export function ClassLogScreen({ onBack }: { onBack(): void }) {
  const [date, setDate] = useState(todayInVietnam());
  const [lessons, setLessons] = useState<MyLesson[]>();
  const [opened, setOpened] = useState<MyLesson>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [doneMessage, setDoneMessage] = useState<string>();

  const load = useCallback(() => {
    requestJson<{ lessons: MyLesson[] }>(`/api/v1/class-logs/mine?date=${date}`)
      .then((result) => setLessons(result.lessons))
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [date]);
  useEffect(load, [load]);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Sổ đầu bài" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={opened ? () => setOpened(undefined) : onBack}>
            Quay lại
          </Button>
        </div>
        {doneMessage ? <Alert tone="success">{doneMessage}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {opened ? (
          <LessonForm
            lesson={opened}
            date={date}
            onDone={(message) => {
              setDoneMessage(message);
              setOpened(undefined);
              load();
            }}
          />
        ) : (
          <>
            <label className="text-label font-medium text-text">
              Ngày dạy
              <input
                type="date"
                aria-label="Ngày dạy"
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            {lessons && lessons.length === 0 ? (
              <p className="text-content text-text-secondary">Ngày này bạn không có tiết dạy theo thời khoá biểu.</p>
            ) : null}
            <ul className="flex flex-col gap-2" aria-label="Tiết dạy trong ngày">
              {(lessons ?? []).map((lesson) => (
                <li key={`${lesson.class_id}:${lesson.period_no}:${lesson.group_no}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border bg-card p-3 text-left text-content"
                    onClick={() => {
                      setDoneMessage(undefined);
                      setOpened(lesson);
                    }}
                  >
                    <span className="font-semibold">Tiết {lesson.period_no}</span> {lesson.class_name} ·{' '}
                    {lesson.subject_name}
                    {groupText(lesson.group_no)} ·{' '}
                    {lesson.log ? (lesson.log.status === 'signed' ? 'Đã ký' : 'Đã ghi') : 'Chưa ghi'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
