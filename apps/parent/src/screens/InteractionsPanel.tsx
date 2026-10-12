import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-09 Trao đổi với nhà trường, MP-10 Góp ý, MP-19 Mất đồ (P15-01, P15-02, P02-11; BR-70, BR-72, BR-75; YCTD-79):
// phụ huynh nhắn giáo viên chủ nhiệm của lớp con, gửi góp ý (có thể ẩn danh), báo mất đồ của con và theo dõi kết quả.
// Không làm thời gian thực; bấm Tải lại để thấy tin mới
interface Child {
  id: string;
  full_name: string;
}

interface Thread {
  id: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_side: 'guardian' | 'staff';
  sender_name: string;
  content: string;
  sent_at: string;
}

interface Feedback {
  id: string;
  content: string;
  status: 'received' | 'in_progress' | 'resolved';
  handling_note: string | null;
}

interface LostItem {
  id: string;
  code: string;
  description: string;
  noticed_on: string;
  status: 'reported' | 'found' | 'returned' | 'not_found' | 'cancelled';
  found_note: string | null;
  result_note: string | null;
}

const LOST_STATUS = {
  reported: 'Đã báo',
  found: 'Đã tìm thấy',
  returned: 'Đã trả',
  not_found: 'Không tìm thấy',
  cancelled: 'Đã hủy',
};
const FEEDBACK_STATUS = { received: 'Đã gửi', in_progress: 'Đang xử lý', resolved: 'Đã xử lý' };
const CATEGORIES = [
  ['teaching', 'Dạy học'],
  ['care', 'Chăm sóc'],
  ['meal', 'Bữa ăn'],
  ['facility', 'Cơ sở vật chất'],
  ['fee', 'Học phí'],
  ['other', 'Khác'],
] as const;
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const send = <Result,>(path: string, body?: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export function InteractionsPanel({ child }: { child: Child }) {
  const [thread, setThread] = useState<Thread>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [items, setItems] = useState<LostItem[]>([]);
  const [content, setContent] = useState('');
  const [feedback, setFeedback] = useState('');
  const [category, setCategory] = useState('other');
  const [anonymous, setAnonymous] = useState(false);
  const [lostDescription, setLostDescription] = useState('');
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const [threads, feedbackRows, itemRows] = await Promise.all([
        requestJson<Thread[]>(`/api/v1/message-threads?child_id=${child.id}`),
        requestJson<Array<Feedback & { child_id: string | null }>>('/api/v1/feedbacks'),
        requestJson<LostItem[]>(`/api/v1/lost-items?child_id=${child.id}`),
      ]);
      const mine = threads[0];
      const threadMessages = mine
        ? (await requestJson<{ messages: Message[] }>(`/api/v1/message-threads/${mine.id}/messages`)).messages
        : [];
      if (mine?.unread_count) {
        await send(`/api/v1/message-threads/${mine.id}/read`, {});
      }
      if (request !== latestRequest.current) {
        return;
      }
      setThread(mine);
      setMessages(threadMessages);
      setFeedbacks(feedbackRows.filter((row) => row.child_id === child.id));
      setItems(itemRows);
    } catch (error) {
      setNotice({ text: messageOf(error), failed: true });
    }
  }, [child.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      setNotice({ text: success, failed: false });
      await load();
    } catch (error) {
      setNotice({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" aria-label={`Trao đổi về ${child.full_name}`}>
      {notice ? <Alert tone={notice.failed ? 'danger' : 'success'}>{notice.text}</Alert> : null}
      <section className="flex flex-col gap-2" aria-label="Nhắn giáo viên">
        <div className="flex items-center justify-between">
          <h3 className="text-content font-semibold">Nhắn giáo viên</h3>
          <Button variant="text" onClick={() => void load()}>
            Tải lại
          </Button>
        </div>
        <ul className="flex flex-col gap-1 text-content">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-lg p-2 ${message.sender_side === 'guardian' ? 'bg-selected' : 'bg-page'}`}
            >
              <span className="font-medium">{message.sender_side === 'guardian' ? 'Tôi' : message.sender_name}</span>:{' '}
              {message.content}
            </li>
          ))}
        </ul>
        <TextField
          label="Tin nhắn cho giáo viên"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <Button
          variant="primary"
          disabled={busy || content.trim() === ''}
          onClick={() =>
            void run(async () => {
              if (thread) {
                await send(`/api/v1/message-threads/${thread.id}/messages`, { content });
              } else {
                await send('/api/v1/message-threads', { child_id: child.id, content });
              }
              setContent('');
            }, 'Đã gửi tin cho giáo viên')
          }
        >
          Gửi tin nhắn
        </Button>
      </section>

      <section className="flex flex-col gap-2" aria-label="Báo mất đồ">
        <h3 className="text-content font-semibold">Báo mất đồ</h3>
        <ul className="flex flex-col gap-1 text-content">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {item.code}: {item.description} · {LOST_STATUS[item.status]}
                {(item.result_note ?? item.found_note) ? ` (${item.result_note ?? item.found_note})` : ''}
              </span>
              {item.status === 'reported' ? (
                <Button
                  variant="text"
                  disabled={busy}
                  onClick={() =>
                    void run(() => send(`/api/v1/lost-items/${item.id}`, undefined, 'DELETE'), 'Đã hủy phiếu')
                  }
                >
                  Hủy phiếu
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <TextField
          label="Mô tả đồ bị mất"
          value={lostDescription}
          onChange={(event) => setLostDescription(event.target.value)}
        />
        <Button
          disabled={busy || lostDescription.trim() === ''}
          onClick={() =>
            void run(async () => {
              await send('/api/v1/lost-items', { child_id: child.id, description: lostDescription });
              setLostDescription('');
            }, 'Đã báo mất đồ, giáo viên chủ nhiệm đã nhận thông báo')
          }
        >
          Báo mất đồ
        </Button>
      </section>

      <section className="flex flex-col gap-2" aria-label="Góp ý">
        <h3 className="text-content font-semibold">Góp ý</h3>
        <ul className="flex flex-col gap-1 text-content">
          {feedbacks.map((row) => (
            <li key={row.id}>
              {row.content} · {FEEDBACK_STATUS[row.status]}
              {row.handling_note ? `: ${row.handling_note}` : ''}
            </li>
          ))}
        </ul>
        <label className="text-label font-medium">
          Chủ đề
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
            {CATEGORIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Nội dung góp ý" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
        <label className="flex items-center gap-2 text-label">
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
          Gửi ẩn danh
        </label>
        <Button
          disabled={busy || feedback.trim() === ''}
          onClick={() =>
            void run(async () => {
              await send('/api/v1/feedbacks', {
                child_id: child.id,
                category,
                content: feedback,
                privacy_level: anonymous ? 'anonymous' : 'named',
              });
              setFeedback('');
            }, 'Đã gửi góp ý')
          }
        >
          Gửi góp ý
        </Button>
      </section>
    </div>
  );
}
