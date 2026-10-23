import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ATTENDANCE_STAGES } from '@school-management/shared';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { LevelSelect, useReportLevel } from '../school-levels/LevelSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { ApiError } from '../session/api-client.js';
import { ExportButton } from './PhaseTwoReports.js';
import {
  DAY_CODE_LABELS,
  readAttendanceMeals,
  readClassMatrix,
  type AttendanceMealsReport,
  type AttendancePeriod,
  type DayCounts,
  type ReportDay,
  type Totals,
} from './attendance-meals-api.js';
import { formatNumber } from './reports-api.js';

// Báo cáo điểm danh và suất ăn (YCTD-100): chọn kỳ ngày, tuần, tháng, đơn vị, lớp; bảng theo lớp nhóm theo khối với số có
// mặt từng ngày, vắng có phép (P), không phép (K), bệnh (B), chưa điểm danh, suất ăn và tỷ lệ; chọn một lớp thì xem thêm
// mã của từng trẻ. Nút "Xuất Excel" tải tệp theo mẫu điểm danh của nhà trường (có ghi nhật ký xuất)
const PERIODS: Array<{ code: AttendancePeriod; label: string }> = [
  { code: 'day', label: 'Ngày' },
  { code: 'week', label: 'Tuần' },
  { code: 'month', label: 'Tháng' },
];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';

interface TableRow extends Totals {
  key: string;
  label: string;
  kind: 'class' | 'grade' | 'stage' | 'school';
  days: DayCounts[];
}

// Thứ tự dòng như bảng "Tổng hợp" của mẫu: các lớp của từng khối, dòng cộng khối, cuối cùng là toàn trường
function tableRows(report: AttendanceMealsReport): TableRow[] {
  const rows: TableRow[] = [];
  for (const { key: stage } of ATTENDANCE_STAGES) {
    const stageGroup = report.groups.find((group) => group.kind === 'stage' && group.key === stage);
    if (!stageGroup) {
      continue;
    }
    const classes = report.classes.filter((row) => row.stage === stage);
    const grades = report.groups.filter(
      (group) => group.kind === 'grade' && classes.some((row) => row.grade_level === group.key),
    );
    const classRow = (row: (typeof classes)[number]): TableRow => ({
      ...row,
      key: row.class_id,
      label: row.class_name,
      kind: 'class',
    });
    if (grades.length > 0) {
      for (const grade of grades) {
        rows.push(...classes.filter((row) => row.grade_level === grade.key).map(classRow));
        rows.push({ ...grade, key: `grade-${grade.key}`, kind: 'grade' });
      }
    } else {
      rows.push(...classes.map(classRow));
    }
    rows.push({ ...stageGroup, key: `stage-${stage}`, kind: 'stage' });
  }
  rows.push({ ...report.totals, key: 'school', label: 'Toàn trường', kind: 'school' });
  return rows;
}

function dayHeader(day: ReportDay) {
  return `${day.date.slice(8, 10)}/${day.date.slice(5, 7)} ${day.weekday}`;
}

export function AttendanceMealsView({ canExport }: { canExport: boolean }) {
  const unitChoice = useUnitChoice();
  const [period, setPeriod] = useState<AttendancePeriod>('month');
  const [date, setDate] = useState(today());
  const [orgUnitId, setOrgUnitId] = useState('');
  const [classId, setClassId] = useState('');
  const level = useReportLevel();
  const [applied, setApplied] = useState<Record<string, string | null>>();
  const values = {
    period,
    date,
    org_unit_id: orgUnitId || null,
    class_id: classId || null,
    school_level: level.effective || null,
  };
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const report = useQuery({
    queryKey: ['report', 'attendance-meals', applied],
    queryFn: () => readAttendanceMeals(applied ?? {}),
    enabled: applied !== undefined,
    retry: false,
  });
  const matrix = useQuery({
    queryKey: ['report', 'attendance-meals-children', applied],
    queryFn: () => readClassMatrix(applied ?? {}),
    enabled: Boolean(applied?.class_id),
    retry: false,
  });
  const data = report.data;
  const showDays = data !== undefined && data.period !== 'day';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kỳ báo cáo">
        {PERIODS.map((item) => (
          <Button
            key={item.code}
            type="button"
            aria-pressed={period === item.code}
            variant={period === item.code ? 'primary' : 'secondary'}
            onClick={() => {
              setPeriod(item.code);
              setApplied({ ...values, period: item.code });
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Bộ lọc báo cáo điểm danh và suất ăn"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(values);
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
        <LevelSelect value={level.value} onChange={level.setValue} />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Lớp
          <select className={selectClass} value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Tất cả các lớp</option>
            {(classes.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={period === 'day' ? 'Ngày' : period === 'week' ? 'Ngày trong tuần' : 'Ngày trong tháng'}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Button type="submit" variant="primary">
          Xem báo cáo
        </Button>
        {canExport ? <ExportButton code="attendance-meals" filters={values} /> : null}
      </form>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {data ? (
        <>
          <p className="text-content text-text" aria-label="Kỳ báo cáo đang xem">
            Từ {data.from} đến {data.to}: {data.meal_day_count} ngày ăn
            {data.holiday_count > 0 ? `, ${data.holiday_count} ngày nghỉ lễ hoặc nghỉ khác` : ''}. Có mặt{' '}
            {formatNumber(data.totals.present)}/{formatNumber(data.totals.expected)} lượt, suất ăn{' '}
            {formatNumber(data.totals.meal_count)}, tỷ lệ{' '}
            {data.totals.rate_percent === null ? '—' : `${formatNumber(data.totals.rate_percent)}%`}.
          </p>
          {data.days.some((day) => day.date === data.today && day.counted) ? (
            <Alert tone="info">
              Hôm nay tính theo điểm danh đã lưu đến lúc xem; trẻ chưa được điểm danh nằm ở cột "Chưa điểm danh".
            </Alert>
          ) : null}
          <section
            className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
            aria-label="Điểm danh và suất ăn theo lớp"
          >
            <h2 className="text-section-title font-semibold text-text">Điểm danh và suất ăn theo lớp</h2>
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-2 py-2">Lớp</th>
                  <th className="px-2 py-2">Sĩ số</th>
                  <th className="px-2 py-2">Có mặt</th>
                  <th className="px-2 py-2">Vắng P</th>
                  <th className="px-2 py-2">Vắng K</th>
                  <th className="px-2 py-2">Vắng B</th>
                  <th className="px-2 py-2">Chưa điểm danh</th>
                  <th className="px-2 py-2">Suất ăn</th>
                  <th className="px-2 py-2">Tỷ lệ (%)</th>
                  {showDays
                    ? data.days.map((day) => (
                        <th
                          key={day.date}
                          className={`px-2 py-2 whitespace-nowrap ${day.counted ? '' : 'bg-page'}`}
                          title={day.holiday_name ?? DAY_CODE_LABELS[day.code]}
                        >
                          {dayHeader(day)}
                        </th>
                      ))
                    : null}
                </tr>
              </thead>
              <tbody>
                {tableRows(data).map((row) => (
                  <tr key={row.key} className={`border-t border-border ${row.kind === 'class' ? '' : 'font-semibold'}`}>
                    <td className="px-2 py-2 whitespace-nowrap">{row.label}</td>
                    <td className="px-2 py-2">{formatNumber(row.enrolled)}</td>
                    <td className="px-2 py-2">{formatNumber(row.present)}</td>
                    <td className="px-2 py-2">{formatNumber(row.absent_p)}</td>
                    <td className="px-2 py-2">{formatNumber(row.absent_k)}</td>
                    <td className="px-2 py-2">{formatNumber(row.absent_b)}</td>
                    <td className="px-2 py-2">{formatNumber(row.unmarked)}</td>
                    <td className="px-2 py-2">{formatNumber(row.meal_count)}</td>
                    <td className="px-2 py-2">{row.rate_percent === null ? '—' : formatNumber(row.rate_percent)}</td>
                    {showDays
                      ? data.days.map((day, index) => (
                          <td key={day.date} className={`px-2 py-2 ${day.counted ? '' : 'bg-page'}`}>
                            {day.counted && day.passed ? formatNumber(row.days[index]?.present ?? 0) : ''}
                          </td>
                        ))
                      : null}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-label text-text-secondary">
              P nghỉ có phép, K nghỉ không phép, B nghỉ bệnh (lý do có từ ốm, bệnh, sốt, ho...). Suất ăn là số trẻ có
              mặt những ngày ăn; ô trống là ngày không tính hoặc chưa tới.
            </p>
          </section>
        </>
      ) : null}
      {matrix.error ? <Alert tone="danger">{messageOf(matrix.error)}</Alert> : null}
      {applied?.class_id && matrix.data ? (
        <section
          className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
          aria-label="Điểm danh từng trẻ"
        >
          <h2 className="text-section-title font-semibold text-text">Điểm danh từng trẻ</h2>
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-2 py-2">Họ tên</th>
                {matrix.data.days.map((day) => (
                  <th key={day.date} className={`px-2 py-2 whitespace-nowrap ${day.counted ? '' : 'bg-page'}`}>
                    {dayHeader(day)}
                  </th>
                ))}
                <th className="px-2 py-2">Vắng mặt</th>
                <th className="px-2 py-2">Hiện diện</th>
                <th className="px-2 py-2">Tỷ lệ (%)</th>
              </tr>
            </thead>
            <tbody>
              {matrix.data.children.map((child) => (
                <tr key={child.child_id} className="border-t border-border">
                  <td className="px-2 py-2 whitespace-nowrap">{child.full_name}</td>
                  {matrix.data.days.map((day) => {
                    const code = child.codes[day.date] ?? '';
                    return (
                      <td key={day.date} className={`px-2 py-2 ${day.counted ? '' : 'bg-page'}`}>
                        {code === 'off' || code === 'future' ? '' : code}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2">{child.absent}</td>
                  <td className="px-2 py-2">{child.present}</td>
                  <td className="px-2 py-2">{child.rate_percent === null ? '—' : formatNumber(child.rate_percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
