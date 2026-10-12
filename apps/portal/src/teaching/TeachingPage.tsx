import { useCallback, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
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
// lập và công bố thời khóa biểu, kế hoạch giảng dạy của lớp
type Tab = 'review' | 'lessons' | 'catalogs' | 'classes';

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
        <h1 className="text-page-title font-bold text-text">Bài học và giáo án</h1>
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

function ReviewTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
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
  const rows = pending.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      {pending.error || decide.error ? <Alert tone="danger">{messageOf(pending.error ?? decide.error)}</Alert> : null}
      {rows.length === 0 && !pending.isPending ? (
        <p className="text-content text-text-secondary">Không có giáo án chờ duyệt</p>
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Ngày dạy</th>
            <th>Lớp</th>
            <th>Giáo viên</th>
            <th>Bài học</th>
            <th>Hoạt động</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              <td className="py-2">{row.planned_date}</td>
              <td>{row.class_name}</td>
              <td>{row.teacher_name}</td>
              <td>
                {row.lesson_name}
                <div className="text-label text-text-secondary">{row.lesson_objectives}</div>
              </td>
              <td>
                {row.activities} ({row.duration_minutes} phút)
              </td>
              <td>{PLAN_STATUS_LABELS[row.status]}</td>
              <td>
                <div className="flex flex-col gap-2">
                  <TextField
                    label="Góp ý"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LessonsTab() {
  const [domainId, setDomainId] = useState('');
  const domains = useQuery({
    queryKey: ['lesson-domains'],
    queryFn: () => getJson<CatalogEntry[]>('/api/v1/lesson-domains?status=active'),
  });
  const lessons = useQuery({
    queryKey: ['lessons', domainId],
    queryFn: () => getJson<Lesson[]>(`/api/v1/lessons${domainId ? `?domain_id=${domainId}` : ''}`),
  });
  return (
    <div className="flex flex-col gap-4">
      {lessons.error ? <Alert tone="danger">{messageOf(lessons.error)}</Alert> : null}
      <div className="max-w-sm">
        <Select
          label="Lĩnh vực"
          value={domainId}
          onChange={setDomainId}
          options={[
            { value: '', label: 'Tất cả lĩnh vực' },
            ...(domains.data ?? []).map((domain) => ({ value: domain.id, label: domain.name })),
          ]}
        />
      </div>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Bài học</th>
            <th>Lĩnh vực</th>
            <th>Nhóm</th>
            <th>Chủ đề</th>
            <th>Độ tuổi</th>
            <th>Mục tiêu</th>
            <th>Chia sẻ</th>
          </tr>
        </thead>
        <tbody>
          {(lessons.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.name}</td>
              <td>{row.domain_name ?? ''}</td>
              <td>{row.lesson_group_name ?? ''}</td>
              <td>{row.theme_name ?? ''}</td>
              <td>{row.age_group ?? ''}</td>
              <td>{row.objectives}</td>
              <td>{row.is_shared ? 'Có' : 'Riêng'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CatalogsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [domainName, setDomainName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDomainId, setGroupDomainId] = useState('');
  const [themeName, setThemeName] = useState('');
  const [themeFrom, setThemeFrom] = useState(vietnamToday);
  const [themeTo, setThemeTo] = useState(vietnamToday);
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
  const create = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => postJson<CatalogEntry>(path, body),
    onSuccess: async (created) => {
      setDomainName('');
      setGroupName('');
      setThemeName('');
      await queryClient.invalidateQueries();
      onDone(`Đã thêm ${created.name}`);
    },
  });
  const domainOptions = (domains.data ?? []).map((domain) => ({ value: domain.id, label: domain.name }));
  const domainNames = new Map(domainOptions.map((option) => [option.value, option.label]));
  return (
    <div className="flex flex-col gap-4">
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div className="max-w-sm">
        <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
      </div>
      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Lĩnh vực">
        <h2 className="text-section-title font-semibold">Lĩnh vực</h2>
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Tên lĩnh vực" value={domainName} onChange={(event) => setDomainName(event.target.value)} />
          <Button
            variant="primary"
            disabled={!domainName || create.isPending}
            onClick={() =>
              create.mutate({
                path: '/api/v1/lesson-domains',
                body: { org_unit_id: unitChoice.selectedId, name: domainName, order_no: domainOptions.length + 1 },
              })
            }
          >
            Thêm lĩnh vực
          </Button>
        </div>
        <ul className="list-disc pl-6 text-content">
          {(domains.data ?? []).map((domain) => (
            <li key={domain.id}>{domain.name}</li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Nhóm bài học">
        <h2 className="text-section-title font-semibold">Nhóm bài học</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label="Thuộc lĩnh vực"
            value={groupDomainId}
            onChange={setGroupDomainId}
            options={[{ value: '', label: 'Chọn lĩnh vực' }, ...domainOptions]}
          />
          <TextField label="Tên nhóm" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
          <Button
            disabled={!groupName || !groupDomainId || create.isPending}
            onClick={() =>
              create.mutate({ path: '/api/v1/lesson-groups', body: { domain_id: groupDomainId, name: groupName } })
            }
          >
            Thêm nhóm
          </Button>
        </div>
        <ul className="list-disc pl-6 text-content">
          {(groups.data ?? []).map((group) => (
            <li key={group.id}>
              {group.name} ({domainNames.get(group.domain_id ?? '') ?? ''})
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Chủ đề">
        <h2 className="text-section-title font-semibold">Chủ đề</h2>
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Tên chủ đề" value={themeName} onChange={(event) => setThemeName(event.target.value)} />
          <TextField
            label="Từ ngày"
            type="date"
            value={themeFrom}
            onChange={(event) => setThemeFrom(event.target.value)}
          />
          <TextField
            label="Đến ngày"
            type="date"
            value={themeTo}
            onChange={(event) => setThemeTo(event.target.value)}
          />
          <Button
            disabled={!themeName || create.isPending}
            onClick={() =>
              create.mutate({
                path: '/api/v1/themes',
                body: { org_unit_id: unitChoice.selectedId, name: themeName, start_date: themeFrom, end_date: themeTo },
              })
            }
          >
            Thêm chủ đề
          </Button>
        </div>
        <ul className="list-disc pl-6 text-content">
          {(themes.data ?? []).map((theme) => (
            <li key={theme.id}>
              {theme.name}: {theme.start_date} đến {theme.end_date}
            </li>
          ))}
        </ul>
      </section>
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

function ClassesTab({ onDone, canManage }: { onDone(message: string): void; canManage: boolean }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [classId, setClassId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(nextMonday);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [plan, setPlan] = useState({ period_value: 'HK1', objectives: '', content: '' });
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
  const plans = useQuery({
    queryKey: ['teaching-plans', selectedClassId],
    queryFn: () => getJson<TeachingPlan[]>(`/api/v1/teaching-plans?class_id=${selectedClassId}`),
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
      {timetable.error || plans.error || action.error ? (
        <Alert tone="danger">{messageOf(timetable.error ?? plans.error ?? action.error)}</Alert>
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
      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Kế hoạch giảng dạy">
        <h2 className="text-section-title font-semibold">Kế hoạch giảng dạy</h2>
        <ul className="flex flex-col gap-2 text-content">
          {(plans.data ?? []).map((row) => (
            <li key={row.id}>
              <strong>{row.period_value}</strong>: {row.objectives}. {row.content} (
              {TEACHING_PLAN_STATUS_LABELS[row.status]}){row.progress_note ? `. Tiến độ: ${row.progress_note}` : ''}
            </li>
          ))}
        </ul>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="Học kỳ (HK1, HK2, HE)"
              value={plan.period_value}
              onChange={(event) => setPlan({ ...plan, period_value: event.target.value })}
            />
            <TextField
              label="Mục tiêu"
              value={plan.objectives}
              onChange={(event) => setPlan({ ...plan, objectives: event.target.value })}
            />
            <TextField
              label="Nội dung dự kiến"
              value={plan.content}
              onChange={(event) => setPlan({ ...plan, content: event.target.value })}
            />
            <Button
              disabled={action.isPending || !plan.objectives || !plan.content}
              onClick={() =>
                action.mutate({
                  path: '/api/v1/teaching-plans',
                  body: { class_id: selectedClassId, period_type: 'term', ...plan },
                })
              }
            >
              Lập kế hoạch
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
