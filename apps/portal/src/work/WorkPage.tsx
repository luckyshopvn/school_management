import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type DataGridKey } from '@school-management/shared';
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
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  listPlans,
  listTasks,
  messageOf,
  PERIOD_HINTS,
  PERIOD_TYPE_LABELS,
  PRIORITY_LABELS,
  readTaskProgress,
  selectClass,
  send,
  TASK_STATUS_LABELS,
  vietnamToday,
  type PeriodType,
  type Plan,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from './work-api.js';

// MH-58 Công việc và kế hoạch (P09-01 đến P09-04, YCTD-81): mọi nhân sự có hồ sơ xem việc của mình, cập nhật
// tiến độ, tạo việc cá nhân; quản lý đơn vị và phòng nhân sự giao việc, xem bảng tiến độ; quản lý đơn vị lập kế hoạch.
// Giao diện chung theo Sở (DT-15 phần 15f2): lưới việc của tôi (khóa `my-tasks`), lưới việc đã giao trong đơn vị (khóa
// `unit-tasks`) và lưới kế hoạch (khóa `work-plans`); Thêm mới mở biểu mẫu theo khối có nút Ghi. Bảng tiến độ là bảng
// tổng hợp nên giữ bố cục
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
const PLAN_STATUS_LABELS: Record<Plan['status'], string> = {
  draft: 'Nháp',
  active: 'Đang thực hiện',
  closed: 'Đã đóng',
};

const TASK_COLUMNS: Array<DataGridColumn<Task>> = [
  {
    id: 'title',
    header: 'Việc',
    alwaysVisible: true,
    cell: (task) => (
      <>
        <div className="font-medium">{task.title}</div>
        {task.description ? <div className="text-label text-text-secondary">{task.description}</div> : null}
        <div className="text-label text-text-secondary">
          {task.task_type === 'personal' ? 'Việc cá nhân' : `Người giao: ${task.assigner_name}`}
        </div>
      </>
    ),
  },
  { id: 'assignee_name', header: 'Người nhận', cell: (task) => task.assignee_name },
  {
    id: 'due_date',
    header: 'Hạn',
    cell: (task) => (
      <span className={task.overdue ? 'font-semibold text-danger' : ''}>
        {task.due_date ?? '—'}
        {task.overdue ? ' (quá hạn)' : ''}
      </span>
    ),
  },
  { id: 'priority', header: 'Ưu tiên', cell: (task) => PRIORITY_LABELS[task.priority] },
  {
    id: 'progress',
    header: 'Tiến độ',
    cell: (task) => `${TASK_STATUS_LABELS[task.status]} · ${task.progress_percent}%`,
  },
];

const PLAN_COLUMNS: Array<DataGridColumn<Plan>> = [
  { id: 'title', header: 'Kế hoạch', alwaysVisible: true, className: 'font-medium', cell: (plan) => plan.title },
  {
    id: 'period',
    header: 'Kỳ',
    cell: (plan) => `${PERIOD_TYPE_LABELS[plan.period_type]} ${plan.period_value}`,
  },
  { id: 'items', header: 'Đầu việc', cell: (plan) => `${plan.done_count}/${plan.item_count} hoàn thành` },
  { id: 'progress_percent', header: 'Tiến độ', cell: (plan) => `${plan.progress_percent}%` },
  { id: 'status', header: 'Trạng thái', cell: (plan) => PLAN_STATUS_LABELS[plan.status] },
];

function TaskProgressForm({ task, onUpdated }: { task: Task; onUpdated(message: string): void }) {
  const [progress, setProgress] = useState(String(task.progress_percent));
  const [content, setContent] = useState('');
  const update = useMutation({
    mutationFn: () =>
      send(`POST`, `/api/v1/tasks/${task.id}/updates`, {
        progress_percent: Number(progress),
        content: content || null,
      }),
    onSuccess: () => {
      setContent('');
      onUpdated('Đã cập nhật tiến độ');
    },
  });
  return (
    <form
      className="flex flex-wrap items-end justify-end gap-2 whitespace-normal"
      aria-label={`Cập nhật tiến độ ${task.title}`}
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate();
      }}
    >
      <label className="text-label font-medium text-text">
        Phần trăm
        <select value={progress} onChange={(event) => setProgress(event.target.value)} className={selectClass}>
          {[0, 25, 50, 75, 100].map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
      </label>
      <TextField label="Ghi chú tiến độ" value={content} onChange={(event) => setContent(event.target.value)} />
      <Button type="submit" disabled={update.isPending}>
        Cập nhật
      </Button>
      {update.error ? <Alert tone="danger">{messageOf(update.error)}</Alert> : null}
    </form>
  );
}

function TaskGrid({
  label,
  gridKey,
  tasks,
  loading,
  canUpdate,
  onUpdated,
  toolbar,
}: {
  label: string;
  gridKey: DataGridKey;
  tasks: Task[];
  loading: boolean;
  canUpdate: boolean;
  onUpdated(message: string): void;
  toolbar?: ReactNode;
}) {
  const grid = useGridSettings(gridKey);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = tasks.filter(
    (task) =>
      (status === '' || task.status === status) &&
      (priority === '' || task.priority === priority) &&
      (keyword === '' ||
        [task.title, task.description, task.assignee_name].some((value) =>
          (value ?? '').toLocaleLowerCase('vi').includes(keyword),
        )),
  );
  return (
    <>
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label={label}
        columns={TASK_COLUMNS}
        rows={rows}
        getRowId={(task) => task.id}
        getRowLabel={(task) => `việc ${task.title}`}
        getRowAriaLabel={(task) => `Việc ${task.title}`}
        loading={loading}
        emptyText="Chưa có việc nào."
        search={{ label: 'Tìm theo nội dung việc, người nhận', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái việc
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus | '')}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {TASK_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Ưu tiên
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority | '')}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={toolbar}
        rowActions={
          canUpdate
            ? (task) =>
                task.status === 'todo' || task.status === 'in_progress' ? (
                  <TaskProgressForm task={task} onUpdated={onUpdated} />
                ) : null
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </>
  );
}

function PersonalTaskForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const create = useMutation({
    mutationFn: () => send('POST', '/api/v1/tasks', { title, due_date: dueDate || null }),
    onSuccess: () => onSaved('Đã thêm việc cá nhân'),
  });
  return (
    <form
      aria-label="Thêm việc cá nhân"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm việc cá nhân">
        <FormRow label="Việc cá nhân">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Hạn việc cá nhân">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending || title.trim() === ''}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function MyTasksSection({ onChanged }: { onChanged(message: string): void }) {
  const tasks = useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => listTasks('mine') });
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Việc của tôi</h2>
      {tasks.error ? <Alert tone="danger">{messageOf(tasks.error)}</Alert> : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <PersonalTaskForm
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              onChanged(message);
            }}
          />
        </section>
      ) : null}
      <TaskGrid
        label="Danh sách việc của tôi"
        gridKey="my-tasks"
        tasks={tasks.data ?? []}
        loading={tasks.isPending}
        canUpdate
        onUpdated={onChanged}
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
      />
    </div>
  );
}

function AssignForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const [assigneeId, setAssigneeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(vietnamToday());
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const assign = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/tasks', {
        title,
        description: description || null,
        assignee_staff_id: assigneeId,
        due_date: dueDate,
        priority,
      }),
    onSuccess: () => onSaved('Đã giao việc'),
  });
  const error = staff.error ?? assign.error;
  return (
    <form
      aria-label="Giao việc"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        assign.mutate();
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <FormBlock title="Giao việc">
        <FormRow label="Người nhận">
          <select
            className={FORM_CONTROL_CLASS}
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Chọn nhân sự</option>
            {(staff.data ?? [])
              .filter((person) => person.status === 'active' && person.has_account)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Nội dung việc">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Mô tả">
          <input
            className={FORM_CONTROL_CLASS}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormRow>
        <FormRow label="Hạn hoàn thành">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Mức ưu tiên">
          <select
            className={FORM_CONTROL_CLASS}
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={assign.isPending || !assigneeId || title.trim() === ''}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function AssignSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const tasks = useQuery({ queryKey: ['tasks', 'unit', orgUnitId], queryFn: () => listTasks('unit', orgUnitId) });
  const progress = useQuery({ queryKey: ['task-progress', orgUnitId], queryFn: () => readTaskProgress(orgUnitId) });
  const [creating, setCreating] = useState(false);
  const error = [tasks.error, progress.error].find(Boolean);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Giao việc và theo dõi tiến độ</h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {progress.data ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label="Tiến độ">
          <p className="text-content text-text">
            Tổng {progress.data.total} việc, hoàn thành {progress.data.done}, quá hạn {progress.data.overdue}, tiến độ
            trung bình {progress.data.average_progress}%
          </p>
          <table className="w-full text-content" aria-label="Bảng tiến độ">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Nhân sự</th>
                <th>Tổng</th>
                <th>Chưa làm</th>
                <th>Đang làm</th>
                <th>Hoàn thành</th>
                <th>Quá hạn</th>
                <th>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {progress.data.rows.map((row) => (
                <tr key={row.staff_id} className="border-t border-border" aria-label={`Tiến độ của ${row.full_name}`}>
                  <td className="py-2">{row.full_name}</td>
                  <td>{row.total}</td>
                  <td>{row.todo}</td>
                  <td>{row.in_progress}</td>
                  <td>{row.done}</td>
                  <td>{row.overdue}</td>
                  <td>{row.average_progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <AssignForm
            key={orgUnitId}
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              onChanged(message);
            }}
          />
        </section>
      ) : null}
      <TaskGrid
        label="Việc đã giao trong đơn vị"
        gridKey="unit-tasks"
        tasks={tasks.data ?? []}
        loading={tasks.isPending}
        canUpdate={false}
        onUpdated={onChanged}
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
      />
    </div>
  );
}

interface DraftItem {
  content: string;
  owner_staff_id: string;
  due_date: string;
}

function PlanForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [periodValue, setPeriodValue] = useState(vietnamToday().slice(0, 7));
  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ content: '', owner_staff_id: '', due_date: vietnamToday() }]);
  const create = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/plans', {
        org_unit_id: orgUnitId,
        period_type: periodType,
        period_value: periodValue,
        title,
        objectives: objectives || null,
        items: items.filter((item) => item.content.trim() !== ''),
      }),
    onSuccess: () => onSaved('Đã lập kế hoạch nháp'),
  });
  const setItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const people = (staff.data ?? []).filter((person) => person.status === 'active');
  const error = staff.error ?? create.error;
  return (
    <form
      aria-label="Lập kế hoạch"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <FormBlock title="Thông tin kế hoạch">
        <FormRow label="Loại kỳ">
          <select
            className={FORM_CONTROL_CLASS}
            value={periodType}
            onChange={(event) => {
              const type = event.target.value as PeriodType;
              setPeriodType(type);
              setPeriodValue(PERIOD_HINTS[type]);
            }}
          >
            {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((value) => (
              <option key={value} value={value}>
                {PERIOD_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Kỳ kế hoạch">
          <input
            className={FORM_CONTROL_CLASS}
            value={periodValue}
            onChange={(event) => setPeriodValue(event.target.value)}
          />
        </FormRow>
        <FormRow label="Tên kế hoạch">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Mục tiêu">
          <input
            className={FORM_CONTROL_CLASS}
            value={objectives}
            onChange={(event) => setObjectives(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      {items.map((item, index) => (
        <FormBlock key={index} title={`Đầu việc ${index + 1}`}>
          <FormRow label={`Đầu việc ${index + 1}`}>
            <input
              className={FORM_CONTROL_CLASS}
              value={item.content}
              onChange={(event) => setItem(index, { content: event.target.value })}
            />
          </FormRow>
          <FormRow label={`Người phụ trách ${index + 1}`}>
            <select
              className={FORM_CONTROL_CLASS}
              value={item.owner_staff_id}
              onChange={(event) => setItem(index, { owner_staff_id: event.target.value })}
            >
              <option value="">Chọn nhân sự</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label={`Hạn đầu việc ${index + 1}`}>
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={item.due_date}
              onChange={(event) => setItem(index, { due_date: event.target.value })}
            />
          </FormRow>
        </FormBlock>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            setItems((current) => [...current, { content: '', owner_staff_id: '', due_date: vietnamToday() }])
          }
        >
          Thêm đầu việc
        </Button>
        <Button type="submit" variant="primary" disabled={create.isPending || title.trim() === ''}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function PlansSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const grid = useGridSettings('work-plans');
  const plans = useQuery({ queryKey: ['plans', orgUnitId], queryFn: () => listPlans(orgUnitId) });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Plan['status'] | ''>('');
  const action = useMutation({
    mutationFn: ({ plan, kind }: { plan: Plan; kind: 'activate' | 'close' }) =>
      send('POST', `/api/v1/plans/${plan.id}/${kind}`),
    onSuccess: (_result, variables) =>
      onChanged(variables.kind === 'activate' ? 'Đã kích hoạt kế hoạch và giao việc' : 'Đã đóng kế hoạch'),
  });
  const error = [plans.error, action.error, grid.error].find(Boolean);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (plans.data ?? []).filter(
    (plan) =>
      (status === '' || plan.status === status) &&
      (keyword === '' || plan.title.toLocaleLowerCase('vi').includes(keyword)),
  );
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Kế hoạch của đơn vị</h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <PlanForm
            key={orgUnitId}
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              onChanged(message);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Danh sách kế hoạch"
        columns={PLAN_COLUMNS}
        rows={rows}
        getRowId={(plan) => plan.id}
        getRowLabel={(plan) => `kế hoạch ${plan.title}`}
        getRowAriaLabel={(plan) => `Kế hoạch ${plan.title}`}
        loading={plans.isPending}
        emptyText="Chưa có kế hoạch."
        search={{ label: 'Tìm theo tên kế hoạch', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái kế hoạch
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Plan['status'] | '')}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {(Object.keys(PLAN_STATUS_LABELS) as Array<Plan['status']>).map((value) => (
                  <option key={value} value={value}>
                    {PLAN_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(plan) =>
          plan.status === 'draft' ? (
            <Button disabled={action.isPending} onClick={() => action.mutate({ plan, kind: 'activate' })}>
              Kích hoạt
            </Button>
          ) : plan.status === 'active' ? (
            <Button disabled={action.isPending} onClick={() => action.mutate({ plan, kind: 'close' })}>
              Đóng kế hoạch
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

export function WorkPage() {
  const queryClient = useQueryClient();
  const canAssign = useHasPermission(PERMISSION_CODES.taskAssign);
  const canPlan = useHasPermission(PERMISSION_CODES.planManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['task-progress'] });
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    setToastMessage(message);
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/work')}</h1>
        <MyTasksSection onChanged={changed} />
        {(canAssign || canPlan) && orgUnitId ? (
          <>
            <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
            {canAssign ? <AssignSection orgUnitId={orgUnitId} onChanged={changed} /> : null}
            {canPlan ? <PlansSection orgUnitId={orgUnitId} onChanged={changed} /> : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
