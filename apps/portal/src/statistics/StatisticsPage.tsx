import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { formatNumber } from '../reports/reports-api.js';
import { useHasPermission } from '../session/permissions.js';
import { readChildStatistics, readClassStatistics, readStaffStatistics, type Breakdown } from './statistics-api.js';

// Thống kê theo tiêu chí ngành (DT-14 phần 14a, YCTD-102): 5.1 lớp học theo nhóm tuổi, 5.2 nhân sự, 5.3 học sinh. Dữ liệu
// chưa có trong hồ sơ (dân tộc, khuyết tật, diện chính sách, biết bơi, bệnh về mắt, trình độ, vị trí việc làm) lấy từ tệp
// CSDL ngành đã nhập; chưa nhập thì gom vào "Chưa nhập"
type Tab = 'classes' | 'staff' | 'children';
const TITLES: Record<Tab, string> = {
  classes: '5.1 Thống kê lớp học',
  staff: '5.2 Thống kê nhân sự',
  children: '5.3 Thống kê học sinh',
};

export function Table({ title, headers, rows }: { title: string; headers: string[]; rows: ReactNode[][] }) {
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
              {headers.map((header) => (
                <th key={header} className="px-3 py-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, index) => (
              <tr key={index} className="border-t border-border">
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2">
                    {typeof cell === 'number' ? formatNumber(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function BreakdownTable({ title, label, items }: { title: string; label: string; items: Breakdown[] }) {
  return (
    <Table
      title={title}
      headers={[label, 'Số lượng', 'Nữ', 'Tỷ lệ (%)']}
      rows={items.map((item) => [item.value, item.count, item.female, item.percent])}
    />
  );
}

function ClassesView({ orgUnitId }: { orgUnitId: string }) {
  const stats = useQuery({
    queryKey: ['statistics', 'classes', orgUnitId],
    queryFn: () => readClassStatistics(orgUnitId),
    retry: false,
  });
  if (stats.error) {
    return <Alert tone="danger">{messageOf(stats.error)}</Alert>;
  }
  if (!stats.data) {
    return null;
  }
  return (
    <>
      <p className="text-content text-text">
        Tổng số lớp: {stats.data.totals.class_count}; học sinh đang học: {stats.data.totals.children_count} (nữ{' '}
        {stats.data.totals.female_count}).
      </p>
      <Table
        title="Lớp theo nhóm tuổi"
        headers={['Nhóm tuổi', 'Số lớp', 'Tỷ lệ lớp (%)', 'Số học sinh', 'Nữ', 'Tỷ lệ học sinh (%)']}
        rows={stats.data.groups.map((group) => [
          group.label,
          group.class_count,
          group.class_percent,
          group.children_count,
          group.female_count,
          group.children_percent,
        ])}
      />
    </>
  );
}

function ChildrenView({ orgUnitId }: { orgUnitId: string }) {
  const stats = useQuery({
    queryKey: ['statistics', 'children', orgUnitId],
    queryFn: () => readChildStatistics(orgUnitId),
    retry: false,
  });
  if (stats.error) {
    return <Alert tone="danger">{messageOf(stats.error)}</Alert>;
  }
  if (!stats.data) {
    return null;
  }
  const data = stats.data;
  return (
    <>
      <p className="text-content text-text">
        Học sinh đang học: {data.totals.children_count} (nữ {data.totals.female_count}); khuyết tật:{' '}
        {data.disability.count}; diện chính sách: {data.policy.count}; biết bơi: {data.swimming.count} (
        {data.swimming.percent}%); bệnh về mắt: {data.eye_disease.count}. Tuổi tính đến ngày{' '}
        {data.on_date.split('-').reverse().join('/')}.
      </p>
      <Table
        title="Học sinh theo độ tuổi"
        headers={['Độ tuổi', 'Số lượng', 'Nữ', 'Tỷ lệ (%)']}
        rows={data.by_age.map((group) => [group.label, group.count, group.female, group.percent])}
      />
      <BreakdownTable title="Học sinh theo dân tộc" label="Dân tộc" items={data.by_ethnicity} />
      <BreakdownTable title="Học sinh khuyết tật" label="Loại khuyết tật" items={data.disability.by_type} />
      <BreakdownTable title="Học sinh diện chính sách" label="Đối tượng chính sách" items={data.policy.by_type} />
      <BreakdownTable title="Học sinh có bệnh về mắt" label="Bệnh về mắt" items={data.eye_disease.by_type} />
    </>
  );
}

function StaffView({ orgUnitId }: { orgUnitId: string }) {
  const stats = useQuery({
    queryKey: ['statistics', 'staff', orgUnitId],
    queryFn: () => readStaffStatistics(orgUnitId),
    retry: false,
  });
  if (stats.error) {
    return <Alert tone="danger">{messageOf(stats.error)}</Alert>;
  }
  if (!stats.data) {
    return null;
  }
  return (
    <>
      <p className="text-content text-text">
        Nhân sự đang làm việc: {stats.data.totals.staff_count} (nữ {stats.data.totals.female_count}).
      </p>
      <BreakdownTable title="Theo trình độ đào tạo" label="Trình độ" items={stats.data.by_qualification} />
      <BreakdownTable title="Theo vị trí việc làm" label="Vị trí việc làm" items={stats.data.by_job_position} />
      <BreakdownTable title="Theo hình thức hợp đồng" label="Hình thức hợp đồng" items={stats.data.by_contract_form} />
      <BreakdownTable title="Theo nhóm chức vụ" label="Nhóm chức vụ" items={stats.data.by_position_group} />
    </>
  );
}

export function StatisticsPage() {
  const canViewChildren = useHasPermission(PERMISSION_CODES.childStatisticsView);
  const canViewStaff = useHasPermission(PERMISSION_CODES.staffStatisticsView);
  const tabs = (['classes', 'staff', 'children'] as Tab[]).filter((tab) =>
    tab === 'staff' ? canViewStaff : canViewChildren,
  );
  const [chosen, setChosen] = useState<Tab>();
  const tab = chosen ?? tabs[0];
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{tab ? TITLES[tab] : 'Thống kê'}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại thống kê">
          {tabs.map((code) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setChosen(code)}
            >
              {TITLES[code]}
            </Button>
          ))}
        </div>
        <UnitSelect
          units={[{ id: '', name: 'Tất cả trong phạm vi' } as (typeof unitChoice.units)[number], ...unitChoice.units]}
          selectedId={orgUnitId}
          onSelect={setOrgUnitId}
        />
        {tab === undefined ? <Alert tone="info">Bạn chưa được cấp quyền xem thống kê.</Alert> : null}
        {tab === 'classes' ? <ClassesView orgUnitId={orgUnitId} /> : null}
        {tab === 'staff' ? <StaffView orgUnitId={orgUnitId} /> : null}
        {tab === 'children' ? <ChildrenView orgUnitId={orgUnitId} /> : null}
      </div>
    </AppShell>
  );
}
