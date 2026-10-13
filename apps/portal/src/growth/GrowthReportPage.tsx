import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ReportTable, type Column } from '../reports/ReportTable.js';
import {
  GROWTH_STATUS_LABELS,
  exportGrowthReport,
  listRounds,
  readGrowthReport,
  statusLabel,
  type GrowthChannel,
} from './growth-api.js';

// 4.3.2 Tổng hợp cân nặng, chiều cao (DT-14 phần 14a, YCTD-102): tổng hợp một đợt cân đo hoặc mọi đợt trong tháng theo lớp,
// theo khối; lọc giới tính, kênh tăng trưởng; xuất Excel (ghi nhật ký xuất). Số liệu do máy chủ tính
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

export function GrowthReportPage() {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [month, setMonth] = useState(vietnamMonth);
  const [gender, setGender] = useState('');
  const [channel, setChannel] = useState('');
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
  const childRows = (report.data?.children ?? []).map((row) => ({
    ...row,
    gender: row.gender === 'female' ? 'Nữ' : 'Nam',
    weight_status: statusLabel(row.weight_status as string | null),
    height_status: statusLabel(row.height_status as string | null),
    weight_height_status: statusLabel(row.weight_height_status as string | null),
  }));
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">4.3.2 Tổng hợp cân nặng, chiều cao</h1>
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
            <ReportTable
              title={`Danh sách học sinh${channel ? `: ${statusLabel(channel)}` : ''}`}
              columns={[
                { key: 'class_name', label: 'Lớp' },
                { key: 'full_name', label: 'Họ tên' },
                { key: 'gender', label: 'Giới tính' },
                { key: 'age_months', label: 'Tháng tuổi' },
                { key: 'weight_kg', label: 'Cân nặng (kg)' },
                { key: 'height_cm', label: 'Chiều cao (cm)' },
                { key: 'bmi', label: 'BMI' },
                { key: 'weight_status', label: 'Kết quả cân nặng' },
                { key: 'height_status', label: 'Kết quả chiều cao' },
                { key: 'weight_height_status', label: 'Cân nặng theo chiều cao' },
              ]}
              rows={childRows}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
