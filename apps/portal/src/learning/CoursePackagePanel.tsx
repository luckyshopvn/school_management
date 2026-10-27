import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gói khoá học `school-management.course-package/1` (DT-28 phần 28h, YCTD-278): xuất khoá mẫu kèm học liệu đã công bố (tệp, liên
// kết, gói SCORM) để trường khác nhập; nhập gói thành khoá mẫu nháp của mình, học liệu chưa có thành học liệu nháp đã gửi duyệt.
// Gói không chứa dữ liệu học sinh
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function ExportPackageButton({ templateId, onDone }: { templateId: string; onDone(message: string): void }) {
  const exporting = useMutation({
    mutationFn: async () => {
      const response = await fetchWithSession(`/api/v1/learning/templates/${templateId}/package`);
      if (!response.ok) throw await readError(response);
      const disposition = response.headers.get('content-disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'khoa-hoc.khoahoc.gz';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob());
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
      return Number(response.headers.get('x-package-skipped') ?? 0);
    },
    onSuccess: (skipped) =>
      onDone(skipped > 0 ? `Đã xuất gói khoá học, ${skipped} học liệu không đóng gói được` : 'Đã xuất gói khoá học'),
  });
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button variant="secondary" disabled={exporting.isPending} onClick={() => exporting.mutate()}>
          Xuất gói khoá học
        </Button>
      </div>
      {exporting.error ? <Alert tone="danger">{messageOf(exporting.error)}</Alert> : null}
    </div>
  );
}

interface ImportResult {
  template_id: string;
  title: string;
  created_resources: number;
  reused: number;
  skipped: Array<{ title: string; reason: string }>;
}

export function ImportPackageForm({ onImported }: { onImported(message: string): void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<ImportResult>();
  const importing = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('file', file as File);
      return requestJson<ImportResult>('/api/v1/learning/template-packages', { method: 'POST', body: form });
    },
    onSuccess: async (imported) => {
      setFile(undefined);
      setResult(imported);
      await queryClient.invalidateQueries({ queryKey: ['course-templates'] });
      onImported(`Đã nhập khoá mẫu nháp ${imported.title}`);
    },
  });
  return (
    <section className="flex flex-col gap-2" aria-label="Nhập gói khoá học">
      <h2 className="text-section-title font-semibold text-text">Nhập gói khoá học từ trường khác</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Tệp gói khoá học (.khoahoc.gz)
          <input
            type="file"
            aria-label="Tệp gói khoá học"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            onChange={(event) => setFile(event.target.files?.[0] ?? undefined)}
          />
        </label>
        <Button disabled={!file || importing.isPending} onClick={() => importing.mutate()}>
          Nhập gói
        </Button>
      </div>
      {importing.error ? <Alert tone="danger">{messageOf(importing.error)}</Alert> : null}
      {result ? (
        <Alert tone="info">
          Khoá mẫu nháp {result.title}: {result.created_resources} học liệu mới (đã gửi duyệt), {result.reused} học liệu
          đã có dùng lại
          {result.skipped.length > 0
            ? `; bỏ qua: ${result.skipped.map((item) => `${item.title} (${item.reason})`).join('; ')}`
            : ''}
          .
        </Alert>
      ) : null}
    </section>
  );
}
