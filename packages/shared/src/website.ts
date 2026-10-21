// Website trường trên tên miền riêng (DT-18 phần 18f, YCTD-144; quyết định của Eric ngày 2026-10-19): nhãn dùng chung cho
// máy chủ API (trang công khai) và cổng quản trị
export type WebsiteContentStatus = 'draft' | 'pending' | 'published' | 'unpublished';
export type WebsitePostKind = 'news' | 'announcement' | 'page' | 'disclosure';
export type WebsiteDomainKind = 'primary' | 'alias' | 'demo';

export const WEBSITE_STATUS_LABELS: Record<WebsiteContentStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  published: 'Đã đăng',
  unpublished: 'Đã gỡ',
};

export const WEBSITE_POST_KIND_LABELS: Record<WebsitePostKind, string> = {
  news: 'Tin tức',
  announcement: 'Thông báo',
  page: 'Trang giới thiệu',
  disclosure: 'Công khai theo quy định',
};

export const WEBSITE_DOMAIN_KIND_LABELS: Record<WebsiteDomainKind, string> = {
  primary: 'Tên miền chính',
  alias: 'Tên miền phụ (chuyển về tên miền chính)',
  demo: 'Tên miền trình diễn',
};

// Trang cố định của website: mỗi trang một bài loại "page"
export const WEBSITE_PAGE_KEYS = [
  { key: 'intro', label: 'Giới thiệu' },
  { key: 'organization', label: 'Cơ cấu tổ chức' },
] as const;
export type WebsitePageKey = (typeof WEBSITE_PAGE_KEYS)[number]['key'];

// Cấp học của trường để chọn nhóm công khai theo Thông tư 09/2024/TT-BGDĐT (mầm non Điều 6, 7; phổ thông Điều 8, 9)
export const WEBSITE_SCHOOL_LEVELS = [
  { value: 'MN', label: 'Mầm non' },
  { value: 'TH', label: 'Tiểu học' },
  { value: 'THCS', label: 'Trung học cơ sở' },
  { value: 'THPT', label: 'Trung học phổ thông' },
] as const;

// Ảnh tối đa 10 MB, tệp đính kèm (PDF, Word, Excel) tối đa 20 MB; album tối đa 200 ảnh, mỗi bài tối đa 20 tệp
export const WEBSITE_MAXIMUM_IMAGE_BYTES = 10 * 1024 * 1024;
export const WEBSITE_MAXIMUM_FILE_BYTES = 20 * 1024 * 1024;
export const WEBSITE_MAXIMUM_ALBUM_PHOTOS = 200;
export const WEBSITE_MAXIMUM_POST_FILES = 20;
