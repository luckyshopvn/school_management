import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, DataGrid, TextField, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ReportTable, type Column } from '../reports/ReportTable.js';
import { formatNumber } from '../reports/reports-api.js';
import {
  GROWTH_STATUS_LABELS,
  exportGrowthReport,
  listRounds,
  readGrowthReport,
  statusLabel,
  type GrowthChannel,
  type SummaryRow,
} from './growth-api.js';

// 4.3.2 Tổng hợp cân nặng, chiều cao (DT-14 phần 14a, YCTD-102): tổng hợp một đợt cân đo hoặc mọi đợt trong tháng theo lớp,
// theo khối; lọc giới tính, kênh tăng trưởng; xuất Excel (ghi nhật ký xuất). Số liệu do máy chủ tính. Danh sách học sinh
// trên lưới dữ liệu chung, tìm tại chỗ theo họ tên, lớp; bảng theo khối, theo lớp là bảng tổng hợp nên giữ nguyên (DT-16
// phần 16b)
const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';

const COUNT_COLUMNS: Column[] = [
  { key: 'enrolled', label: 'Số học sinh' },
  { key: 'enrolled_female', label: 'Nữ' },
  { key: 'measured', label: 'Được cân đo' },
  { key: 'measured_percent', label: 'Tỷ lệ cân đo (%)' },
  { key: 'underweight', label: 'SDD thể nhẹ cân' },
  { key: 'underweight_percent', label: '%' },
  { key: 'above_age', label: 'Cân nặng cao hơn tuổi' },
  { key: 'stunted', label: 'SDD thể thấp còi' },
  { key: 'stunted_percent', label: '%' },
  { key: 'wasted', label: 'SDD thể gầy còm' },
  { key: 'overweight', label: 'Thừa cân' },
  { key: 'obese', label: 'Béo phì' },
  { key: 'obese_percent', label: '%' },
  { key: 'all_normal', label: 'Bình thường cả ba kênh' },
];

const CHILD_COLUMNS: Array<DataGridColumn<SummaryRow>> = [
  { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'female' ? 'Nữ' : 'Nam') },
  { id: 'age_months', header: 'Tháng tuổi', cell: (row) => formatNumber(row.age_months) },
  { id: 'weight_kg', header: 'Cân nặng (kg)', cell: (row) => formatNumber(row.weight_kg) },
  { id: 'height_cm', header: 'Chiều cao (cm)', cell: (row) => formatNumber(row.height_cm) },
  { id: 'bmi', header: 'BMI', cell: (row) => formatNumber(row.bmi) },
  { id: 'weight_status', header: 'Kết quả cân nặng', cell: (row) => statusLabel(row.weight_status as string | null) },
  { id: 'height_status', header: 'Kết quả chiều cao', cell: (row) => statusLabel(row.height_status as string | null) },
  {
    id: 'weight_height_status',
    header: 'Cân nặng theo chiều cao',
    cell: (row) => statusLabel(row.weight_height_status as string | null),
  },
];

export function GrowthReportPage() {
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('growth-report-children');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [month, setMonth] = useState(vietnamMonth);
  const [gender, setGender] = useState('');
  const [channel, setChannel] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState<Record<string, string | null>>();
  const rounds = useQuery({
    queryKey: ['growth-rounds', orgUnitId],
    queryFn: () => listRounds(orgUnitId),
    enabled: orgUnitId !== '',
    retry: false,
  });
  const report = useQuery({
    queryKey: ['growth-report', applied],
    queryFn: () => readGrowthReport(applied ?? {}),
    enabled: applied !== undefined,
    retry: false,
  });
  const download = useMutation({ mutationFn: () => exportGrowthReport(applied ?? {}) });
  const appliedChannel = applied?.channel ?? '';
  const childRows = (report.data?.children ?? []).filter((row) => matchesSearch(search, row.full_name, row.class_name));
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/growth-report')}</h1>
        <form
          className="flex flex-wrap items-end gap-3"
          aria-label="Bộ lọc tổng hợp cân đo"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({
              org_unit_id: orgUnitId || null,
              round_id: roundId || null,
              month: roundId ? null : month,
              gender: gender || null,
              channel: channel || null,
            });
          }}
        >
          <UnitSelect
            units={[{ id: '', name: 'Tất cả trong phạm vi' } as (typeof unitChoice.units)[number], ...unitChoice.units]}
            selectedId={orgUnitId}
            onSelect={(id) => {
              setOrgUnitId(id);
              setRoundId('');
            }}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Đợt cân đo
            <select
              aria-label="Đợt cân đo"
              className={selectClass}
              value={roundId}
              disabled={orgUnitId === ''}
              onChange={(event) => setRoundId(event.target.value)}
            >
              <option value="">Mọi đợt trong tháng</option>
              {(rounds.data ?? []).map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Tháng"
            type="month"
            value={month}
            disabled={roundId !== ''}
            onChange={(event) => setMonth(event.target.value)}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Giới tính
            <select
              aria-label="Giới tính"
              className={selectClass}
              value={gender}
              onChange={(event) => setGender(event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="female">Nữ</option>
              <option value="male">Nam</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Kênh
            <select
              aria-label="Kênh"
              className={selectClass}
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="">Tất cả</option>
              {(Object.keys(GROWTH_STATUS_LABELS) as GrowthChannel[]).map((key) => (
                <option key={key} value={key}>
                  {GROWTH_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">
            Xem tổng hợp
          </Button>
          {applied ? (
            <Button type="button" variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>
              Xuất Excel
            </Button>
          ) : null}
        </form>
        {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
        {download.error ? <Alert tone="danger">{messageOf(download.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {report.data ? (
          <>
            <p className="text-label text-text-secondary">
              {report.data.rounds.length === 0
                ? 'Không có đợt cân đo nào trong tháng.'
                : `Đợt: ${report.data.rounds.map((round) => `${round.name} (${round.measured_on.split('-').reverse().join('/')})`).join(', ')}`}
            </p>
            <ReportTable
              title="Theo khối"
              columns={[
                { key: 'grade_name', label: 'Khối' },
                { key: 'class_count', label: 'Số lớp' },
                ...COUNT_COLUMNS,
              ]}
              rows={[...report.data.grades, { grade_name: 'Tổng cộng', ...report.data.totals }]}
            />
            <ReportTable
              title="Theo lớp"
              columns={[
                { key: 'org_unit_name', label: 'Đơn vị' },
                { key: 'class_name', label: 'Lớp' },
                ...COUNT_COLUMNS,
              ]}
              rows={report.data.classes}
            />
            <DataGrid
              label={`Danh sách học sinh${appliedChannel ? `: ${statusLabel(appliedChannel)}` : ''}`}
              columns={CHILD_COLUMNS}
              rows={childRows}
              getRowId={(row) => `${String(row.child_id)}-${String(row.measured_on)}-${String(row.class_name)}`}
              getRowLabel={(row) => String(row.full_name ?? '')}
              emptyText="Không có học sinh nào."
              search={{ label: 'Tìm theo họ tên, lớp', value: search, onChange: setSearch }}
              settings={grid.settings}
              onSettingsChange={grid.update}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
