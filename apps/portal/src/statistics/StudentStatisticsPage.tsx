import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STUDENT_HEALTH_TERMS, fillLearnerTerm, type StudentHealthTermValue } from '@school-management/shared';
import { Alert, Button, DataGrid, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { formatNumber } from '../reports/reports-api.js';
import { useSchoolLevelTerms } from '../school-levels/working-level.js';
import { MissingView } from './MissingProfilesPage.js';
import { Table } from './StatisticsPage.js';
import {
  exportStudentStatistics,
  readStudentStatistics,
  type AgeRow,
  type CompletionCategory,
  type EthnicStudent,
  type StudentStatistics,
} from './student-statistics-api.js';

// 5.3 Thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h): trẻ trong độ tuổi theo nhóm, lớp; biểu đồ hoàn thành chương
// trình (số lớp, số trẻ 5–6 tuổi, nữ, khuyết tật, dân tộc, con thương binh liệt sĩ); diện chính sách theo độ tuổi; biết
// bơi, bệnh về mắt theo học kỳ (thông tin sức khỏe 4.6.1); học sinh dân tộc; tìm học sinh thiếu thông tin (như 5.8).
// Xuất Excel, PDF các bảng thống kê
type Tab = 'age' | 'completion' | 'policy' | 'health' | 'ethnic' | 'missing';
const TABS: Array<[Tab, string]> = [
  ['age', '{Người học} trong độ tuổi theo nhóm, lớp'],
  ['completion', 'Biểu đồ hoàn thành chương trình'],
  ['policy', 'Diện chính sách theo độ tuổi'],
  ['health', 'Biết bơi, bệnh về mắt theo học kỳ'],
  ['ethnic', 'Học sinh dân tộc'],
  ['missing', 'Tìm học sinh thiếu thông tin'],
];
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';
const formatDate = (value: string) => value.split('-').reverse().join('/');
const defaultTerm = (): StudentHealthTermValue =>
  Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(5, 7)) >= 8
    ? 'first_term'
    : 'second_term';

const ETHNIC_COLUMNS: Array<DataGridColumn<EthnicStudent>> = [
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
  { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'female' ? 'Nữ' : 'Nam') },
  { id: 'org_unit_name', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
  { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name ?? 'Chưa xếp lớp' },
  { id: 'ethnicity', header: 'Dân tộc', cell: (row) => row.ethnicity ?? '' },
];

function ageTable(title: string, firstHeader: string, data: StudentStatistics, rows: Array<AgeRow & { name: string }>) {
  return (
    <Table
      title={title}
      headers={[firstHeader, 'Tổng số', 'Nữ', ...data.age_groups.map((group) => group.label)]}
      rows={rows.map((row) => [
        row.name,
        row.total,
        row.female,
        ...data.age_groups.map((group) => row.ages[group.key] ?? 0),
      ])}
    />
  );
}

// Biểu đồ thanh ngang: mỗi nhóm một thanh dài theo số trẻ, phần tô đậm là số hoàn thành chương trình
function CompletionChart({ categories }: { categories: CompletionCategory[] }) {
  const maximum = Math.max(1, ...categories.map((item) => item.count));
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Biểu đồ hoàn thành chương trình"
    >
      <h2 className="text-section-title font-semibold text-text">Biểu đồ hoàn thành chương trình</h2>
      <ul className="flex flex-col gap-3">
        {categories.map((item) => (
          <li key={item.key} className="flex flex-col gap-1">
            <div className="flex flex-wrap justify-between gap-2 text-label text-text">
              <span className="font-medium">{item.label}</span>
              <span>
                Hoàn thành {formatNumber(item.completed)}/{formatNumber(item.count)} ({item.percent}%)
              </span>
            </div>
            <div
              role="img"
              aria-label={`${item.label}: ${item.completed} trên ${item.count} trẻ hoàn thành`}
              className="h-4 overflow-hidden rounded bg-border"
              style={{ width: `${Math.max(4, (item.count / maximum) * 100)}%` }}
            >
              <div
                className="h-full bg-brand"
                style={{ width: `${item.count === 0 ? 0 : (item.completed / item.count) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EthnicList({ students }: { students: EthnicStudent[] }) {
  const grid = useGridSettings('student-statistics-ethnic');
  const [search, setSearch] = useState('');
  const rows = students.filter((row) =>
    matchesSearch(search, row.full_name, row.class_name ?? '', row.ethnicity ?? ''),
  );
  return (
    <DataGrid
      label="Danh sách học sinh dân tộc thiểu số"
      columns={ETHNIC_COLUMNS}
      rows={rows}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.full_name}
      emptyText="Không có học sinh dân tộc thiểu số."
      search={{ label: 'Tìm theo họ tên, lớp, dân tộc', value: search, onChange: setSearch }}
      settings={grid.settings}
      onSettingsChange={grid.update}
    />
  );
}

export function StudentStatisticsView({ orgUnitId, schoolLevel = '' }: { orgUnitId: string; schoolLevel?: string }) {
  const [tab, setTab] = useState<Tab>('age');
  const terms = useSchoolLevelTerms();
  const [term, setTerm] = useState<StudentHealthTermValue>(defaultTerm);
  const [exportError, setExportError] = useState<string>();
  const stats = useQuery({
    queryKey: ['student-statistics', orgUnitId, term, schoolLevel],
    queryFn: () => readStudentStatistics(orgUnitId, term, schoolLevel),
    retry: false,
  });
  const download = (format: 'xlsx' | 'pdf') => {
    setExportError(undefined);
    exportStudentStatistics(orgUnitId, term, format, schoolLevel).catch((error: unknown) =>
      setExportError(messageOf(error)),
    );
  };
  const data = stats.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Học kỳ
          <select
            aria-label="Học kỳ"
            className={selectClass}
            value={term}
            onChange={(event) => setTerm(event.target.value as StudentHealthTermValue)}
          >
            {STUDENT_HEALTH_TERMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={() => download('xlsx')}>
          Xuất Excel
        </Button>
        <Button type="button" variant="secondary" onClick={() => download('pdf')}>
          Xuất PDF
        </Button>
      </div>
      {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Phần thống kê học sinh">
        {TABS.map(([code, label]) => (
          <Button
            key={code}
            role="tab"
            aria-selected={tab === code}
            variant={tab === code ? 'secondary' : 'text'}
            onClick={() => setTab(code)}
          >
            {fillLearnerTerm(label, terms)}
          </Button>
        ))}
      </div>
      {stats.error ? <Alert tone="danger">{messageOf(stats.error)}</Alert> : null}
      {data && tab !== 'missing' ? (
        <p className="text-content text-text">
          Học sinh đang học: {formatNumber(data.totals.children_count)} (nữ {formatNumber(data.totals.female_count)}).
          Tuổi tính đến ngày {formatDate(data.on_date)}.
        </p>
      ) : null}
      {data && tab === 'age' ? (
        <>
          <Table
            title="Học sinh theo độ tuổi"
            headers={['Độ tuổi', 'Số lượng', 'Nữ', 'Tỷ lệ (%)']}
            rows={data.by_age.map((group) => [group.label, group.count, group.female, group.percent])}
          />
          {ageTable(
            fillLearnerTerm('{Người học} trong độ tuổi theo nhóm, lớp', terms),
            'Lớp',
            data,
            data.by_class.map((row) => ({ ...row, name: row.class_name })),
          )}
        </>
      ) : null}
      {data && tab === 'completion' ? (
        <>
          <p className="text-content text-text">
            Số lớp mẫu giáo 5–6 tuổi: {formatNumber(data.completion.class_count)}. Kết quả hoàn thành lấy từ mục 4.4.
          </p>
          <CompletionChart categories={data.completion.categories} />
          <Table
            title="Hoàn thành chương trình theo nhóm"
            headers={['Nhóm', 'Số trẻ', 'Hoàn thành', 'Chưa hoàn thành', 'Tỷ lệ hoàn thành (%)']}
            rows={data.completion.categories.map((item) => [
              item.label,
              item.count,
              item.completed,
              item.not_completed,
              item.percent,
            ])}
          />
        </>
      ) : null}
      {data && tab === 'policy'
        ? ageTable(
            'Diện chính sách theo độ tuổi',
            'Đối tượng chính sách',
            data,
            data.policy_by_age.map((row) => ({ ...row, name: row.value })),
          )
        : null}
      {data && tab === 'health' ? (
        <>
          <p className="text-content text-text">
            {STUDENT_HEALTH_TERMS.find((item) => item.value === data.term)?.label}
            {data.term_range
              ? ` (${formatDate(data.term_range.start_date)} – ${formatDate(data.term_range.end_date)})`
              : ''}
            : {formatNumber(data.term_health.recorded)} học sinh đã nhập thông tin sức khỏe (4.6.1). Biết bơi chưa nhập
            trong học kỳ thì lấy theo hồ sơ.
          </p>
          <Table
            title="Biết bơi theo học kỳ"
            headers={['Nhóm tuổi', 'Số học sinh', 'Biết bơi', 'Biết bơi: nữ', 'Không biết bơi']}
            rows={[
              ...data.term_health.by_age.map((row) => [
                row.label,
                row.total,
                row.swimming.count,
                row.swimming.female,
                row.not_swimming.count,
              ]),
              [
                'Tổng cộng',
                data.totals.children_count,
                data.term_health.totals.swimming.count,
                data.term_health.totals.swimming.female,
                data.term_health.totals.not_swimming.count,
              ],
            ]}
          />
          <Table
            title="Bệnh về mắt theo học kỳ"
            headers={[
              'Nhóm tuổi',
              'Có bệnh về mắt',
              ...data.term_health.totals.eye_conditions.map((item) => item.label),
            ]}
            rows={[
              ...data.term_health.by_age.map((row) => [
                row.label,
                row.eye_any.count,
                ...row.eye_conditions.map((item) => item.count),
              ]),
              [
                'Tổng cộng',
                data.term_health.totals.eye_any.count,
                ...data.term_health.totals.eye_conditions.map((item) => item.count),
              ],
            ]}
          />
        </>
      ) : null}
      {data && tab === 'ethnic' ? (
        <>
          <p className="text-content text-text">
            Học sinh dân tộc thiểu số: {formatNumber(data.ethnic.count)} (nữ {formatNumber(data.ethnic.female)}).
          </p>
          <Table
            title="Học sinh theo dân tộc"
            headers={['Dân tộc', 'Số lượng', 'Nữ', 'Tỷ lệ (%)']}
            rows={data.by_ethnicity.map((item) => [item.value, item.count, item.female, item.percent])}
          />
          {ageTable(
            'Học sinh dân tộc thiểu số theo độ tuổi',
            'Dân tộc',
            data,
            data.ethnic.by_ethnicity.map((row) => ({ ...row, name: row.value })),
          )}
          <EthnicList students={data.ethnic.students} />
        </>
      ) : null}
      {tab === 'missing' ? <MissingView tab="children" orgUnitId={orgUnitId} /> : null}
    </div>
  );
}

export function StudentStatisticsPage() {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/student-statistics')}</h1>
        <UnitSelect
          units={[{ id: '', name: 'Tất cả trong phạm vi' } as (typeof unitChoice.units)[number], ...unitChoice.units]}
          selectedId={orgUnitId}
          onSelect={setOrgUnitId}
        />
        <StudentStatisticsView orgUnitId={orgUnitId} />
      </div>
    </AppShell>
  );
}
