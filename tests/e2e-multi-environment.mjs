// Môi trường kiểm thử nhiều trường (DT-SaaS phần S1a, tài liệu 32 mục 14.7): cổng, cơ sở dữ liệu nền tảng riêng, các trường giả với
// tên miền con `*.e2e.localhost` (trình duyệt Chromium tự đưa mọi `*.localhost` về 127.0.0.1, không cần sửa tệp hosts). Cổng khác
// môi trường một trường nên hai bộ chạy không đụng nhau
export const E2E_MULTI_IDENTITY_PORT = 3211;
export const E2E_MULTI_API_PORT = 3210;
export const E2E_MULTI_PORTAL_PORT = 5383;
// Cổng nền tảng (DT-SaaS phần S2, spec 132)
export const E2E_MULTI_CONSOLE_PORT = 5384;
// Chợ gia sư (DT-27 phần 27f, spec 195): ứng dụng apps/market ở tên miền con dành riêng, cơ sở dữ liệu marketplace và vai trò riêng
export const E2E_MULTI_MARKET_PORT = 5387;
// Ứng dụng Gia sư của chợ (YCTD-262, spec 195)
export const E2E_MULTI_TUTOR_PORT = 5388;
export const E2E_ROOT_DOMAIN = 'e2e.localhost';
// Bí mật dùng chung của điểm tick bộ lập lịch (phần S1b); chỉ cho môi trường kiểm thử cục bộ
export const E2E_SCHEDULER_SECRET = 'e2e-scheduler-secret';
export const E2E_CONSOLE_HOST = `platform.${E2E_ROOT_DOMAIN}`;
export const E2E_MARKET_HOST = `cho-gia-su.${E2E_ROOT_DOMAIN}`;
export const E2E_TUTOR_HOST = `gia-su.${E2E_ROOT_DOMAIN}`;
export const E2E_MARKETPLACE_DATABASE_NAME = 'school_marketplace_e2e';
export const E2E_MARKETPLACE_ROLE = 'marketplace_e2e';
// Bí mật ký mã liên kết hồ sơ con với trường; chỉ cho môi trường kiểm thử cục bộ
export const E2E_MARKET_LINK_SECRET = 'e2e-bi-mat-lien-ket-cho-gia-su';
// Xác minh danh tính gia sư (DT-27 phần 27g, spec 196): nhà cung cấp OIDC giả lập của chợ do spec chạy ở cổng này; khóa mã hóa tệp giấy tờ
// cố định chỉ cho kiểm thử cục bộ (32 byte)
export const E2E_MARKET_OIDC_PORT = 3298;
export const E2E_MARKET_OIDC_CODE = 'gia-lap-cho';
export const E2E_MARKET_OIDC_CLIENT_ID = 'cho-gia-su-e2e';
export const E2E_MARKET_OIDC_CLIENT_SECRET = 'bi-mat-kiem-thu-cho-gia-su';
// 32 ký tự ASCII 'khoa-kiem-thu-tep-gia-su-e2e-32b' mã hóa base64
export const E2E_MARKET_FILES_KEY = 'a2hvYS1raWVtLXRodS10ZXAtZ2lhLXN1LWUyZS0zMmI=';
export const E2E_SCHOOL_CODES = ['alpha', 'beta'];
// Trường do spec 132 khởi tạo qua cổng nền tảng, spec 137 khôi phục từ bản sao lưu; bước dựng dọn sót của lần chạy trước
export const E2E_LIFECYCLE_SCHOOL_CODES = ['gamma', 'alpha-kp'];
export const E2E_PLATFORM_DATABASE_NAME = 'school_platform_e2e';
export const E2E_SHARED_DATABASE_NAME = 'school_shared_e2e';
export const E2E_MULTI_STATE_FILE = new URL('./.e2e-multi.json', import.meta.url);
// Bộ giả lập thông báo đẩy của máy chủ API ghi từng lần gửi vào tệp này (DT-26 phần 26b, spec 182; đẩy gốc 26g, spec 186)
export const E2E_PUSH_OUTBOX_FILE = new URL('./.e2e-push-outbox.jsonl', import.meta.url);

// Spec nhiều trường (số 130 đến 139 của các phần S1a đến S6, 140 của S9, 153 của DT-23 phần 23d và 160 của DT-24: đăng nhập theo đơn vị,
// quyền quản trị nền tảng; 182 của DT-26 phần 26b: cách ly đăng ký đẩy; 186 của phần 26g: cách ly mã thiết bị đẩy gốc) chỉ chạy ở dự
// án `multi`; dự án `single` (e2e hiện có) bỏ qua; 195 của DT-27 phần 27f: cách ly chợ gia sư với các trường
// 196 của phần 27g: xác minh, duyệt, tìm gia sư; 197 của phần 27h: đặt buổi, thanh toán giả lập, tranh chấp; 199 của phần 27j: phòng
// học video của chợ
export const MULTI_TENANT_SPEC = /[\\/]1(?:3\d|40|53|60|82|86|95|96|97|98|99)-[^\\/]*\.spec\.ts$/;

export function schoolHost(code) {
  return `${code}.${E2E_ROOT_DOMAIN}`;
}
