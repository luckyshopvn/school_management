import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-08 Trao đổi với phụ huynh và MG-15 Đồ bị mất của lớp (P15-01, P02-11; BR-70, BR-72; YCTD-79): giáo viên xem và trả
// lời tin của phụ huynh trẻ trong lớp, nhắn phụ huynh một trẻ; xem phiếu đồ bị mất của lớp, ghi nhận đồ nhặt được, đánh
// dấu đã tìm thấy và đóng phiếu. Không làm thời gian thực; bấm Tải lại để thấy tin mới
interface ChildRow {
  id: string;
  full_name: string;
}

interface Thread {
  id: string;
  child_name: string;
  guardian_name: string | null;
  last_message: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  sender_side: 'guardian' | 'staff';
  sender_name: string;
  content: string;
  sent_at: string;
}

interface LostItem {
  id: string;
  code: string;
  child_name: string | null;
  report_type: 'lost' | 'found';
  description: string;
  noticed_on: string;
  status: 'reported' | 'found' | 'returned' | 'not_found' | 'cancelled';
}

const STATUS_LABELS = {
  reported: 'Đã báo',
  found: 'Đã tìm thấy',
  returned: 'Đã trả',
  not_found: 'Không tìm thấy',
  cancelled: 'Đã hủy',
};

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const post = <Result,>(path: string, body: unknown) =>
  requestJson<Result>(path, { method: 'POST', body: JSON.stringify(body) });

export function MessagesScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [items, setItems] = useState<LostItem[]>([]);
  const [openThread, setOpenThread] = useState<Thread>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [newChildId, setNewChildId] = useState('');
  const [newContent, setNewContent] = useState('');
  const [foundDescription, setFoundDescription] = useState('');
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const [threadRows, page, itemRows] = await Promise.all([
        requestJson<Thread[]>(`/api/v1/message-threads?class_id=${myClass.id}`),
        requestJson<{ items: ChildRow[] }>(`/api/v1/children?class_id=${myClass.id}&status=active&page_size=100`),
        requestJson<LostItem[]>(`/api/v1/lost-items?class_id=${myClass.id}`),
      ]);
      if (request !== latestRequest.current) {
        return;
      }
      setThreads(threadRows);
      setChildren(page.items);
      setItems(itemRows);
    } catch (error) {
      setNotice({ text: messageOf(error), failed: true });
    }
  }, [myClass.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (thread: Thread) => {
    try {
      const result = await requestJson<{ messages: Message[] }>(`/api/v1/message-threads/${thread.id}/messages`);
      await post(`/api/v1/message-threads/${thread.id}/read`, {});
      setOpenThread(thread);
      setMessages(result.messages);
      void load();
    } catch (error) {
      setNotice({ text: messageOf(error), failed: true });
    }
  };

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
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Trao đổi lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <div className="flex gap-2">
          <Button variant="text" onClick={openThread ? () => setOpenThread(undefined) : onBack}>
            Quay lại
          </Button>
          <Button variant="text" onClick={() => void (openThread ? open(openThread) : load())}>
            Tải lại
          </Button>
        </div>
        {notice ? <Alert tone={notice.failed ? 'danger' : 'success'}>{notice.text}</Alert> : null}
        {openThread ? (
          <section className="flex flex-col gap-2" aria-label="Tin nhắn">
            <h2 className="text-section-title font-semibold">
              {openThread.child_name} · {openThread.guardian_name ?? 'Phụ huynh'}
            </h2>
            <ul className="flex flex-col gap-2">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={`rounded-xl p-3 text-content ${message.sender_side === 'staff' ? 'bg-selected' : 'bg-card'}`}
                >
                  <span className="font-medium">{message.sender_name}</span>: {message.content}
                </li>
              ))}
            </ul>
            <TextField label="Trả lời" value={reply} onChange={(event) => setReply(event.target.value)} />
            <Button
              variant="primary"
              disabled={busy || reply.trim() === ''}
              onClick={() =>
                void run(async () => {
                  await post(`/api/v1/message-threads/${openThread.id}/messages`, { content: reply });
                  setReply('');
                  await open(openThread);
                }, 'Đã gửi trả lời')
              }
            >
              Gửi trả lời
            </Button>
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-2" aria-label="Trao đổi với phụ huynh">
              <h2 className="text-section-title font-semibold">Trao đổi với phụ huynh</h2>
              {threads.length === 0 ? <p className="text-content text-text-secondary">Chưa có trao đổi.</p> : null}
              <ul className="flex flex-col gap-2">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => void open(thread)}
                      className="flex w-full flex-col rounded-xl border border-border bg-card p-3 text-left"
                    >
                      <span className="text-content font-semibold">
                        {thread.child_name} · {thread.guardian_name ?? 'Phụ huynh'}
                        {thread.unread_count ? ` (${thread.unread_count} chưa đọc)` : ''}
                      </span>
                      <span className="text-label text-text-secondary">{thread.last_message}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <label className="text-label font-medium">
                Nhắn phụ huynh của trẻ
                <select
                  value={newChildId}
                  onChange={(event) => setNewChildId(event.target.value)}
                  className="mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
                >
                  <option value="">Chọn trẻ</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <TextField label="Nội dung" value={newContent} onChange={(event) => setNewContent(event.target.value)} />
              <Button
                disabled={busy || newChildId === '' || newContent.trim() === ''}
                onClick={() =>
                  void run(async () => {
                    await post('/api/v1/message-threads', { child_id: newChildId, content: newContent });
                    setNewContent('');
                  }, 'Đã gửi tin cho phụ huynh')
                }
              >
                Gửi tin
              </Button>
            </section>
            <section className="flex flex-col gap-2" aria-label="Đồ bị mất của lớp">
              <h2 className="text-section-title font-semibold">Đồ bị mất của lớp</h2>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                    <span className="text-content">
                      {item.code} · {item.child_name ?? 'Đồ nhặt được'}: {item.description} ({item.noticed_on}) ·{' '}
                      {STATUS_LABELS[item.status]}
                    </span>
                    {item.status === 'reported' || item.status === 'found' ? (
                      <div className="flex flex-wrap gap-2">
                        {item.status === 'reported' ? (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void run(() => post(`/api/v1/lost-items/${item.id}/found`, {}), 'Đã đánh dấu tìm thấy')
                            }
                          >
                            Đã tìm thấy
                          </Button>
                        ) : null}
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => post(`/api/v1/lost-items/${item.id}/close`, { result: 'returned' }),
                              'Đã đóng phiếu: đã trả',
                            )
                          }
                        >
                          Đã trả
                        </Button>
                        <Button
                          variant="text"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => post(`/api/v1/lost-items/${item.id}/close`, { result: 'not_found' }),
                              'Đã đóng phiếu: không tìm thấy',
                            )
                          }
                        >
                          Không tìm thấy
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <TextField
                label="Đồ nhặt được"
                value={foundDescription}
                onChange={(event) => setFoundDescription(event.target.value)}
              />
              <Button
                disabled={busy || foundDescription.trim() === ''}
                onClick={() =>
                  void run(async () => {
                    await post('/api/v1/lost-items', {
                      report_type: 'found',
                      class_id: myClass.id,
                      description: foundDescription,
                    });
                    setFoundDescription('');
                  }, 'Đã ghi nhận đồ nhặt được')
                }
              >
                Ghi nhận đồ nhặt được
              </Button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
