import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-07 Tạo hoạt động và album hình ảnh của lớp (P14-01, P14-04; QT-10; BR-64, BR-65; YCTD-78): giáo viên lập hoạt động
// gửi duyệt hoặc lưu nháp, tải ảnh và gắn thẻ trẻ; trẻ chưa đồng ý hình ảnh được cảnh báo, hình đó không công bố
interface ChildRow {
  id: string;
  full_name: string;
  photo_consent: 'pending' | 'granted' | 'refused';
}

interface Category {
  id: string;
  name: string;
}

interface ActivityRow {
  id: string;
  title: string;
  activity_date: string;
  status: 'draft' | 'pending' | 'published' | 'rejected' | 'hidden';
  reject_reason: string | null;
  hidden_reason: string | null;
  media: Array<{ id: string; file_name: string; excluded: boolean }>;
  like_count: number;
  comment_count: number;
}

const STATUS_LABELS: Record<ActivityRow['status'], string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  published: 'Đã công bố',
  rejected: 'Bị từ chối',
  hidden: 'Đã ẩn',
};
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

function PhotoUpload({
  activity,
  classChildren,
  onDone,
}: {
  activity: ActivityRow;
  classChildren: ChildRow[];
  onDone(text: string, failed?: boolean): void;
}) {
  const [file, setFile] = useState<File>();
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const upload = async () => {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('child_ids', tagged.join(','));
      const result = await requestJson<{ warnings: Array<{ message: string }> }>(
        `/api/v1/activities/${activity.id}/media`,
        { method: 'POST', body: form },
      );
      setFile(undefined);
      setTagged([]);
      onDone(
        result.warnings.length > 0 ? result.warnings.map((warning) => warning.message).join('. ') : 'Đã tải ảnh lên',
        result.warnings.length > 0,
      );
    } catch (error) {
      onDone(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      <label className="text-label font-medium text-text">
        Ảnh hoạt động
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="mt-1 block"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-label font-medium text-text">Trẻ có trong ảnh</legend>
        {classChildren.map((child) => (
          <label key={child.id} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              checked={tagged.includes(child.id)}
              onChange={(event) =>
                setTagged(event.target.checked ? [...tagged, child.id] : tagged.filter((id) => id !== child.id))
              }
            />
            {child.full_name}
            {child.photo_consent !== 'granted' ? ' (chưa đồng ý hình ảnh)' : ''}
          </label>
        ))}
      </fieldset>
      <Button disabled={!file || busy} onClick={() => void upload()}>
        Tải ảnh lên
      </Button>
    </div>
  );
}

export function ActivityScreen({ myClass, onBack }: { myClass: MyClass & { org_unit_id?: string }; onBack(): void }) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activityDate, setActivityDate] = useState(vietnamToday);
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);
  const notify = (text: string, failed = false) => setMessage({ text, failed });

  const load = useCallback(() => {
    requestJson<ActivityRow[]>(`/api/v1/activities?class_id=${myClass.id}`)
      .then(setActivities)
      .catch((error: unknown) => setMessage({ text: messageOf(error), failed: true }));
  }, [myClass.id]);

  useEffect(() => {
    load();
    requestJson<{ items: ChildRow[] }>(`/api/v1/children?class_id=${myClass.id}&status=active&page_size=100`)
      .then((page) => setChildren(page.items))
      .catch(() => setChildren([]));
    if (myClass.org_unit_id) {
      requestJson<Category[]>(`/api/v1/activity-categories?org_unit_id=${myClass.org_unit_id}`)
        .then((rows) => {
          setCategories(rows);
          setCategoryId((current) => current || rows[0]?.id || '');
        })
        .catch(() => setCategories([]));
    }
  }, [load, myClass.id, myClass.org_unit_id]);

  const create = async (draft: boolean) => {
    setBusy(true);
    try {
      await requestJson('/api/v1/activities', {
        method: 'POST',
        body: JSON.stringify({
          class_id: myClass.id,
          category_id: categoryId,
          title,
          content,
          activity_date: activityDate,
          draft,
        }),
      });
      setTitle('');
      setContent('');
      notify(draft ? 'Đã lưu nháp hoạt động' : 'Đã gửi hoạt động chờ duyệt');
      load();
    } catch (error) {
      notify(messageOf(error), true);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (activity: ActivityRow) => {
    try {
      await requestJson(`/api/v1/activities/${activity.id}/submit`, { method: 'POST', body: '{}' });
      notify('Đã gửi hoạt động chờ duyệt');
      load();
    } catch (error) {
      notify(messageOf(error), true);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Hoạt động lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col md:max-w-3xl gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'warning' : 'success'}>{message.text}</Alert> : null}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Tạo hoạt động">
          <h2 className="text-section-title font-semibold">Tạo hoạt động</h2>
          <TextField label="Tiêu đề hoạt động" value={title} onChange={(event) => setTitle(event.target.value)} />
          <TextField label="Nội dung hoạt động" value={content} onChange={(event) => setContent(event.target.value)} />
          <label className="text-label font-medium text-text">
            Danh mục hoạt động
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Ngày diễn ra"
            type="date"
            value={activityDate}
            onChange={(event) => setActivityDate(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={busy || !title || !content || !categoryId}
              onClick={() => void create(false)}
            >
              Gửi duyệt
            </Button>
            <Button disabled={busy || !title || !content || !categoryId} onClick={() => void create(true)}>
              Lưu nháp
            </Button>
          </div>
        </section>
        <ul className="flex flex-col gap-3" aria-label="Hoạt động của lớp">
          {activities.map((activity) => (
            <li key={activity.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <span className="text-content font-semibold">{activity.title}</span>
              <span className="text-label text-text-secondary">
                {activity.activity_date} · {STATUS_LABELS[activity.status]} · {activity.media.length} ảnh ·{' '}
                {activity.like_count} lượt thích · {activity.comment_count} bình luận
              </span>
              {activity.reject_reason ? (
                <span className="text-label">Lý do từ chối: {activity.reject_reason}</span>
              ) : null}
              {activity.hidden_reason ? <span className="text-label">Lý do ẩn: {activity.hidden_reason}</span> : null}
              {activity.media.some((item) => item.excluded) ? (
                <Alert tone="warning">Có ảnh gắn trẻ chưa đồng ý hình ảnh, ảnh đó không công bố cho phụ huynh</Alert>
              ) : null}
              {activity.status === 'draft' || activity.status === 'rejected' ? (
                <Button onClick={() => void submit(activity)}>Gửi duyệt hoạt động này</Button>
              ) : null}
              {activity.status === 'draft' || activity.status === 'pending' || activity.status === 'rejected' ? (
                <PhotoUpload
                  activity={activity}
                  classChildren={children}
                  onDone={(text, failed) => {
                    notify(text, failed);
                    load();
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
