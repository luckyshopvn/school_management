// Chính sách trường của các tuyến công khai của dịch vụ định danh (DT-SaaS phần S1a, tài liệu 47 mục 14.7 lớp 3): tuyến không đòi mã
// phiên của đúng trường phải khai ở đây kèm lý do; kiểm thử ma trận cách ly tự liệt kê tuyến và đối chiếu danh sách này
export interface PublicRoute {
  method: string;
  path: string;
  reason: string;
}

const SIGN_IN =
  'Đăng nhập, mã xác nhận, mã một lần, đặt lại mật khẩu: công khai theo tên miền của trường (tài khoản và Redis của đúng trường), có giới hạn tần suất';
const PLATFORM =
  'Cổng vận hành nền tảng: không thuộc trường nào, chỉ phục vụ ở tên miền PLATFORM_CONSOLE_HOST (tên miền khác 404), mã phiên vận hành có đối tượng riêng';

const SUPPORT =
  'Đổi đường liên kết hỗ trợ lấy phiên đăng nhập (DT-SaaS S4): công khai theo tên miền của trường, cần mã một lần (chỉ lưu mã băm, hạn 5 phút) của đúng trường và trường đang cho phép hỗ trợ';

const PARENT_ORG =
  'Tài khoản cấp trên (Bộ, Sở, Phòng; DT-SaaS S6): không thuộc trường nào, chỉ phục vụ ở tên miền PLATFORM_CONSOLE_HOST (tên miền khác 404), mã phiên cấp trên có đối tượng riêng, xác thực hai lớp bắt buộc';

const ACTIVATE =
  'Kích hoạt quản trị viên đầu tiên của trường mới (DT-SaaS S2): công khai theo tên miền của trường, cần mã kích hoạt một lần (chỉ lưu mã băm, hạn 72 giờ), có giới hạn tần suất';

const DIRECTORY =
  'Ô chọn đơn vị và đăng nhập theo đơn vị ở tên miền chung (DT-24): không thuộc trường nào, chỉ phục vụ ở PLATFORM_ROOT_DOMAIN (tên miền khác 404), chỉ đọc danh mục công khai có phân trang và giới hạn tần suất; đăng nhập chạy trong ngữ cảnh của đúng trường đã chọn';

const PREPARE =
  'Khởi tạo đơn vị ở lần chọn đầu tiên trên trang đăng nhập (YCTD-314): chỉ phục vụ ở PLATFORM_ROOT_DOMAIN (tên miền khác 404), chỉ nhận mã Bộ có trong danh mục, không trả dữ liệu của trường; giới hạn theo địa chỉ mạng và số trường tự khởi tạo mỗi giờ trên toàn nền tảng';

const HANDOFF =
  'Đổi mã chuyển phiên sau đăng nhập theo đơn vị (DT-24): công khai theo tên miền của trường, cần mã một lần của đúng trường (chỉ lưu mã băm ở cơ sở dữ liệu định danh của trường, hạn 2 phút)';

const EXTERNAL =
  'Đăng nhập bằng nhà cung cấp định danh bên ngoài (DT-25): công khai theo tên miền của trường (cấu hình, liên kết và Redis của đúng trường), state và vé nhập mã dùng một lần có hạn, có giới hạn tần suất; lượt liên kết còn cần mã phiên của đúng phiên đã bắt đầu';

export const PUBLIC_ROUTES: PublicRoute[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    reason: 'Kiểm tra sức khỏe do máy chủ chuyển tiếp gọi bằng địa chỉ nội bộ, không cần trường, không trả dữ liệu',
  },
  { method: 'GET', path: '/api/v1/auth/login-options', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/captcha', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/login', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/otp/login', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/otp/request', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/password-reset/confirm', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/password-reset/request', reason: SIGN_IN },
  { method: 'POST', path: '/api/v1/auth/platform/login', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/me', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/password', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/operators', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/operators', reason: PLATFORM },
  { method: 'PATCH', path: '/api/v1/auth/platform/operators/:id', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/operators/:id/totp-reset', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/schools', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/schools/settings', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/schools/:code', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/jobs/:id/resume', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/jobs/:id/rollback', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/suspend', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/resume', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/request-deletion', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/cancel-deletion', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/invitation', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/consents', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/hosting', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/data-class', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/domains', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/domains/:host/verify', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/activate', reason: ACTIVATE },
  { method: 'POST', path: '/api/v1/auth/activate', reason: ACTIVATE },
  // Gói dịch vụ ở cổng nền tảng (DT-SaaS phần S5a): cùng điều kiện tên miền cổng và mã phiên vận hành
  { method: 'GET', path: '/api/v1/auth/platform/plan-modules', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/plans', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/plans', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/plans/:id', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/plan-schools', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/plan-schools/:id', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/plan-lifecycle', reason: PLATFORM },
  // Thu phí ở cổng nền tảng (DT-SaaS phần S5b): cùng điều kiện tên miền cổng và mã phiên vận hành
  { method: 'GET', path: '/api/v1/auth/platform/billing', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/billing/settings', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/billing/connectors/:connector', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/billing/price-rules', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/billing/price-rules', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/billing/price-rules/:id', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/billing/invoices', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/billing/invoices', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/billing/invoices/:id', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/billing/invoices/:id/:action', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/billing/payments/:id/assign', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/billing/schools/:id/free-period', reason: PLATFORM },
  // Bảng điều khiển nền tảng, thông báo bảo trì, phiên hỗ trợ (DT-SaaS phần S4): cùng điều kiện tên miền cổng và mã phiên vận hành
  { method: 'GET', path: '/api/v1/auth/platform/dashboard', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/dashboard/errors', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/service-status', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/maintenance-notices', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/maintenance-notices', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/maintenance-notices/:id/cancel', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/schools/:code/support', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/support-sessions', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/support-sessions/:id/end', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/support/exchange', reason: SUPPORT },
  // Trợ lý AI của nền tảng (DT-23 phần 23d): khóa chung, nhà cung cấp, đơn giá theo gói, token đã dùng; cùng điều kiện tên miền cổng và mã phiên vận hành
  { method: 'GET', path: '/api/v1/auth/platform/ai', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/ai/settings', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/ai/key', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/ai/pricing/:planId', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/ai/usage', reason: PLATFORM },
  // Đơn vị cấp trên (DT-SaaS phần S6): cây đơn vị, tài khoản cấp trên ở cổng nền tảng; tài khoản cấp trên đăng nhập ở tên miền cổng
  { method: 'GET', path: '/api/v1/auth/platform/admin-units', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/admin-units', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/admin-units/import', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/admin-units/:id', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/admin-units/:id/merge', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/admin-units/:id/split', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/schools/:code/admin-unit', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/parent-org-users', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/parent-org-users/:id/totp', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/parent-org-users/:id/status', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/parent-org/login', reason: PARENT_ORG },
  { method: 'GET', path: '/api/v1/auth/parent-org/me', reason: PARENT_ORG },
  { method: 'GET', path: '/api/v1/auth/parent-org/access-requests', reason: PARENT_ORG },
  { method: 'POST', path: '/api/v1/auth/parent-org/access-requests', reason: PARENT_ORG },
  { method: 'POST', path: '/api/v1/auth/parent-org/access-requests/:id/open', reason: PARENT_ORG },
  { method: 'POST', path: '/api/v1/auth/parent-org/access-requests/:id/withdraw', reason: PARENT_ORG },
  // Danh mục đơn vị toàn quốc, đăng nhập theo đơn vị, quyền quản trị nền tảng (DT-24)
  { method: 'GET', path: '/api/v1/auth/directory/context', reason: DIRECTORY },
  { method: 'GET', path: '/api/v1/auth/directory/departments', reason: DIRECTORY },
  { method: 'GET', path: '/api/v1/auth/directory/levels', reason: DIRECTORY },
  { method: 'GET', path: '/api/v1/auth/directory/communes', reason: DIRECTORY },
  { method: 'GET', path: '/api/v1/auth/directory/units', reason: DIRECTORY },
  { method: 'GET', path: '/api/v1/auth/directory/unit', reason: DIRECTORY },
  { method: 'POST', path: '/api/v1/auth/directory/captcha', reason: DIRECTORY },
  { method: 'POST', path: '/api/v1/auth/directory/login', reason: DIRECTORY },
  { method: 'POST', path: '/api/v1/auth/directory/prepare', reason: PREPARE },
  { method: 'POST', path: '/api/v1/auth/handoff/exchange', reason: HANDOFF },
  { method: 'GET', path: '/api/v1/auth/platform/catalog', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/catalog/units', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/catalog/unit', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/catalog/import', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/schools/:code/catalog-unit', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/catalog/units/:moet/open', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/schools/:code/addon-modules', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/audit-log', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/overview', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/captcha', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/login-page', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/login-page', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/support-policy', reason: PLATFORM },
  { method: 'PUT', path: '/api/v1/auth/platform/support-policy', reason: PLATFORM },
  // Đăng nhập bằng nhà cung cấp định danh bên ngoài (DT-25): danh sách nút, bắt đầu, quay về, nhập mã hai lớp
  { method: 'GET', path: '/api/v1/auth/external/providers', reason: EXTERNAL },
  { method: 'POST', path: '/api/v1/auth/external/:provider/start', reason: EXTERNAL },
  { method: 'POST', path: '/api/v1/auth/external/callback', reason: EXTERNAL },
  { method: 'POST', path: '/api/v1/auth/external/complete', reason: EXTERNAL },
];
