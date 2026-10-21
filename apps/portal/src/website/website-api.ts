import type { WebsiteContentStatus, WebsiteDomainKind, WebsitePostKind } from '@school-management/shared';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Website trường trên tên miền riêng (DT-18 phần 18f, YCTD-144)
const BASE = '/api/v1/website';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | number | undefined | null>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      parameters.set(key, String(value));
    }
  }
  const text = parameters.toString();
  return text ? `?${text}` : '';
}

export interface WebsiteFile {
  id: string;
  purpose: 'cover' | 'attachment' | 'photo' | 'logo' | 'banner';
  file_name: string;
  content_type: string;
  size_bytes: number;
  caption?: string | null;
}

export interface WebsiteSettings {
  site_name: string;
  slogan: string | null;
  introduction: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  map_url: string | null;
  office_hours: string | null;
  facebook_url: string | null;
  admission_form_url: string | null;
  footer_note: string | null;
  primary_color: string;
  school_levels: string[];
  show_timetable: boolean;
  demo_mode: boolean;
  logo_file_id: string | null;
  banner_file_id: string | null;
  logo: WebsiteFile | null;
  banner: WebsiteFile | null;
  sample_count: number;
  updated_by_name: string | null;
  updated_at: string;
}

export type WebsiteSettingsInput = Omit<
  WebsiteSettings,
  'logo_file_id' | 'banner_file_id' | 'logo' | 'banner' | 'sample_count' | 'updated_by_name' | 'updated_at'
>;

export interface WebsiteDomain {
  id: string;
  hostname: string;
  kind: WebsiteDomainKind;
  active: boolean;
  dns_confirmed_at: string | null;
  dns_confirmed_by_name: string | null;
  note: string | null;
  created_by_name: string;
  created_at: string;
}

export interface WebsiteEvent {
  id: string;
  action: string;
  note: string | null;
  actor_name: string;
  created_at: string;
}

interface Workflow {
  id: string;
  slug: string;
  title: string;
  status: WebsiteContentStatus;
  return_note: string | null;
  submitted_at: string | null;
  submitted_by_name?: string | null;
  published_at: string | null;
  published_by_name?: string | null;
  first_published_at?: string | null;
  unpublished_at?: string | null;
  unpublish_reason: string | null;
  is_sample: boolean;
  created_by_name: string;
  updated_at: string;
}

export interface WebsitePostRow extends Workflow {
  kind: WebsitePostKind;
  page_key: string | null;
  disclosure_category: string | null;
  disclosure_year: string | null;
  summary: string | null;
  pinned: boolean;
}

export interface WebsitePost extends WebsitePostRow {
  body_html: string;
  cover_file_id: string | null;
  files: WebsiteFile[];
  events: WebsiteEvent[];
}

export interface WebsitePostInput {
  kind?: WebsitePostKind;
  page_key?: string | null;
  disclosure_category?: string | null;
  disclosure_year?: string | null;
  title: string;
  summary: string | null;
  body_html: string;
  pinned: boolean;
}

export interface WebsiteAlbumRow extends Workflow {
  event_date: string | null;
  consent_confirmed: boolean;
  photo_count: number;
}

export interface WebsiteAlbum extends WebsiteAlbumRow {
  description: string | null;
  cover_file_id: string | null;
  consent_confirmed_by_name: string | null;
  files: WebsiteFile[];
  events: WebsiteEvent[];
}

export interface DisclosureCategory {
  code: string;
  name: string;
  legal_basis: string | null;
  school_level: string | null;
}

export interface ReviewItem {
  id: string;
  kind: WebsitePostKind | 'album';
  target_type: 'post' | 'album';
  title: string;
  submitted_at: string | null;
  submitted_by_name: string | null;
  created_by_name: string;
}

export interface ContactMessage {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: 'new' | 'handled';
  handled_note: string | null;
  handled_at: string | null;
  handled_by_name: string | null;
  created_at: string;
}

export interface Paged<Row> {
  items: Row[];
  total: number;
}

// ---- Thiết lập ----

export const readSettings = (): Promise<WebsiteSettings> => requestJson(`${BASE}/settings`);
export const saveSettings = (input: WebsiteSettingsInput): Promise<WebsiteSettings> =>
  requestJson(`${BASE}/settings`, json('PUT', input));
export function uploadSettingsImage(purpose: 'logo' | 'banner', file: File): Promise<WebsiteSettings> {
  const form = new FormData();
  form.set('file', file, file.name);
  return requestJson(`${BASE}/settings/images/${purpose}`, { method: 'POST', body: form });
}
export const removeSettingsImage = (purpose: 'logo' | 'banner'): Promise<WebsiteSettings> =>
  requestJson(`${BASE}/settings/images/${purpose}`, json('DELETE'));
export const createSampleContent = (): Promise<WebsiteSettings> => requestJson(`${BASE}/sample-content`, json('POST'));
export const deleteSampleContent = (): Promise<WebsiteSettings> =>
  requestJson(`${BASE}/sample-content`, json('DELETE'));

export const listDomains = (): Promise<{ items: WebsiteDomain[] }> => requestJson(`${BASE}/domains`);
export const addDomain = (input: { hostname: string; kind: WebsiteDomainKind; note: string | null }) =>
  requestJson<WebsiteDomain>(`${BASE}/domains`, json('POST', input));
export const updateDomain = (id: string, input: { kind?: WebsiteDomainKind; active?: boolean; note?: string | null }) =>
  requestJson<WebsiteDomain>(`${BASE}/domains/${id}`, json('PATCH', input));
export const confirmDomainDns = (id: string, confirmed: boolean) =>
  requestJson<WebsiteDomain>(`${BASE}/domains/${id}/dns-confirmation`, json('POST', { confirmed }));
export const deleteDomain = (id: string): Promise<void> => requestJson(`${BASE}/domains/${id}`, json('DELETE'));
export const listDisclosureCategories = (): Promise<{ items: DisclosureCategory[] }> =>
  requestJson(`${BASE}/disclosure-categories`);

// ---- Bài viết ----

export const listPosts = (filter: {
  kind?: WebsitePostKind;
  status?: WebsiteContentStatus;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<Paged<WebsitePostRow>> =>
  requestJson(
    `${BASE}/posts${query({ kind: filter.kind, status: filter.status, q: filter.q, page: filter.page, page_size: filter.pageSize })}`,
  );
export const readPost = (id: string): Promise<WebsitePost> => requestJson(`${BASE}/posts/${id}`);
export const createPost = (input: WebsitePostInput): Promise<WebsitePost> =>
  requestJson(`${BASE}/posts`, json('POST', input));
export const updatePost = (id: string, input: WebsitePostInput): Promise<WebsitePost> =>
  requestJson(`${BASE}/posts/${id}`, json('PUT', input));
export const deletePost = (id: string): Promise<void> => requestJson(`${BASE}/posts/${id}`, json('DELETE'));
export const submitPost = (id: string): Promise<WebsitePost> => requestJson(`${BASE}/posts/${id}/submit`, json('POST'));
export const approvePost = (id: string): Promise<WebsitePost> =>
  requestJson(`${BASE}/posts/${id}/approve`, json('POST'));
export const returnPost = (id: string, note: string): Promise<WebsitePost> =>
  requestJson(`${BASE}/posts/${id}/return`, json('POST', { note }));
export const unpublishPost = (id: string, reason: string): Promise<WebsitePost> =>
  requestJson(`${BASE}/posts/${id}/unpublish`, json('POST', { reason }));
export function uploadPostFile(id: string, file: File, purpose: 'cover' | 'attachment'): Promise<WebsitePost> {
  const form = new FormData();
  form.set('file', file, file.name);
  form.set('purpose', purpose);
  return requestJson(`${BASE}/posts/${id}/files`, { method: 'POST', body: form });
}
export const deletePostFile = (id: string, fileId: string): Promise<WebsitePost> =>
  requestJson(`${BASE}/posts/${id}/files/${fileId}`, json('DELETE'));

// ---- Album ----

export const listAlbums = (filter: {
  status?: WebsiteContentStatus;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<Paged<WebsiteAlbumRow>> =>
  requestJson(
    `${BASE}/albums${query({ status: filter.status, q: filter.q, page: filter.page, page_size: filter.pageSize })}`,
  );
export const readAlbum = (id: string): Promise<WebsiteAlbum> => requestJson(`${BASE}/albums/${id}`);
export const createAlbum = (input: { title: string; description: string | null; event_date: string | null }) =>
  requestJson<WebsiteAlbum>(`${BASE}/albums`, json('POST', input));
export const updateAlbum = (
  id: string,
  input: { title: string; description: string | null; event_date: string | null },
) => requestJson<WebsiteAlbum>(`${BASE}/albums/${id}`, json('PUT', input));
export const deleteAlbum = (id: string): Promise<void> => requestJson(`${BASE}/albums/${id}`, json('DELETE'));
export const submitAlbum = (id: string, consent: boolean): Promise<WebsiteAlbum> =>
  requestJson(`${BASE}/albums/${id}/submit`, json('POST', { consent_confirmed: consent }));
export const approveAlbum = (id: string): Promise<WebsiteAlbum> =>
  requestJson(`${BASE}/albums/${id}/approve`, json('POST'));
export const returnAlbum = (id: string, note: string): Promise<WebsiteAlbum> =>
  requestJson(`${BASE}/albums/${id}/return`, json('POST', { note }));
export const unpublishAlbum = (id: string, reason: string): Promise<WebsiteAlbum> =>
  requestJson(`${BASE}/albums/${id}/unpublish`, json('POST', { reason }));
export function uploadAlbumPhoto(id: string, file: File, caption: string | null): Promise<WebsiteAlbum> {
  const form = new FormData();
  form.set('file', file, file.name);
  if (caption) {
    form.set('caption', caption);
  }
  return requestJson(`${BASE}/albums/${id}/files`, { method: 'POST', body: form });
}
export const deleteAlbumPhoto = (id: string, fileId: string): Promise<WebsiteAlbum> =>
  requestJson(`${BASE}/albums/${id}/files/${fileId}`, json('DELETE'));
export const setAlbumCover = (id: string, fileId: string): Promise<WebsiteAlbum> =>
  requestJson(`${BASE}/albums/${id}/cover/${fileId}`, json('POST'));

// ---- Duyệt, liên hệ ----

export const listReview = (): Promise<Paged<ReviewItem>> => requestJson(`${BASE}/review`);
export const listContacts = (filter: {
  status?: string;
  page: number;
  pageSize: number;
}): Promise<Paged<ContactMessage>> =>
  requestJson(`${BASE}/contacts${query({ status: filter.status, page: filter.page, page_size: filter.pageSize })}`);
export const handleContact = (id: string, note: string | null): Promise<ContactMessage> =>
  requestJson(`${BASE}/contacts/${id}/handle`, json('POST', { note }));

// Ảnh, tệp xem trong trang quản trị (cần phiên đăng nhập): tải về thành địa chỉ blob để hiện
export async function fileObjectUrl(fileId: string): Promise<string> {
  const response = await fetchWithSession(`${BASE}/files/${fileId}`);
  if (!response.ok) {
    throw await readError(response);
  }
  return URL.createObjectURL(await response.blob());
}
