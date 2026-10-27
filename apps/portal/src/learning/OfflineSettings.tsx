import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Học khi mạng yếu (DT-28 phần 28j, YCTD-280; GD-148 đã chốt 2026-10-27): tắt mặc định; Ban Giám hiệu bật để màn hình học tập của học
// sinh giữ bản nháp, ảnh, ghi âm chờ gửi, nội dung đã mở của chính em trên máy (tối đa 7 ngày, xoá khi nộp, đăng xuất)
interface OfflineConfig {
  enabled: boolean;
  retention_days: number;
}

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function OfflineSettings({ onSaved }: { onSaved(message: string): void }) {
  const config = useQuery({
    queryKey: ['learning-offline-config'],
    queryFn: () => requestJson<OfflineConfig>('/api/v1/learning/offline/config'),
    retry: false,
  });
  const [form, setForm] = useState<OfflineConfig>();
  useEffect(() => {
    if (config.data) setForm(config.data);
  }, [config.data]);
  const save = useMutation({
    mutationFn: () =>
      requestJson<OfflineConfig>('/api/v1/learning/offline/config', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => onSaved('Đã lưu cấu hình học khi mạng yếu'),
  });
  if (!form) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Học khi mạng yếu">
      <h2 className="text-section-title font-semibold text-text">Học khi mạng yếu</h2>
      <p className="text-content text-text-secondary">
        Khi bật, máy của học sinh giữ bản nháp, ảnh, ghi âm chờ gửi và nội dung đã mở của chính em (không giữ video, gói
        SCORM), tự gửi khi có mạng; dữ liệu được mã hoá trên máy, xoá khi nộp xong, khi đăng xuất hoặc quá số ngày dưới
        đây.
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <label className="flex items-center gap-2 text-content text-text">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
        />
        Bật học khi mạng yếu
      </label>
      <label className="text-label font-medium text-text">
        Số ngày giữ trên máy (1 đến 7)
        <input
          type="number"
          min={1}
          max={7}
          aria-label="Số ngày giữ trên máy"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={form.retention_days}
          onChange={(event) => setForm({ ...form, retention_days: Number(event.target.value) })}
        />
      </label>
      <div>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu cấu hình học khi mạng yếu
        </Button>
      </div>
    </section>
  );
}
