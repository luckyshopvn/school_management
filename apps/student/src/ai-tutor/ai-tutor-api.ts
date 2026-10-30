import { requestStudentJson, StudentApiError } from '../student-api.js';

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
  subjects: Array<{ code: string; name: string }>;
  conversations: TutorConversation[];
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

export const sendTutorMessage = (body: {
  conversation_id?: string;
  subject_code?: string;
  text?: string;
  mode: 'hint' | 'solution';
}) => postJson<TutorSendResult>(`${BASE}/messages`, body);

export const reportTutorMessage = (messageId: string) =>
  postJson<{ id: string; reported: boolean }>(`${BASE}/messages/${messageId}/report`, {});

export function tutorErrorMessage(error: unknown): string {
  return error instanceof StudentApiError
    ? [
        error.message,
        ...error.details.filter((detail) => detail.field !== 'lock').map((detail) => detail.message),
      ].join('. ')
    : 'Không kết nối được tới máy chủ, em thử lại nhé';
}
