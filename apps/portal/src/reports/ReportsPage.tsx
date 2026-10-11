import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { formatNumber, readReport, type ReportRow } from './reports-api.js';

// MH-28 Báo cáo cơ bản (P17-03 đến P17-07, P17-14; BR-36; YCTD-62): mỗi báo cáo một thẻ, chỉ hiện báo cáo người dùng có
// quyền; số liệu do máy chủ tính, giao diện chỉ hiển thị
type ReportCode = 'tuition' | 'debts' | 'cash-flow' | 'attendance' | 'staff-attendance' | 'saturday-classes';

interface Column {
  key: string;
  label: string;
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const firstOfMonth = () => `${today().slice(0, 7)}-01`;

const REPORTS: Array<{ code: ReportCode; label: string; filter: 'month' | 'range' | 'overdue' }> = [
  { code: 'tuition', label: 'Học phí', filter: 'month' },
  { code: 'debts', label: 'Công nợ', filter: 'overdue' },
  { code: 'cash-flow', label: 'Thu chi', filter: 'range' },
  { code: 'attendance', label: 'Điểm danh', filter: 'range' },
  { code: 'staff-attendance', label: 'Chấm công', filter: 'month' },
  { code: 'saturday-classes', label: 'Học thứ 7', filter: 'range' },
];

const TABLES: Record<ReportCode, Array<{ key: string; title: string; columns: Column[] }>> = {
  tuition: [
    {
      key: 'classes',
      title: 'Theo lớp',
      columns: [
        { key: 'class_name', label: 'Lớp' },
        { key: 'invoice_count', label: 'Số hóa đơn' },
        { key: 'total_amount', label: 'Phải thu' },
        { key: 'discount_amount', label: 'Giảm trừ' },
        { key: 'adjustment_amount', label: 'Điều chỉnh' },
        { key: 'payable_amount', label: 'Còn phải thu' },
        { key: 'paid_amount', label: 'Đã thu' },
        { key: 'outstanding_amount', label: 'Còn nợ' },
      ],
    },
  ],
  debts: [
    {
      key: 'classes',
      title: 'Theo lớp',
      columns: [
        { key: 'class_name', label: 'Lớp' },
        { key: 'child_count', label: 'Số trẻ' },
        { key: 'outstanding_amount', label: 'Còn nợ' },
        { key: 'overdue_amount', label: 'Quá hạn' },
        { key: 'credit_amount', label: 'Số dư có' },
      ],
    },
    {
      key: 'children',
      title: 'Theo trẻ',
      columns: [
        { key: 'full_name', label: 'Trẻ' },
        { key: 'class_name', label: 'Lớp' },
        { key: 'outstanding_amount', label: 'Còn nợ' },
        { key: 'overdue_amount', label: 'Quá hạn' },
        { key: 'overdue_days', label: 'Số ngày quá hạn' },
      ],
    },
  ],
  'cash-flow': [
    {
      key: 'categories',
      title: 'Theo khoản mục',
      columns: [
        { key: 'flow_type', label: 'Loại' },
        { key: 'category_name', label: 'Khoản mục' },
        { key: 'count', label: 'Số chứng từ' },
        { key: 'amount', label: 'Số tiền' },
      ],
    },
    {
      key: 'documents',
      title: 'Chứng từ',
      columns: [
        { key: 'document_date', label: 'Ngày' },
        { key: 'code', label: 'Số' },
        { key: 'flow_type', label: 'Loại' },
        { key: 'category_name', label: 'Khoản mục' },
        { key: 'party', label: 'Người nộp hoặc nhận' },
        { key: 'amount', label: 'Số tiền' },
      ],
    },
  ],
  attendance: [
    {
      key: 'classes',
      title: 'Tỷ lệ đi học theo lớp',
      columns: [
        { key: 'class_name', label: 'Lớp' },
        { key: 'present', label: 'Lượt đi học' },
        { key: 'absent_notified', label: 'Vắng có báo' },
        { key: 'absent_unnotified', label: 'Vắng không báo' },
        { key: 'rate_percent', label: 'Tỷ lệ đi học (%)' },
      ],
    },
    {
      key: 'absences',
      title: 'Trẻ vắng',
      columns: [
        { key: 'attendance_date', label: 'Ngày' },
        { key: 'class_name', label: 'Lớp' },
        { key: 'full_name', label: 'Trẻ' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'note', label: 'Ghi chú' },
      ],
    },
  ],
  'staff-attendance': [
    {
      key: 'staff',
      title: 'Theo nhân sự',
      columns: [
        { key: 'full_name', label: 'Nhân sự' },
        { key: 'department_name', label: 'Phòng ban' },
        { key: 'present_days', label: 'Ngày đi làm' },
        { key: 'leave_days', label: 'Nghỉ theo đơn' },
        { key: 'absent_days', label: 'Vắng' },
        { key: 'late_count', label: 'Lần đi muộn' },
        { key: 'early_leave_count', label: 'Lần về sớm' },
        { key: 'overtime_minutes', label: 'Phút làm thêm' },
      ],
    },
  ],
  'saturday-classes': [
    {
      key: 'days',
      title: 'Các ngày học bù',
      columns: [
        { key: 'date', label: 'Ngày' },
        { key: 'note', label: 'Ghi chú' },
        { key: 'present_count', label: 'Số trẻ đi học' },
        { key: 'absent_count', label: 'Số trẻ vắng' },
      ],
    },
  ],
};

const LABELS: Record<string, string> = {
  income: 'Thu',
  expense: 'Chi',
  absent_notified: 'Vắng có báo',
  absent_unnotified: 'Vắng không báo',
};

function ReportTable({ rows, columns, title }: { rows: ReportRow[]; columns: Column[]; title: string }) {
  return (
    <section
      className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
      aria-label={title}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-content text-text-secondary">Không có số liệu.</p>
      ) : (
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td key={column.key} className="px-3 py-2">
                      {typeof value === 'string' && LABELS[value] ? LABELS[value] : formatNumber(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ReportView({ code, filter }: { code: ReportCode; filter: 'month' | 'range' | 'overdue' }) {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState<string>('');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [overdueDays, setOverdueDays] = useState('');
  const [applied, setApplied] = useState<Record<string, string | null>>({});
  const values = {
    org_unit_id: orgUnitId || null,
    ...(filter === 'month' ? { month } : {}),
    ...(filter === 'range' ? { from, to } : {}),
    ...(filter === 'overdue' ? { minimum_overdue_days: overdueDays || null } : {}),
  };
  const report = useQuery({
    queryKey: ['report', code, applied],
    queryFn: () => readReport(code, applied),
    enabled: Object.keys(applied).length > 0,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Bộ lọc báo cáo"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(values);
        }}
      >
        <div className="flex flex-col gap-2">
          <UnitSelect
            units={[{ id: '', name: 'Tất cả trong phạm vi' } as (typeof unitChoice.units)[number], ...unitChoice.units]}
            selectedId={orgUnitId}
            onSelect={setOrgUnitId}
          />
        </div>
        {filter === 'month' ? (
          <div className="w-44">
            <TextField label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
        ) : null}
        {filter === 'range' ? (
          <>
            <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </>
        ) : null}
        {filter === 'overdue' ? (
          <div className="w-56">
            <TextField
              label="Quá hạn từ (ngày)"
              type="number"
              value={overdueDays}
              onChange={(event) => setOverdueDays(event.target.value)}
            />
          </div>
        ) : null}
        <Button type="submit" variant="primary">
          Xem báo cáo
        </Button>
      </form>
      {report.error ? (
        <Alert tone="danger">
          {report.error instanceof ApiError ? report.error.message : 'Không kết nối được tới máy chủ'}
        </Alert>
      ) : null}
      {report.data && report.data.totals ? (
        <p className="text-content text-text" aria-label="Tổng cộng">
          {Object.entries(report.data.totals as Record<string, number>)
            .map(([key, value]) => `${TOTAL_LABELS[key] ?? key}: ${formatNumber(value)}`)
            .join('; ')}
        </p>
      ) : null}
      {report.data
        ? TABLES[code].map((table) => (
            <ReportTable
              key={table.key}
              title={table.title}
              columns={table.columns}
              rows={(report.data[table.key] as ReportRow[] | undefined) ?? []}
            />
          ))
        : null}
    </div>
  );
}

const TOTAL_LABELS: Record<string, string> = {
  invoice_count: 'Số hóa đơn',
  total_amount: 'Phải thu',
  discount_amount: 'Giảm trừ',
  adjustment_amount: 'Điều chỉnh',
  payable_amount: 'Còn phải thu',
  paid_amount: 'Đã thu',
  outstanding_amount: 'Còn nợ',
  overdue_amount: 'Quá hạn',
  credit_amount: 'Số dư có',
  income_amount: 'Tổng thu',
  expense_amount: 'Tổng chi',
  difference_amount: 'Chênh lệch',
};

export function ReportsPage() {
  const canAttendance = useHasPermission(PERMISSION_CODES.attendanceReport);
  const isClassStaff = useHasPermission('P04.view');
  const permissions: Record<ReportCode, boolean> = {
    tuition: useHasPermission(PERMISSION_CODES.tuitionReport),
    debts: useHasPermission(PERMISSION_CODES.debtReport),
    'cash-flow': useHasPermission(PERMISSION_CODES.cashFlowReport),
    attendance: canAttendance || isClassStaff,
    'staff-attendance': useHasPermission(PERMISSION_CODES.staffAttendanceReport),
    'saturday-classes': useHasPermission(PERMISSION_CODES.saturdayReport),
  };
  const available = REPORTS.filter((report) => permissions[report.code]);
  const [chosen, setChosen] = useState<ReportCode>();
  const selected = available.find((report) => report.code === chosen) ?? available[0];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Báo cáo</h1>
        {available.length === 0 ? (
          <p className="text-content text-text-secondary">Bạn chưa có quyền xem báo cáo nào.</p>
        ) : null}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại báo cáo">
          {available.map((report) => (
            <Button
              key={report.code}
              role="tab"
              aria-selected={report.code === selected?.code}
              variant={report.code === selected?.code ? 'primary' : 'secondary'}
              onClick={() => setChosen(report.code)}
            >
              {report.label}
            </Button>
          ))}
        </div>
        {selected ? <ReportView key={selected.code} code={selected.code} filter={selected.filter} /> : null}
      </div>
    </AppShell>
  );
}
