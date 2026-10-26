import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import {
  createActivity,
  createElective,
  createSection,
  listSpaces,
  MODE_LABELS,
  publishActivity,
  readLearningConfig,
  readPlan,
  readProgress,
  readSpace,
  recordResult,
  removeActivity,
  syncSpaces,
  updateActivity,
  updateSpace,
  type Activity,
  type SpaceDetail,
} from './learning-api.js';

// 9.1 Lớp học trực tuyến (DT-28 phần 28b, YCTD-272): lớp học trực tuyến theo lớp, môn tự sinh từ phân công giảng dạy, khoá tự
// chọn; giáo viên soạn chương, hoạt động (trang nội dung, liên kết, học liệu đã công bố), điều kiện mở "hoàn thành hoạt động
// trước", giao cho học sinh, xem tiến độ và kế hoạch theo tuần. Ban Giám hiệu, tổ trưởng xem mọi lớp và đồng bộ từ phân công
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa làm',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  excused: 'Miễn',
};

function ActivityForm({ detail, onSaved }: { detail: SpaceDetail; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [sectionId, setSectionId] = useState(detail.sections[0]?.id ?? '');
  const [kind, setKind] = useState('page');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [afterPrevious, setAfterPrevious] = useState(false);
  const previous = detail.activities.filter((activity) => activity.section_id === sectionId).at(-1);
  const create = useMutation({
    mutationFn: () =>
      createActivity(detail.space.id, {
        section_id: sectionId,
        kind,
        title,
        settings: kind === 'page' ? { body } : kind === 'link' ? { url: body } : { resource_id: body },
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        open_rules:
          afterPrevious && previous
            ? { mode: 'all', rules: [{ type: 'after_activity', activity_id: previous.id }] }
            : null,
      }),
    onSuccess: async (activity) => {
      setTitle('');
      setBody('');
      setDueAt('');
      setAfterPrevious(false);
      await queryClient.invalidateQueries({ queryKey: ['learning-space', detail.space.id] });
      onSaved(`Đã thêm hoạt động ${activity.title}`);
    },
  });
  if (detail.sections.length === 0) {
    return null;
  }
  return (
    <form
      aria-label="Thêm hoạt động"
      className="flex flex-col gap-3 rounded border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <h3 className="text-content font-semibold text-text">Thêm hoạt động</h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Chương
          <select
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
          >
            {detail.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Loại hoạt động
          <select
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="page">Trang nội dung</option>
            <option value="link">Liên kết</option>
            <option value="resource">Học liệu</option>
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Tên hoạt động
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Hạn hoàn thành
          <input
            type="datetime-local"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </label>
      </div>
      <label className="text-label font-medium text-text">
        {kind === 'page'
          ? 'Nội dung trang'
          : kind === 'link'
            ? 'Địa chỉ liên kết (https://)'
            : 'Mã học liệu đã công bố'}
        {kind === 'page' ? (
          <textarea
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        ) : (
          <input
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </label>
      {previous ? (
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={afterPrevious} onChange={(event) => setAfterPrevious(event.target.checked)} />
          Chỉ mở khi học sinh hoàn thành "{previous.title}"
        </label>
      ) : null}
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div>
        <Button type="submit" disabled={!title || create.isPending}>
          Thêm hoạt động
        </Button>
      </div>
    </form>
  );
}

function ActivityRow({
  activity,
  canTeach,
  onChanged,
}: {
  activity: Activity;
  canTeach: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['learning-space'] });
  const publish = useMutation({
    mutationFn: () => publishActivity(activity.id, activity.status !== 'published'),
    onSuccess: async (row) => {
      await refresh();
      onChanged(
        row.status === 'published' ? `Đã giao "${row.title}" cho học sinh` : `Đã chuyển "${row.title}" về nháp`,
      );
    },
  });
  const mode = useMutation({
    mutationFn: () =>
      updateActivity(activity.id, { teaching_mode: activity.teaching_mode === 'support' ? 'replace' : 'support' }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => removeActivity(activity.id), onSuccess: refresh });
  const error = publish.error ?? mode.error ?? remove.error;
  return (
    <li className="flex flex-col gap-1 border-t border-border py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text">{activity.title}</span>
        <StatusBadge tone="neutral" label={activity.kind_label} />
        <StatusBadge
          tone={activity.status === 'published' ? 'success' : 'neutral'}
          label={activity.status === 'published' ? 'Đã giao' : 'Nháp'}
        />
        <span className="text-label text-text-secondary">{MODE_LABELS[activity.teaching_mode]}</span>
        {activity.due_at ? (
          <span className="text-label text-text-secondary">
            Hạn {new Date(activity.due_at).toLocaleString('vi-VN')}
          </span>
        ) : null}
        {activity.template_item_key ? <span className="text-label text-text-secondary">Từ khoá mẫu</span> : null}
      </div>
      {canTeach ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="text" onClick={() => publish.mutate()}>
            {activity.status === 'published' ? 'Chuyển về nháp' : 'Giao cho học sinh'}
          </Button>
          <Button variant="text" onClick={() => mode.mutate()}>
            {activity.teaching_mode === 'support' ? 'Đổi sang thay thế' : 'Đổi sang hỗ trợ'}
          </Button>
          <Button variant="text" onClick={() => remove.mutate()}>
            Xóa
          </Button>
        </div>
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
    </li>
  );
}

function ProgressPanel({ spaceId, canTeach }: { spaceId: string; canTeach: boolean }) {
  const queryClient = useQueryClient();
  const progress = useQuery({ queryKey: ['learning-progress', spaceId], queryFn: () => readProgress(spaceId) });
  const mark = useMutation({
    mutationFn: (input: { activityId: string; childId: string }) =>
      recordResult(input.activityId, { child_id: input.childId, status: 'completed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning-progress', spaceId] }),
  });
  if (!progress.data) {
    return progress.error ? <Alert tone="danger">{messageOf(progress.error)}</Alert> : null;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-content" aria-label="Tiến độ học sinh">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Học sinh</th>
            <th className="px-3 py-2">Hoàn thành</th>
            <th className="px-3 py-2">Quá hạn</th>
            {progress.data.activities.map((activity) => (
              <th key={activity.id} className="px-3 py-2">
                {activity.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {progress.data.students.map((student) => (
            <tr key={student.child_id} className="border-t border-border">
              <td className="px-3 py-2">{student.full_name}</td>
              <td className="px-3 py-2">
                {student.summary.done}/{student.summary.required} ({student.summary.percent}%)
              </td>
              <td className="px-3 py-2">{student.summary.overdue}</td>
              {progress.data.activities.map((activity) => {
                const status = student.results[activity.id]?.status ?? 'not_started';
                return (
                  <td key={activity.id} className="px-3 py-2">
                    {STATUS_LABELS[status] ?? status}
                    {canTeach && status !== 'completed' ? (
                      <Button
                        variant="text"
                        onClick={() => mark.mutate({ activityId: activity.id, childId: student.child_id })}
                      >
                        Đánh dấu hoàn thành
                      </Button>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {mark.error ? <Alert tone="danger">{messageOf(mark.error)}</Alert> : null}
    </div>
  );
}

function PlanPanel({ spaceId }: { spaceId: string }) {
  const plan = useQuery({ queryKey: ['learning-plan', spaceId], queryFn: () => readPlan(spaceId) });
  return (
    <table className="w-full text-content" aria-label="Kế hoạch dạy học trực tuyến theo tuần">
      <thead className="text-left text-label font-medium text-text-secondary">
        <tr>
          <th className="px-3 py-2">Tuần</th>
          <th className="px-3 py-2">Chương</th>
          <th className="px-3 py-2">Hoạt động</th>
          <th className="px-3 py-2">Hình thức</th>
        </tr>
      </thead>
      <tbody>
        {(plan.data?.weeks ?? []).flatMap((week) =>
          week.items.map((item) => (
            <tr key={item.activity_id} className="border-t border-border">
              <td className="px-3 py-2">{week.week ?? 'Chưa xếp tuần'}</td>
              <td className="px-3 py-2">{item.section_title}</td>
              <td className="px-3 py-2">{item.title}</td>
              <td className="px-3 py-2">{MODE_LABELS[item.teaching_mode]}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

function SpacePanel({ spaceId, onChanged }: { spaceId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'content' | 'progress' | 'plan'>('content');
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionWeek, setSectionWeek] = useState('');
  const detail = useQuery({ queryKey: ['learning-space', spaceId], queryFn: () => readSpace(spaceId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['learning-space', spaceId] });
  const visible = useMutation({
    mutationFn: (value: boolean) => updateSpace(spaceId, { visible_to_students: value }),
    onSuccess: async (row) => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['learning-spaces'] });
      onChanged(row.space.visible_to_students ? 'Đã mở lớp cho học sinh' : 'Đã ẩn lớp với học sinh');
    },
  });
  const addSection = useMutation({
    mutationFn: () =>
      createSection(spaceId, { title: sectionTitle, planned_week: sectionWeek ? Number(sectionWeek) : null }),
    onSuccess: async () => {
      setSectionTitle('');
      setSectionWeek('');
      await refresh();
    },
  });
  if (!detail.data) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null;
  }
  const data = detail.data;
  return (
    <section
      aria-label={`Lớp học trực tuyến ${data.space.title}`}
      className="flex flex-col gap-4 rounded border border-border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section-title font-semibold text-text">{data.space.title}</h2>
          <p className="text-label text-text-secondary">
            {data.student_count} học sinh · Giáo viên:{' '}
            {data.teachers.map((teacher) => teacher.user_name).join(', ') || 'chưa có'}
            {data.replace_allowed_today ? ' · Có quyết định dạy học trực tuyến thay thế' : ''}
          </p>
        </div>
        {data.can_teach ? (
          <Button onClick={() => visible.mutate(!data.space.visible_to_students)}>
            {data.space.visible_to_students ? 'Ẩn với học sinh' : 'Mở lớp cho học sinh'}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2" role="tablist">
        {(
          [
            ['content', 'Nội dung'],
            ['progress', 'Tiến độ'],
            ['plan', 'Kế hoạch theo tuần'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? 'primary' : 'secondary'}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === 'content' ? (
        <div className="flex flex-col gap-4">
          {data.sections.map((section) => (
            <div key={section.id}>
              <h3 className="text-content font-semibold text-text">
                {section.title}
                {section.planned_week ? ` (tuần ${section.planned_week})` : ''}
              </h3>
              <ul>
                {data.activities
                  .filter((activity) => activity.section_id === section.id)
                  .map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      canTeach={data.can_teach}
                      onChanged={onChanged}
                    />
                  ))}
              </ul>
            </div>
          ))}
          {data.can_teach ? (
            <form
              aria-label="Thêm chương"
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addSection.mutate();
              }}
            >
              <label className="text-label font-medium text-text">
                Tên chương
                <input
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={sectionTitle}
                  onChange={(event) => setSectionTitle(event.target.value)}
                />
              </label>
              <label className="text-label font-medium text-text">
                Tuần
                <input
                  type="number"
                  min={1}
                  max={60}
                  className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                  value={sectionWeek}
                  onChange={(event) => setSectionWeek(event.target.value)}
                />
              </label>
              <Button type="submit" disabled={!sectionTitle || addSection.isPending}>
                Thêm chương
              </Button>
            </form>
          ) : null}
          {addSection.error ? <Alert tone="danger">{messageOf(addSection.error)}</Alert> : null}
          {data.can_teach ? <ActivityForm key={data.sections.length} detail={data} onSaved={onChanged} /> : null}
        </div>
      ) : null}
      {tab === 'progress' ? <ProgressPanel spaceId={spaceId} canTeach={data.can_teach} /> : null}
      {tab === 'plan' ? <PlanPanel spaceId={spaceId} /> : null}
      {visible.error ? <Alert tone="danger">{messageOf(visible.error)}</Alert> : null}
    </section>
  );
}

export function OnlineClassesPage() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['learning-config'], queryFn: readLearningConfig });
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [openId, setOpenId] = useState<string>();
  const [electiveTitle, setElectiveTitle] = useState('');
  const [electiveLevel, setElectiveLevel] = useState('THCS');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const spaces = useQuery({ queryKey: ['learning-spaces', scope], queryFn: () => listSpaces(scope) });
  const sync = useMutation({
    mutationFn: syncSpaces,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['learning-spaces'] });
      setToastMessage(`Đã đồng bộ: thêm ${result.created} lớp, ${result.teachers_added} giáo viên`);
    },
  });
  const elective = useMutation({
    mutationFn: () => createElective({ title: electiveTitle, school_level: electiveLevel }),
    onSuccess: async () => {
      setElectiveTitle('');
      await queryClient.invalidateQueries({ queryKey: ['learning-spaces'] });
      setToastMessage('Đã tạo khoá tự chọn');
    },
  });
  const canView = config.data?.can_view === true;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-classes')}</h1>
        <p className="text-content text-text-secondary">
          Mỗi lớp và môn có phân công giảng dạy có sẵn một lớp học trực tuyến; giáo viên không phải tạo lại lớp. Lớp ẩn
          với học sinh đến khi giáo viên mở.
        </p>
        <div className="flex flex-wrap gap-2">
          {canView ? (
            <>
              <Button variant={scope === 'mine' ? 'primary' : 'secondary'} onClick={() => setScope('mine')}>
                Lớp tôi dạy
              </Button>
              <Button variant={scope === 'all' ? 'primary' : 'secondary'} onClick={() => setScope('all')}>
                Tất cả lớp
              </Button>
              <Button variant="secondary" onClick={() => sync.mutate()} disabled={sync.isPending}>
                Đồng bộ từ phân công giảng dạy
              </Button>
            </>
          ) : null}
        </div>
        {spaces.error ? <Alert tone="danger">{messageOf(spaces.error)}</Alert> : null}
        {sync.error ? <Alert tone="danger">{messageOf(sync.error)}</Alert> : null}
        <table className="w-full text-content" aria-label="Lớp học trực tuyến">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Lớp học trực tuyến</th>
              <th className="px-3 py-2">Giáo viên</th>
              <th className="px-3 py-2">Hoạt động</th>
              <th className="px-3 py-2">Học sinh</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(spaces.data ?? []).map((space) => (
              <tr key={space.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {space.title}
                  {space.kind === 'elective' ? ' (tự chọn)' : ''}
                </td>
                <td className="px-3 py-2">{space.teacher_names}</td>
                <td className="px-3 py-2">{space.activity_count}</td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={space.visible_to_students ? 'success' : 'neutral'}
                    label={space.visible_to_students ? 'Đã mở' : 'Đang ẩn'}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="text" onClick={() => setOpenId(openId === space.id ? undefined : space.id)}>
                    {openId === space.id ? 'Đóng' : 'Mở'}
                  </Button>
                </td>
              </tr>
            ))}
            {spaces.data && spaces.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-2 text-text-secondary">
                  Chưa có lớp học trực tuyến. Lớp tự có khi có phân công giảng dạy theo môn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {openId ? <SpacePanel key={openId} spaceId={openId} onChanged={setToastMessage} /> : null}
        {canView ? (
          <form
            aria-label="Tạo khoá tự chọn"
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              elective.mutate();
            }}
          >
            <label className="text-label font-medium text-text">
              Tên khoá tự chọn (câu lạc bộ, bồi dưỡng)
              <input
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={electiveTitle}
                onChange={(event) => setElectiveTitle(event.target.value)}
              />
            </label>
            <label className="text-label font-medium text-text">
              Cấp học
              <select
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={electiveLevel}
                onChange={(event) => setElectiveLevel(event.target.value)}
              >
                <option value="TH">Tiểu học</option>
                <option value="THCS">THCS</option>
                <option value="THPT">THPT</option>
              </select>
            </label>
            <Button type="submit" disabled={!electiveTitle || elective.isPending}>
              Tạo khoá tự chọn
            </Button>
            {elective.error ? <Alert tone="danger">{messageOf(elective.error)}</Alert> : null}
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
