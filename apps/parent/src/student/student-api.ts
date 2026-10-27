// Gọi máy chủ từ màn hình học sinh (DT-23 phần 23a, YCTD-211). Học sinh đăng nhập ở kênh `student`, cookie làm mới riêng nên
// không đè phiên phụ huynh; mã phiên chỉ giữ trong bộ nhớ của mô-đun này. Giao diện không chứa quy tắc nghiệp vụ: đồng hồ, đáp
// án, chấm điểm đều ở máy chủ
export interface FieldError {
  field: string;
  message: string;
}

export class StudentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
  }

  // Phiên đăng nhập này đã bị thay bằng phiên khác (một phiên mỗi lượt làm bài)
  get sessionReplaced(): boolean {
    return this.details.some((detail) => detail.field === 'session' && detail.message === 'replaced');
  }
}

export interface TokenResponse {
  access_token: string;
  password_change_required: boolean;
}

export interface CaptchaChallenge {
  captcha_id: string;
  image: string;
}

export interface CaptchaAnswer {
  captcha_id: string;
  captcha_text: string;
}

let accessToken: string | undefined;

async function readError(response: Response): Promise<StudentApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: FieldError[] } };
    return new StudentApiError(
      response.status,
      body.error?.code ?? 'ERR_INTERNAL',
      body.error?.message ?? 'Hệ thống gặp lỗi, vui lòng thử lại sau',
      body.error?.details ?? [],
    );
  } catch {
    return new StudentApiError(response.status, 'ERR_INTERNAL', 'Hệ thống gặp lỗi, vui lòng thử lại sau');
  }
}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    throw await readError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

function remember(tokens: TokenResponse): TokenResponse {
  accessToken = tokens.access_token;
  return tokens;
}

let pendingRefresh: Promise<TokenResponse> | undefined;

export function refreshStudentSession(): Promise<TokenResponse> {
  pendingRefresh ??= send<TokenResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ channel: 'student' }),
  })
    .then(remember)
    .finally(() => {
      pendingRefresh = undefined;
    });
  return pendingRefresh;
}

// Mã phiên hết hạn (15 phút) thì làm mới một lần rồi gọi lại; làm bài lâu hơn 15 phút vẫn lưu nháp được
export async function requestStudentJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await send<T>(path, init);
  } catch (error) {
    if (!(error instanceof StudentApiError) || error.status !== 401 || !accessToken) {
      throw error;
    }
    await refreshStudentSession();
    return send<T>(path, init);
  }
}

// Tải tệp của bài nộp (ảnh, tài liệu, ghi âm) kèm mã phiên để hiện lại cho học sinh (DT-28 phần 28c); hết hạn thì làm mới một lần
export async function fetchStudentFile(path: string): Promise<Blob> {
  const attempt = () =>
    fetch(path, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      credentials: 'same-origin',
    });
  let response = await attempt();
  if (response.status === 401 && accessToken) {
    await refreshStudentSession();
    response = await attempt();
  }
  if (!response.ok) {
    throw await readError(response);
  }
  return response.blob();
}

export function issueCaptcha(): Promise<CaptchaChallenge> {
  return send<CaptchaChallenge>('/api/v1/auth/captcha', { method: 'POST', body: JSON.stringify({}) });
}

export async function studentLogin(login: string, password: string, captcha?: CaptchaAnswer): Promise<TokenResponse> {
  return remember(
    await send<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password, channel: 'student', ...captcha }),
    }),
  );
}

export async function changeStudentPassword(currentPassword: string, newPassword: string): Promise<TokenResponse> {
  return remember(
    await requestStudentJson<TokenResponse>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  );
}

export async function studentLogout(): Promise<void> {
  try {
    await requestStudentJson<void>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    accessToken = undefined;
  }
}

export interface StudentProfile {
  full_name: string;
  class_name: string;
  school_level: string;
}

export type AssignmentState = 'upcoming' | 'open' | 'in_progress' | 'closed';

export interface StudentExamItem {
  id: string;
  title: string;
  subject_name: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  max_attempts: number;
  attempts_used: number;
  state: AssignmentState;
  attempt_id: string | null;
  fullscreen_required: boolean;
  camera_enabled: boolean;
  // Thi tại trường (mặc định): vào bài bằng mã phòng thi do giám thị mở
  exam_mode: 'at-school' | 'remote';
  result_mode: string;
  result: { attempt_id: string; total_score: number | null; max_score: number | null; pending_marking: boolean } | null;
}

export interface QuestionView {
  position: number;
  number: number;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  content: string;
  score: number;
  options?: Array<{ label: string; content: string }>;
  statements?: Array<{ label: string; content: string }>;
}

export interface AttemptView {
  id: string;
  assignment_id: string;
  title: string;
  status: 'in_progress' | 'submitted';
  server_now: string;
  deadline_at: string;
  remaining_seconds: number;
  policy: { fullscreen_required: boolean; max_violations: number; violation_action: string; camera_enabled: boolean };
  camera_state: string;
  violations: number;
  questions: QuestionView[];
  answers: Record<string, string[]>;
}

export interface AttemptResult {
  attempt_id: string;
  title: string;
  status: string;
  visible: boolean;
  total_score: number | null;
  max_score: number | null;
  pending_marking: boolean;
  questions: Array<{
    position: number;
    number: number;
    type: string;
    max: number;
    earned: number;
    correct: boolean | null;
    answer: string[];
    correct_answer: string[] | null;
  }>;
}

export interface EventReport {
  violations: number;
  max_violations: number;
  outcome: 'none' | 'warn' | 'flag' | 'auto_submit';
  status: 'in_progress' | 'submitted';
  remaining_seconds: number;
}

export type CameraState = 'off' | 'granted' | 'denied' | 'unavailable';
export type ClientEventType =
  'fullscreen_exit' | 'page_hidden' | 'window_blur' | 'camera_lost' | 'no_face' | 'multiple_faces';

export const readStudentProfile = () => requestStudentJson<StudentProfile>('/api/v1/student/profile');
export const listStudentExams = () =>
  requestStudentJson<{ server_now: string; items: StudentExamItem[] }>('/api/v1/student/exams');
export const startAttempt = (assignmentId: string, cameraState: CameraState, roomCode: string | null) =>
  requestStudentJson<AttemptView>(`/api/v1/student/exams/${assignmentId}/start`, {
    method: 'POST',
    body: JSON.stringify({ camera_state: cameraState, room_code: roomCode }),
  });
export const readAttempt = (attemptId: string) =>
  requestStudentJson<AttemptView>(`/api/v1/student/attempts/${attemptId}`);
export const saveAnswers = (attemptId: string, answers: Record<string, string[]>) =>
  requestStudentJson<{ saved_at: string; remaining_seconds: number }>(`/api/v1/student/attempts/${attemptId}/answers`, {
    method: 'PUT',
    body: JSON.stringify({ answers }),
  });
export const reportEvents = (
  attemptId: string,
  events: Array<{ type: ClientEventType; client_at: string; detail?: Record<string, number> }>,
) =>
  requestStudentJson<EventReport>(`/api/v1/student/attempts/${attemptId}/events`, {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
export const submitAttempt = (attemptId: string, answers?: Record<string, string[]>) =>
  requestStudentJson<AttemptResult>(`/api/v1/student/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify(answers ? { answers } : {}),
  });
export const readResult = (attemptId: string) =>
  requestStudentJson<AttemptResult>(`/api/v1/student/attempts/${attemptId}/result`);
