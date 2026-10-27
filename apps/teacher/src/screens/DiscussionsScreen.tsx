import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Thông báo lớp, diễn đàn, hỏi đáp của một lớp học trực tuyến ở ứng dụng giáo viên (DT-28 phần 28e, YCTD-275): đăng thông báo (học
// sinh và phụ huynh nhận qua thông báo), mở chủ đề, cho học sinh mở chủ đề, hàng chờ câu hỏi chưa trả lời (quá 48 giờ là quá hạn),
// trả lời, xác nhận câu trả lời đúng, khoá chủ đề, ẩn nội dung (vẫn lưu). Giáo viên luôn thấy mọi nội dung, kể cả đã ẩn và câu hỏi
// riêng
type Kind = 'announcement' | 'forum' | 'question';

interface Thread {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  private: boolean;
  status: 'open' | 'locked';
  accepted_post_id: string | null;
  author_name: string;
  hidden: boolean;
  overdue?: boolean;
}

interface Post {
  id: string;
  body: string;
  author_name: string;
  author_kind: string;
  hidden: boolean;
}

const KIND_LABELS: Record<Kind, string> = { announcement: 'Thông báo lớp', forum: 'Diễn đàn', question: 'Hỏi đáp' };
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

function ThreadDetail({ threadId, onBack }: { threadId: string; onBack(): void }) {
  const [data, setData] = useState<{ thread: Thread; posts: Post[] }>();
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestJson<{ thread: Thread; posts: Post[] }>(`/api/v1/learning/threads/${threadId}`)
      .then(setData)
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [threadId]);
  useEffect(load, [load]);
  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setMessage({ tone: 'success', text: done });
      load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  if (!data) return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  const base = `/api/v1/learning/threads/${threadId}`;
  return (
    <section aria-label={`Chủ đề ${data.thread.title}`} className="flex flex-col gap-2">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại danh sách
        </Button>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <h2 className="text-section-title font-semibold text-text">{data.thread.title}</h2>
      <p className="text-label text-text-secondary">
        {data.thread.author_name}
        {data.thread.private ? ' · Câu hỏi riêng' : ''}
        {data.thread.hidden ? ' · Đã ẩn với học sinh' : ''}
      </p>
      <p className="whitespace-pre-wrap text-content text-text">{data.thread.body}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            void run(
              () => requestJson(`${base}/lock`, post({ locked: data.thread.status !== 'locked' })),
              data.thread.status === 'locked' ? 'Đã mở lại chủ đề' : 'Đã khoá chủ đề',
            )
          }
        >
          {data.thread.status === 'locked' ? 'Mở lại chủ đề' : 'Khoá chủ đề'}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void run(
              () => requestJson(`${base}/hide`, post({ hidden: !data.thread.hidden })),
              data.thread.hidden ? 'Đã hiện lại' : 'Đã ẩn chủ đề',
            )
          }
        >
          {data.thread.hidden ? 'Hiện lại chủ đề' : 'Ẩn chủ đề'}
        </Button>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Các trả lời">
        {data.posts.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-2 text-label">
            <span className="flex items-center gap-2 font-semibold">
              {item.author_name}
              {item.hidden ? <StatusBadge tone="neutral" label="Đã ẩn" /> : null}
              {data.thread.accepted_post_id === item.id ? (
                <StatusBadge tone="success" label="Câu trả lời đúng" />
              ) : null}
            </span>
            <p className="whitespace-pre-wrap">{item.body}</p>
            <div className="flex flex-wrap gap-2">
              {data.thread.kind === 'question' && !item.hidden ? (
                <Button
                  variant="text"
                  aria-label={`Xác nhận câu trả lời của ${item.author_name}`}
                  onClick={() =>
                    void run(() => requestJson(`${base}/accept`, post({ post_id: item.id })), 'Đã xác nhận câu trả lời')
                  }
                >
                  Xác nhận đúng
                </Button>
              ) : null}
              <Button
                variant="text"
                aria-label={`${item.hidden ? 'Hiện lại' : 'Ẩn'} trả lời của ${item.author_name}`}
                onClick={() =>
                  void run(
                    () => requestJson(`${base}/hide`, post({ post_id: item.id, hidden: !item.hidden })),
                    item.hidden ? 'Đã hiện lại' : 'Đã ẩn trả lời',
                  )
                }
              >
                {item.hidden ? 'Hiện lại' : 'Ẩn'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {data.thread.kind !== 'announcement' ? (
        <>
          <label className="text-label font-medium text-text">
            Trả lời
            <textarea
              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
              rows={3}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          </label>
          <div>
            <Button
              variant="primary"
              disabled={!reply.trim()}
              onClick={() =>
                void run(async () => {
                  await requestJson(`${base}/posts`, post({ body: reply }));
                  setReply('');
                }, 'Đã gửi trả lời')
              }
            >
              Gửi trả lời
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function DiscussionsScreen({ spaceId, title, onBack }: { spaceId: string; title: string; onBack(): void }) {
  const [kind, setKind] = useState<Kind>('announcement');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [studentsCanPost, setStudentsCanPost] = useState(false);
  const [pending, setPending] = useState<Thread[]>([]);
  const [openId, setOpenId] = useState<string>();
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestJson<{ threads: Thread[]; students_can_post_topics: boolean }>(
      `/api/v1/learning/spaces/${spaceId}/threads?kind=${kind}`,
    )
      .then((loaded) => {
        setThreads(loaded.threads);
        setStudentsCanPost(loaded.students_can_post_topics);
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
    requestJson<Thread[]>(`/api/v1/learning/spaces/${spaceId}/questions/pending`)
      .then(setPending)
      .catch(() => setPending([]));
  }, [spaceId, kind]);
  useEffect(load, [load]);
  if (openId) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <ThreadDetail
          threadId={openId}
          onBack={() => {
            setOpenId(undefined);
            load();
          }}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      <h1 className="text-page-title font-bold text-text">Thảo luận: {title}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {pending.length > 0 ? (
        <section aria-label="Câu hỏi chờ trả lời" className="flex flex-col gap-1 rounded-lg border border-border p-3">
          <h2 className="text-section-title font-semibold text-text">Câu hỏi chờ trả lời ({pending.length})</h2>
          {pending.map((thread) => (
            <Button key={thread.id} variant="text" onClick={() => setOpenId(thread.id)}>
              {thread.title}
              {thread.overdue ? ' · quá hạn' : ''}
            </Button>
          ))}
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại thảo luận">
        {(Object.keys(KIND_LABELS) as Kind[]).map((key) => (
          <Button
            key={key}
            role="tab"
            aria-selected={kind === key}
            variant={kind === key ? 'primary' : 'secondary'}
            onClick={() => setKind(key)}
          >
            {KIND_LABELS[key]}
          </Button>
        ))}
      </div>
      {kind === 'forum' ? (
        <label className="flex items-center gap-2 text-label text-text">
          <input
            type="checkbox"
            checked={studentsCanPost}
            onChange={(event) =>
              void requestJson(`/api/v1/learning/spaces/${spaceId}/discussion-settings`, {
                method: 'PUT',
                body: JSON.stringify({ students_can_post_topics: event.target.checked }),
              })
                .then(load)
                .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }))
            }
          />
          Cho học sinh mở chủ đề
        </label>
      ) : null}
      <ul className="flex flex-col gap-2">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => setOpenId(thread.id)}
              className="flex w-full flex-col rounded-lg border border-border bg-card p-3 text-left"
            >
              <span className="text-content font-semibold">{thread.title}</span>
              <span className="text-label text-text-secondary">
                {thread.author_name}
                {thread.private ? ' · riêng' : ''}
                {thread.hidden ? ' · đã ẩn' : ''}
                {thread.status === 'locked' ? ' · đã khoá' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form
        aria-label={kind === 'announcement' ? 'Đăng thông báo lớp' : 'Mở chủ đề mới'}
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            try {
              await requestJson(
                `/api/v1/learning/spaces/${spaceId}/threads`,
                post({ kind, title: newTitle, body: newBody }),
              );
              setNewTitle('');
              setNewBody('');
              setMessage({ tone: 'success', text: kind === 'announcement' ? 'Đã đăng thông báo lớp' : 'Đã mở chủ đề' });
              load();
            } catch (error) {
              setMessage({ tone: 'danger', text: messageOf(error) });
            }
          })();
        }}
      >
        <label className="text-label font-medium text-text">
          Tiêu đề
          <input
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Nội dung
          <textarea
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            rows={3}
            value={newBody}
            onChange={(event) => setNewBody(event.target.value)}
          />
        </label>
        <div>
          <Button type="submit" variant="primary" disabled={!newTitle.trim() || !newBody.trim()}>
            {kind === 'announcement' ? 'Đăng thông báo' : 'Mở chủ đề'}
          </Button>
        </div>
      </form>
    </main>
  );
}
