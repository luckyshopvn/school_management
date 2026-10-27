import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Bài tập của con (DT-28 phần 28f, YCTD-276): bài về nhà đã giao theo ngày đến hạn, trạng thái, kết quả và nhận xét khi thầy cô đã
// trả; "Đã xem cùng con"; nộp thay khi con chưa có tài khoản học (chụp vở, ghi âm, gõ ngắn), bài ghi người nộp là phụ huynh; trao đổi
// với thầy cô trên bài đã nộp
interface HomeworkItem {
  activity_id: string;
  title: string;
  instructions: string | null;
  subject_name: string | null;
  due_at: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  status: 'excused' | 'returned' | 'submitted' | 'overdue' | 'pending';
  late: boolean;
  submitted_by_kind: 'student' | 'guardian' | 'teacher' | null;
  submission_id: string | null;
  score: number | null;
  level: string | null;
  feedback: string | null;
  feedback_ai_assisted: boolean;
  acknowledged_by_me: boolean;
  can_proxy: boolean;
}

interface ProxyView {
  can_proxy: boolean;
  proxy_blocked_reason: string | null;
  items: Array<{ id: string; kind: 'question' | 'essay' | 'upload' | 'audio' | 'resource'; prompt: string | null }>;
  draft: { files: Array<{ id: string; item_id: string; file_name: string }> } | null;
}

const STATUS: Record<
  HomeworkItem['status'],
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }
> = {
  excused: { label: 'Được miễn', tone: 'info' },
  returned: { label: 'Thầy cô đã trả bài', tone: 'success' },
  submitted: { label: 'Đã nộp, chờ chấm', tone: 'warning' },
  overdue: { label: 'Quá hạn, chưa nộp', tone: 'danger' },
  pending: { label: 'Chưa nộp', tone: 'neutral' },
};
const LEVEL_LABELS: Record<string, string> = {
  excellent: 'Hoàn thành tốt',
  completed: 'Hoàn thành',
  not_completed: 'Chưa hoàn thành',
};
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const dayLabel = (date: string | null) =>
  date
    ? new Date(`${date}T00:00:00+07:00`).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
      })
    : 'Chưa đặt hạn';

function ProxySubmit({
  childId,
  item,
  onDone,
}: {
  childId: string;
  item: HomeworkItem;
  onDone(message: string): void;
}) {
  const base = `/api/v1/learning/children/${childId}/homework/${item.activity_id}`;
  const [view, setView] = useState<ProxyView>();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(() => {
    requestJson<ProxyView>(base)
      .then(setView)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [base]);
  useEffect(load, [load]);
  const upload = async (itemId: string, file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    try {
      await requestJson(`${base}/items/${itemId}/files`, { method: 'POST', body: form });
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const submit = async () => {
    setErrorMessage(undefined);
    try {
      await requestJson(
        `${base}/submit`,
        post({
          answers: Object.fromEntries(
            Object.entries(texts)
              .filter(([, text]) => text.trim() !== '')
              .map(([itemId, text]) => [itemId, { text }]),
          ),
        }),
      );
      onDone(`Đã nộp thay bài ${item.title}`);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  if (!view) {
    return errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null;
  }
  if (!view.can_proxy) {
    return <Alert tone="info">{view.proxy_blocked_reason}</Alert>;
  }
  return (
    <div role="group" className="flex flex-col gap-2" aria-label={`Nộp thay ${item.title}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {view.items
        .filter((entry) => entry.kind !== 'resource')
        .map((entry) => (
          <div key={entry.id} className="flex flex-col gap-1">
            <span className="text-label font-medium text-text">
              {entry.prompt ?? 'Câu trắc nghiệm (con làm trên lớp)'}
            </span>
            {entry.kind === 'essay' ? (
              <textarea
                aria-label={`Trả lời: ${entry.prompt ?? ''}`}
                className={FORM_CONTROL_CLASS}
                value={texts[entry.id] ?? ''}
                onChange={(event) => setTexts({ ...texts, [entry.id]: event.target.value })}
              />
            ) : null}
            {entry.kind === 'upload' || entry.kind === 'audio' ? (
              <input
                type="file"
                aria-label={entry.kind === 'audio' ? `Ghi âm: ${entry.prompt ?? ''}` : `Chụp vở: ${entry.prompt ?? ''}`}
                accept={entry.kind === 'audio' ? 'audio/*' : 'image/*,application/pdf'}
                capture={entry.kind === 'audio' ? undefined : 'environment'}
                onChange={(event) => void upload(entry.id, event.target.files?.[0])}
              />
            ) : null}
            {(view.draft?.files ?? [])
              .filter((file) => file.item_id === entry.id)
              .map((file) => (
                <span key={file.id} className="text-label text-text-secondary">
                  Đã tải: {file.file_name}
                </span>
              ))}
          </div>
        ))}
      <div>
        <Button variant="primary" onClick={() => void submit()}>
          Nộp thay con
        </Button>
      </div>
    </div>
  );
}

function CommentBox({ childId, item, onDone }: { childId: string; item: HomeworkItem; onDone(message: string): void }) {
  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const send = async () => {
    try {
      await requestJson(
        `/api/v1/learning/children/${childId}/homework/${item.activity_id}/submissions/${item.submission_id ?? ''}/comments`,
        post({ body: text }),
      );
      setText('');
      onDone('Đã gửi lời trao đổi tới thầy cô');
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <div className="flex flex-col gap-1">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <textarea
        aria-label={`Trao đổi về ${item.title}`}
        className={FORM_CONTROL_CLASS}
        value={text}
        placeholder="Trao đổi với thầy cô về bài này"
        onChange={(event) => setText(event.target.value)}
      />
      <div>
        <Button variant="text" disabled={!text.trim()} onClick={() => void send()}>
          Gửi trao đổi
        </Button>
      </div>
    </div>
  );
}

export function ChildHomeworkPanel({ child }: { child: { id: string; full_name: string } }) {
  const [items, setItems] = useState<HomeworkItem[]>();
  const [proxyId, setProxyId] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestJson<{ items: HomeworkItem[] }>(`/api/v1/learning/children/${child.id}/homework`)
      .then((result) => setItems(result.items))
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [child.id]);
  useEffect(load, [load]);
  const done = (text: string) => {
    setMessage({ tone: 'success', text });
    setProxyId(undefined);
    load();
  };
  const acknowledge = async (item: HomeworkItem) => {
    try {
      await requestJson(`/api/v1/learning/children/${child.id}/homework/${item.activity_id}/acknowledge`, post({}));
      done(`Đã ghi nhận xem cùng con bài ${item.title}`);
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  if (!items || items.length === 0) {
    return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  }
  const days = [...new Set(items.map((item) => item.due_date))];
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3" aria-label="Bài tập của con">
      <h2 className="text-section-title font-semibold text-text">Bài tập về nhà của {child.full_name}</h2>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {days.map((day) => (
        <div key={day ?? 'none'} className="flex flex-col gap-2">
          <span className="text-label font-medium text-text-secondary">Hạn {dayLabel(day)}</span>
          <ul className="flex flex-col gap-2">
            {items
              .filter((item) => item.due_date === day)
              .map((item) => (
                <li
                  key={item.activity_id}
                  className="flex flex-col gap-1 rounded border border-border p-2 text-content"
                  aria-label={`Bài về nhà ${item.title}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-medium">
                      {item.subject_name ? `${item.subject_name}: ` : ''}
                      {item.title}
                    </span>
                    <StatusBadge tone={STATUS[item.status].tone} label={STATUS[item.status].label} />
                  </div>
                  <span className="text-label text-text-secondary">
                    {item.due_at ? `Hạn ${new Date(item.due_at).toLocaleString('vi-VN')}` : ''}
                    {item.estimated_minutes ? ` · khoảng ${item.estimated_minutes} phút` : ''}
                    {item.late ? ' · nộp muộn' : ''}
                    {item.submitted_by_kind === 'guardian' ? ' · phụ huynh nộp thay' : ''}
                  </span>
                  {item.instructions ? <p className="text-label text-text">{item.instructions}</p> : null}
                  {item.status === 'returned' ? (
                    <p className="text-label text-text">
                      {item.score !== null ? `Điểm ${item.score}` : ''}
                      {item.level ? ` · ${LEVEL_LABELS[item.level] ?? item.level}` : ''}
                      {item.feedback
                        ? ` · nhận xét: ${item.feedback}${item.feedback_ai_assisted ? ' (có trợ lý AI hỗ trợ)' : ''}`
                        : ''}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {item.acknowledged_by_me ? (
                      <span className="text-label text-text-secondary">Đã xem cùng con</span>
                    ) : (
                      <Button variant="secondary" onClick={() => void acknowledge(item)}>
                        Đã xem cùng con
                      </Button>
                    )}
                    {item.can_proxy && proxyId !== item.activity_id ? (
                      <Button variant="text" onClick={() => setProxyId(item.activity_id)}>
                        Nộp thay
                      </Button>
                    ) : null}
                  </div>
                  {proxyId === item.activity_id ? <ProxySubmit childId={child.id} item={item} onDone={done} /> : null}
                  {item.submission_id ? <CommentBox childId={child.id} item={item} onDone={done} /> : null}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
