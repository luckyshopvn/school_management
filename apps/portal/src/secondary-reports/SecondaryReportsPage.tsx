import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES, RATING_LABELS, type RatingCode, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { EmisTab, ExportButtons, GroupSelect, Table } from '../primary-reports/PrimaryReportsPage.js';
import { messageOf, type ReportGroup } from '../primary-reports/primary-reports-api.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { useHasPermission } from '../session/permissions.js';
import { exportSecondaryReport, readSecondaryReport, type SecondaryTerm } from './secondary-reports-api.js';

// 7.18 Báo cáo, thống kê, EMIS THCS, THPT (DT-21 phần 21g, YCTD-175): chọn cấp (khi trường bật cả hai), đơn vị; thẻ Sĩ số
// (theo khối, học sinh theo tổ hợp ở THPT), Kết quả cuối năm (học tập, rèn luyện, danh hiệu, lên lớp, tốt nghiệp theo lớp, khối,
// trường), Phổ điểm (môn, học kỳ hoặc cả năm), Theo giáo viên, tổ bộ môn; mỗi thẻ xuất Excel, PDF. Thẻ EMIS THCS, THPT dùng
// khung biểu cấu hình được của 20f với biểu của cấp
type Tab = 'enrollment' | 'results' | 'scores' | 'teachers' | 'emis';
const TAB_LABELS: Record<Tab, string> = {
  enrollment: 'Sĩ số',
  results: 'Kết quả cuối năm',
  scores: 'Phổ điểm',
  teachers: 'Theo giáo viên, tổ bộ môn',
  emis: 'EMIS THCS, THPT',
};
const TERM_LABELS: Record<SecondaryTerm, string> = { first_term: 'Học kỳ I', second_term: 'Học kỳ II', year: 'Cả năm' };
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const RATINGS = Object.keys(RATING_LABELS) as RatingCode[];

type Params = Record<string, string | undefined>;

function useReport<T>(report: string, params: Params) {
  return useQuery({
    queryKey: ['secondary-report', report, params],
    queryFn: () => readSecondaryReport<T>(report, params),
    retry: false,
  });
}

function TermSelect({ value, onChange }: { value: SecondaryTerm; onChange(value: SecondaryTerm): void }) {
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      Kỳ
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SecondaryTerm)}
        className={SELECT_CLASS}
      >
        {(Object.keys(TERM_LABELS) as SecondaryTerm[]).map((code) => (
          <option key={code} value={code}>
            {TERM_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnrollmentTab({ params }: { params: Params }) {
  const report = useReport<{
    rows: Array<Record<string, unknown>>;
    combinations: Array<{ combination: string; students: number }>;
  }>('enrollment', params);
  if (report.error) {
    return <Alert tone="warning">{messageOf(report.error)}</Alert>;
  }
  return (
    <div className="flex flex-col gap-3">
      <ExportButtons onExport={(format) => exportSecondaryReport('enrollment', params, format)} />
      {report.data ? (
        <>
          <Table
            label="Sĩ số theo khối"
            columns={[
              { key: 'label', label: 'Khối' },
              { key: 'classes', label: 'Số lớp' },
              { key: 'students', label: 'Học sinh' },
              { key: 'female', label: 'Nữ' },
              { key: 'ethnic', label: 'Dân tộc thiểu số' },
              { key: 'disabled', label: 'Khuyết tật' },
              { key: 'boarding', label: 'Nội trú, bán trú' },
            ]}
            rows={report.data.rows}
          />
          {report.data.combinations.length > 0 ? (
            <Table
              label="Học sinh theo tổ hợp"
              columns={[
                { key: 'combination', label: 'Tổ hợp' },
                { key: 'students', label: 'Học sinh' },
              ]}
              rows={report.data.combinations}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ResultsTab({ params }: { params: Params }) {
  const [group, setGroup] = useState<ReportGroup>('grade');
  const withGroup = { ...params, group };
  const report = useReport<{
    rows: Array<
      Record<string, unknown> & { learning: Record<RatingCode, number>; conduct: Record<RatingCode, number> }
    >;
  }>('results', withGroup);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <GroupSelect value={group} onChange={setGroup} />
        <ExportButtons onExport={(format) => exportSecondaryReport('results', withGroup, format)} />
      </div>
      {report.error ? <Alert tone="warning">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <Table
          label="Kết quả cuối năm"
          columns={[
            { key: 'label', label: 'Nhóm' },
            { key: 'students', label: 'Học sinh' },
            ...RATINGS.map((code) => ({ key: `learning_${code}`, label: `Học tập ${RATING_LABELS[code]}` })),
            ...RATINGS.map((code) => ({ key: `conduct_${code}`, label: `Rèn luyện ${RATING_LABELS[code]}` })),
            { key: 'excellent', label: 'Xuất sắc' },
            { key: 'good_title', label: 'Giỏi' },
            { key: 'promoted', label: 'Lên lớp, hoàn thành' },
            { key: 'pending_support', label: 'Rèn luyện hè, kiểm tra lại' },
            { key: 'retained', label: 'Ở lại lớp' },
            { key: 'graduated', label: 'Tốt nghiệp' },
          ]}
          rows={report.data.rows.map((row) => ({
            ...row,
            ...Object.fromEntries(RATINGS.map((code) => [`learning_${code}`, row.learning[code]])),
            ...Object.fromEntries(RATINGS.map((code) => [`conduct_${code}`, row.conduct[code]])),
          }))}
        />
      ) : null}
    </div>
  );
}

function ScoresTab({ params }: { params: Params }) {
  const [group, setGroup] = useState<ReportGroup>('class');
  const [term, setTerm] = useState<SecondaryTerm>('year');
  const [subjectId, setSubjectId] = useState('');
  const withFilters = { ...params, group, term, subject_id: subjectId || undefined };
  const report = useReport<{
    subjects: Array<{ id: string; name: string }>;
    bands: Array<{ key: string; label: string }>;
    rows: Array<Record<string, unknown> & { bands: Record<string, number> }>;
  }>('scores', withFilters);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TermSelect value={term} onChange={setTerm} />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Môn
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={SELECT_CLASS}>
            <option value="">Mọi môn tính điểm</option>
            {(report.data?.subjects ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <GroupSelect value={group} onChange={setGroup} />
        <ExportButtons onExport={(format) => exportSecondaryReport('scores', withFilters, format)} />
      </div>
      {report.error ? <Alert tone="warning">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <Table
          label="Phổ điểm trung bình môn"
          columns={[
            { key: 'label', label: 'Nhóm' },
            { key: 'count', label: 'Số điểm' },
            ...report.data.bands,
            { key: 'mean', label: 'Trung bình' },
            { key: 'below_five_percent', label: 'Dưới 5 (%)' },
          ]}
          rows={report.data.rows.map((row) => ({ ...row, ...row.bands }))}
        />
      ) : null}
    </div>
  );
}

function TeachersTab({ params }: { params: Params }) {
  const [term, setTerm] = useState<SecondaryTerm>('year');
  const withTerm = { ...params, term };
  const report = useReport<{ teachers: Array<Record<string, unknown>>; teams: Array<Record<string, unknown>> }>(
    'teachers',
    withTerm,
  );
  const summary = [
    { key: 'students', label: 'Số điểm' },
    { key: 'mean', label: 'Trung bình' },
    { key: 'at_least_five_percent', label: 'Từ 5 (%)' },
    { key: 'at_least_eight_percent', label: 'Từ 8 (%)' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TermSelect value={term} onChange={setTerm} />
        <ExportButtons onExport={(format) => exportSecondaryReport('teachers', withTerm, format)} />
      </div>
      {report.error ? <Alert tone="warning">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <>
          <Table
            label="Kết quả môn học theo giáo viên"
            columns={[
              { key: 'staff_name', label: 'Giáo viên' },
              { key: 'team', label: 'Tổ bộ môn' },
              { key: 'subjects', label: 'Môn' },
              { key: 'classes', label: 'Lớp' },
              ...summary,
            ]}
            rows={report.data.teachers}
          />
          <Table
            label="Kết quả môn học theo tổ bộ môn"
            columns={[{ key: 'team', label: 'Tổ bộ môn' }, ...summary]}
            rows={report.data.teams}
          />
        </>
      ) : null}
    </div>
  );
}

export function SecondaryReportsPage() {
  const canStatistics = useHasPermission(PERMISSION_CODES.childStatisticsView);
  const canEmis = useHasPermission('P17.report.emis');
  const unitChoice = useUnitChoice();
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value === 'THCS' || level.value === 'THPT');
  const [chosen, setChosen] = useState<SchoolLevelCode>();
  const level = chosen && levels.some((item) => item.value === chosen) ? chosen : (levels[0]?.value ?? 'THCS');
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((code) => (code === 'emis' ? canEmis : canStatistics));
  const [tab, setTab] = useState<Tab | ''>('');
  const current = tab || tabs[0] || 'enrollment';
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const params: Params = { school_level: level, org_unit_id: unitChoice.selectedId };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/secondary-reports')}</h1>
        <div className="flex flex-wrap items-end gap-4">
          {current !== 'emis' ? (
            <>
              {levels.length > 1 ? (
                <label className="flex flex-col gap-2 text-label font-medium text-text">
                  Cấp học
                  <select
                    value={level}
                    onChange={(event) => setChosen(event.target.value as SchoolLevelCode)}
                    className={SELECT_CLASS}
                  >
                    {levels.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
            </>
          ) : null}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Báo cáo, thống kê THCS, THPT">
            {tabs.map((code) => (
              <Button
                key={code}
                role="tab"
                aria-selected={current === code}
                variant={current === code ? 'primary' : 'secondary'}
                onClick={() => setTab(code)}
              >
                {TAB_LABELS[code]}
              </Button>
            ))}
          </div>
        </div>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {current === 'enrollment' ? <EnrollmentTab params={params} /> : null}
          {current === 'results' ? <ResultsTab params={params} /> : null}
          {current === 'scores' ? <ScoresTab params={params} /> : null}
          {current === 'teachers' ? <TeachersTab params={params} /> : null}
          {current === 'emis' ? <EmisTab base="secondary-reports" onSaved={setToastMessage} /> : null}
        </section>
      </div>
    </AppShell>
  );
}
