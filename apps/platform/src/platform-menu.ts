// Menu của cổng vận hành nền tảng theo dữ liệu (DT-SaaS phần S1a, tài liệu 32 mục 14.5): mỗi phần sau thêm mục của mình ở cuối mảng
// này (S2 Trường, S5a Gói dịch vụ, S4 Bảng điều khiển, S5b Hóa đơn, ...) cùng một trang, không sửa khung
export interface PlatformMenuItem {
  key: string;
  label: string;
}

export const PLATFORM_MENU: readonly PlatformMenuItem[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'schools', label: 'Trường' },
  // Gói dịch vụ và giới hạn (S5a)
  { key: 'plans', label: 'Gói dịch vụ' },
  // Thu phí tự động (S5b)
  { key: 'billing', label: 'Thu phí' },
  // Bảng điều khiển và thông báo bảo trì (S4)
  { key: 'dashboard', label: 'Bảng điều khiển' },
  { key: 'maintenance', label: 'Bảo trì' },
  // Đơn vị cấp trên: cây đơn vị, tài khoản cấp trên (S6)
  { key: 'parent-orgs', label: 'Đơn vị cấp trên' },
  // Danh mục đơn vị toàn quốc, trang đăng nhập theo đơn vị, chính sách vào trường (DT-24)
  { key: 'catalog', label: 'Danh mục đơn vị' },
];
