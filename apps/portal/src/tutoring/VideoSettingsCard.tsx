import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { messageOf } from './TutoringProgramsPage.js';
import { videoApi } from './video-api.js';

// Cấu hình lớp video của trường (DT-27 phần 27a, YCTD-251): số người dự tối đa một phòng (GD-130), thời hạn giữ bản ghi (GD-132), phòng
// chờ; phút đã dùng và dung lượng bản ghi theo gói. Ban Giám hiệu sửa, giáo viên xem
export function VideoSettingsCard({ notify }: { notify: (text: string) => void }) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['video-status'], queryFn: videoApi.status });
  const settings = useQuery({ queryKey: ['video-settings'], queryFn: videoApi.settings });
  const usage = useQuery({ queryKey: ['video-usage'], queryFn: videoApi.usage });
  const [form, setForm] = useState({ max_participants: '8', recording_retention_days: '30', lobby_enabled: true });
  useEffect(() => {
    if (settings.data) {
      setForm({
        max_participants: String(settings.data.max_participants),
        recording_retention_days: String(settings.data.recording_retention_days),
        lobby_enabled: settings.data.lobby_enabled,
      });
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      videoApi.saveSettings({
        max_participants: Number(form.max_participants),
        recording_retention_days: Number(form.recording_retention_days),
        lobby_enabled: form.lobby_enabled,
      }),
    onSuccess: async () => {
      notify('Đã ghi cấu hình lớp video');
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
          {usage.data.minutes_limit !== null ? ` trên ${usage.data.minutes_limit} phút của gói` : ''}; bản ghi đang giữ{' '}
          {usage.data.recording_mb_used} MB
          {usage.data.recording_mb_limit !== null ? ` trên ${usage.data.recording_mb_limit} MB` : ''}.
        </p>
      ) : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <label className="flex flex-col text-label">
        Số người dự tối đa một phòng (cả gia sư)
        <input
          type="number"
          min={2}
          max={50}
          className={FORM_CONTROL_CLASS}
          value={form.max_participants}
          onChange={(event) => setForm({ ...form, max_participants: event.target.value })}
        />
      </label>
      <label className="flex flex-col text-label">
        Thời hạn giữ bản ghi (ngày)
        <input
          type="number"
          min={7}
          max={365}
          className={FORM_CONTROL_CLASS}
          value={form.recording_retention_days}
          onChange={(event) => setForm({ ...form, recording_retention_days: event.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.lobby_enabled}
          onChange={(event) => setForm({ ...form, lobby_enabled: event.target.checked })}
        />
        Phòng chờ: học sinh, cha mẹ đợi gia sư cho vào
      </label>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        Ghi cấu hình lớp video
      </Button>
    </section>
  );
}
