import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { ConsolidatedView, ExportButton, ExportLogsView, OperationsView } from './PhaseTwoReports.js';
import { formatNumber, readReport, type ReportRow } from './reports-api.js';
import { ReportTable, type Column } from './ReportTable.js';

// MH-28 Báo cáo cơ bản (P17-03 đến P17-07, P17-14; BR-36; YCTD-62): mỗi báo cáo một thẻ, chỉ hiện báo cáo người dùng có
// quyền; số liệu do máy chủ tính, giao diện chỉ hiển thị. Giai đoạn 2 (YCTD-83) thêm thẻ báo cáo hoạt động (P17-10), báo
// cáo hợp nhất (MH-29, P17-11), nhật ký xuất và nút xuất Excel cho người có quyền xuất dữ liệu (P17-12)
type ReportCode = 'tuition' | 'debts' | 'cash-flow' | 'attendance' | 'staff-attendance' | 'saturday-classes';
type TabCode = ReportCode | 'activities' | 'consolidated' | 'export-logs';

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
      key: 'groups',
      title: 'Theo nhóm',
      columns: [
        { key: 'flow_type', label: 'Loại' },
        { key: 'group_name', label: 'Nhóm' },
        { key: 'count', label: 'Số chứng từ' },
        { key: 'amount', label: 'Số tiền' },
      ],
    },
    {
      key: 'periods',
      title: 'Theo tháng',
      columns: [
        { key: 'period', label: 'Tháng' },
        { key: 'income_amount', label: 'Thu' },
        { key: 'expense_amount', label: 'Chi' },
      ],
    },
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

function ReportView({
  code,
  filter,
  canExport,
}: {
  code: ReportCode;
  filter: 'month' | 'range' | 'overdue';
  canExport: boolean;
}) {
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
        {canExport ? <ExportButton code={code} filters={values} /> : null}
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
  const canOperations = useHasPermission(PERMISSION_CODES.operationsReport);
  const canConsolidated = useHasPermission(PERMISSION_CODES.consolidatedReport);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const tabs: Array<{ code: TabCode; label: string }> = [
    ...REPORTS.filter((report) => permissions[report.code]),
    ...(canOperations ? [{ code: 'activities' as const, label: 'Hoạt động và công việc' }] : []),
    ...(canConsolidated ? [{ code: 'consolidated' as const, label: 'Hợp nhất đơn vị' }] : []),
    ...(canExport ? [{ code: 'export-logs' as const, label: 'Nhật ký xuất' }] : []),
  ];
  const [chosen, setChosen] = useState<TabCode>();
  const selected = tabs.find((tab) => tab.code === chosen) ?? tabs[0];
  const basic = REPORTS.find((report) => report.code === selected?.code);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Báo cáo</h1>
        {tabs.length === 0 ? (
          <p className="text-content text-text-secondary">Bạn chưa có quyền xem báo cáo nào.</p>
        ) : null}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại báo cáo">
          {tabs.map((tab) => (
            <Button
              key={tab.code}
              role="tab"
              aria-selected={tab.code === selected?.code}
              variant={tab.code === selected?.code ? 'primary' : 'secondary'}
              onClick={() => setChosen(tab.code)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        {basic ? <ReportView key={basic.code} code={basic.code} filter={basic.filter} canExport={canExport} /> : null}
        {selected?.code === 'activities' ? <OperationsView /> : null}
        {selected?.code === 'consolidated' ? <ConsolidatedView canExport={canExport} /> : null}
        {selected?.code === 'export-logs' ? <ExportLogsView /> : null}
      </div>
    </AppShell>
  );
}
