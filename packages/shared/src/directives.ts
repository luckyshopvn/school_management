// Giao việc, lịch đơn vị, phòng họp, hồ sơ công việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141; quyết định của Eric ngày
// 2026-10-19): nhãn dùng chung cho máy chủ API (tệp Excel, PDF) và cổng quản trị. Tên trường, nút, giá trị lọc theo khảo
// sát iOffice ngày 2026-10-19; phần khảo sát không ghi do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type DirectiveRole = 'main' | 'coordinate' | 'follow';
export type DirectiveTarget = 'unit' | 'staff';
export type DirectiveAssignmentStatus = 'todo' | 'in_progress' | 'pending_approval' | 'done' | 'cancelled';
export type DirectiveRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type DirectivePriority = 'low' | 'normal' | 'high';
// Lọc "Công việc cần xử lý" theo trạng thái như iOffice
export type DirectiveStatusFilter =
  | 'open'
  | 'open_on_time'
  | 'open_overdue'
  | 'done'
  | 'done_on_time'
  | 'done_late'
  | 'pending_approval'
  | 'approved'
  | 'approved_not_done'
  | 'approved_done';
export type ScheduleSessionKey = 'morning' | 'afternoon';
export type RoomBookingStatusKey = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type WorkFileStatusKey = 'open' | 'closed' | 'submitted' | 'returned' | 'archived';

export const DIRECTIVE_ROLE_LABELS: Record<DirectiveRole, string> = {
  main: 'Xử lý chính',
  coordinate: 'Phối hợp',
  follow: 'Theo dõi',
};

export const DIRECTIVE_TARGET_LABELS: Record<DirectiveTarget, string> = {
  unit: 'Phòng ban',
  staff: 'Cá nhân',
};

export const DIRECTIVE_ASSIGNMENT_STATUS_LABELS: Record<DirectiveAssignmentStatus, string> = {
  todo: 'Chưa xử lý',
  in_progress: 'Đang xử lý',
  pending_approval: 'Chờ phê duyệt',
  done: 'Đã hoàn thành',
  cancelled: 'Đã thu hồi',
};

export const DIRECTIVE_PRIORITY_LABELS: Record<DirectivePriority, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Quan trọng',
};

export const DIRECTIVE_RECURRENCE_LABELS: Record<DirectiveRecurrence, string> = {
  none: 'Không nhắc định kì',
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
};

export const DIRECTIVE_STATUS_FILTER_LABELS: Record<DirectiveStatusFilter, string> = {
  open: 'Chưa hoàn thành',
  open_on_time: 'Chưa hoàn thành – còn hạn',
  open_overdue: 'Chưa hoàn thành – quá hạn',
  done: 'Đã hoàn thành',
  done_on_time: 'Đã hoàn thành – đúng hạn',
  done_late: 'Đã hoàn thành – quá hạn',
  pending_approval: 'Chờ phê duyệt',
  approved: 'Đã phê duyệt',
  approved_not_done: 'Đã phê duyệt – chưa xử lý xong',
  approved_done: 'Đã phê duyệt – duyệt xử lý xong',
};

export const SCHEDULE_SESSION_LABELS: Record<ScheduleSessionKey, string> = {
  morning: 'Sáng',
  afternoon: 'Chiều',
};

export const ROOM_BOOKING_STATUS_LABELS: Record<RoomBookingStatusKey, string> = {
  pending: 'Chờ phê duyệt',
  approved: 'Phê duyệt',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
};

// Trạng thái hồ sơ theo màn hình Quản lý hồ sơ lưu trữ của iOffice
export const WORK_FILE_STATUS_LABELS: Record<WorkFileStatusKey, string> = {
  open: 'Đang cập nhật',
  closed: 'Đã hoàn thành',
  submitted: 'Đã bàn giao',
  returned: 'Bị trả về',
  archived: 'Đã lưu trữ',
};

export const WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

// Tệp đính kèm của việc tối đa 50 MB mỗi tệp như văn bản đến
export const DIRECTIVE_MAXIMUM_FILE_BYTES = 50 * 1024 * 1024;
