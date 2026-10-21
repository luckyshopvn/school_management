// Quản trị và trình diễn (DT-18 phần 18h, YCTD-145)

// Mật khẩu chung của mọi tài khoản trình diễn; dữ liệu giả, hiện công khai ở trang chọn vai của bản trình diễn
export const DEMO_PASSWORD = 'Demo@2026';

// Trạng thái một lần đăng nhập thay
export type ImpersonationStatus = 'active' | 'exit' | 'expired' | 'logout';

export const IMPERSONATION_STATUS_LABELS: Record<ImpersonationStatus, string> = {
  active: 'Đang đăng nhập thay',
  exit: 'Đã thoát',
  expired: 'Hết hạn',
  logout: 'Đăng xuất',
};

// Phiên đăng nhập thay dài tối đa 60 phút, không gia hạn
export const IMPERSONATION_LIFETIME_MINUTES = 60;

// Gói toàn bộ dữ liệu của trường giữ để tải trong 48 giờ
export const SCHOOL_DATA_RETENTION_HOURS = 48;

// Ứng dụng của tài khoản trình diễn
export type DemoAccountApp = 'portal' | 'teacher' | 'parent';

export const DEMO_ACCOUNT_APP_LABELS: Record<DemoAccountApp, string> = {
  portal: 'Cổng quản trị',
  teacher: 'Ứng dụng giáo viên',
  parent: 'Ứng dụng phụ huynh',
};
