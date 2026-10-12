import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối giảng dạy (P03; YCTD-80)
export interface CatalogEntry {
  id: string;
  org_unit_id: string;
  name: string;
  order_no?: number;
  domain_id?: string;
  age_group?: string | null;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'inactive';
}

export interface Lesson {
  id: string;
  org_unit_id: string;
  name: string;
  objectives: string;
  materials: string | null;
  age_group: string | null;
  is_shared: boolean;
  theme_name: string | null;
  domain_name: string | null;
  lesson_group_name: string | null;
  created_by: string;
}

export type LessonPlanStatus = 'draft' | 'submitted' | 'leader_approved' | 'approved' | 'returned';

export interface LessonPlan {
  id: string;
  lesson_id: string;
  lesson_name: string;
  lesson_objectives: string;
  class_id: string;
  class_name: string;
  teacher_name: string;
  planned_date: string;
  activities: string;
  duration_minutes: number;
  materials: string | null;
  status: LessonPlanStatus;
  review_comment: string | null;
}

export interface TimetableSlot {
  id: string;
  weekday: number;
  period_no: number;
  start_time: string;
  end_time: string;
  activity_name: string;
  teacher_name: string | null;
}

export interface Timetable {
  week: string;
  effective_from: string | null;
  status: 'draft' | 'published' | null;
  slots: TimetableSlot[];
}

export interface TeachingPlan {
  id: string;
  period_type: 'term' | 'month' | 'week';
  period_value: string;
  objectives: string;
  content: string;
  progress_note: string | null;
  status: 'planned' | 'in_progress' | 'completed';
}

export const PLAN_STATUS_LABELS: Record<LessonPlanStatus, string> = {
  draft: 'Nháp',
  submitted: 'Chờ tổ trưởng duyệt',
  leader_approved: 'Tổ trưởng đã duyệt, chờ quản lý duyệt',
  approved: 'Đã duyệt và công bố',
  returned: 'Bị trả lại',
};

export const TEACHING_PLAN_STATUS_LABELS: Record<TeachingPlan['status'], string> = {
  planned: 'Đã lập',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
};

export const WEEKDAY_LABELS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const getJson = <Result>(path: string) => requestJson<Result>(path);
export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });
