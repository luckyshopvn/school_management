import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { readStaffStatistics, type CatalogCount, type LevelCounts, type StandardStatistics } from '../staff/staff-so-api.js';

// 5.2. Thống kê nhân sự theo hệ thống của Sở (DT-16 phần 16f): theo trình độ đào tạo, vị trí việc làm, hình thức hợp đồng,
// nhóm chức vụ (đủ các dòng của danh mục Bộ, giá trị ngoài danh mục ghi thêm dòng riêng), theo chuẩn nghề nghiệp cán bộ quản
// lý và giáo viên (số phiếu đã chốt theo mức từng tiêu chí, xếp loại chung)
const LEVELS: Array<{ key: keyof LevelCounts; label: string }> = [
  { key: 'excellent', label: 'Tốt' },
  { key: 'good', label: 'Khá' },
  { key: 'met', label: 'Đạt' },
  { key: 'not_met', label: 'Chưa đạt' },
];
const STANDARD_TITLES = {
  principal: 'Theo chuẩn nghề nghiệp cán bộ quản lý (chuẩn hiệu trưởng)',
  teacher: 'Theo chuẩn nghề nghiệp giáo viên',
} as const;

function CountTable({ title, rows }: { title: string; rows: CatalogCount[] }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label={title}>
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      <table className="w-full text-content" aria-label={`Bảng ${title.toLowerCase()}`}>
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-1">Nội dung</th>
            <th className="px-3 py-1 text-right">Số lượng</th>
            <th className="px-3 py-1 text-right">Nữ</th>
            <th className="px-3 py-1 text-right">Tỷ lệ (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.value} className="border-t border-border">
              <td className="px-3 py-1">
                {row.value}
                {row.in_catalog ? '' : row.value === 'Chưa nhập' ? '' : ' (ngoài danh mục)'}
              </td>
              <td className="px-3 py-1 text-right">{row.count}</td>
              <td className="px-3 py-1 text-right">{row.female}</td>
              <td className="px-3 py-1 text-right">{row.percent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StandardTable({ standard }: { standard: StandardStatistics }) {
  const title = STANDARD_TITLES[standard.standard_type];
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label={title}>
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      <p className="text-label text-text-secondary">
        {standard.finalized} phiếu đã chốt trên {standard.evaluations} phiếu đã mở.
      </p>
      <table className="w-full text-content" aria-label={`Bảng ${title.toLowerCase()}`}>
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-1">Tiêu chí</th>
            {LEVELS.map((level) => (
              <th key={level.key} className="px-3 py-1 text-right">
                {level.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standard.criteria.map((criterion) => (
            <tr key={criterion.code} className="border-t border-border">
              <td className="px-3 py-1">
                {criterion.code}. {criterion.name}
              </td>
              {LEVELS.map((level) => (
                <td key={level.key} className="px-3 py-1 text-right">
                  {criterion.levels[level.key]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-border font-semibold">
            <td className="px-3 py-1">Xếp loại chung</td>
            {LEVELS.map((level) => (
              <td key={level.key} className="px-3 py-1 text-right">
                {standard.overall[level.key]} ({standard.overall_rates[level.key]}%)
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export function StaffStatisticsPage() {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const statistics = useQuery({
    queryKey: ['staff-statistics', orgUnitId],
    queryFn: () => readStaffStatistics(orgUnitId || undefined),
  });
  const data = statistics.data;
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff-statistics')}</h1>
        <label className="flex max-w-sm flex-col gap-1 text-label font-medium text-text">
          Đơn vị
          <select
            value={orgUnitId}
            onChange={(event) => setOrgUnitId(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
          >
            <option value="">Tất cả đơn vị trong phạm vi</option>
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        {statistics.error ? <Alert tone="danger">{messageOf(statistics.error)}</Alert> : null}
        {data ? (
          <>
            <p className="text-content text-text">
              Tổng số nhân sự đang làm việc: <strong>{data.totals.staff_count}</strong>, nữ:{' '}
              <strong>{data.totals.female_count}</strong>.
            </p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CountTable title="Theo trình độ đào tạo" rows={data.by_qualification} />
              <CountTable title="Theo vị trí việc làm" rows={data.by_job_position} />
              <CountTable title="Theo hình thức hợp đồng" rows={data.by_contract_form} />
              <CountTable title="Theo nhóm chức vụ" rows={data.by_position_group} />
            </div>
            {data.standards.map((standard) => (
              <StandardTable key={standard.standard_type} standard={standard} />
            ))}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
