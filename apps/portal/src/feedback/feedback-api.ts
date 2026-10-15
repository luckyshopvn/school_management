import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Ý kiến phản hồi gửi từ chân trang (DT-15 phần 15g, YCTD-110)
export type FeedbackType = 'suggestion' | 'bug' | 'request';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved';

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  suggestion: 'Góp ý',
  bug: 'Báo lỗi',
  request: 'Đề nghị',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
};

export interface Feedback {
  id: string;
  user_id: string;
  user_name: string;
  org_unit_id: string | null;
  org_unit_name: string | null;
  page_url: string | null;
  feedback_type: FeedbackType;
  title: string;
  content: string;
  contact_phone: string | null;
  contact_email: string | null;
  attachment_name: string | null;
  status: FeedbackStatus;
  reply: string | null;
  replied_by_name: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackInput {
  feedback_type: FeedbackType | '';
  title: string;
  content: string;
  page_url: string;
  contact_phone: string;
  contact_email: string;
  attachment: File | null;
}

// Gửi bằng biểu mẫu nhiều phần để kèm ảnh chụp màn hình
export function submitFeedback(input: FeedbackInput): Promise<Feedback> {
  const form = new FormData();
  form.set('feedback_type', input.feedback_type);
  form.set('title', input.title);
  form.set('content', input.content);
  form.set('page_url', input.page_url);
  form.set('contact_phone', input.contact_phone);
  form.set('contact_email', input.contact_email);
  if (input.attachment) {
    form.set('attachment', input.attachment, input.attachment.name);
  }
  return requestJson('/api/v1/user-feedback', { method: 'POST', body: form });
}

export function listMyFeedback(): Promise<Feedback[]> {
  return requestJson('/api/v1/me/user-feedback');
}

export function listAllFeedback(status: FeedbackStatus | ''): Promise<Feedback[]> {
  return requestJson(`/api/v1/user-feedback${status ? `?status=${status}` : ''}`);
}

export function updateFeedback(id: string, changes: { status?: FeedbackStatus; reply?: string }): Promise<Feedback> {
  return requestJson(`/api/v1/user-feedback/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
}

// Mở ảnh đính kèm ở thẻ mới; tải bằng mã phiên nên không dùng liên kết trực tiếp
export async function openFeedbackAttachment(id: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/user-feedback/${id}/attachment`);
  if (!response.ok) {
    throw await readError(response);
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatDateTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
        new Date(value),
      )
    : '';
}
