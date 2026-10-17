import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { ErrorFileButton } from './ExcelImportPanel.js';
import { ApiError, requestJson } from '../session/api-client.js';

// Nhập tệp xuất từ CSDL ngành (xls hoặc xlsx) cho trẻ hoặc nhân sự (YCTD-100): chọn đơn vị, kiểm tra tệp để xem trước số
// dòng tạo mới, cập nhật, bỏ qua và dòng lỗi, rồi ghi dữ liệu
export type MoetImportType = 'moet_children' | 'moet_staff';

interface RowMessage {
  row: number;
  column: string | null;
  message: string;
}

interface MoetImportJob {
  id: string;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: RowMessage[];
  preview: { created: number; updated: number; skipped: number; notices: RowMessage[] } | null;
}

const LABELS: Record<MoetImportType, { title: string; hint: string }> = {
  moet_children: {
    title: 'Trẻ từ CSDL ngành',
    hint: 'Tệp học sinh xuất từ CSDL ngành. Cột Mã lớp so khớp mã hoặc tên lớp của đơn vị đã chọn. Trẻ đã có (cùng số định danh) được cập nhật; trẻ chuyển đi, thôi học chưa có hồ sơ không được tạo. Dị ứng để chưa khai báo, bổ sung ở Hồ sơ trẻ.',
  },
  moet_staff: {
    title: 'Nhân sự từ CSDL ngành',
    hint: 'Tệp cán bộ, giáo viên xuất từ CSDL ngành. Nhân sự đã có (cùng mã định danh Bộ GD&ĐT hoặc CMND/CCCD) được cập nhật. Không tạo tài khoản đăng nhập và hợp đồng.',
  },
};

const STATUS_LABELS: Record<MoetImportJob['status'], { label: string; tone: 'success' | 'danger' | 'info' }> = {
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

function MessageTable({ label, rows }: { label: string; rows: RowMessage[] }) {
  return (
    <table className="w-full text-content" aria-label={label}>
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          <th className="px-3 py-1">Dòng</th>
          <th className="px-3 py-1">Cột</th>
          <th className="px-3 py-1">Nội dung</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={index} className="border-t border-border">
            <td className="px-3 py-1">{item.row}</td>
            <td className="px-3 py-1">{item.column ?? ''}</td>
            <td className="px-3 py-1">{item.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Công cụ đi kèm (tải file mẫu, tra cứu danh mục) do màn hình truyền vào, hiện dưới lời hướng dẫn (DT-16 phần 16f).
// "4.1.2. Nhập học sinh từ Excel" (DT-16 phần 16g) bật confirmUpdates: tệp cập nhật học sinh đã có chỉ ghi khi đánh dấu
// "Đồng ý cập nhật dữ liệu học sinh" như của Sở
export function MoetImportSection({
  type,
  onChanged,
  tools,
  confirmUpdates = false,
}: {
  type: MoetImportType;
  onChanged(message: string): void;
  tools?: ReactNode;
  confirmUpdates?: boolean;
}) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [file, setFile] = useState<File>();
  const [job, setJob] = useState<MoetImportJob>();
  const [consent, setConsent] = useState(false);
  const labels = LABELS[type];
  const needsConsent = confirmUpdates && (job?.preview?.updated ?? 0) > 0;
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('type', type);
      form.set('org_unit_id', unitChoice.selectedId ?? '');
      form.set('file', file ?? new Blob());
      return requestJson<MoetImportJob>('/api/v1/imports', { method: 'POST', body: form });
    },
    onSuccess: (result) => {
      setJob(result);
      setConsent(false);
    },
  });
  const commit = useMutation({
    mutationFn: () =>
      requestJson<MoetImportJob>(`/api/v1/imports/${job?.id}/commit`, {
        method: 'POST',
        body: JSON.stringify({ confirm_update: consent }),
      }),
    onSuccess: async (result) => {
      setJob(result);
      await queryClient.invalidateQueries();
      onChanged(
        `Đã ghi ${labels.title.toLowerCase()}: ${result.preview?.created ?? 0} tạo mới, ${result.preview?.updated ?? 0} cập nhật`,
      );
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={labels.title}>
      <h2 className="text-section-title font-semibold text-text">{labels.title}</h2>
      <p className="text-label text-text-secondary">{labels.hint}</p>
      {tools}
      <div className="flex flex-wrap items-end gap-3">
        <UnitSelect
          units={unitChoice.units}
          selectedId={unitChoice.selectedId}
          onSelect={(orgUnitId) => {
            unitChoice.select(orgUnitId);
            setJob(undefined);
          }}
        />
        <input
          type="file"
          aria-label={`Tệp ${labels.title}`}
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            setJob(undefined);
          }}
        />
        <Button disabled={!file || !unitChoice.selectedId || upload.isPending} onClick={() => upload.mutate()}>
          Kiểm tra tệp
        </Button>
      </div>
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {commit.error ? <Alert tone="danger">{messageOf(commit.error)}</Alert> : null}
      {job ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-content">
            <StatusBadge {...STATUS_LABELS[job.status]} />
            <span>
              {job.total_rows} dòng, {job.error_rows} dòng lỗi
              {job.preview
                ? `; ${job.preview.created} tạo mới, ${job.preview.updated} cập nhật, ${job.preview.skipped} bỏ qua`
                : ''}
            </span>
            {job.errors.length > 0 ? <ErrorFileButton jobId={job.id} /> : null}
          </div>
          {job.errors.length > 0 ? <MessageTable label="Báo cáo dòng lỗi" rows={job.errors} /> : null}
          {job.preview && job.preview.notices.length > 0 ? (
            <MessageTable label="Ghi chú từng dòng" rows={job.preview.notices} />
          ) : null}
          {job.status === 'validated' && needsConsent ? (
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              Đồng ý cập nhật dữ liệu học sinh ({job.preview?.updated} học sinh đã có sẽ được ghi theo tệp)
            </label>
          ) : null}
          {job.status === 'validated' ? (
            <div>
              <Button
                variant="primary"
                disabled={commit.isPending || (needsConsent && !consent)}
                onClick={() => commit.mutate()}
              >
                Ghi dữ liệu
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
