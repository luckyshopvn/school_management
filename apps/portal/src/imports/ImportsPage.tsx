import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';

// MH-40 Nhập dữ liệu ban đầu từ Excel (P01-13) và nhập mã định danh ngành (P02-12) (YCTD-46).
// Giao diện chỉ chuyển tệp và hiện báo cáo; máy chủ kiểm tra toàn bộ và chỉ ghi khi không còn dòng lỗi
type ImportType = 'classes' | 'children' | 'moet_codes' | 'opening_debts';

interface ImportJob {
  id: string;
  import_type: ImportType;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: Array<{ row: number; column: string | null; message: string }>;
  assigned_rows?: number;
}

const TYPE_LABELS: Record<ImportType, string> = {
  classes: 'Lớp học',
  children: 'Trẻ và phụ huynh',
  moet_codes: 'Mã định danh ngành',
  opening_debts: 'Công nợ đầu kỳ',
};

const STATUS_LABELS: Record<ImportJob['status'], { label: string; tone: 'success' | 'danger' | 'info' }> = {
  validated: { label: 'Không có dòng lỗi, sẵn sàng ghi', tone: 'info' },
  failed: { label: 'Còn dòng lỗi', tone: 'danger' },
  committed: { label: 'Đã ghi dữ liệu', tone: 'success' },
};

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return [error.message, ...error.details.map((detail) => detail.message)].join('. ');
  }
  return 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

async function downloadTemplate(type: ImportType): Promise<void> {
  const response = await fetchWithSession(`/api/v1/imports/templates/${type}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không tải được mẫu');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = `mau-nhap-${type}.xlsx`;
  link.click();
}

function ImportSection({ type, onChanged }: { type: ImportType; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [job, setJob] = useState<ImportJob>();
  const [templateError, setTemplateError] = useState<string>();
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('file', file ?? new Blob());
      if (type !== 'moet_codes') {
        form.set('type', type);
      }
      return requestJson<ImportJob>(type === 'moet_codes' ? '/api/v1/imports/moet-codes' : '/api/v1/imports', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: async (result) => {
      setJob(result);
      if (type === 'moet_codes') {
        await queryClient.invalidateQueries({ queryKey: ['children'] });
        onChanged(`Đã gán mã ngành cho ${result.assigned_rows ?? 0} trẻ`);
      }
    },
  });
  const commit = useMutation({
    mutationFn: () => requestJson<ImportJob>(`/api/v1/imports/${job?.id}/commit`, { method: 'POST' }),
    onSuccess: async (result) => {
      setJob(result);
      await queryClient.invalidateQueries();
      onChanged(`Đã ghi ${result.total_rows} dòng ${TYPE_LABELS[type].toLowerCase()}`);
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={TYPE_LABELS[type]}>
      <h2 className="text-section-title font-semibold text-text">{TYPE_LABELS[type]}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="text"
          onClick={() => downloadTemplate(type).catch((error: unknown) => setTemplateError(messageOf(error)))}
        >
          Tải mẫu Excel
        </Button>
        <input
          type="file"
          aria-label={`Tệp ${TYPE_LABELS[type]}`}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            setJob(undefined);
          }}
        />
        <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          {type === 'moet_codes' ? 'Nhập mã ngành' : 'Kiểm tra tệp'}
        </Button>
      </div>
      {templateError ? <Alert tone="danger">{templateError}</Alert> : null}
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {commit.error ? <Alert tone="danger">{messageOf(commit.error)}</Alert> : null}
      {job ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-content">
            <StatusBadge {...STATUS_LABELS[job.status]} />
            <span>
              {job.total_rows} dòng, {job.error_rows} dòng lỗi
              {job.assigned_rows !== undefined ? `, đã gán ${job.assigned_rows} dòng` : ''}
            </span>
          </div>
          {job.errors.length > 0 ? (
            <table className="w-full text-content" aria-label="Báo cáo dòng lỗi">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-1">Dòng</th>
                  <th className="px-3 py-1">Cột</th>
                  <th className="px-3 py-1">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {job.errors.map((error, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-3 py-1">{error.row}</td>
                    <td className="px-3 py-1">{error.column ?? ''}</td>
                    <td className="px-3 py-1">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {job.status === 'validated' ? (
            <div>
              <Button variant="primary" disabled={commit.isPending} onClick={() => commit.mutate()}>
                Ghi dữ liệu
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ImportsPage() {
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canImportMoetCodes = useHasPermission(PERMISSION_CODES.childManage);
  const canImportOpeningDebts = useHasPermission(PERMISSION_CODES.openingDebtImport);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Nhập dữ liệu</h1>
        <p className="text-label text-text-secondary">
          Tải mẫu, điền dữ liệu rồi tải tệp lên. Hệ thống kiểm tra toàn bộ tệp và chỉ ghi khi không còn dòng lỗi. Trẻ
          nhập vào thẳng trạng thái đang học; giấy khai sinh bổ sung sau ở màn hình Hồ sơ trẻ.
        </p>
        {canImportChildren ? (
          <>
            <ImportSection type="classes" onChanged={setToastMessage} />
            <ImportSection type="children" onChanged={setToastMessage} />
          </>
        ) : null}
        {canImportMoetCodes ? <ImportSection type="moet_codes" onChanged={setToastMessage} /> : null}
        {canImportOpeningDebts ? <ImportSection type="opening_debts" onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
