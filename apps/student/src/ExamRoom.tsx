import { useCallback, useEffect, useRef, useState } from 'react';
import { createFaceWatch, PROCTOR_EVENT_LABELS } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import {
  createFaceCounter,
  enterFullscreen,
  leaveFullscreen,
  openCamera,
  startLiveResponder,
  startRecorder,
  stopStream,
  type Recorder,
} from './proctoring.js';
import {
  readResult,
  reportEvents,
  saveAnswers,
  startAttempt,
  StudentApiError,
  submitAttempt,
  type AttemptResult,
  type AttemptView,
  type CameraState,
  type ClientEventType,
  type QuestionView,
  type StudentExamItem,
} from './student-api.js';

// Phòng làm bài (DT-23 phần 23a, YCTD-211; GD-106): khóa toàn màn hình, camera kiểm tra có mặt và nhiều khuôn mặt ngay trên máy,
// đồng hồ theo máy chủ, lưu nháp từng câu, nộp bài. Giao diện chỉ hiển thị: đáp án đúng không có ở máy học sinh, giờ và điểm do
// máy chủ quyết định. Sự kiện chỉ để giáo viên xét, không tự trừ điểm, không chặn thao tác của máy
type Stage = 'lobby' | 'starting' | 'running' | 'finished' | 'replaced';

const AUTOSAVE_DELAY_MILLISECONDS = 800;
const AUTOSAVE_RETRY_MILLISECONDS = 4000;
const FACE_CHECK_INTERVAL_MILLISECONDS = 1500;
const DUPLICATE_EVENT_MILLISECONDS = 1000;

function messageOf(error: unknown): string {
  return error instanceof StudentApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function sameAnswer(left: string[] | undefined, right: string[] | undefined) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: QuestionView;
  value: string[];
  onChange(next: string[]): void;
}) {
  const heading = `Câu ${question.position}`;
  return (
    <section aria-label={heading} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-label font-semibold text-text">
        {heading} <span className="font-normal text-text-secondary">({question.score} điểm)</span>
      </h2>
      <p className="whitespace-pre-wrap text-body text-text">{question.content}</p>
      {question.type === 'multiple_choice' ? (
        <div className="flex flex-col gap-2" role="group" aria-label={`Đáp án ${heading}`}>
          {(question.options ?? []).map((option) => {
            const checked = value.includes(option.label);
            return (
              <label key={option.label} className="flex items-start gap-2 text-body text-text">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked ? value.filter((label) => label !== option.label) : [...value, option.label].sort(),
                    )
                  }
                />
                <span>
                  <strong>{option.label}.</strong> {option.content}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
      {question.type === 'true_false' ? (
        <div className="flex flex-col gap-2">
          {(question.statements ?? []).map((statement, index) => {
            const current = value[index] ?? '';
            const set = (choice: string) => {
              const next = Array.from({ length: question.statements?.length ?? 0 }, (_unused, i) => value[i] ?? '');
              next[index] = choice;
              onChange(next);
            };
            return (
              <fieldset key={statement.label} className="flex flex-wrap items-center gap-3">
                <legend className="sr-only">{`${heading} ý ${statement.label}`}</legend>
                <span className="flex-1 text-body text-text">
                  <strong>{statement.label})</strong> {statement.content}
                </span>
                {['Đ', 'S'].map((choice) => (
                  <label key={choice} className="flex items-center gap-1 text-label text-text">
                    <input
                      type="radio"
                      name={`q${question.number}-${statement.label}`}
                      aria-label={`${heading} ý ${statement.label} ${choice === 'Đ' ? 'đúng' : 'sai'}`}
                      checked={current === choice}
                      onChange={() => set(choice)}
                    />
                    {choice === 'Đ' ? 'Đúng' : 'Sai'}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      ) : null}
      {question.type === 'short_answer' ? (
        <input
          aria-label={`Đáp số ${heading}`}
          className="w-full max-w-xs rounded-lg border border-border-strong bg-card px-3 py-2 text-body text-text"
          value={value[0] ?? ''}
          maxLength={200}
          onChange={(event) => onChange(event.target.value === '' ? [] : [event.target.value])}
        />
      ) : null}
      {question.type === 'essay' ? (
        <textarea
          aria-label={`Bài làm ${heading}`}
          className="min-h-40 w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-body text-text"
          value={value[0] ?? ''}
          maxLength={20000}
          onChange={(event) => onChange(event.target.value === '' ? [] : [event.target.value])}
        />
      ) : null}
    </section>
  );
}

export function ExamRoom({
  assignment,
  onExit,
}: {
  assignment: StudentExamItem;
  onExit(result: AttemptResult | null): void;
}) {
  const [stage, setStage] = useState<Stage>('lobby');
  const [attempt, setAttempt] = useState<AttemptView>();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const [remaining, setRemaining] = useState(0);
  const [violations, setViolations] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [savedAt, setSavedAt] = useState<Date>();
  const [needFullscreen, setNeedFullscreen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraNote, setCameraNote] = useState<string>();
  const [roomCode, setRoomCode] = useState('');
  const [noticeRead, setNoticeRead] = useState(false);
  const [watching, setWatching] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const attemptRef = useRef<AttemptView | undefined>(undefined);
  const answersRef = useRef<Record<string, string[]>>({});
  const dirty = useRef(new Set<string>());
  const deadlineRef = useRef(0);
  const clockOffset = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastEvent = useRef<Record<string, number>>({});
  const finishing = useRef(false);
  const [retryTick, setRetryTick] = useState(0);
  const [saveTick, setSaveTick] = useState(0);

  const stopEverything = useCallback(() => {
    void recorderRef.current?.stop();
    recorderRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    void leaveFullscreen();
  }, []);

  useEffect(() => () => stopEverything(), [stopEverything]);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof StudentApiError && error.sessionReplaced) {
      setStage('replaced');
      return true;
    }
    return false;
  }, []);

  const finish = useCallback(
    async (outcome: AttemptResult | null) => {
      finishing.current = true;
      stopEverything();
      setResult(outcome);
      setStage('finished');
    },
    [stopEverything],
  );

  const applyAttempt = useCallback((view: AttemptView) => {
    attemptRef.current = view;
    setAttempt(view);
    answersRef.current = view.answers;
    setAnswers(view.answers);
    setViolations(view.violations);
    clockOffset.current = Date.parse(view.server_now) - Date.now();
    deadlineRef.current = Date.parse(view.deadline_at);
    setRemaining(view.remaining_seconds);
  }, []);

  // Vào làm: xin toàn màn hình và camera ngay trong thao tác bấm nút (trình duyệt chỉ cho khi học sinh chủ động), rồi mở lượt
  const proctored = assignment.proctor_live || assignment.proctor_record;

  async function begin() {
    setErrorMessage(undefined);
    setStage('starting');
    const fullscreen = assignment.fullscreen_required ? await enterFullscreen() : true;
    let camera: { state: CameraState; stream: MediaStream | null } = { state: 'off', stream: null };
    if (assignment.camera_enabled) {
      camera = await openCamera();
    }
    try {
      const view = await startAttempt(
        assignment.id,
        camera.state,
        assignment.exam_mode === 'at-school' ? roomCode.trim() : null,
        proctored && noticeRead,
      );
      streamRef.current = camera.stream;
      applyAttempt(view);
      setNeedFullscreen(assignment.fullscreen_required && !fullscreen);
      setCameraNote(
        camera.state === 'granted'
          ? undefined
          : assignment.camera_enabled
            ? 'Camera không bật được; giáo viên sẽ được báo để xem xét.'
            : undefined,
      );
      if (view.status === 'submitted') {
        await finish(null);
        return;
      }
      setStage('running');
    } catch (error) {
      stopStream(camera.stream);
      await leaveFullscreen();
      if (!handleError(error)) {
        setErrorMessage(messageOf(error));
        setStage('lobby');
      }
    }
  }

  // Đồng hồ: tính theo giờ máy chủ lúc mở lượt; hết giờ thì tự nộp
  const submit = useCallback(
    async (automatic: boolean) => {
      const current = attemptRef.current;
      if (!current || finishing.current) {
        return;
      }
      finishing.current = true;
      setSubmitting(true);
      setConfirmSubmit(false);
      try {
        // Đoạn bản ghi cuối phải lên máy chủ trước khi nộp (nộp rồi máy chủ không nhận thêm)
        const recorder = recorderRef.current;
        recorderRef.current = null;
        await recorder?.stop();
        const outcome = await submitAttempt(current.id, answersRef.current);
        dirty.current.clear();
        stopEverything();
        setResult(outcome);
        setStage('finished');
      } catch (error) {
        finishing.current = false;
        if (!handleError(error)) {
          setErrorMessage(
            automatic
              ? `Hết giờ nhưng chưa nộp được bài: ${messageOf(error)}. Các câu đã lưu vẫn được tính.`
              : messageOf(error),
          );
        }
      } finally {
        setSubmitting(false);
      }
    },
    [handleError, stopEverything],
  );

  useEffect(() => {
    if (stage !== 'running') {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - (Date.now() + clockOffset.current)) / 1000));
      setRemaining(left);
      if (left <= 0) {
        void submit(true);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [stage, submit]);

  // Báo sự kiện cho máy chủ; máy chủ trả số lần rời bài và kết quả xử lý (cảnh báo, đánh dấu, tự nộp)
  const report = useCallback(
    async (type: ClientEventType, detail?: Record<string, number>) => {
      const current = attemptRef.current;
      if (!current || finishing.current) {
        return;
      }
      const now = Date.now();
      if (now - (lastEvent.current[type] ?? 0) < DUPLICATE_EVENT_MILLISECONDS) {
        return;
      }
      lastEvent.current[type] = now;
      try {
        const reply = await reportEvents(current.id, [
          { type, client_at: new Date().toISOString(), ...(detail ? { detail } : {}) },
        ]);
        setViolations(reply.violations);
        if (reply.status === 'submitted') {
          const outcome = await readResult(current.id).catch(() => null);
          await finish(outcome);
          setNotice('Bài đã được nộp vì em rời bài quá số lần cho phép.');
        } else if (reply.outcome === 'warn') {
          setNotice(
            `Em đã rời bài ${reply.violations} lần, tối đa cho phép ${reply.max_violations} lần. Hãy ở yên trong bài làm.`,
          );
        } else if (reply.outcome === 'flag') {
          setNotice('Em đã rời bài quá số lần cho phép. Giáo viên sẽ xem xét; hãy ở yên trong bài làm.');
        }
      } catch (error) {
        handleError(error);
      }
    },
    [finish, handleError],
  );

  // Khóa toàn màn hình, rời trang, đổi cửa sổ
  useEffect(() => {
    if (stage !== 'running') {
      return undefined;
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && assignment.fullscreen_required) {
        setNeedFullscreen(true);
        void report('fullscreen_exit');
      } else {
        setNeedFullscreen(false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void report('page_hidden');
      }
    };
    const onBlur = () => void report('window_blur');
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [stage, assignment.fullscreen_required, report]);

  // Camera: nhận diện ngay trên máy, chỉ báo sự kiện khi không thấy mặt hoặc có nhiều khuôn mặt kéo dài
  useEffect(() => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (stage !== 'running' || !stream || !video) {
      return undefined;
    }
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    let active = true;
    const track = stream.getVideoTracks()[0];
    const onEnded = () => void report('camera_lost');
    track?.addEventListener('ended', onEnded);
    const watch = createFaceWatch();
    let timer: number | undefined;
    createFaceCounter()
      .then((count) => {
        const tick = async () => {
          if (!active) {
            return;
          }
          if (video.readyState >= 2 && !document.hidden) {
            try {
              for (const signal of watch.push(await count(video), Date.now())) {
                void report(signal.type, { duration_ms: signal.duration_ms, faces: signal.faces });
              }
            } catch {
              // Một khung hình lỗi thì bỏ qua, khung sau đọc lại
            }
          }
          timer = window.setTimeout(() => void tick(), FACE_CHECK_INTERVAL_MILLISECONDS);
        };
        void tick();
      })
      .catch(() => {
        setCameraNote('Không bật được bộ kiểm tra khuôn mặt trên máy này; em vẫn làm bài được, giáo viên sẽ được báo.');
        void report('camera_lost');
      });
    return () => {
      active = false;
      track?.removeEventListener('ended', onEnded);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [stage, report]);

  // Giám thị camera (23e): trả lời phiên xem trực tiếp của giáo viên và ghi hình từng đoạn ngắn; hình đi thẳng tới giáo viên
  // (WebRTC), máy chủ chỉ chuyển thông điệp báo hiệu
  useEffect(() => {
    const stream = streamRef.current;
    if (stage !== 'running' || !stream || !attempt || !attempt.policy.proctor_live) {
      return undefined;
    }
    const responder = startLiveResponder(attempt.id, stream, setWatching);
    return () => {
      responder.stop();
      setWatching(0);
    };
  }, [stage, attempt]);

  useEffect(() => {
    const stream = streamRef.current;
    if (stage !== 'running' || !stream || !attempt || !attempt.policy.proctor_record || recorderRef.current) {
      return undefined;
    }
    const recorder = startRecorder(attempt.id, stream, () =>
      setCameraNote('Không ghi hình được trên máy này hoặc đường truyền chưa ổn; giáo viên sẽ được báo để xem xét.'),
    );
    recorderRef.current = recorder;
    return undefined;
  }, [stage, attempt]);

  // Lưu nháp từng câu: gom các câu vừa sửa, gửi sau một nhịp ngắn; lỗi mạng thì giữ lại và thử lại, bài vẫn làm tiếp được
  useEffect(() => {
    if (stage !== 'running' || dirty.current.size === 0) {
      return undefined;
    }
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      const current = attemptRef.current;
      if (!current) {
        return;
      }
      const keys = [...dirty.current];
      const payload = Object.fromEntries(keys.map((key) => [key, answersRef.current[key] ?? []]));
      try {
        const reply = await saveAnswers(current.id, payload);
        for (const key of keys) {
          if (sameAnswer(answersRef.current[key], payload[key])) {
            dirty.current.delete(key);
          }
        }
        deadlineRef.current = Date.now() + clockOffset.current + reply.remaining_seconds * 1000;
        setSavedAt(new Date(reply.saved_at));
        setSaveState(dirty.current.size === 0 ? 'saved' : 'saving');
        if (dirty.current.size > 0) {
          setSaveTick((value) => value + 1);
        }
      } catch (error) {
        if (!handleError(error)) {
          setSaveState('failed');
          window.setTimeout(() => setRetryTick((value) => value + 1), AUTOSAVE_RETRY_MILLISECONDS);
        }
      }
    }, AUTOSAVE_DELAY_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [stage, saveTick, retryTick, handleError]);

  function change(question: QuestionView, next: string[]) {
    const key = String(question.number);
    answersRef.current = { ...answersRef.current, [key]: next };
    setAnswers(answersRef.current);
    dirty.current.add(key);
    setSaveTick((value) => value + 1);
  }

  async function returnToFullscreen() {
    if (await enterFullscreen()) {
      setNeedFullscreen(false);
    }
  }

  if (stage === 'replaced') {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-12">
        <Alert tone="danger">
          Bài này đang được làm ở một phiên đăng nhập khác nên phiên này đã bị đóng. Nếu không phải em, hãy báo giáo
          viên và đổi mật khẩu.
        </Alert>
        <Button variant="primary" onClick={() => onExit(null)}>
          Về danh sách bài thi
        </Button>
      </main>
    );
  }

  if (stage === 'finished') {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-12">
        <h1 className="text-page-title font-bold text-text">Đã nộp bài</h1>
        {notice ? <Alert tone="warning">{notice}</Alert> : null}
        {result?.visible ? (
          <Alert tone="success">
            Điểm của em: {result.total_score ?? 'đang chờ giáo viên chấm'}
            {result.max_score !== null ? ` / ${result.max_score}` : ''}
          </Alert>
        ) : (
          <Alert tone="info">Bài của em đã được ghi nhận. Kết quả sẽ hiện theo cách giáo viên đã chọn.</Alert>
        )}
        <Button variant="primary" onClick={() => onExit(result)}>
          Về danh sách bài thi
        </Button>
      </main>
    );
  }

  if (stage !== 'running' || !attempt) {
    const resume = assignment.state === 'in_progress';
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-12">
        <h1 className="text-page-title font-bold text-text">{assignment.title}</h1>
        <p className="text-label text-text-secondary">
          {assignment.subject_name} · {assignment.duration_minutes} phút · làm tối đa {assignment.max_attempts} lần
        </p>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <section
          aria-label="Điều cần biết trước khi làm bài"
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-label font-semibold text-text">Điều cần biết trước khi làm bài</h2>
          <ul className="list-disc pl-5 text-body text-text">
            <li>Đồng hồ chạy trên máy chủ của nhà trường; tải lại trang hay mất mạng không làm đồng hồ dừng lại.</li>
            <li>Mỗi câu em chọn được lưu ngay; mất mạng thì vào lại để làm tiếp trong thời gian còn lại.</li>
            {assignment.fullscreen_required ? (
              <li>
                Bài làm ở chế độ toàn màn hình. Thoát toàn màn hình, rời trang hay đổi cửa sổ được ghi lại để giáo viên
                xem; quá số lần cho phép, bài có thể bị đánh dấu hoặc tự nộp.
              </li>
            ) : null}
            {assignment.camera_enabled && !proctored ? (
              <li>
                Camera được dùng để kiểm tra có em trong khung hình và không có người khác.{' '}
                <strong>Hình chỉ được xử lý ngay trên máy của em, không gửi hình hay video lên máy chủ</strong>; máy chủ
                chỉ ghi loại sự kiện (ví dụ không thấy mặt) và thời điểm. Giáo viên dùng sự kiện để xem xét, hệ thống
                không tự trừ điểm.
              </li>
            ) : null}
            {assignment.camera_enabled && proctored ? (
              <li>
                Bài thi này có giám sát bằng camera. Máy của em kiểm tra có em trong khung hình và không có người khác
                (hình xử lý ngay trên máy, máy chủ chỉ ghi loại sự kiện và thời điểm)
                {assignment.proctor_live
                  ? '; giáo viên coi thi có thể xem hình camera của em trực tiếp trong lúc thi, mỗi lần xem đều được ghi lại, và khi có người xem em sẽ thấy dòng thông báo trên màn hình'
                  : ''}
                {assignment.proctor_record
                  ? '; hình camera được ghi lại, lưu mã hoá và tự xoá sau thời hạn của nhà trường, chỉ giáo viên giao bài và người quản lý xem lại, không ai tải xuống được'
                  : ''}
                . Em không bị nhận diện danh tính bằng khuôn mặt. Hệ thống không tự trừ điểm vì sự kiện camera; giáo
                viên xem xét.
              </li>
            ) : null}
            <li>Một bài chỉ làm ở một phiên đăng nhập; đăng nhập thêm ở máy khác sẽ bị ghi lại.</li>
            {assignment.exam_mode === 'at-school' ? (
              <li>
                Bài thi này thi tại trường: em nhập mã phòng thi do giám thị đọc, và chỉ vào được từ mạng của nhà
                trường. Giám thị đóng phòng thì không vào được nữa (bài đang làm vẫn nộp được).
              </li>
            ) : null}
          </ul>
        </section>
        {assignment.exam_mode === 'at-school' ? (
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Mã phòng thi
            <input
              aria-label="Mã phòng thi"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              className="w-40 rounded-lg border border-border-strong bg-card px-3 py-2 text-body text-text"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, ''))}
            />
          </label>
        ) : null}
        {proctored ? (
          <label className="flex items-start gap-2 text-body text-text">
            <input
              type="checkbox"
              aria-label="Em đã đọc thông báo giám sát bằng camera"
              checked={noticeRead}
              onChange={(event) => setNoticeRead(event.target.checked)}
            />
            <span>Em đã đọc thông báo giám sát bằng camera ở trên và đồng ý làm bài trong điều kiện đó.</span>
          </label>
        ) : null}
        <Button
          variant="primary"
          onClick={() => void begin()}
          disabled={
            stage === 'starting' ||
            (assignment.exam_mode === 'at-school' && roomCode.length !== 6) ||
            (proctored && !noticeRead)
          }
        >
          {stage === 'starting' ? 'Đang vào bài…' : resume ? 'Làm tiếp bài' : 'Bắt đầu làm bài'}
        </Button>
        <Button variant="text" onClick={() => onExit(null)}>
          Quay lại danh sách
        </Button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
        <h1 className="flex-1 text-label font-semibold text-text">{attempt.title}</h1>
        <span aria-label="Thời gian còn lại" role="timer" className="text-page-title font-bold text-text tabular-nums">
          {formatClock(remaining)}
        </span>
        <span className="text-label text-text-secondary" aria-live="polite">
          {saveState === 'failed'
            ? 'Chưa lưu được, đang thử lại'
            : saveState === 'saving'
              ? 'Đang lưu…'
              : savedAt
                ? `Đã lưu lúc ${savedAt.toLocaleTimeString('vi-VN')}`
                : 'Chưa có câu nào được lưu'}
        </span>
        {streamRef.current ? (
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Hình camera của em (chỉ hiện trên máy này)"
            className="h-12 w-16 rounded border border-border object-cover"
          />
        ) : null}
        <Button variant="primary" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
          Nộp bài
        </Button>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {notice ? <Alert tone="warning">{notice}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {cameraNote ? <Alert tone="info">{cameraNote}</Alert> : null}
        {watching > 0 ? (
          <p role="status" aria-live="polite" className="text-label font-medium text-text">
            Giáo viên coi thi đang xem camera của em ({watching}).
          </p>
        ) : null}
        {violations > 0 ? (
          <p className="text-label text-text-secondary" aria-live="polite">
            Số lần rời bài đã ghi: {violations}/{attempt.policy.max_violations}
          </p>
        ) : null}
        {confirmSubmit ? (
          <div
            role="alertdialog"
            aria-label="Xác nhận nộp bài"
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
          >
            <p className="text-body text-text">Em chắc chắn nộp bài? Nộp rồi không sửa được nữa.</p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void submit(false)} disabled={submitting}>
                Xác nhận nộp bài
              </Button>
              <Button onClick={() => setConfirmSubmit(false)}>Làm tiếp</Button>
            </div>
          </div>
        ) : null}
        {attempt.questions.map((question) => (
          <QuestionCard
            key={question.number}
            question={question}
            value={answers[String(question.number)] ?? []}
            onChange={(next) => change(question, next)}
          />
        ))}
        <Button variant="primary" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
          Nộp bài
        </Button>
      </main>
      {needFullscreen ? (
        <div
          role="alertdialog"
          aria-label="Quay lại toàn màn hình"
          className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-page/95 px-4 text-center"
        >
          <p className="max-w-md text-body text-text">
            Bài làm cần ở chế độ toàn màn hình. Việc thoát toàn màn hình đã được ghi lại (
            {PROCTOR_EVENT_LABELS.fullscreen_exit}).
          </p>
          <Button variant="primary" onClick={() => void returnToFullscreen()}>
            Quay lại toàn màn hình
          </Button>
        </div>
      ) : null}
    </div>
  );
}
