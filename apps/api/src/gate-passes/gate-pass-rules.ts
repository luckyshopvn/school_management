import { randomBytes } from 'node:crypto';
import type { AttendanceStatus, GatePassDirection, GatePassMethod } from '@school-management/database';

// Quy tắc của lượt qua cổng (YCTD-389), tách thành hàm thuần để kiểm thử không phụ thuộc giờ thật

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const GATE_CARD_CODE_PATTERN = /^[A-Z2-7]{16}$/;
// Hai lượt cùng hướng của một học sinh cách nhau không quá 5 phút là một lượt (quét lại, đi qua hai thiết bị)
export const DUPLICATE_WINDOW_MILLISECONDS = 5 * 60 * 1000;
// Phương thức có độ tin cậy tuyệt đối: lượt vào muộn từ đây được tự ghi "Đi muộn" (Eric duyệt ngày 2026-10-30)
export const CERTAIN_METHODS: readonly GatePassMethod[] = ['qr', 'rfid', 'device'];

const VIETNAM_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Mã thẻ 16 ký tự base32 (80 bit ngẫu nhiên), không chứa thông tin cá nhân
export function generateGateCardCode(): string {
  const bytes = randomBytes(16);
  let code = '';
  for (const byte of bytes) {
    code += BASE32_ALPHABET[byte % 32];
  }
  return code;
}

// Chuẩn hóa mã đọc từ thẻ hoặc gõ tay: bỏ khoảng trắng, gạch nối, đổi chữ hoa
export function normalizeGateCardCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

// Giờ phút theo giờ Việt Nam, dạng HH:MM
export function vietnamTimeOfDay(moment: Date): string {
  return VIETNAM_TIME.format(moment);
}

export function isDuplicatePass(
  previous: { direction: GatePassDirection; passed_at: Date } | undefined,
  direction: GatePassDirection,
  passedAt: Date,
): boolean {
  return (
    previous !== undefined &&
    previous.direction === direction &&
    Math.abs(passedAt.getTime() - previous.passed_at.getTime()) <= DUPLICATE_WINDOW_MILLISECONDS
  );
}

// Gợi ý trạng thái điểm danh từ lượt vào đầu tiên trong ngày: vào trước hoặc đúng giờ bắt đầu học là có mặt, sau là đi muộn.
// Không có lượt vào thì không gợi ý (không bao giờ gợi ý vắng)
export function suggestAttendanceStatus(firstIn: Date | null, schoolStartTime: string): AttendanceStatus | null {
  if (!firstIn) {
    return null;
  }
  return vietnamTimeOfDay(firstIn) <= schoolStartTime ? 'present' : 'late';
}

// Tự ghi "Đi muộn" khi: lượt vào, phương thức tuyệt đối, ngày học, sau giờ bắt đầu học, học sinh chưa có điểm danh trong ngày
// (không ghi đè điểm danh của giáo viên)
export function shouldAutoMarkLate(input: {
  direction: GatePassDirection;
  method: GatePassMethod;
  passedAt: Date;
  schoolStartTime: string;
  isSchoolDay: boolean;
  hasAttendanceRecord: boolean;
}): boolean {
  return (
    input.direction === 'in' &&
    CERTAIN_METHODS.includes(input.method) &&
    input.isSchoolDay &&
    !input.hasAttendanceRecord &&
    vietnamTimeOfDay(input.passedAt) > input.schoolStartTime
  );
}
