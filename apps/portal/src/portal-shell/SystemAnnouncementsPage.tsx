import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  type AnnouncementInput,
  type SystemAnnouncement,
} from './portal-shell-api.js';

// Quản trị hệ thống 3.5 Thông báo hệ thống (DT-16 phần 16c): quản trị soạn thông báo có hiệu lực từ ngày đến ngày; thông
// báo đang bật và còn hiệu lực bật lên khi người dùng vào cổng quản trị. Máy chủ kiểm tra quyền P01.announcement.manage
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function formatDate(date: string | null): string {
  if (!date) {
    return '';
  }
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function periodStatus(row: SystemAnnouncement, today: string): { label: string; tone: 'success' | 'neutral' | 'info' } {
  if (!row.is_active) {
    return { label: 'Đang tắt', tone: 'neutral' };
  }
  if (row.valid_from > today) {
    return { label: 'Chưa đến ngày', tone: 'info' };
  }
  if (row.valid_until !== null && row.valid_until < today) {
    return { label: 'Hết hiệu lực', tone: 'neutral' };
  }
  return { label: 'Đang hiển thị', tone: 'success' };
}

const EMPTY_FORM: AnnouncementInput = {
  title: '',
  content: '',
  valid_from: vietnamToday(),
  valid_until: null,
  is_active: true,
};

function AnnouncementForm({
  initial,
  busy,
  error,
  onSave,
  onCancel,
}: {
  initial: AnnouncementInput;
  busy: boolean;
  error: unknown;
  onSave(input: AnnouncementInput): void;
  onCancel(): void;
}) {
  const [form, setForm] = useState(initial);
  const fieldError = (field: string) =>
    error instanceof ApiError ? error.details.find((detail) => detail.field === field)?.message : undefined;
  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Biểu mẫu thông báo"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      {error && !(error instanceof ApiError && error.details.length > 0) ? (
        <Alert tone="danger">{messageOf(error)}</Alert>
      ) : null}
      <FormBlock title="Thông tin thông báo">
        <FormRow label="Tiêu đề" error={fieldError('title')}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.title}
            maxLength={200}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </FormRow>
        <FormRow label="Nội dung" error={fieldError('content')}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={5}
            value={form.content}
            maxLength={5000}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
          />
        </FormRow>
        <FormRow label="Hiệu lực từ ngày" error={fieldError('valid_from')}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.valid_from}
            onChange={(event) => setForm({ ...form, valid_from: event.target.value })}
          />
        </FormRow>
        <FormRow label="Đến ngày" error={fieldError('valid_until')}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.valid_until ?? ''}
            onChange={(event) => setForm({ ...form, valid_until: event.target.value || null })}
          />
        </FormRow>
        <FormRow label="Đang bật">
          <label className="flex items-center gap-2 text-content text-text">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            Hiện thông báo khi người dùng vào trang
          </label>
        </FormRow>
      </FormBlock>
      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          Ghi
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function SystemAnnouncementsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.announcementManage);
  const announcements = useQuery({
    queryKey: ['system-announcements'],
    queryFn: listAnnouncements,
    enabled: canManage,
  });
  const grid = useGridSettings('system-announcements');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SystemAnnouncement | 'new'>();
  const [deleting, setDeleting] = useState<SystemAnnouncement>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const today = vietnamToday();

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['system-announcements'] });
    await queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
    setToastMessage(message);
  };
  const save = useMutation({
    mutationFn: (input: AnnouncementInput) =>
      editing && editing !== 'new' ? updateAnnouncement(editing.id, input) : createAnnouncement(input),
    onSuccess: async () => {
      setEditing(undefined);
      await refresh('Đã ghi thông báo');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: async () => {
      setDeleting(undefined);
      await refresh('Đã xóa thông báo');
    },
  });

  const keyword = search.trim().toLowerCase();
  const rows = (announcements.data ?? []).filter(
    (row) => keyword === '' || `${row.title} ${row.content}`.toLowerCase().includes(keyword),
  );
  const columns: Array<DataGridColumn<SystemAnnouncement>> = [
    { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'valid_from', header: 'Từ ngày', cell: (row) => formatDate(row.valid_from) },
    { id: 'valid_until', header: 'Đến ngày', cell: (row) => formatDate(row.valid_until) || 'Không hết hạn' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => {
        const status = periodStatus(row, today);
        return <StatusBadge tone={status.tone} label={status.label} />;
      },
    },
    { id: 'created_by_name', header: 'Người soạn', cell: (row) => row.created_by_name ?? '' },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/system-announcements')}</h1>
        {!canManage ? <Alert tone="warning">Bạn không có quyền soạn thông báo hệ thống.</Alert> : null}
        {announcements.error ? <Alert tone="danger">{messageOf(announcements.error)}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {editing ? (
          <AnnouncementForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={
              editing === 'new'
                ? EMPTY_FORM
                : {
                    title: editing.title,
                    content: editing.content,
                    valid_from: editing.valid_from.slice(0, 10),
                    valid_until: editing.valid_until?.slice(0, 10) ?? null,
                    is_active: editing.is_active,
                  }
            }
            busy={save.isPending}
            error={save.error}
            onSave={(input) => save.mutate(input)}
            onCancel={() => {
              save.reset();
              setEditing(undefined);
            }}
          />
        ) : null}
        {canManage ? (
          <DataGrid
            label="Danh sách thông báo hệ thống"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.title}
            getRowAriaLabel={(row) => `Thông báo ${row.title}`}
            loading={announcements.isPending}
            emptyText="Chưa có thông báo nào."
            search={{ label: 'Tìm theo tiêu đề, nội dung', value: search, onChange: setSearch }}
            toolbar={
              <Button
                variant="primary"
                onClick={() => {
                  save.reset();
                  setEditing('new');
                }}
              >
                Thêm mới
              </Button>
            }
            rowActions={(row) => (
              <div className="flex gap-1">
                <Button
                  variant="text"
                  onClick={() => {
                    save.reset();
                    setEditing(row);
                  }}
                >
                  Sửa
                </Button>
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              </div>
            )}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        ) : null}
      </div>
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={`thông báo "${deleting?.title ?? ''}"`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(undefined)}
      />
    </AppShell>
  );
}
