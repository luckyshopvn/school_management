// Mã hóa AES-256-GCM dùng chung đã chuyển sang gói máy chủ dùng chung (DT-SaaS phần S1a) để gói cơ sở dữ liệu cũng mã hóa được
// mật khẩu kết nối của từng trường
export { decryptSecret, encryptSecret } from '@school-management/server';
