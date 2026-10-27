import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { requestStudentJson, StudentApiError } from './student-api.js';

// Học sinh ở thông báo lớp, diễn đàn, hỏi đáp của lớp học trực tuyến, không gian học nhóm và lịch học tập (DT-28 phần 28e, YCTD-275).
// Không có nhắn riêng giữa hai học sinh; chữ em viết được lọc thông tin liên lạc (số điện thoại, thư điện tử, liên kết, mạng xã hội)
// trước khi lưu; ngoài giờ mở của trường em chỉ đọc; em báo cáo được nội dung không phù hợp
type Kind = 'announcement' | 'forum' | 'question';

interface Thread {
  id: string;
  kind: string;
  title: string;
  body: string;
  private: boolean;
  status: string;
  accepted_post_id: string | null;
  author_name: string;
  created_at: string;
}

interface Post {
  id: string;
  body: string;
  author_name: string;
  author_kind: string;
  author_child_id: string | null;
  created_at: string;
}

const KIND_LABELS: Record<Kind, string> = { announcement: 'Thông báo lớp', forum: 'Diễn đàn', question: 'Hỏi đáp' };
const messageOf = (error: unknown) =>
  error instanceof StudentApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(iso),
  );

function ThreadView({ threadId, onBack }: { threadId: string; onBack(): void }) {
  const [data, setData] = useState<{ thread: Thread; posts: Post[] }>();
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string }>();
  const load = useCallback(() => {
    requestStudentJson<{ thread: Thread; posts: Post[] }>(`/api/v1/student/discussions/threads/${threadId}`)
      .then(setData)
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [threadId]);
  useEffect(load, [load]);
  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setMessage({ tone: 'success', text: done });
      load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  if (!data) return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  return (
    <section
      aria-label={`Chủ đề ${data.thread.title}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
    >
      <Button variant="text" onClick={onBack}>
        Quay lại danh sách
      </Button>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <h3 className="text-body font-semibold text-text">{data.thread.title}</h3>
      <p className="text-label text-text-secondary">
        {data.thread.author_name} · {formatTime(data.thread.created_at)}
        {data.thread.private ? ' · Chỉ em và thầy cô thấy' : ''}
      </p>
      <p className="whitespace-pre-wrap text-body text-text">{data.thread.body}</p>
      <ul className="flex flex-col gap-2" aria-label="Các trả lời">
        {data.posts.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-2 text-label text-text">
            <span className="flex items-center gap-2 font-semibold">
              {item.author_name}
              {item.author_kind === 'teacher' ? <StatusBadge tone="info" label="Thầy cô" /> : null}
              {data.thread.accepted_post_id === item.id ? (
                <StatusBadge tone="success" label="Câu trả lời đúng" />
              ) : null}
            </span>
            <p className="whitespace-pre-wrap">{item.body}</p>
            <Button
              variant="text"
              aria-label={`Báo cáo trả lời của ${item.author_name}`}
              onClick={() =>
                void act(
                  () =>
                    requestStudentJson(
                      `/api/v1/student/discussions/threads/${threadId}/reports`,
                      post({ post_id: item.id, reason: 'Nội dung không phù hợp' }),
                    ),
                  'Đã gửi báo cáo cho nhà trường',
                )
              }
            >
              Báo cáo
            </Button>
          </li>
        ))}
      </ul>
      {data.thread.kind !== 'announcement' && data.thread.status === 'open' ? (
        <>
          <label className="flex flex-col gap-1 text-label text-text">
            Trả lời
            <textarea
              className={FORM_CONTROL_CLASS}
              rows={3}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          </label>
          <p className="text-label text-text-secondary">
            Không ghi số điện thoại, thư điện tử, mạng xã hội: hệ thống sẽ che.
          </p>
          <div>
            <Button
              variant="primary"
              disabled={!reply.trim()}
              onClick={() =>
                void (async () => {
                  try {
                    const saved = await requestStudentJson<{ masked: boolean }>(
                      `/api/v1/student/discussions/threads/${threadId}/posts`,
                      post({ body: reply }),
                    );
                    setReply('');
                    setMessage(
                      saved.masked
                        ? { tone: 'info', text: 'Đã gửi trả lời; thông tin liên lạc trong bài đã được che' }
                        : { tone: 'success', text: 'Đã gửi trả lời' },
                    );
                    load();
                  } catch (error) {
                    setMessage({ tone: 'danger', text: messageOf(error) });
                  }
                })()
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

export function StudentSpaceDiscussions({
  spaceId,
  title,
  onClose,
}: {
  spaceId: string;
  title: string;
  onClose(): void;
}) {
  const [kind, setKind] = useState<Kind>('announcement');
  const [data, setData] = useState<{ threads: Thread[]; can_post_topics: boolean; open_now: boolean }>();
  const [openId, setOpenId] = useState<string>();
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [privateQuestion, setPrivateQuestion] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestStudentJson<{ threads: Thread[]; can_post_topics: boolean; open_now: boolean }>(
      `/api/v1/student/discussions/spaces/${spaceId}?kind=${kind}`,
    )
      .then(setData)
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [spaceId, kind]);
  useEffect(load, [load]);
  if (openId)
    return (
      <ThreadView
        threadId={openId}
        onBack={() => {
          setOpenId(undefined);
          load();
        }}
      />
    );
  const canCreate = kind === 'question' || (kind === 'forum' && data?.can_post_topics);
  return (
    <section
      aria-label={`Thảo luận ${title}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h3 className="text-body font-semibold text-text">Thảo luận: {title}</h3>
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
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {data && !data.open_now ? <Alert tone="info">Ngoài giờ mở thảo luận của trường, em chỉ đọc được.</Alert> : null}
      <ul className="flex flex-col gap-2">
        {(data?.threads ?? []).map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => setOpenId(thread.id)}
              className="flex w-full flex-col rounded-lg border border-border p-3 text-left"
            >
              <span className="text-content font-semibold">{thread.title}</span>
              <span className="text-label text-text-secondary">
                {thread.author_name} · {formatTime(thread.created_at)}
                {thread.accepted_post_id ? ' · Đã có câu trả lời' : ''}
                {thread.private ? ' · Riêng với thầy cô' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {data && data.threads.length === 0 ? <p className="text-label text-text-secondary">Chưa có nội dung.</p> : null}
      {canCreate ? (
        <form
          aria-label={kind === 'question' ? 'Đặt câu hỏi' : 'Mở chủ đề'}
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              try {
                await requestStudentJson(
                  `/api/v1/student/discussions/spaces/${spaceId}/threads`,
                  post({ kind, title: newTitle, body: newBody, private: privateQuestion }),
                );
                setNewTitle('');
                setNewBody('');
                setMessage({ tone: 'success', text: kind === 'question' ? 'Đã gửi câu hỏi' : 'Đã mở chủ đề' });
                load();
              } catch (error) {
                setMessage({ tone: 'danger', text: messageOf(error) });
              }
            })();
          }}
        >
          <label className="flex flex-col gap-1 text-label text-text">
            {kind === 'question' ? 'Câu hỏi' : 'Tên chủ đề'}
            <input
              className={FORM_CONTROL_CLASS}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-label text-text">
            Nội dung
            <textarea
              className={FORM_CONTROL_CLASS}
              rows={3}
              value={newBody}
              onChange={(event) => setNewBody(event.target.value)}
            />
          </label>
          {kind === 'question' ? (
            <label className="flex items-center gap-2 text-label text-text">
              <input
                type="checkbox"
                checked={privateQuestion}
                onChange={(event) => setPrivateQuestion(event.target.checked)}
              />
              Chỉ hỏi riêng thầy cô
            </label>
          ) : null}
          <div>
            <Button type="submit" variant="primary" disabled={!newTitle.trim() || !newBody.trim()}>
              {kind === 'question' ? 'Gửi câu hỏi' : 'Mở chủ đề'}
            </Button>
          </div>
        </form>
      ) : null}
      <Button onClick={onClose}>Đóng</Button>
    </section>
  );
}

interface Workspace {
  group: { id: string; name: string; group_set_name: string };
  open_now: boolean;
  members: Array<{ child_id: string; full_name: string }>;
  threads: Array<Thread & { posts: Post[] }>;
  tasks: Array<{ id: string; title: string; assignee_child_id: string | null; due_on: string | null; status: string }>;
  note: { version: number; content: string; edited_by_name: string } | null;
  files: Array<{ id: string; file_name: string }>;
}

const TASK_LABELS: Record<string, string> = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Xong' };

function GroupWorkspace({ groupId, onBack }: { groupId: string; onBack(): void }) {
  const [data, setData] = useState<Workspace>();
  const [note, setNote] = useState('');
  const [task, setTask] = useState('');
  const [assignee, setAssignee] = useState('');
  const [boardTitle, setBoardTitle] = useState('');
  const [boardBody, setBoardBody] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestStudentJson<Workspace>(`/api/v1/student/groups/${groupId}`)
      .then((loaded) => {
        setData(loaded);
        setNote(loaded.note?.content ?? '');
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [groupId]);
  useEffect(load, [load]);
  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setMessage({ tone: 'success', text: done });
      load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  if (!data) return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  const nameOf = (childId: string | null) =>
    data.members.find((member) => member.child_id === childId)?.full_name ?? 'Chưa giao';
  return (
    <section
      aria-label={`Không gian ${data.group.name}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <Button variant="text" onClick={onBack}>
        Quay lại
      </Button>
      <h3 className="text-body font-semibold text-text">
        {data.group.name} ({data.group.group_set_name})
      </h3>
      <p className="text-label text-text-secondary">
        Thành viên: {data.members.map((member) => member.full_name).join(', ')} · Thầy cô của lớp luôn xem được không
        gian nhóm
      </p>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {!data.open_now ? <Alert tone="info">Ngoài giờ mở của trường, em chỉ đọc được.</Alert> : null}
      <h4 className="text-label font-semibold text-text">Việc của nhóm</h4>
      <ul className="flex flex-col gap-1 text-label" aria-label="Việc của nhóm">
        {data.tasks.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              {item.title} · {nameOf(item.assignee_child_id)}
              {item.due_on ? ` · hạn ${item.due_on}` : ''}
            </span>
            <select
              className={FORM_CONTROL_CLASS}
              aria-label={`Trạng thái ${item.title}`}
              value={item.status}
              onChange={(event) =>
                void act(
                  () =>
                    requestStudentJson(`/api/v1/student/group-tasks/${item.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status: event.target.value }),
                    }),
                  'Đã cập nhật việc',
                )
              }
            >
              {Object.entries(TASK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-label text-text">
          Việc mới
          <input className={FORM_CONTROL_CLASS} value={task} onChange={(event) => setTask(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-label text-text">
          Người làm
          <select className={FORM_CONTROL_CLASS} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Chưa giao</option>
            {data.members.map((member) => (
              <option key={member.child_id} value={member.child_id}>
                {member.full_name}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={!task.trim()}
          onClick={() =>
            void act(async () => {
              await requestStudentJson(
                `/api/v1/student/groups/${groupId}/tasks`,
                post({ title: task, assignee_child_id: assignee || null }),
              );
              setTask('');
            }, 'Đã thêm việc')
          }
        >
          Thêm việc
        </Button>
      </div>
      <label className="flex flex-col gap-1 text-label text-text">
        Ghi chú chung{data.note ? ` (bản ${data.note.version}, ${data.note.edited_by_name} sửa)` : ''}
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div>
        <Button
          variant="secondary"
          onClick={() =>
            void act(
              () =>
                requestStudentJson(`/api/v1/student/groups/${groupId}/note`, {
                  method: 'PUT',
                  body: JSON.stringify({ content: note, version: data.note?.version ?? 0 }),
                }),
              'Đã lưu ghi chú',
            )
          }
        >
          Lưu ghi chú
        </Button>
      </div>
      <h4 className="text-label font-semibold text-text">Tệp chung</h4>
      <ul className="flex flex-col gap-1 text-label">
        {data.files.map((file) => (
          <li key={file.id}>{file.file_name}</li>
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-label text-text">
        Gửi ảnh hoặc tệp PDF cho nhóm
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const form = new FormData();
            form.append('file', file, file.name);
            void act(
              () => requestStudentJson(`/api/v1/student/groups/${groupId}/files`, { method: 'POST', body: form }),
              'Đã gửi tệp',
            );
          }}
        />
      </label>
      <h4 className="text-label font-semibold text-text">Bảng tin của nhóm</h4>
      {data.threads.map((thread) => (
        <div key={thread.id} className="rounded-lg border border-border p-2 text-label">
          <strong>{thread.title}</strong> · {thread.author_name}
          <p className="whitespace-pre-wrap">{thread.body}</p>
          {thread.posts.map((item) => (
            <p key={item.id} className="ml-3">
              <strong>{item.author_name}:</strong> {item.body}
            </p>
          ))}
        </div>
      ))}
      <label className="flex flex-col gap-1 text-label text-text">
        Tiêu đề tin
        <input
          className={FORM_CONTROL_CLASS}
          value={boardTitle}
          onChange={(event) => setBoardTitle(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-label text-text">
        Nội dung tin
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={2}
          value={boardBody}
          onChange={(event) => setBoardBody(event.target.value)}
        />
      </label>
      <div>
        <Button
          disabled={!boardTitle.trim() || !boardBody.trim()}
          onClick={() =>
            void act(async () => {
              await requestStudentJson(
                `/api/v1/student/groups/${groupId}/threads`,
                post({ title: boardTitle, body: boardBody }),
              );
              setBoardTitle('');
              setBoardBody('');
            }, 'Đã đăng tin cho nhóm')
          }
        >
          Đăng tin
        </Button>
      </div>
    </section>
  );
}

export function StudentGroupsPanel() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; group_set_name: string }>>([]);
  const [openId, setOpenId] = useState<string>();
  useEffect(() => {
    requestStudentJson<Array<{ id: string; name: string; group_set_name: string }>>('/api/v1/student/groups')
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);
  if (openId) return <GroupWorkspace groupId={openId} onBack={() => setOpenId(undefined)} />;
  if (groups.length === 0) return null;
  return (
    <section aria-label="Nhóm của em" className="flex flex-col gap-2">
      <h2 className="text-label font-semibold text-text">Nhóm của em</h2>
      {groups.map((group) => (
        <Button key={group.id} variant="secondary" onClick={() => setOpenId(group.id)}>
          {group.name} ({group.group_set_name})
        </Button>
      ))}
    </section>
  );
}

interface CalendarItem {
  date: string;
  kind: 'lesson' | 'due' | 'opens';
  title: string;
  detail: string | null;
  time: string | null;
}

const ITEM_LABELS = { lesson: 'Tiết học', due: 'Hạn nộp', opens: 'Mở hoạt động' };

export function CalendarWeek({ path }: { path: string }) {
  const [from, setFrom] = useState<string>();
  const [data, setData] = useState<{ from: string; items: CalendarItem[] }>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    requestStudentJson<{ from: string; items: CalendarItem[] }>(`${path}${from ? `?from=${from}` : ''}`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [path, from]);
  const shift = (days: number) => {
    if (!data) return;
    setFrom(new Date(new Date(`${data.from}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10));
  };
  return (
    <section aria-label="Lịch học tập" className="flex flex-col gap-2">
      <h2 className="text-label font-semibold text-text">Lịch học tập</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <div className="flex gap-2">
        <Button variant="text" onClick={() => shift(-7)}>
          Tuần trước
        </Button>
        <span className="text-label text-text-secondary">Từ {data?.from}</span>
        <Button variant="text" onClick={() => shift(7)}>
          Tuần sau
        </Button>
      </div>
      <ul className="flex flex-col gap-1 text-label text-text">
        {(data?.items ?? []).map((item, index) => (
          <li key={index}>
            {item.date} {item.time ?? ''} · {ITEM_LABELS[item.kind]}: {item.title}
            {item.detail ? ` (${item.detail})` : ''}
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 ? (
        <p className="text-label text-text-secondary">Tuần này chưa có lịch.</p>
      ) : null}
    </section>
  );
}
