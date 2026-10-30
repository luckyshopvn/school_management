// Điểm kiểm tra khóa duy nhất của gia sư AI (YCTD-383 lát L2). Mọi lời gọi gia sư của em đi qua `aiTutorAccess`: trang của em hiện lý do,
// máy chủ từ chối gửi câu hỏi khi không được dùng. Lát L3 thêm khóa khi em đang làm bài kiểm tra, bài tập giáo viên đánh dấu không dùng
// AI, khung giờ của trường (Q7) bằng cách thêm trường vào `AiTutorAccessInput` và thêm điều kiện ở đây, không rẽ nhánh ở nơi khác
export type AiTutorLockCode = 'read_only';

export interface AiTutorAccessInput {
  // Phiên xem hỗ trợ của quản trị nền tảng (YCTD-315b) chỉ đọc
  readOnly: boolean;
}

export type AiTutorAccess = { allowed: true } | { allowed: false; code: AiTutorLockCode; message: string };

export function aiTutorAccess(input: AiTutorAccessInput): AiTutorAccess {
  if (input.readOnly) {
    return { allowed: false, code: 'read_only', message: 'Phiên xem hỗ trợ chỉ đọc, không gửi câu hỏi cho gia sư AI' };
  }
  return { allowed: true };
}
