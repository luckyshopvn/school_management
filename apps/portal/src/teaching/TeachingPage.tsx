import { useCallback, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { FormButtons, FormPanel } from '../pages/FormPanel.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  getJson,
  messageOf,
  PLAN_STATUS_LABELS,
  postJson,
  TEACHING_PLAN_STATUS_LABELS,
  vietnamToday,
  WEEKDAY_LABELS,
  type CatalogEntry,
  type Lesson,
  type LessonPlan,
  type TeachingPlan,
  type Timetable,
} from './teaching-api.js';

// MG-17 trên cổng quản trị và quản lý giảng dạy (P03-01 đến P03-05, P03-08; BR-64; YCTD-80): tổ trưởng chuyên môn và quản
// lý đơn vị duyệt hoặc trả lại giáo án kèm góp ý; xem bài học lọc theo lĩnh vực; quản lý lĩnh vực, nhóm bài học, chủ đề;
// lập và công bố thời khóa biểu, kế hoạch giảng dạy của lớp. Giao diện chung theo Sở (DT-15 phần 15f3, YCTD-115): giáo án
// chờ duyệt, bài học, lĩnh vực, nhóm bài học, chủ đề và kế hoạch giảng dạy là lưới dữ liệu chung (khóa
// `lesson-plan-reviews`, `lessons`, `lesson-domains`, `lesson-groups`, `lesson-themes`, `teaching-plans`), Thêm mới mở
// biểu mẫu theo khối có nút Ghi; thời khóa biểu là lịch theo tuần nên giữ bố cục
type Tab = 'review' | 'lessons' | 'catalogs' | 'classes';
type Notify = (message: string) => void;
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

export function TeachingPage() {
  const canReview = useHasPermission(PERMISSION_CODES.lessonPlanReview);
  const canManageCurriculum = useHasPermission(PERMISSION_CODES.curriculumManage);
  const [tab, setTab] = useState<Tab>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string]> = [
    ...(canReview ? [['review', 'Giáo án chờ duyệt'] as [Tab, string]] : []),
    ['lessons', 'Bài học'],
    ...(canManageCurriculum ? [['catalogs', 'Lĩnh vực và chủ đề'] as [Tab, string]] : []),
    ['classes', 'Thời khóa biểu và kế hoạch'],
  ];
  const current = tab ?? tabs[0]?.[0] ?? 'lessons';
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/teaching')}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Giảng dạy">
          {tabs.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={current === code}
              variant={current === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {current === 'review' ? <ReviewTab onDone={setToastMessage} /> : null}
        {current === 'lessons' ? <LessonsTab /> : null}
        {current === 'catalogs' ? <CatalogsTab onDone={setToastMessage} /> : null}
        {current === 'classes' ? <ClassesTab onDone={setToastMessage} canManage={canManageCurriculum} /> : null}
      </div>
    </AppShell>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-content"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const REVIEW_COLUMNS: Array<DataGridColumn<LessonPlan>> = [
  { id: 'planned_date', header: 'Ngày dạy', cell: (row) => row.planned_date },
  { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name },
  { id: 'teacher_name', header: 'Giáo viên', cell: (row) => row.teacher_name },
  {
    id: 'lesson_name',
    header: 'Bài học',
    alwaysVisible: true,
    cell: (row) => (
      <>
        {row.lesson_name}
        <div className="text-label text-text-secondary">{row.lesson_objectives}</div>
      </>
    ),
  },
  { id: 'activities', header: 'Hoạt động', cell: (row) => `${row.activities} (${row.duration_minutes} phút)` },
  { id: 'materials', header: 'Đồ dùng', hiddenByDefault: true, cell: (row) => row.materials ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => PLAN_STATUS_LABELS[row.status] },
];

function ReviewTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('lesson-plan-reviews');
  const [search, setSearch] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const pending = useQuery({
    queryKey: ['lesson-plans', 'review'],
    queryFn: () => getJson<LessonPlan[]>('/api/v1/lesson-plans?view=review'),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson<LessonPlan>(`/api/v1/lesson-plans/${id}/${approve ? 'approve' : 'reject'}`, {
        comment: comments[id] || null,
      }),
    onSuccess: async (decided) => {
      await queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      onDone(`Giáo án: ${PLAN_STATUS_LABELS[decided.status]}`);
    },
  });
  const error = pending.error ?? decide.error ?? grid.error;
  const rows = (pending.data ?? []).filter((row) =>
    matchesSearch(search, row.class_name, row.teacher_name, row.lesson_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Giáo án chờ duyệt"
        columns={REVIEW_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `giáo án ${row.lesson_name}`}
        loading={pending.isPending}
        emptyText="Không có giáo án chờ duyệt"
        search={{ label: 'Tìm theo lớp, giáo viên, bài học', value: search, onChange: setSearch }}
        rowActions={(row) => (
          <div className="flex flex-col items-end gap-2">
            <input
              aria-label="Góp ý"
              placeholder="Góp ý"
              className="w-48 rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
              value={comments[row.id] ?? ''}
              onChange={(event) => setComments((previous) => ({ ...previous, [row.id]: event.target.value }))}
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, approve: true })}
              >
                Duyệt
              </Button>
              <Button
                disabled={decide.isPending || !comments[row.id]}
                onClick={() => decide.mutate({ id: row.id, approve: false })}
              >
                Trả lại
              </Button>
            </div>
          </div>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const LESSON_COLUMNS: Array<DataGridColumn<Lesson>> = [
  { id: 'name', header: 'Bài học', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'domain_name', header: 'Lĩnh vực', cell: (row) => row.domain_name ?? '' },
  { id: 'lesson_group_name', header: 'Nhóm', cell: (row) => row.lesson_group_name ?? '' },
  { id: 'theme_name', header: 'Chủ đề', cell: (row) => row.theme_name ?? '' },
  { id: 'age_group', header: 'Độ tuổi', cell: (row) => row.age_group ?? '' },
  { id: 'objectives', header: 'Mục tiêu', cell: (row) => row.objectives },
  { id: 'materials', header: 'Đồ dùng', hiddenByDefault: true, cell: (row) => row.materials ?? '' },
  { id: 'is_shared', header: 'Chia sẻ', cell: (row) => (row.is_shared ? 'Có' : 'Riêng') },
];

function LessonsTab() {
  const grid = useGridSettings('lessons');
  const [domainId, setDomainId] = useState('');
  const [search, setSearch] = useState('');
  const domains = useQuery({
    queryKey: ['lesson-domains'],
    queryFn: () => getJson<CatalogEntry[]>('/api/v1/lesson-domains?status=active'),
  });
  const lessons = useQuery({
    queryKey: ['lessons', domainId],
    queryFn: () => getJson<Lesson[]>(`/api/v1/lessons${domainId ? `?domain_id=${domainId}` : ''}`),
  });
  const error = lessons.error ?? grid.error;
  const rows = (lessons.data ?? []).filter((row) =>
    matchesSearch(search, row.name, row.objectives, row.theme_name, row.lesson_group_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Bài học"
        columns={LESSON_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `bài học ${row.name}`}
        loading={lessons.isPending}
        emptyText="Chưa có bài học."
        search={{ label: 'Tìm theo tên bài học, mục tiêu, nhóm, chủ đề', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lĩnh vực
              <select value={domainId} onChange={(event) => setDomainId(event.target.value)} className={filterClass}>
                <option value="">Tất cả lĩnh vực</option>
                {(domains.data ?? []).map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const statusText = (entry: CatalogEntry) => (entry.status === 'active' ? 'Đang dùng' : 'Ngừng dùng');

type CatalogKind = 'domain' | 'group' | 'theme';

// Thêm lĩnh vực, nhóm bài học hoặc chủ đề theo biểu mẫu khối có nút Ghi
function CatalogForm({
  kind,
  orgUnitId,
  domainOptions,
  onSaved,
  onCancel,
}: {
  kind: CatalogKind;
  orgUnitId: string | undefined;
  domainOptions: Array<{ value: string; label: string }>;
  onSaved(created: CatalogEntry): void;
  onCancel(): void;
}) {
  const [name, setName] = useState('');
  const [groupDomainId, setGroupDomainId] = useState('');
  const [themeFrom, setThemeFrom] = useState(vietnamToday);
  const [themeTo, setThemeTo] = useState(vietnamToday);
  const create = useMutation({
    mutationFn: () =>
      kind === 'domain'
        ? postJson<CatalogEntry>('/api/v1/lesson-domains', {
            org_unit_id: orgUnitId,
            name,
            order_no: domainOptions.length + 1,
          })
        : kind === 'group'
          ? postJson<CatalogEntry>('/api/v1/lesson-groups', { domain_id: groupDomainId, name })
          : postJson<CatalogEntry>('/api/v1/themes', {
              org_unit_id: orgUnitId,
              name,
              start_date: themeFrom,
              end_date: themeTo,
            }),
    onSuccess: onSaved,
  });
  const title = { domain: 'Thêm lĩnh vực', group: 'Thêm nhóm bài học', theme: 'Thêm chủ đề' }[kind];
  return (
    <form
      aria-label={title}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title={title}>
        {kind === 'group' ? (
          <FormRow label="Thuộc lĩnh vực">
            <select
              className={FORM_CONTROL_CLASS}
              value={groupDomainId}
              onChange={(event) => setGroupDomainId(event.target.value)}
            >
              <option value="">Chọn lĩnh vực</option>
              {domainOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label={{ domain: 'Tên lĩnh vực', group: 'Tên nhóm', theme: 'Tên chủ đề' }[kind]}>
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        {kind === 'theme' ? (
          <>
            <FormRow label="Từ ngày">
              <input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={themeFrom}
                onChange={(event) => setThemeFrom(event.target.value)}
              />
            </FormRow>
            <FormRow label="Đến ngày">
              <input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={themeTo}
                onChange={(event) => setThemeTo(event.target.value)}
              />
            </FormRow>
          </>
        ) : null}
      </FormBlock>
      <FormButtons
        busy={create.isPending}
        disabled={!name || (kind === 'group' && !groupDomainId)}
        onCancel={onCancel}
      />
    </form>
  );
}

function CatalogsTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const domainGrid = useGridSettings('lesson-domains');
  const groupGrid = useGridSettings('lesson-groups');
  const themeGrid = useGridSettings('lesson-themes');
  const [creating, setCreating] = useState<CatalogKind>();
  const [domainSearch, setDomainSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [themeSearch, setThemeSearch] = useState('');
  const domains = useQuery({
    queryKey: ['lesson-domains', unitChoice.selectedId],
    queryFn: () => getJson<CatalogEntry[]>(`/api/v1/lesson-domains?org_unit_id=${unitChoice.selectedId ?? ''}`),
    enabled: Boolean(unitChoice.selectedId),
  });
  const groups = useQuery({
    queryKey: ['lesson-groups', unitChoice.selectedId],
    queryFn: () => getJson<CatalogEntry[]>(`/api/v1/lesson-groups?org_unit_id=${unitChoice.selectedId ?? ''}`),
    enabled: Boolean(unitChoice.selectedId),
  });
  const themes = useQuery({
    queryKey: ['themes', unitChoice.selectedId],
    queryFn: () => getJson<CatalogEntry[]>(`/api/v1/themes?org_unit_id=${unitChoice.selectedId ?? ''}`),
    enabled: Boolean(unitChoice.selectedId),
  });
  const domainOptions = (domains.data ?? []).map((domain) => ({ value: domain.id, label: domain.name }));
  const domainNames = new Map(domainOptions.map((option) => [option.value, option.label]));
  const error = [domains.error, groups.error, themes.error, domainGrid.error, groupGrid.error, themeGrid.error].find(
    Boolean,
  );
  const loading = (pending: boolean) => Boolean(unitChoice.selectedId) && pending;
  const addButton = (kind: CatalogKind) => (
    <Button variant="primary" onClick={() => setCreating(kind)}>
      Thêm mới
    </Button>
  );
  const form = (kind: CatalogKind) =>
    creating === kind ? (
      <FormPanel>
        <CatalogForm
          kind={kind}
          orgUnitId={unitChoice.selectedId}
          domainOptions={domainOptions}
          onCancel={() => setCreating(undefined)}
          onSaved={async (created) => {
            setCreating(undefined);
            await queryClient.invalidateQueries();
            onDone(`Đã thêm ${created.name}`);
          }}
        />
      </FormPanel>
    ) : null;
  const domainColumns: Array<DataGridColumn<CatalogEntry>> = [
    { id: 'name', header: 'Tên lĩnh vực', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'order_no', header: 'Thứ tự', cell: (row) => row.order_no ?? '' },
    { id: 'status', header: 'Trạng thái', hiddenByDefault: true, cell: statusText },
  ];
  const groupColumns: Array<DataGridColumn<CatalogEntry>> = [
    { id: 'name', header: 'Tên nhóm', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'domain', header: 'Lĩnh vực', cell: (row) => domainNames.get(row.domain_id ?? '') ?? '' },
    { id: 'age_group', header: 'Độ tuổi', hiddenByDefault: true, cell: (row) => row.age_group ?? '' },
    { id: 'status', header: 'Trạng thái', hiddenByDefault: true, cell: statusText },
  ];
  const themeColumns: Array<DataGridColumn<CatalogEntry>> = [
    { id: 'name', header: 'Tên chủ đề', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'start_date', header: 'Từ ngày', cell: (row) => row.start_date ?? '' },
    { id: 'end_date', header: 'Đến ngày', cell: (row) => row.end_date ?? '' },
    { id: 'status', header: 'Trạng thái', hiddenByDefault: true, cell: statusText },
  ];
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="max-w-sm">
        <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
      </div>
      <h2 className="text-section-title font-semibold">Lĩnh vực</h2>
      {form('domain')}
      <DataGrid
        label="Lĩnh vực"
        columns={domainColumns}
        rows={(domains.data ?? []).filter((row) => matchesSearch(domainSearch, row.name))}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `lĩnh vực ${row.name}`}
        loading={loading(domains.isPending)}
        emptyText="Chưa có lĩnh vực."
        search={{ label: 'Tìm theo tên lĩnh vực', value: domainSearch, onChange: setDomainSearch }}
        toolbar={addButton('domain')}
        settings={domainGrid.settings}
        onSettingsChange={domainGrid.update}
      />
      <h2 className="text-section-title font-semibold">Nhóm bài học</h2>
      {form('group')}
      <DataGrid
        label="Nhóm bài học"
        columns={groupColumns}
        rows={(groups.data ?? []).filter((row) =>
          matchesSearch(groupSearch, row.name, domainNames.get(row.domain_id ?? '')),
        )}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `nhóm ${row.name}`}
        loading={loading(groups.isPending)}
        emptyText="Chưa có nhóm bài học."
        search={{ label: 'Tìm theo tên nhóm, lĩnh vực', value: groupSearch, onChange: setGroupSearch }}
        toolbar={addButton('group')}
        settings={groupGrid.settings}
        onSettingsChange={groupGrid.update}
      />
      <h2 className="text-section-title font-semibold">Chủ đề</h2>
      {form('theme')}
      <DataGrid
        label="Chủ đề"
        columns={themeColumns}
        rows={(themes.data ?? []).filter((row) => matchesSearch(themeSearch, row.name))}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `chủ đề ${row.name}`}
        loading={loading(themes.isPending)}
        emptyText="Chưa có chủ đề."
        search={{ label: 'Tìm theo tên chủ đề', value: themeSearch, onChange: setThemeSearch }}
        toolbar={addButton('theme')}
        settings={themeGrid.settings}
        onSettingsChange={themeGrid.update}
      />
    </div>
  );
}

interface SlotRow {
  weekday: string;
  period_no: string;
  start_time: string;
  end_time: string;
  activity_name: string;
}

const nextMonday = () => {
  const today = vietnamToday();
  const day = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
  return new Date(Date.parse(`${today}T00:00:00Z`) + (8 - day) * 86_400_000).toISOString().slice(0, 10);
};

function ClassesTab({ onDone, canManage }: { onDone: Notify; canManage: boolean }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [classId, setClassId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(nextMonday);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const classes = useQuery({
    queryKey: ['classes', unitChoice.selectedId],
    queryFn: () => listClasses(unitChoice.selectedId ?? ''),
    enabled: Boolean(unitChoice.selectedId),
  });
  const selectedClassId = classId || classes.data?.[0]?.id || '';
  const timetable = useQuery({
    queryKey: ['timetable', selectedClassId, effectiveFrom],
    queryFn: () => getJson<Timetable>(`/api/v1/classes/${selectedClassId}/timetable?week=${effectiveFrom}`),
    enabled: Boolean(selectedClassId),
  });
  const action = useMutation({
    mutationFn: ({ path, body, method }: { path: string; body: unknown; method?: string }) =>
      postJson<unknown>(path, body, method),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['timetable'] });
      await queryClient.invalidateQueries({ queryKey: ['teaching-plans'] });
      onDone(variables.method === 'PUT' ? 'Đã lưu bản nháp thời khóa biểu' : 'Đã lưu');
    },
  });
  const update = (index: number, field: keyof SlotRow, value: string) =>
    setSlots((previous) => previous.map((row, position) => (position === index ? { ...row, [field]: value } : row)));
  return (
    <div className="flex flex-col gap-4">
      {timetable.error || action.error ? (
        <Alert tone="danger">{messageOf(timetable.error ?? action.error)}</Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
        <Select
          label="Lớp"
          value={selectedClassId}
          onChange={setClassId}
          options={(classes.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
        />
        <TextField
          label="Tuần áp dụng (thứ Hai)"
          type="date"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </div>
      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Thời khóa biểu">
        <h2 className="text-section-title font-semibold">
          Thời khóa biểu{' '}
          {timetable.data?.effective_from
            ? `áp dụng từ ${timetable.data.effective_from} (${timetable.data.status === 'published' ? 'đã công bố' : 'nháp'})`
            : ''}
        </h2>
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Thứ</th>
              <th>Tiết</th>
              <th>Giờ</th>
              <th>Hoạt động</th>
              <th>Giáo viên</th>
            </tr>
          </thead>
          <tbody>
            {(timetable.data?.slots ?? []).map((slot) => (
              <tr key={slot.id} className="border-t border-border">
                <td className="py-2">{WEEKDAY_LABELS[slot.weekday]}</td>
                <td>{slot.period_no}</td>
                <td>
                  {slot.start_time}–{slot.end_time}
                </td>
                <td>{slot.activity_name}</td>
                <td>{slot.teacher_name ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canManage ? (
          <div className="flex flex-col gap-2">
            {slots.map((row, index) => (
              <fieldset
                key={index}
                className="grid grid-cols-2 gap-2 md:grid-cols-5"
                aria-label={`Tiết mới ${index + 1}`}
              >
                <TextField
                  label="Thứ (1-7)"
                  value={row.weekday}
                  onChange={(event) => update(index, 'weekday', event.target.value)}
                />
                <TextField
                  label="Tiết"
                  value={row.period_no}
                  onChange={(event) => update(index, 'period_no', event.target.value)}
                />
                <TextField
                  label="Bắt đầu"
                  value={row.start_time}
                  onChange={(event) => update(index, 'start_time', event.target.value)}
                />
                <TextField
                  label="Kết thúc"
                  value={row.end_time}
                  onChange={(event) => update(index, 'end_time', event.target.value)}
                />
                <TextField
                  label="Hoạt động"
                  value={row.activity_name}
                  onChange={(event) => update(index, 'activity_name', event.target.value)}
                />
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="text"
                onClick={() =>
                  setSlots((previous) => [
                    ...previous,
                    {
                      weekday: '1',
                      period_no: String(previous.length + 1),
                      start_time: '08:00',
                      end_time: '08:30',
                      activity_name: '',
                    },
                  ])
                }
              >
                Thêm tiết
              </Button>
              <Button
                disabled={action.isPending || slots.length === 0}
                onClick={() =>
                  action.mutate({
                    path: `/api/v1/classes/${selectedClassId}/timetable`,
                    method: 'PUT',
                    body: {
                      effective_from: effectiveFrom,
                      slots: slots.map((row) => ({
                        weekday: Number(row.weekday),
                        period_no: Number(row.period_no),
                        start_time: row.start_time,
                        end_time: row.end_time,
                        activity_name: row.activity_name,
                      })),
                    },
                  })
                }
              >
                Lưu bản nháp
              </Button>
              <Button
                variant="primary"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: `/api/v1/classes/${selectedClassId}/timetable/publish`,
                    body: { effective_from: effectiveFrom },
                  })
                }
              >
                Công bố thời khóa biểu
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {selectedClassId ? (
        <TeachingPlansSection classId={selectedClassId} canManage={canManage} onDone={onDone} />
      ) : null}
    </div>
  );
}

const TEACHING_PLAN_COLUMNS: Array<DataGridColumn<TeachingPlan>> = [
  {
    id: 'period_value',
    header: 'Học kỳ',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.period_value,
  },
  { id: 'objectives', header: 'Mục tiêu', cell: (row) => row.objectives },
  { id: 'content', header: 'Nội dung dự kiến', cell: (row) => row.content },
  { id: 'status', header: 'Trạng thái', cell: (row) => TEACHING_PLAN_STATUS_LABELS[row.status] },
  { id: 'progress_note', header: 'Tiến độ', cell: (row) => row.progress_note ?? '' },
];

function TeachingPlanForm({ classId, onSaved, onCancel }: { classId: string; onSaved(): void; onCancel(): void }) {
  const [plan, setPlan] = useState({ period_value: 'HK1', objectives: '', content: '' });
  const create = useMutation({
    mutationFn: () => postJson<unknown>('/api/v1/teaching-plans', { class_id: classId, period_type: 'term', ...plan }),
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Lập kế hoạch giảng dạy"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập kế hoạch giảng dạy">
        <FormRow label="Học kỳ (HK1, HK2, HE)">
          <input
            className={FORM_CONTROL_CLASS}
            value={plan.period_value}
            onChange={(event) => setPlan({ ...plan, period_value: event.target.value })}
          />
        </FormRow>
        <FormRow label="Mục tiêu">
          <input
            className={FORM_CONTROL_CLASS}
            value={plan.objectives}
            onChange={(event) => setPlan({ ...plan, objectives: event.target.value })}
          />
        </FormRow>
        <FormRow label="Nội dung dự kiến">
          <input
            className={FORM_CONTROL_CLASS}
            value={plan.content}
            onChange={(event) => setPlan({ ...plan, content: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!plan.objectives || !plan.content} onCancel={onCancel} />
    </form>
  );
}

// Kế hoạch giảng dạy theo học kỳ của lớp đang chọn
function TeachingPlansSection({ classId, canManage, onDone }: { classId: string; canManage: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('teaching-plans');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const plans = useQuery({
    queryKey: ['teaching-plans', classId],
    queryFn: () => getJson<TeachingPlan[]>(`/api/v1/teaching-plans?class_id=${classId}`),
  });
  const error = plans.error ?? grid.error;
  const rows = (plans.data ?? []).filter((row) => matchesSearch(search, row.period_value, row.objectives, row.content));
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Kế hoạch giảng dạy</h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <TeachingPlanForm
            key={classId}
            classId={classId}
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['teaching-plans'] });
              onDone('Đã lưu');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Kế hoạch giảng dạy"
        columns={TEACHING_PLAN_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `kế hoạch ${row.period_value}`}
        loading={plans.isPending}
        emptyText="Lớp chưa có kế hoạch giảng dạy."
        search={{ label: 'Tìm theo học kỳ, mục tiêu, nội dung', value: search, onChange: setSearch }}
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}
