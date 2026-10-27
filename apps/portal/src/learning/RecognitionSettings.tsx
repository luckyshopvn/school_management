import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279; GD-155): tắt mặc định, Ban Giám hiệu bật; mẫu chứng nhận của trường
// (tên chứng nhận, chức danh, họ tên người ký). Huy hiệu chỉ học sinh đó, phụ huynh, giáo viên thấy, không bảng xếp hạng; chứng
// nhận chỉ cho khoá tự chọn, có mã kiểm tra ở trang công khai của trường
interface RecognitionConfig {
  badges_enabled: boolean;
  certificates_enabled: boolean;
  certificate: { title: string; signer_title: string; signer_name: string };
}

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function RecognitionSettings({ onSaved }: { onSaved(message: string): void }) {
  const config = useQuery({
    queryKey: ['learning-recognition-config'],
    queryFn: () => requestJson<RecognitionConfig>('/api/v1/learning/recognition/config'),
    retry: false,
  });
  const [form, setForm] = useState<RecognitionConfig>();
  useEffect(() => {
    if (config.data) setForm(config.data);
  }, [config.data]);
  const save = useMutation({
    mutationFn: () =>
      requestJson<RecognitionConfig>('/api/v1/learning/recognition/config', {
        method: 'PUT',
        body: JSON.stringify(form),
      }),
    onSuccess: () => onSaved('Đã lưu cấu hình huy hiệu, chứng nhận'),
  });
  if (!form) {
    return null;
  }
  const field = (key: keyof RecognitionConfig['certificate'], label: string) => (
    <label className="text-label font-medium text-text">
      {label}
      <input
        aria-label={label}
        className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
        value={form.certificate[key]}
        onChange={(event) => setForm({ ...form, certificate: { ...form.certificate, [key]: event.target.value } })}
      />
    </label>
  );
  return (
    <section className="flex flex-col gap-3" aria-label="Huy hiệu và chứng nhận hoàn thành">
      <h2 className="text-section-title font-semibold text-text">Huy hiệu và chứng nhận hoàn thành</h2>
      <p className="text-content text-text-secondary">
        Huy hiệu chỉ học sinh đó, phụ huynh, giáo viên thấy; không có bảng xếp hạng. Chứng nhận chỉ cấp cho khoá tự chọn
        đã hoàn thành.
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <label className="flex items-center gap-2 text-content text-text">
        <input
          type="checkbox"
          checked={form.badges_enabled}
          onChange={(event) => setForm({ ...form, badges_enabled: event.target.checked })}
        />
        Bật huy hiệu
      </label>
      <label className="flex items-center gap-2 text-content text-text">
        <input
          type="checkbox"
          checked={form.certificates_enabled}
          onChange={(event) => setForm({ ...form, certificates_enabled: event.target.checked })}
        />
        Bật chứng nhận hoàn thành khoá tự chọn
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        {field('title', 'Tên chứng nhận')}
        {field('signer_title', 'Chức danh người ký')}
        {field('signer_name', 'Họ tên người ký')}
      </div>
      <div>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu cấu hình huy hiệu, chứng nhận
        </Button>
      </div>
    </section>
  );
}
