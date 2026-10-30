import { fetchStudentFile, requestStudentJson, StudentApiError } from '../student-api.js';

// Gọi máy chủ cho gia sư AI của em (YCTD-383 lát L2). Quy tắc lượt, kiểm duyệt, mở lời giải đều ở máy chủ; giao diện chỉ hiển thị
export interface TutorBalance {
  monthly: number;
  top_up: number;
  remaining: number;
  total: number;
}

export interface TutorConversation {
  id: string;
  subject_code: string;
  subject_name: string;
  topic: string | null;
  created_at: string;
  last_message_at: string;
}

export interface TutorMessage {
  id: string;
  role: 'student' | 'tutor';
  body: string;
  // Lát L4: đề gia sư chép từ ảnh; ảnh em gửi (đã xóa sau 30 ngày thì chỉ còn nhãn)
  image_text: string | null;
  images: Array<{ id: string; content_type: string; deleted: boolean; deleted_label: string | null }>;
  step: string | null;
  step_label: string | null;
  request_kind: 'ask' | 'solution' | null;
  blocked: boolean;
  reported: boolean;
  created_at: string;
}

export interface TutorOverview {
  child: { school_level: 'TH' | 'THCS' | 'THPT' | null; grade_level_code: string; class_name: string | null };
  // Khóa của lát L3: đang thi, bài tập không dùng AI, ngoài khung giờ; phiên xem hỗ trợ chỉ đọc
  access:
    | { allowed: true }
    | { allowed: false; code: 'read_only' | 'exam' | 'assignment' | 'quiet_hours'; title: string; message: string };
  ready: boolean;
  unavailable_reason: string | null;
  balance: TutorBalance;
  subscribed: boolean;
  // Lát L4: chỉ gói Nâng cao gửi được ảnh; giới hạn số ảnh, cỡ ảnh, số ngày giữ ảnh do máy chủ trả
  images: { allowed: boolean; max_count: number; max_bytes: number; retention_days: number };
  subjects: Array<{ code: string; name: string }>;
  conversations: TutorConversation[];
  // Lát L5: lời nhờ cha mẹ khi chưa có gói (`no_plan`) hoặc hết lượt (`no_turns`); phiên xem hỗ trợ thì trống
  parent_request: ParentRequestState | null;
}

export interface ParentRequestState {
  reason: 'no_plan' | 'no_turns' | null;
  guardian_account: boolean;
  last_sent_at: string | null;
  next_allowed_at: string | null;
}

export interface TutorThread {
  conversation: TutorConversation;
  messages: TutorMessage[];
  attempts: number;
  solution_unlocked: boolean;
}

export interface TutorSendResult extends TutorThread {
  turn: 'captured' | 'released';
  balance: TutorBalance;
}

const BASE = '/api/v1/student/ai-tutor';

const postJson = <T>(path: string, body: unknown) =>
  requestStudentJson<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const readTutorOverview = () => requestStudentJson<TutorOverview>(BASE);

export const readTutorThread = (conversationId: string) =>
  requestStudentJson<TutorThread>(`${BASE}/conversations/${conversationId}`);

// Có ảnh thì gửi dạng nhiều phần, trường `images`; không thì gửi JSON như lát L2
export function sendTutorMessage(
  body: {
    conversation_id?: string;
    subject_code?: string;
    text?: string;
    mode: 'hint' | 'solution';
  },
  images: readonly Blob[] = [],
) {
  if (images.length === 0) {
    return postJson<TutorSendResult>(`${BASE}/messages`, body);
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      form.append(key, value);
    }
  }
  images.forEach((image, index) => form.append('images', image, `anh-bai-tap-${index + 1}.jpg`));
  return requestStudentJson<TutorSendResult>(`${BASE}/messages`, { method: 'POST', body: form });
}

export const fetchTutorImage = (imageId: string) => fetchStudentFile(`${BASE}/images/${imageId}`);

export const reportTutorMessage = (messageId: string) =>
  postJson<{ id: string; reported: boolean }>(`${BASE}/messages/${messageId}/report`, {});

export const requestParents = () => postJson<ParentRequestState & { notified: number }>(`${BASE}/parent-requests`, {});

export function tutorErrorMessage(error: unknown): string {
  return error instanceof StudentApiError
    ? [
        error.message,
        ...error.details.filter((detail) => detail.field !== 'lock').map((detail) => detail.message),
      ].join('. ')
    : 'Không kết nối được tới máy chủ, em thử lại nhé';
}
