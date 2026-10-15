import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối tuyển sinh (P16; YCTD-86)
export type CampaignStatus = 'draft' | 'open' | 'closed';
export type ApplicationStatus = 'submitted' | 'received' | 'passed' | 'rejected' | 'converted';
export type PostStatus = 'draft' | 'published' | 'hidden';

export interface Campaign {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  name: string;
  description: string | null;
  quota: number;
  open_from: string;
  open_to: string;
  status: CampaignStatus;
  application_count: number;
  passed_count: number;
  converted_count: number;
}

export interface ApplicationRow {
  id: string;
  code: string;
  campaign_id: string;
  campaign_name: string;
  source: 'online' | 'staff';
  child_full_name: string;
  child_dob: string;
  guardian_full_name: string;
  guardian_phone: string;
  status: ApplicationStatus;
  reject_reason: string | null;
  created_child_id: string | null;
  child_status: string | null;
}

export interface ApplicationDetail extends ApplicationRow {
  org_unit_id: string;
  child_gender: 'male' | 'female';
  child_national_id_masked: string | null;
  child_has_allergies: boolean | null;
  child_allergies: string | null;
  guardian_email: string | null;
  guardian_relationship_item_id: string | null;
  guardian_relationship: string | null;
  address: string | null;
  note: string | null;
  review_note: string | null;
  planned_class_id: string | null;
  planned_class_name: string | null;
}

export interface Post {
  id: string;
  campaign_id: string;
  campaign_name: string;
  title: string;
  content: string;
  publish_from: string;
  publish_to: string | null;
  status: PostStatus;
  hidden_reason: string | null;
}

export interface ConvertResult {
  child: { id: string; full_name: string; status: string; current_class: { class_name: string } | null };
  approval_error: string | null;
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Nháp',
  open: 'Đang mở',
  closed: 'Đã đóng',
};
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Đã nộp',
  received: 'Đã tiếp nhận',
  passed: 'Đạt',
  rejected: 'Không đạt',
  converted: 'Đã chuyển hồ sơ học sinh',
};
export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Nháp',
  published: 'Đang đăng',
  hidden: 'Đã ẩn',
};

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

export const listCampaigns = () => requestJson<Campaign[]>('/api/v1/admission-campaigns');
export const listApplications = (campaignId: string, status: string) =>
  requestJson<ApplicationRow[]>(
    `/api/v1/admission-applications?campaign_id=${campaignId}${status ? `&status=${status}` : ''}`,
  );
export const getApplication = (id: string) => requestJson<ApplicationDetail>(`/api/v1/admission-applications/${id}`);
export const listPosts = (campaignId: string) =>
  requestJson<Post[]>(`/api/v1/admission-posts?campaign_id=${campaignId}`);
