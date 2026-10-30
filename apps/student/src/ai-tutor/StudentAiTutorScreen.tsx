import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import {
  readTutorOverview,
  readTutorThread,
  reportTutorMessage,
  sendTutorMessage,
  tutorErrorMessage,
  type TutorMessage,
  type TutorOverview,
  type TutorThread,
} from './ai-tutor-api.js';
import { TurnMeter } from './TurnMeter.js';
import { TutorMarkdown } from './TutorMarkdown.js';

// Trang trò chuyện với gia sư AI (YCTD-383 lát L2, MH-597): chọn môn, hỏi, nhận gợi ý từng bước, thanh số lượt còn lại, "Xem lời giải đầy
// đủ" (mở sau hai lượt tự làm), "Báo câu trả lời sai", danh sách hội thoại cũ. Máy chủ quyết định lượt, kiểm duyệt, khóa
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(iso),
  );

const SOLUTION_ATTEMPTS = 2;

function MessageBubble({
  message,
  onReport,
  canReport,
}: {
  message: TutorMessage;
  onReport(message: TutorMessage): void;
  canReport: boolean;
}) {
  if (message.role === 'student') {
    return (
      <li className="flex max-w-[88%] flex-col gap-1 self-end rounded-xl rounded-br-sm bg-brand px-3 py-2 text-label text-white">
        <span className="sr-only">Em hỏi:</span>
        <span className="whitespace-pre-wrap break-words">{message.body}</span>
      </li>
    );
  }
  return (
    <li className="flex max-w-[88%] flex-col gap-1 self-start rounded-xl rounded-bl-sm border border-border bg-page px-3 py-2 text-label text-text">
      <span className="sr-only">Gia sư trả lời:</span>
      {message.step_label ? (
        <span className="text-label font-semibold text-brand-strong">{message.step_label}</span>
      ) : null}
      <TutorMarkdown text={message.body} />
      {message.step !== 'safety' ? (
        message.reported ? (
          <span className="text-label text-text-secondary">Em đã báo câu trả lời này sai</span>
        ) : canReport ? (
          <div>
            <Button variant="text" className="px-0 py-1" onClick={() => onReport(message)}>
              Báo câu trả lời sai
            </Button>
          </div>
        ) : null
      ) : null}
    </li>
  );
}

export default function StudentAiTutorScreen({ onClose }: { onClose(): void }) {
  const [overview, setOverview] = useState<TutorOverview | null>(null);
  const [thread, setThread] = useState<TutorThread | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  const loadOverview = useCallback(async () => {
    try {
      const next = await readTutorOverview();
      setOverview(next);
      setSubjectCode((current) => current || next.subjects[0]?.code || '');
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [thread?.messages.length]);

  async function openConversation(id: string) {
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      setThread(await readTutorThread(id));
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    }
  }

  function startNew() {
    setThread(null);
    setText('');
    setErrorMessage(undefined);
    setNotice(undefined);
  }

  async function send(mode: 'hint' | 'solution') {
    if (sending) {
      return;
    }
    setSending(true);
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      const result = await sendTutorMessage(
        mode === 'solution'
          ? { conversation_id: thread?.conversation.id, mode }
          : thread
            ? { conversation_id: thread.conversation.id, text, mode }
            : { subject_code: subjectCode, text, mode },
      );
      setThread((current) => ({
        conversation: result.conversation,
        messages: [
          ...(current?.conversation.id === result.conversation.id ? current.messages : []),
          ...result.messages,
        ],
        attempts: result.attempts,
        solution_unlocked: result.solution_unlocked,
      }));
      setText('');
      if (result.turn === 'released') {
        setNotice('Câu này không tính lượt hỏi.');
      }
      setOverview((current) =>
        current
          ? {
              ...current,
              balance: result.balance,
              conversations: [
                result.conversation,
                ...current.conversations.filter((item) => item.id !== result.conversation.id),
              ],
            }
          : current,
      );
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function report(message: TutorMessage) {
    try {
      await reportTutorMessage(message.id);
      setThread((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) => (item.id === message.id ? { ...item, reported: true } : item)),
            }
          : current,
      );
      setNotice('Cảm ơn em đã báo. Nhà trường sẽ xem lại câu trả lời này.');
    } catch (error) {
      setErrorMessage(tutorErrorMessage(error));
    }
  }

  const locked = overview && !overview.access.allowed ? overview.access.message : null;
  const canAsk =
    overview !== null &&
    overview.subscribed &&
    overview.ready &&
    !locked &&
    overview.balance.remaining > 0 &&
    (thread !== null || subjectCode !== '');
  const remainingAttempts = Math.max(0, SOLUTION_ATTEMPTS - (thread?.attempts ?? 0));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-page-title font-bold text-text">Gia sư AI</h1>
        <Button onClick={onClose}>Về trang chủ</Button>
      </header>
      {overview?.subscribed ? <TurnMeter balance={overview.balance} /> : null}
      {overview && !overview.subscribed ? (
        <Alert tone="warning">Em chưa có gói. Nhờ cha mẹ đăng ký Gia sư AI trong ứng dụng phụ huynh.</Alert>
      ) : null}
      {overview?.subscribed && overview.unavailable_reason ? (
        <Alert tone="info">{overview.unavailable_reason}</Alert>
      ) : null}
      {locked ? <Alert tone="warning">{locked}</Alert> : null}
      {overview?.subscribed && overview.ready && overview.balance.remaining === 0 ? (
        <Alert tone="warning">
          Em đã dùng hết lượt hỏi. Nhờ cha mẹ mua thêm lượt hoặc gói tháng trong ứng dụng phụ huynh.
        </Alert>
      ) : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      <section aria-label="Hội thoại cũ" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-label font-semibold text-text">Hội thoại cũ</h2>
          {thread ? <Button onClick={startNew}>Hỏi bài mới</Button> : null}
        </div>
        {overview && overview.conversations.length === 0 ? (
          <p className="text-label text-text-secondary">Em chưa có hội thoại nào. Lịch sử giữ 12 tháng.</p>
        ) : (
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {overview?.conversations.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={thread?.conversation.id === item.id ? 'true' : undefined}
                  className={`flex w-full flex-wrap items-baseline gap-x-2 rounded-lg border px-3 py-2 text-left text-label ${
                    thread?.conversation.id === item.id ? 'border-brand bg-selected' : 'border-border bg-card'
                  }`}
                  onClick={() => void openConversation(item.id)}
                >
                  <span className="font-medium text-text">{item.topic ?? 'Chưa có chủ đề'}</span>
                  <span className="text-text-secondary">
                    {item.subject_name} · {formatTime(item.last_message_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label={thread ? `Hội thoại ${thread.conversation.subject_name}` : 'Câu hỏi mới'}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      >
        {thread ? (
          <h2 className="text-label font-semibold text-text">
            {thread.conversation.subject_name}
            {thread.conversation.topic ? `: ${thread.conversation.topic}` : ''}
          </h2>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label font-semibold text-text">Chọn môn</legend>
            <div className="flex flex-wrap gap-2">
              {overview?.subjects.map((subject) => (
                <button
                  key={subject.code}
                  type="button"
                  aria-pressed={subjectCode === subject.code}
                  className={`rounded-full border px-3 py-1 text-label ${
                    subjectCode === subject.code
                      ? 'border-brand bg-brand text-white'
                      : 'border-border-strong bg-card text-text'
                  }`}
                  onClick={() => setSubjectCode(subject.code)}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <ol aria-label="Tin nhắn" className="flex flex-col gap-2">
          {thread?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} onReport={report} canReport={!locked} />
          ))}
        </ol>
        <div ref={endRef} />
        <p aria-live="polite" className="text-label text-text-secondary">
          {sending ? 'Gia sư đang trả lời…' : ''}
        </p>

        {thread ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!thread.solution_unlocked || !canAsk || sending} onClick={() => void send('solution')}>
              Xem lời giải đầy đủ
            </Button>
            {!thread.solution_unlocked ? (
              <span className="text-label text-text-secondary">
                Em tự làm thêm {remainingAttempts} lượt để mở lời giải đầy đủ
              </span>
            ) : null}
          </div>
        ) : null}

        <form
          aria-label="Gửi câu hỏi cho gia sư"
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void send('hint');
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-label text-text">
            {thread ? 'Câu trả lời hoặc câu hỏi tiếp của em' : 'Câu hỏi của em'}
            <textarea
              className={FORM_CONTROL_CLASS}
              rows={3}
              maxLength={2000}
              value={text}
              disabled={!canAsk}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" disabled={!canAsk || sending || text.trim() === ''}>
            Gửi
          </Button>
        </form>
        <p className="text-label text-text-secondary">
          Đừng gửi tên, số điện thoại, địa chỉ hay số định danh: câu có thông tin cá nhân sẽ bị chặn và không tính lượt.
        </p>
      </section>
    </main>
  );
}
