import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, StatusBadge, type StatusTone } from '@school-management/ui';
import { ExamRoom } from './ExamRoom.js';
import { StudentLearningPanel } from './StudentLearningPanel.js';
import {
  listStudentExams,
  readResult,
  readStudentProfile,
  StudentApiError,
  type AttemptResult,
  type AssignmentState,
  type StudentExamItem,
  type StudentProfile,
} from './student-api.js';
import { useStudentSession } from './student-session.js';

// Màn hình học sinh (DT-23 phần 23a, YCTD-211): danh sách bài được giao và hạn, làm bài, xem kết quả theo chế độ giáo viên chọn,
// đổi mật khẩu ở lần đầu đăng nhập. Học sinh chỉ thấy dữ liệu của chính mình
const STATE_LABELS: Record<AssignmentState, { label: string; tone: StatusTone }> = {
  upcoming: { label: 'Chưa đến giờ mở', tone: 'neutral' },
  open: { label: 'Đang mở', tone: 'success' },
  in_progress: { label: 'Đang làm dở', tone: 'warning' },
  closed: { label: 'Đã xong hoặc đã đóng', tone: 'info' },
};

function messageOf(error: unknown): string {
  return error instanceof StudentApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(iso),
  );

function ResultPanel({ result, onClose }: { result: AttemptResult; onClose(): void }) {
  return (
    <section
      aria-label={`Kết quả ${result.title}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-label font-semibold text-text">Kết quả: {result.title}</h2>
      {result.visible ? (
        <>
          <p className="text-body text-text">
            Tổng điểm: <strong>{result.total_score ?? 'đang chờ giáo viên chấm'}</strong>
            {result.max_score !== null ? ` / ${result.max_score}` : ''}
          </p>
          <ul className="flex flex-col gap-1 text-label text-text">
            {result.questions.map((question) => (
              <li key={question.number}>
                Câu {question.position}: {question.earned}/{question.max} điểm
                {question.correct === true ? ' (đúng)' : question.correct === false ? ' (chưa đúng)' : ''}
                {question.correct_answer ? ` · đáp án đúng: ${question.correct_answer.join(', ')}` : ''}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Alert tone="info">Kết quả chưa được mở xem. Em sẽ thấy kết quả theo cách giáo viên đã chọn.</Alert>
      )}
      <Button onClick={onClose}>Đóng</Button>
    </section>
  );
}

export function StudentHomeScreen() {
  const session = useStudentSession();
  const [profile, setProfile] = useState<StudentProfile>();
  const [items, setItems] = useState<StudentExamItem[]>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [room, setRoom] = useState<StudentExamItem>();
  const [result, setResult] = useState<AttemptResult>();

  const load = useCallback(async () => {
    try {
      setErrorMessage(undefined);
      const [me, exams] = await Promise.all([readStudentProfile(), listStudentExams()]);
      setProfile(me);
      setItems(exams.items);
    } catch (error) {
      setItems(undefined);
      setErrorMessage(messageOf(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openResult(item: StudentExamItem) {
    if (!item.result) {
      return;
    }
    try {
      setResult(await readResult(item.result.attempt_id));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }

  if (room) {
    return (
      <ExamRoom
        assignment={room}
        onExit={(outcome) => {
          setRoom(undefined);
          if (outcome) {
            setResult(outcome);
          }
          void load();
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-page-title font-bold text-text">Xin chào, {profile?.full_name ?? '…'}</h1>
          <p className="text-label text-text-secondary">{profile ? `Lớp ${profile.class_name}` : ' '}</p>
        </div>
        <Button onClick={() => void session.logout()}>Đăng xuất</Button>
      </header>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {result ? <ResultPanel result={result} onClose={() => setResult(undefined)} /> : null}
      <section aria-label="Bài thi được giao" className="flex flex-col gap-3">
        <h2 className="text-label font-semibold text-text">Bài thi được giao</h2>
        {items?.length === 0 ? <Alert tone="info">Hiện chưa có bài thi nào được giao cho em.</Alert> : null}
        {items?.map((item) => {
          const state = STATE_LABELS[item.state];
          return (
            <article
              key={item.id}
              aria-label={item.title}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex-1 text-body font-semibold text-text">{item.title}</h3>
                <StatusBadge tone={state.tone} label={state.label} />
              </div>
              <p className="text-label text-text-secondary">
                {item.subject_name} · {item.duration_minutes} phút · đã làm {item.attempts_used}/{item.max_attempts} lần
              </p>
              <p className="text-label text-text-secondary">
                Mở {formatTime(item.opens_at)} · đóng {formatTime(item.closes_at)}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.state === 'open' || item.state === 'in_progress' ? (
                  <Button variant="primary" onClick={() => setRoom(item)}>
                    {item.state === 'in_progress' ? 'Làm tiếp bài' : 'Vào làm bài'}
                  </Button>
                ) : null}
                {item.result ? <Button onClick={() => void openResult(item)}>Xem kết quả</Button> : null}
              </div>
            </article>
          );
        })}
      </section>
      {/* Lớp học trực tuyến (DT-28 phần 28b) */}
      <StudentLearningPanel />
    </main>
  );
}
