import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { EMIS_FORMS, type EmisColumn, type EmisFormCode } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { downloadExcel, formatNumber, messageOf } from '../facilities/facilities-api.js';
import { TabBar } from '../facilities/facilities-ui.js';
import { UpperLevelSubmissionPanel } from '../submissions/UpperLevelSubmissionPanel.js';
import { clearEmisTab, fillEmisTab, readEmisForm, saveEmisTab, type EmisFormRow, type EmisTab } from './emis-api.js';

// Màn hình chung của bảy biểu báo cáo EMIS (khảo sát mục 5 của Sở; DT-16 phần 16j; chỉ tiêu, mã số, cột theo Sở từ DT-17
// phần 17a): cột TT, Chỉ tiêu, Mã số, Đơn vị như Sở, dòng tiêu đề nhóm không có mã số, cột có tiêu đề nhóm hai hàng. Thẻ tính
// từ dữ liệu chỉ xem; thẻ nhập tay có Lấy dữ liệu (số tính từ dữ liệu của hệ thống), Lấy dữ liệu năm trước, Ghi, Xóa dữ liệu.
// Hai nút lấy dữ liệu chỉ điền vào bảng, bấm Ghi mới lưu. 1.1.1 gửi ở trang 1.1.2 Gửi báo cáo đầu năm; 1.2 chỉ có "Gửi dữ
// liệu" như Sở; biểu khác gửi lên cấp trên chạy nội bộ: Xuất tệp gửi, nộp bằng tay, Đánh dấu đã gửi; thẻ đã gửi khóa ô nhập
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

const columnName = (column: EmisColumn) => (column.group ? `${column.group} ${column.label}` : column.label);

// Hai hàng tiêu đề khi có cột nhóm (ví dụ "Kiên cố" trên "Tổng số", "Xây dựng mới")
function IndicatorHead({ columns }: { columns: EmisColumn[] }) {
  const grouped = columns.some((column) => column.group);
  const span = grouped ? 2 : 1;
  const groups: Array<{ group: string | undefined; columns: EmisColumn[] }> = [];
  for (const column of columns) {
    const last = groups[groups.length - 1];
    if (column.group && last?.group === column.group) {
      last.columns.push(column);
    } else {
      groups.push({ group: column.group, columns: [column] });
    }
  }
  return (
    <thead className="text-left text-label font-medium text-text-secondary">
      <tr>
        <th rowSpan={span} className="px-3 py-2">
          TT
        </th>
        <th rowSpan={span} className="px-3 py-2">
          Chỉ tiêu
        </th>
        <th rowSpan={span} className="px-3 py-2">
          Mã số
        </th>
        <th rowSpan={span} className="px-3 py-2">
          Đơn vị
        </th>
        {groups.map((item) =>
          item.group ? (
            <th key={item.group} colSpan={item.columns.length} className="px-3 py-2 text-center">
              {item.group}
            </th>
          ) : (
            <th key={item.columns[0]!.key} rowSpan={span} className="px-3 py-2">
              {item.columns[0]!.label}
            </th>
          ),
        )}
      </tr>
      {grouped ? (
        <tr>
          {columns
            .filter((column) => column.group)
            .map((column) => (
              <th key={column.key} className="px-3 py-2" aria-label={columnName(column)}>
                {column.label}
              </th>
            ))}
        </tr>
      ) : null}
    </thead>
  );
}

function RowLead({ row }: { row: EmisFormRow }) {
  return (
    <>
      <td className="px-3 py-2 whitespace-nowrap">{row.order ?? ''}</td>
      <td className={row.heading ? 'px-3 py-2 font-semibold' : 'px-3 py-2'}>{row.label}</td>
      <td className="px-3 py-2">{row.heading ? '' : row.code}</td>
      <td className="px-3 py-2">{row.unit}</td>
    </>
  );
}

function EditableTable({
  formCode,
  tab,
  onSaved,
}: {
  formCode: EmisFormCode;
  tab: EmisTab;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(tab.rows));
  const [notice, setNotice] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const locked = tab.locked;
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
        tab.rows
          .filter((row) => !row.heading)
          .map((row) => ({
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
  const clear = useMutation({
    mutationFn: () => clearEmisTab(formCode, tab.key),
    onSuccess: async (view) => {
      setConfirmClear(false);
      queryClient.setQueryData(['emis-form', formCode], view);
      await queryClient.invalidateQueries({ queryKey: ['upper-level-submissions'] });
      setNotice(undefined);
      setDirty(false);
      onSaved(`Đã xóa dữ liệu thẻ ${tab.label}`);
    },
  });
  const error = fill.error ?? save.error ?? clear.error;
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
        <Button
          variant="secondary"
          disabled={locked || clear.isPending || tab.saved_at === null}
          onClick={() => setConfirmClear(true)}
        >
          Xóa dữ liệu
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
      {confirmClear ? (
        <ConfirmDialog
          open
          title={`Xóa dữ liệu: ${tab.label}`}
          confirmLabel="Xóa dữ liệu"
          busy={clear.isPending}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => clear.mutate()}
        >
          <p className="text-content">
            Xóa mọi số liệu đã ghi của thẻ này (thẻ chưa gửi). Số liệu tính từ dữ liệu của hệ thống vẫn lấy lại được
            bằng "Lấy dữ liệu".
          </p>
        </ConfirmDialog>
      ) : null}
      <table className="w-full text-content">
        <IndicatorHead columns={tab.columns} />
        <tbody>
          {tab.rows.map((row) => (
            <tr key={row.code} className="border-t border-border">
              <RowLead row={row} />
              {row.heading ? (
                <td colSpan={tab.columns.length} />
              ) : (
                tab.columns.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    {row.computed ? (
                      <span aria-label={`${columnName(column)} ${row.code}`}>
                        {formatNumber(draft[row.code]?.[column.key] ? Number(draft[row.code]?.[column.key]) : null)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        disabled={locked}
                        aria-label={`${columnName(column)} ${row.code}`}
                        value={draft[row.code]?.[column.key] ?? ''}
                        onChange={(event) => {
                          setDirty(true);
                          setDraft({
                            ...draft,
                            [row.code]: { ...draft[row.code], [column.key]: event.target.value },
                          });
                        }}
                        className="w-28 rounded-lg border border-border bg-card px-2 py-1"
                      />
                    )}
                  </td>
                ))
              )}
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
      <IndicatorHead columns={tab.columns} />
      <tbody>
        {tab.rows.map((row) => (
          <tr key={row.code} className="border-t border-border">
            <RowLead row={row} />
            {row.heading ? (
              <td colSpan={tab.columns.length} />
            ) : (
              tab.columns.map((column, index) => (
                <td key={column.key} className={index === 0 ? 'px-3 py-2 font-medium' : 'px-3 py-2'}>
                  {formatNumber(row.values[column.key])}
                </td>
              ))
            )}
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
  const hasComputed = data?.tabs.some((item) => !item.editable) ?? false;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">
            {form.menu} {form.name}
          </h1>
          <div className="flex flex-wrap gap-2">
            {hasComputed ? (
              <Button variant="secondary" disabled={report.isFetching} onClick={() => void report.refetch()}>
                {code === 'emis-start-of-year' ? 'Lấy dữ liệu từ hệ thống' : 'Lấy dữ liệu'}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              disabled={exportFile.isPending || !data || data.tabs.length === 0}
              onClick={() => exportFile.mutate()}
            >
              Xuất Excel
            </Button>
          </div>
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
            {data.tabs.length > 0 ? (
              <TabBar
                tabs={data.tabs.map((item) => ({ key: item.key, label: item.label }))}
                current={current?.key ?? ''}
                onSelect={setTabKey}
                label={`Thẻ của ${form.name}`}
              />
            ) : null}
            {current ? (
              <section
                className="overflow-x-auto rounded-xl border border-border bg-card p-4"
                aria-label={current.label}
              >
                {current.editable ? (
                  <EditableTable
                    key={`${current.key}-${current.saved_at ?? ''}-${String(current.locked)}`}
                    formCode={code}
                    tab={current}
                    onSaved={setToastMessage}
                  />
                ) : (
                  <ReadOnlyTable tab={current} />
                )}
              </section>
            ) : null}
            {code === 'emis-start-of-year' ? (
              <Alert tone="info">
                Gửi bốn thẻ của Biểu 01.ĐN-MN và Biểu 08.ĐN-NSNN ở{' '}
                <Link to="/emis/send" className="font-medium text-primary underline">
                  1.1.2 Gửi báo cáo đầu năm
                </Link>
                .
              </Alert>
            ) : (
              <UpperLevelSubmissionPanel
                formCodes={[code]}
                quickSend={code === 'emis-facilities'}
                onChanged={onSubmissionChanged}
              />
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
