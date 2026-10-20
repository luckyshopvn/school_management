import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES, type PortalQuickLinkPath } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { messageOf, selectClass, useArchiveUnits } from '../archives/archive-ui.js';
import { exportReport, readReport, type ReportFilter, type ReportKind } from './directives-api.js';
import { Page, shiftDate, todayText } from './directive-ui.js';

// Báo cáo theo VNPT iOffice (DT-18 phần 18c, YCTD-141): 6.1 Báo cáo thực hiện văn bản đến (kèm đánh giá: tỷ lệ đúng hạn),
// 6.2 Báo cáo tổng hợp (thống kê theo đơn vị độc lập), 6.3 Thống kê số liệu trong đơn vị; lọc Đơn vị, Từ ngày, Đến ngày;
// Xuất Excel, Xuất PDF
interface ProcessingReport {
  rows: Array<Record<string, string | number>>;
  totals: Record<string, number>;
}
interface SummaryReport {
  rows: Array<Record<string, string | number>>;
}
interface StatisticsReport {
  sections: Array<{ title: string; rows: Array<{ label: string; count: number }> }>;
  total_documents: number;
  total_assignments: number;
}

function Table({ columns, rows }: { columns: Array<[string, string]>; rows: Array<Record<string, ReactNode>> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-content">
        <thead>
          <tr className="border-b border-border text-left text-label text-text-secondary">
            {columns.map(([key, label]) => (
              <th key={key} className="p-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="p-3 text-text-secondary" colSpan={columns.length}>
                Không có số liệu trong khoảng ngày đã chọn.
              </td>
            </tr>
          ) : null}
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border">
              {columns.map(([key]) => (
                <td key={key} className="p-2">
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportPage<Result>({
  kind,
  path,
  render,
}: {
  kind: ReportKind;
  path: PortalQuickLinkPath;
  render(result: Result): ReactNode;
}) {
  const units = useArchiveUnits(PERMISSION_CODES.documentReportView);
  const [draft, setDraft] = useState<ReportFilter>({
    from: `${todayText().slice(0, 4)}-01-01`,
    to: todayText(),
    org_unit_id: '',
  });
  const [filter, setFilter] = useState<ReportFilter>(draft);
  const [exportError, setExportError] = useState<string>();
  const report = useQuery({ queryKey: ['document-report', kind, filter], queryFn: () => readReport<Result>(kind, filter) });
  const download = (format: 'xlsx' | 'pdf') => {
    setExportError(undefined);
    exportReport(kind, filter, format).catch((error: unknown) => setExportError(messageOf(error)));
  };
  return (
    <Page path={path}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-label font-medium text-text">
          Đơn vị
          <select
            className={selectClass}
            value={draft.org_unit_id}
            onChange={(event) => setDraft((current) => ({ ...current, org_unit_id: event.target.value }))}
          >
            <option value="">{units.wholeSchool ? 'Thống kê theo đơn vị độc lập (tất cả)' : 'Các đơn vị được gán'}</option>
            {units.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Từ ngày (*)
          <input
            type="date"
            className={selectClass}
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label className="text-label font-medium text-text">
          Đến ngày (*)
          <input
            type="date"
            className={selectClass}
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setFilter(draft)}>
          Xem báo cáo
        </Button>
        <Button variant="secondary" onClick={() => download('xlsx')}>
          Xuất Excel
        </Button>
        <Button variant="secondary" onClick={() => download('pdf')}>
          Xuất PDF
        </Button>
        <Button variant="text" onClick={() => setDraft({ ...draft, from: shiftDate(todayText(), -30), to: todayText() })}>
          30 ngày gần đây
        </Button>
      </div>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
      {report.data ? render(report.data) : null}
    </Page>
  );
}

export function IncomingReportPage() {
  return (
    <ReportPage<ProcessingReport>
      kind="incoming"
      path="/document-reports/incoming"
      render={(report) => (
        <Table
          columns={[
            ['org_unit_name', 'Đơn vị'],
            ['handler_name', 'Người xử lý chính'],
            ['total', 'Tổng số'],
            ['done_on_time', 'Đã xử lý đúng hạn'],
            ['done_late', 'Đã xử lý quá hạn'],
            ['open_on_time', 'Đang xử lý trong hạn'],
            ['open_late', 'Đang xử lý quá hạn'],
            ['on_time_rate', 'Tỷ lệ đúng hạn (%)'],
          ]}
          rows={[...report.rows, ...(report.rows.length ? [{ org_unit_name: 'Tổng cộng', handler_name: '', ...report.totals }] : [])]}
        />
      )}
    />
  );
}

export function SummaryReportPage() {
  return (
    <ReportPage<SummaryReport>
      kind="summary"
      path="/document-reports/summary"
      render={(report) => (
        <Table
          columns={[
            ['org_unit_name', 'Đơn vị'],
            ['incoming_total', 'Văn bản đến xử lý chính'],
            ['incoming_done', 'Đã xử lý'],
            ['incoming_late', 'Quá hạn'],
            ['task_total', 'Công việc được giao'],
            ['task_done_on_time', 'Hoàn thành đúng hạn'],
            ['task_done_late', 'Hoàn thành quá hạn'],
            ['task_open', 'Đang thực hiện'],
            ['task_overdue', 'Quá hạn chưa xong'],
            ['schedule_count', 'Lịch công tác đã công bố'],
          ]}
          rows={report.rows}
        />
      )}
    />
  );
}

export function StatisticsReportPage() {
  return (
    <ReportPage<StatisticsReport>
      kind="statistics"
      path="/document-reports/statistics"
      render={(report) => (
        <div className="flex flex-col gap-4">
          <p className="text-content">
            Tổng số văn bản đến: <span className="font-semibold">{report.total_documents}</span>; phân công công việc:{' '}
            <span className="font-semibold">{report.total_assignments}</span>
          </p>
          {report.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h2 className="text-section-title font-semibold text-text">{section.title}</h2>
              <Table
                columns={[
                  ['label', 'Nội dung'],
                  ['count', 'Số lượng'],
                ]}
                rows={section.rows}
              />
            </section>
          ))}
        </div>
      )}
    />
  );
}
