import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, WEBSITE_STATUS_LABELS, type WebsiteContentStatus } from '@school-management/shared';
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
import { fieldErrorsOf, formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  approveAlbum,
  createAlbum,
  deleteAlbum,
  deleteAlbumPhoto,
  listAlbums,
  readAlbum,
  returnAlbum,
  setAlbumCover,
  submitAlbum,
  unpublishAlbum,
  updateAlbum,
  uploadAlbumPhoto,
  type WebsiteAlbum,
  type WebsiteAlbumRow,
} from './website-api.js';
import { AdminImage, ContentStatus, EventHistory, formatDateTime, ReasonDialog } from './WebsiteCommon.js';

// 2.5 Thư viện ảnh của website trường (DT-18 phần 18f, YCTD-144): album, ảnh kèm chú thích, ảnh bìa; gửi duyệt cần xác nhận
// ảnh có trẻ đã được cha mẹ đồng ý đăng công khai
interface AlbumForm {
  title: string;
  description: string | null;
  event_date: string | null;
}

const COLUMNS: Array<DataGridColumn<WebsiteAlbumRow>> = [
  {
    id: 'title',
    header: 'Tên album',
    alwaysVisible: true,
    cell: (row) => <span className="font-medium">{row.title}</span>,
  },
  { id: 'event_date', header: 'Ngày sự kiện', cell: (row) => formatDate(row.event_date) },
  { id: 'photo_count', header: 'Số ảnh', cell: (row) => row.photo_count },
  { id: 'status', header: 'Trạng thái', cell: (row) => <ContentStatus status={row.status} /> },
  { id: 'published_at', header: 'Ngày đăng', cell: (row) => formatDateTime(row.published_at) },
  { id: 'created_by_name', header: 'Người tạo', cell: (row) => row.created_by_name },
];

function AlbumEditor({
  albumId,
  onCreated,
  onChanged,
  onDeleted,
  onCancel,
}: {
  albumId?: string;
  onCreated?(album: WebsiteAlbum): void;
  onChanged?(message: string): void;
  onDeleted?(): void;
  onCancel?(): void;
}) {
  const queryClient = useQueryClient();
  const canApprove = useHasPermission(PERMISSION_CODES.websiteApprove);
  const album = useQuery({
    queryKey: ['website-album', albumId],
    queryFn: () => readAlbum(albumId!),
    enabled: !!albumId,
  });
  const [draft, setDraft] = useState<AlbumForm>();
  const [caption, setCaption] = useState('');
  const [consent, setConsent] = useState(false);
  const [dialog, setDialog] = useState<'return' | 'unpublish' | 'delete'>();
  const current = album.data;
  const input: AlbumForm = draft ?? {
    title: current?.title ?? '',
    description: current?.description ?? null,
    event_date: current?.event_date ?? null,
  };
  const editable = !current || current.status === 'draft' || current.status === 'unpublished';
  const action = useMutation({
    mutationFn: async (step: { run(): Promise<WebsiteAlbum | void>; text: string }) => ({
      result: await step.run(),
      text: step.text,
    }),
    onSuccess: ({ result, text }) => {
      void queryClient.invalidateQueries({ queryKey: ['website-albums'] });
      if (!result) {
        onDeleted?.();
        return;
      }
      if (!albumId) {
        onCreated?.(result);
        return;
      }
      queryClient.setQueryData(['website-album', result.id], result);
      setDraft(undefined);
      setDialog(undefined);
      onChanged?.(text);
    },
  });
  const errors = fieldErrorsOf(action.error);
  if (albumId && !current) {
    return album.error ? <Alert tone="danger">{messageOf(album.error)}</Alert> : <p>Đang tải…</p>;
  }
  const photos = current?.files ?? [];
  return (
    <div className="flex flex-col gap-3">
      {current ? (
        <div className="flex flex-wrap items-center gap-2 text-label text-text-secondary">
          <ContentStatus status={current.status} />
          {current.published_at ? <span>Đăng {formatDateTime(current.published_at)}</span> : null}
          {current.consent_confirmed ? (
            <span>Đã xác nhận cha mẹ đồng ý ({current.consent_confirmed_by_name})</span>
          ) : null}
        </div>
      ) : null}
      {current?.return_note && current.status === 'draft' ? (
        <Alert tone="warning">Người duyệt trả lại: {current.return_note}</Alert>
      ) : null}
      {current?.status === 'unpublished' && current.unpublish_reason ? (
        <Alert tone="warning">Đã gỡ xuống: {current.unpublish_reason}</Alert>
      ) : null}
      {action.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {errors.consent_confirmed || errors.file ? (
        <Alert tone="danger">{errors.consent_confirmed ?? errors.file}</Alert>
      ) : null}
      <FormBlock title="Thông tin album">
        <FormRow label="Tên album *" error={errors.title}>
          <input
            value={input.title}
            disabled={!editable}
            onChange={(event) => setDraft({ ...input, title: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Ngày sự kiện" error={errors.event_date}>
          <input
            type="date"
            value={input.event_date ?? ''}
            disabled={!editable}
            onChange={(event) => setDraft({ ...input, event_date: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Mô tả" error={errors.description}>
          <textarea
            value={input.description ?? ''}
            disabled={!editable}
            rows={3}
            onChange={(event) => setDraft({ ...input, description: event.target.value || null })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
      </FormBlock>
      {current ? (
        <FormBlock title={`Ảnh (${photos.length})`}>
          {photos.length ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id} className="flex flex-col gap-1 rounded-lg border border-border p-2">
                  <AdminImage
                    fileId={photo.id}
                    alt={photo.caption ?? photo.file_name}
                    className="h-28 w-full rounded object-cover"
                  />
                  <span className="text-label">{photo.caption ?? photo.file_name}</span>
                  {current.cover_file_id === photo.id ? (
                    <span className="text-label text-text-secondary">Ảnh bìa</span>
                  ) : null}
                  {editable ? (
                    <span className="flex gap-1">
                      {current.cover_file_id !== photo.id ? (
                        <Button
                          variant="text"
                          onClick={() =>
                            action.mutate({ run: () => setAlbumCover(current.id, photo.id), text: 'Đã đổi ảnh bìa' })
                          }
                        >
                          Làm ảnh bìa
                        </Button>
                      ) : null}
                      <Button
                        variant="text"
                        aria-label={`Xóa ảnh ${photo.caption ?? photo.file_name}`}
                        onClick={() =>
                          action.mutate({ run: () => deleteAlbumPhoto(current.id, photo.id), text: 'Đã xóa ảnh' })
                        }
                      >
                        Xóa
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-label text-text-secondary">Chưa có ảnh.</p>
          )}
          {editable ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-label font-medium text-text">
                Chú thích ảnh
                <input value={caption} onChange={(event) => setCaption(event.target.value)} className={selectClass} />
              </label>
              <input
                type="file"
                aria-label="Tải ảnh lên album"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    action.mutate({
                      run: async () => {
                        const saved = await uploadAlbumPhoto(current.id, file, caption.trim() || null);
                        setCaption('');
                        return saved;
                      },
                      text: 'Đã tải ảnh lên',
                    });
                  }
                }}
              />
            </div>
          ) : null}
        </FormBlock>
      ) : null}
      {current && editable ? (
        <label className="flex items-center gap-2 text-content">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          Tôi xác nhận ảnh có trẻ đã được cha mẹ đồng ý đăng công khai trên website
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {editable ? (
          <Button
            variant="primary"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                run: () => (current ? updateAlbum(current.id, input) : createAlbum(input)),
                text: 'Đã ghi album',
              })
            }
          >
            Ghi
          </Button>
        ) : null}
        {current && editable ? (
          <Button
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                run: async () => submitAlbum((draft ? await updateAlbum(current.id, input) : current).id, consent),
                text: 'Đã gửi duyệt',
              })
            }
          >
            Gửi duyệt
          </Button>
        ) : null}
        {current?.status === 'pending' && canApprove ? (
          <>
            <Button
              variant="primary"
              disabled={action.isPending}
              onClick={() => action.mutate({ run: () => approveAlbum(current.id), text: 'Đã duyệt và đăng' })}
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
        title="Trả lại album"
        label="Lý do trả lại *"
        confirmLabel="Trả lại"
        busy={action.isPending}
        onCancel={() => setDialog(undefined)}
        onConfirm={(reason) =>
          current && action.mutate({ run: () => returnAlbum(current.id, reason), text: 'Đã trả lại' })
        }
      />
      <ReasonDialog
        open={dialog === 'unpublish'}
        title="Gỡ album xuống"
        label="Lý do gỡ *"
        confirmLabel="Gỡ xuống"
        busy={action.isPending}
        onCancel={() => setDialog(undefined)}
        onConfirm={(reason) =>
          current && action.mutate({ run: () => unpublishAlbum(current.id, reason), text: 'Đã gỡ xuống' })
        }
      />
      <ConfirmDeleteDialog
        open={dialog === 'delete'}
        subject={`album "${current?.title ?? ''}"`}
        busy={action.isPending}
        onCancel={() => setDialog(undefined)}
        onConfirm={() => current && action.mutate({ run: () => deleteAlbum(current.id), text: 'Đã xóa' })}
      />
    </div>
  );
}

export function WebsiteAlbumsPage() {
  const grid = useGridSettings('website-albums');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<WebsiteContentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const pageSize = grid.settings.pageSize;
  const albums = useQuery({
    queryKey: ['website-albums', status, search, page, pageSize],
    queryFn: () => listAlbums({ status: status || undefined, q: search.trim() || undefined, page, pageSize }),
    enabled: grid.ready,
  });
  const failure = albums.error ?? grid.error;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/albums')}</h1>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <AlbumEditor
              onCancel={() => setCreating(false)}
              onCreated={(album) => {
                setCreating(false);
                setToastMessage(`Đã tạo album "${album.title}"`);
                setOpenId(album.id);
              }}
            />
          </section>
        ) : null}
        {failure ? <Alert tone="danger">{messageOf(failure)}</Alert> : null}
        <DataGrid
          label="Danh sách album"
          columns={COLUMNS}
          rows={albums.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title}
          getRowAriaLabel={(row) => `Album ${row.title}`}
          loading={!albums.data && !albums.isError}
          emptyText="Chưa có album nào."
          search={{
            label: 'Tìm theo tên album',
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
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          }
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? (
              <AlbumEditor
                albumId={row.id}
                onChanged={setToastMessage}
                onDeleted={() => {
                  setOpenId(undefined);
                  setToastMessage('Đã xóa album');
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: albums.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </AppShell>
  );
}

export { AlbumEditor };
