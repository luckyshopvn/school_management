import { requestJson } from '../session/api-client.js';

// Trợ lý AI soạn nháp (DT-23 phần 23d, YCTD-214): gọi các điểm cuối /ai; giao diện không giữ quy tắc nghiệp vụ, máy chủ quét dữ liệu
// cá nhân, kiểm hạn mức và ghi nhật ký
const API = '/api/v1/ai';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export const AI_DRAFT_NOTICE =
  'Trợ lý AI chỉ nhận nội dung chương trình (cấp, khối, môn, chủ đề, yêu cầu cần đạt, mức nhận thức) và không bao giờ nhận dữ liệu cá nhân của học sinh, phụ huynh, cán bộ: không nhập họ tên, số điện thoại, thư điện tử, số định danh. Kết quả luôn là bản nháp do AI soạn, cần giáo viên kiểm tra và đi qua duyệt trước khi dùng.';

export interface AiStatus {
  enabled: boolean;
  ready: boolean;
  reason: string | null;
}

export interface AiSettings {
  enabled: boolean;
  key_mode: 'school' | 'platform';
  provider: string;
  model: string | null;
  per_user_daily_requests: number | null;
  log_retention_months: number;
}

export interface AiAdminStatus extends AiStatus {
  settings: AiSettings;
  providers: string[];
  default_model: string;
  key: {
    configured: boolean;
    enabled: boolean;
    fields: Array<{ name: string; value: string | null }>;
  };
  multi_tenant: boolean;
  platform: {
    available: boolean;
    reason: string | null;
    provider: string | null;
    model: string | null;
    free_tokens: number | null;
  } | null;
  usage: { requests: number; tokens: number; input_tokens: number; output_tokens: number };
  limits: { max_requests: number | null; max_tokens: number | null; per_user_daily_requests: number | null };
  estimate: {
    applies: boolean;
    period_start: string;
    period_end: string;
    total_tokens: number;
    free_tokens: number;
    amount: number;
  } | null;
}

export interface AiRequestRow {
  id: string;
  created_at: string;
  user_name: string;
  kind: 'questions' | 'lesson_plan' | 'check' | 'feedback' | 'answer';
  school_level: string | null;
  grade_level_code: string | null;
  subject_name: string | null;
  topic: string | null;
  status: 'success' | 'failed' | 'rejected' | 'blocked';
  key_mode: 'school' | 'platform';
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  result_count: number;
  error: string | null;
}

export const AI_KIND_LABELS: Record<AiRequestRow['kind'], string> = {
  questions: 'Soạn câu hỏi',
  lesson_plan: 'Soạn kế hoạch bài dạy',
  check: 'Kiểm tra kết nối',
  feedback: 'Gợi ý nhận xét bài tập',
  answer: 'Gợi ý trả lời câu hỏi (gia sư)',
};
export const AI_STATUS_LABELS: Record<AiRequestRow['status'], string> = {
  success: 'Thành công',
  failed: 'Lỗi nhà cung cấp',
  rejected: 'Bị từ chối (có dữ liệu cá nhân)',
  blocked: 'Bị chặn do hạn mức',
};

export const aiStatus = () => requestJson<AiStatus>(`${API}/status`);
export const aiAdminStatus = () => requestJson<AiAdminStatus>(`${API}/status`);
export const saveAiSettings = (settings: AiSettings) =>
  requestJson<AiAdminStatus>(`${API}/settings`, json('PUT', settings));
export const checkAi = () => requestJson<{ ok: boolean; detail: string }>(`${API}/check`, json('POST'));
export const listAiRequests = (status?: string) =>
  requestJson<AiRequestRow[]>(`${API}/requests?limit=100${status ? `&status=${status}` : ''}`);
export const saveAiKey = (input: { enabled: boolean; api_key: string }) =>
  requestJson<unknown>(
    '/api/v1/school-settings/integrations/ai',
    json('PUT', { enabled: input.enabled, values: input.api_key ? { api_key: input.api_key } : {} }),
  );
export const removeAiKey = () => requestJson<unknown>('/api/v1/school-settings/integrations/ai', json('DELETE'));

export interface QuestionDraftInput {
  school_level: string;
  subject_id: string;
  grade_level_code: string;
  topic_id: string | null;
  cognitive_level: string;
  question_type: string;
  count: number;
  requirement: string | null;
  extra: string | null;
}

export interface LessonPlanDraftInput {
  school_level: string;
  subject_code: string;
  grade_level_code: string;
  topic_text: string;
  duration_minutes: number;
  requirement: string | null;
  extra: string | null;
}

export const draftQuestions = (input: QuestionDraftInput) =>
  requestJson<{ questions: Array<{ id: string }>; skipped: number; notice: string }>(
    `${API}/question-drafts`,
    json('POST', input),
  );
export const draftLessonPlan = (input: LessonPlanDraftInput) =>
  requestJson<{ resource: { id: string; title: string }; notice: string }>(
    `${API}/lesson-plan-drafts`,
    json('POST', input),
  );
