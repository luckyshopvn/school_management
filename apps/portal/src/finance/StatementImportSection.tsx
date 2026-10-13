import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import {
  importStatement,
  readStatementProfile,
  saveStatementProfile,
  type StatementImport,
  type StatementProfile,
} from './finance-g2-api.js';

// MH-70 Nhập tệp sao kê ngân hàng (G3-05; P06-06; YCTD-89): cấu hình cột theo tài khoản dùng lại cho các lần nhập, chọn tệp
// Excel hoặc CSV, xem số dòng đã ghi, trùng bỏ qua, lỗi, khớp tự động và đề xuất lập phiếu thu
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const EMPTY: StatementProfile = {
  header_row: 1,
  date_column: '',
  date_format: 'dmy',
  amount_mode: 'split',
  amount_column: null,
  credit_column: null,
  debit_column: null,
  description_column: '',
  reference_column: null,
};
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function StatementImportSection({ accountId, onImported }: { accountId: string; onImported(): void }) {
  const stored = useQuery({
    queryKey: ['bank-statement-profile', accountId],
    queryFn: () => readStatementProfile(accountId),
  });
  const [profile, setProfile] = useState<StatementProfile>(EMPTY);
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<StatementImport>();
  useEffect(() => {
    setProfile(stored.data?.profile ?? EMPTY);
  }, [stored.data]);
  const text = (field: keyof StatementProfile) => (profile[field] as string | null) ?? '';
  const change = (field: keyof StatementProfile, value: string) =>
    setProfile({ ...profile, [field]: field === 'header_row' ? Number(value) : value || null });
  const save = useMutation({
    mutationFn: () => saveStatementProfile(accountId, profile),
    onSuccess: () => stored.refetch(),
  });
  const upload = useMutation({
    mutationFn: () => importStatement(accountId, file as File),
    onSuccess: (data) => {
      setResult(data);
      onImported();
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Nhập tệp sao kê">
      <h2 className="text-section-title font-semibold text-text">Nhập tệp sao kê</h2>
      <p className="text-content text-text-secondary">
        Ghi tên cột đúng như dòng tiêu đề của tệp ngân hàng. Dòng trùng (cùng ngày, số tiền, số tham chiếu) được bỏ qua.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <TextField
            label="Dòng tiêu đề"
            type="number"
            value={String(profile.header_row)}
            onChange={(event) => change('header_row', event.target.value)}
          />
        </div>
        <div className="w-40">
          <TextField
            label="Cột ngày"
            value={text('date_column')}
            onChange={(e) => change('date_column', e.target.value)}
          />
        </div>
        <label className="text-label font-medium text-text">
          Cách ghi ngày
          <select
            value={profile.date_format}
            onChange={(event) => change('date_format', event.target.value)}
            className={selectClass}
          >
            <option value="dmy">Ngày/tháng/năm</option>
            <option value="ymd">Năm-tháng-ngày</option>
            <option value="mdy">Tháng/ngày/năm</option>
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Cách ghi số tiền
          <select
            value={profile.amount_mode}
            onChange={(event) => change('amount_mode', event.target.value)}
            className={selectClass}
          >
            <option value="split">Hai cột tiền vào, tiền ra</option>
            <option value="signed">Một cột có dấu</option>
          </select>
        </label>
        {profile.amount_mode === 'signed' ? (
          <div className="w-40">
            <TextField
              label="Cột số tiền"
              value={text('amount_column')}
              onChange={(e) => change('amount_column', e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="w-40">
              <TextField
                label="Cột tiền vào"
                value={text('credit_column')}
                onChange={(e) => change('credit_column', e.target.value)}
              />
            </div>
            <div className="w-40">
              <TextField
                label="Cột tiền ra"
                value={text('debit_column')}
                onChange={(e) => change('debit_column', e.target.value)}
              />
            </div>
          </>
        )}
        <div className="w-40">
          <TextField
            label="Cột diễn giải"
            value={text('description_column')}
            onChange={(e) => change('description_column', e.target.value)}
          />
        </div>
        <div className="w-40">
          <TextField
            label="Cột số tham chiếu"
            value={text('reference_column')}
            onChange={(e) => change('reference_column', e.target.value)}
          />
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu cấu hình cột
        </Button>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {save.isSuccess ? <p className="text-content text-text-secondary">Đã lưu cấu hình cột.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-label font-medium text-text">
          Tệp sao kê
          <input
            type="file"
            accept=".xlsx,.csv"
            className="mt-2 block text-content"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </label>
        <Button
          variant="primary"
          disabled={!file || !stored.data?.profile || upload.isPending}
          onClick={() => upload.mutate()}
        >
          Nhập sao kê
        </Button>
      </div>
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {result ? (
        <div className="flex flex-col gap-2 text-content" role="region" aria-label="Kết quả nhập sao kê">
          <p>
            Đã ghi {result.imported_count}/{result.total_rows} dòng, trùng bỏ qua {result.duplicate_count}, lỗi{' '}
            {result.error_count}, khớp tự động {result.auto_matched_count}, đề xuất lập phiếu thu{' '}
            {result.suggested_count}.
          </p>
          {result.errors.length > 0 ? (
            <ul className="list-disc pl-6">
              {result.errors.map((error) => (
                <li key={error.row}>
                  Dòng {error.row}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
