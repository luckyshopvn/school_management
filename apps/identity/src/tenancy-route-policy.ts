// Chính sách trường của các tuyến công khai của dịch vụ định danh (DT-SaaS phần S1a, tài liệu 32 mục 14.7 lớp 3): tuyến không đòi mã
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

const ACTIVATE =
  'Kích hoạt quản trị viên đầu tiên của trường mới (DT-SaaS S2): công khai theo tên miền của trường, cần mã kích hoạt một lần (chỉ lưu mã băm, hạn 72 giờ), có giới hạn tần suất';

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
  { method: 'GET', path: '/api/v1/auth/platform/maintenance-notices', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/maintenance-notices', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/maintenance-notices/:id/cancel', reason: PLATFORM },
  { method: 'GET', path: '/api/v1/auth/platform/schools/:code/support', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/schools/:code/support-sessions', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/platform/support-sessions/:id/end', reason: PLATFORM },
  { method: 'POST', path: '/api/v1/auth/support/exchange', reason: SUPPORT },
];
