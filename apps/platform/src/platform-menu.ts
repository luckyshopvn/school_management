// Menu của cổng vận hành nền tảng theo dữ liệu (DT-SaaS phần S1a, tài liệu 32 mục 14.5): mỗi phần sau thêm mục của mình ở cuối mảng
// này (S2 Trường, S5a Gói dịch vụ, S4 Bảng điều khiển, S5b Hóa đơn, ...) cùng một trang, không sửa khung
export interface PlatformMenuItem {
  key: string;
  label: string;
}

export const PLATFORM_MENU: readonly PlatformMenuItem[] = [{ key: 'overview', label: 'Tổng quan' }];
