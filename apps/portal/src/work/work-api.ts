import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối công việc, kế hoạch, đánh giá, quá trình công tác, thưởng và khấu trừ (P09, P07-03, P08-07; YCTD-81)
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high';
export type PeriodType = 'month' | 'term' | 'year';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};
export const PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' };
export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = { month: 'Tháng', term: 'Học kỳ', year: 'Năm học' };
export const PERIOD_HINTS: Record<PeriodType, string> = {
  month: '2026-10',
  term: 'HK1 2026-2027',
  year: '2026-2027',
};

export interface Task {
  id: string;
  task_type: 'assigned' | 'personal';
  title: string;
  description: string | null;
  org_unit_id: string;
  assigner_name: string;
  assignee_staff_id: string;
  assignee_name: string;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress_percent: number;
  overdue: boolean;
}

export interface TaskProgress {
  rows: Array<{
    staff_id: string;
    full_name: string;
    total: number;
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
    average_progress: number;
  }>;
  total: number;
  done: number;
  overdue: number;
  average_progress: number;
}

export interface PlanItem {
  id: string;
  content: string;
  owner_staff_id: string;
  owner_name: string;
  due_date: string;
  task_status: TaskStatus | null;
  progress_percent: number | null;
}

export interface Plan {
  id: string;
  org_unit_id: string;
  period_type: PeriodType;
  period_value: string;
  title: string;
  objectives: string | null;
  status: 'draft' | 'active' | 'closed';
  item_count: number;
  done_count: number;
  progress_percent: number;
  items?: PlanItem[];
}

export interface Criterion {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  weight: number;
  max_score: number;
  status: 'active' | 'inactive';
}

export interface Evaluation {
  id: string;
  staff_id: string;
  full_name: string;
  period_type: PeriodType;
  period_value: string;
  total_score: number;
  comment: string | null;
  status: 'draft' | 'published' | 'superseded';
  reevaluation_reason: string | null;
  evaluated_by_name: string;
  published_at: string | null;
  scores: Array<{
    criterion_id: string;
    criterion_name: string;
    max_score: number;
    score: number;
    comment: string | null;
  }>;
}

export interface BonusDeduction {
  id: string;
  staff_id: string;
  full_name: string;
  kind: 'allowance' | 'deduction';
  item_name: string;
  target_year: number;
  target_month: number;
  amount: number;
  basis: string;
  status: 'active' | 'cancelled';
  cancel_reason: string | null;
  can_cancel: boolean;
}

export interface WorkHistory {
  staff_id: string;
  can_manage: boolean;
  history: Array<{
    id: string;
    unit_name: string;
    department_name: string | null;
    job_title_name: string | null;
    from_date: string;
    to_date: string | null;
    note: string | null;
    is_main_unit: boolean;
  }>;
  certificates: Array<{
    id: string;
    name: string;
    certificate_no: string | null;
    issued_by: string;
    issued_date: string;
    expire_date: string | null;
  }>;
}

export const STATUS_OF_EVALUATION = { draft: 'Nháp', published: 'Đã công bố', superseded: 'Đã thay thế' } as const;

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const send = <Result>(method: string, path: string, body?: unknown) =>
  requestJson<Result>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const listTasks = (view: 'mine' | 'assigned' | 'unit', orgUnitId?: string): Promise<Task[]> =>
  requestJson(`/api/v1/tasks?view=${view}${orgUnitId ? `&org_unit_id=${orgUnitId}` : ''}`);
export const readTaskProgress = (orgUnitId: string): Promise<TaskProgress> =>
  requestJson(`/api/v1/task-progress?org_unit_id=${orgUnitId}`);
export const listPlans = (orgUnitId: string): Promise<Plan[]> => requestJson(`/api/v1/plans?org_unit_id=${orgUnitId}`);
export const readPlan = (planId: string): Promise<Plan> => requestJson(`/api/v1/plans/${planId}`);
export const listCriteria = (orgUnitId: string): Promise<Criterion[]> =>
  requestJson(`/api/v1/evaluation-criteria?org_unit_id=${orgUnitId}`);
export const listEvaluations = (orgUnitId: string): Promise<Evaluation[]> =>
  requestJson(`/api/v1/evaluations?org_unit_id=${orgUnitId}`);
export const listMyEvaluations = (): Promise<Evaluation[]> => requestJson('/api/v1/me/evaluations');
export const listBonusDeductions = (month: string): Promise<BonusDeduction[]> =>
  requestJson(`/api/v1/bonus-deductions?month=${month}`);
export const readWorkHistory = (staffId: string): Promise<WorkHistory> =>
  requestJson(`/api/v1/staff/${staffId}/work-history`);

export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
export const selectClass =
  'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
