import type { SchoolLevelCode } from '@school-management/shared';
import { publicJson, requestJson } from '../session/api-client.js';

// Khung trang cổng quản trị theo Sở (DT-16 phần 16c): thông báo hệ thống, ứng dụng liên kết, ngữ cảnh trường, trang đăng
// nhập và quên mật khẩu
export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_by_name: string | null;
  updated_at: string;
}

export type ActiveAnnouncement = Pick<SystemAnnouncement, 'id' | 'title' | 'content' | 'valid_from' | 'valid_until'>;

export interface AnnouncementInput {
  title: string;
  content: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export interface AppLink {
  id: string;
  name: string;
  url: string;
  description: string | null;
  position: number;
}

export type AppLinkInput = Pick<AppLink, 'name' | 'url' | 'description'>;

export interface PortalContext {
  school_name: string | null;
  school_code: string | null;
  academic_year: string | null;
  education_level: string;
  organization_id_reminder: boolean;
}

export interface PortalSchoolLevel {
  code: SchoolLevelCode;
  display_name: string;
  learner_term: string;
  context_label: string;
}

export interface LoginInfo {
  school_name: string | null;
  school_code: string | null;
  academic_year: string | null;
}

export interface LoginOptions {
  hotline: string | null;
  captcha_always: boolean;
}

export interface CaptchaChallenge {
  captcha_id: string;
  image: string;
  expires_in_seconds: number;
}

export function listAnnouncements(): Promise<SystemAnnouncement[]> {
  return requestJson('/api/v1/system-announcements');
}

export function listActiveAnnouncements(): Promise<ActiveAnnouncement[]> {
  return requestJson('/api/v1/system-announcements/active');
}

export function createAnnouncement(input: AnnouncementInput): Promise<SystemAnnouncement> {
  return requestJson('/api/v1/system-announcements', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAnnouncement(id: string, input: AnnouncementInput): Promise<SystemAnnouncement> {
  return requestJson(`/api/v1/system-announcements/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteAnnouncement(id: string): Promise<void> {
  return requestJson(`/api/v1/system-announcements/${id}`, { method: 'DELETE' });
}

export function listAppLinks(): Promise<AppLink[]> {
  return requestJson('/api/v1/app-links');
}

export function saveAppLinks(links: AppLinkInput[]): Promise<AppLink[]> {
  return requestJson('/api/v1/app-links', { method: 'PUT', body: JSON.stringify({ links }) });
}

export function readPortalContext(): Promise<PortalContext> {
  return requestJson('/api/v1/portal-context');
}

// Cấp người dùng được xem theo thứ tự (DT-19 phần 19c)
export function readPortalSchoolLevels(): Promise<{ school_levels: PortalSchoolLevel[] }> {
  return requestJson('/api/v1/portal-context/school-levels');
}

export function readLoginInfo(): Promise<LoginInfo> {
  return publicJson('/api/v1/public/login-info');
}

export function readLoginOptions(): Promise<LoginOptions> {
  return publicJson('/api/v1/auth/login-options');
}

export function issueCaptcha(): Promise<CaptchaChallenge> {
  return publicJson('/api/v1/auth/captcha', { method: 'POST', body: '{}' });
}

export function requestPasswordReset(body: {
  login: string;
  captcha_id: string;
  captcha_text: string;
}): Promise<{ message: string; expires_in_seconds: number }> {
  return publicJson('/api/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmPasswordReset(body: {
  login: string;
  code: string;
  new_password: string;
}): Promise<{ message: string }> {
  return publicJson('/api/v1/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(body) });
}
