// Môi trường kiểm thử nhiều trường (DT-SaaS phần S1a, tài liệu 32 mục 14.7): cổng, cơ sở dữ liệu nền tảng riêng, các trường giả với
// tên miền con `*.e2e.localhost` (trình duyệt Chromium tự đưa mọi `*.localhost` về 127.0.0.1, không cần sửa tệp hosts). Cổng khác
// môi trường một trường nên hai bộ chạy không đụng nhau
export const E2E_MULTI_IDENTITY_PORT = 3211;
export const E2E_MULTI_API_PORT = 3210;
export const E2E_MULTI_PORTAL_PORT = 5383;
// Cổng nền tảng (DT-SaaS phần S2, spec 132)
export const E2E_MULTI_CONSOLE_PORT = 5384;
export const E2E_ROOT_DOMAIN = 'e2e.localhost';
// Bí mật dùng chung của điểm tick bộ lập lịch (phần S1b); chỉ cho môi trường kiểm thử cục bộ
export const E2E_SCHEDULER_SECRET = 'e2e-scheduler-secret';
export const E2E_CONSOLE_HOST = `platform.${E2E_ROOT_DOMAIN}`;
export const E2E_SCHOOL_CODES = ['alpha', 'beta'];
// Trường do spec 132 khởi tạo qua cổng nền tảng, spec 137 khôi phục từ bản sao lưu; bước dựng dọn sót của lần chạy trước
export const E2E_LIFECYCLE_SCHOOL_CODES = ['gamma', 'alpha-kp'];
export const E2E_PLATFORM_DATABASE_NAME = 'school_platform_e2e';
export const E2E_SHARED_DATABASE_NAME = 'school_shared_e2e';
export const E2E_MULTI_STATE_FILE = new URL('./.e2e-multi.json', import.meta.url);

// Spec nhiều trường (số 130 đến 139 của các phần S1a đến S6, 140 của S9 và 153 của DT-23 phần 23d) chỉ chạy ở dự án `multi`; dự án
// `single` (e2e hiện có) bỏ qua
export const MULTI_TENANT_SPEC = /[\\/]1(?:3\d|40|53)-[^\\/]*\.spec\.ts$/;

export function schoolHost(code) {
  return `${code}.${E2E_ROOT_DOMAIN}`;
}
