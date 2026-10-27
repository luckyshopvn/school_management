import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { fetchStudentFile, requestStudentJson, StudentApiError } from './student-api.js';
import {
  forgetActivity,
  isNetworkFailure,
  offlineEnabled,
  queueSubmit,
  queueUpload,
  readDraft,
  saveDraft as saveLocalDraft,
} from './offline/offline.ts';

// Học sinh làm bài tập trực tuyến (DT-28 phần 28c, YCTD-273): câu trắc nghiệm (không có đáp án trên máy), tự luận, ảnh hoặc tệp
// bài làm, ghi âm; lưu nháp, nộp, xem nhận xét khi giáo viên trả. Bài nhóm: cả nhóm cùng một bản nháp (máy chủ khóa lạc quan, sửa
// trùng thì báo tải lại), nhóm trưởng nộp, mỗi em đánh giá đóng góp. Ảnh được vẽ lại trên máy trước khi gửi nên không còn siêu
// dữ liệu (vị trí, thời điểm chụp); ghi âm dừng ở giới hạn thời lượng của trường
type Choice = { choices?: string[]; text?: string };

interface Item {
  id: string;
  kind: 'question' | 'essay' | 'upload' | 'audio' | 'resource';
  prompt: string | null;
  score: number;
  question: {
    content: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    options: Array<{ key: string; content: string }>;
    parts: number | null;
  } | null;
}

interface FileView {
  id: string;
  item_id: string;
  kind: string;
  file_name: string;
}

interface Attempt {
  id: string;
  attempt_no: number;
  status: 'submitted' | 'returned';
  late: boolean;
  correct: Record<string, boolean> | null;
  score: number | null;
  level: string | null;
  feedback: string | null;
  feedback_ai_assisted: boolean;
  files: FileView[];
  comments: Array<{ id: string; author_name: string; body: string }>;
}

interface AssignmentView {
  activity: { id: string; title: string; instructions: string | null; due_at: string | null };
  work_mode: 'individual' | 'group';
  can_submit: boolean;
  submit_blocked_reason: string | null;
  will_be_late: boolean;
  upload_limits: { max_audio_seconds: number };
  items: Item[];
  group: {
    name: string;
    is_leader: boolean;
    members: Array<{ child_id: string; full_name: string }>;
  } | null;
  draft: { version: number; answers: Record<string, Choice>; files: FileView[] } | null;
  attempts: Attempt[];
}

const LEVEL_LABELS: Record<string, string> = {
  excellent: 'Hoàn thành tốt',
  completed: 'Hoàn thành',
  not_completed: 'Chưa hoàn thành',
};

// Thao tác đã xếp vào hàng đợi trên máy khi mất mạng (DT-28 phần 28j)
class OfflineQueued extends Error {}

const messageOf = (error: unknown) =>
  error instanceof StudentApiError || error instanceof OfflineQueued
    ? error.message
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

// Vẽ lại ảnh lên khung để bỏ siêu dữ liệu (EXIF, vị trí), thu nhỏ cạnh dài về 1600 điểm ảnh, lưu JPEG chất lượng 0,85
async function cleanImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không đọc được ảnh'))), 'image/jpeg', 0.85),
  );
}

function Recorder({ limitSeconds, onDone }: { limitSeconds: number; onDone(blob: Blob): void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearInterval(timer.current);
    recorder.current?.stop();
    setRecording(false);
  };
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream);
    media.ondataavailable = (event) => chunks.push(event.data);
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      onDone(new Blob(chunks, { type: media.mimeType || 'audio/webm' }));
    };
    recorder.current = media;
    media.start();
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= limitSeconds) {
          stop();
        }
        return value + 1;
      });
    }, 1000);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);
  return recording ? (
    <Button variant="secondary" onClick={stop}>
      Dừng ghi ({seconds}/{limitSeconds} giây)
    </Button>
  ) : (
    <Button variant="secondary" onClick={() => void start()}>
      Ghi âm (tối đa {Math.round(limitSeconds / 60)} phút)
    </Button>
  );
}

export function StudentAssignmentView({ activityId, onClose }: { activityId: string; onClose(): void }) {
  const [view, setView] = useState<AssignmentView>();
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [version, setVersion] = useState<number | undefined>();
  const [comment, setComment] = useState('');
  const [selfRating, setSelfRating] = useState(3);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string }>();
  const path = `/api/v1/student/assignments/${activityId}`;
  // Học khi mạng yếu (DT-28 phần 28j): mã chống trùng của lần nộp đang soạn, giữ cùng bản nháp trên máy
  const submitKey = useRef<string>(crypto.randomUUID());
  const load = useCallback(() => {
    requestStudentJson<AssignmentView>(path)
      .then(async (loaded) => {
        setView(loaded);
        setVersion(loaded.draft?.version);
        const local = loaded.can_submit ? await readDraft(activityId) : null;
        if (local) {
          submitKey.current = local.value.submit_key;
          setAnswers(local.value.answers);
          setMessage({ tone: 'info', text: 'Đã khôi phục bản nháp lưu trên máy' });
        } else {
          setAnswers(loaded.draft?.answers ?? {});
        }
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [path, activityId]);
  useEffect(load, [load]);

  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setMessage({ tone: 'success', text: done });
      load();
    } catch (error) {
      setMessage({ tone: error instanceof OfflineQueued ? 'info' : 'danger', text: messageOf(error) });
    }
  };
  const saveDraft = () =>
    act(async () => {
      const saved = await requestStudentJson<{ version: number }>(`${path}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ answers, version }),
      });
      setVersion(saved.version);
    }, 'Đã lưu nháp');
  const sendFile = (itemId: string, blob: Blob, name: string) =>
    act(async () => {
      // Lưu câu trả lời đang gõ trước, để tải lại sau khi gửi tệp không mất chữ
      await requestStudentJson(`${path}/draft`, { method: 'PUT', body: JSON.stringify({ answers, version }) });
      const form = new FormData();
      form.append('file', blob, name);
      try {
        await requestStudentJson(`${path}/items/${itemId}/files?client_key=${crypto.randomUUID()}`, {
          method: 'POST',
          body: form,
        });
      } catch (error) {
        // Mất mạng: giữ tệp trên máy, gửi lại khi có mạng
        if (isNetworkFailure(error) && (await queueUpload(activityId, itemId, blob, name))) {
          throw new OfflineQueued('Chưa có mạng: tệp đã lưu trên máy và sẽ tự gửi khi có mạng');
        }
        throw error;
      }
    }, 'Đã gửi tệp vào bài');
  const pickFile = async (itemId: string, file: File | undefined) => {
    if (!file) return;
    try {
      const blob = file.type.startsWith('image/') ? await cleanImage(file) : file;
      await sendFile(itemId, blob, file.type.startsWith('image/') ? 'anh-bai-lam.jpg' : file.name);
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  const openFile = async (fileId: string) => {
    try {
      const blob = await fetchStudentFile(`/api/v1/student/assignments/files/${fileId}`);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  const setChoice = (itemId: string, value: Choice) => {
    const next = { ...answers, [itemId]: value };
    setAnswers(next);
    void saveLocalDraft(activityId, { answers: next, submit_key: submitKey.current });
  };
  const submit = () =>
    act(
      async () => {
        const body = {
          answers,
          version,
          client_submit_key: submitKey.current,
          client_submitted_at: new Date().toISOString(),
        };
        try {
          await requestStudentJson(`${path}/submit`, { method: 'POST', body: JSON.stringify(body) });
        } catch (error) {
          if (
            isNetworkFailure(error) &&
            (await queueSubmit(activityId, { answers, submit_key: submitKey.current }, version))
          ) {
            throw new OfflineQueued(
              'Chưa có mạng: bài đã lưu trên máy và sẽ tự nộp khi có mạng (ghi lại lúc em bấm nộp)',
            );
          }
          throw error;
        }
        await forgetActivity(activityId);
        submitKey.current = crypto.randomUUID();
      },
      view?.will_be_late ? 'Đã nộp bài (nộp muộn)' : 'Đã nộp bài',
    );

  if (!view) {
    return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  }
  const latest = view.attempts.at(-1);
  const draftFiles = view.draft?.files ?? [];
  const canEdit = view.can_submit || view.draft !== null;
  return (
    <section
      aria-label={`Bài tập ${view.activity.title}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h3 className="text-body font-semibold text-text">{view.activity.title}</h3>
      {view.activity.instructions ? (
        <p className="text-label text-text-secondary">{view.activity.instructions}</p>
      ) : null}
      {view.group ? (
        <p className="text-label text-text">
          {view.group.name}: {view.group.members.map((member) => member.full_name).join(', ')}
          {view.group.is_leader ? ' · Em là người nộp bài của nhóm' : ' · Nhóm trưởng nộp bài'}
        </p>
      ) : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {view.submit_blocked_reason && !view.draft ? <Alert tone="info">{view.submit_blocked_reason}</Alert> : null}
      {canEdit
        ? view.items.map((item, index) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-label text-text">
              <span className="font-semibold">
                Câu {index + 1}
                {item.score > 0 ? ` (${item.score} điểm)` : ''}: {item.question?.content ?? item.prompt}
              </span>
              {item.question?.question_type === 'multiple_choice'
                ? item.question.options.map((option) => (
                    <label key={option.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(answers[item.id]?.choices ?? []).includes(option.key)}
                        onChange={(event) => {
                          const current = answers[item.id]?.choices ?? [];
                          setChoice(item.id, {
                            choices: event.target.checked
                              ? [...current, option.key]
                              : current.filter((key) => key !== option.key),
                          });
                        }}
                      />
                      {option.key}. {option.content}
                    </label>
                  ))
                : null}
              {item.question?.question_type === 'true_false'
                ? Array.from({ length: item.question.parts ?? 4 }, (_, part) => (
                    <label key={part} className="flex items-center gap-2">
                      Ý {String.fromCharCode(97 + part)}
                      <select
                        className={FORM_CONTROL_CLASS}
                        value={answers[item.id]?.choices?.[part] ?? ''}
                        onChange={(event) => {
                          const current = [...(answers[item.id]?.choices ?? [])];
                          current[part] = event.target.value;
                          setChoice(item.id, { choices: current });
                        }}
                      >
                        <option value="">Chọn</option>
                        <option value="Đ">Đúng</option>
                        <option value="S">Sai</option>
                      </select>
                    </label>
                  ))
                : null}
              {item.question?.question_type === 'short_answer' ? (
                <input
                  className={FORM_CONTROL_CLASS}
                  aria-label={`Trả lời câu ${index + 1}`}
                  value={answers[item.id]?.choices?.[0] ?? ''}
                  onChange={(event) => setChoice(item.id, { choices: [event.target.value] })}
                />
              ) : null}
              {item.kind === 'essay' || item.kind === 'upload' || item.question?.question_type === 'essay' ? (
                <textarea
                  className={FORM_CONTROL_CLASS}
                  rows={4}
                  aria-label={`Trả lời câu ${index + 1}`}
                  value={answers[item.id]?.text ?? ''}
                  onChange={(event) => setChoice(item.id, { text: event.target.value })}
                />
              ) : null}
              {item.kind === 'upload' ? (
                <label className="flex flex-col gap-1">
                  Chụp hoặc chọn ảnh, tệp PDF bài làm
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(event) => void pickFile(item.id, event.target.files?.[0])}
                  />
                </label>
              ) : null}
              {item.kind === 'audio' ? (
                <Recorder
                  limitSeconds={view.upload_limits.max_audio_seconds}
                  onDone={(blob) => void sendFile(item.id, blob, 'ghi-am.webm')}
                />
              ) : null}
              {draftFiles
                .filter((file) => file.item_id === item.id)
                .map((file) => (
                  <span key={file.id} className="flex items-center gap-2">
                    <Button variant="text" onClick={() => void openFile(file.id)}>
                      Xem {file.file_name}
                    </Button>
                    <Button
                      variant="text"
                      aria-label={`Xóa ${file.file_name}`}
                      onClick={() =>
                        void act(
                          () =>
                            requestStudentJson(`/api/v1/student/assignments/files/${file.id}`, { method: 'DELETE' }),
                          'Đã xóa tệp',
                        )
                      }
                    >
                      Xóa
                    </Button>
                  </span>
                ))}
            </div>
          ))
        : null}
      {canEdit && offlineEnabled() ? (
        <p className="text-label text-text-secondary">
          Bản nháp tự lưu trên máy này; mất mạng thì bài nộp, tệp được giữ lại và tự gửi khi có mạng.
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void saveDraft()}>
            Lưu nháp
          </Button>
          {view.can_submit && (!view.group || view.group.is_leader) ? (
            <Button variant="primary" onClick={() => void submit()}>
              {view.will_be_late ? 'Nộp bài (muộn)' : 'Nộp bài'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.attempts.map((attempt) => (
        <div key={attempt.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-label text-text">
          <span className="flex items-center gap-2">
            Lần nộp {attempt.attempt_no}
            <StatusBadge
              tone={attempt.status === 'returned' ? 'success' : 'warning'}
              label={attempt.status === 'returned' ? 'Đã trả bài' : 'Đã nộp, chờ chấm'}
            />
            {attempt.late ? <StatusBadge tone="danger" label="Nộp muộn" /> : null}
          </span>
          {attempt.score !== null ? <span>Điểm: {attempt.score}</span> : null}
          {attempt.level ? <span>Mức: {LEVEL_LABELS[attempt.level] ?? attempt.level}</span> : null}
          {attempt.correct ? (
            <span>
              Câu trắc nghiệm đúng: {Object.values(attempt.correct).filter(Boolean).length}/
              {Object.keys(attempt.correct).length}
            </span>
          ) : null}
          {attempt.feedback ? (
            <p className="whitespace-pre-wrap">
              Nhận xét của thầy cô: {attempt.feedback}
              {attempt.feedback_ai_assisted ? ' (có trợ lý AI hỗ trợ)' : ''}
            </p>
          ) : null}
          {attempt.comments.map((entry) => (
            <span key={entry.id}>
              <strong>{entry.author_name}:</strong> {entry.body}
            </span>
          ))}
          <label className="flex flex-col gap-1">
            Trao đổi với thầy cô về bài này
            <input
              className={FORM_CONTROL_CLASS}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <div>
            <Button
              variant="text"
              disabled={!comment.trim()}
              onClick={() =>
                void act(async () => {
                  await requestStudentJson(`${path}/submissions/${attempt.id}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({ body: comment }),
                  });
                  setComment('');
                }, 'Đã gửi')
              }
            >
              Gửi
            </Button>
          </div>
        </div>
      ))}
      {view.group && latest ? (
        <label className="flex flex-col gap-1 text-label text-text">
          Em tự đánh giá phần đóng góp của mình (1 đến 5, chỉ thầy cô xem)
          <input
            type="number"
            min={1}
            max={5}
            className={FORM_CONTROL_CLASS}
            value={selfRating}
            onChange={(event) => setSelfRating(Number(event.target.value))}
          />
          <Button
            variant="secondary"
            onClick={() =>
              void act(
                () =>
                  requestStudentJson(`${path}/contribution`, {
                    method: 'POST',
                    body: JSON.stringify({ self_rating: selfRating }),
                  }),
                'Đã gửi đánh giá đóng góp',
              )
            }
          >
            Gửi đánh giá đóng góp
          </Button>
        </label>
      ) : null}
      <Button onClick={onClose}>Đóng</Button>
    </section>
  );
}
