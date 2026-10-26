import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MG-12 Công việc của tôi (P09-01, P09-02, P09-04, P09-05; YCTD-81): việc được giao và việc cá nhân, cập nhật phần trăm
// hoàn thành, thêm việc cá nhân; kết quả đánh giá đã công bố của mình. Cần có mạng, không lưu tạm khi mất mạng
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

interface Task {
  id: string;
  task_type: 'assigned' | 'personal';
  title: string;
  description: string | null;
  assigner_name: string;
  due_date: string | null;
  status: TaskStatus;
  progress_percent: number;
  overdue: boolean;
}

interface Evaluation {
  id: string;
  period_value: string;
  total_score: number;
  comment: string | null;
  scores: Array<{ criterion_id: string; criterion_name: string; score: number; max_score: number }>;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content';

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

function TaskItem({ task, onChanged }: { task: Task; onChanged(): void }) {
  const [progress, setProgress] = useState(String(task.progress_percent));
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const open = task.status === 'todo' || task.status === 'in_progress';
  const save = async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await requestJson(`/api/v1/tasks/${task.id}/updates`, {
        method: 'POST',
        body: JSON.stringify({ progress_percent: Number(progress) }),
      });
      onChanged();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label={`Việc ${task.title}`}>
      <span className="text-content font-semibold">{task.title}</span>
      {task.description ? <span className="text-label text-text-secondary">{task.description}</span> : null}
      <span className="text-label text-text-secondary">
        {task.task_type === 'personal' ? 'Việc cá nhân' : `Người giao: ${task.assigner_name}`}
        {task.due_date ? ` · Hạn ${task.due_date}` : ''}
        {task.overdue ? ' · Quá hạn' : ''}
      </span>
      <span className="text-content">
        {STATUS_LABELS[task.status]} · {task.progress_percent}%
      </span>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {open ? (
        <div className="flex items-end gap-2">
          <label className="flex-1 text-label font-medium text-text">
            Phần trăm hoàn thành
            <select value={progress} onChange={(event) => setProgress(event.target.value)} className={selectClass}>
              {[0, 25, 50, 75, 100].map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy} onClick={() => void save()}>
            Cập nhật
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function WorkScreen({ onBack }: { onBack(): void }) {
  const [tasks, setTasks] = useState<Task[]>();
  const [evaluations, setEvaluations] = useState<Evaluation[]>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    requestJson<Task[]>('/api/v1/tasks?view=mine')
      .then(setTasks)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
    requestJson<Evaluation[]>('/api/v1/me/evaluations')
      .then(setEvaluations)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, []);
  useEffect(load, [load]);

  const addPersonal = async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await requestJson('/api/v1/tasks', { method: 'POST', body: JSON.stringify({ title }) });
      setTitle('');
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Công việc của tôi" />
      <main className="mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <form
          aria-label="Thêm việc cá nhân"
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void addPersonal();
          }}
        >
          <div className="flex-1">
            <TextField label="Việc cá nhân" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <Button type="submit" variant="primary" disabled={busy || title.trim() === ''}>
            Thêm
          </Button>
        </form>
        {tasks && tasks.length === 0 ? <p className="text-content text-text-secondary">Chưa có việc nào.</p> : null}
        <ul className="flex flex-col gap-2" aria-label="Danh sách việc của tôi">
          {(tasks ?? []).map((task) => (
            <TaskItem key={`${task.id}-${task.progress_percent}-${task.status}`} task={task} onChanged={load} />
          ))}
        </ul>
        <h2 className="text-section-title font-semibold text-text">Kết quả đánh giá</h2>
        {evaluations && evaluations.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có kết quả đánh giá đã công bố.</p>
        ) : null}
        <ul className="flex flex-col gap-2" aria-label="Kết quả đánh giá của tôi">
          {(evaluations ?? []).map((evaluation) => (
            <li key={evaluation.id} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
              <span className="text-content font-semibold">
                Kỳ {evaluation.period_value}: {evaluation.total_score} điểm
              </span>
              {evaluation.scores.map((score) => (
                <span key={score.criterion_id} className="text-label text-text-secondary">
                  {score.criterion_name}: {score.score}/{score.max_score}
                </span>
              ))}
              {evaluation.comment ? <span className="text-content">{evaluation.comment}</span> : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
