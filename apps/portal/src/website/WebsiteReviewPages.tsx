import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, WEBSITE_POST_KIND_LABELS } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { messageOf, selectClass } from '../archives/archive-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { handleContact, listContacts, listReview, type ContactMessage, type ReviewItem } from './website-api.js';
import { AlbumEditor } from './WebsiteAlbumPages.js';
import { formatDateTime, ReasonDialog } from './WebsiteCommon.js';
import { PostEditor } from './WebsitePostPages.js';

// 3.1 Nội dung chờ duyệt và 3.2 Thư liên hệ của website trường (DT-18 phần 18f, YCTD-144)
const REVIEW_COLUMNS: Array<DataGridColumn<ReviewItem>> = [
  {
    id: 'kind',
    header: 'Loại',
    cell: (row) => (row.kind === 'album' ? 'Thư viện ảnh' : WEBSITE_POST_KIND_LABELS[row.kind]),
  },
  {
    id: 'title',
    header: 'Tiêu đề',
    alwaysVisible: true,
    cell: (row) => <span className="font-medium">{row.title}</span>,
  },
  { id: 'submitted_by_name', header: 'Người gửi duyệt', cell: (row) => row.submitted_by_name ?? row.created_by_name },
  { id: 'submitted_at', header: 'Ngày gửi', cell: (row) => formatDateTime(row.submitted_at) },
];

export function WebsiteReviewPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('website-review');
  const review = useQuery({ queryKey: ['website-review'], queryFn: listReview });
  const [openId, setOpenId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const changed = (message: string) => {
    setToastMessage(message);
    setOpenId(undefined);
    void queryClient.invalidateQueries({ queryKey: ['website-review'] });
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/review')}</h1>
        {review.error ? <Alert tone="danger">{messageOf(review.error)}</Alert> : null}
        <DataGrid
          label="Nội dung chờ duyệt"
          columns={REVIEW_COLUMNS}
          rows={review.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title}
          getRowAriaLabel={(row) => `Nội dung ${row.title}`}
          loading={!review.data && !review.isError}
          emptyText="Không có nội dung nào chờ duyệt."
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Đóng' : 'Xem'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId !== row.id ? null : row.target_type === 'album' ? (
              <AlbumEditor albumId={row.id} onChanged={changed} />
            ) : (
              <PostEditor postId={row.id} kind={row.kind === 'album' ? 'news' : row.kind} onChanged={changed} />
            )
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

const CONTACT_COLUMNS: Array<DataGridColumn<ContactMessage>> = [
  { id: 'created_at', header: 'Ngày gửi', cell: (row) => formatDateTime(row.created_at) },
  { id: 'full_name', header: 'Người gửi', alwaysVisible: true, cell: (row) => row.full_name },
  { id: 'contact', header: 'Liên lạc', cell: (row) => [row.phone, row.email].filter(Boolean).join(' · ') },
  { id: 'subject', header: 'Tiêu đề', cell: (row) => <span className="font-medium">{row.subject}</span> },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      row.status === 'new' ? (
        <StatusBadge tone="warning" label="Chưa xử lý" />
      ) : (
        <StatusBadge tone="success" label="Đã xử lý" />
      ),
  },
];

export function WebsiteContactsPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('website-contacts');
  const canHandle = useHasPermission(PERMISSION_CODES.websiteApprove);
  const [status, setStatus] = useState('new');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [handling, setHandling] = useState<ContactMessage>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const pageSize = grid.settings.pageSize;
  const contacts = useQuery({
    queryKey: ['website-contacts', status, page, pageSize],
    queryFn: () => listContacts({ status: status || undefined, page, pageSize }),
    enabled: grid.ready,
  });
  const handle = useMutation({
    mutationFn: (input: { id: string; note: string }) => handleContact(input.id, input.note),
    onSuccess: () => {
      setHandling(undefined);
      setToastMessage('Đã đánh dấu đã xử lý');
      void queryClient.invalidateQueries({ queryKey: ['website-contacts'] });
    },
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/contacts')}</h1>
        <p className="text-label text-text-secondary">
          Thư gửi từ trang Liên hệ của website. Thông tin người gửi chỉ dùng để trả lời, không chia sẻ ra ngoài.
        </p>
        {(contacts.error ?? handle.error) ? (
          <Alert tone="danger">{messageOf(contacts.error ?? handle.error)}</Alert>
        ) : null}
        <DataGrid
          label="Thư liên hệ"
          columns={CONTACT_COLUMNS}
          rows={contacts.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.subject}
          getRowAriaLabel={(row) => `Thư ${row.subject}`}
          loading={!contacts.data && !contacts.isError}
          emptyText="Không có thư nào."
          advancedSearch={
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="new">Chưa xử lý</option>
                <option value="handled">Đã xử lý</option>
              </select>
            </label>
          }
          rowActions={(row) => (
            <div className="flex gap-1">
              <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
                {openId === row.id ? 'Đóng' : 'Xem'}
              </Button>
              {canHandle && row.status === 'new' ? (
                <Button variant="text" onClick={() => setHandling(row)}>
                  Đã xử lý
                </Button>
              ) : null}
            </div>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? (
              <div className="flex flex-col gap-2 text-content">
                <p className="whitespace-pre-wrap">{row.message}</p>
                {row.status === 'handled' ? (
                  <p className="text-label text-text-secondary">
                    Đã xử lý {formatDateTime(row.handled_at)} bởi {row.handled_by_name}
                    {row.handled_note ? `: ${row.handled_note}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: contacts.data?.total ?? 0, onPageChange: setPage }}
        />
        <ReasonDialog
          open={!!handling}
          title="Đánh dấu đã xử lý"
          label="Cách xử lý *"
          confirmLabel="Ghi"
          busy={handle.isPending}
          onCancel={() => setHandling(undefined)}
          onConfirm={(note) => handling && handle.mutate({ id: handling.id, note })}
        />
      </div>
    </AppShell>
  );
}
