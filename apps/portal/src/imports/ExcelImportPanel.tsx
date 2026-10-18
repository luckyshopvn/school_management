import { useId, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import {
  IMPORTS_API_BASE,
  downloadImportErrorFile,
  downloadImportTemplate,
  messageOf,
  readImportCatalogs,
  readImportColumns,
  type ImportCatalog,
  type RowMessage,
} from './import-api.js';

// Thành phần nhập từ Excel theo mẫu chung của Sở (DT-16 phần 16a, khảo sát mục 2.3): Tải file mẫu, Tải file mẫu kèm dữ liệu,
// Tra cứu danh mục (mã, tên các danh mục dùng trong tệp), Chọn cột để nhập, Tải lên, xem lỗi từng dòng, Xuất file lỗi (tệp
// gốc kèm cột Nội dung lỗi) và Ghi dữ liệu khi không còn dòng lỗi. Máy chủ kiểm tra toàn bộ tệp, chỉ ghi khi không còn lỗi
export interface ImportJobResult {
  id: string;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: RowMessage[];
  assigned_rows?: number;
}

const STATUS_LABELS: Record<ImportJobResult['status'], { label: string; tone: 'success' | 'danger' | 'info' }> = {
  validated: { label: 'Không có dòng lỗi, sẵn sàng ghi', tone: 'info' },
  failed: { label: 'Còn dòng lỗi', tone: 'danger' },
  committed: { label: 'Đã ghi dữ liệu', tone: 'success' },
};

export interface ExcelImportPanelProperties {
  // Loại nhập của máy chủ (classes, children, staff…)
  type: string;
  title: string;
  // Điểm cuối tải tệp lên và các trường gửi kèm
  uploadPath: string;
  uploadFields?: Record<string, string>;
  // Tên nút tải lên; mặc định "Tải lên" như của Sở
  uploadLabel?: string;
  // Lần nhập ghi ngay khi tải lên (không có bước Ghi dữ liệu)
  writesOnUpload?: boolean;
  onUploaded?(job: ImportJobResult): void | Promise<void>;
  onCommitted(job: ImportJobResult): void | Promise<void>;
  // Đường dẫn gốc của điểm cuối mẫu, danh mục, ghi, file lỗi; mặc định công cụ nhập chung /api/v1/imports (DT-16 phần 16h)
  apiBase?: string;
  // Tham số thêm khi tra danh mục, tải file mẫu (ví dụ org_unit_id)
  catalogSearch?: Record<string, string>;
}

// Bảng dòng lỗi của một lần nhập
export function RowMessageTable({ label, rows }: { label: string; rows: RowMessage[] }) {
  return (
    <table className="w-full text-content" aria-label={label}>
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          <th className="px-3 py-1">Dòng</th>
          <th className="px-3 py-1">Cột</th>
          <th className="px-3 py-1">Lỗi</th>
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

// Nút "Xuất file lỗi" dùng chung cho mọi lần nhập có dòng lỗi
export function ErrorFileButton({ jobId, apiBase = IMPORTS_API_BASE }: { jobId: string; apiBase?: string }) {
  const [error, setError] = useState<string>();
  return (
    <>
      <Button
        onClick={() => {
          setError(undefined);
          downloadImportErrorFile(jobId, apiBase).catch((reason: unknown) => setError(messageOf(reason)));
        }}
      >
        Xuất file lỗi
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </>
  );
}

// Vùng "Tra cứu danh mục"; màn hình có danh mục riêng (nhập học sinh 82 cột, DT-16 phần 16g) truyền hàm đọc danh mục
export function CatalogLookup({
  type,
  apiBase = '/api/v1/imports',
  search: catalogSearch = {},
  load,
}: {
  type: string;
  apiBase?: string;
  search?: Record<string, string>;
  load?: () => Promise<ImportCatalog[]>;
}) {
  const [catalogKey, setCatalogKey] = useState<string>();
  const [search, setSearch] = useState('');
  const selectId = useId();
  const searchId = useId();
  const catalogs = useQuery({
    queryKey: ['import-catalogs', apiBase, type, catalogSearch],
    queryFn: load ?? (() => readImportCatalogs(type, apiBase, catalogSearch)),
  });
  const current = catalogs.data?.find((catalog) => catalog.key === catalogKey) ?? catalogs.data?.[0];
  const keyword = search.trim().toLowerCase();
  const items = (current?.items ?? []).filter(
    (item) => keyword === '' || item.code.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword),
  );
  if (catalogs.error) {
    return <Alert tone="danger">{messageOf(catalogs.error)}</Alert>;
  }
  if (catalogs.data && catalogs.data.length === 0) {
    return <p className="text-label text-text-secondary">Mẫu này không dùng danh mục nào.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-label font-medium text-text">
            Danh mục
          </label>
          <select
            id={selectId}
            value={current?.key ?? ''}
            onChange={(event) => setCatalogKey(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          >
            {(catalogs.data ?? []).map((catalog) => (
              <option key={catalog.key} value={catalog.key}>
                {catalog.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={searchId} className="text-label font-medium text-text">
            Tìm mã, tên
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          />
        </div>
      </div>
      {current ? <p className="text-label text-text-secondary">Ghi vào cột: {current.column}</p> : null}
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-content" aria-label={`Danh mục ${current?.title ?? ''}`}>
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-1">Mã</th>
              <th className="px-3 py-1">Tên</th>
              <th className="px-3 py-1">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.code}-${index}`} className="border-t border-border">
                <td className="px-3 py-1">{item.code}</td>
                <td className="px-3 py-1">{item.name}</td>
                <td className="px-3 py-1">{item.note ?? ''}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={3} className="px-3 py-2 text-text-secondary">
                  {catalogs.isPending ? 'Đang tải…' : 'Không có mục nào.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExcelImportPanel({
  type,
  title,
  uploadPath,
  uploadFields = {},
  uploadLabel = 'Tải lên',
  writesOnUpload = false,
  onUploaded,
  onCommitted,
  apiBase = IMPORTS_API_BASE,
  catalogSearch = {},
}: ExcelImportPanelProperties) {
  const [file, setFile] = useState<File>();
  const [job, setJob] = useState<ImportJobResult>();
  const [templateError, setTemplateError] = useState<string>();
  const [panel, setPanel] = useState<'columns' | 'catalogs'>();
  // Cột người dùng bỏ chọn; cột khóa, bắt buộc không bỏ được
  const [unselected, setUnselected] = useState<Set<string>>(() => new Set());
  const columnsId = useId();
  const catalogsId = useId();
  const info = useQuery({
    queryKey: ['import-columns', apiBase, type],
    queryFn: () => readImportColumns(type, apiBase),
  });
  const selectable = (info.data?.columns ?? []).filter((column) => !column.locked);
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      for (const [key, value] of Object.entries(uploadFields)) {
        form.set(key, value);
      }
      // Gửi danh sách cột khi người dùng bỏ chọn cột nào đó; không thì máy chủ nhập mọi cột như trước
      if (unselected.size > 0 && info.data) {
        form.set(
          'columns',
          info.data.columns
            .filter((column) => !unselected.has(column.key))
            .map((column) => column.key)
            .join(','),
        );
      }
      form.set('file', file ?? new Blob());
      return requestJson<ImportJobResult>(uploadPath, { method: 'POST', body: form });
    },
    onSuccess: async (result) => {
      setJob(result);
      await onUploaded?.(result);
    },
  });
  const commit = useMutation({
    mutationFn: () => requestJson<ImportJobResult>(`${apiBase}/${job?.id}/commit`, { method: 'POST' }),
    onSuccess: async (result) => {
      setJob(result);
      await onCommitted(result);
    },
  });
  const template = (withData: boolean) => {
    setTemplateError(undefined);
    downloadImportTemplate(type, withData, apiBase, catalogSearch).catch((error: unknown) =>
      setTemplateError(messageOf(error)),
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={title}>
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="text" onClick={() => template(false)}>
          Tải file mẫu
        </Button>
        {info.data?.template_with_data ? (
          <Button variant="text" onClick={() => template(true)}>
            Tải file mẫu kèm dữ liệu
          </Button>
        ) : null}
        <Button
          variant="text"
          aria-expanded={panel === 'catalogs'}
          aria-controls={catalogsId}
          onClick={() => setPanel(panel === 'catalogs' ? undefined : 'catalogs')}
        >
          Tra cứu danh mục
        </Button>
        {selectable.length > 0 ? (
          <Button
            variant="text"
            aria-expanded={panel === 'columns'}
            aria-controls={columnsId}
            onClick={() => setPanel(panel === 'columns' ? undefined : 'columns')}
          >
            Chọn cột để nhập
          </Button>
        ) : null}
      </div>
      {panel === 'catalogs' ? (
        <div
          id={catalogsId}
          role="region"
          aria-label="Tra cứu danh mục"
          className="rounded-lg border border-border bg-page p-3"
        >
          <CatalogLookup type={type} apiBase={apiBase} search={catalogSearch} />
        </div>
      ) : null}
      {panel === 'columns' && info.data ? (
        <fieldset id={columnsId} className="rounded-lg border border-border bg-page p-3" aria-label="Chọn cột để nhập">
          <legend className="px-1 text-label font-medium text-text">Chọn cột để nhập</legend>
          <p className="mb-2 text-label text-text-secondary">
            {info.data.updates_existing
              ? 'Cột khóa luôn nhập. Dòng của bản ghi đã có chỉ cập nhật các cột được chọn; thêm mới cần đủ cột bắt buộc.'
              : 'Cột bắt buộc luôn nhập. Cột không chọn coi như để trống; tệp không cần có các cột này.'}
          </p>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3">
            {info.data.columns.map((column) => (
              <label key={column.key} className="flex items-center gap-2 text-content" title={column.note}>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={column.locked || !unselected.has(column.key)}
                  disabled={column.locked}
                  onChange={(event) => {
                    const next = new Set(unselected);
                    if (event.target.checked) {
                      next.delete(column.key);
                    } else {
                      next.add(column.key);
                    }
                    setUnselected(next);
                    setJob(undefined);
                  }}
                />
                {column.header}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          aria-label={`Tệp ${title}`}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            setJob(undefined);
          }}
        />
        <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          {uploadLabel}
        </Button>
      </div>
      {templateError ? <Alert tone="danger">{templateError}</Alert> : null}
      {info.error ? <Alert tone="danger">{messageOf(info.error)}</Alert> : null}
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
            {job.errors.length > 0 ? <ErrorFileButton jobId={job.id} apiBase={apiBase} /> : null}
          </div>
          {job.errors.length > 0 ? <RowMessageTable label="Báo cáo dòng lỗi" rows={job.errors} /> : null}
          {job.status === 'validated' && !writesOnUpload ? (
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
