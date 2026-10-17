import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { CatalogLookup, ErrorFileButton } from './ExcelImportPanel.js';
import { downloadMoetTemplate, readMoetCatalogs } from '../students/students-api.js';
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

// Màn hình "4.1.2. Nhập học sinh từ Excel" (DT-16 phần 16g) bật công cụ như Sở: tải file mẫu 82 cột, kèm dữ liệu, tra cứu
// danh mục và ô xác nhận "Đồng ý cập nhật dữ liệu học sinh" khi tệp cập nhật học sinh đã có
export function MoetImportSection({
  type,
  onChanged,
  tools = false,
}: {
  type: MoetImportType;
  onChanged(message: string): void;
  tools?: boolean;
}) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [file, setFile] = useState<File>();
  const [job, setJob] = useState<MoetImportJob>();
  const [consent, setConsent] = useState(false);
  const [lookup, setLookup] = useState(false);
  const [templateError, setTemplateError] = useState<string>();
  const lookupId = useId();
  const labels = LABELS[type];
  const template = (withData: boolean) => {
    setTemplateError(undefined);
    downloadMoetTemplate(withData).catch((error: unknown) => setTemplateError(messageOf(error)));
  };
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('type', type);
      form.set('org_unit_id', unitChoice.selectedId ?? '');
      form.set('file', file ?? new Blob());
      return requestJson<MoetImportJob>('/api/v1/imports', { method: 'POST', body: form });
    },
    onSuccess: setJob,
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
      {tools ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="text" onClick={() => template(false)}>
            Tải file mẫu
          </Button>
          <Button variant="text" onClick={() => template(true)}>
            Tải file mẫu kèm dữ liệu
          </Button>
          <Button variant="text" aria-expanded={lookup} aria-controls={lookupId} onClick={() => setLookup(!lookup)}>
            Tra cứu danh mục
          </Button>
        </div>
      ) : null}
      {templateError ? <Alert tone="danger">{templateError}</Alert> : null}
      {tools && lookup ? (
        <div
          id={lookupId}
          role="region"
          aria-label="Tra cứu danh mục"
          className="rounded-lg border border-border bg-page p-3"
        >
          <CatalogLookup type="moet_children" load={readMoetCatalogs} />
        </div>
      ) : null}
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
          {job.status === 'validated' && tools && (job.preview?.updated ?? 0) > 0 ? (
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              Đồng ý cập nhật dữ liệu học sinh ({job.preview?.updated} học sinh đã có sẽ được ghi đè theo tệp)
            </label>
          ) : null}
          {job.status === 'validated' ? (
            <div>
              <Button
                variant="primary"
                disabled={commit.isPending || (tools && (job.preview?.updated ?? 0) > 0 && !consent)}
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
