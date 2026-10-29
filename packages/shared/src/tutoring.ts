import type { SchoolLevelCode } from './school-levels.js';

// Gia sư trong trường (DT-27 phần 27b, YCTD-252; tài liệu 47 mục 19.2, 19.5): nhãn và các hàm thuần của quy định dạy thêm dùng chung
// cho máy chủ API (kiểm ở máy chủ, có kiểm thử đơn vị theo từng dòng của bảng 19.2) và giao diện (giải thích ngay trên màn hình).
// Căn cứ: Thông tư 29/2024/TT-BGDĐT sửa đổi bởi Thông tư 19/2026/TT-BGDĐT (hiệu lực 15/05/2026); số liệu là dữ liệu có ngày hiệu
// lực ở `tutoring_rules`, không ghi cứng ở đây
export type TutoringContentType = 'curriculum' | 'enrichment';
export type TutoringAudience = 'below_standard' | 'gifted' | 'final_year_review';
export type TutoringDelivery = 'live_video' | 'course' | 'qa' | 'mixed';
export type TutoringProgramStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'closed';
export type TutoringRegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type TutoringAttendanceStatus = 'present' | 'late' | 'left_early' | 'absent';

export const TUTORING_CONTENT_TYPE_LABELS: Record<TutoringContentType, string> = {
  curriculum: 'Môn học trong chương trình (dạy thêm, theo Thông tư 29)',
  enrichment: 'Bổ trợ ngoài chương trình môn học',
};

// Giải thích hiện ngay dưới ô chọn loại nội dung
export const TUTORING_CONTENT_TYPE_HELP: Record<TutoringContentType, string> = {
  curriculum:
    'Dạy thêm môn học trong Chương trình giáo dục phổ thông: trong nhà trường không thu tiền, chỉ cho học sinh thuộc nhóm đối tượng, mỗi môn không quá số tiết mỗi tuần theo quy định, không tổ chức cho học sinh tiểu học.',
  enrichment:
    'Văn hóa, nghệ thuật, thể thao, ngoại ngữ tăng cường, STEM, năng lực số, kỹ năng sống... không thuộc nội dung chương trình môn học nên không thuộc phạm vi Thông tư 29.',
};

export const TUTORING_AUDIENCE_LABELS: Record<TutoringAudience, string> = {
  below_standard: 'Kết quả môn học cuối kỳ liền kề chưa đạt',
  gifted: 'Được chọn bồi dưỡng học sinh giỏi',
  final_year_review: 'Lớp cuối cấp tự nguyện ôn thi',
};

export const TUTORING_DELIVERY_LABELS: Record<TutoringDelivery, string> = {
  live_video: 'Lớp video trực tiếp',
  course: 'Khoá học',
  qa: 'Hỏi đáp',
  mixed: 'Kết hợp',
};

export const TUTORING_PROGRAM_STATUS_LABELS: Record<TutoringProgramStatus, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt, mở đăng ký',
  rejected: 'Không duyệt',
  closed: 'Đã đóng',
};

export const TUTORING_REGISTRATION_STATUS_LABELS: Record<TutoringRegistrationStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Không duyệt',
  withdrawn: 'Đã rút',
};

export const TUTORING_ATTENDANCE_LABELS: Record<TutoringAttendanceStatus, string> = {
  present: 'Có mặt',
  late: 'Vào muộn',
  left_early: 'Về sớm',
  absent: 'Vắng',
};

export interface TutoringRuleSet {
  effectiveFrom: string;
  maxCurriculumPeriodsPerWeek: number;
  curriculumBlockedLevels: SchoolLevelCode[];
  defaultPeriodMinutes: Partial<Record<SchoolLevelCode, number>>;
}

export interface TutoringRuleViolation {
  code:
    | 'curriculum_fee'
    | 'curriculum_audience'
    | 'curriculum_subject'
    | 'curriculum_level'
    | 'weekly_periods'
    | 'timetable_teacher'
    | 'timetable_class';
  message: string;
}

// Quy tắc của chương trình (bảng 19.2 dòng 1, 2, 4): chỉ `curriculum` chịu khóa
export function programRuleViolations(
  program: {
    contentType: TutoringContentType;
    chargesFee: boolean;
    audience: TutoringAudience | null;
    subjectId: string | null;
    schoolLevel: SchoolLevelCode;
  },
  rules: TutoringRuleSet,
): TutoringRuleViolation[] {
  if (program.contentType !== 'curriculum') {
    return [];
  }
  const violations: TutoringRuleViolation[] = [];
  if (program.chargesFee) {
    violations.push({
      code: 'curriculum_fee',
      message: 'Dạy thêm môn học trong nhà trường không được thu tiền của học sinh',
    });
  }
  if (!program.audience) {
    violations.push({
      code: 'curriculum_audience',
      message: 'Chọn nhóm đối tượng: chưa đạt môn học kỳ liền kề, bồi dưỡng học sinh giỏi hoặc lớp cuối cấp ôn thi',
    });
  }
  if (!program.subjectId) {
    violations.push({ code: 'curriculum_subject', message: 'Dạy thêm môn học phải chọn môn' });
  }
  if (rules.curriculumBlockedLevels.includes(program.schoolLevel)) {
    violations.push({
      code: 'curriculum_level',
      message:
        'Không tổ chức dạy thêm môn học cho học sinh tiểu học; chọn loại bổ trợ ngoài chương trình nếu là nghệ thuật, thể thao, kỹ năng sống',
    });
  }
  return violations;
}

// Ngày dạng yyyy-mm-dd; thứ theo ISO (1 là thứ Hai, 7 là Chủ nhật)
const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);

export function isoWeekday(date: string): number {
  const day = new Date(toTime(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

// Ngày thứ Hai của tuần chứa ngày
export function weekStart(date: string): string {
  return toDate(toTime(date) - (isoWeekday(date) - 1) * DAY);
}

// Các ngày từ `from` đến `to` rơi vào các thứ đã chọn (tối đa 200 buổi một lần lặp)
export function weeklyDates(from: string, to: string, weekdays: number[]): string[] {
  const dates: string[] = [];
  for (let time = toTime(from); time <= toTime(to) && dates.length < 200; time += DAY) {
    const date = toDate(time);
    if (weekdays.includes(isoWeekday(date))) {
      dates.push(date);
    }
  }
  return dates;
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}

// Số tiết quy đổi của một buổi: làm tròn lên theo độ dài một tiết của cấp
export function periodsForSession(startTime: string, endTime: string, periodMinutes: number): number {
  const minutes = minutesOf(endTime) - minutesOf(startTime);
  return Math.max(1, Math.ceil(minutes / Math.max(1, periodMinutes)));
}

export function timesOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return minutesOf(a.start) < minutesOf(b.end) && minutesOf(b.start) < minutesOf(a.end);
}

export interface WeeklyLoad {
  childId: string;
  subjectId: string;
  week: string;
  periods: number;
}

// Giới hạn số tiết mỗi tuần mỗi môn mỗi học sinh (bảng 19.2 dòng 3): cộng mọi buổi `curriculum` cùng môn của học sinh trong tuần;
// học sinh có quyết định tăng thời lượng của Sở cho môn đó thì theo số của quyết định
export function weeklyLoadViolations(
  loads: WeeklyLoad[],
  limit: number,
  exemptions: Array<{ childId: string; subjectId: string; maxPeriods: number }>,
): Array<WeeklyLoad & { limit: number }> {
  const totals = new Map<string, WeeklyLoad>();
  for (const load of loads) {
    const key = `${load.childId}|${load.subjectId}|${load.week}`;
    const current = totals.get(key);
    totals.set(key, current ? { ...current, periods: current.periods + load.periods } : { ...load });
  }
  const over: Array<WeeklyLoad & { limit: number }> = [];
  for (const total of totals.values()) {
    const exempt = exemptions
      .filter((item) => item.childId === total.childId && item.subjectId === total.subjectId)
      .reduce((max, item) => Math.max(max, item.maxPeriods), 0);
    const allowed = Math.max(limit, exempt);
    if (total.periods > allowed) {
      over.push({ ...total, limit: allowed });
    }
  }
  return over;
}

// Điểm danh gợi ý từ nhật ký vào ra phòng (chỗ nối của 27a): không vào là vắng; vào sau giờ bắt đầu quá ngưỡng là muộn; ra trước giờ
// kết thúc quá ngưỡng là về sớm; giáo viên xác nhận hoặc sửa
export function attendanceFromRoomEvents(
  events: Array<{ kind: 'join' | 'leave'; at: Date }>,
  session: { date: string; startTime: string; endTime: string },
  thresholds: { lateMinutes: number; earlyLeaveMinutes: number } = { lateMinutes: 10, earlyLeaveMinutes: 10 },
): { status: TutoringAttendanceStatus; joinedAt: Date | null; leftAt: Date | null } {
  const sorted = [...events].sort((left, right) => left.at.getTime() - right.at.getTime());
  const firstJoin = sorted.find((event) => event.kind === 'join')?.at ?? null;
  if (!firstJoin) {
    return { status: 'absent', joinedAt: null, leftAt: null };
  }
  const last = sorted.at(-1) as { kind: 'join' | 'leave'; at: Date };
  const leftAt = last.kind === 'leave' ? last.at : null;
  // Giờ của buổi theo giờ Việt Nam (UTC+7)
  const at = (time: string) => new Date(`${session.date}T${time}:00+07:00`).getTime();
  if (firstJoin.getTime() > at(session.startTime) + thresholds.lateMinutes * 60_000) {
    return { status: 'late', joinedAt: firstJoin, leftAt };
  }
  if (leftAt && leftAt.getTime() < at(session.endTime) - thresholds.earlyLeaveMinutes * 60_000) {
    return { status: 'left_early', joinedAt: firstJoin, leftAt };
  }
  return { status: 'present', joinedAt: firstJoin, leftAt };
}
