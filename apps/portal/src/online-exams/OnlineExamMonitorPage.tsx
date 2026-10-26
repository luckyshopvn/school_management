import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import {
  EXAM_ATTEMPT_POLICY_LABELS,
  EXAM_CAMERA_FALLBACK_LABELS,
  EXAM_RESULT_MODE_LABELS,
  EXAM_SUBMIT_REASON_LABELS,
  EXAM_VIOLATION_ACTION_LABELS,
  PROCTOR_EVENT_LABELS,
  type ExamAttemptPolicy,
  type ExamCameraFallback,
  type ExamResultMode,
  type ExamSubmitReason,
  type ExamViolationAction,
  type ProctorEventType,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf } from '../exams/exam-filters.js';
import {
  assignmentAction,
  forceSubmit,
  listAssignments,
  markEssay,
  readAssignment,
  readAttempt,
  type AttemptDetail,
  type AttemptSummary,
  type MonitorStudent,
} from './online-exams-api.js';
import { NO_ONLINE_LEVEL_MESSAGE, useOnlineExamLevel } from './OnlineExamsPage.js';

// 2. Theo dõi bài làm (DT-23 phần 23a, YCTD-211): từng học sinh đã vào, đã nộp, điểm, số lần rời bài, sự kiện camera, phiên thứ
// hai; xem bài làm, chấm câu tự luận, nộp thay, công bố kết quả, huỷ bài. Sự kiện chỉ là căn cứ để giáo viên xét, không tự trừ
// điểm; điểm vào sổ điểm theo luồng 8.5 Chấm bài kiểm tra
const formatTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(
        new Date(iso),
      )
    : '';

const CAMERA_LABELS: Record<string, string> = {
  off: 'Không dùng camera',
  granted: 'Camera đã bật',
  denied: 'Không cho phép camera',
  unavailable: 'Máy không có camera',
};

function AttemptPanel({
  attemptId,
  onMessage,
  onClose,
}: {
  attemptId: string;
  onMessage(message: string): void;
  onClose(): void;
}) {
  const queryClient = useQueryClient();
  const attempt = useQuery({ queryKey: ['online-exam-attempt', attemptId], queryFn: () => readAttempt(attemptId) });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const refresh = async (data: AttemptDetail) => {
    queryClient.setQueryData(['online-exam-attempt', attemptId], data);
    await queryClient.invalidateQueries({ queryKey: ['online-exam-assignment'] });
  };
  const mark = useMutation({
    mutationFn: () =>
      markEssay(
        attemptId,
        Object.fromEntries(
          Object.entries(marks)
            .filter(([, value]) => value.trim() !== '')
            .map(([id, value]) => [id, Number(value.replace(',', '.'))]),
        ),
      ),
    onSuccess: async (data) => {
      await refresh(data);
      onMessage('Đã lưu điểm tự luận');
    },
  });
  const force = useMutation({
    mutationFn: () => forceSubmit(attemptId),
    onSuccess: async (data) => {
      await refresh(data);
      onMessage('Đã nộp bài thay học sinh');
    },
  });
  const data = attempt.data;
  if (attempt.error) {
    return <Alert tone="danger">{messageOf(attempt.error)}</Alert>;
  }
  if (!data) {
    return null;
  }
  const essays = data.questions.filter((question) => question.type === 'essay');
  return (
    <section
      aria-label={`Bài làm của ${data.full_name}`}
      className="flex flex-col gap-3 rounded border border-border p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex-1 text-label font-semibold text-text">
          Bài làm của {data.full_name}, lần {data.attempt_no} (mã đề {data.variant_code})
        </h3>
        <Button variant="text" onClick={onClose}>
          Đóng
        </Button>
      </div>
      <p className="text-content text-text">
        Điểm: {data.total_score ?? 'chờ chấm tự luận'} / {data.max_score ?? '—'}; trắc nghiệm {data.objective_score ?? '—'}
        {data.submitted_at
          ? `; nộp lúc ${formatTime(data.submitted_at)} (${EXAM_SUBMIT_REASON_LABELS[data.submit_reason as ExamSubmitReason] ?? ''})`
          : '; đang làm bài'}
        {data.submitted_at ? (data.sheet_synced ? '; đã vào phiếu chấm 8.5' : '; chưa vào phiếu chấm 8.5') : ''}
      </p>
      {data.status === 'in_progress' ? (
        <div>
          <Button onClick={() => force.mutate()} disabled={force.isPending}>
            Nộp thay học sinh
          </Button>
        </div>
      ) : null}
      {mark.error ? <Alert tone="danger">{messageOf(mark.error)}</Alert> : null}
      {force.error ? <Alert tone="danger">{messageOf(force.error)}</Alert> : null}
      <p className="text-label text-text-secondary">
        Sự kiện chống gian lận chỉ là căn cứ để giáo viên xét, không tự trừ điểm. {CAMERA_LABELS[data.camera_state] ?? ''}
      </p>
      <ul className="flex flex-col gap-1 text-content text-text" aria-label="Sự kiện của bài làm">
        {data.events.length === 0 ? <li className="text-text-secondary">Không có sự kiện nào.</li> : null}
        {data.events.map((event, index) => (
          <li key={`${event.type}-${index}`}>
            {formatTime(event.occurred_at)}: {event.label}
            {event.detail.duration_ms ? ` (kéo dài ${Math.round(event.detail.duration_ms / 1000)} giây)` : ''}
            {event.detail.faces !== undefined ? ` (${event.detail.faces} khuôn mặt)` : ''}
          </li>
        ))}
      </ul>
      <ol className="flex flex-col gap-3" aria-label="Câu trả lời">
        {data.questions.map((question) => (
          <li key={question.number} className="flex flex-col gap-1 rounded border border-border p-2">
            <p className="text-content text-text">
              <strong>Câu {question.position}</strong> ({question.score} điểm): {question.content}
            </p>
            {question.options.map((option) => (
              <p key={option.label} className="pl-4 text-label text-text-secondary">
                {option.label}. {option.content}
              </p>
            ))}
            <p className="text-label text-text">
              Học sinh trả lời: {question.student_answer.length ? question.student_answer.join(', ') : '(bỏ trống)'}
              {question.type === 'essay' ? '' : ` · đáp án đúng: ${question.correct_answer.join(', ')}`}
              {question.earned !== null && question.type !== 'essay' ? ` · ${question.earned} điểm` : ''}
            </p>
            {question.type === 'essay' && question.guidance ? (
              <p className="text-label text-text-secondary">Hướng dẫn chấm: {question.guidance}</p>
            ) : null}
          </li>
        ))}
      </ol>
      {essays.length > 0 && data.status === 'submitted' ? (
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Chấm câu tự luận">
          {essays.map((question) => (
            <label key={question.number} className="text-label font-medium text-text">
              Điểm câu {question.position} (tối đa {question.score})
              <input
                aria-label={`Điểm câu ${question.position}`}
                className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                value={marks[question.question_id] ?? question.essay_mark?.toString() ?? ''}
                onChange={(event) => setMarks({ ...marks, [question.question_id]: event.target.value })}
              />
            </label>
          ))}
          <Button variant="primary" onClick={() => mark.mutate()} disabled={mark.isPending}>
            Lưu điểm tự luận
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function StudentRow({ student, onOpen }: { student: MonitorStudent; onOpen(attempt: AttemptSummary): void }) {
  const last = student.attempts[student.attempts.length - 1];
  const events = Object.entries(student.event_counts);
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">{student.full_name}</td>
      <td className="px-3 py-2">{student.class_name ?? ''}</td>
      <td className="px-3 py-2">
        {last ? (
          <StatusBadge
            tone={last.status === 'submitted' ? 'success' : 'warning'}
            label={last.status === 'submitted' ? 'Đã nộp' : 'Đang làm'}
          />
        ) : (
          <StatusBadge tone="neutral" label="Chưa vào" />
        )}
      </td>
      <td className="px-3 py-2">
        {student.attempts.map((attempt) => (
          <div key={attempt.id}>
            Lần {attempt.attempt_no}: {attempt.total_score ?? (attempt.needs_marking ? 'chờ chấm' : '—')}
            {attempt.max_score !== null ? ` / ${attempt.max_score}` : ''}
          </div>
        ))}
      </td>
      <td className="px-3 py-2">{student.violations}</td>
      <td className="px-3 py-2">
        {events.length === 0
          ? ''
          : events
              .map(([type, count]) => `${PROCTOR_EVENT_LABELS[type as ProctorEventType] ?? type}: ${count}`)
              .join('; ')}
      </td>
      <td className="px-3 py-2">{student.attempts.some((attempt) => attempt.flagged) ? 'Cần xét' : ''}</td>
      <td className="px-3 py-2 text-right">
        {student.attempts.map((attempt) => (
          <Button
            key={attempt.id}
            variant="text"
            aria-label={`Xem bài ${student.full_name} lần ${attempt.attempt_no}`}
            onClick={() => onOpen(attempt)}
          >
            Xem lần {attempt.attempt_no}
          </Button>
        ))}
      </td>
    </tr>
  );
}

export function OnlineExamMonitorPage() {
  const queryClient = useQueryClient();
  const search: { assignment?: string } = useSearch({ strict: false });
  const scope = useOnlineExamLevel();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [chosen, setChosen] = useState<string>();
  const [attemptId, setAttemptId] = useState<string>();
  const assignments = useQuery({
    queryKey: ['online-exam-assignments', scope.level],
    queryFn: () => listAssignments(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const selectedId = chosen ?? search.assignment ?? '';
  const detail = useQuery({
    queryKey: ['online-exam-assignment', selectedId],
    queryFn: () => readAssignment(selectedId),
    enabled: Boolean(selectedId),
    refetchInterval: 15_000,
  });
  const action = useMutation({
    mutationFn: (name: 'cancel' | 'release-results') => assignmentAction(selectedId, name),
    onSuccess: async (data, name) => {
      queryClient.setQueryData(['online-exam-assignment', selectedId], data);
      await queryClient.invalidateQueries({ queryKey: ['online-exam-assignments'] });
      setToastMessage(name === 'cancel' ? 'Đã huỷ bài thi' : 'Đã công bố kết quả cho học sinh');
    },
  });
  const data = detail.data;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-exams/monitor')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_ONLINE_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            <label className="text-label font-medium text-text">
              Bài thi
              <select
                aria-label="Bài thi"
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={selectedId}
                onChange={(event) => {
                  setChosen(event.target.value);
                  setAttemptId(undefined);
                }}
              >
                <option value="">Chọn bài thi</option>
                {(assignments.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} ({row.subject_name})
                  </option>
                ))}
              </select>
            </label>
            {detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null}
            {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
            {data ? (
              <>
                <section aria-label="Cấu hình bài thi" className="flex flex-col gap-1 text-content text-text">
                  <p>
                    {data.title} · {data.subject_name} · giao cho {data.targets.map((target) => target.label).join(', ')}
                  </p>
                  <p>
                    Mở {formatTime(data.opens_at)}, đóng {formatTime(data.closes_at)}; {data.duration_minutes} phút; tối đa{' '}
                    {data.max_attempts} lần ({EXAM_ATTEMPT_POLICY_LABELS[data.attempt_policy as ExamAttemptPolicy]}).
                  </p>
                  <p>
                    Kết quả: {EXAM_RESULT_MODE_LABELS[data.result_mode as ExamResultMode]}
                    {data.results_released_at ? ` (đã công bố lúc ${formatTime(data.results_released_at)})` : ''}. Toàn màn
                    hình: {data.fullscreen_required ? `bật, cho rời bài ${data.max_violations} lần, quá thì ${EXAM_VIOLATION_ACTION_LABELS[data.violation_action as ExamViolationAction].toLowerCase()}` : 'tắt'}
                    . Camera:{' '}
                    {data.camera_enabled
                      ? `bật, không có camera thì ${EXAM_CAMERA_FALLBACK_LABELS[data.camera_fallback as ExamCameraFallback].toLowerCase()}`
                      : 'tắt'}
                    .
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {data.status === 'published' ? (
                      <>
                        {data.result_mode === 'teacher_release' ? (
                          <Button onClick={() => action.mutate('release-results')} disabled={action.isPending}>
                            Công bố kết quả
                          </Button>
                        ) : null}
                        <Button variant="danger" onClick={() => action.mutate('cancel')} disabled={action.isPending}>
                          Huỷ bài thi
                        </Button>
                      </>
                    ) : (
                      <StatusBadge tone="danger" label="Đã huỷ" />
                    )}
                  </div>
                </section>
                <div className="overflow-x-auto">
                  <table className="w-full text-content" aria-label="Học sinh được giao">
                    <thead className="text-left text-label font-medium text-text-secondary">
                      <tr>
                        <th className="px-3 py-2">Học sinh</th>
                        <th className="px-3 py-2">Lớp</th>
                        <th className="px-3 py-2">Tình trạng</th>
                        <th className="px-3 py-2">Điểm</th>
                        <th className="px-3 py-2">Số lần rời bài</th>
                        <th className="px-3 py-2">Sự kiện</th>
                        <th className="px-3 py-2">Xét</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.students.map((student) => (
                        <StudentRow key={student.child_id} student={student} onOpen={(attempt) => setAttemptId(attempt.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {attemptId ? (
                  <AttemptPanel
                    key={attemptId}
                    attemptId={attemptId}
                    onMessage={setToastMessage}
                    onClose={() => setAttemptId(undefined)}
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
