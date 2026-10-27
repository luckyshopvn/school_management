import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Bài về nhà của giáo viên (DT-28 phần 28f, YCTD-276): giao bài về nhà từ tiết của sổ đầu bài (hạn mặc định là đầu tiết kế tiếp
// của môn), lịch khối lượng 7 ngày của lớp trước khi phát hành và quy tắc của trường (cảnh báo thì xác nhận vẫn giao, chặn thì cần
// Ban Giám hiệu cho vượt), gợi ý gia hạn hoặc miễn cho học sinh vắng có phép ngày giao
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const WEEKDAYS = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : 'chưa đặt hạn');

interface LessonHomeworkView {
  space: { id: string; title: string } | null;
  can_assign: boolean;
  items: Array<{ activity_id: string; title: string; due_at: string | null; released: boolean }>;
}

// Bài về nhà của tiết trong sổ đầu bài: danh sách, giao bài mới (mở màn hình soạn bài sau khi tạo)
export function LessonHomework({ classLogId, onOpen }: { classLogId: string; onOpen(activityId: string): void }) {
  const [view, setView] = useState<LessonHomeworkView>();
  const [title, setTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(() => {
    requestJson<LessonHomeworkView>(`/api/v1/learning/homework/class-logs/${classLogId}`)
      .then(setView)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [classLogId]);
  useEffect(load, [load]);
  const create = async () => {
    setErrorMessage(undefined);
    try {
      const created = await requestJson<{ activity_id: string }>(
        `/api/v1/learning/homework/class-logs/${classLogId}`,
        post({ title: title.trim() || undefined }),
      );
      onOpen(created.activity_id);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
      aria-label="Bài về nhà của tiết"
    >
      <h3 className="text-content font-semibold text-text">Bài về nhà của tiết</h3>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {view && !view.space ? (
        <p className="text-label text-text-secondary">Lớp chưa có lớp học trực tuyến của môn này nên chưa giao được.</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {(view?.items ?? []).map((item) => (
          <li key={item.activity_id} className="flex items-center gap-2 text-content">
            <span className="flex-1">
              {item.title} · hạn {dateTime(item.due_at)}
            </span>
            <StatusBadge tone={item.released ? 'success' : 'neutral'} label={item.released ? 'Đã giao' : 'Đang soạn'} />
            <Button variant="text" aria-label={`Mở ${item.title}`} onClick={() => onOpen(item.activity_id)}>
              Mở
            </Button>
          </li>
        ))}
      </ul>
      {view?.can_assign ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-label font-medium text-text">
            Tên bài về nhà
            <input
              aria-label="Tên bài về nhà"
              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
              value={title}
              placeholder="Để trống thì lấy theo tên bài của tiết"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <Button variant="primary" onClick={() => void create()}>
            Giao bài về nhà
          </Button>
        </div>
      ) : null}
    </section>
  );
}

interface WorkloadView {
  policy: { action: 'warn' | 'block'; basis: string | null } | null;
  days: Array<{
    date: string;
    weekday: number;
    count: number;
    minutes: number;
    items: Array<{ activity_id: string; title: string; subject_name: string | null; released: boolean }>;
  }>;
  check: { violations: string[]; action: 'warn' | 'block' | null };
  override_reason: string | null;
}

// Trước khi phát hành bài về nhà: lịch 7 ngày của lớp (bài của mọi môn theo ngày đến hạn), vi phạm quy tắc của trường nếu có
export function HomeworkReleasePanel({
  activityId,
  onReleased,
}: {
  activityId: string;
  onReleased(text: string): void;
}) {
  const [view, setView] = useState<WorkloadView>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [needsConfirm, setNeedsConfirm] = useState(false);
  useEffect(() => {
    requestJson<WorkloadView>(`/api/v1/learning/homework/activities/${activityId}/workload`)
      .then(setView)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [activityId]);
  const release = async (confirm: boolean) => {
    setErrorMessage(undefined);
    try {
      await requestJson(
        `/api/v1/learning/activities/${activityId}/assignment/release`,
        post({ confirm_warnings: confirm }),
      );
      onReleased('Đã giao bài về nhà cho học sinh');
    } catch (error) {
      setErrorMessage(messageOf(error));
      setNeedsConfirm(error instanceof ApiError && error.details.some((detail) => detail.field === 'confirm_warnings'));
    }
  };
  return (
    <section className="flex flex-col gap-2" aria-label="Khối lượng bài về nhà của lớp">
      <h2 className="text-section-title font-semibold text-text">Khối lượng bài về nhà 7 ngày của lớp</h2>
      <ul className="grid grid-cols-7 gap-1 text-label">
        {(view?.days ?? []).map((day) => (
          <li
            key={day.date}
            className="flex flex-col gap-1 rounded border border-border p-1"
            aria-label={`Ngày ${day.date}: ${day.count} bài, ${day.minutes} phút`}
          >
            <span className="font-semibold">
              {WEEKDAYS[day.weekday]} {day.date.slice(8)}/{day.date.slice(5, 7)}
            </span>
            {day.items.map((item) => (
              <span key={item.activity_id} className={item.released ? 'text-text' : 'font-semibold underline'}>
                {item.subject_name ?? item.title}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {view && !view.policy ? (
        <p className="text-label text-text-secondary">Trường chưa đặt quy tắc khối lượng bài về nhà.</p>
      ) : null}
      {view?.check.violations.length ? (
        <Alert tone={view.check.action === 'block' ? 'danger' : 'info'}>
          {view.check.action === 'block' ? 'Trường chặn bài này: ' : 'Vượt quy tắc của trường: '}
          {view.check.violations.join('. ')}
          {view.override_reason ? ` Ban Giám hiệu đã cho vượt: ${view.override_reason}.` : ''}
        </Alert>
      ) : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void release(false)}>
          Giao bài cho học sinh
        </Button>
        {needsConfirm ? (
          <Button variant="secondary" onClick={() => void release(true)}>
            Vẫn giao
          </Button>
        ) : null}
      </div>
    </section>
  );
}

interface AbsenceView {
  date: string | null;
  students: Array<{
    child_id: string;
    full_name: string;
    reason: string | null;
    suggestion: 'extend' | 'excuse' | null;
  }>;
}

// Học sinh vắng có phép ngày giao: gợi ý gia hạn 2 ngày hoặc miễn (qua tuyến học sinh nhận bài của 28c)
export function HomeworkAbsences({
  activityId,
  dueAt,
  onChanged,
}: {
  activityId: string;
  dueAt: string | null;
  onChanged(text: string): void;
}) {
  const [view, setView] = useState<AbsenceView>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(() => {
    requestJson<AbsenceView>(`/api/v1/learning/homework/activities/${activityId}/absences`)
      .then(setView)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [activityId]);
  useEffect(load, [load]);
  const change = async (childId: string, body: Record<string, unknown>, text: string) => {
    try {
      await requestJson(`/api/v1/learning/activities/${activityId}/assignment/recipients/${childId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      load();
      onChanged(text);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const extended = () => {
    const base = dueAt ? new Date(dueAt) : new Date();
    return new Date(base.getTime() + 2 * 86_400_000).toISOString();
  };
  const pending = (view?.students ?? []).filter((student) => student.suggestion !== null);
  if (pending.length === 0 && !errorMessage) {
    return null;
  }
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
      aria-label="Vắng ngày giao bài"
    >
      <h3 className="text-content font-semibold text-text">Vắng có phép ngày giao bài</h3>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {pending.map((student) => (
        <div key={student.child_id} className="flex flex-wrap items-center gap-2 text-content">
          <span className="flex-1">
            {student.full_name}
            {student.reason ? ` (${student.reason})` : ''}
          </span>
          <Button
            variant="secondary"
            aria-label={`Gia hạn cho ${student.full_name}`}
            onClick={() =>
              void change(student.child_id, { due_at: extended() }, `Đã gia hạn 2 ngày cho ${student.full_name}`)
            }
          >
            Gia hạn 2 ngày
          </Button>
          <Button
            variant="text"
            aria-label={`Miễn cho ${student.full_name}`}
            onClick={() =>
              void change(
                student.child_id,
                { excused: true, excuse_reason: 'Vắng có phép ngày giao bài' },
                `Đã miễn bài cho ${student.full_name}`,
              )
            }
          >
            Miễn
          </Button>
        </div>
      ))}
    </section>
  );
}
