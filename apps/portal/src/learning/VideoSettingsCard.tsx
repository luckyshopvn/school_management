import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Cấu hình lớp video của trường (DT-27 phần 27a, YCTD-251): số người dự tối đa một phòng (GD-130); phút đã dùng theo gói.
// Dùng chung cho giờ học trực tuyến (DT-28 phần 28g). Chuyển về đây từ trang quy định dạy thêm khi gỡ gia sư trong trường (YCTD-393
// lát L2); chỉ Ban Giám hiệu sửa
interface VideoSettings {
  max_participants: number;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function VideoSettingsCard({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['video-status'],
    queryFn: () => requestJson<{ enabled: boolean; provider: string | null }>('/api/v1/video/status'),
  });
  const settings = useQuery({
    queryKey: ['video-settings'],
    queryFn: () => requestJson<VideoSettings>('/api/v1/video/settings'),
  });
  const usage = useQuery({
    queryKey: ['video-usage'],
    queryFn: () => requestJson<{ minutes_used: number; minutes_limit: number | null }>('/api/v1/video/usage'),
  });
  const [maxParticipants, setMaxParticipants] = useState('8');
  useEffect(() => {
    if (settings.data) {
      setMaxParticipants(String(settings.data.max_participants));
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      requestJson<VideoSettings>('/api/v1/video/settings', json('PUT', { max_participants: Number(maxParticipants) })),
    onSuccess: async () => {
      onSaved('Đã ghi cấu hình lớp video');
      await queryClient.invalidateQueries({ queryKey: ['video-settings'] });
    },
  });
  return (
    <section aria-label="Cấu hình lớp video" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-section-title font-semibold">Lớp video trực tiếp</h2>
      {status.data && !status.data.enabled ? (
        <Alert tone="warning">Máy chủ chưa bật lớp video (nhà vận hành đặt VIDEO_PROVIDER).</Alert>
      ) : null}
      {usage.data ? (
        <p className="text-label text-text-secondary">
          Tháng này đã dùng {usage.data.minutes_used} phút người dự
          {usage.data.minutes_limit !== null ? ` trên ${usage.data.minutes_limit} phút của gói` : ''}.
        </p>
      ) : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <label className="flex flex-col text-label">
        Số người dự tối đa một phòng (cả giáo viên)
        <input
          type="number"
          min={2}
          max={50}
          className={FORM_CONTROL_CLASS}
          value={maxParticipants}
          onChange={(event) => setMaxParticipants(event.target.value)}
        />
      </label>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        Ghi cấu hình lớp video
      </Button>
    </section>
  );
}
