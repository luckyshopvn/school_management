// Vai trò nhân viên vận hành nền tảng và việc từng vai trò được làm ở cổng vận hành (YCTD-323; vai trò từ YCTD-311, migration nền tảng
// 0241). Một bảng dùng chung cho dịch vụ định danh, máy chủ API (phần quản trị chợ gia sư) và menu của cổng, để ẩn trang và chặn ở máy chủ
// theo cùng một danh sách. Việc nào không ghi ở đây thì chỉ quản trị làm được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo
// ghi chú vai trò ở migration 0241 và nhóm menu của thiết kế cổng vận hành:
// - quan_tri: mọi việc;
// - ho_tro: hỗ trợ trường (xem trường, cấp lại liên kết kích hoạt, mở phiên hỗ trợ), kiểm duyệt và duyệt hồ sơ gia sư ở chợ;
// - ky_thuat: khởi tạo trường, tên miền, loại dữ liệu, hồ sơ đồng ý, vùng máy chủ (cùng YCTD-343), bảo trì, phiên hỗ trợ;
// - ke_toan: gói dịch vụ, thu phí, tính năng trả phí của trường, đơn giá AI, thanh toán ở chợ; không mở phiên hỗ trợ vào dữ liệu trường
export const OPERATOR_ROLES = ['quan_tri', 'ho_tro', 'ky_thuat', 'ke_toan'] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];

const ALL: readonly OperatorRole[] = OPERATOR_ROLES;
const ADMIN: readonly OperatorRole[] = ['quan_tri'];

export const OPERATOR_PERMISSIONS = {
  // Xem: bảng điều khiển, danh sách và chi tiết trường, danh mục đơn vị, đơn vị cấp trên, gói (để hiện ở trang trường), thông báo bảo
  // trì, chính sách hỗ trợ
  'overview.view': ALL,
  'schools.view': ALL,
  'catalog.view': ALL,
  'parent-orgs.view': ALL,
  'plans.view': ALL,
  'maintenance.view': ALL,
  'support.view': ALL,
  // Lỗi máy chủ gần đây ở bảng điều khiển: người xử lý sự cố
  'dashboard.errors': ['quan_tri', 'ho_tro', 'ky_thuat'],
  // Trường: khởi tạo, chạy tiếp hoặc lùi việc khởi tạo, tên miền
  'schools.provision': ['quan_tri', 'ky_thuat'],
  'schools.domains': ['quan_tri', 'ky_thuat'],
  // Loại dữ liệu, hồ sơ đồng ý, vùng máy chủ (YCTD-343)
  'schools.data-governance': ['quan_tri', 'ky_thuat'],
  // Tạm ngưng, mở lại, yêu cầu xóa, hủy yêu cầu xóa trường
  'schools.lifecycle': ADMIN,
  // Cấp lại liên kết kích hoạt quản trị đầu tiên cho trường chưa kích hoạt
  'schools.invitation': ['quan_tri', 'ho_tro'],
  // Tính năng trả phí của trường
  'schools.addons': ['quan_tri', 'ke_toan'],
  // Phiên hỗ trợ vào dữ liệu trường (khi trường đã cho phép); chính sách hỗ trợ chỉ quản trị sửa
  'support.open': ['quan_tri', 'ho_tro', 'ky_thuat'],
  'support.policy': ADMIN,
  // Thông báo bảo trì
  'maintenance.manage': ['quan_tri', 'ky_thuat'],
  // Danh mục đơn vị toàn quốc, trang đăng nhập, liên kết trường với đơn vị
  'catalog.manage': ADMIN,
  // Cây đơn vị cấp trên và tài khoản cấp trên
  'parent-orgs.manage': ADMIN,
  // Gói dịch vụ và chuyển trạng thái theo hạn
  'plans.manage': ['quan_tri', 'ke_toan'],
  // Thu phí: hóa đơn, bảng giá, thanh toán; bộ nối thanh toán (khóa bí mật) chỉ quản trị
  'billing.view': ['quan_tri', 'ke_toan'],
  'billing.manage': ['quan_tri', 'ke_toan'],
  'billing.connectors': ADMIN,
  // Trợ lý AI: khóa và cấu hình chỉ quản trị; đơn giá theo gói và số token đã dùng cho kế toán
  'ai.view': ['quan_tri', 'ke_toan'],
  'ai.settings': ADMIN,
  'ai.pricing': ['quan_tri', 'ke_toan'],
  // Nhân viên vận hành
  'operators.manage': ADMIN,
  // Nhật ký truy cập của cổng vận hành: vào trường, khởi tạo, bật tính năng (YCTD-324)
  'audit.view': ['quan_tri', 'ho_tro'],
} as const satisfies Record<string, readonly OperatorRole[]>;

export type OperatorCapability = keyof typeof OPERATOR_PERMISSIONS;

export function operatorRolesFor(capability: OperatorCapability): readonly OperatorRole[] {
  return OPERATOR_PERMISSIONS[capability];
}

export function operatorCan(role: OperatorRole, capability: OperatorCapability): boolean {
  return (OPERATOR_PERMISSIONS[capability] as readonly OperatorRole[]).includes(role);
}

// Trang của cổng vận hành (khóa ở menu) và việc cần để thấy trang
export const OPERATOR_MENU_CAPABILITIES: Record<string, OperatorCapability> = {
  overview: 'overview.view',
  schools: 'schools.view',
  plans: 'plans.view',
  billing: 'billing.view',
  dashboard: 'overview.view',
  maintenance: 'maintenance.view',
  'parent-orgs': 'parent-orgs.view',
  ai: 'ai.view',
  catalog: 'catalog.view',
  operators: 'operators.manage',
  audit: 'audit.view',
};
