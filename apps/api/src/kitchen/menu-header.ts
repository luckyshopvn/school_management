import type { FieldError } from '@school-management/server';
import type { RequestBody } from '../common/request-fields.js';
import { addDays, readDate, readText, weekStartOf } from './kitchen-fields.js';

// Thông tin chung của thực đơn theo màn hình 4.5 của Sở (DT-16 phần 16h): tên thực đơn, tháng, tuần, từ ngày–đến ngày, khối
// áp dụng. Thực đơn vẫn theo tuần (món ghi theo thứ trong tuần, duyệt và công bố như trước): từ ngày, đến ngày nằm trong
// một tuần từ thứ hai đến chủ nhật; khối áp dụng trống là mọi khối. Hàm thuần, không đọc cơ sở dữ liệu
export const ALL_AGES = 'all';
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAXIMUM_NAME = 200;

export interface MenuHeaderInput {
  name: string | null;
  month: string | null;
  week_no: number | null;
  from_date: string | null;
  to_date: string | null;
  grade_levels: string[] | null;
  // Cách gọi cũ: tuần bắt đầu và một độ tuổi (all hoặc mã khối)
  week_start_date: string | null;
  age_group: string | null;
}

export interface MenuHeader {
  name: string;
  month: string;
  week_no: number | null;
  week_start_date: string;
  from_date: string;
  to_date: string;
  grade_levels: string[];
  age_group: string;
}

const formatDate = (date: string) => date.split('-').reverse().join('/');

// Đọc tháng dạng YYYY-MM hoặc MM/YYYY
export function parseMonth(text: string): string | null {
  const value = text.trim();
  if (MONTH_PATTERN.test(value)) {
    return value;
  }
  const match = /^(\d{1,2})[/-](\d{4})$/.exec(value);
  if (!match) {
    return null;
  }
  const month = `${match[2]}-${(match[1] ?? '').padStart(2, '0')}`;
  return MONTH_PATTERN.test(month) ? month : null;
}

// Đọc danh sách mã khối: mảng chữ hoặc chuỗi cách nhau bằng dấu phẩy, chấm phẩy
export function parseGradeLevels(value: unknown): string[] | null {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;]/) : null;
  if (list === null || list.some((item) => typeof item !== 'string')) {
    return null;
  }
  return [...new Set((list as string[]).map((item) => item.trim()).filter((item) => item !== ''))].sort();
}

export function readMenuHeader(body: RequestBody, errors: FieldError[]): MenuHeaderInput {
  const name = readText(body, 'name', errors);
  if (name !== null && name.length > MAXIMUM_NAME) {
    errors.push({ field: 'name', message: `Tên thực đơn tối đa ${MAXIMUM_NAME} ký tự` });
  }
  const rawMonth = body?.month;
  let month: string | null = null;
  if (rawMonth !== undefined && rawMonth !== null && rawMonth !== '') {
    month = typeof rawMonth === 'string' ? parseMonth(rawMonth) : null;
    if (month === null) {
      errors.push({ field: 'month', message: 'Tháng dạng YYYY-MM hoặc MM/YYYY' });
    }
  }
  const rawWeek = body?.week_no;
  let weekNo: number | null = null;
  if (rawWeek !== undefined && rawWeek !== null && rawWeek !== '') {
    const number = typeof rawWeek === 'number' ? rawWeek : Number(rawWeek);
    if (!Number.isInteger(number) || number < 1 || number > 60) {
      errors.push({ field: 'week_no', message: 'Tuần là số nguyên từ 1 đến 60' });
    } else {
      weekNo = number;
    }
  }
  const rawGrades = body?.grade_levels;
  let grades: string[] | null = null;
  if (rawGrades !== undefined && rawGrades !== null) {
    grades = parseGradeLevels(rawGrades);
    if (grades === null) {
      errors.push({ field: 'grade_levels', message: 'Khối áp dụng là danh sách mã khối' });
    }
  }
  return {
    name,
    month,
    week_no: weekNo,
    from_date: readDate(body, 'from_date', errors, false),
    to_date: readDate(body, 'to_date', errors, false),
    grade_levels: grades,
    week_start_date: readDate(body, 'week_start_date', errors, false),
    age_group: readText(body, 'age_group', errors),
  };
}

// Tính thông tin chung đầy đủ: thiếu từ ngày thì theo tuần bắt đầu; thiếu đến ngày là chủ nhật của tuần; thiếu tháng là
// tháng của từ ngày; thiếu tên là "Thực đơn tuần dd/mm/yyyy"; khối áp dụng theo độ tuổi cũ khi không gửi khối
export function resolveMenuHeader(input: MenuHeaderInput, weekNo: (weekStart: string) => number | null) {
  const errors: FieldError[] = [];
  const fromDate = input.from_date ?? input.week_start_date;
  if (!fromDate) {
    errors.push({ field: 'from_date', message: 'Bắt buộc nhập từ ngày' });
    return { errors, header: null };
  }
  if (!input.from_date && input.week_start_date && weekStartOf(input.week_start_date) !== input.week_start_date) {
    errors.push({ field: 'week_start_date', message: 'Tuần bắt đầu từ thứ hai' });
  }
  const weekStart = weekStartOf(fromDate);
  const weekEnd = addDays(weekStart, 6);
  const toDate = input.to_date ?? weekEnd;
  if (toDate < fromDate) {
    errors.push({ field: 'to_date', message: 'Đến ngày không trước từ ngày' });
  } else if (toDate > weekEnd) {
    errors.push({
      field: 'to_date',
      message: `Từ ngày, đến ngày trong cùng một tuần (từ ${formatDate(weekStart)} đến ${formatDate(weekEnd)})`,
    });
  }
  const grades =
    input.grade_levels ?? (input.age_group && input.age_group !== ALL_AGES ? parseGradeLevels(input.age_group) : []);
  const gradeLevels = grades ?? [];
  const header: MenuHeader = {
    name: input.name ?? `Thực đơn tuần ${formatDate(weekStart)}`,
    month: input.month ?? fromDate.slice(0, 7),
    week_no: input.week_no ?? weekNo(weekStart),
    week_start_date: weekStart,
    from_date: fromDate,
    to_date: toDate,
    grade_levels: gradeLevels,
    age_group: gradeLevels.length === 0 ? ALL_AGES : gradeLevels.join(','),
  };
  return { errors, header };
}

// Hai thực đơn cùng tuần trùng khối: cùng áp dụng mọi khối, hoặc có chung một khối. Thực đơn chung (mọi khối) cùng tồn
// tại được với thực đơn riêng của khối; trẻ nhận thực đơn riêng của khối mình trước
export function gradesOverlap(first: string[], second: string[]): boolean {
  if (first.length === 0 || second.length === 0) {
    return first.length === 0 && second.length === 0;
  }
  return first.some((grade) => second.includes(grade));
}

// Thực đơn áp dụng cho khối của trẻ: thực đơn có khối của trẻ, không có thì thực đơn chung
export function menuForGrade<T extends { grade_levels: string[] }>(menus: T[], grade: string | null): T | undefined {
  return (
    menus.find((menu) => grade !== null && menu.grade_levels.includes(grade)) ??
    menus.find((menu) => menu.grade_levels.length === 0)
  );
}
