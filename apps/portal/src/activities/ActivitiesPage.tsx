import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { FormButtons, FormPanel } from '../pages/FormPanel.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
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
// của lớp; danh mục; tin tức kèm bình luận (chỉ ẩn kèm lý do); thư viện và hình tô màu; hoạt động ngoại khóa và đăng ký.
// Giao diện chung theo Sở (DT-15 phần 15f3, YCTD-115): danh mục, tin tức, thư viện và ngoại khóa là lưới dữ liệu chung
// (khóa `content-catalogs`, `news`, `library-items`, `extracurricular-activities`), Thêm mới mở biểu mẫu theo khối có
// nút Ghi; duyệt hoạt động giữ dạng thẻ từng hoạt động vì phải xem nội dung, hình và cảnh báo đồng ý hình ảnh trước khi duyệt
type Tab = 'activities' | 'catalogs' | 'news' | 'library' | 'extracurricular';
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/activities')}</h1>
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
          className={filterClass}
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
                Hình {item.file_name} có học sinh chưa đồng ý hình ảnh (
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
type CatalogPath = (typeof CATALOGS)[number][0];

const CATALOG_COLUMNS: Array<DataGridColumn<CatalogItem>> = [
  { id: 'name', header: 'Tên danh mục', alwaysVisible: true, className: 'font-medium', cell: (item) => item.name },
  { id: 'order_no', header: 'Thứ tự', hiddenByDefault: true, cell: (item) => item.order_no },
  { id: 'status', header: 'Trạng thái', cell: (item) => (item.status === 'active' ? 'Đang dùng' : 'Ngừng dùng') },
];

function CatalogForm({
  orgUnitId,
  path,
  onSaved,
  onCancel,
}: {
  orgUnitId: string | undefined;
  path: CatalogPath;
  onSaved(): void;
  onCancel(): void;
}) {
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => postJson(`/api/v1/${path}`, { org_unit_id: orgUnitId, name }),
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Thêm danh mục"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm danh mục">
        <FormRow label="Loại danh mục">
          <span className="text-content text-text">{CATALOGS.find(([code]) => code === path)?.[1]}</span>
        </FormRow>
        <FormRow label="Tên danh mục">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!name} onCancel={onCancel} />
    </form>
  );
}

function CatalogsTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('content-catalogs');
  const [path, setPath] = useState<CatalogPath>('activity-categories');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const items = useQuery({
    queryKey: ['content-catalog', path, orgUnitId],
    queryFn: () => requestJson<CatalogItem[]>(`/api/v1/${path}?org_unit_id=${orgUnitId}&include_inactive=true`),
    enabled: Boolean(orgUnitId),
  });
  const toggle = useMutation({
    mutationFn: (item: CatalogItem) =>
      postJson(`/api/v1/${path}/${item.id}`, { status: item.status === 'active' ? 'inactive' : 'active' }, 'PATCH'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-catalog'] }),
  });
  const error = [items.error, toggle.error, grid.error].find(Boolean);
  const rows = (items.data ?? []).filter((item) => matchesSearch(search, item.name));
  return (
    <section className="flex flex-col gap-3" aria-label="Danh mục nội dung">
      <label className="max-w-xs text-label font-medium text-text">
        Loại danh mục
        <select
          value={path}
          onChange={(event) => {
            setPath(event.target.value as CatalogPath);
            setCreating(false);
          }}
          className={filterClass}
        >
          {CATALOGS.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <CatalogForm
            key={path}
            orgUnitId={orgUnitId}
            path={path}
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['content-catalog'] });
              onDone('Đã thêm danh mục');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label={CATALOGS.find(([code]) => code === path)?.[1] ?? 'Danh mục'}
        columns={CATALOG_COLUMNS}
        rows={rows}
        getRowId={(item) => item.id}
        getRowLabel={(item) => `danh mục ${item.name}`}
        loading={Boolean(orgUnitId) && items.isPending}
        emptyText="Chưa có danh mục."
        search={{ label: 'Tìm theo tên danh mục', value: search, onChange: setSearch }}
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(item) => (
          <Button variant="text" onClick={() => toggle.mutate(item)}>
            {item.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
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

const SCOPE_LABELS: Record<ContentItem['scope_type'], string> = {
  school: 'Toàn trường',
  unit: 'Đơn vị',
  class: 'Lớp',
  child: 'Học sinh',
};

const CONTENT_COLUMNS: Array<DataGridColumn<ContentItem>> = [
  { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (item) => item.title },
  { id: 'scope_type', header: 'Phạm vi', hiddenByDefault: true, cell: (item) => SCOPE_LABELS[item.scope_type] },
  { id: 'status', header: 'Trạng thái', cell: (item) => CONTENT_STATUS_LABELS[item.status] },
  {
    id: 'published_at',
    header: 'Ngày công bố',
    cell: (item) =>
      item.published_at
        ? new Date(item.published_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : '',
  },
  { id: 'hidden_reason', header: 'Lý do ẩn', hiddenByDefault: true, cell: (item) => item.hidden_reason ?? '' },
];

// Lọc tin tức, nội dung thư viện theo tiêu đề và trạng thái
function useContentFilter() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContentItem['status'] | ''>('');
  return {
    search: { label: 'Tìm theo tiêu đề', value: search, onChange: setSearch },
    advancedSearch: (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Lọc theo trạng thái
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className={filterClass}
          >
            <option value="">Tất cả</option>
            {Object.entries(CONTENT_STATUS_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    ),
    filter: (items: ContentItem[]) =>
      items.filter((item) => (status === '' || item.status === status) && matchesSearch(search, item.title)),
  };
}

function NewsForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string | undefined;
  onSaved(): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const create = useMutation({
    mutationFn: () => postJson<ContentItem>('/api/v1/news', { org_unit_id: orgUnitId, title, content }),
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Thêm tin tức"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm tin tức (lưu nháp)">
        <FormRow label="Tiêu đề tin">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Nội dung tin">
          <textarea
            rows={4}
            className={FORM_CONTROL_CLASS}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!title || !content} onCancel={onCancel} />
    </form>
  );
}

function NewsTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('news');
  const filter = useContentFilter();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>();
  const facebook = useFacebookPosts('news');
  const news = useQuery({
    queryKey: ['news', orgUnitId],
    queryFn: () => requestJson<ContentItem[]>(`/api/v1/news?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const error = news.error ?? grid.error;
  return (
    <section className="flex flex-col gap-3" aria-label="Tin tức">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <NewsForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['news'] });
              onDone('Đã lưu tin nháp');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Danh sách tin tức"
        columns={CONTENT_COLUMNS}
        rows={filter.filter(news.data ?? [])}
        getRowId={(item) => item.id}
        getRowLabel={(item) => `tin ${item.title}`}
        loading={Boolean(orgUnitId) && news.isPending}
        emptyText="Chưa có tin tức."
        search={filter.search}
        advancedSearch={filter.advancedSearch}
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(item) => (
          <Button variant="text" onClick={() => setSelected(selected === item.id ? undefined : item.id)}>
            Xem chi tiết
          </Button>
        )}
        activeRowId={selected}
        renderRowDetail={(item) =>
          selected === item.id ? (
            <div className="flex flex-col gap-3" role="group" aria-label={`Tin ${item.title}`}>
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
              <CommentsList targetType="news" targetId={item.id} />
            </div>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
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

type LibraryKind = 'library-items' | 'coloring-pages';
const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  'library-items': 'Nội dung thư viện',
  'coloring-pages': 'Hình tô màu',
};

function LibraryForm({
  orgUnitId,
  kind,
  onSaved,
  onCancel,
}: {
  orgUnitId: string | undefined;
  kind: LibraryKind;
  onSaved(): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [file, setFile] = useState<File>();
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
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Thêm nội dung thư viện"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm nội dung (lưu nháp)">
        <FormRow label="Loại nội dung">
          <span className="text-content text-text">{LIBRARY_KIND_LABELS[kind]}</span>
        </FormRow>
        <FormRow label="Tên nội dung">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Độ tuổi">
          <input
            className={FORM_CONTROL_CLASS}
            value={ageGroup}
            onChange={(event) => setAgeGroup(event.target.value)}
          />
        </FormRow>
        <FormRow label="Tệp ảnh hoặc PDF">
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="block text-content"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </FormRow>
      </FormBlock>
      <FormButtons
        busy={create.isPending}
        disabled={!title || (kind === 'coloring-pages' && !file)}
        onCancel={onCancel}
      />
    </form>
  );
}

function LibraryTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('library-items');
  const filter = useContentFilter();
  const [kind, setKind] = useState<LibraryKind>('library-items');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>();
  const items = useQuery({
    queryKey: ['library', kind, orgUnitId],
    queryFn: () => requestJson<ContentItem[]>(`/api/v1/${kind}?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const error = items.error ?? grid.error;
  return (
    <section className="flex flex-col gap-3" aria-label="Thư viện">
      <label className="max-w-xs text-label font-medium text-text">
        Loại nội dung
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as LibraryKind);
            setCreating(false);
          }}
          className={filterClass}
        >
          {Object.entries(LIBRARY_KIND_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <LibraryForm
            key={kind}
            orgUnitId={orgUnitId}
            kind={kind}
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['library'] });
              onDone('Đã lưu nội dung nháp');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label={LIBRARY_KIND_LABELS[kind]}
        columns={CONTENT_COLUMNS}
        rows={filter.filter(items.data ?? [])}
        getRowId={(item) => item.id}
        getRowLabel={(item) => item.title}
        loading={Boolean(orgUnitId) && items.isPending}
        emptyText="Chưa có nội dung."
        search={filter.search}
        advancedSearch={filter.advancedSearch}
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(item) =>
          item.can_manage ? (
            <Button variant="text" onClick={() => setSelected(selected === item.id ? undefined : item.id)}>
              {item.status === 'published' ? 'Ẩn' : 'Công bố'}
            </Button>
          ) : null
        }
        activeRowId={selected}
        renderRowDetail={(item) =>
          selected === item.id ? (
            <PublishActions
              path={kind}
              item={item}
              onChanged={() => {
                setSelected(undefined);
                void queryClient.invalidateQueries({ queryKey: ['library'] });
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </section>
  );
}

const EXTRACURRICULAR_STATUS_LABELS: Record<Extracurricular['status'], string> = {
  draft: 'Nháp',
  published: 'Đã công bố',
  closed: 'Đã đóng',
};

const EXTRACURRICULAR_COLUMNS: Array<DataGridColumn<Extracurricular>> = [
  { id: 'name', header: 'Hoạt động', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'time', header: 'Thời gian', cell: (row) => `${row.start_date} đến ${row.end_date}` },
  {
    id: 'fee',
    header: 'Phí',
    cell: (row) =>
      `${FEE_TYPE_LABELS[row.fee_type]}${row.fee_type === 'free' ? '' : `: ${row.fee_amount.toLocaleString('vi-VN')} đồng`}`,
  },
  { id: 'registered', header: 'Đã đăng ký', cell: (row) => `${row.registered_count}/${row.quota}` },
  { id: 'remaining', header: 'Còn lại', hiddenByDefault: true, cell: (row) => row.remaining },
  { id: 'status', header: 'Trạng thái', cell: (row) => EXTRACURRICULAR_STATUS_LABELS[row.status] },
];

function ExtracurricularForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string | undefined;
  onSaved(): void;
  onCancel(): void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(vietnamToday);
  const [endDate, setEndDate] = useState(vietnamToday);
  const [quota, setQuota] = useState('20');
  const [feeType, setFeeType] = useState<Extracurricular['fee_type']>('free');
  const [feeAmount, setFeeAmount] = useState('0');
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
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Lập hoạt động ngoại khóa"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập hoạt động ngoại khóa">
        <FormRow label="Tên hoạt động ngoại khóa">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Bắt đầu">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Kết thúc">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Chỉ tiêu">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
          />
        </FormRow>
        <FormRow label="Cách thu phí">
          <select
            className={FORM_CONTROL_CLASS}
            value={feeType}
            onChange={(event) => setFeeType(event.target.value as Extracurricular['fee_type'])}
          >
            {Object.entries(FEE_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        {feeType !== 'free' ? (
          <FormRow label="Mức phí (đồng)">
            <input
              type="number"
              className={FORM_CONTROL_CLASS}
              value={feeAmount}
              onChange={(event) => setFeeAmount(event.target.value)}
            />
          </FormRow>
        ) : null}
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!name} onCancel={onCancel} />
    </form>
  );
}

// Danh sách học sinh đăng ký một hoạt động ngoại khóa, mở ngay dưới dòng của hoạt động
function RegistrationList({ activityId }: { activityId: string }) {
  const registrations = useQuery({
    queryKey: ['extracurricular-registrations', activityId],
    queryFn: () => requestJson<Registration[]>(`/api/v1/extracurricular-activities/${activityId}/registrations`),
  });
  return (
    <ul className="flex flex-col gap-1 text-content text-text" aria-label="Danh sách đăng ký">
      {registrations.error ? <Alert tone="danger">{messageOf(registrations.error)}</Alert> : null}
      {registrations.data?.length === 0 ? <li>Chưa có đăng ký</li> : null}
      {(registrations.data ?? []).map((registration) => (
        <li key={registration.id}>
          {registration.child_name}: từ {registration.effective_from}
          {registration.status === 'withdrawn' ? `, thôi từ ${registration.effective_to}` : ''}
        </li>
      ))}
    </ul>
  );
}

function ExtracurricularTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('extracurricular-activities');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Extracurricular['status'] | ''>('');
  const activities = useQuery({
    queryKey: ['extracurricular', orgUnitId],
    queryFn: () => requestJson<Extracurricular[]>(`/api/v1/extracurricular-activities?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['extracurricular'] });
  const setActivityStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'close' }) =>
      postJson(`/api/v1/extracurricular-activities/${id}/${action}`),
    onSuccess: refresh,
  });
  const error = [activities.error, setActivityStatus.error, grid.error].find(Boolean);
  const rows = (activities.data ?? []).filter(
    (row) => (status === '' || row.status === status) && matchesSearch(search, row.name),
  );
  return (
    <section className="flex flex-col gap-3" aria-label="Hoạt động ngoại khóa">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <ExtracurricularForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              await refresh();
              onDone('Đã lập hoạt động ngoại khóa');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Danh sách hoạt động ngoại khóa"
        columns={EXTRACURRICULAR_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={Boolean(orgUnitId) && activities.isPending}
        emptyText="Chưa có hoạt động ngoại khóa."
        search={{ label: 'Tìm theo tên hoạt động', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc theo trạng thái
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(EXTRACURRICULAR_STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(row) => (
          <span className="flex flex-wrap justify-end gap-2">
            {row.status === 'draft' ? (
              <Button onClick={() => setActivityStatus.mutate({ id: row.id, action: 'publish' })}>Công bố</Button>
            ) : null}
            {row.status === 'published' ? (
              <Button variant="text" onClick={() => setActivityStatus.mutate({ id: row.id, action: 'close' })}>
                Đóng
              </Button>
            ) : null}
            <Button variant="text" onClick={() => setSelected(selected === row.id ? undefined : row.id)}>
              Danh sách đăng ký
            </Button>
          </span>
        )}
        activeRowId={selected}
        renderRowDetail={(row) => (selected === row.id ? <RegistrationList activityId={row.id} /> : null)}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </section>
  );
}
