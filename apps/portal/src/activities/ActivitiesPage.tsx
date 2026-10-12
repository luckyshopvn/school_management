import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  ACTIVITY_STATUS_LABELS,
  CONTENT_STATUS_LABELS,
  FEE_TYPE_LABELS,
  messageOf,
  postJson,
  uploadContentFile,
  type Activity,
  type ActivityStatus,
  type CatalogItem,
  type Comment,
  type ContentItem,
  type Extracurricular,
  type Registration,
} from './activities-api.js';
import { FacebookPostButton, useFacebookPosts } from './FacebookPostButton.js';

// MH-23, MH-24, MH-36 Hoạt động và tin tức (P14-01 đến P14-06, P14-09 đến P14-12; YCTD-78): duyệt, từ chối, ẩn hoạt động
// của lớp; danh mục; tin tức kèm bình luận (chỉ ẩn kèm lý do); thư viện và hình tô màu; hoạt động ngoại khóa và đăng ký
type Tab = 'activities' | 'catalogs' | 'news' | 'library' | 'extracurricular';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

interface TabProps {
  orgUnitId: string | undefined;
  onDone(message: string): void;
}

export function ActivitiesPage() {
  const canApprove = useHasPermission(PERMISSION_CODES.activityApprove);
  const canManageContent = useHasPermission(PERMISSION_CODES.contentManage);
  const canManageLibrary = useHasPermission(PERMISSION_CODES.libraryManage);
  const canManageExtracurricular = useHasPermission(PERMISSION_CODES.extracurricularManage);
  const tabs: Array<[Tab, string, boolean]> = [
    ['activities', 'Duyệt hoạt động', canApprove || canManageContent],
    ['catalogs', 'Danh mục', canManageContent || canManageLibrary],
    ['news', 'Tin tức', canManageContent],
    ['library', 'Thư viện và hình tô màu', canManageLibrary],
    [
      'extracurricular',
      'Ngoại khóa',
      canManageExtracurricular || useHasPermission(PERMISSION_CODES.registrationManage),
    ],
  ];
  const visible = tabs.filter(([, , allowed]) => allowed);
  const [chosen, setTab] = useState<Tab>();
  const tab = chosen ?? visible[0]?.[0];
  const unitChoice = useUnitChoice();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const props = { orgUnitId: unitChoice.selectedId, onDone: setToastMessage };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Hoạt động và tin tức</h1>
        <div className="max-w-sm">
          <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Hoạt động và truyền thông">
          {visible.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === 'activities' ? <ActivitiesTab {...props} /> : null}
        {tab === 'catalogs' ? <CatalogsTab {...props} /> : null}
        {tab === 'news' ? <NewsTab {...props} /> : null}
        {tab === 'library' ? <LibraryTab {...props} /> : null}
        {tab === 'extracurricular' ? <ExtracurricularTab {...props} /> : null}
      </div>
    </AppShell>
  );
}

function ActivitiesTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ActivityStatus | ''>('pending');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const facebook = useFacebookPosts('activity');
  const activities = useQuery({
    queryKey: ['activities', orgUnitId, status],
    queryFn: () =>
      requestJson<Activity[]>(`/api/v1/activities?org_unit_id=${orgUnitId}${status ? `&status=${status}` : ''}`),
    enabled: Boolean(orgUnitId),
  });
  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) =>
      postJson<Activity>(`/api/v1/activities/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: async (activity) => {
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
      onDone(`${activity.title}: ${ACTIVITY_STATUS_LABELS[activity.status]}`);
    },
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Danh sách hoạt động">
      <label className="max-w-xs text-label font-medium text-text">
        Trạng thái
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as ActivityStatus | '')}
          className={selectClass}
        >
          <option value="">Tất cả</option>
          {Object.entries(ACTIVITY_STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
      {(activities.data ?? []).length === 0 ? <p className="text-content text-text-muted">Không có hoạt động</p> : null}
      {(activities.data ?? []).map((activity) => (
        <article key={activity.id} className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label={activity.title}>
          <h2 className="text-section-title font-semibold text-text">{activity.title}</h2>
          <p className="text-label text-text-secondary">
            Lớp {activity.class_name} · {activity.category_name} · {activity.activity_date} · {activity.created_by_name}{' '}
            · {ACTIVITY_STATUS_LABELS[activity.status]}
          </p>
          <p className="text-content text-text">{activity.content}</p>
          <p className="text-label text-text-secondary">
            {activity.media.length} hình · {activity.like_count} lượt thích · {activity.comment_count} bình luận
          </p>
          {activity.media
            .filter((item) => item.excluded)
            .map((item) => (
              <Alert key={item.id} tone="warning">
                Hình {item.file_name} có trẻ chưa đồng ý hình ảnh (
                {item.unconsented_children.map((child) => child.full_name).join(', ')}), không công bố cho phụ huynh
              </Alert>
            ))}
          {activity.reject_reason ? <p className="text-label">Lý do từ chối: {activity.reject_reason}</p> : null}
          {activity.hidden_reason ? <p className="text-label">Lý do ẩn: {activity.hidden_reason}</p> : null}
          <div className="flex flex-wrap items-end gap-2">
            {activity.status === 'pending' || activity.status === 'published' ? (
              <TextField
                label="Lý do từ chối hoặc ẩn"
                value={reasons[activity.id] ?? ''}
                onChange={(event) => setReasons({ ...reasons, [activity.id]: event.target.value })}
              />
            ) : null}
            {activity.status === 'pending' ? (
              <>
                <Button variant="primary" onClick={() => act.mutate({ id: activity.id, action: 'approve' })}>
                  Duyệt và công bố
                </Button>
                <Button
                  disabled={!reasons[activity.id]}
                  onClick={() => act.mutate({ id: activity.id, action: 'reject', reason: reasons[activity.id] })}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
            {activity.status === 'published' ? (
              <Button
                disabled={!reasons[activity.id]}
                onClick={() => act.mutate({ id: activity.id, action: 'hide', reason: reasons[activity.id] })}
              >
                Ẩn hoạt động
              </Button>
            ) : null}
            {activity.status === 'hidden' ? (
              <Button onClick={() => act.mutate({ id: activity.id, action: 'republish' })}>Công bố lại</Button>
            ) : null}
          </div>
          {facebook.allowed && activity.status === 'published' ? (
            <FacebookPostButton
              sourceType="activity"
              sourceId={activity.id}
              post={facebook.bySource.get(activity.id)}
            />
          ) : null}
        </article>
      ))}
    </section>
  );
}

const CATALOGS = [
  ['activity-categories', 'Danh mục hoạt động'],
  ['news-categories', 'Danh mục tin tức'],
  ['library-topics', 'Chủ đề thư viện'],
] as const;

function CatalogsTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const [path, setPath] = useState<(typeof CATALOGS)[number][0]>('activity-categories');
  const [name, setName] = useState('');
  const items = useQuery({
    queryKey: ['content-catalog', path, orgUnitId],
    queryFn: () => requestJson<CatalogItem[]>(`/api/v1/${path}?org_unit_id=${orgUnitId}&include_inactive=true`),
    enabled: Boolean(orgUnitId),
  });
  const create = useMutation({
    mutationFn: () => postJson(`/api/v1/${path}`, { org_unit_id: orgUnitId, name }),
    onSuccess: async () => {
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['content-catalog'] });
      onDone('Đã thêm danh mục');
    },
  });
  const toggle = useMutation({
    mutationFn: (item: CatalogItem) =>
      postJson(`/api/v1/${path}/${item.id}`, { status: item.status === 'active' ? 'inactive' : 'active' }, 'PATCH'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-catalog'] }),
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Danh mục nội dung">
      <form
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label className="text-label font-medium text-text">
          Loại danh mục
          <select value={path} onChange={(event) => setPath(event.target.value as typeof path)} className={selectClass}>
            {CATALOGS.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Tên danh mục" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={!name || create.isPending}>
            Thêm danh mục
          </Button>
        </div>
      </form>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <ul className="flex flex-col gap-1 text-content text-text">
        {(items.data ?? []).map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {item.name} {item.status === 'inactive' ? '(ngừng dùng)' : ''}
            <Button variant="text" onClick={() => toggle.mutate(item)}>
              {item.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PublishActions({ path, item, onChanged }: { path: string; item: ContentItem; onChanged(): void }) {
  const [reason, setReason] = useState('');
  const act = useMutation({
    mutationFn: (action: 'publish' | 'hide') =>
      postJson(`/api/v1/${path}/${item.id}/${action}`, action === 'hide' ? { reason } : {}),
    onSuccess: onChanged,
  });
  if (!item.can_manage) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      {item.status !== 'published' ? (
        <Button variant="primary" onClick={() => act.mutate('publish')}>
          Công bố
        </Button>
      ) : (
        <>
          <TextField label="Lý do ẩn" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button disabled={!reason} onClick={() => act.mutate('hide')}>
            Ẩn
          </Button>
        </>
      )}
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
    </div>
  );
}

function NewsTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState<string>();
  const facebook = useFacebookPosts('news');
  const news = useQuery({
    queryKey: ['news', orgUnitId],
    queryFn: () => requestJson<ContentItem[]>(`/api/v1/news?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const create = useMutation({
    mutationFn: () => postJson<ContentItem>('/api/v1/news', { org_unit_id: orgUnitId, title, content }),
    onSuccess: async () => {
      setTitle('');
      setContent('');
      await queryClient.invalidateQueries({ queryKey: ['news'] });
      onDone('Đã lưu tin nháp');
    },
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Tin tức">
      <form
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <TextField label="Tiêu đề tin" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Nội dung tin" value={content} onChange={(event) => setContent(event.target.value)} />
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={!title || !content || create.isPending}>
            Lưu tin nháp
          </Button>
        </div>
      </form>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      {(news.data ?? []).map((item) => (
        <article key={item.id} className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label={item.title}>
          <h2 className="text-section-title font-semibold text-text">{item.title}</h2>
          <p className="text-label text-text-secondary">{CONTENT_STATUS_LABELS[item.status]}</p>
          <PublishActions
            path="news"
            item={item}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['news'] })}
          />
          {facebook.allowed &&
          item.status === 'published' &&
          (item.scope_type === 'school' || item.scope_type === 'unit') ? (
            <FacebookPostButton sourceType="news" sourceId={item.id} post={facebook.bySource.get(item.id)} />
          ) : null}
          <Button variant="text" onClick={() => setSelected(selected === item.id ? undefined : item.id)}>
            Bình luận
          </Button>
          {selected === item.id ? <CommentsList targetType="news" targetId={item.id} /> : null}
        </article>
      ))}
    </section>
  );
}

// BR-66: bình luận không xóa; quản lý ẩn bình luận vi phạm kèm lý do, bình luận ẩn vẫn hiển thị cho quản lý
function CommentsList({ targetType, targetId }: { targetType: string; targetId: string }) {
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const comments = useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: () => requestJson<Comment[]>(`/api/v1/content-comments?target_type=${targetType}&target_id=${targetId}`),
  });
  const hide = useMutation({
    mutationFn: (id: string) => postJson(`/api/v1/comments/${id}/hide`, { reason: reasons[id] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments'] }),
  });
  return (
    <ul className="flex flex-col gap-2" aria-label="Bình luận">
      {(comments.data ?? []).length === 0 ? <li className="text-label text-text-muted">Chưa có bình luận</li> : null}
      {(comments.data ?? []).map((comment) => (
        <li key={comment.id} className="flex flex-wrap items-end gap-2 text-content text-text">
          <span>
            <strong>{comment.author_name}</strong>: {comment.content}
            {comment.hidden_reason ? ` (đã ẩn: ${comment.hidden_reason})` : ''}
          </span>
          {comment.hidden_reason ? null : (
            <>
              <TextField
                label="Lý do ẩn bình luận"
                value={reasons[comment.id] ?? ''}
                onChange={(event) => setReasons({ ...reasons, [comment.id]: event.target.value })}
              />
              <Button disabled={!reasons[comment.id]} onClick={() => hide.mutate(comment.id)}>
                Ẩn bình luận
              </Button>
            </>
          )}
        </li>
      ))}
      {hide.error ? <Alert tone="danger">{messageOf(hide.error)}</Alert> : null}
    </ul>
  );
}

function LibraryTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<'library-items' | 'coloring-pages'>('library-items');
  const [title, setTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [file, setFile] = useState<File>();
  const items = useQuery({
    queryKey: ['library', kind, orgUnitId],
    queryFn: () => requestJson<ContentItem[]>(`/api/v1/${kind}?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const create = useMutation({
    mutationFn: async () => {
      const stored = file ? await uploadContentFile(orgUnitId ?? '', file) : undefined;
      return postJson(`/api/v1/${kind}`, {
        org_unit_id: orgUnitId,
        title,
        age_group: ageGroup || null,
        file_id: stored?.id ?? null,
      });
    },
    onSuccess: async () => {
      setTitle('');
      setFile(undefined);
      await queryClient.invalidateQueries({ queryKey: ['library'] });
      onDone('Đã lưu nội dung nháp');
    },
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Thư viện">
      <form
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label className="text-label font-medium text-text">
          Loại nội dung
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={selectClass}>
            <option value="library-items">Nội dung thư viện</option>
            <option value="coloring-pages">Hình tô màu</option>
          </select>
        </label>
        <TextField label="Tên nội dung" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Độ tuổi" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)} />
        <label className="text-label font-medium text-text">
          Tệp ảnh hoặc PDF
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="mt-2 block"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </label>
        <div className="flex items-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!title || create.isPending || (kind === 'coloring-pages' && !file)}
          >
            Lưu nội dung
          </Button>
        </div>
      </form>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      {(items.data ?? []).map((item) => (
        <article key={item.id} className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label={item.title}>
          <h2 className="text-section-title font-semibold text-text">{item.title}</h2>
          <p className="text-label text-text-secondary">{CONTENT_STATUS_LABELS[item.status]}</p>
          <PublishActions
            path={kind}
            item={item}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['library'] })}
          />
        </article>
      ))}
    </section>
  );
}

function ExtracurricularTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(vietnamToday);
  const [endDate, setEndDate] = useState(vietnamToday);
  const [quota, setQuota] = useState('20');
  const [feeType, setFeeType] = useState<Extracurricular['fee_type']>('free');
  const [feeAmount, setFeeAmount] = useState('0');
  const [selected, setSelected] = useState<string>();
  const activities = useQuery({
    queryKey: ['extracurricular', orgUnitId],
    queryFn: () => requestJson<Extracurricular[]>(`/api/v1/extracurricular-activities?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const registrations = useQuery({
    queryKey: ['extracurricular-registrations', selected],
    queryFn: () => requestJson<Registration[]>(`/api/v1/extracurricular-activities/${selected}/registrations`),
    enabled: Boolean(selected),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['extracurricular'] });
  const create = useMutation({
    mutationFn: () =>
      postJson('/api/v1/extracurricular-activities', {
        org_unit_id: orgUnitId,
        name,
        start_date: startDate,
        end_date: endDate,
        quota: Number(quota),
        fee_type: feeType,
        fee_amount: feeType === 'free' ? 0 : Number(feeAmount),
      }),
    onSuccess: async () => {
      setName('');
      await refresh();
      onDone('Đã lập hoạt động ngoại khóa');
    },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'close' }) =>
      postJson(`/api/v1/extracurricular-activities/${id}/${action}`),
    onSuccess: refresh,
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Hoạt động ngoại khóa">
      <form
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <TextField label="Tên hoạt động ngoại khóa" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField
          label="Bắt đầu"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <TextField label="Kết thúc" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <TextField label="Chỉ tiêu" type="number" value={quota} onChange={(event) => setQuota(event.target.value)} />
        <label className="text-label font-medium text-text">
          Cách thu phí
          <select
            value={feeType}
            onChange={(event) => setFeeType(event.target.value as Extracurricular['fee_type'])}
            className={selectClass}
          >
            {Object.entries(FEE_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {feeType !== 'free' ? (
          <TextField
            label="Mức phí (đồng)"
            type="number"
            value={feeAmount}
            onChange={(event) => setFeeAmount(event.target.value)}
          />
        ) : null}
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={!name || create.isPending}>
            Lập hoạt động
          </Button>
        </div>
      </form>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      {setStatus.error ? <Alert tone="danger">{messageOf(setStatus.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Hoạt động</th>
            <th>Thời gian</th>
            <th>Phí</th>
            <th>Đã đăng ký</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(activities.data ?? []).map((activity) => (
            <tr key={activity.id} className="border-t border-border">
              <td className="py-2">{activity.name}</td>
              <td>
                {activity.start_date} đến {activity.end_date}
              </td>
              <td>
                {FEE_TYPE_LABELS[activity.fee_type]}
                {activity.fee_type === 'free' ? '' : `: ${activity.fee_amount.toLocaleString('vi-VN')} đồng`}
              </td>
              <td>
                {activity.registered_count}/{activity.quota}
              </td>
              <td>{{ draft: 'Nháp', published: 'Đã công bố', closed: 'Đã đóng' }[activity.status]}</td>
              <td className="flex gap-2">
                {activity.status === 'draft' ? (
                  <Button onClick={() => setStatus.mutate({ id: activity.id, action: 'publish' })}>Công bố</Button>
                ) : null}
                {activity.status === 'published' ? (
                  <Button variant="text" onClick={() => setStatus.mutate({ id: activity.id, action: 'close' })}>
                    Đóng
                  </Button>
                ) : null}
                <Button variant="text" onClick={() => setSelected(activity.id)}>
                  Danh sách đăng ký
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected ? (
        <ul className="flex flex-col gap-1 text-content text-text" aria-label="Danh sách đăng ký">
          {(registrations.data ?? []).length === 0 ? <li>Chưa có đăng ký</li> : null}
          {(registrations.data ?? []).map((registration) => (
            <li key={registration.id}>
              {registration.child_name}: từ {registration.effective_from}
              {registration.status === 'withdrawn' ? `, thôi từ ${registration.effective_to}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
