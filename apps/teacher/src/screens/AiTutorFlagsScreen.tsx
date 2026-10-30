import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MH-601 Gia sư AI: cờ cần xử lý (YCTD-383 lát L3). Giáo viên chủ nhiệm thấy cờ tự hại, bị bắt nạt của em đang học lớp mình: học sinh,
// lớp, loại dấu hiệu, thời điểm, đoạn trích ngắn của câu em gửi; không có toàn bộ hội thoại. Đánh dấu "đã xử lý" sau khi đã gặp em
export interface AiTutorFlag {
  id: string;
  child_name: string;
  class_name: string | null;
  kind: 'self_harm' | 'bullying';
  kind_label: string;
  created_at: string;
  excerpt: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

export interface AiTutorFlagList {
  pending_count: number;
  flags: AiTutorFlag[];
}

export const AI_TUTOR_FLAGS_PATH = '/api/v1/ai-tutor/safety-flags';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(value),
  );
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');

export function AiTutorFlagsScreen({ onBack }: { onBack(): void }) {
  const [data, setData] = useState<AiTutorFlagList>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const load = useCallback(() => {
    requestJson<AiTutorFlagList>(AI_TUTOR_FLAGS_PATH)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, []);
  useEffect(load, [load]);

  const resolve = async (flag: AiTutorFlag) => {
    setBusyId(flag.id);
    setErrorMessage(undefined);
    try {
      await requestJson(`${AI_TUTOR_FLAGS_PATH}/${flag.id}/resolve`, { method: 'POST', body: '{}' });
      setNotice(`Đã đánh dấu đã xử lý cờ của ${flag.child_name}`);
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Gia sư AI: cờ cần xử lý" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        <p className="text-content text-text-secondary">
          Câu em gửi Gia sư AI có dấu hiệu tự hại hoặc bị bắt nạt. Thầy cô gặp riêng em, phối hợp cha mẹ và nhà trường
          khi cần, rồi đánh dấu đã xử lý. Thầy cô chỉ thấy đoạn trích của câu em gửi, không thấy toàn bộ hội thoại.
        </p>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {data && data.flags.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có cờ nào của lớp thầy cô chủ nhiệm.</p>
        ) : null}
        <ul className="flex flex-col gap-2" aria-label="Cờ cần xử lý">
          {(data?.flags ?? []).map((flag) => (
            <li key={flag.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-content font-semibold">
                  {flag.child_name}
                  {flag.class_name ? (
                    <span className="ml-2 text-label text-text-secondary">Lớp {flag.class_name}</span>
                  ) : null}
                </span>
                <StatusBadge tone={flag.resolved ? 'neutral' : 'danger'} label={flag.kind_label} />
              </div>
              <p className="text-label text-text-secondary">{formatTime(flag.created_at)}</p>
              <blockquote className="border-l-4 border-border pl-3 text-content">{flag.excerpt}</blockquote>
              {flag.resolved ? (
                <p className="text-label text-text-secondary">
                  Đã xử lý{flag.resolved_by_name ? ` bởi ${flag.resolved_by_name}` : ''}
                  {flag.resolved_at ? ` lúc ${formatTime(flag.resolved_at)}` : ''}
                </p>
              ) : (
                <div>
                  <Button
                    variant="primary"
                    disabled={busyId === flag.id}
                    aria-label={`Đánh dấu đã xử lý cờ của ${flag.child_name}`}
                    onClick={() => void resolve(flag)}
                  >
                    Đã xử lý
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
