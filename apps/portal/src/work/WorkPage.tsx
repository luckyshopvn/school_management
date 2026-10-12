import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
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
} from './work-api.js';

// MH-57 (đề xuất) Công việc và kế hoạch (P09-01 đến P09-04, YCTD-81): mọi nhân sự có hồ sơ xem việc của mình, cập nhật
// tiến độ, tạo việc cá nhân; quản lý đơn vị và phòng nhân sự giao việc, xem bảng tiến độ; quản lý đơn vị lập kế hoạch
function TaskRow({ task, onUpdated, canUpdate }: { task: Task; onUpdated(message: string): void; canUpdate: boolean }) {
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
  const open = task.status === 'todo' || task.status === 'in_progress';
  return (
    <tr className="border-t border-border align-top" aria-label={`Việc ${task.title}`}>
      <td className="py-2">
        <div className="font-medium">{task.title}</div>
        {task.description ? <div className="text-label text-text-secondary">{task.description}</div> : null}
        <div className="text-label text-text-secondary">
          {task.task_type === 'personal' ? 'Việc cá nhân' : `Người giao: ${task.assigner_name}`}
        </div>
      </td>
      <td>{task.assignee_name}</td>
      <td className={task.overdue ? 'font-semibold text-danger' : ''}>
        {task.due_date ?? '—'}
        {task.overdue ? ' (quá hạn)' : ''}
      </td>
      <td>{PRIORITY_LABELS[task.priority]}</td>
      <td>
        {TASK_STATUS_LABELS[task.status]} · {task.progress_percent}%
      </td>
      <td>
        {canUpdate && open ? (
          <form
            className="flex flex-wrap items-end gap-2"
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
        ) : null}
      </td>
    </tr>
  );
}

function TaskTable({
  tasks,
  canUpdate,
  onUpdated,
  label,
}: {
  tasks: Task[];
  canUpdate: boolean;
  onUpdated(message: string): void;
  label: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-content text-text-secondary">Chưa có việc nào.</p>;
  }
  return (
    <table className="w-full text-content" aria-label={label}>
      <thead>
        <tr className="text-left text-text-secondary">
          <th className="py-2">Việc</th>
          <th>Người nhận</th>
          <th>Hạn</th>
          <th>Ưu tiên</th>
          <th>Tiến độ</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} canUpdate={canUpdate} onUpdated={onUpdated} />
        ))}
      </tbody>
    </table>
  );
}

function MyTasksSection({ onChanged }: { onChanged(message: string): void }) {
  const tasks = useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => listTasks('mine') });
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const create = useMutation({
    mutationFn: () => send('POST', '/api/v1/tasks', { title, due_date: dueDate || null }),
    onSuccess: () => {
      setTitle('');
      setDueDate('');
      onChanged('Đã thêm việc cá nhân');
    },
  });
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Việc của tôi">
      <h2 className="text-section-title font-semibold text-text">Việc của tôi</h2>
      {tasks.error || create.error ? <Alert tone="danger">{messageOf(tasks.error ?? create.error)}</Alert> : null}
      <form
        aria-label="Thêm việc cá nhân"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <TextField label="Việc cá nhân" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField
          label="Hạn việc cá nhân"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={create.isPending || title.trim() === ''}>
          Thêm việc cá nhân
        </Button>
      </form>
      <TaskTable tasks={tasks.data ?? []} canUpdate onUpdated={onChanged} label="Danh sách việc của tôi" />
    </section>
  );
}

function AssignSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const tasks = useQuery({ queryKey: ['tasks', 'unit', orgUnitId], queryFn: () => listTasks('unit', orgUnitId) });
  const progress = useQuery({ queryKey: ['task-progress', orgUnitId], queryFn: () => readTaskProgress(orgUnitId) });
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
    onSuccess: () => {
      setTitle('');
      setDescription('');
      onChanged('Đã giao việc');
    },
  });
  const error = [staff.error, tasks.error, progress.error, assign.error].find(Boolean);
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Giao việc và theo dõi tiến độ">
      <h2 className="text-section-title font-semibold text-text">Giao việc và theo dõi tiến độ</h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <form
        aria-label="Giao việc"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          assign.mutate();
        }}
      >
        <label className="text-label font-medium text-text">
          Người nhận
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={selectClass}>
            <option value="">Chọn nhân sự</option>
            {(staff.data ?? [])
              .filter((person) => person.status === 'active' && person.has_account)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
          </select>
        </label>
        <TextField label="Nội dung việc" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Mô tả" value={description} onChange={(event) => setDescription(event.target.value)} />
        <TextField
          label="Hạn hoàn thành"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <label className="text-label font-medium text-text">
          Mức ưu tiên
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className={selectClass}
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={assign.isPending || !assigneeId || title.trim() === ''}>
            Giao việc
          </Button>
        </div>
      </form>
      {progress.data ? (
        <div className="flex flex-col gap-2">
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
        </div>
      ) : null}
      <h3 className="text-content font-semibold text-text">Việc đã giao trong đơn vị</h3>
      <TaskTable tasks={tasks.data ?? []} canUpdate={false} onUpdated={onChanged} label="Việc đã giao trong đơn vị" />
    </section>
  );
}

interface DraftItem {
  content: string;
  owner_staff_id: string;
  due_date: string;
}

function PlansSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const plans = useQuery({ queryKey: ['plans', orgUnitId], queryFn: () => listPlans(orgUnitId) });
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
    onSuccess: () => {
      setTitle('');
      setObjectives('');
      setItems([{ content: '', owner_staff_id: '', due_date: vietnamToday() }]);
      onChanged('Đã lập kế hoạch nháp');
    },
  });
  const action = useMutation({
    mutationFn: ({ plan, kind }: { plan: Plan; kind: 'activate' | 'close' }) =>
      send('POST', `/api/v1/plans/${plan.id}/${kind}`),
    onSuccess: (_result, variables) =>
      onChanged(variables.kind === 'activate' ? 'Đã kích hoạt kế hoạch và giao việc' : 'Đã đóng kế hoạch'),
  });
  const setItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const people = (staff.data ?? []).filter((person) => person.status === 'active');
  const error = [plans.error, create.error, action.error].find(Boolean);
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Kế hoạch của đơn vị">
      <h2 className="text-section-title font-semibold text-text">Kế hoạch của đơn vị</h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <form
        aria-label="Lập kế hoạch"
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-label font-medium text-text">
            Loại kỳ
            <select
              value={periodType}
              onChange={(event) => {
                const type = event.target.value as PeriodType;
                setPeriodType(type);
                setPeriodValue(PERIOD_HINTS[type]);
              }}
              className={selectClass}
            >
              {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((value) => (
                <option key={value} value={value}>
                  {PERIOD_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Kỳ kế hoạch" value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} />
          <TextField label="Tên kế hoạch" value={title} onChange={(event) => setTitle(event.target.value)} />
          <TextField label="Mục tiêu" value={objectives} onChange={(event) => setObjectives(event.target.value)} />
        </div>
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextField
              label={`Đầu việc ${index + 1}`}
              value={item.content}
              onChange={(event) => setItem(index, { content: event.target.value })}
            />
            <label className="text-label font-medium text-text">
              {`Người phụ trách ${index + 1}`}
              <select
                value={item.owner_staff_id}
                onChange={(event) => setItem(index, { owner_staff_id: event.target.value })}
                className={selectClass}
              >
                <option value="">Chọn nhân sự</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label={`Hạn đầu việc ${index + 1}`}
              type="date"
              value={item.due_date}
              onChange={(event) => setItem(index, { due_date: event.target.value })}
            />
          </div>
        ))}
        <div className="flex gap-3">
          <Button
            onClick={() =>
              setItems((current) => [...current, { content: '', owner_staff_id: '', due_date: vietnamToday() }])
            }
          >
            Thêm đầu việc
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending || title.trim() === ''}>
            Lập kế hoạch
          </Button>
        </div>
      </form>
      <table className="w-full text-content" aria-label="Danh sách kế hoạch">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Kế hoạch</th>
            <th>Kỳ</th>
            <th>Đầu việc</th>
            <th>Tiến độ</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(plans.data ?? []).map((plan) => (
            <tr key={plan.id} className="border-t border-border" aria-label={`Kế hoạch ${plan.title}`}>
              <td className="py-2">{plan.title}</td>
              <td>
                {PERIOD_TYPE_LABELS[plan.period_type]} {plan.period_value}
              </td>
              <td>
                {plan.done_count}/{plan.item_count} hoàn thành
              </td>
              <td>{plan.progress_percent}%</td>
              <td>{plan.status === 'draft' ? 'Nháp' : plan.status === 'active' ? 'Đang thực hiện' : 'Đã đóng'}</td>
              <td>
                {plan.status === 'draft' ? (
                  <Button disabled={action.isPending} onClick={() => action.mutate({ plan, kind: 'activate' })}>
                    Kích hoạt
                  </Button>
                ) : null}
                {plan.status === 'active' ? (
                  <Button disabled={action.isPending} onClick={() => action.mutate({ plan, kind: 'close' })}>
                    Đóng kế hoạch
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Công việc và kế hoạch</h1>
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
