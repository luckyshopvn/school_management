import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// MP-14, MP-16, MP-20 Hoạt động, tin tức, thư viện và ngoại khóa của con (P14-01, P14-05, P14-06, P14-09 đến P14-12;
// BR-64, BR-65, BR-66, BR-69; YCTD-78): hoạt động đã công bố của lớp con kèm hình, thích, bình luận; tin tức; ngoại khóa
// và đăng ký, thôi tham gia
interface ChildRef {
  id: string;
  full_name: string;
}

interface Activity {
  id: string;
  title: string;
  content: string;
  activity_date: string;
  category_name: string;
  media: Array<{ id: string; caption: string | null }>;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
}

interface News {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  published_at: string | null;
}

interface Extracurricular {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  fee_type: 'free' | 'per_activity' | 'monthly';
  fee_amount: number;
  remaining: number;
  my_registrations: Array<{ id: string; child_id: string; status: 'active' | 'withdrawn' }>;
}

const FEE_LABELS = { free: 'Miễn phí', per_activity: 'thu một lần', monthly: 'thu theo tháng' };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

// Ảnh tải kèm mã phiên rồi hiển thị bằng địa chỉ tạm trong trình duyệt
function Photo({ mediaId, caption }: { mediaId: string; caption: string | null }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let created: string | undefined;
    let active = true;
    fetchWithSession(`/api/v1/activity-media/${mediaId}/file`)
      .then(async (response) => {
        if (response.ok && active) {
          created = URL.createObjectURL(await response.blob());
          setUrl(created);
        }
      })
      .catch(() => setUrl(undefined));
    return () => {
      active = false;
      if (created) {
        URL.revokeObjectURL(created);
      }
    };
  }, [mediaId]);
  return url ? (
    <img src={url} alt={caption ?? 'Ảnh hoạt động'} className="max-h-60 rounded-lg object-cover" />
  ) : (
    <div className="h-24 animate-pulse rounded-lg bg-page" aria-label="Đang tải ảnh" />
  );
}

function ActivityCard({ activity, onChanged }: { activity: Activity; onChanged(): void }) {
  const [comments, setComments] = useState<Comment[]>();
  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const loadComments = useCallback(() => {
    requestJson<Comment[]>(`/api/v1/activities/${activity.id}/comments`)
      .then(setComments)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [activity.id]);
  const toggleLike = async () => {
    try {
      await requestJson(`/api/v1/activities/${activity.id}/like`, { method: activity.liked_by_me ? 'DELETE' : 'POST' });
      onChanged();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const comment = async () => {
    try {
      await requestJson(`/api/v1/activities/${activity.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setText('');
      loadComments();
      onChanged();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3" aria-label={activity.title}>
      <span className="text-content font-semibold">{activity.title}</span>
      <span className="text-label text-text-secondary">
        {activity.activity_date} · {activity.category_name}
      </span>
      <p className="text-content">{activity.content}</p>
      {activity.media.map((item) => (
        <Photo key={item.id} mediaId={item.id} caption={item.caption} />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void toggleLike()}>
          {activity.liked_by_me ? 'Bỏ thích' : 'Thích'} ({activity.like_count})
        </Button>
        <Button variant="text" onClick={loadComments}>
          Bình luận ({activity.comment_count})
        </Button>
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {comments ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1 text-content">
            {comments.map((row) => (
              <li key={row.id}>
                <strong>{row.author_name}</strong>: {row.content}
              </li>
            ))}
          </ul>
          <TextField label="Viết bình luận" value={text} onChange={(event) => setText(event.target.value)} />
          <Button disabled={!text.trim()} onClick={() => void comment()}>
            Gửi bình luận
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function ActivitiesPanel({ child }: { child: ChildRef }) {
  const [activities, setActivities] = useState<Activity[]>();
  const [news, setNews] = useState<News[]>([]);
  const [extracurricular, setExtracurricular] = useState<Extracurricular[]>([]);
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();

  const load = useCallback(() => {
    requestJson<Activity[]>(`/api/v1/activities?child_id=${child.id}`)
      .then(setActivities)
      .catch((error: unknown) => setMessage({ text: messageOf(error), failed: true }));
    requestJson<News[]>(`/api/v1/news?child_id=${child.id}`)
      .then(setNews)
      .catch(() => setNews([]));
    requestJson<Extracurricular[]>('/api/v1/extracurricular-activities')
      .then(setExtracurricular)
      .catch(() => setExtracurricular([]));
  }, [child.id]);

  useEffect(load, [load]);

  const register = async (activity: Extracurricular) => {
    try {
      await requestJson(`/api/v1/extracurricular-activities/${activity.id}/registrations`, {
        method: 'POST',
        body: JSON.stringify({ child_id: child.id }),
      });
      setMessage({ text: `Đã đăng ký ${activity.name} cho ${child.full_name}`, failed: false });
      load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    }
  };

  const withdraw = async (registrationId: string) => {
    try {
      await requestJson(`/api/v1/extracurricular-registrations/${registrationId}/withdraw`, {
        method: 'POST',
        body: '{}',
      });
      setMessage({ text: 'Đã thôi tham gia', failed: false });
      load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label={`Hoạt động của ${child.full_name}`}>
      {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
      <h3 className="text-label font-semibold">Hoạt động của lớp</h3>
      {activities && activities.length === 0 ? (
        <p className="text-label text-text-secondary">Lớp chưa có hoạt động đã công bố</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(activities ?? []).map((activity) => (
          <ActivityCard key={activity.id} activity={activity} onChanged={load} />
        ))}
      </ul>
      <h3 className="text-label font-semibold">Tin tức</h3>
      {news.length === 0 ? <p className="text-label text-text-secondary">Chưa có tin tức</p> : null}
      <ul className="flex flex-col gap-2">
        {news.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-3 text-content">
            <strong>{item.title}</strong>
            <p>{item.summary ?? item.content}</p>
          </li>
        ))}
      </ul>
      <h3 className="text-label font-semibold">Hoạt động ngoại khóa</h3>
      {extracurricular.length === 0 ? (
        <p className="text-label text-text-secondary">Chưa có hoạt động ngoại khóa</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {extracurricular.map((activity) => {
          const registration = activity.my_registrations.find(
            (row) => row.child_id === child.id && row.status === 'active',
          );
          return (
            <li key={activity.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-content">
              <strong>{activity.name}</strong>
              <span className="text-label text-text-secondary">
                {activity.start_date} đến {activity.end_date} ·{' '}
                {activity.fee_type === 'free'
                  ? FEE_LABELS.free
                  : `${activity.fee_amount.toLocaleString('vi-VN')} đồng, ${FEE_LABELS[activity.fee_type]}`}{' '}
                · còn {activity.remaining} chỗ
              </span>
              {registration ? (
                <Button onClick={() => void withdraw(registration.id)}>Thôi tham gia</Button>
              ) : (
                <Button variant="primary" onClick={() => void register(activity)}>
                  Đăng ký {activity.name}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
