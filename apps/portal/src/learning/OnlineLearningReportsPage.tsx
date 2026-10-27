import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';
import { listSpaces } from './learning-api.js';

// 9.4 Báo cáo học tập trực tuyến (DT-28 phần 28d, YCTD-274): báo cáo theo vai trò (chủ nhiệm theo lớp, tổ chuyên môn, toàn trường,
// hoạt động dạy của giáo viên) và báo cáo tổng kết dạy học trực tuyến theo học kỳ do Ban Giám hiệu lập, xuất PDF, Excel để gửi
// Sở (Thông tư 09/2021/TT-BGDĐT Điều 15 khoản 6). Ai xem báo cáo nào do máy chủ quyết; báo cáo không có thì hiện lý do. Không có
// xếp hạng học sinh
type Tab = 'homeroom' | 'department' | 'school' | 'teachers' | 'term';

interface SpaceSummaryRow {
  space_id: string;
  title: string;
  student_count: number;
  activity_count: number;
  completion_percent: number;
  overdue: number;
}

interface SchoolStats {
  space_count: number;
  spaces_in_use: number;
  activities: number;
  by_mode: { support: number; replace: number };
  by_week: Array<{ week: string; count: number }>;
  students: number;
  participating: number;
  participation_percent: number;
  median_response_hours: number | null;
}

interface TermReport {
  term_type: 'first_term' | 'second_term';
  range: { from: string; to: string } | null;
  stats: SchoolStats;
  report: {
    evaluation: string | null;
    difficulties: string | null;
    causes: string | null;
    recommendations: string | null;
  } | null;
}

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

async function downloadFile(path: string, fileName: string) {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không tải được tệp');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

function SpacesTable({ label, spaces }: { label: string; spaces: SpaceSummaryRow[] }) {
  return (
    <table className="w-full text-content" aria-label={label}>
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          <th className="px-3 py-2">Lớp học trực tuyến</th>
          <th className="px-3 py-2">Học sinh</th>
          <th className="px-3 py-2">Hoạt động</th>
          <th className="px-3 py-2">Hoàn thành (%)</th>
          <th className="px-3 py-2">Lượt quá hạn</th>
        </tr>
      </thead>
      <tbody>
        {spaces.map((space) => (
          <tr key={space.space_id} className="border-t border-border">
            <td className="px-3 py-2">{space.title}</td>
            <td className="px-3 py-2">{space.student_count}</td>
            <td className="px-3 py-2">{space.activity_count}</td>
            <td className="px-3 py-2">{space.completion_percent}</td>
            <td className="px-3 py-2">{space.overdue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatsList({ stats }: { stats: SchoolStats }) {
  return (
    <ul className="flex flex-col gap-1 text-content" aria-label="Số liệu toàn trường">
      <li>
        Lớp học trực tuyến đang dùng: {stats.spaces_in_use}/{stats.space_count}
      </li>
      <li>
        Hoạt động đã giao: {stats.activities} (hỗ trợ {stats.by_mode.support}, thay thế {stats.by_mode.replace})
      </li>
      <li>
        Học sinh tham gia: {stats.participating}/{stats.students} ({stats.participation_percent}%)
      </li>
      <li>
        Trung vị thời gian giáo viên trả bài:{' '}
        {stats.median_response_hours === null ? 'chưa có bài trả' : `${stats.median_response_hours} giờ`}
      </li>
      {stats.by_week.length > 0 ? (
        <li>Hoạt động theo tuần: {stats.by_week.map((week) => `${week.week}: ${week.count}`).join('; ')}</li>
      ) : null}
    </ul>
  );
}

function HomeroomTab() {
  const spaces = useQuery({ queryKey: ['learning-spaces', 'all'], queryFn: () => listSpaces('all') });
  const classes = [
    ...new Map(
      (spaces.data ?? []).flatMap((space) =>
        space.class_id && space.class_name ? [[space.class_id, space.class_name] as const] : [],
      ),
    ).entries(),
  ].sort((left, right) => left[1].localeCompare(right[1], 'vi'));
  const [classId, setClassId] = useState('');
  const report = useQuery({
    queryKey: ['learning-report-homeroom', classId],
    queryFn: () =>
      requestJson<{
        spaces: SpaceSummaryRow[];
        attention: Array<{ child_id: string; full_name: string; reasons: string[] }>;
      }>(`/api/v1/learning/reports/homeroom?class_id=${classId}`),
    enabled: classId !== '',
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Báo cáo chủ nhiệm">
      <label className="text-label font-medium text-text">
        Lớp
        <select
          className={`mt-2 block w-full max-w-sm ${FORM_CONTROL_CLASS}`}
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">Chọn lớp</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <>
          <SpacesTable label="Các môn của lớp" spaces={report.data.spaces} />
          <h3 className="text-section-title font-semibold text-text">Học sinh cần chú ý</h3>
          {report.data.attention.length === 0 ? (
            <p className="text-content text-text-secondary">Không có học sinh cần chú ý.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-content" aria-label="Học sinh cần chú ý">
              {report.data.attention.map((row) => (
                <li key={row.child_id}>
                  <strong>{row.full_name}</strong>: {row.reasons.join('; ')}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}

function DepartmentTab() {
  const report = useQuery({
    queryKey: ['learning-report-department'],
    queryFn: () =>
      requestJson<{
        teams: Array<{
          team_id: string;
          name: string;
          space_count: number;
          active_spaces: number;
          template_spaces: number;
          completion_percent: number;
          spaces: SpaceSummaryRow[];
        }>;
      }>('/api/v1/learning/reports/department'),
  });
  if (report.error) return <Alert tone="danger">{messageOf(report.error)}</Alert>;
  return (
    <section className="flex flex-col gap-4" aria-label="Báo cáo tổ chuyên môn">
      {(report.data?.teams ?? []).map((team) => (
        <div key={team.team_id} className="flex flex-col gap-2">
          <h3 className="text-section-title font-semibold text-text">{team.name}</h3>
          <p className="text-label text-text-secondary">
            {team.active_spaces}/{team.space_count} lớp có hoạt động · {team.template_spaces} lớp dùng khoá mẫu · hoàn
            thành bình quân {team.completion_percent}%
          </p>
          <SpacesTable label={`Lớp của ${team.name}`} spaces={team.spaces} />
        </div>
      ))}
      {report.data && report.data.teams.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có tổ chuyên môn.</p>
      ) : null}
    </section>
  );
}

function SchoolTab() {
  const report = useQuery({
    queryKey: ['learning-report-school'],
    queryFn: () => requestJson<SchoolStats>('/api/v1/learning/reports/school'),
  });
  if (report.error) return <Alert tone="danger">{messageOf(report.error)}</Alert>;
  return report.data ? <StatsList stats={report.data} /> : null;
}

function TeachersTab() {
  const report = useQuery({
    queryKey: ['learning-report-teachers'],
    queryFn: () =>
      requestJson<{
        teachers: Array<{
          user_id: string;
          full_name: string;
          space_count: number;
          activities: number;
          returned: number;
          median_response_hours: number | null;
        }>;
      }>('/api/v1/learning/reports/teachers'),
  });
  if (report.error) return <Alert tone="danger">{messageOf(report.error)}</Alert>;
  return (
    <table className="w-full text-content" aria-label="Hoạt động dạy của giáo viên">
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          <th className="px-3 py-2">Giáo viên</th>
          <th className="px-3 py-2">Lớp học trực tuyến</th>
          <th className="px-3 py-2">Hoạt động đã giao</th>
          <th className="px-3 py-2">Bài đã trả</th>
          <th className="px-3 py-2">Trung vị giờ trả bài</th>
        </tr>
      </thead>
      <tbody>
        {(report.data?.teachers ?? []).map((teacher) => (
          <tr key={teacher.user_id} className="border-t border-border">
            <td className="px-3 py-2">{teacher.full_name}</td>
            <td className="px-3 py-2">{teacher.space_count}</td>
            <td className="px-3 py-2">{teacher.activities}</td>
            <td className="px-3 py-2">{teacher.returned}</td>
            <td className="px-3 py-2">{teacher.median_response_hours ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TEXT_FIELDS = [
  ['evaluation', 'Đánh giá'],
  ['difficulties', 'Khó khăn'],
  ['causes', 'Nguyên nhân'],
  ['recommendations', 'Kiến nghị'],
] as const;

function TermTab({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState<'first_term' | 'second_term'>('first_term');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const report = useQuery({
    queryKey: ['learning-term-report', term],
    queryFn: () => requestJson<TermReport>(`/api/v1/learning/term-reports/${term}`),
  });
  const save = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/learning/term-reports/${term}`, {
        method: 'PUT',
        body: JSON.stringify(
          Object.fromEntries(TEXT_FIELDS.map(([key]) => [key, draft[key] ?? report.data?.report?.[key] ?? null])),
        ),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['learning-term-report', term] });
      onSaved('Đã lưu báo cáo tổng kết');
    },
    onError: (error) => setErrorMessage(messageOf(error)),
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Báo cáo tổng kết học kỳ">
      <label className="text-label font-medium text-text">
        Học kỳ
        <select
          className={`mt-2 block w-full max-w-sm ${FORM_CONTROL_CLASS}`}
          value={term}
          onChange={(event) => {
            setTerm(event.target.value as typeof term);
            setDraft({});
          }}
        >
          <option value="first_term">Học kỳ I</option>
          <option value="second_term">Học kỳ II</option>
        </select>
      </label>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {report.data ? (
        <>
          <p className="text-label text-text-secondary">
            {report.data.range
              ? `Từ ${report.data.range.from} đến ${report.data.range.to}`
              : 'Năm học chưa khai báo học kỳ'}
          </p>
          <StatsList stats={report.data.stats} />
          {TEXT_FIELDS.map(([key, label]) => (
            <label key={key} className="text-label font-medium text-text">
              {label}
              <textarea
                className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                rows={3}
                value={draft[key] ?? report.data.report?.[key] ?? ''}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
              Lưu báo cáo tổng kết
            </Button>
            {(['pdf', 'xlsx'] as const).map((format) => (
              <Button
                key={format}
                variant="secondary"
                onClick={() =>
                  void downloadFile(
                    `/api/v1/learning/term-reports/${term}/file?format=${format}`,
                    `tong-ket-day-hoc-truc-tuyen-${term}.${format}`,
                  ).catch((error: unknown) => setErrorMessage(messageOf(error)))
                }
              >
                Xuất {format === 'pdf' ? 'PDF' : 'Excel'}
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

const TABS: Array<[Tab, string]> = [
  ['homeroom', 'Chủ nhiệm'],
  ['department', 'Tổ chuyên môn'],
  ['school', 'Toàn trường'],
  ['teachers', 'Hoạt động dạy của giáo viên'],
  ['term', 'Tổng kết học kỳ'],
];

export function OnlineLearningReportsPage() {
  const [tab, setTab] = useState<Tab>('homeroom');
  const [toastMessage, setToastMessage] = useState<string>();
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={() => setToastMessage(undefined)} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-learning-reports')}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại báo cáo">
          {TABS.map(([key, label]) => (
            <Button
              key={key}
              role="tab"
              aria-selected={tab === key}
              variant={tab === key ? 'primary' : 'secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === 'homeroom' ? <HomeroomTab /> : null}
        {tab === 'department' ? <DepartmentTab /> : null}
        {tab === 'school' ? <SchoolTab /> : null}
        {tab === 'teachers' ? <TeachersTab /> : null}
        {tab === 'term' ? <TermTab onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
