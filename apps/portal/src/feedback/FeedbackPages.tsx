import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  StatusBadge,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  formatDateTime,
  listAllFeedback,
  listMyFeedback,
  openFeedbackAttachment,
  updateFeedback,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from './feedback-api.js';

// Danh sách ý kiến đã gửi (menu người dùng) và Ý kiến phản hồi (Quản trị hệ thống, 3.4) của DT-15 phần 15g (YCTD-110):
// lưới dữ liệu chung, tìm theo tiêu đề, nội dung; dòng chi tiết có nội dung, ảnh đính kèm, câu trả lời. Màn hình quản trị
// đổi trạng thái và trả lời; máy chủ kiểm tra quyền P01.feedback.manage
const STATUS_TONES: Record<FeedbackStatus, StatusTone> = { new: 'info', in_progress: 'warning', resolved: 'success' };
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content text-text';

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function matches(row: Feedback, search: string): boolean {
  const keyword = search.trim().toLowerCase();
  return (
    keyword === '' ||
    row.title.toLowerCase().includes(keyword) ||
    row.content.toLowerCase().includes(keyword) ||
    row.user_name.toLowerCase().includes(keyword)
  );
}

function StatusCell({ status }: { status: FeedbackStatus }) {
  return <StatusBadge tone={STATUS_TONES[status]} label={FEEDBACK_STATUS_LABELS[status]} />;
}

const baseColumns: Array<DataGridColumn<Feedback>> = [
  { id: 'created_at', header: 'Ngày gửi', cell: (row) => formatDateTime(row.created_at) },
  { id: 'feedback_type', header: 'Loại', cell: (row) => FEEDBACK_TYPE_LABELS[row.feedback_type] },
  { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'page_url', header: 'Trang', cell: (row) => row.page_url ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => <StatusCell status={row.status} /> },
  { id: 'replied_at', header: 'Ngày trả lời', cell: (row) => formatDateTime(row.replied_at) },
];

function FeedbackDetail({ row, children }: { row: Feedback; children?: ReactNode }) {
  const [attachmentError, setAttachmentError] = useState<string>();
  return (
    <div className="flex flex-col gap-3 text-content">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-[10rem_1fr]">
        <dt className="text-label text-text-secondary">Nội dung</dt>
        <dd className="whitespace-pre-wrap">{row.content}</dd>
        {row.contact_phone || row.contact_email ? (
          <>
            <dt className="text-label text-text-secondary">Liên hệ</dt>
            <dd>{[row.contact_phone, row.contact_email].filter(Boolean).join(' · ')}</dd>
          </>
        ) : null}
        {row.attachment_name ? (
          <>
            <dt className="text-label text-text-secondary">Ảnh đính kèm</dt>
            <dd>
              <Button
                variant="text"
                className="px-0 py-0"
                onClick={() =>
                  openFeedbackAttachment(row.id).catch((error: unknown) => setAttachmentError(messageOf(error)))
                }
              >
                {row.attachment_name}
              </Button>
            </dd>
          </>
        ) : null}
        <dt className="text-label text-text-secondary">Trả lời</dt>
        <dd className="whitespace-pre-wrap">
          {row.reply
            ? `${row.reply} (${row.replied_by_name ?? ''}, ${formatDateTime(row.replied_at)})`
            : 'Chưa trả lời'}
        </dd>
      </dl>
      {attachmentError ? <Alert tone="danger">{attachmentError}</Alert> : null}
      {children}
    </div>
  );
}

// Danh sách ý kiến đã gửi của chính người dùng
export function MyFeedbackPage() {
  const feedback = useQuery({ queryKey: ['my-feedback'], queryFn: listMyFeedback });
  const grid = useGridSettings('my-feedback');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string>();
  const rows = (feedback.data ?? []).filter((row) => matches(row, search));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Danh sách ý kiến đã gửi</h1>
        <p className="text-label text-text-secondary">Gửi ý kiến mới bằng nút "Gửi phản hồi" ở chân trang.</p>
        {feedback.error ? <Alert tone="danger">{messageOf(feedback.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách ý kiến đã gửi"
          columns={baseColumns}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title}
          getRowAriaLabel={(row) => `Ý kiến ${row.title}`}
          loading={feedback.isPending}
          emptyText="Chưa gửi ý kiến nào."
          search={{ label: 'Tìm theo tiêu đề, nội dung', value: search, onChange: setSearch }}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Ẩn' : 'Chi tiết'}
            </Button>
          )}
          renderRowDetail={(row) => (openId === row.id ? <FeedbackDetail row={row} /> : null)}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

function HandleFeedbackForm({ row, onSaved }: { row: Feedback; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FeedbackStatus>(row.status);
  const [reply, setReply] = useState(row.reply ?? '');
  useEffect(() => {
    setStatus(row.status);
    setReply(row.reply ?? '');
  }, [row.status, row.reply]);
  const save = useMutation({
    mutationFn: () => updateFeedback(row.id, { status, reply }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feedback'] });
      onSaved('Đã ghi xử lý ý kiến');
    },
  });
  return (
    <form
      aria-label="Xử lý ý kiến"
      className="flex flex-col gap-3 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-[10rem_1fr] md:items-start">
        <label htmlFor={`trang-thai-${row.id}`} className="text-label font-medium text-text md:pt-2">
          Trạng thái
        </label>
        <select
          id={`trang-thai-${row.id}`}
          className={`${selectClass} md:max-w-xs`}
          value={status}
          onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
        >
          {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((value) => (
            <option key={value} value={value}>
              {FEEDBACK_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <label htmlFor={`tra-loi-${row.id}`} className="text-label font-medium text-text md:pt-2">
          Trả lời
        </label>
        <textarea
          id={`tra-loi-${row.id}`}
          rows={3}
          maxLength={5000}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
        />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
      </div>
    </form>
  );
}

// Ý kiến phản hồi của mọi người dùng, cho Quản trị nền tảng và Hiệu trưởng
export function FeedbackPage() {
  const canManage = useHasPermission(PERMISSION_CODES.feedbackManage);
  const [status, setStatus] = useState<FeedbackStatus | ''>('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType | ''>('');
  const feedback = useQuery({
    queryKey: ['feedback', status],
    queryFn: () => listAllFeedback(status),
    enabled: canManage,
  });
  const grid = useGridSettings('feedback');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const rows = (feedback.data ?? []).filter(
    (row) => matches(row, search) && (feedbackType === '' || row.feedback_type === feedbackType),
  );

  const columns: Array<DataGridColumn<Feedback>> = [
    baseColumns[0] as DataGridColumn<Feedback>,
    { id: 'user_name', header: 'Người gửi', cell: (row) => row.user_name },
    { id: 'org_unit', header: 'Đơn vị', cell: (row) => row.org_unit_name ?? '' },
    ...baseColumns.slice(1, 5),
    { id: 'replied_by_name', header: 'Người trả lời', hiddenByDefault: true, cell: (row) => row.replied_by_name ?? '' },
    { ...(baseColumns[5] as DataGridColumn<Feedback>), hiddenByDefault: true },
    { id: 'contact_phone', header: 'Số điện thoại', hiddenByDefault: true, cell: (row) => row.contact_phone ?? '' },
    { id: 'contact_email', header: 'Thư điện tử', hiddenByDefault: true, cell: (row) => row.contact_email ?? '' },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Ý kiến phản hồi</h1>
        {!canManage ? <Alert tone="warning">Bạn không có quyền xem ý kiến phản hồi.</Alert> : null}
        {feedback.error ? <Alert tone="danger">{messageOf(feedback.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {canManage ? (
          <DataGrid
            label="Danh sách ý kiến phản hồi"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.title}
            getRowAriaLabel={(row) => `Ý kiến ${row.title}`}
            loading={feedback.isPending}
            emptyText="Chưa có ý kiến phản hồi."
            search={{ label: 'Tìm theo tiêu đề, nội dung, người gửi', value: search, onChange: setSearch }}
            advancedSearch={
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="loc-trang-thai-y-kien" className="text-label font-medium text-text">
                    Trạng thái
                  </label>
                  <select
                    id="loc-trang-thai-y-kien"
                    className={selectClass}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as FeedbackStatus | '')}
                  >
                    <option value="">Tất cả</option>
                    {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((value) => (
                      <option key={value} value={value}>
                        {FEEDBACK_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="loc-loai-y-kien" className="text-label font-medium text-text">
                    Loại
                  </label>
                  <select
                    id="loc-loai-y-kien"
                    className={selectClass}
                    value={feedbackType}
                    onChange={(event) => setFeedbackType(event.target.value as FeedbackType | '')}
                  >
                    <option value="">Tất cả</option>
                    {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((value) => (
                      <option key={value} value={value}>
                        {FEEDBACK_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            }
            rowActions={(row) => (
              <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
                {openId === row.id ? 'Ẩn' : 'Xử lý'}
              </Button>
            )}
            renderRowDetail={(row) =>
              openId === row.id ? (
                <FeedbackDetail row={row}>
                  <HandleFeedbackForm row={row} onSaved={setToastMessage} />
                </FeedbackDetail>
              ) : null
            }
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
