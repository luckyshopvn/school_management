import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EMIS_FORM_CODES, EMIS_FORMS, type EmisFormCode } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { downloadExcel, formatNumber, messageOf } from '../facilities/facilities-api.js';
import { TabBar } from '../facilities/facilities-ui.js';
import { UpperLevelSubmissionPanel } from '../submissions/UpperLevelSubmissionPanel.js';
import { fillEmisTab, readEmisForm, saveEmisTab, type EmisFormRow, type EmisTab } from './emis-api.js';

// Màn hình chung của bảy biểu báo cáo EMIS (khảo sát mục 5 của Sở; DT-16 phần 16j): thẻ tính từ dữ liệu chỉ xem; thẻ nhập
// tay có Lấy dữ liệu (số tính từ dữ liệu của hệ thống), Lấy dữ liệu năm trước, Ghi. Hai nút lấy dữ liệu chỉ điền vào bảng,
// bấm Ghi mới lưu. Gửi lên cấp trên chạy nội bộ: Xuất tệp gửi, nộp bằng tay, Đánh dấu đã gửi; biểu đã gửi thì khóa ô nhập.
// Màn hình 1.1 hiện danh sách gửi báo cáo của cả bảy biểu kèm số đã gửi, số cần gửi, lần gửi cuối như Sở
type Draft = Record<string, Record<string, string>>;

const draftOf = (rows: EmisFormRow[]): Draft =>
  Object.fromEntries(
    rows.map((row) => [
      row.code,
      Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, value === null ? '' : String(value)])),
    ]),
  );

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function EditableTable({
  formCode,
  tab,
  locked,
  onSaved,
}: {
  formCode: EmisFormCode;
  tab: EmisTab;
  locked: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(tab.rows));
  const [notice, setNotice] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const fill = useMutation({
    mutationFn: (source: 'data' | 'previous_year') => fillEmisTab(formCode, tab.key, source),
    onSuccess: (result) => {
      setDraft(draftOf(result.rows));
      setDirty(true);
      setNotice(`Đã điền số liệu từ ${result.source_name}; kiểm tra rồi bấm Ghi để lưu`);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      saveEmisTab(
        formCode,
        tab.key,
        tab.rows.map((row) => ({
          code: row.code,
          values: Object.fromEntries(
            tab.columns.map((column) => {
              const text = draft[row.code]?.[column.key] ?? '';
              return [column.key, text.trim() === '' ? null : Number(text)];
            }),
          ),
        })),
      ),
    onSuccess: async (view) => {
      queryClient.setQueryData(['emis-form', formCode], view);
      await queryClient.invalidateQueries({ queryKey: ['upper-level-submissions'] });
      setNotice(undefined);
      setDirty(false);
      onSaved(`Đã ghi thẻ ${tab.label}`);
    },
  });
  const error = fill.error ?? save.error;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {tab.can_fill ? (
          <Button variant="secondary" disabled={locked || fill.isPending} onClick={() => fill.mutate('data')}>
            Lấy dữ liệu
          </Button>
        ) : null}
        {tab.can_copy_previous_year ? (
          <Button variant="secondary" disabled={locked || fill.isPending} onClick={() => fill.mutate('previous_year')}>
            Lấy dữ liệu năm trước
          </Button>
        ) : null}
        <Button disabled={locked || save.isPending} onClick={() => save.mutate()}>
          Ghi
        </Button>
        <span className="text-label text-text-secondary">
          {tab.saved_at
            ? `Ghi lần cuối ${DATE_TIME.format(new Date(tab.saved_at))}, ${tab.saved_by_name ?? ''}`
            : 'Thẻ chưa ghi'}
          {dirty ? ' · Có thay đổi chưa ghi' : ''}
        </span>
      </div>
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Chỉ tiêu</th>
            <th className="px-3 py-2">Đơn vị</th>
            <th className="px-3 py-2">Mã số</th>
            {tab.columns.map((column) => (
              <th key={column.key} className="px-3 py-2">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tab.rows.map((row) => (
            <tr key={row.code} className="border-t border-border">
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2">{row.unit}</td>
              <td className="px-3 py-2">{row.code}</td>
              {tab.columns.map((column) => (
                <td key={column.key} className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    disabled={locked}
                    aria-label={`${column.label} ${row.code}`}
                    value={draft[row.code]?.[column.key] ?? ''}
                    onChange={(event) => {
                      setDirty(true);
                      setDraft({ ...draft, [row.code]: { ...draft[row.code], [column.key]: event.target.value } });
                    }}
                    className="w-28 rounded-lg border border-border bg-card px-2 py-1"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadOnlyTable({ tab }: { tab: EmisTab }) {
  return (
    <table className="w-full text-content">
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          <th className="px-3 py-2">Chỉ tiêu</th>
          <th className="px-3 py-2">Đơn vị</th>
          <th className="px-3 py-2">Mã số</th>
          {tab.columns.map((column) => (
            <th key={column.key} className="px-3 py-2">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tab.rows.map((row) => (
          <tr key={row.code} className="border-t border-border">
            <td className="px-3 py-2">{row.label}</td>
            <td className="px-3 py-2">{row.unit}</td>
            <td className="px-3 py-2">{row.code}</td>
            {tab.columns.map((column, index) => (
              <td key={column.key} className={index === 0 ? 'px-3 py-2 font-medium' : 'px-3 py-2'}>
                {formatNumber(row.values[column.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmisFormPage({ code }: { code: EmisFormCode }) {
  const queryClient = useQueryClient();
  const form = EMIS_FORMS.find((item) => item.code === code)!;
  const report = useQuery({ queryKey: ['emis-form', code], queryFn: () => readEmisForm(code) });
  const [tabKey, setTabKey] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const exportFile = useMutation({
    mutationFn: () => downloadExcel(`/api/v1/reports/emis/forms/${code}/export`, {}, `${code}.xlsx`),
  });
  // Đánh dấu đã gửi, mở khóa làm đổi trạng thái khóa của biểu: đọc lại biểu
  const onSubmissionChanged = useCallback(
    (message: string) => {
      setToastMessage(message);
      void queryClient.invalidateQueries({ queryKey: ['emis-form', code] });
    },
    [code, queryClient],
  );
  const data = report.data;
  const current = data?.tabs.find((item) => item.key === tabKey) ?? data?.tabs[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">
            {form.menu} {form.name}
          </h1>
          <Button variant="secondary" disabled={exportFile.isPending || !data} onClick={() => exportFile.mutate()}>
            Xuất Excel
          </Button>
        </div>
        {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
        {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
        {data ? (
          <>
            <p className="text-content text-text-secondary">
              {data.administrative_unit_name ? `${data.administrative_unit_name}, ` : ''}
              {data.school_name}, năm học {data.academic_year}. Thẻ tính từ dữ liệu lấy số tại thời điểm xem; tệp gửi
              lên cấp trên lưu số liệu tại thời điểm xuất tệp gửi.
            </p>
            {data.locked ? (
              <Alert tone="info">
                Biểu đã đánh dấu đã gửi nên đang khóa; gửi yêu cầu mở khóa ở phần Gửi lên cấp trên để sửa số liệu.
              </Alert>
            ) : null}
            {data.warnings.map((warning) => (
              <Alert key={warning} tone="warning">
                {warning}
              </Alert>
            ))}
            <TabBar
              tabs={data.tabs.map((item) => ({ key: item.key, label: item.label }))}
              current={current?.key ?? ''}
              onSelect={setTabKey}
              label={`Thẻ của ${form.name}`}
            />
            {current ? (
              <section
                className="overflow-x-auto rounded-xl border border-border bg-card p-4"
                aria-label={current.label}
              >
                {current.editable ? (
                  <EditableTable
                    key={`${current.key}-${current.saved_at ?? ''}-${String(data.locked)}`}
                    formCode={code}
                    tab={current}
                    locked={data.locked}
                    onSaved={setToastMessage}
                  />
                ) : (
                  <ReadOnlyTable tab={current} />
                )}
              </section>
            ) : null}
            <UpperLevelSubmissionPanel
              formCodes={code === 'emis-start-of-year' ? EMIS_FORM_CODES : [code]}
              summary={code === 'emis-start-of-year'}
              onChanged={onSubmissionChanged}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
