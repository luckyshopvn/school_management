import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField, type StatusTone } from '@school-management/ui';
import { saveResponseFile } from '../exports/export-api.js';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Thành phần "Gửi lên cấp trên" chạy nội bộ (DT-16 phần 16a, khảo sát mục 2.3 của Sở): danh sách biểu mẫu kèm Hoàn thành dữ
// liệu, Trạng thái, Ngày gửi; nút Xuất tệp gửi (lưu tệp và bản chụp số liệu), Đánh dấu đã gửi (ngày, người), Gửi yêu cầu mở
// khóa, và cho người có quyền mở khóa: Mở khóa, Từ chối, Đặt trạng thái gửi lại. Chưa có kết nối với hệ thống của Bộ, Sở nên
// không có nút "Gửi" truyền đi: nộp tệp bằng tay rồi đánh dấu đã gửi (quyết định của Eric ngày 2026-10-16)
export type SubmissionStatus = 'draft' | 'sent' | 'unlock_requested' | 'resend';

export interface Submission {
  form_code: string;
  form_name: string;
  completeness: Array<{ label: string; done: boolean }>;
  data_complete: boolean;
  status: SubmissionStatus;
  no_data: boolean;
  allow_no_data: boolean;
  exported_at: string | null;
  exported_by_name: string | null;
  exported_data_complete: boolean | null;
  file_name: string | null;
  sent_on: string | null;
  sent_by_name: string | null;
  sent_note: string | null;
  unlock_reason: string | null;
  unlock_requested_by_name: string | null;
  unlock_requested_at: string | null;
  can_manage: boolean;
  can_unlock: boolean;
}

const STATUS: Record<SubmissionStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Chưa gửi', tone: 'neutral' },
  sent: { label: 'Đã gửi', tone: 'success' },
  unlock_requested: { label: 'Đã gửi yêu cầu mở khóa', tone: 'warning' },
  resend: { label: 'Cần gửi lại', tone: 'info' },
};

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return [error.message, ...error.details.map((detail) => detail.message)].join('. ');
  }
  return 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const post = (formCode: string, action: string, body?: unknown) =>
  requestJson<Submission>(`/api/v1/upper-level-submissions/${formCode}/${action}`, {
    method: 'POST',
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });

async function downloadSubmissionFile(submission: Submission): Promise<void> {
  const response = await fetchWithSession(`/api/v1/upper-level-submissions/${submission.form_code}/file`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', submission.file_name ?? 'tep-gui');
}

type DialogKind = 'mark-sent' | 'unlock-request' | 'unlock' | 'resend';

function SubmissionRow({ submission, onChanged }: { submission: Submission; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogKind>();
  const [sentOn, setSentOn] = useState(() => VIETNAM_DATE.format(new Date()));
  const [note, setNote] = useState('');
  const [noData, setNoData] = useState(false);
  const [error, setError] = useState<string>();
  const locked = submission.status === 'sent' || submission.status === 'unlock_requested';
  const action = useMutation({
    mutationFn: (input: { kind: 'export' | DialogKind | 'reject'; message: string }) => {
      if (input.kind === 'export') {
        return post(submission.form_code, 'export');
      }
      if (input.kind === 'mark-sent') {
        return post(submission.form_code, 'mark-sent', { sent_on: sentOn, note: note || null, no_data: noData });
      }
      if (input.kind === 'unlock-request') {
        return post(submission.form_code, 'unlock-request', { reason: note });
      }
      if (input.kind === 'resend') {
        return post(submission.form_code, 'resend', { note: note || null });
      }
      return post(submission.form_code, 'unlock', { approve: input.kind === 'unlock', note: note || null });
    },
    onSuccess: async (_result, input) => {
      setDialog(undefined);
      setNote('');
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['upper-level-submissions'] });
      onChanged(input.message);
    },
    onError: (reason) => setError(messageOf(reason)),
  });
  const open = (kind: DialogKind) => {
    setNote('');
    setError(undefined);
    setDialog(kind);
  };

  return (
    <tr className="border-t border-border align-top" aria-label={`Biểu mẫu ${submission.form_name}`}>
      <td className="px-3 py-2 font-medium">{submission.form_name}</td>
      <td className="px-3 py-2">
        <StatusBadge
          tone={submission.data_complete ? 'success' : 'warning'}
          label={submission.data_complete ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
        />
        <ul className="mt-1 text-label text-text-secondary">
          {submission.completeness.map((item) => (
            <li key={item.label}>
              {item.done ? '✓' : '✗'} {item.label}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-3 py-2">
        <StatusBadge tone={STATUS[submission.status].tone} label={STATUS[submission.status].label} />
        {submission.unlock_reason ? (
          <p className="mt-1 text-label text-text-secondary">
            Lý do mở khóa: {submission.unlock_reason} ({submission.unlock_requested_by_name})
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        {submission.sent_on ? (
          <>
            {formatDate(submission.sent_on)}
            <p className="text-label text-text-secondary">
              {submission.sent_by_name}
              {submission.no_data ? ', trường không có dữ liệu' : ''}
            </p>
          </>
        ) : (
          ''
        )}
      </td>
      <td className="px-3 py-2">
        {submission.file_name ? (
          <>
            <Button
              variant="text"
              className="px-0 py-0"
              onClick={() => downloadSubmissionFile(submission).catch((reason: unknown) => setError(messageOf(reason)))}
            >
              {submission.file_name}
            </Button>
            <p className="text-label text-text-secondary">
              {submission.exported_at ? DATE_TIME.format(new Date(submission.exported_at)) : ''}, {submission.exported_by_name}
            </p>
          </>
        ) : (
          <span className="text-text-secondary">Chưa xuất</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-start gap-1">
          {submission.can_manage && !locked ? (
            <>
              <Button
                disabled={action.isPending}
                onClick={() => action.mutate({ kind: 'export', message: `Đã xuất tệp gửi ${submission.form_name}` })}
              >
                Xuất tệp gửi
              </Button>
              <Button disabled={action.isPending} onClick={() => open('mark-sent')}>
                Đánh dấu đã gửi
              </Button>
            </>
          ) : null}
          {submission.can_manage && submission.status === 'sent' ? (
            <Button disabled={action.isPending} onClick={() => open('unlock-request')}>
              Gửi yêu cầu mở khóa
            </Button>
          ) : null}
          {submission.can_unlock && submission.status === 'unlock_requested' ? (
            <Button disabled={action.isPending} onClick={() => open('unlock')}>
              Xử lý yêu cầu mở khóa
            </Button>
          ) : null}
          {submission.can_unlock && locked ? (
            <Button disabled={action.isPending} onClick={() => open('resend')}>
              Đặt trạng thái gửi lại
            </Button>
          ) : null}
        </div>
        {error && !dialog ? (
          <p role="alert" className="mt-1 text-label text-danger">
            {error}
          </p>
        ) : null}
        {dialog === 'mark-sent' ? (
          <ConfirmDialog
            open
            title={`Đánh dấu đã gửi: ${submission.form_name}`}
            confirmLabel="Đánh dấu đã gửi"
            busy={action.isPending}
            onCancel={() => setDialog(undefined)}
            onConfirm={() => action.mutate({ kind: 'mark-sent', message: `Đã đánh dấu đã gửi ${submission.form_name}` })}
          >
            <div className="flex flex-col gap-3">
              <p className="text-label text-text-secondary">
                Hệ thống chưa kết nối với Bộ, Sở nên không tự gửi đi. Nộp tệp gửi cho cấp trên theo cách của đơn vị rồi ghi
                ngày đã gửi ở đây; biểu mẫu sẽ khóa cho đến khi được mở khóa.
              </p>
              <TextField label="Ngày gửi" type="date" value={sentOn} onChange={(event) => setSentOn(event.target.value)} />
              <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
              {submission.allow_no_data ? (
                <label className="flex items-center gap-2 text-content">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={noData}
                    onChange={(event) => setNoData(event.target.checked)}
                  />
                  Trường không có dữ liệu
                </label>
              ) : null}
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </div>
          </ConfirmDialog>
        ) : null}
        {dialog === 'unlock-request' ? (
          <ConfirmDialog
            open
            title={`Gửi yêu cầu mở khóa: ${submission.form_name}`}
            confirmLabel="Gửi yêu cầu"
            busy={action.isPending}
            onCancel={() => setDialog(undefined)}
            onConfirm={() =>
              action.mutate({ kind: 'unlock-request', message: `Đã gửi yêu cầu mở khóa ${submission.form_name}` })
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-label text-text-secondary">
                Yêu cầu ghi trong hệ thống để người có quyền mở khóa của đơn vị xử lý.
              </p>
              <TextField label="Lý do mở khóa" value={note} onChange={(event) => setNote(event.target.value)} />
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </div>
          </ConfirmDialog>
        ) : null}
        {dialog === 'unlock' ? (
          <ConfirmDialog
            open
            title={`Xử lý yêu cầu mở khóa: ${submission.form_name}`}
            confirmLabel="Mở khóa"
            busy={action.isPending}
            onCancel={() => setDialog(undefined)}
            onConfirm={() => action.mutate({ kind: 'unlock', message: `Đã mở khóa ${submission.form_name}` })}
          >
            <div className="flex flex-col gap-3">
              <p className="text-content">Lý do: {submission.unlock_reason}</p>
              <TextField label="Ghi chú xử lý" value={note} onChange={(event) => setNote(event.target.value)} />
              <div>
                <Button
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({ kind: 'reject', message: `Đã từ chối mở khóa ${submission.form_name}` })
                  }
                >
                  Từ chối mở khóa
                </Button>
              </div>
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </div>
          </ConfirmDialog>
        ) : null}
        {dialog === 'resend' ? (
          <ConfirmDialog
            open
            title={`Đặt trạng thái gửi lại: ${submission.form_name}`}
            confirmLabel="Đặt trạng thái gửi lại"
            busy={action.isPending}
            onCancel={() => setDialog(undefined)}
            onConfirm={() =>
              action.mutate({ kind: 'resend', message: `Đã đặt trạng thái gửi lại ${submission.form_name}` })
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-label text-text-secondary">
                Biểu mẫu mở khóa, chuyển "Cần gửi lại" để xuất tệp gửi và đánh dấu đã gửi lần nữa.
              </p>
              <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </div>
          </ConfirmDialog>
        ) : null}
      </td>
    </tr>
  );
}

// Màn hình của biểu mẫu truyền mã các biểu mẫu cần hiện; máy chủ kiểm tra quyền theo từng biểu mẫu
export function UpperLevelSubmissionPanel({
  formCodes,
  onChanged,
}: {
  formCodes: string[];
  onChanged(message: string): void;
}) {
  const submissions = useQuery({
    queryKey: ['upper-level-submissions', formCodes],
    queryFn: async () =>
      (
        await requestJson<{ items: Submission[] }>(
          `/api/v1/upper-level-submissions?forms=${encodeURIComponent(formCodes.join(','))}`,
        )
      ).items,
  });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Gửi lên cấp trên">
      <h2 className="text-section-title font-semibold text-text">Gửi lên cấp trên</h2>
      <p className="text-label text-text-secondary">
        Chưa kết nối với hệ thống của Bộ, Sở: bấm "Xuất tệp gửi" để lập tệp và lưu số liệu tại thời điểm xuất, nộp tệp cho
        cấp trên, rồi "Đánh dấu đã gửi".
      </p>
      {submissions.error ? <Alert tone="danger">{messageOf(submissions.error)}</Alert> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-content">
          <caption className="sr-only">Biểu mẫu gửi lên cấp trên</caption>
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Biểu mẫu</th>
              <th className="px-3 py-2">Hoàn thành dữ liệu</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Ngày gửi</th>
              <th className="px-3 py-2">Tệp gửi</th>
              <th className="px-3 py-2">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(submissions.data ?? []).map((submission) => (
              <SubmissionRow key={submission.form_code} submission={submission} onChanged={onChanged} />
            ))}
            {submissions.isPending ? (
              <tr className="border-t border-border">
                <td colSpan={6} className="px-3 py-3 text-text-secondary">
                  Đang tải…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
