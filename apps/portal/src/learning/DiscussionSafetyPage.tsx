import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';

// 9.5 An toàn thảo luận (DT-28 phần 28e, YCTD-275): hàng chờ báo cáo vi phạm ở thảo luận, hỏi đáp, không gian học nhóm (học sinh,
// giáo viên báo cáo; bộ lọc từ ngữ tự gửi), có hạn xử lý; người xử lý ghi kết quả, ẩn nội dung (vẫn lưu), tạm khóa quyền viết của
// học sinh. Ban Giám hiệu xem mọi báo cáo và cấu hình giờ mở thảo luận (GD-144: trường tự đặt, chưa đặt là không giới hạn), danh
// sách từ ngữ lọc; chủ nhiệm xem báo cáo của lớp mình
interface Report {
  id: string;
  source: 'report' | 'filter';
  reason: string;
  reporter_kind: string | null;
  status: string;
  due_at: string;
  overdue: boolean;
  thread_title: string;
  thread_body: string;
  thread_author: string;
  post_body: string | null;
  post_author: string | null;
}

interface Config {
  open_hours: { school_days: { from: string; to: string } | null; weekend: { from: string; to: string } | null } | null;
  blocked_words: string[];
}

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function ReportCard({ report, onDone }: { report: Report; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState('');
  const [hide, setHide] = useState(true);
  const [banDays, setBanDays] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const resolve = useMutation({
    mutationFn: (status: 'resolved' | 'dismissed') =>
      requestJson(`/api/v1/learning/discussion-reports/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          resolution,
          hide: status === 'resolved' && hide,
          ban_days: status === 'resolved' && banDays ? Number(banDays) : null,
        }),
      }),
    onSuccess: async (_, status) => {
      await queryClient.invalidateQueries({ queryKey: ['discussion-reports'] });
      onDone(status === 'resolved' ? 'Đã xử lý báo cáo' : 'Đã bỏ qua báo cáo');
    },
    onError: (error) => setErrorMessage(messageOf(error)),
  });
  return (
    <li
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
      aria-label={`Báo cáo ${report.thread_title}`}
    >
      <span className="flex flex-wrap items-center gap-2 text-content font-semibold">
        {report.thread_title}
        <StatusBadge
          tone={report.source === 'filter' ? 'warning' : 'info'}
          label={report.source === 'filter' ? 'Bộ lọc' : 'Báo cáo'}
        />
        {report.overdue ? <StatusBadge tone="danger" label="Quá hạn xử lý" /> : null}
      </span>
      <span className="text-label text-text-secondary">
        Lý do: {report.reason} · hạn {new Date(report.due_at).toLocaleString('vi-VN')}
      </span>
      <p className="whitespace-pre-wrap text-label text-text">
        {report.post_body
          ? `${report.post_author}: ${report.post_body}`
          : `${report.thread_author}: ${report.thread_body}`}
      </p>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <label className="text-label font-medium text-text">
        Ghi chú xử lý
        <input
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-label text-text">
        <input type="checkbox" checked={hide} onChange={(event) => setHide(event.target.checked)} />
        Ẩn nội dung bị báo cáo (vẫn lưu)
      </label>
      <label className="text-label font-medium text-text">
        Tạm khóa quyền viết của học sinh (ngày, bỏ trống là không khóa)
        <input
          type="number"
          min={1}
          max={30}
          className={`mt-2 block w-full max-w-xs ${FORM_CONTROL_CLASS}`}
          value={banDays}
          onChange={(event) => setBanDays(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!resolution.trim() || resolve.isPending}
          onClick={() => resolve.mutate('resolved')}
        >
          Đã xử lý
        </Button>
        <Button
          variant="secondary"
          disabled={!resolution.trim() || resolve.isPending}
          onClick={() => resolve.mutate('dismissed')}
        >
          Bỏ qua
        </Button>
      </div>
    </li>
  );
}

function ConfigForm({ onSaved }: { onSaved(message: string): void }) {
  const config = useQuery({
    queryKey: ['discussion-config'],
    queryFn: () => requestJson<Config>('/api/v1/learning/discussion-config'),
  });
  const [schoolFrom, setSchoolFrom] = useState('');
  const [schoolTo, setSchoolTo] = useState('');
  const [weekendFrom, setWeekendFrom] = useState('');
  const [weekendTo, setWeekendTo] = useState('');
  const [words, setWords] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    if (!config.data) return;
    setSchoolFrom(config.data.open_hours?.school_days?.from ?? '');
    setSchoolTo(config.data.open_hours?.school_days?.to ?? '');
    setWeekendFrom(config.data.open_hours?.weekend?.from ?? '');
    setWeekendTo(config.data.open_hours?.weekend?.to ?? '');
    setWords(config.data.blocked_words.join('\n'));
  }, [config.data]);
  const save = useMutation({
    mutationFn: () => {
      const window = (from: string, to: string) => (from && to ? { from, to } : null);
      const hours = { school_days: window(schoolFrom, schoolTo), weekend: window(weekendFrom, weekendTo) };
      return requestJson('/api/v1/learning/discussion-config', {
        method: 'PUT',
        body: JSON.stringify({
          open_hours: hours.school_days || hours.weekend ? hours : null,
          blocked_words: words
            .split('\n')
            .map((word) => word.trim())
            .filter(Boolean),
        }),
      });
    },
    onSuccess: () => onSaved('Đã lưu cấu hình thảo luận'),
    onError: (error) => setErrorMessage(messageOf(error)),
  });
  if (config.error) return <Alert tone="info">{messageOf(config.error)}</Alert>;
  return (
    <section aria-label="Cấu hình thảo luận" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Giờ mở thảo luận và từ ngữ lọc</h2>
      <p className="text-label text-text-secondary">
        Giờ mở áp dụng chung cho thảo luận và phòng nhóm video. Mặc định không giới hạn: chưa đặt giờ là học sinh viết
        và tự mở phòng nhóm được cả ngày. Ngoài giờ mở học sinh chỉ đọc, chỉ vào được phòng giáo viên mở; giáo viên vẫn
        viết được.
      </p>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        {(
          [
            ['Ngày học từ', schoolFrom, setSchoolFrom],
            ['Ngày học đến', schoolTo, setSchoolTo],
            ['Cuối tuần từ', weekendFrom, setWeekendFrom],
            ['Cuối tuần đến', weekendTo, setWeekendTo],
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="text-label font-medium text-text">
            {label}
            <input
              type="time"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={value}
              onChange={(event) => setter(event.target.value)}
            />
          </label>
        ))}
      </div>
      <label className="text-label font-medium text-text">
        Từ ngữ bị che và gắn cờ (mỗi dòng một từ)
        <textarea
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          rows={4}
          value={words}
          onChange={(event) => setWords(event.target.value)}
        />
      </label>
      <div>
        <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
          Lưu cấu hình
        </Button>
      </div>
    </section>
  );
}

export function DiscussionSafetyPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const [closed, setClosed] = useState(false);
  const reports = useQuery({
    queryKey: ['discussion-reports', closed],
    queryFn: () => requestJson<Report[]>(`/api/v1/learning/discussion-reports${closed ? '?status=closed' : ''}`),
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={() => setToastMessage(undefined)} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-discussion-safety')}</h1>
        <p className="text-content text-text-secondary">
          Giáo viên của lớp và người lập bộ nhóm luôn thấy mọi nội dung; không có tin nhắn riêng giữa hai học sinh; chữ
          học sinh viết được che số điện thoại, thư điện tử, liên kết ngoài, tài khoản mạng xã hội.
        </p>
        <h2 className="text-section-title font-semibold text-text">Hàng chờ báo cáo vi phạm</h2>
        <label className="flex items-center gap-2 text-label text-text">
          <input type="checkbox" checked={closed} onChange={(event) => setClosed(event.target.checked)} />
          Xem báo cáo đã xử lý
        </label>
        {reports.error ? <Alert tone="danger">{messageOf(reports.error)}</Alert> : null}
        <ul className="flex flex-col gap-3" aria-label="Báo cáo vi phạm">
          {(reports.data ?? []).map((report) =>
            closed ? (
              <li key={report.id} className="rounded-lg border border-border p-3 text-label">
                {report.thread_title}: {report.reason}
              </li>
            ) : (
              <ReportCard key={report.id} report={report} onDone={setToastMessage} />
            ),
          )}
        </ul>
        {reports.data && reports.data.length === 0 ? (
          <p className="text-content text-text-secondary">Không có báo cáo nào.</p>
        ) : null}
        <ConfigForm onSaved={setToastMessage} />
      </div>
    </AppShell>
  );
}
