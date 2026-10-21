import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  WEBSITE_PAGE_KEYS,
  WEBSITE_POST_KIND_LABELS,
  WEBSITE_STATUS_LABELS,
  type PortalQuickLinkPath,
  type WebsiteContentStatus,
  type WebsitePostKind,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { fieldErrorsOf, messageOf, selectClass } from '../archives/archive-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  approvePost,
  createPost,
  deletePost,
  deletePostFile,
  listDisclosureCategories,
  listPosts,
  readPost,
  returnPost,
  submitPost,
  unpublishPost,
  updatePost,
  uploadPostFile,
  type WebsitePost,
  type WebsitePostInput,
  type WebsitePostRow,
} from './website-api.js';
import {
  AdminImage,
  ContentStatus,
  EventHistory,
  formatDateTime,
  ReasonDialog,
  RichTextEditor,
} from './WebsiteCommon.js';

// Nội dung website trường (DT-18 phần 18f, YCTD-144): 2.1 Tin tức, 2.2 Thông báo, 2.3 Giới thiệu, cơ cấu tổ chức, 2.4 Công
// khai theo quy định. Soạn, gửi duyệt; người duyệt đăng, trả lại, gỡ. Bấm một dòng mở bài ngay dưới dòng
const COLUMNS: Array<DataGridColumn<WebsitePostRow>> = [
  {
    id: 'title',
    header: 'Tiêu đề',
    alwaysVisible: true,
    cell: (row) => (
      <span className="font-medium">
        {row.pinned ? '📌 ' : ''}
        {row.title}
      </span>
    ),
  },
  { id: 'disclosure_year', header: 'Năm học', hiddenByDefault: true, cell: (row) => row.disclosure_year ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => <ContentStatus status={row.status} /> },
  { id: 'published_at', header: 'Ngày đăng', cell: (row) => formatDateTime(row.published_at) },
  { id: 'created_by_name', header: 'Người soạn', cell: (row) => row.created_by_name },
  { id: 'updated_at', header: 'Cập nhật', hiddenByDefault: true, cell: (row) => formatDateTime(row.updated_at) },
];

const EMPTY_INPUT: WebsitePostInput = { title: '', summary: null, body_html: '', pinned: false };

function inputOf(post: WebsitePost): WebsitePostInput {
  return {
    title: post.title,
    summary: post.summary,
    body_html: post.body_html,
    pinned: post.pinned,
    disclosure_category: post.disclosure_category,
    disclosure_year: post.disclosure_year,
  };
}

export function PostEditor({
  postId,
  kind,
  pageKey,
  onCreated,
  onChanged,
  onDeleted,
  onCancel,
}: {
  postId?: string;
  kind: WebsitePostKind;
  pageKey?: string;
  onCreated?(post: WebsitePost): void;
  onChanged?(message: string): void;
  onDeleted?(): void;
  onCancel?(): void;
}) {
  const queryClient = useQueryClient();
  const canApprove = useHasPermission(PERMISSION_CODES.websiteApprove);
  const post = useQuery({ queryKey: ['website-post', postId], queryFn: () => readPost(postId!), enabled: !!postId });
  const categories = useQuery({
    queryKey: ['website-disclosure-categories'],
    queryFn: listDisclosureCategories,
    enabled: kind === 'disclosure',
  });
  const [draft, setDraft] = useState<WebsitePostInput>();
  const [dialog, setDialog] = useState<'return' | 'unpublish' | 'delete'>();
  const current = post.data;
  const input = draft ?? (current ? inputOf(current) : EMPTY_INPUT);
  const editable = !current || current.status === 'draft' || current.status === 'unpublished';
  const change = <Key extends keyof WebsitePostInput>(key: Key, value: WebsitePostInput[Key]) =>
    setDraft({ ...input, [key]: value });
  const done = (saved: WebsitePost, text: string) => {
    queryClient.setQueryData(['website-post', saved.id], saved);
    void queryClient.invalidateQueries({ queryKey: ['website-posts'] });
    setDraft(undefined);
    setDialog(undefined);
    onChanged?.(text);
  };
  const action = useMutation({
    mutationFn: async (step: { run(): Promise<WebsitePost | void>; text: string }) => ({
      result: await step.run(),
      text: step.text,
    }),
    onSuccess: ({ result, text }) => {
      if (!result) {
        void queryClient.invalidateQueries({ queryKey: ['website-posts'] });
        onDeleted?.();
        return;
      }
      if (!postId) {
        void queryClient.invalidateQueries({ queryKey: ['website-posts'] });
        onCreated?.(result);
        return;
      }
      done(result, text);
    },
  });
  const save = () =>
    action.mutate({
      run: () => (current ? updatePost(current.id, input) : createPost({ ...input, kind, page_key: pageKey ?? null })),
      text: 'Đã ghi bài',
    });
  const errors = fieldErrorsOf(action.error);
  const upload = (file: File | undefined, purpose: 'cover' | 'attachment') => {
    if (file && current) {
      action.mutate({ run: () => uploadPostFile(current.id, file, purpose), text: 'Đã tải tệp lên' });
    }
  };
  if (postId && !current) {
    return post.error ? <Alert tone="danger">{messageOf(post.error)}</Alert> : <p>Đang tải…</p>;
  }
  const attachments = current?.files.filter((file) => file.purpose === 'attachment') ?? [];
  return (
    <div className="flex flex-col gap-3" aria-label={`Bài ${input.title || 'mới'}`}>
      {current ? (
        <div className="flex flex-wrap items-center gap-2 text-label text-text-secondary">
          <ContentStatus status={current.status} />
          {current.published_at ? <span>Đăng {formatDateTime(current.published_at)}</span> : null}
          {current.published_by_name ? <span>bởi {current.published_by_name}</span> : null}
          {current.is_sample ? <span>Nội dung mẫu</span> : null}
        </div>
      ) : null}
      {current?.return_note && current.status === 'draft' ? (
        <Alert tone="warning">Người duyệt trả lại: {current.return_note}</Alert>
      ) : null}
      {current?.status === 'unpublished' && current.unpublish_reason ? (
        <Alert tone="warning">Đã gỡ xuống: {current.unpublish_reason}</Alert>
      ) : null}
      {current?.status === 'pending' ? (
        <Alert tone="info">Bài đang chờ duyệt; người duyệt trả lại thì mới sửa được.</Alert>
      ) : null}
      {current?.status === 'published' ? <Alert tone="info">Bài đã đăng; gỡ xuống trước khi sửa.</Alert> : null}
      {action.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      <FormBlock title={`Thông tin ${WEBSITE_POST_KIND_LABELS[kind].toLowerCase()}`}>
        <FormRow label="Tiêu đề *" error={errors.title}>
          <input
            value={input.title}
            disabled={!editable}
            onChange={(event) => change('title', event.target.value)}
            maxLength={300}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Tóm tắt" error={errors.summary}>
          <textarea
            value={input.summary ?? ''}
            disabled={!editable}
            onChange={(event) => change('summary', event.target.value || null)}
            rows={2}
            maxLength={1000}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        {kind === 'disclosure' ? (
          <>
            <FormRow label="Nhóm công khai *" error={errors.disclosure_category}>
              <select
                value={input.disclosure_category ?? ''}
                disabled={!editable}
                onChange={(event) => change('disclosure_category', event.target.value || null)}
                className={FORM_CONTROL_CLASS}
              >
                <option value="">Chọn nhóm</option>
                {(categories.data?.items ?? []).map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.name}
                    {category.legal_basis ? ` (${category.legal_basis}` : ''}
                    {category.school_level ? `, ${category.school_level === 'MN' ? 'mầm non' : 'phổ thông'}` : ''}
                    {category.legal_basis ? ')' : ''}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Năm học" error={errors.disclosure_year}>
              <input
                value={input.disclosure_year ?? ''}
                disabled={!editable}
                placeholder="2026-2027"
                onChange={(event) => change('disclosure_year', event.target.value || null)}
                className={FORM_CONTROL_CLASS}
              />
            </FormRow>
          </>
        ) : null}
        {kind === 'news' || kind === 'announcement' ? (
          <FormRow label="Ghim lên đầu">
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={input.pinned}
                disabled={!editable}
                onChange={(event) => change('pinned', event.target.checked)}
              />
              Hiện trước các bài khác
            </label>
          </FormRow>
        ) : null}
        <FormRow label="Nội dung" error={errors.body_html}>
          <RichTextEditor
            label="Nội dung bài"
            value={input.body_html}
            disabled={!editable}
            onChange={(html) => change('body_html', html)}
          />
        </FormRow>
      </FormBlock>
      {current ? (
        <FormBlock title="Ảnh và tệp đính kèm">
          <FormRow label="Ảnh bìa">
            <div className="flex flex-wrap items-center gap-3">
              {current.cover_file_id ? (
                <AdminImage fileId={current.cover_file_id} alt="Ảnh bìa" className="h-24 w-36 rounded object-cover" />
              ) : (
                <span className="text-label text-text-secondary">Chưa có</span>
              )}
              {editable ? (
                <input
                  type="file"
                  aria-label="Tải ảnh bìa"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    upload(event.target.files?.[0], 'cover');
                    event.target.value = '';
                  }}
                />
              ) : null}
            </div>
          </FormRow>
          <FormRow label="Tệp đính kèm">
            <div className="flex flex-col gap-2">
              {attachments.length ? (
                <ul className="flex flex-col gap-1">
                  {attachments.map((file) => (
                    <li key={file.id} className="flex items-center gap-2 text-content">
                      <span>{file.file_name}</span>
                      {editable ? (
                        <Button
                          variant="text"
                          aria-label={`Xóa tệp ${file.file_name}`}
                          onClick={() =>
                            action.mutate({ run: () => deletePostFile(current.id, file.id), text: 'Đã xóa tệp' })
                          }
                        >
                          Xóa
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-label text-text-secondary">Chưa có</span>
              )}
              {editable ? (
                <input
                  type="file"
                  aria-label="Tải tệp đính kèm"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    upload(event.target.files?.[0], 'attachment');
                    event.target.value = '';
                  }}
                />
              ) : null}
            </div>
          </FormRow>
        </FormBlock>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {editable ? (
          <Button variant="primary" onClick={save} disabled={action.isPending}>
            Ghi
          </Button>
        ) : null}
        {current && editable ? (
          <Button
            onClick={() =>
              action.mutate({
                run: async () => submitPost((draft ? await updatePost(current.id, input) : current).id),
                text: 'Đã gửi duyệt',
              })
            }
            disabled={action.isPending}
          >
            Gửi duyệt
          </Button>
        ) : null}
        {current?.status === 'pending' && canApprove ? (
          <>
            <Button
              variant="primary"
              onClick={() => action.mutate({ run: () => approvePost(current.id), text: 'Đã duyệt và đăng' })}
              disabled={action.isPending}
            >
              Duyệt và đăng
            </Button>
            <Button onClick={() => setDialog('return')}>Trả lại</Button>
          </>
        ) : null}
        {current?.status === 'published' && canApprove ? (
          <Button variant="danger" onClick={() => setDialog('unpublish')}>
            Gỡ xuống
          </Button>
        ) : null}
        {current && !current.first_published_at && current.status !== 'pending' ? (
          <Button variant="danger" onClick={() => setDialog('delete')}>
            Xóa
          </Button>
        ) : null}
        {onCancel ? <Button onClick={onCancel}>Hủy</Button> : null}
      </div>
      {current ? <EventHistory events={current.events} /> : null}
      <ReasonDialog
        open={dialog === 'return'}
        title="Trả lại bài"
        label="Lý do trả lại *"
        confirmLabel="Trả lại"
        busy={action.isPending}
        onCancel={() => setDialog(undefined)}
        onConfirm={(reason) =>
          current && action.mutate({ run: () => returnPost(current.id, reason), text: 'Đã trả lại' })
        }
      />
      <ReasonDialog
        open={dialog === 'unpublish'}
        title="Gỡ bài xuống"
        label="Lý do gỡ *"
        confirmLabel="Gỡ xuống"
        busy={action.isPending}
        onCancel={() => setDialog(undefined)}
        onConfirm={(reason) =>
          current && action.mutate({ run: () => unpublishPost(current.id, reason), text: 'Đã gỡ xuống' })
        }
      />
      <ConfirmDeleteDialog
        open={dialog === 'delete'}
        subject={`bài "${current?.title ?? ''}"`}
        busy={action.isPending}
        onCancel={() => setDialog(undefined)}
        onConfirm={() => current && action.mutate({ run: () => deletePost(current.id), text: 'Đã xóa' })}
      />
    </div>
  );
}

function PostListPage({ path, kind }: { path: PortalQuickLinkPath; kind: WebsitePostKind }) {
  const grid = useGridSettings('website-posts');
  const canWrite = useHasPermission(PERMISSION_CODES.websiteEdit);
  const canApprove = useHasPermission(PERMISSION_CODES.websiteApprove);
  const canEdit = canWrite || canApprove;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<WebsiteContentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const pageSize = grid.settings.pageSize;
  const posts = useQuery({
    queryKey: ['website-posts', kind, status, search, page, pageSize],
    queryFn: () => listPosts({ kind, status: status || undefined, q: search.trim() || undefined, page, pageSize }),
    enabled: grid.ready,
  });
  const failure = posts.error ?? grid.error;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <PostEditor
              kind={kind}
              onCancel={() => setCreating(false)}
              onCreated={(post) => {
                setCreating(false);
                setToastMessage(`Đã tạo bài "${post.title}"`);
                setOpenId(post.id);
              }}
            />
          </section>
        ) : null}
        {failure ? <Alert tone="danger">{messageOf(failure)}</Alert> : null}
        <DataGrid
          label={`Danh sách ${WEBSITE_POST_KIND_LABELS[kind].toLowerCase()}`}
          columns={COLUMNS}
          rows={posts.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title}
          getRowAriaLabel={(row) => `Bài ${row.title}`}
          loading={!posts.data && !posts.isError}
          emptyText="Chưa có bài nào."
          search={{
            label: 'Tìm theo tiêu đề',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as WebsiteContentStatus | '');
                  setPage(1);
                }}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(WEBSITE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          }
          toolbar={
            canEdit ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? (
              <PostEditor
                postId={row.id}
                kind={kind}
                onChanged={setToastMessage}
                onDeleted={() => {
                  setOpenId(undefined);
                  setToastMessage('Đã xóa bài');
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: posts.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </AppShell>
  );
}

export function WebsiteNewsPage() {
  return <PostListPage path="/website/news" kind="news" />;
}

export function WebsiteAnnouncementsPage() {
  return <PostListPage path="/website/announcements" kind="announcement" />;
}

export function WebsiteDisclosuresPage() {
  return <PostListPage path="/website/disclosures" kind="disclosure" />;
}

// 2.3 Giới thiệu, cơ cấu tổ chức: mỗi trang cố định một bài; chưa có thì soạn mới
export function WebsitePagesPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const pages = useQuery({
    queryKey: ['website-posts', 'page'],
    queryFn: () => listPosts({ kind: 'page', page: 1, pageSize: 50 }),
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/pages')}</h1>
        <p className="text-label text-text-secondary">
          Trang Cơ cấu tổ chức trên website tự hiện danh sách phân hiệu, điểm trường đang hoạt động ở cây đơn vị của năm
          học, kèm nội dung soạn ở đây.
        </p>
        {pages.error ? <Alert tone="danger">{messageOf(pages.error)}</Alert> : null}
        {pages.data
          ? WEBSITE_PAGE_KEYS.map((page) => {
              const existing = pages.data.items.find((item) => item.page_key === page.key);
              return (
                <section
                  key={page.key}
                  aria-label={`Trang ${page.label}`}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <h2 className="mb-3 text-section-title font-semibold text-text">{page.label}</h2>
                  <PostEditor
                    key={existing?.id ?? `new-${page.key}`}
                    postId={existing?.id}
                    kind="page"
                    pageKey={page.key}
                    onChanged={setToastMessage}
                    onCreated={() => {
                      setToastMessage(`Đã tạo trang ${page.label}`);
                      void queryClient.invalidateQueries({ queryKey: ['website-posts', 'page'] });
                    }}
                    onDeleted={() => setToastMessage('Đã xóa trang')}
                  />
                </section>
              );
            })
          : null}
      </div>
    </AppShell>
  );
}
