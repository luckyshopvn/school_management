import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { requestStudentJson, StudentApiError } from './student-api.js';

// Trình phát gói SCORM của học sinh (DT-28 phần 28h, YCTD-278): gói chạy trong khung `sandbox="allow-scripts"` (không có
// `allow-same-origin`, nên ở nguồn gốc riêng, không đọc được phiên, cookie, dữ liệu của ứng dụng); tệp của gói có CSP chỉ cho nạp
// từ chính gói. Bộ chuyển API trong khung gửi giá trị lên trang này bằng `postMessage`; trang chỉ nhận tin từ đúng khung đang mở
// (kiểm `source`, nguồn gốc `null` hoặc nguồn gốc nội dung riêng) rồi gửi lên máy chủ khi gói lưu, kết thúc, hoặc mỗi 30 giây.
// Gói nhiều SCO (SCORM 2004) chạy lần lượt, không làm trình tự và điều hướng (GD-153)
interface ScoView {
  identifier: string;
  title: string;
  url: string;
  completion: string;
  success: string;
  score: number | null;
}

interface Launch {
  standard: '1.2' | '2004';
  title: string;
  content_origin: string | null;
  scos: ScoView[];
}

interface CommitResult {
  status: string;
  score: number | null;
  scos: Array<{ identifier: string; completion: string; success: string; score: number | null }>;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa làm',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  passed: 'Đạt',
  failed: 'Chưa đạt',
};

const messageOf = (error: unknown) =>
  error instanceof StudentApiError ? error.message : 'Không kết nối được tới máy chủ';
const isDone = (sco: { completion: string; success: string }) =>
  sco.completion === 'completed' || sco.success === 'passed' || sco.success === 'failed';

export function ScormPlayer({ activityId, title, onClose }: { activityId: string; title: string; onClose(): void }) {
  const [launch, setLaunch] = useState<Launch>();
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<CommitResult>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<Record<string, string>>({});

  useEffect(() => {
    requestStudentJson<Launch>(`/api/v1/student/scorm/activities/${activityId}/launch`, { method: 'POST', body: '{}' })
      .then((loaded) => {
        setLaunch(loaded);
        const next = loaded.scos.findIndex((sco) => !isDone(sco));
        setIndex(next < 0 ? 0 : next);
      })
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [activityId]);

  const sco = launch?.scos[index];

  const commit = useCallback(
    async (finished: boolean) => {
      if (!sco || (Object.keys(pending.current).length === 0 && !finished)) return;
      const values = pending.current;
      pending.current = {};
      try {
        const saved = await requestStudentJson<CommitResult>(`/api/v1/student/scorm/activities/${activityId}/commit`, {
          method: 'POST',
          body: JSON.stringify({ sco: sco.identifier, values, finished }),
        });
        setResult(saved);
      } catch (error) {
        pending.current = { ...values, ...pending.current };
        setErrorMessage(messageOf(error));
      }
    },
    [activityId, sco],
  );

  useEffect(() => {
    if (!launch || !sco) return;
    const expectedOrigin = launch.content_origin ?? 'null';
    const listener = (event: MessageEvent) => {
      const data = event.data as {
        source?: string;
        type?: string;
        sco?: string;
        values?: Record<string, unknown>;
      } | null;
      if (event.source !== frame.current?.contentWindow || event.origin !== expectedOrigin) return;
      if (!data || data.source !== 'school-management-scorm' || data.sco !== sco.identifier) return;
      for (const [key, value] of Object.entries(data.values ?? {})) {
        if (typeof key === 'string' && key.startsWith('cmi.') && key.length <= 200 && typeof value === 'string') {
          pending.current[key] = value.slice(0, 64_000);
        }
      }
      if (data.type === 'commit') void commit(false);
      if (data.type === 'finish') void commit(true);
    };
    window.addEventListener('message', listener);
    const timer = window.setInterval(() => void commit(false), 30_000);
    return () => {
      window.removeEventListener('message', listener);
      window.clearInterval(timer);
      void commit(false);
    };
  }, [launch, sco, commit]);

  const scoState = (identifier: string) =>
    result?.scos.find((item) => item.identifier === identifier) ??
    launch?.scos.find((item) => item.identifier === identifier);

  return (
    <section
      aria-label={`Bài giảng ${title}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-body font-semibold text-text">{launch?.title ?? title}</h3>
        {result ? <StatusBadge tone="info" label={STATUS_LABELS[result.status] ?? result.status} /> : null}
        {result?.score !== null && result?.score !== undefined ? (
          <span className="text-label text-text-secondary">Điểm {result.score}</span>
        ) : null}
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {launch && launch.scos.length > 1 ? (
        <ol className="flex flex-wrap gap-2 text-label" aria-label="Các phần của bài giảng">
          {launch.scos.map((item, at) => (
            <li key={item.identifier}>
              <Button
                variant={at === index ? 'primary' : 'secondary'}
                onClick={() => {
                  void commit(false);
                  setIndex(at);
                }}
              >
                {at + 1}. {item.title}
                {isDone(scoState(item.identifier) ?? item) ? ' (xong)' : ''}
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
      {sco ? (
        <iframe
          ref={frame}
          key={sco.identifier}
          title={`Nội dung ${sco.title}`}
          src={sco.url}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="h-[70vh] w-full rounded-lg border border-border bg-white"
        />
      ) : null}
      <p className="text-label text-text-secondary">
        Bài giảng chạy trong khung riêng, không đọc được tài khoản của em. Bài tự lưu khi em làm.
      </p>
      <div className="flex gap-2">
        {launch && index < launch.scos.length - 1 ? (
          <Button
            variant="secondary"
            onClick={() => {
              void commit(false);
              setIndex(index + 1);
            }}
          >
            Phần tiếp theo
          </Button>
        ) : null}
        <Button
          onClick={() => {
            void commit(false).finally(onClose);
          }}
        >
          Đóng bài giảng
        </Button>
      </div>
    </section>
  );
}
