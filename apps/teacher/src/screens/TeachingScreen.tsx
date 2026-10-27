import { useCallback, useEffect, useId, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-05, MG-06 Giảng dạy của lớp (P03-01, P03-02, P03-04, P03-06, P03-07; BR-64; YCTD-80): soạn bài học và giáo án, gửi
// tổ trưởng duyệt, xem góp ý; xem thời khóa biểu tuần này; lập và công bố lịch hoạt động lớp; ghi và công bố tiến độ học
// tập của trẻ trong lớp
interface Lesson {
  id: string;
  name: string;
}

interface LessonPlan {
  id: string;
  class_id: string;
  lesson_name: string;
  planned_date: string;
  activities: string;
  status: 'draft' | 'submitted' | 'leader_approved' | 'approved' | 'returned';
  review_comment: string | null;
}

interface Timetable {
  effective_from: string | null;
  slots: Array<{ id: string; weekday: number; start_time: string; end_time: string; activity_name: string }>;
}

interface Activity {
  id: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  activity_name: string;
  status: 'draft' | 'published' | 'cancelled';
}

interface ChildRow {
  id: string;
  full_name: string;
}

interface ProgressRow {
  id: string;
  indicator_code: string;
  level: 'achieved' | 'developing' | 'not_yet';
  comment: string | null;
  published_at: string | null;
}

const STATUS_LABELS: Record<LessonPlan['status'], string> = {
  draft: 'Nháp',
  submitted: 'Chờ tổ trưởng duyệt',
  leader_approved: 'Chờ quản lý duyệt',
  approved: 'Đã duyệt',
  returned: 'Bị trả lại',
};
const LEVEL_LABELS: Record<ProgressRow['level'], string> = {
  achieved: 'Đạt',
  developing: 'Đang phát triển',
  not_yet: 'Chưa đạt',
};
const WEEKDAYS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const post = <Result,>(path: string, body: unknown) =>
  requestJson<Result>(path, { method: 'POST', body: JSON.stringify(body) });

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-content"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type Notify = (message: string, failed?: boolean) => void;

function LessonPlansSection({ myClass, onMessage }: { myClass: MyClass; onMessage: Notify }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [lessonId, setLessonId] = useState('');
  const [newLesson, setNewLesson] = useState({ name: '', objectives: '' });
  const [plan, setPlan] = useState({ planned_date: addDays(today(), 1), activities: '', duration_minutes: '30' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [lessonRows, planRows] = await Promise.all([
        requestJson<Lesson[]>('/api/v1/lessons'),
        requestJson<LessonPlan[]>(`/api/v1/lesson-plans?view=mine&class_id=${myClass.id}`),
      ]);
      setLessons(lessonRows);
      setPlans(planRows);
      setLessonId((previous) => previous || lessonRows[0]?.id || '');
    } catch (error) {
      onMessage(messageOf(error), true);
    }
  }, [myClass.id, onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      onMessage(message);
      await load();
      return true;
    } catch (error) {
      onMessage(messageOf(error), true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Giáo án">
      <h2 className="text-section-title font-semibold">Giáo án</h2>
      <div className="flex flex-col gap-2">
        <TextField
          label="Tên bài học mới"
          value={newLesson.name}
          onChange={(event) => setNewLesson({ ...newLesson, name: event.target.value })}
        />
        <TextField
          label="Mục tiêu bài học"
          value={newLesson.objectives}
          onChange={(event) => setNewLesson({ ...newLesson, objectives: event.target.value })}
        />
        <Button
          disabled={busy || !newLesson.name || !newLesson.objectives}
          onClick={() =>
            void run(async () => {
              const created = await post<Lesson>('/api/v1/lessons', { ...newLesson, org_unit_id: myClass.org_unit_id });
              setLessonId(created.id);
              setNewLesson({ name: '', objectives: '' });
            }, `Đã tạo bài học ${newLesson.name}`)
          }
        >
          Tạo bài học
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <Select
          label="Bài học"
          value={lessonId}
          onChange={setLessonId}
          options={lessons.map((lesson) => ({ value: lesson.id, label: lesson.name }))}
        />
        <TextField
          label="Ngày dạy"
          type="date"
          value={plan.planned_date}
          onChange={(event) => setPlan({ ...plan, planned_date: event.target.value })}
        />
        <TextField
          label="Hoạt động"
          value={plan.activities}
          onChange={(event) => setPlan({ ...plan, activities: event.target.value })}
        />
        <TextField
          label="Thời lượng (phút)"
          value={plan.duration_minutes}
          onChange={(event) => setPlan({ ...plan, duration_minutes: event.target.value })}
        />
        <Button
          variant="primary"
          disabled={busy || !lessonId || !plan.activities}
          onClick={() =>
            void run(async () => {
              await post('/api/v1/lesson-plans', {
                lesson_id: lessonId,
                class_id: myClass.id,
                planned_date: plan.planned_date,
                activities: plan.activities,
                duration_minutes: Number(plan.duration_minutes),
              });
              setPlan({ ...plan, activities: '' });
            }, 'Đã lưu giáo án nháp')
          }
        >
          Lưu giáo án
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {plans.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-1 rounded-lg border border-border p-3"
            aria-label={`Giáo án ${row.lesson_name} ngày ${row.planned_date}`}
          >
            <span className="text-content font-semibold">
              {row.lesson_name}, ngày {row.planned_date}
            </span>
            <span className="text-label">{row.activities}</span>
            <span className="text-label text-text-secondary">
              {STATUS_LABELS[row.status]}
              {row.review_comment ? `. Góp ý: ${row.review_comment}` : ''}
            </span>
            {row.status === 'draft' || row.status === 'returned' ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => post(`/api/v1/lesson-plans/${row.id}/submit`, {}),
                    'Đã gửi giáo án chờ tổ trưởng duyệt',
                  )
                }
              >
                Gửi duyệt
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimetableSection({ myClass, onMessage }: { myClass: MyClass; onMessage: Notify }) {
  const [timetable, setTimetable] = useState<Timetable>();
  useEffect(() => {
    requestJson<Timetable>(`/api/v1/classes/${myClass.id}/timetable`)
      .then(setTimetable)
      .catch((error: unknown) => onMessage(messageOf(error), true));
  }, [myClass.id, onMessage]);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label="Thời khóa biểu">
      <h2 className="text-section-title font-semibold">Thời khóa biểu tuần này</h2>
      {timetable && timetable.slots.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có thời khóa biểu.</p>
      ) : null}
      <ul className="flex flex-col gap-1 text-content">
        {(timetable?.slots ?? []).map((slot) => (
          <li key={slot.id}>
            {WEEKDAYS[slot.weekday]} {slot.start_time}–{slot.end_time}: {slot.activity_name}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivitiesSection({ myClass, onMessage }: { myClass: MyClass; onMessage: Notify }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [input, setInput] = useState({
    activity_date: today(),
    start_time: '09:00',
    end_time: '10:00',
    activity_name: '',
  });
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      requestJson<Activity[]>(
        `/api/v1/classes/${myClass.id}/activity-schedules?from=${today()}&to=${addDays(today(), 13)}`,
      )
        .then(setActivities)
        .catch((error: unknown) => onMessage(messageOf(error), true)),
    [myClass.id, onMessage],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      onMessage(message);
      await load();
    } catch (error) {
      onMessage(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      aria-label="Lịch hoạt động lớp"
    >
      <h2 className="text-section-title font-semibold">Lịch hoạt động 14 ngày tới</h2>
      <ul className="flex flex-col gap-1 text-content">
        {activities.map((row) => (
          <li key={row.id}>
            {row.activity_date} {row.start_time}–{row.end_time}: {row.activity_name}{' '}
            {row.status === 'draft' ? '(nháp)' : '(đã công bố)'}
          </li>
        ))}
      </ul>
      <TextField
        label="Ngày hoạt động"
        type="date"
        value={input.activity_date}
        onChange={(event) => setInput({ ...input, activity_date: event.target.value })}
      />
      <TextField
        label="Từ giờ"
        value={input.start_time}
        onChange={(event) => setInput({ ...input, start_time: event.target.value })}
      />
      <TextField
        label="Đến giờ"
        value={input.end_time}
        onChange={(event) => setInput({ ...input, end_time: event.target.value })}
      />
      <TextField
        label="Tên hoạt động"
        value={input.activity_name}
        onChange={(event) => setInput({ ...input, activity_name: event.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !input.activity_name}
          onClick={() =>
            void run(async () => {
              await post(`/api/v1/classes/${myClass.id}/activity-schedules`, input);
              setInput({ ...input, activity_name: '' });
            }, 'Đã thêm hoạt động nháp')
          }
        >
          Thêm hoạt động
        </Button>
        <Button
          disabled={busy || !activities.some((row) => row.status === 'draft')}
          onClick={() =>
            void run(
              () =>
                post(`/api/v1/classes/${myClass.id}/activity-schedules/publish`, {
                  from: today(),
                  to: addDays(today(), 13),
                }),
              'Đã công bố lịch hoạt động cho phụ huynh',
            )
          }
        >
          Công bố lịch
        </Button>
      </div>
    </section>
  );
}

function ProgressSection({ myClass, onMessage }: { myClass: MyClass; onMessage: Notify }) {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [childId, setChildId] = useState('');
  const [term, setTerm] = useState('HK1');
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [item, setItem] = useState({ indicator_code: '', level: 'achieved', comment: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<{ items: ChildRow[] }>(`/api/v1/children?class_id=${myClass.id}&status=active&page_size=100`)
      .then((page) => {
        setChildren(page.items);
        setChildId((previous) => previous || page.items[0]?.id || '');
      })
      .catch((error: unknown) => onMessage(messageOf(error), true));
  }, [myClass.id, onMessage]);

  const load = useCallback(async () => {
    if (!childId) {
      return;
    }
    try {
      setRows(
        await requestJson<ProgressRow[]>(`/api/v1/children/${childId}/progress?period_type=term&period_value=${term}`),
      );
    } catch (error) {
      onMessage(messageOf(error), true);
    }
  }, [childId, term, onMessage]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      onMessage(message);
      await load();
    } catch (error) {
      onMessage(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };
  const published = rows.some((row) => row.published_at);

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label="Tiến độ học tập">
      <h2 className="text-section-title font-semibold">Tiến độ học tập</h2>
      <Select
        label="Trẻ"
        value={childId}
        onChange={setChildId}
        options={children.map((child) => ({ value: child.id, label: child.full_name }))}
      />
      <Select
        label="Học kỳ"
        value={term}
        onChange={setTerm}
        options={[
          { value: 'HK1', label: 'Học kỳ 1' },
          { value: 'HK2', label: 'Học kỳ 2' },
          { value: 'HE', label: 'Học hè' },
        ]}
      />
      <ul className="flex flex-col gap-1 text-content">
        {rows.map((row) => (
          <li key={row.id}>
            {row.indicator_code}: {LEVEL_LABELS[row.level]}
            {row.comment ? `. ${row.comment}` : ''}
          </li>
        ))}
      </ul>
      {published ? (
        <p className="text-label text-text-secondary">Phiếu đã công bố cho phụ huynh.</p>
      ) : (
        <>
          <TextField
            label="Chỉ số phát triển"
            value={item.indicator_code}
            onChange={(event) => setItem({ ...item, indicator_code: event.target.value })}
          />
          <Select
            label="Mức"
            value={item.level}
            onChange={(level) => setItem({ ...item, level })}
            options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <TextField
            label="Nhận xét"
            value={item.comment}
            onChange={(event) => setItem({ ...item, comment: event.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !childId || !item.indicator_code}
              onClick={() =>
                void run(async () => {
                  await post(`/api/v1/children/${childId}/progress`, {
                    period_type: 'term',
                    period_value: term,
                    items: [{ indicator_code: item.indicator_code, level: item.level, comment: item.comment || null }],
                  });
                  setItem({ indicator_code: '', level: 'achieved', comment: '' });
                }, 'Đã ghi tiến độ')
              }
            >
              Ghi tiến độ
            </Button>
            <Button
              disabled={busy || rows.length === 0}
              onClick={() =>
                void run(
                  () =>
                    post(`/api/v1/children/${childId}/progress/publish`, { period_type: 'term', period_value: term }),
                  'Đã công bố phiếu tiến độ cho phụ huynh',
                )
              }
            >
              Công bố phiếu
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function TeachingScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const notify = useCallback<Notify>((text, failed = false) => setMessage({ text, failed }), []);
  return (
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Giảng dạy lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col md:max-w-3xl gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
        <LessonPlansSection myClass={myClass} onMessage={notify} />
        <TimetableSection myClass={myClass} onMessage={notify} />
        <ActivitiesSection myClass={myClass} onMessage={notify} />
        <ProgressSection myClass={myClass} onMessage={notify} />
      </main>
    </div>
  );
}
