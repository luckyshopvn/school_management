import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmisRecordTypeCode } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField, Toast, type StatusTone } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { messageOf } from '../facilities/facilities-api.js';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// 1.1.2 Gửi báo cáo đầu năm như Sở (DT-17 phần 17a, khảo sát mục 10.4.3), bản chạy nội bộ: lưới hồ sơ (năm loại hồ sơ, tổng
// số, số đã gửi thành công, số cần gửi, lần gửi cuối) và lưới biểu mẫu (bốn thẻ của Biểu 01.ĐN-MN, Biểu 08.ĐN-NSNN). Nút
// chung cho các dòng đã chọn của hai lưới: "Gửi hồ sơ" lập tệp gửi (nộp tệp bằng tay) và đánh dấu đã gửi, "Xuất file lỗi",
// "Đặt trạng thái gửi lại" (người có quyền mở khóa), "Hủy" bỏ chọn
interface RecordRow {
  record_type: EmisRecordTypeCode;
  name: string;
  total: number;
  sent: number;
  to_send: number;
  last_sent_at: string | null;
  status: string;
}

interface FormRow {
  form_code: string;
  form_name: string;
  status: 'draft' | 'sent' | 'unlock_requested' | 'resend';
  sent_on: string | null;
  sent_by_name: string | null;
  no_data: boolean;
  completion: 'complete' | 'no_data' | 'incomplete';
  completion_label: string;
  exported_at: string | null;
  exported_data_complete: boolean | null;
  completeness: Array<{ label: string; done: boolean }>;
}

interface Overview {
  records: RecordRow[];
  forms: FormRow[];
  can_manage: boolean;
  can_unlock: boolean;
}

const BASE = '/api/v1/reports/emis/start-of-year';
const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

const FORM_STATUS: Record<FormRow['status'], { label: string; tone: StatusTone }> = {
  draft: { label: 'Chưa gửi', tone: 'neutral' },
  sent: { label: 'Đã gửi', tone: 'success' },
  unlock_requested: { label: 'Đã gửi yêu cầu mở khóa', tone: 'warning' },
  resend: { label: 'Cần gửi lại', tone: 'info' },
};

const COMPLETION_TONE: Record<FormRow['completion'], StatusTone> = {
  complete: 'success',
  no_data: 'neutral',
  incomplete: 'warning',
};

const dataStatusOf = (row: FormRow) =>
  row.exported_at === null
    ? 'Chưa lập tệp gửi'
    : row.exported_data_complete
      ? 'Tệp gửi lập khi đã đầy đủ dữ liệu'
      : 'Tệp gửi lập khi chưa đầy đủ dữ liệu';

async function postFile(path: string, body: unknown, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

export function EmisSendPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['emis-start-of-year-sending'],
    queryFn: () => requestJson<Overview>(`${BASE}/sending`),
  });
  const [records, setRecords] = useState<EmisRecordTypeCode[]>([]);
  const [forms, setForms] = useState<string[]>([]);
  const [confirmResend, setConfirmResend] = useState(false);
  const [note, setNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const selection = { records, forms };
  const nothingSelected = records.length === 0 && forms.length === 0;
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['emis-start-of-year-sending'] });
    await queryClient.invalidateQueries({ queryKey: ['emis-form'] });
    await queryClient.invalidateQueries({ queryKey: ['upper-level-submissions'] });
    setToastMessage(message);
  };
  const send = useMutation({
    mutationFn: () => postFile(`${BASE}/send`, selection, 'gui-bao-cao-dau-nam.xlsx'),
    onSuccess: async () => {
      setRecords([]);
      setForms([]);
      await refresh('Đã lập tệp gửi và đánh dấu đã gửi các dòng đã chọn');
    },
  });
  const errorFile = useMutation({
    mutationFn: () => postFile(`${BASE}/error-file`, selection, 'file-loi-bao-cao-dau-nam.xlsx'),
  });
  const resend = useMutation({
    mutationFn: () =>
      requestJson<Overview>(`${BASE}/resend`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...selection, note: note.trim() || null }),
      }),
    onSuccess: async () => {
      setConfirmResend(false);
      setNote('');
      setRecords([]);
      setForms([]);
      await refresh('Đã đặt trạng thái gửi lại các dòng đã chọn');
    },
  });
  const error = overview.error ?? send.error ?? errorFile.error;
  const data = overview.data;
  const toggle = <T extends string>(list: T[], value: T, checked: boolean) =>
    checked ? [...list, value] : list.filter((item) => item !== value);
  const busy = send.isPending || errorFile.isPending || resend.isPending;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">1.1.2 Gửi báo cáo đầu năm</h1>
        <p className="text-content text-text-secondary">
          Chưa kết nối với hệ thống của Bộ, Sở: "Gửi hồ sơ" lập tệp gửi của các dòng đã chọn (danh sách hồ sơ cần gửi, tệp
          của biểu mẫu) và đánh dấu đã gửi hôm nay; nộp tệp cho cấp trên theo cách của đơn vị. Hồ sơ đánh dấu gửi ở phân
          hệ Quản lý kí hồ sơ cũng tính là đã gửi.
        </p>
        <div className="flex flex-wrap gap-2">
          {data?.can_manage ? (
            <Button disabled={busy || nothingSelected} onClick={() => send.mutate()}>
              Gửi hồ sơ
            </Button>
          ) : null}
          <Button variant="secondary" disabled={busy || nothingSelected} onClick={() => errorFile.mutate()}>
            Xuất file lỗi
          </Button>
          {data?.can_unlock ? (
            <Button variant="secondary" disabled={busy || nothingSelected} onClick={() => setConfirmResend(true)}>
              Đặt trạng thái gửi lại
            </Button>
          ) : null}
          <Button
            variant="text"
            disabled={busy || nothingSelected}
            onClick={() => {
              setRecords([]);
              setForms([]);
            }}
          >
            Hủy
          </Button>
        </div>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <ConfirmDialog
          open={confirmResend}
          title="Đặt trạng thái gửi lại"
          confirmLabel="Đặt trạng thái gửi lại"
          busy={resend.isPending}
          onCancel={() => setConfirmResend(false)}
          onConfirm={() => resend.mutate()}
        >
          <div className="flex flex-col gap-3">
            <p className="text-label text-text-secondary">
              Hồ sơ chọn bỏ đánh dấu đã gửi ở trang này; biểu mẫu chọn đã gửi chuyển "Cần gửi lại" và mở khóa ô nhập.
            </p>
            <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
            {resend.error ? <Alert tone="danger">{messageOf(resend.error)}</Alert> : null}
          </div>
        </ConfirmDialog>

        <section className="overflow-x-auto rounded-xl border border-border bg-card p-4" aria-label="Hồ sơ cần gửi">
          <h2 className="mb-2 text-section-title font-semibold text-text">Hồ sơ cần gửi</h2>
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Chọn</th>
                <th className="px-3 py-2">Tên hồ sơ</th>
                <th className="px-3 py-2">Tổng số</th>
                <th className="px-3 py-2">Số đã gửi thành công</th>
                <th className="px-3 py-2">Số cần gửi</th>
                <th className="px-3 py-2">Lần gửi cuối</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {(data?.records ?? []).map((row, index) => (
                <tr key={row.record_type} className="border-t border-border" aria-label={`Hồ sơ ${row.name}`}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`Chọn ${row.name}`}
                      checked={records.includes(row.record_type)}
                      onChange={(event) => setRecords(toggle(records, row.record_type, event.target.checked))}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.total}</td>
                  <td className="px-3 py-2">{row.sent}</td>
                  <td className="px-3 py-2">{row.to_send}</td>
                  <td className="px-3 py-2">{row.last_sent_at ? DATE_TIME.format(new Date(row.last_sent_at)) : ''}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      tone={row.status === 'Đã gửi đủ' ? 'success' : row.status === 'Chưa gửi' ? 'neutral' : 'warning'}
                      label={row.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-xl border border-border bg-card p-4" aria-label="Biểu mẫu báo cáo">
          <h2 className="mb-2 text-section-title font-semibold text-text">Biểu mẫu báo cáo</h2>
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Chọn</th>
                <th className="px-3 py-2">Biểu mẫu báo cáo</th>
                <th className="px-3 py-2">Ngày gửi</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Hoàn thành dữ liệu</th>
                <th className="px-3 py-2">Trạng thái dữ liệu</th>
              </tr>
            </thead>
            <tbody>
              {(data?.forms ?? []).map((row, index) => (
                <tr key={row.form_code} className="border-t border-border align-top" aria-label={`Biểu mẫu ${row.form_name}`}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`Chọn ${row.form_name}`}
                      checked={forms.includes(row.form_code)}
                      onChange={(event) => setForms(toggle(forms, row.form_code, event.target.checked))}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{row.form_name}</td>
                  <td className="px-3 py-2">
                    {formatDate(row.sent_on)}
                    {row.sent_by_name ? <p className="text-label text-text-secondary">{row.sent_by_name}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={FORM_STATUS[row.status].tone} label={FORM_STATUS[row.status].label} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={COMPLETION_TONE[row.completion]} label={row.completion_label} />
                    {row.completion === 'incomplete' ? (
                      <ul className="mt-1 text-label text-text-secondary">
                        {row.completeness
                          .filter((item) => !item.done)
                          .map((item) => (
                            <li key={item.label}>✗ {item.label}</li>
                          ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{dataStatusOf(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {overview.isPending ? <p className="text-text-secondary">Đang tải…</p> : null}
      </div>
    </AppShell>
  );
}
