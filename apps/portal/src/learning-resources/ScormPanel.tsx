import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Gói bài giảng SCORM của học liệu (DT-28 phần 28h, YCTD-278): người soạn tải gói zip (máy chủ kiểm bản kê imsmanifest.xml, chuẩn
// 1.2 hay 2004, SCO, đường dẫn, loại tệp; tối đa 200 MB), mỗi lần tải là một phiên bản của học liệu, rồi gửi duyệt như mọi học
// liệu. Người xem được học liệu xem trước gói trong khung cô lập (`sandbox="allow-scripts"`, không lưu kết quả)
interface ScormPackage {
  id: string;
  version_no: number | null;
  standard: '1.2' | '2004';
  title: string;
  scos: Array<{ identifier: string; title: string }>;
  file_count: number;
  total_bytes: number;
}

interface Preview {
  scos: Array<{ identifier: string; title: string; url: string }>;
}

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ScormPanel({
  resourceId,
  editable,
  onMessage,
}: {
  resourceId: string;
  editable: boolean;
  onMessage(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<{ title: string; url: string }>();
  const packages = useQuery({
    queryKey: ['scorm-packages', resourceId],
    queryFn: () => requestJson<ScormPackage[]>(`/api/v1/learning-resources/${resourceId}/scorm`),
  });
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('file', file as File);
      return requestJson<ScormPackage>(`/api/v1/learning-resources/${resourceId}/scorm`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: async (saved) => {
      setFile(undefined);
      await queryClient.invalidateQueries({ queryKey: ['scorm-packages', resourceId] });
      await queryClient.invalidateQueries({ queryKey: ['resource'] });
      onMessage(`Đã tải gói SCORM ${saved.standard}: ${saved.title}`);
    },
  });
  const open = useMutation({
    mutationFn: (packageId: string) =>
      requestJson<Preview>(`/api/v1/learning-resources/${resourceId}/scorm/${packageId}/preview`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: (result) => {
      const first = result.scos[0];
      if (first) setPreview({ title: first.title, url: first.url });
    },
  });
  const error = upload.error ?? open.error ?? packages.error;
  return (
    <section className="flex flex-col gap-3" aria-label="Gói SCORM">
      <h3 className="text-content font-semibold text-text">Gói bài giảng SCORM</h3>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <ul className="flex flex-col gap-2" aria-label="Các gói SCORM">
        {(packages.data ?? []).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-content">
            <span className="flex-1">
              Phiên bản {item.version_no ?? '?'} · SCORM {item.standard} · {item.title} · {item.scos.length} phần ·{' '}
              {item.file_count} tệp, {megabytes(item.total_bytes)}
            </span>
            <Button variant="secondary" onClick={() => open.mutate(item.id)}>
              Xem trước
            </Button>
          </li>
        ))}
      </ul>
      {packages.data && packages.data.length === 0 ? (
        <p className="text-content text-text-secondary">
          Chưa có gói nào. Tải tệp zip có imsmanifest.xml ở thư mục gốc.
        </p>
      ) : null}
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Tệp zip của gói SCORM
            <input
              type="file"
              accept=".zip,application/zip"
              aria-label="Tệp zip của gói SCORM"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              onChange={(event) => setFile(event.target.files?.[0] ?? undefined)}
            />
          </label>
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Tải gói SCORM
          </Button>
        </div>
      ) : null}
      {preview ? (
        <div className="flex flex-col gap-2">
          <iframe
            title={`Xem trước ${preview.title}`}
            src={preview.url}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="h-[60vh] w-full rounded-lg border border-border bg-white"
          />
          <div>
            <Button variant="text" onClick={() => setPreview(undefined)}>
              Đóng xem trước
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
