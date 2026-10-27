import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';
import { HomeworkAbsences, HomeworkReleasePanel } from './HomeworkPanels.js';

// Bài tập trực tuyến của giáo viên (DT-28 phần 28c, YCTD-273): soạn bài (câu đã duyệt của ngân hàng câu hỏi, tự luận, ảnh hoặc tệp,
// ghi âm), giao cho cả lớp hoặc làm theo nhóm của bộ nhóm, phát hành, theo dõi bài nộp, chấm từng câu hoặc theo mức, nhận xét
// (ngân hàng nhận xét, gợi ý của trợ lý AI chỉ từ đề và điểm đã chấm, không gửi bài làm), trả bài. Phiên bản bài, đích nhóm và
// thang tiêu chí soạn được qua tuyến máy chủ; màn hình này làm bài một phiên bản cho cả lớp hoặc theo bộ nhóm
type ItemKind = 'question' | 'essay' | 'upload' | 'audio' | 'resource';

interface EditorItem {
  id?: string;
  kind: ItemKind;
  question_id?: string | null;
  prompt: string | null;
  score: number;
  snapshot?: { content: string; options: Array<{ key: string; content: string }>; answer: string[] } | null;
}

interface Editor {
  activity: { id: string; title: string; status: string; due_at: string | null };
  assignment: {
    context: 'in_class' | 'homework';
    estimated_minutes: number | null;
    work_mode: 'individual' | 'group';
    group_set_id: string | null;
    late_policy: 'allow' | 'block';
    max_attempts: number;
    grading: 'score' | 'rubric' | 'level' | 'completion' | 'none';
    show_results: 'after_submit' | 'after_return';
    released: boolean;
    closed_at: string | null;
  } | null;
  items: EditorItem[];
  recipient_count: number;
  group_sets: Array<{ id: string; name: string }>;
}

interface BankQuestion {
  id: string;
  content: string;
  question_type: string;
}

interface SubmissionSummary {
  id: string;
  attempt_no: number;
  status: 'submitted' | 'returned';
  late: boolean;
  score: number | null;
  level: string | null;
}

interface SubmissionRow {
  child_id?: string;
  group_id?: string;
  full_name?: string;
  name?: string;
  excused?: boolean;
  latest: SubmissionSummary | null;
  has_draft: boolean;
}

interface SubmissionDetail {
  submission: {
    id: string;
    status: string;
    late: boolean;
    score: number | null;
    level: string | null;
    feedback: string | null;
    item_scores: Record<string, number>;
  };
  grading: string;
  items: Array<EditorItem & { id: string }>;
  answers: Record<string, { choices?: string[]; text?: string }>;
  objective: { earned: Record<string, number>; correct: Record<string, boolean> };
  files: Array<{ id: string; item_id: string; kind: string; file_name: string }>;
  comments: Array<{ id: string; author_name: string; body: string }>;
  members: Array<{ child_id: string; full_name: string }>;
  contributions: Array<{ child_id: string; self_rating: number | null; adjusted_score: number | null }>;
}

const KIND_LABELS: Record<ItemKind, string> = {
  question: 'Câu trắc nghiệm',
  essay: 'Tự luận',
  upload: 'Ảnh hoặc tệp',
  audio: 'Ghi âm',
  resource: 'Học liệu',
};
const LEVELS = [
  { value: 'excellent', label: 'Hoàn thành tốt' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'not_completed', label: 'Chưa hoàn thành' },
];

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const base = (activityId: string) => `/api/v1/learning/activities/${activityId}/assignment`;

function Composer({ activityId, editor, onSaved }: { activityId: string; editor: Editor; onSaved(): void }) {
  const [items, setItems] = useState<EditorItem[]>(editor.items);
  const [grading, setGrading] = useState(editor.assignment?.grading ?? 'score');
  const [workMode, setWorkMode] = useState(editor.assignment?.work_mode ?? 'individual');
  const [groupSetId, setGroupSetId] = useState(editor.assignment?.group_set_id ?? editor.group_sets[0]?.id ?? '');
  const [latePolicy, setLatePolicy] = useState(editor.assignment?.late_policy ?? 'allow');
  // Bài về nhà (DT-28 phần 28f): ngữ cảnh và số phút dự kiến để tính khối lượng theo quy tắc của trường
  const [context, setContext] = useState(editor.assignment?.context ?? 'in_class');
  const [minutes, setMinutes] = useState(
    editor.assignment?.estimated_minutes ? String(editor.assignment.estimated_minutes) : '',
  );
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<ItemKind>('essay');
  const [search, setSearch] = useState('');
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const findQuestions = () =>
    requestJson<BankQuestion[]>(`${base(activityId)}/questions?search=${encodeURIComponent(search)}`)
      .then(setBank)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  const save = async () => {
    setErrorMessage(undefined);
    try {
      await requestJson(base(activityId), {
        method: 'PUT',
        body: JSON.stringify({
          context,
          estimated_minutes: minutes ? Number(minutes) : null,
          grading,
          late_policy: latePolicy,
          work_mode: workMode,
          group_set_id: workMode === 'group' ? groupSetId : null,
          items: items.map((item) => ({
            kind: item.kind,
            question_id: item.question_id ?? null,
            prompt: item.prompt,
            score: item.score,
          })),
        }),
      });
      onSaved();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <section aria-label="Soạn bài tập" className="flex flex-col gap-3">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <label className="text-label font-medium text-text">
        Làm ở đâu
        <select
          aria-label="Làm ở đâu"
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={context}
          onChange={(event) => setContext(event.target.value as typeof context)}
        >
          <option value="in_class">Trên lớp</option>
          <option value="homework">Bài về nhà</option>
        </select>
      </label>
      {context === 'homework' ? (
        <label className="text-label font-medium text-text">
          Số phút dự kiến
          <input
            type="number"
            min={1}
            max={600}
            aria-label="Số phút dự kiến"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
      ) : null}
      <label className="text-label font-medium text-text">
        Cách chấm
        <select
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={grading}
          onChange={(event) => setGrading(event.target.value as typeof grading)}
        >
          <option value="score">Chấm điểm (thang 10)</option>
          <option value="level">Chấm theo mức (Tiểu học)</option>
          <option value="completion">Chỉ ghi hoàn thành</option>
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Cách làm
        <select
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={workMode}
          onChange={(event) => setWorkMode(event.target.value as typeof workMode)}
        >
          <option value="individual">Mỗi em một bài</option>
          <option value="group" disabled={editor.group_sets.length === 0}>
            Theo nhóm (nhóm trưởng nộp)
          </option>
        </select>
      </label>
      {workMode === 'group' ? (
        <label className="text-label font-medium text-text">
          Bộ nhóm
          <select
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={groupSetId}
            onChange={(event) => setGroupSetId(event.target.value)}
          >
            {editor.group_sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-label text-text">
        <input
          type="checkbox"
          checked={latePolicy === 'allow'}
          onChange={(event) => setLatePolicy(event.target.checked ? 'allow' : 'block')}
        />
        Cho nộp muộn (đánh dấu muộn, không trừ điểm)
      </label>
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-label">
            <span className="font-semibold">
              {index + 1}. {KIND_LABELS[item.kind]}
            </span>
            <span>{item.snapshot?.content ?? item.prompt}</span>
            <label className="flex items-center gap-2">
              Điểm
              <input
                type="number"
                min={0}
                max={10}
                step={0.25}
                className={`w-24 ${FORM_CONTROL_CLASS}`}
                aria-label={`Điểm câu ${index + 1}`}
                value={item.score}
                onChange={(event) =>
                  setItems(
                    items.map((other, at) => (at === index ? { ...other, score: Number(event.target.value) } : other)),
                  )
                }
              />
              <Button variant="text" onClick={() => setItems(items.filter((_, at) => at !== index))}>
                Bỏ câu
              </Button>
            </label>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <label className="text-label font-medium text-text">
          Loại yêu cầu
          <select
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={kind}
            onChange={(event) => setKind(event.target.value as ItemKind)}
          >
            <option value="essay">Tự luận</option>
            <option value="upload">Ảnh hoặc tệp bài làm</option>
            <option value="audio">Ghi âm</option>
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Yêu cầu
          <textarea
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            rows={2}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <div>
          <Button
            disabled={!prompt.trim()}
            onClick={() => {
              setItems([...items, { kind, prompt: prompt.trim(), score: 1 }]);
              setPrompt('');
            }}
          >
            Thêm yêu cầu
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <label className="text-label font-medium text-text">
          Tìm câu đã duyệt trong ngân hàng câu hỏi
          <input
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div>
          <Button variant="secondary" onClick={() => void findQuestions()}>
            Tìm câu hỏi
          </Button>
        </div>
        <ul className="flex flex-col gap-1">
          {bank.map((question) => (
            <li key={question.id} className="flex items-center gap-2 text-label">
              <span className="flex-1">{question.content}</span>
              <Button
                variant="text"
                aria-label={`Thêm câu ${question.content}`}
                disabled={items.some((item) => item.question_id === question.id)}
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      kind: 'question',
                      question_id: question.id,
                      prompt: null,
                      score: 1,
                      snapshot: { content: question.content, options: [], answer: [] },
                    },
                  ])
                }
              >
                Thêm
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Button variant="primary" disabled={items.length === 0} onClick={() => void save()}>
          Lưu bài tập
        </Button>
      </div>
    </section>
  );
}

function SubmissionView({
  submissionId,
  activityId,
  onBack,
}: {
  submissionId: string;
  activityId: string;
  onBack(): void;
}) {
  const [detail, setDetail] = useState<SubmissionDetail>();
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [level, setLevel] = useState('');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [note, setNote] = useState('');
  const [bank, setBank] = useState<Array<{ id: string; content: string }>>([]);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  // Chỉ nhận phản hồi của lần đọc mới nhất: hai lần đọc chồng nhau (StrictMode, đọc lại sau khi lưu) thì phản hồi đến muộn của lần
  // trước không ghi đè điểm, nhận xét giáo viên vừa nhập
  const loadToken = useRef(0);
  const load = useCallback(() => {
    const token = ++loadToken.current;
    requestJson<SubmissionDetail>(`/api/v1/learning/submissions/${submissionId}`)
      .then((loaded) => {
        if (token !== loadToken.current) {
          return;
        }
        setDetail(loaded);
        setMarks(loaded.submission.item_scores);
        setFeedback(loaded.submission.feedback ?? '');
        setLevel(loaded.submission.level ?? '');
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
    requestJson<{ school: Array<{ id: string; content: string }>; own: Array<{ id: string; content: string }> }>(
      `${base(activityId)}/comment-bank`,
    )
      .then((loaded) => setBank([...loaded.own, ...loaded.school]))
      .catch(() => setBank([]));
  }, [submissionId, activityId]);
  useEffect(load, [load]);
  const openFile = async (fileId: string) => {
    const response = await fetchWithSession(`/api/v1/learning/submission-files/${fileId}`);
    if (response.ok) {
      window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
    }
  };
  const save = async () => {
    try {
      await requestJson(
        `/api/v1/learning/submissions/${submissionId}/grade`,
        post({
          item_scores: marks,
          feedback,
          feedback_ai_assisted: aiAssisted,
          ...(detail?.grading === 'level' ? { level: level || null } : {}),
        }),
      );
      setMessage({ tone: 'success', text: 'Đã lưu điểm và nhận xét' });
      load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  const suggest = async () => {
    try {
      const draft = await requestJson<{ comment: string; notice: string }>(
        `/api/v1/learning/submissions/${submissionId}/ai-feedback`,
        post({ note }),
      );
      setFeedback(draft.comment);
      setAiAssisted(true);
      setMessage({ tone: 'success', text: draft.notice });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  if (!detail) {
    return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  }
  return (
    <section aria-label="Chấm bài" className="flex flex-col gap-3">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại danh sách bài nộp
        </Button>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <p className="text-label text-text-secondary">
        {detail.members.map((member) => member.full_name).join(', ')}
        {detail.submission.late ? ' · Nộp muộn' : ''}
        {detail.submission.score !== null ? ` · Điểm ${detail.submission.score}` : ''}
      </p>
      {detail.items.map((item, index) => {
        const answer = detail.answers[item.id];
        const automatic = item.kind === 'question';
        return (
          <div key={item.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-label">
            <span className="font-semibold">
              Câu {index + 1} ({item.score} điểm): {item.snapshot?.content ?? item.prompt}
            </span>
            {automatic ? (
              <span>
                Chọn: {(answer?.choices ?? []).join(', ') || 'không trả lời'} · Đáp án:{' '}
                {item.snapshot?.answer.join(', ')} · {detail.objective.earned[item.id] ?? 0} điểm
              </span>
            ) : null}
            {answer?.text ? <p className="whitespace-pre-wrap text-body">{answer.text}</p> : null}
            {detail.files
              .filter((file) => file.item_id === item.id)
              .map((file) => (
                <Button key={file.id} variant="text" onClick={() => void openFile(file.id)}>
                  Xem {file.file_name}
                </Button>
              ))}
            {!automatic && item.kind !== 'resource' && item.score > 0 ? (
              <label className="flex items-center gap-2">
                Điểm câu {index + 1}
                <input
                  type="number"
                  min={0}
                  max={item.score}
                  step={0.25}
                  className={`w-24 ${FORM_CONTROL_CLASS}`}
                  value={marks[item.id] ?? ''}
                  onChange={(event) => setMarks({ ...marks, [item.id]: Number(event.target.value) })}
                />
              </label>
            ) : null}
          </div>
        );
      })}
      {detail.grading === 'level' ? (
        <label className="text-label font-medium text-text">
          Mức
          <select
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">Chưa chọn</option>
            {LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-label font-medium text-text">
        Nhận xét
        <textarea
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          rows={3}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />
      </label>
      {bank.length > 0 ? (
        <div className="flex flex-wrap gap-1" aria-label="Ngân hàng nhận xét">
          {bank.slice(0, 12).map((comment) => (
            <Button
              key={comment.id}
              variant="secondary"
              onClick={() => setFeedback(feedback ? `${feedback} ${comment.content}` : comment.content)}
            >
              {comment.content}
            </Button>
          ))}
        </div>
      ) : null}
      <label className="text-label font-medium text-text">
        Ghi chú ngắn cho trợ lý AI (không ghi tên học sinh)
        <input
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <p className="text-label text-text-secondary">
        Trợ lý AI chỉ nhận đề bài, điểm bạn đã chấm và ghi chú; không nhận bài làm, ảnh, ghi âm của học sinh.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void suggest()}>
          Gợi ý nhận xét (AI)
        </Button>
        <Button variant="primary" onClick={() => void save()}>
          Lưu điểm, nhận xét
        </Button>
      </div>
      {detail.comments.length > 0 ? (
        <ul className="flex flex-col gap-1 text-label" aria-label="Trao đổi trên bài">
          {detail.comments.map((comment) => (
            <li key={comment.id}>
              <strong>{comment.author_name}:</strong> {comment.body}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function AssignmentScreen({ activityId, onBack }: { activityId: string; onBack(): void }) {
  const [editor, setEditor] = useState<Editor>();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [openId, setOpenId] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestJson<Editor>(base(activityId))
      .then((loaded) => {
        setEditor(loaded);
        if (loaded.assignment?.released) {
          requestJson<{ rows: SubmissionRow[] }>(`${base(activityId)}/submissions`)
            .then((list) => setRows(list.rows))
            .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
        }
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [activityId]);
  useEffect(load, [load]);
  // Thông báo khi xong: chữ cố định, hoặc hàm đọc kết quả của thao tác (số bài đã trả)
  const run = async <T,>(action: () => Promise<T>, done: string | ((result: T) => string)) => {
    try {
      const result = await action();
      setMessage({ tone: 'success', text: typeof done === 'string' ? done : done(result) });
      load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  if (openId) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <SubmissionView
          submissionId={openId}
          activityId={activityId}
          onBack={() => {
            setOpenId(undefined);
            load();
          }}
        />
      </main>
    );
  }
  const released = editor?.assignment?.released ?? false;
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {editor ? (
        <>
          <h1 className="text-page-title font-bold text-text">{editor.activity.title}</h1>
          {!released ? (
            <>
              <Composer
                activityId={activityId}
                editor={editor}
                onSaved={() => {
                  setMessage({ tone: 'success', text: 'Đã lưu bài tập' });
                  load();
                }}
              />
              {editor.assignment?.context === 'homework' ? (
                <HomeworkReleasePanel
                  activityId={activityId}
                  onReleased={(text) => {
                    setMessage({ tone: 'success', text });
                    load();
                  }}
                />
              ) : editor.assignment ? (
                <Button
                  variant="primary"
                  onClick={() =>
                    void run(() => requestJson(`${base(activityId)}/release`, post({})), 'Đã giao bài cho học sinh')
                  }
                >
                  Giao bài cho học sinh
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-label text-text-secondary">
                Đã giao cho {editor.recipient_count} học sinh
                {editor.assignment?.closed_at ? ' · Đã đóng bài' : ''}
              </p>
              {editor.assignment?.context === 'homework' ? (
                <HomeworkAbsences
                  activityId={activityId}
                  dueAt={editor.activity.due_at}
                  onChanged={(text) => {
                    setMessage({ tone: 'success', text });
                    load();
                  }}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() =>
                    void run(
                      () => requestJson<{ returned: number }>(`${base(activityId)}/return`, post({})),
                      (result) => `Đã trả ${result.returned} bài`,
                    )
                  }
                >
                  Trả các bài đã chấm
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void run(
                      () => requestJson(`${base(activityId)}/close`, post({ closed: !editor.assignment?.closed_at })),
                      editor.assignment?.closed_at ? 'Đã mở lại bài' : 'Đã đóng bài',
                    )
                  }
                >
                  {editor.assignment?.closed_at ? 'Mở lại bài' : 'Đóng bài'}
                </Button>
              </div>
              <ul className="flex flex-col gap-2" aria-label="Bài nộp">
                {rows.map((row) => {
                  const name = row.full_name ?? row.name ?? '';
                  const latest = row.latest;
                  return (
                    <li
                      key={row.child_id ?? row.group_id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      <span className="flex-1 text-content">{name}</span>
                      {row.excused ? <StatusBadge tone="info" label="Được miễn" /> : null}
                      {latest ? (
                        <StatusBadge
                          tone={latest.status === 'returned' ? 'success' : 'warning'}
                          label={`${latest.status === 'returned' ? 'Đã trả' : 'Đã nộp'}${latest.late ? ', muộn' : ''}${
                            latest.score !== null ? ` · ${latest.score}` : ''
                          }`}
                        />
                      ) : (
                        <StatusBadge tone="neutral" label={row.has_draft ? 'Đang làm' : 'Chưa nộp'} />
                      )}
                      {latest ? (
                        <Button variant="text" aria-label={`Chấm bài của ${name}`} onClick={() => setOpenId(latest.id)}>
                          Chấm
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
