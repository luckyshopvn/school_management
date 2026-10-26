// Chọn tiết đang dạy cho chế độ lớp học (DT-26 phần 26d, YCTD-234). Hàm thuần, không nhập gì, để kiểm thử đơn vị bằng node --test.
// Dữ liệu từ `GET /api/v1/timetables/mine`: tiết theo thứ (1 là thứ Hai, 7 là Chủ nhật), số tiết, tên lớp; giờ tiết theo cấp học
export interface TimetableLesson {
  class_name: string;
  weekday: number;
  period_no: number;
  subject_name: string;
}

export interface PeriodSlot {
  period_no: number;
  start_time: string;
  end_time: string;
}

export interface CurrentLesson {
  lesson: TimetableLesson;
  slot: PeriodSlot;
  // 'now': đang trong giờ tiết; 'next': tiết sắp tới gần nhất trong ngày
  when: 'now' | 'next';
}

// Giờ Việt Nam của một thời điểm: thứ (1 đến 7, thứ Hai là 1) và số phút từ 0 giờ
export function vietnamClock(now: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(read('weekday')) + 1;
  return { weekday, minutes: Number(read('hour')) * 60 + Number(read('minute')) };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

// Tiết đang dạy, không có thì tiết sắp tới trong ngày; hết tiết trong ngày thì không có
export function currentLesson(
  lessons: TimetableLesson[],
  slots: PeriodSlot[],
  clock: { weekday: number; minutes: number },
): CurrentLesson | undefined {
  const today = lessons
    .filter((lesson) => lesson.weekday === clock.weekday)
    .map((lesson) => ({ lesson, slot: slots.find((slot) => slot.period_no === lesson.period_no) }))
    .filter((item): item is { lesson: TimetableLesson; slot: PeriodSlot } => item.slot !== undefined)
    .sort((left, right) => toMinutes(left.slot.start_time) - toMinutes(right.slot.start_time));
  const running = today.find(
    (item) => toMinutes(item.slot.start_time) <= clock.minutes && clock.minutes < toMinutes(item.slot.end_time),
  );
  if (running) {
    return { ...running, when: 'now' };
  }
  const next = today.find((item) => toMinutes(item.slot.start_time) > clock.minutes);
  return next ? { ...next, when: 'next' } : undefined;
}
