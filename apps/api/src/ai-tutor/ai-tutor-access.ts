// Điểm kiểm tra khóa duy nhất của gia sư AI (YCTD-383 lát L2, lát L3). Mọi lời gọi gia sư của em đi qua `aiTutorAccess`: trang của em
// hiện lý do, máy chủ từ chối gửi câu hỏi khi không được dùng (kiểm trước khi giữ lượt nên câu bị khóa không trừ lượt). Lát L3 (Q7) thêm:
// - đang thi: em có lượt làm bài kiểm tra trực tuyến chưa hết giờ, có tên trong phòng thi đang mở, hoặc bài kiểm tra trực tuyến giao cho
//   em đang mở mà em còn lượt làm;
// - bài tập không dùng AI: em có bài tập giáo viên đánh dấu `ai_blocked` đang mở với em (em còn nộp được);
// - khung giờ khóa của trường theo giờ Việt Nam (mặc định 22:00 đến 6:00).
// Thứ tự ưu tiên khi nhiều khóa cùng lúc: chỉ đọc, đang thi, bài tập, khung giờ
export type AiTutorLockCode = 'read_only' | 'exam' | 'assignment' | 'quiet_hours';

export interface AiTutorAccessInput {
  // Phiên xem hỗ trợ của quản trị nền tảng (YCTD-315b) chỉ đọc
  readOnly: boolean;
  // Tên bài kiểm tra trực tuyến em đang làm hoặc đang mở cho em; không có thì null
  exam: { title: string } | null;
  // Tên bài tập không dùng AI đang mở với em; không có thì null
  blockedAssignment: { title: string } | null;
  // Khung giờ khóa của trường dạng HH:MM giờ Việt Nam; giờ bắt đầu lớn hơn giờ kết thúc là khung qua nửa đêm
  quietStart: string;
  quietEnd: string;
  now: Date;
}

export type AiTutorAccess =
  { allowed: true } | { allowed: false; code: AiTutorLockCode; title: string; message: string };

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

// Phút trong ngày theo giờ Việt Nam (UTC+7, không có giờ mùa hè)
export function vietnamMinuteOfDay(moment: Date): number {
  const local = new Date(moment.getTime() + VIETNAM_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

// Trong khung giờ khóa: tính cả phút bắt đầu, không tính phút kết thúc (22:00 khóa, 6:00 mở)
export function isQuietTime(moment: Date, quietStart: string, quietEnd: string): boolean {
  const start = minutesOf(quietStart);
  const end = minutesOf(quietEnd);
  const current = vietnamMinuteOfDay(moment);
  if (start === end) {
    return false;
  }
  return start < end ? current >= start && current < end : current >= start || current < end;
}

// "06:00" thành "6:00" như bản mẫu MH-597
function displayTime(time: string): string {
  return time.replace(/^0(\d)/, '$1');
}

export function aiTutorAccess(input: AiTutorAccessInput): AiTutorAccess {
  if (input.readOnly) {
    return {
      allowed: false,
      code: 'read_only',
      title: 'Phiên xem hỗ trợ.',
      message: 'Phiên xem hỗ trợ chỉ đọc, không gửi câu hỏi cho gia sư AI',
    };
  }
  if (input.exam) {
    return {
      allowed: false,
      code: 'exam',
      title: 'Đang trong giờ kiểm tra.',
      message: `Gia sư AI tạm khóa đến khi em nộp bài ${input.exam.title}.`,
    };
  }
  if (input.blockedAssignment) {
    return {
      allowed: false,
      code: 'assignment',
      title: 'Bài tập này không dùng AI.',
      message: `Thầy cô đã đánh dấu bài "${input.blockedAssignment.title}" là bài tự làm. Gia sư AI mở lại khi em nộp bài hoặc bài đóng.`,
    };
  }
  if (isQuietTime(input.now, input.quietStart, input.quietEnd)) {
    return {
      allowed: false,
      code: 'quiet_hours',
      title: 'Ngoài giờ dùng.',
      message: `Gia sư AI mở lại lúc ${displayTime(input.quietEnd)}.`,
    };
  }
  return { allowed: true };
}
