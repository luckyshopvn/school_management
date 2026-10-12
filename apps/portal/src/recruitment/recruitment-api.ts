import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối tuyển dụng (P18; YCTD-87)
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'closed';
export type PostingStatus = 'draft' | 'published' | 'closed';
export type CandidateStatus = 'new' | 'screening' | 'interviewing' | 'hired' | 'rejected' | 'withdrawn';
export type CandidateSource = 'website' | 'referral' | 'job_board' | 'social_media' | 'walk_in' | 'other';

export interface RecruitmentRequest {
  id: string;
  code: string;
  org_unit_id: string;
  unit_name: string;
  position: string;
  quantity: number;
  requirements: string;
  reason: string;
  needed_by: string | null;
  status: RequestStatus;
  requester_id: string;
  requester_name: string;
  approver_name: string | null;
  reject_reason: string | null;
  close_reason: string | null;
  hired_count: number;
}

export interface JobPosting {
  id: string;
  request_id: string;
  request_code: string;
  org_unit_id: string;
  unit_name: string;
  position: string;
  quantity: number;
  title: string;
  description: string;
  requirements: string;
  deadline: string;
  status: PostingStatus;
  is_open: boolean;
  candidate_count: number;
}

export interface CandidateRow {
  id: string;
  posting_id: string;
  posting_title: string;
  full_name: string;
  source: CandidateSource;
  status: CandidateStatus;
  has_cv: boolean;
  staff_id: string | null;
  created_at: string;
}

export interface Interview {
  id: string;
  round: number;
  scheduled_at: string;
  location: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  result: 'passed' | 'failed' | null;
  score: number | null;
  evaluation: string | null;
  cancel_reason: string | null;
  interviewers: Array<{ staff_id: string; full_name: string }>;
}

export interface CandidateDetail extends CandidateRow {
  org_unit_id: string;
  phone: string;
  email: string | null;
  dob: string | null;
  gender: 'male' | 'female' | null;
  address: string | null;
  cover_letter: string | null;
  note: string | null;
  status_reason: string | null;
  decision_note: string | null;
  position: string;
  cv_file_id: string | null;
  cv_file_name: string | null;
  staff_code: string | null;
  can_manage: boolean;
  can_interview: boolean;
  interviews: Interview[];
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  closed: 'Đã đóng',
};
export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  draft: 'Đang soạn',
  published: 'Đã công bố',
  closed: 'Đã đóng',
};
export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  new: 'Mới',
  screening: 'Đang sàng lọc',
  interviewing: 'Đang phỏng vấn',
  hired: 'Đã tuyển',
  rejected: 'Không đạt',
  withdrawn: 'Đã rút',
};
export const SOURCE_LABELS: Record<CandidateSource, string> = {
  website: 'Trang tuyển dụng',
  referral: 'Người giới thiệu',
  job_board: 'Trang việc làm',
  social_media: 'Mạng xã hội',
  walk_in: 'Nộp trực tiếp',
  other: 'Khác',
};

export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const getJson = <Result>(path: string) => requestJson<Result>(path);
export const postJson = <Result>(path: string, body: unknown = {}, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

export function uploadCv(candidateId: string, file: File): Promise<CandidateDetail> {
  const form = new FormData();
  form.append('cv', file);
  return requestJson(`/api/v1/candidates/${candidateId}/cv`, { method: 'POST', body: form });
}

export async function openCv(candidateId: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/candidates/${candidateId}/cv`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không mở được hồ sơ xin việc');
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}
