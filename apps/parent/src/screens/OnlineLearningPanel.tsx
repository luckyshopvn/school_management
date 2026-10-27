import { useCallback, useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Học trực tuyến của con (DT-28 phần 28b, YCTD-272): các lớp học trực tuyến đã mở cho học sinh, hoạt động đã giao kèm hạn, trạng
// thái và lý do khi hoạt động còn khóa, tiến độ; nội quy dạy học trực tuyến của trường (Thông tư 09/2021/TT-BGDĐT Điều 15) để
// phụ huynh xác nhận đã đọc thay con chưa có tài khoản. Phụ huynh chỉ xem, không làm thay hoạt động (nộp thay bài về nhà ở 28f)
interface ActivityView {
  id: string;
  kind: string;
  kind_label: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  open: boolean;
  locked_reasons: string[];
  status: string;
  score: number | null;
}

interface ChildLearning {
  rules: { id: string; version: number; content: string; acknowledged_at: string | null } | null;
  spaces: Array<{
    id: string;
    title: string;
    summary: { required: number; done: number; overdue: number; percent: number };
    sections: Array<{ id: string; title: string; activities: ActivityView[] }>;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa làm',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  excused: 'Được miễn',
};

// Bài tập trực tuyến của con (DT-28 phần 28c, YCTD-273): các lần nộp, nộp muộn, điểm hoặc mức và nhận xét khi giáo viên đã trả
interface ChildAssignment {
  excused: boolean;
  attempts: Array<{
    attempt_no: number;
    status: 'submitted' | 'returned';
    late: boolean;
    score: number | null;
    level: string | null;
    feedback: string | null;
    feedback_ai_assisted: boolean;
  }>;
}

const LEVEL_LABELS: Record<string, string> = {
  excellent: 'Hoàn thành tốt',
  completed: 'Hoàn thành',
  not_completed: 'Chưa hoàn thành',
};

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');

export function OnlineLearningPanel({ child }: { child: { id: string; full_name: string } }) {
  const [data, setData] = useState<ChildLearning>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [assignments, setAssignments] = useState<Record<string, ChildAssignment>>({});
  const load = useCallback(() => {
    requestJson<ChildLearning>(`/api/v1/learning/children/${child.id}`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [child.id]);
  useEffect(load, [load]);
  const acknowledge = async () => {
    try {
      await requestJson(`/api/v1/learning/children/${child.id}/rules/acknowledge`, { method: 'POST', body: '{}' });
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const viewAssignment = async (activityId: string) => {
    try {
      const loaded = await requestJson<ChildAssignment>(
        `/api/v1/learning/children/${child.id}/assignments/${activityId}`,
      );
      setAssignments({ ...assignments, [activityId]: loaded });
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <section className="flex flex-col gap-3" aria-label={`Học trực tuyến của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data?.rules && !data.rules.acknowledged_at ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-content font-semibold">
            Nội quy dạy học trực tuyến (phiên bản {data.rules.version})
          </span>
          <p className="whitespace-pre-line text-content text-text">{data.rules.content}</p>
          <div>
            <Button variant="primary" onClick={() => void acknowledge()}>
              Đã đọc cùng con
            </Button>
          </div>
        </div>
      ) : null}
      {data && data.spaces.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có lớp học trực tuyến nào được mở cho con.</p>
      ) : null}
      {(data?.spaces ?? []).map((space) => (
        <div key={space.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-content font-semibold">{space.title}</span>
          <span className="text-label text-text-secondary">
            Hoàn thành {space.summary.done}/{space.summary.required} hoạt động
            {space.summary.overdue > 0 ? `, quá hạn ${space.summary.overdue}` : ''}
          </span>
          {space.sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              <span className="text-label font-medium text-text">{section.title}</span>
              <ul className="flex flex-col gap-1 text-content">
                {section.activities.map((activity) => (
                  <li key={activity.id} className="rounded border border-border p-2">
                    <span className="font-medium">{activity.title}</span>
                    <span className="text-label text-text-secondary">
                      {' '}
                      · {activity.kind_label} · {STATUS_LABELS[activity.status] ?? activity.status}
                      {activity.due_at ? ` · hạn ${new Date(activity.due_at).toLocaleString('vi-VN')}` : ''}
                    </span>
                    {!activity.open ? (
                      <p className="text-label text-text-secondary">{activity.locked_reasons.join('; ')}</p>
                    ) : null}
                    {activity.kind === 'assignment' && activity.open && !assignments[activity.id] ? (
                      <div>
                        <Button variant="text" onClick={() => void viewAssignment(activity.id)}>
                          Xem bài và nhận xét
                        </Button>
                      </div>
                    ) : null}
                    {assignments[activity.id] ? (
                      <ul className="flex flex-col gap-1 text-label text-text" aria-label={`Bài nộp ${activity.title}`}>
                        {assignments[activity.id]?.excused ? <li>Con được miễn bài này</li> : null}
                        {assignments[activity.id]?.attempts.length === 0 ? <li>Con chưa nộp bài</li> : null}
                        {assignments[activity.id]?.attempts.map((attempt) => (
                          <li key={attempt.attempt_no}>
                            Lần {attempt.attempt_no}:{' '}
                            {attempt.status === 'returned' ? 'đã trả bài' : 'đã nộp, chờ chấm'}
                            {attempt.late ? ', nộp muộn' : ''}
                            {attempt.score !== null ? ` · điểm ${attempt.score}` : ''}
                            {attempt.level ? ` · ${LEVEL_LABELS[attempt.level] ?? attempt.level}` : ''}
                            {attempt.feedback
                              ? ` · nhận xét: ${attempt.feedback}${attempt.feedback_ai_assisted ? ' (có trợ lý AI hỗ trợ)' : ''}`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
