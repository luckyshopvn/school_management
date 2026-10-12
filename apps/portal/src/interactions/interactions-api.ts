import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối tương tác và đồ bị mất (P15, P02-11; YCTD-79)
export type PollType = 'poll' | 'vote' | 'survey';
export type AnswerType = 'single_choice' | 'multiple_choice' | 'text' | 'rating';

export interface Poll {
  id: string;
  org_unit_id: string;
  poll_type: PollType;
  title: string;
  class_id: string | null;
  audience: 'guardians' | 'staff' | 'everyone';
  start_at: string;
  end_at: string;
  is_anonymous: boolean;
  status: 'draft' | 'open' | 'closed';
  results_published_at: string | null;
  can_manage: boolean;
  is_open_now: boolean;
  response_count: number | null;
}

export interface PollResults {
  response_count: number;
  respondents: Array<{ user_id: string; name: string | null; submitted_at: string }> | null;
  questions: Array<{
    id: string;
    question_text: string;
    answer_type: AnswerType;
    options: Array<{ id: string; label: string; count: number }>;
    texts: string[];
    average: number | null;
  }>;
}

export interface TemplateQuestion {
  question_text: string;
  answer_type: AnswerType;
  is_required: boolean;
  options: string[];
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string | null;
  questions: TemplateQuestion[];
  status: 'active' | 'inactive';
}

export interface Feedback {
  id: string;
  child_name: string | null;
  submitter_name: string;
  category: string;
  content: string;
  privacy_level: 'named' | 'anonymous';
  status: 'received' | 'in_progress' | 'resolved';
  handling_note: string | null;
  created_at: string;
}

export interface MessageThread {
  id: string;
  child_id: string;
  child_name: string;
  class_name: string | null;
  guardian_name: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface Message {
  id: string;
  sender_side: 'guardian' | 'staff';
  sender_name: string;
  content: string;
  sent_at: string;
  read_at: string | null;
}

export interface LostItem {
  id: string;
  code: string;
  child_name: string | null;
  class_name: string | null;
  report_type: 'lost' | 'found';
  description: string;
  noticed_on: string;
  status: 'reported' | 'found' | 'returned' | 'not_found' | 'cancelled';
  found_note: string | null;
  result_note: string | null;
}

export interface InteractionComment {
  id: string;
  target_id: string;
  author_name: string;
  content: string;
  created_at: string;
  is_hidden: boolean;
  hide_reason: string | null;
  reported_at: string | null;
  moderations?: Array<{ id: string; action: string; reason: string; handled_at: string }>;
}

export const POLL_TYPE_LABELS: Record<PollType, string> = { poll: 'Bình chọn', vote: 'Biểu quyết', survey: 'Khảo sát' };
export const POLL_STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', closed: 'Đã đóng' };
export const AUDIENCE_LABELS = { guardians: 'Phụ huynh', staff: 'Nhân sự', everyone: 'Phụ huynh và nhân sự' };
export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  single_choice: 'Chọn một',
  multiple_choice: 'Chọn nhiều',
  text: 'Trả lời chữ',
  rating: 'Đánh giá 1 đến 5',
};
export const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  teaching: 'Dạy học',
  care: 'Chăm sóc',
  meal: 'Bữa ăn',
  facility: 'Cơ sở vật chất',
  fee: 'Học phí',
  other: 'Khác',
};
export const FEEDBACK_STATUS_LABELS = { received: 'Mới nhận', in_progress: 'Đang xử lý', resolved: 'Đã xử lý' };
export const LOST_STATUS_LABELS = {
  reported: 'Đã báo',
  found: 'Đã tìm thấy',
  returned: 'Đã trả',
  not_found: 'Không tìm thấy',
  cancelled: 'Đã hủy',
};

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

export const formatTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
