// Phần tính thuần của thư viện trường học (DT-22 phần 22a, YCTD-181; tài liệu 32 mục 13.4): ngày hạn, tiền phạt trễ hạn, mã
// số đăng ký cá biệt, số thẻ, chỉ tiêu báo cáo. Không đọc cơ sở dữ liệu, kiểm thử bằng bảng ví dụ

export const LIBRARY_RULE_CODE = 'YCTD-181';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(parseDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}

// Số ngày trễ hạn tính đến `until` (ngày trả hoặc hôm nay); chưa quá hạn là 0
export function overdueDays(dueOn: string, until: string): number {
  return Math.max(0, Math.round((parseDate(until) - parseDate(dueOn)) / DAY_MS));
}

// Tiền phạt trễ hạn: số ngày trễ nhân mức phạt mỗi ngày của loại bạn đọc; mức 0 là không phạt
export function lateFine(finePerDay: number, dueOn: string, until: string): number {
  return finePerDay > 0 ? overdueDays(dueOn, until) * finePerDay : 0;
}

// Số đăng ký cá biệt của bản sao và số thẻ bạn đọc cấp từ bộ đếm, đủ 6 chữ số
export function copyNumber(sequence: number): string {
  return `SH-${String(sequence).padStart(6, '0')}`;
}

export function cardNumber(sequence: number): string {
  return `TV-${String(sequence).padStart(6, '0')}`;
}

// Mã quét được: bỏ khoảng trắng, đổi sang chữ hoa; máy quét mã vạch hay thêm ký tự xuống dòng
export function normalizeScannedCode(value: string): string {
  return value.trim().toUpperCase();
}

export interface IndicatorInput {
  students: number;
  teachers: number;
  textbookCopies: number;
  referenceCopies: number;
  teacherBookCopies: number;
  totalCopies: number;
  activeTitles: number;
  digitalTitles: number;
  readersWithLoan: number;
}

export const INDICATOR_CODES = [
  'textbooks_per_student',
  'reference_per_student',
  'teacher_books_per_teacher',
  'titles_total',
  'copies_per_student',
  'reader_rate',
  'digital_titles',
] as const;
export type IndicatorCode = (typeof INDICATOR_CODES)[number];

const ratio = (top: number, bottom: number) => (bottom > 0 ? Math.round((top / bottom) * 100) / 100 : null);

// Giá trị đo của từng chỉ tiêu; chia cho 0 thì không đo được (null)
export function indicatorValues(input: IndicatorInput): Record<IndicatorCode, number | null> {
  return {
    textbooks_per_student: ratio(input.textbookCopies, input.students),
    reference_per_student: ratio(input.referenceCopies, input.students),
    teacher_books_per_teacher: ratio(input.teacherBookCopies, input.teachers),
    titles_total: input.activeTitles,
    copies_per_student: ratio(input.totalCopies, input.students),
    reader_rate: input.students + input.teachers > 0 ? ratio(input.readersWithLoan * 100, input.students + input.teachers) : null,
    digital_titles: input.digitalTitles,
  };
}

// Đạt khi đo được và không thấp hơn ngưỡng; chưa đặt ngưỡng hoặc chưa đo được thì không kết luận (null)
export function indicatorPassed(value: number | null, threshold: number | null): boolean | null {
  if (value === null || threshold === null) {
    return null;
  }
  return value >= threshold;
}

// Kết quả kiểm kê: bản chưa quét còn lẽ ra có ở kệ (tốt, không đang mượn) là thiếu; bản quét được mà đang mượn, đã mất hoặc
// đã thanh lý là thừa (sai lệch cần xem lại); bản quét được ở tình trạng hỏng ghi riêng
export interface StocktakeCopy {
  id: string;
  condition: 'good' | 'damaged' | 'lost' | 'disposed';
  onLoan: boolean;
  scanned: boolean;
}

export function stocktakeResult(copies: StocktakeCopy[]) {
  const missing: string[] = [];
  const surplus: string[] = [];
  const damaged: string[] = [];
  let found = 0;
  for (const copy of copies) {
    if (copy.scanned) {
      found += 1;
      if (copy.onLoan || copy.condition === 'lost' || copy.condition === 'disposed') {
        surplus.push(copy.id);
      } else if (copy.condition === 'damaged') {
        damaged.push(copy.id);
      }
    } else if (copy.condition !== 'lost' && copy.condition !== 'disposed' && !copy.onLoan) {
      missing.push(copy.id);
    }
  }
  return { found, missing, surplus, damaged };
}
