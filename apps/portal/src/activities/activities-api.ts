import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối hoạt động, tin tức, thư viện, ngoại khóa (P14; YCTD-78)
export type ActivityStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'hidden';
export type ContentStatus = 'draft' | 'published' | 'hidden';

export interface ActivityMedia {
  id: string;
  caption: string | null;
  file_name: string;
  excluded: boolean;
  unconsented_children: Array<{ id: string; full_name: string }>;
}

export interface Activity {
  id: string;
  org_unit_id: string;
  class_id: string;
  class_name: string;
  category_name: string;
  title: string;
  content: string;
  activity_date: string;
  status: ActivityStatus;
  created_by_name: string;
  reject_reason: string | null;
  hidden_reason: string | null;
  media: ActivityMedia[];
  like_count: number;
  comment_count: number;
}

export interface CatalogItem {
  id: string;
  org_unit_id: string;
  name: string;
  order_no: number;
  status: 'active' | 'inactive';
}

export interface ContentItem {
  id: string;
  org_unit_id: string;
  title: string;
  status: ContentStatus;
  scope_type: 'school' | 'unit' | 'class' | 'child';
  published_at: string | null;
  hidden_reason: string | null;
  can_manage: boolean;
}

export interface Comment {
  id: string;
  author_name: string;
  content: string;
  is_parent: boolean;
  created_at: string;
  hidden_reason: string | null;
}

export interface Extracurricular {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  quota: number;
  fee_type: 'free' | 'per_activity' | 'monthly';
  fee_amount: number;
  status: 'draft' | 'published' | 'closed';
  registered_count: number;
  remaining: number;
}

export interface Registration {
  id: string;
  child_name: string;
  status: 'active' | 'withdrawn';
  effective_from: string;
  effective_to: string | null;
}

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  published: 'Đã công bố',
  rejected: 'Bị từ chối',
  hidden: 'Đã ẩn',
};
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Nháp',
  published: 'Đã công bố',
  hidden: 'Đã ẩn',
};
export const FEE_TYPE_LABELS = { free: 'Miễn phí', per_activity: 'Theo hoạt động', monthly: 'Theo tháng' };

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const postJson = <Result>(path: string, body: unknown = {}, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

export function uploadContentFile(orgUnitId: string, file: File): Promise<{ id: string; file_name: string }> {
  const form = new FormData();
  form.append('org_unit_id', orgUnitId);
  form.append('file', file);
  return requestJson('/api/v1/content-files', { method: 'POST', body: form });
}
