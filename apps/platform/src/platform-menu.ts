// Menu của cổng vận hành nền tảng theo dữ liệu (DT-SaaS phần S1a, tài liệu 47 mục 14.5): mỗi phần sau thêm mục của mình vào mảng này
// cùng một trang, không sửa khung. Từ YCTD-324 mục xếp theo ba nhóm của thiết kế cổng vận hành Eric duyệt ngày 2026-10-29 (Điều hành,
// Kinh doanh, Hệ thống); thứ tự trong mảng là thứ tự hiện
export type PlatformMenuGroup = 'dieu-hanh' | 'kinh-doanh' | 'he-thong';

export interface PlatformMenuItem {
  key: string;
  label: string;
  group: PlatformMenuGroup;
}

export const PLATFORM_MENU_GROUPS: ReadonlyArray<{ key: PlatformMenuGroup; label: string }> = [
  { key: 'dieu-hanh', label: 'Điều hành' },
  { key: 'kinh-doanh', label: 'Kinh doanh' },
  { key: 'he-thong', label: 'Hệ thống' },
];

export const PLATFORM_MENU: readonly PlatformMenuItem[] = [
  { key: 'overview', label: 'Tổng quan', group: 'dieu-hanh' },
  { key: 'schools', label: 'Trường học', group: 'dieu-hanh' },
  // Bảng điều khiển: số liệu, lỗi, việc định kỳ của từng trường (S4)
  { key: 'dashboard', label: 'Bảng điều khiển', group: 'dieu-hanh' },
  // Đơn vị cấp trên: cây đơn vị, tài khoản cấp trên (S6)
  { key: 'parent-orgs', label: 'Đơn vị cấp trên', group: 'dieu-hanh' },
  // Danh mục đơn vị toàn quốc, trang đăng nhập theo đơn vị, chính sách vào trường (DT-24)
  { key: 'catalog', label: 'Danh mục đơn vị', group: 'dieu-hanh' },
  // Gói dịch vụ và giới hạn (S5a)
  { key: 'plans', label: 'Gói dịch vụ', group: 'kinh-doanh' },
  // Thu phí tự động (S5b)
  { key: 'billing', label: 'Thu phí', group: 'kinh-doanh' },
  // Chợ gia sư: cấu hình, văn bản pháp lý, số tài khoản (DT-27 phần 27f)
  { key: 'market', label: 'Chợ gia sư', group: 'kinh-doanh' },
  // Trợ lý AI: khóa nền tảng, đơn giá AI theo gói, token đã dùng (DT-23 phần 23d)
  { key: 'ai', label: 'Trợ lý AI', group: 'kinh-doanh' },
  // Gia sư AI nền tảng bán thẳng cho phụ huynh: gói, giao dịch, biên lai, hoàn tiền (YCTD-383 lát L1b)
  { key: 'ai-tutor', label: 'Gia sư AI', group: 'kinh-doanh' },
  // Thông báo bảo trì (S4)
  { key: 'maintenance', label: 'Bảo trì', group: 'he-thong' },
  // Nhật ký vào trường, khởi tạo, bật tính năng (YCTD-324)
  { key: 'audit', label: 'Nhật ký truy cập', group: 'he-thong' },
  // Nhân viên vận hành của công ty: chỉ vai trò quản trị thấy (YCTD-311)
  { key: 'operators', label: 'Nhân viên vận hành', group: 'he-thong' },
];

// Tên vai trò vận hành hiện ở chân thanh bên
export const OPERATOR_ROLE_LABELS: Record<string, string> = {
  quan_tri: 'Quản trị nền tảng',
  ho_tro: 'Hỗ trợ trường',
  ky_thuat: 'Kỹ thuật',
  ke_toan: 'Kế toán',
};
