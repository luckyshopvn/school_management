// Kho học liệu số (DT-22 phần 22h1, YCTD-183): nhãn dùng chung cho máy chủ, cổng quản trị
export type ResourceVisibility = 'private' | 'unit' | 'school' | 'network';
export type LearningResourceStatus =
  'draft' | 'pending_unit' | 'pending_school' | 'published' | 'returned' | 'hidden' | 'retired';
export type ResourceVersionKind = 'file' | 'link' | 'lesson_plan';
export type LearningResourceReportKind = 'content' | 'file' | 'copyright';

// Phạm vi liên trường lưu sẵn trong danh mục nhưng không bật ở DT-22 (chờ DT-SaaS)
export const RESOURCE_VISIBILITY_LABELS: Record<ResourceVisibility, string> = {
  private: 'Cá nhân',
  unit: 'Tổ chuyên môn',
  school: 'Toàn trường',
  network: 'Liên trường (chưa bật)',
};

export const ENABLED_RESOURCE_VISIBILITIES: ResourceVisibility[] = ['private', 'unit', 'school'];

export const LEARNING_RESOURCE_STATUS_LABELS: Record<LearningResourceStatus, string> = {
  draft: 'Nháp',
  pending_unit: 'Chờ tổ duyệt',
  pending_school: 'Chờ Ban Giám hiệu duyệt',
  published: 'Đã công bố',
  returned: 'Bị trả lại',
  hidden: 'Ẩn tạm',
  retired: 'Ngừng dùng',
};

export const RESOURCE_VERSION_KIND_LABELS: Record<ResourceVersionKind, string> = {
  file: 'Tệp tải lên',
  link: 'Liên kết ngoài',
  lesson_plan: 'Kế hoạch bài dạy',
};

export const LEARNING_RESOURCE_REPORT_KIND_LABELS: Record<LearningResourceReportKind, string> = {
  content: 'Sai nội dung',
  file: 'Lỗi tệp',
  copyright: 'Nghi vi phạm bản quyền',
};

// Tệp học liệu tối đa 50 MB; học liệu chờ duyệt quá số ngày này là quá hạn duyệt
export const LEARNING_RESOURCE_MAXIMUM_FILE_BYTES = 50 * 1024 * 1024;
export const LEARNING_RESOURCE_REVIEW_DAYS = 7;
