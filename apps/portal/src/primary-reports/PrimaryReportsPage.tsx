import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMPLETION_OUTCOME_LABELS, PERMISSION_CODES, YEAR_RESULT_LABELS } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  exportEmis,
  exportReport,
  listEmisForms,
  messageOf,
  readEmis,
  readPeriods,
  readReport,
  saveEmisRows,
  saveEmisValues,
  type EmisBase,
  type EmisRow,
  type ReportGroup,
  type RowKind,
} from './primary-reports-api.js';

// 7.9 Báo cáo, thống kê, EMIS Tiểu học (DT-20 phần 20f, YCTD-165): sĩ số theo khối, kết quả đánh giá theo lớp, khối, trường,
// cuối năm (kết quả, hoàn thành chương trình, khen thưởng), chuyên cần theo tiết và bán trú; mỗi báo cáo xuất Excel, PDF.
// Thẻ EMIS Tiểu học: biểu khung cấu hình được (dòng công thức tính từ dữ liệu, dòng nhập tay), xuất tệp; gửi, đánh dấu đã
// gửi ở trang gửi lên cấp trên có sẵn; Ban Giám hiệu sửa khung biểu cho khớp Sở
type Tab = 'enrollment' | 'assessments' | 'year-end' | 'attendance' | 'emis';
const TAB_LABELS: Record<Tab, string> = {
  enrollment: 'Sĩ số',
  assessments: 'Kết quả đánh giá',
  'year-end': 'Cuối năm',
  attendance: 'Chuyên cần, bán trú',
  emis: 'EMIS Tiểu học',
};
const GROUP_LABELS: Record<ReportGroup, string> = { class: 'Theo lớp', grade: 'Theo khối', school: 'Toàn trường' };
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function Table({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-content" aria-label={label}>
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-2 py-2">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {columns.map((column) => (
                <td key={column.key} className="px-2 py-2">
                  {row[column.key] === null || row[column.key] === undefined ? '' : String(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExportButtons({ onExport }: { onExport(format: 'xlsx' | 'pdf'): Promise<void> }) {
  const run = useMutation({ mutationFn: onExport });
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={run.isPending} onClick={() => run.mutate('xlsx')}>
        Xuất Excel
      </Button>
      <Button disabled={run.isPending} onClick={() => run.mutate('pdf')}>
        Xuất PDF
      </Button>
      {run.error ? <Alert tone="danger">{messageOf(run.error)}</Alert> : null}
    </div>
  );
}

export function GroupSelect({ value, onChange }: { value: ReportGroup; onChange(value: ReportGroup): void }) {
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      Gộp
      <select value={value} onChange={(event) => onChange(event.target.value as ReportGroup)} className={SELECT_CLASS}>
        {(Object.keys(GROUP_LABELS) as ReportGroup[]).map((code) => (
          <option key={code} value={code}>
            {GROUP_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnrollmentTab({ orgUnitId }: { orgUnitId: string | undefined }) {
  const params = { org_unit_id: orgUnitId };
  const report = useQuery({
    queryKey: ['primary-enrollment', orgUnitId],
    queryFn: () =>
      readReport<{ rows: Array<Record<string, unknown>>; totals: Record<string, unknown> }>('enrollment', params),
    retry: false,
  });
  if (report.error) {
    return <Alert tone="warning">{messageOf(report.error)}</Alert>;
  }
  return (
    <div className="flex flex-col gap-3">
      <ExportButtons onExport={(format) => exportReport('enrollment', params, format)} />
      {report.data ? (
        <Table
          label="Sĩ số theo khối"
          columns={[
            { key: 'label', label: 'Khối' },
            { key: 'classes', label: 'Số lớp' },
            { key: 'two_sessions_classes', label: 'Lớp 2 buổi/ngày' },
            { key: 'students', label: 'Học sinh' },
            { key: 'female', label: 'Nữ' },
            { key: 'ethnic', label: 'Dân tộc thiểu số' },
            { key: 'disabled', label: 'Khuyết tật' },
            { key: 'two_sessions_students', label: 'Học 2 buổi/ngày' },
            { key: 'boarding_students', label: 'Bán trú' },
          ]}
          rows={[...report.data.rows, report.data.totals]}
        />
      ) : null}
    </div>
  );
}

function AssessmentsTab({ orgUnitId }: { orgUnitId: string | undefined }) {
  const [group, setGroup] = useState<ReportGroup>('grade');
  const [periodId, setPeriodId] = useState('');
  const periods = useQuery({ queryKey: ['primary-periods'], queryFn: readPeriods });
  const selected = periodId || periods.data?.periods[0]?.id || '';
  const params = { org_unit_id: orgUnitId, period_id: selected, group };
  const report = useQuery({
    queryKey: ['primary-assessments', orgUnitId, selected, group],
    queryFn: () =>
      readReport<{
        levels: Array<{ scale: string; code: string; name: string }>;
        subjects: Array<Record<string, unknown>>;
        competencies: Array<Record<string, unknown>>;
      }>('assessments', params),
    enabled: selected !== '',
    retry: false,
  });
  const data = report.data;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Kỳ đánh giá
          <select value={selected} onChange={(event) => setPeriodId(event.target.value)} className={SELECT_CLASS}>
            {(periods.data?.periods ?? []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </label>
        <GroupSelect value={group} onChange={setGroup} />
        <ExportButtons onExport={(format) => exportReport('assessments', params, format)} />
      </div>
      {periods.data && periods.data.periods.length === 0 ? (
        <Alert tone="info">Chưa có kỳ đánh giá Tiểu học (cấu hình ở 7.5 Đánh giá học sinh).</Alert>
      ) : null}
      {report.error ? <Alert tone="warning">{messageOf(report.error)}</Alert> : null}
      {data ? (
        <>
          <Table
            label="Kết quả môn học"
            columns={[
              { key: 'group_label', label: 'Lớp, khối' },
              { key: 'subject_name', label: 'Môn học, hoạt động' },
              ...data.levels
                .filter((level) => level.scale === 'subject')
                .map((level) => ({ key: `level_${level.code}`, label: level.name })),
              { key: 'score_9-10', label: 'Điểm 9-10' },
              { key: 'score_7-8', label: 'Điểm 7-8' },
              { key: 'score_5-6', label: 'Điểm 5-6' },
              { key: 'score_duoi-5', label: 'Dưới 5' },
            ]}
            rows={data.subjects}
          />
          <Table
            label="Kết quả phẩm chất, năng lực"
            columns={[
              { key: 'group_label', label: 'Lớp, khối' },
              { key: 'item_name', label: 'Phẩm chất, năng lực' },
              ...data.levels
                .filter((level) => level.scale === 'competency')
                .map((level) => ({ key: `level_${level.code}`, label: level.name })),
            ]}
            rows={data.competencies}
          />
        </>
      ) : null}
    </div>
  );
}

function YearEndTab({ orgUnitId }: { orgUnitId: string | undefined }) {
  const [group, setGroup] = useState<ReportGroup>('grade');
  const params = { org_unit_id: orgUnitId, group };
  const report = useQuery({
    queryKey: ['primary-year-end', orgUnitId, group],
    queryFn: () => readReport<{ rows: Array<Record<string, unknown>> }>('year-end', params),
    retry: false,
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <GroupSelect value={group} onChange={setGroup} />
        <ExportButtons onExport={(format) => exportReport('year-end', params, format)} />
      </div>
      {report.error ? <Alert tone="warning">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <Table
          label="Kết quả cuối năm"
          columns={[
            { key: 'label', label: 'Lớp, khối' },
            { key: 'students', label: 'Học sinh' },
            ...Object.entries(YEAR_RESULT_LABELS).map(([key, label]) => ({ key, label })),
            { key: 'not_confirmed', label: 'Chưa xác nhận' },
            ...Object.entries(COMPLETION_OUTCOME_LABELS).map(([key, label]) => ({ key, label })),
            { key: 'awarded', label: 'Được khen thưởng' },
          ]}
          rows={report.data.rows}
        />
      ) : null}
    </div>
  );
}

function AttendanceTab({ orgUnitId }: { orgUnitId: string | undefined }) {
  const today = vietnamToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const params = { org_unit_id: orgUnitId, from, to };
  const report = useQuery({
    queryKey: ['primary-attendance', orgUnitId, from, to],
    queryFn: () =>
      readReport<{ rows: Array<Record<string, unknown>>; totals: Record<string, unknown> }>('attendance', params),
    enabled: from !== '' && to !== '',
    retry: false,
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <ExportButtons onExport={(format) => exportReport('attendance', params, format)} />
      </div>
      {report.error ? <Alert tone="warning">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <Table
          label="Chuyên cần, bán trú theo lớp"
          columns={[
            { key: 'class_name', label: 'Lớp' },
            { key: 'students', label: 'Học sinh' },
            { key: 'lessons', label: 'Tiết đã ghi sổ' },
            { key: 'present', label: 'Có mặt' },
            { key: 'late', label: 'Đi muộn' },
            { key: 'absent_excused', label: 'Vắng có phép' },
            { key: 'absent_unexcused', label: 'Vắng không phép' },
            { key: 'meal_days', label: 'Ngày đã chốt suất' },
            { key: 'meals', label: 'Suất ăn' },
            { key: 'meal_cuts', label: 'Lượt cắt suất' },
          ]}
          rows={[...report.data.rows, report.data.totals]}
        />
      ) : null}
    </div>
  );
}

// Biểu EMIS cấu hình được; `base` chọn biểu Tiểu học (mặc định) hoặc THCS, THPT (21g)
export function EmisTab({ onSaved, base = 'primary-reports' }: { onSaved(message: string): void; base?: EmisBase }) {
  const queryClient = useQueryClient();
  const forms = useQuery({ queryKey: ['emis-forms', base], queryFn: () => listEmisForms(base) });
  const [code, setCode] = useState('');
  const selected = code || forms.data?.[0]?.code || '';
  const view = useQuery({
    queryKey: ['emis-form', base, selected],
    queryFn: () => readEmis(selected, base),
    enabled: selected !== '',
    retry: false,
  });
  const [manual, setManual] = useState<Record<string, Record<string, string>>>({});
  const [sectionCode, setSectionCode] = useState('');
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Array<Omit<EmisRow, 'values'>>>([]);
  useEffect(() => {
    if (view.data) {
      setManual(
        Object.fromEntries(
          view.data.rows
            .filter((row) => row.kind === 'manual')
            .map((row) => [
              row.code,
              Object.fromEntries(
                Object.entries(row.values).map(([key, value]) => [key, value === null ? '' : String(value)]),
              ),
            ]),
        ),
      );
      setRows(
        view.data.rows.map((row) => ({
          code: row.code,
          label: row.label,
          unit: row.unit,
          kind: row.kind,
          formula: row.formula,
        })),
      );
    }
  }, [view.data]);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['emis-form', base, selected] });
    onSaved(message);
  };
  const saveValues = useMutation({
    mutationFn: () =>
      saveEmisValues(
        selected,
        Object.entries(manual).map(([rowCode, values]) => ({
          code: rowCode,
          values: Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === '' ? null : Number(value)]),
          ),
        })),
        base,
      ),
    onSuccess: () => refresh('Đã lưu số nhập tay'),
  });
  const saveRows = useMutation({
    mutationFn: () => saveEmisRows(selected, rows, base),
    onSuccess: async () => {
      setEditing(false);
      await refresh('Đã lưu khung biểu');
    },
  });
  const data = view.data;
  const error = view.error ?? saveValues.error ?? saveRows.error;
  const updateRow = (index: number, field: 'code' | 'label' | 'unit' | 'kind' | 'formula', value: string) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, [field]: value || null } : row)));
  // Biểu Thông tư 25/2024 chia phần, mỗi phần một bộ cột (YCTD-385); biểu cũ là một phần `main`
  const sections =
    data?.sections && data.sections.length > 0
      ? data.sections
      : [{ code: 'main', name: '', columns: data?.columns ?? [], ownership_groups: false }];
  const section = sections.find((item) => item.code === sectionCode) ?? sections[0]!;
  const sectionRows = (data?.rows ?? []).filter((row) => (row.section ?? 'main') === section.code);
  const indent = (label: string) => (label.startsWith('+') ? 'pl-8' : label.startsWith('-') ? 'pl-5' : 'px-2');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Biểu
          <select value={selected} onChange={(event) => setCode(event.target.value)} className={SELECT_CLASS}>
            {(forms.data ?? []).map((form) => (
              <option key={form.code} value={form.code}>
                {form.name}
              </option>
            ))}
          </select>
        </label>
        {selected ? <ExportButtons onExport={(format) => exportEmis(selected, format, base)} /> : null}
        {data?.can_edit_form ? (
          <Button onClick={() => setEditing(!editing)}>{editing ? 'Thôi sửa khung' : 'Sửa khung biểu'}</Button>
        ) : null}
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {data?.note ? <p className="text-label text-text-secondary">{data.note}</p> : null}
      {data?.locked ? (
        <Alert tone="info">Biểu đã gửi lên cấp trên; mở khoá ở trang gửi lên cấp trên trước khi sửa số nhập tay.</Alert>
      ) : null}
      {data && data.warnings.length > 0 ? <Alert tone="warning">{data.warnings.join('; ')}</Alert> : null}
      {data && !editing && sections.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Phần của biểu">
          {sections.map((item) => (
            <Button
              key={item.code}
              role="tab"
              aria-selected={item.code === section.code}
              variant={item.code === section.code ? 'primary' : 'secondary'}
              className="shrink-0"
              onClick={() => setSectionCode(item.code)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      ) : null}
      {data && !editing ? (
        <div className="relative overflow-x-auto">
          <table className="w-full text-content" aria-label={section.name ? `${data.name}: ${section.name}` : data.name}>
            <thead className="text-left text-label font-medium text-text-secondary">
              {section.ownership_groups && data.ownership_label ? (
                <tr>
                  <th colSpan={3} />
                  <th colSpan={section.columns.length} className="px-2 py-2 text-center text-text">
                    {data.ownership_label}
                  </th>
                </tr>
              ) : null}
              <tr>
                <th className="sticky left-0 bg-card px-2 py-2">Chỉ tiêu</th>
                <th className="px-2 py-2">Mã số</th>
                <th className="px-2 py-2">Đơn vị</th>
                {section.columns.map((column) => (
                  <th key={column.key} className="px-2 py-2 text-right">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((row) => (
                <tr
                  key={row.code}
                  className={`border-t border-border ${row.kind === 'heading' ? 'font-semibold' : ''}`}
                >
                  <td className={`sticky left-0 min-w-48 bg-card py-2 pr-2 ${indent(row.label)}`}>
                    {row.label}
                    {row.kind === 'manual' && data.source === 'tt25' ? (
                      <span className="block text-label font-medium text-warning">Nhập tay</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">{row.kind === 'heading' || /^T\d+$/.test(row.code) ? '' : row.code}</td>
                  <td className="px-2 py-2">{row.unit ?? ''}</td>
                  {section.columns.map((column) => (
                    <td key={column.key} className="px-2 py-2">
                      {row.kind === 'manual' ? (
                        <input
                          aria-label={`${row.label} ${column.label}`}
                          inputMode="numeric"
                          className="w-16 rounded-lg border border-border bg-card px-2 py-1"
                          value={manual[row.code]?.[column.key] ?? ''}
                          disabled={!data.can_edit_values || data.locked}
                          onChange={(event) =>
                            setManual({
                              ...manual,
                              [row.code]: {
                                ...(manual[row.code] ?? {}),
                                [column.key]: event.target.value.replace(/\D/g, ''),
                              },
                            })
                          }
                        />
                      ) : row.values[column.key] === null || row.values[column.key] === undefined ? (
                        ''
                      ) : (
                        String(row.values[column.key])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {data && !editing && data.can_edit_values && !data.locked && data.rows.some((row) => row.kind === 'manual') ? (
        <div>
          <Button variant="primary" disabled={saveValues.isPending} onClick={() => saveValues.mutate()}>
            Lưu số nhập tay
          </Button>
        </div>
      ) : null}
      {data && editing ? (
        <section className="flex flex-col gap-2" aria-label="Sửa khung biểu">
          <p className="text-label text-text-secondary">
            Công thức: students hoặc classes, thêm điều kiện bằng dấu chấm: grade=K1, two_sessions, boarding, awarded,
            year_result=excellent|good|completed|not_completed,
            completion=promoted|level_completed|pending_support|retained.
          </p>
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <input
                aria-label={`Mã dòng ${index + 1}`}
                className="w-16 rounded-lg border border-border bg-card px-2 py-1"
                value={row.code}
                onChange={(event) => updateRow(index, 'code', event.target.value)}
              />
              <input
                aria-label={`Chỉ tiêu dòng ${index + 1}`}
                className="min-w-64 flex-1 rounded-lg border border-border bg-card px-2 py-1"
                value={row.label}
                onChange={(event) => updateRow(index, 'label', event.target.value)}
              />
              <select
                aria-label={`Loại dòng ${index + 1}`}
                value={row.kind}
                onChange={(event) => updateRow(index, 'kind', event.target.value as RowKind)}
                className="rounded-lg border border-border bg-card px-2 py-1"
              >
                <option value="heading">Đề mục</option>
                <option value="formula">Công thức</option>
                <option value="manual">Nhập tay</option>
              </select>
              <input
                aria-label={`Công thức dòng ${index + 1}`}
                className="w-72 rounded-lg border border-border bg-card px-2 py-1"
                value={row.formula ?? ''}
                disabled={row.kind !== 'formula'}
                onChange={(event) => updateRow(index, 'formula', event.target.value)}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              onClick={() =>
                setRows([...rows, { code: '', label: '', unit: null, kind: 'formula', formula: 'students' }])
              }
            >
              Thêm dòng
            </Button>
            <Button variant="primary" disabled={saveRows.isPending} onClick={() => saveRows.mutate()}>
              Lưu khung biểu
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function PrimaryReportsPage() {
  const canStatistics = useHasPermission(PERMISSION_CODES.childStatisticsView);
  const canEmis = useHasPermission('P17.report.emis');
  const unitChoice = useUnitChoice();
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((code) => (code === 'emis' ? canEmis : canStatistics));
  const [tab, setTab] = useState<Tab | ''>('');
  const current = tab || tabs[0] || 'enrollment';
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/primary-reports')}</h1>
        <div className="flex flex-wrap items-end gap-4">
          {current !== 'emis' ? (
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          ) : null}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Báo cáo, thống kê Tiểu học">
            {tabs.map((code) => (
              <Button
                key={code}
                role="tab"
                aria-selected={current === code}
                variant={current === code ? 'primary' : 'secondary'}
                onClick={() => setTab(code)}
              >
                {TAB_LABELS[code]}
              </Button>
            ))}
          </div>
        </div>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {current === 'enrollment' ? <EnrollmentTab orgUnitId={unitChoice.selectedId} /> : null}
          {current === 'assessments' ? <AssessmentsTab orgUnitId={unitChoice.selectedId} /> : null}
          {current === 'year-end' ? <YearEndTab orgUnitId={unitChoice.selectedId} /> : null}
          {current === 'attendance' ? <AttendanceTab orgUnitId={unitChoice.selectedId} /> : null}
          {current === 'emis' ? <EmisTab onSaved={setToastMessage} /> : null}
        </section>
      </div>
    </AppShell>
  );
}
