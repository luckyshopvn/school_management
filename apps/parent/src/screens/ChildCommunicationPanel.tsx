import { useEffect, useState } from 'react';
import { Button } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';

// Phụ huynh xem thông báo lớp, không gian học nhóm và lịch học tập của con (DT-28 phần 28e, YCTD-275). Không gian nhóm theo GD-145:
// Tiểu học đọc toàn bộ (chỉ đọc); THCS, THPT thấy thành viên, việc, hạn, tệp, không đọc thảo luận của các em
interface Announcement {
  id: string;
  title: string;
  body: string;
  space_title: string;
  created_at: string;
}

interface ChildGroup {
  group: { id: string; name: string; group_set_name: string };
  view: { discussions: boolean; notes: boolean };
  members: Array<{ child_id: string; full_name: string }>;
  threads: Array<{
    id: string;
    title: string;
    body: string;
    author_name: string;
    posts: Array<{ id: string; author_name: string; body: string }>;
  }>;
  tasks: Array<{ id: string; title: string; due_on: string | null; status: string; assignee_child_id: string | null }>;
  note: { content: string } | null;
  files: Array<{ id: string; file_name: string }>;
}

interface CalendarItem {
  date: string;
  kind: 'lesson' | 'due' | 'opens';
  title: string;
  detail: string | null;
  time: string | null;
}

const TASK_LABELS: Record<string, string> = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Xong' };
const ITEM_LABELS = { lesson: 'Tiết học', due: 'Hạn nộp', opens: 'Mở hoạt động' };

export function ChildCommunicationPanel({ child }: { child: { id: string; full_name: string } }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<ChildGroup[]>([]);
  const [calendar, setCalendar] = useState<{ from: string; items: CalendarItem[] }>();
  const [from, setFrom] = useState<string>();
  useEffect(() => {
    requestJson<Announcement[]>(`/api/v1/learning/children/${child.id}/announcements`)
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
    requestJson<ChildGroup[]>(`/api/v1/learning/children/${child.id}/groups`)
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [child.id]);
  useEffect(() => {
    requestJson<{ from: string; items: CalendarItem[] }>(
      `/api/v1/learning/children/${child.id}/calendar${from ? `?from=${from}` : ''}`,
    )
      .then(setCalendar)
      .catch(() => setCalendar(undefined));
  }, [child.id, from]);
  const shift = (days: number) => {
    if (!calendar) return;
    setFrom(new Date(new Date(`${calendar.from}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10));
  };
  return (
    <div className="flex flex-col gap-3">
      {announcements.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3" aria-label="Thông báo lớp">
          <span className="text-content font-semibold">Thông báo lớp</span>
          <ul className="flex flex-col gap-2 text-label text-text">
            {announcements.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> · {item.space_title} · {new Date(item.created_at).toLocaleString('vi-VN')}
                <p className="whitespace-pre-wrap">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {groups.map((entry) => (
        <div
          key={entry.group.id}
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
          aria-label={`Nhóm ${entry.group.name} của con`}
        >
          <span className="text-content font-semibold">
            {entry.group.name} ({entry.group.group_set_name})
          </span>
          <span className="text-label text-text-secondary">
            {entry.members.map((member) => member.full_name).join(', ')}
          </span>
          {entry.tasks.length > 0 ? (
            <ul className="flex flex-col gap-1 text-label text-text">
              {entry.tasks.map((task) => (
                <li key={task.id}>
                  {task.title} · {TASK_LABELS[task.status] ?? task.status}
                  {task.due_on ? ` · hạn ${task.due_on}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {entry.files.length > 0 ? (
            <span className="text-label text-text">
              Tệp chung: {entry.files.map((file) => file.file_name).join(', ')}
            </span>
          ) : null}
          {entry.view.notes && entry.note ? (
            <p className="whitespace-pre-wrap text-label">Ghi chú: {entry.note.content}</p>
          ) : null}
          {entry.view.discussions
            ? entry.threads.map((thread) => (
                <div key={thread.id} className="text-label">
                  <strong>{thread.title}</strong> · {thread.author_name}: {thread.body}
                  {thread.posts.map((reply) => (
                    <p key={reply.id} className="ml-3">
                      {reply.author_name}: {reply.body}
                    </p>
                  ))}
                </div>
              ))
            : null}
          {!entry.view.discussions ? (
            <span className="text-label text-text-secondary">
              Từ THCS, phụ huynh xem việc, hạn, tệp của nhóm; nhà trường liên hệ khi có báo cáo liên quan đến con.
            </span>
          ) : null}
        </div>
      ))}
      {calendar ? (
        <div
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
          aria-label="Lịch học tập của con"
        >
          <span className="flex items-center gap-2 text-content font-semibold">
            Lịch học tập tuần từ {calendar.from}
            <Button variant="text" onClick={() => shift(-7)}>
              Tuần trước
            </Button>
            <Button variant="text" onClick={() => shift(7)}>
              Tuần sau
            </Button>
          </span>
          <ul className="flex flex-col gap-1 text-label text-text">
            {calendar.items.map((item, index) => (
              <li key={index}>
                {item.date} {item.time ?? ''} · {ITEM_LABELS[item.kind]}: {item.title}
                {item.detail ? ` (${item.detail})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
