import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { ApiError } from '../session/api-client.js';
import {
  exportReport,
  readConsolidatedReport,
  readExportLogs,
  readOperationsReport,
  type ReportRow,
} from './reports-api.js';
import { ReportTable, type Column } from './ReportTable.js';

// Báo cáo giai đoạn 2 (P17-10, P17-11, P17-12; BR-01, BR-74; YCTD-83): báo cáo hoạt động của đơn vị, báo cáo hợp nhất so
// sánh các đơn vị (MH-29), nút xuất Excel và nhật ký xuất. Giao diện chỉ hiển thị số liệu máy chủ trả về
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const firstOfMonth = () => `${today().slice(0, 7)}-01`;
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');

export function ExportButton({ code, filters }: { code: string; filters: Record<string, string | null | undefined> }) {
  const download = useMutation({ mutationFn: () => exportReport(code, filters) });
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>
        Xuất Excel
      </Button>
      {download.error ? <Alert tone="danger">{messageOf(download.error)}</Alert> : null}
      {download.isSuccess ? (
        <span className="text-label text-text-secondary">Đã xuất tệp, có ghi nhật ký xuất</span>
      ) : null}
    </div>
  );
}

export function OperationsView() {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [applied, setApplied] = useState<Record<string, string | null>>();
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const report = useQuery({
    queryKey: ['report', 'activities', applied],
    queryFn: () => readOperationsReport(applied ?? {}),
    enabled: applied !== undefined,
    retry: false,
  });
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Bộ lọc báo cáo hoạt động"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ org_unit_id: orgUnitId || null, class_id: classId || null, from, to });
        }}
      >
        <UnitSelect
          units={[{ id: '', name: 'Tất cả trong phạm vi' } as (typeof unitChoice.units)[number], ...unitChoice.units]}
          selectedId={orgUnitId}
          onSelect={(id) => {
            setOrgUnitId(id);
            setClassId('');
          }}
        />
        <label className="flex flex-col gap-1 text-label text-text-secondary">
          Lớp
          <select
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            disabled={orgUnitId === ''}
          >
            <option value="">Tất cả lớp</option>
            {(classes.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button type="submit" variant="primary">
          Xem báo cáo
        </Button>
      </form>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data?.sections.map((section) => (
        <ReportTable key={section.code} title={section.title} columns={section.columns} rows={section.rows} />
      ))}
    </div>
  );
}

const CONSOLIDATED_COLUMNS: Column[] = [
  { key: 'org_unit_name', label: 'Đơn vị' },
  { key: 'children_count', label: 'Số trẻ' },
  { key: 'classes_count', label: 'Số lớp' },
  { key: 'staff_count', label: 'Số nhân sự' },
  { key: 'attendance_rate_percent', label: 'Tỷ lệ đi học (%)' },
  { key: 'tuition_payable_amount', label: 'Học phí phải thu' },
  { key: 'tuition_paid_amount', label: 'Học phí đã thu' },
  { key: 'tuition_collection_percent', label: 'Tỷ lệ thu (%)' },
  { key: 'debt_outstanding_amount', label: 'Công nợ' },
  { key: 'debt_overdue_amount', label: 'Nợ quá hạn' },
  { key: 'income_amount', label: 'Tổng thu' },
  { key: 'expense_amount', label: 'Tổng chi' },
  { key: 'difference_amount', label: 'Chênh lệch' },
];

export function ConsolidatedView({ canExport }: { canExport: boolean }) {
  const unitChoice = useUnitChoice();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [chosenUnits, setChosenUnits] = useState<string[]>([]);
  const [applied, setApplied] = useState<{ month: string; units: string[] }>();
  const report = useQuery({
    queryKey: ['report', 'consolidated', applied],
    queryFn: () => readConsolidatedReport(applied?.month ?? '', applied?.units ?? []),
    enabled: applied !== undefined,
    retry: false,
  });
  const rows: ReportRow[] = report.data
    ? [...report.data.units, { ...report.data.totals, org_unit_name: 'Tổng các đơn vị đã chọn' }]
    : [];
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Bộ lọc báo cáo hợp nhất"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ month, units: chosenUnits });
        }}
      >
        <div className="w-44">
          <TextField label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
        <fieldset className="flex flex-wrap gap-3" aria-label="Đơn vị so sánh">
          {unitChoice.units.map((unit) => (
            <label key={unit.id} className="flex items-center gap-1 text-content text-text">
              <input
                type="checkbox"
                checked={chosenUnits.includes(unit.id)}
                onChange={(event) =>
                  setChosenUnits((current) =>
                    event.target.checked ? [...current, unit.id] : current.filter((id) => id !== unit.id),
                  )
                }
              />
              {unit.name}
            </label>
          ))}
        </fieldset>
        <Button type="submit" variant="primary">
          Xem báo cáo
        </Button>
        {canExport ? (
          <ExportButton code="consolidated" filters={{ month, org_unit_ids: chosenUnits.join(',') }} />
        ) : null}
      </form>
      <p className="text-label text-text-secondary">
        Không chọn đơn vị nào là so sánh mọi đơn vị. Báo cáo chỉ có số liệu tổng hợp, không có dữ liệu cá nhân.
      </p>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data ? <ReportTable title="So sánh theo đơn vị" columns={CONSOLIDATED_COLUMNS} rows={rows} /> : null}
    </div>
  );
}

const REPORT_NAMES: Record<string, string> = {
  tuition: 'Học phí',
  debts: 'Công nợ',
  'cash-flow': 'Thu chi',
  attendance: 'Điểm danh',
  'attendance-meals': 'Điểm danh và suất ăn',
  'staff-attendance': 'Chấm công',
  'saturday-classes': 'Học thứ 7',
  consolidated: 'Hợp nhất đơn vị',
};

export function ExportLogsView() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const logs = useQuery({
    queryKey: ['export-logs', from, to],
    queryFn: () => readExportLogs(from, to),
    retry: false,
  });
  const rows: ReportRow[] = (logs.data ?? []).map((log) => ({
    exported_at: new Date(log.exported_at).toLocaleString('vi-VN'),
    actor_name: log.actor_name,
    report: REPORT_NAMES[log.report_code] ?? log.report_code,
    row_count: log.row_count,
    personal: log.contains_personal_data ? 'Có' : 'Không',
    file_name: log.file_name,
  }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      {logs.error ? <Alert tone="danger">{messageOf(logs.error)}</Alert> : null}
      <ReportTable
        title="Các lần xuất dữ liệu"
        columns={[
          { key: 'exported_at', label: 'Thời điểm' },
          { key: 'actor_name', label: 'Người xuất' },
          { key: 'report', label: 'Báo cáo' },
          { key: 'row_count', label: 'Số dòng' },
          { key: 'personal', label: 'Dữ liệu cá nhân' },
          { key: 'file_name', label: 'Tên tệp' },
        ]}
        rows={rows}
      />
    </div>
  );
}
